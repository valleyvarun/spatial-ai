(() => {
  const SUPABASE_URL = "https://riniefacxvoxdhnnxlrq.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_H5w8N4NROSynsrCnp74ZTQ_axYmJNCF";
  const OWNER_USER_ID = "f4081d8b-aa93-482a-b7ce-f0625b8c3d0f";

  const authControls = document.querySelector(".auth-controls");
  const accessStatus = document.querySelector("#access-status");
  const authAction = document.querySelector("#auth-action");
  const editToggle = document.querySelector("#edit-toggle");
  const authDialog = document.querySelector("#auth-dialog");
  const authForm = document.querySelector("#auth-form");
  const authEmail = document.querySelector("#auth-email");
  const authPassword = document.querySelector("#auth-password");
  const authMessage = document.querySelector("#auth-message");
  const authSubmit = document.querySelector("#auth-submit");
  const authCancel = document.querySelector("#auth-cancel");
  const linkDialog = document.querySelector("#link-dialog");
  const linkForm = document.querySelector("#link-form");
  const linkInput = document.querySelector("#link-input");
  const linkMessage = document.querySelector("#link-message");
  const linkSubmit = document.querySelector("#link-submit");
  const linkCancel = document.querySelector("#link-cancel");
  const linkDeleteDialog = document.querySelector("#link-delete-dialog");
  const linkDeleteForm = document.querySelector("#link-delete-form");
  const linkDeleteConfirm = document.querySelector("#link-delete-confirm");
  const linkDeleteCancel = document.querySelector("#link-delete-cancel");
  const courseRows = document.querySelector("#course-rows");
  const progressPanel = document.querySelector(".progress-panel");
  const progressUI = window.courseProgressUI;
  const selectedColumns = [
    "session",
    "date",
    "attendance",
    "workshops",
    "assignments",
    "readings",
    "session_name",
    "workshop_name",
    "assignment_name",
    "reading_name",
    "workshop_links",
    "assignment_links",
    "reading_links",
  ];
  const linkColumns = new Set([
    "workshop_links",
    "assignment_links",
    "reading_links",
  ]);
  const editableColumns = new Set(selectedColumns.slice(1));
  const booleanColumns = new Set([
    "attendance",
    "workshops",
    "assignments",
    "readings",
  ]);
  const nullableBooleanColumns = new Set([
    "workshops",
    "assignments",
    "readings",
  ]);

  let activeSession = null;
  let dataReady = false;
  let statusResetTimer = null;
  let reloadTimer = null;
  let pendingSaves = 0;
  let editMode = false;
  let attendanceNormalized = false;
  let activeLinkButton = null;

  function refreshCompletion() {
    progressUI?.updateCompletion();
  }

  function isOwnerSession(session = activeSession) {
    return session?.user?.id === OWNER_USER_ID;
  }

  function canEditProgress() {
    return dataReady && isOwnerSession() && editMode;
  }

  function setEditMode(enabled) {
    editMode = Boolean(enabled) && isOwnerSession();
    editToggle.hidden = !isOwnerSession();
    editToggle.setAttribute("aria-pressed", String(editMode));
    authControls.dataset.editing = String(editMode);
    renderAccountState();
  }

  function setEditorAccess() {
    const canEdit = canEditProgress();

    progressPanel.dataset.canEdit = String(canEdit);

    progressUI.getControls().forEach((control) => {
      const locked = !canEdit || control.dataset.saving === "true";

      if (control.matches(".session-checkbox")) {
        control.disabled = locked;
      } else if (control.matches(".progress-date")) {
        control.dataset.locked = String(locked);
        control.tabIndex = locked ? -1 : 0;
        control.setAttribute("aria-readonly", String(locked));
      } else {
        control.readOnly = locked;
        control.tabIndex = locked ? -1 : 0;
        control.setAttribute("aria-readonly", String(locked));
      }
    });

    progressUI.getToggles().forEach((toggle) => {
      toggle.disabled = !canEdit || toggle.dataset.saving === "true";
    });

    progressUI.getLinkButtons().forEach((button) => {
      button.disabled = !canEdit || button.dataset.saving === "true";
    });

    progressUI.syncLinkedNames();
  }

  function renderAccountState() {
    window.clearTimeout(statusResetTimer);
    authAction.disabled = false;

    if (isOwnerSession()) {
      authControls.dataset.mode = "owner";
      accessStatus.textContent = !dataReady
        ? "Loading"
        : pendingSaves
          ? "Saving"
          : editMode
            ? "Editing"
            : "View only";
      authAction.textContent = "Sign out";
    } else if (activeSession) {
      authControls.dataset.mode = "visitor";
      accessStatus.textContent = "View only";
      authAction.textContent = "Sign out";
    } else {
      authControls.dataset.mode = "visitor";
      accessStatus.textContent = dataReady ? "View only" : "Loading";
      authAction.textContent = "Owner login";
    }

    setEditorAccess();
  }

  function showControlError(message) {
    window.clearTimeout(statusResetTimer);
    authControls.dataset.mode = "error";
    accessStatus.textContent = message;
    statusResetTimer = window.setTimeout(renderAccountState, 3000);
  }

  function setControlValue(control, value) {
    if (control.matches(".session-checkbox")) {
      const canBeAbsent = control.dataset.canBeAbsent === "true";
      const isPresent = !canBeAbsent || (value !== null && value !== undefined);
      const checked = isPresent && Boolean(value);

      control.checked = checked;
      control.dataset.savedValue = isPresent ? String(checked) : "null";

      if (canBeAbsent) {
        progressUI.setCategoryPresence(
          control.dataset.session,
          control.dataset.column,
          value,
        );
      }
    } else if (control.matches(".progress-date")) {
      progressUI.applyDateValue(control, value);
    } else {
      const text = typeof value === "string" ? value : "";

      control.value = text;
      control.dataset.savedValue = text;
      control.dataset.dirty = "false";
    }
  }

  function applyProgressRow(row, forceColumn = null) {
    selectedColumns.slice(1).forEach((column) => {
      if (!Object.hasOwn(row, column)) {
        return;
      }

      if (linkColumns.has(column)) {
        progressUI.setLinkValue(row.session, column, row[column]);
        return;
      }

      const control = progressUI.getControl(row.session, column);

      if (!control) {
        return;
      }

      const hasLocalChange =
        control.dataset.dirty === "true" ||
        control.dataset.saving === "true";

      if (hasLocalChange && column !== forceColumn) {
        return;
      }

      setControlValue(control, row[column]);
    });
  }

  async function loadProgress() {
    const { data, error } = await supabaseClient
      .from("course_progress")
      .select(selectedColumns.join(", "))
      .order("session", { ascending: true });

    if (error) {
      dataReady = false;
      showControlError("Data error");
      setEditorAccess();
      console.error("Could not load course progress:", error);
      return;
    }

    progressUI.renderRows(
      data.map((row) => ({
        ...row,
        attendance: Boolean(row.attendance),
      })),
    );
    dataReady = true;
    refreshCompletion();
    renderAccountState();
    persistMissingAttendance();
  }

  async function persistMissingAttendance() {
    if (!isOwnerSession() || !dataReady || attendanceNormalized || pendingSaves) {
      return;
    }

    attendanceNormalized = true;

    const { error } = await supabaseClient
      .from("course_progress")
      .update({ attendance: false })
      .is("attendance", null);

    if (error) {
      attendanceNormalized = false;
      console.error("Could not normalize attendance values:", error);
    }
  }

  async function saveProgress(control) {
    const session = Number(control.dataset.session);
    const column = control.dataset.column;
    const isCheckbox = booleanColumns.has(column);
    const isDate = column === "date";
    const previousValue = isCheckbox
      ? control.dataset.savedValue === "null"
        ? null
        : control.dataset.savedValue === "true"
      : control.dataset.savedValue || "";

    if (
      !canEditProgress() ||
      !Number.isFinite(session) ||
      !editableColumns.has(column)
    ) {
      setControlValue(control, previousValue);
      refreshCompletion();
      return;
    }

    const nextValue = isCheckbox
      ? control.checked
      : isDate
        ? control.dataset.isoDate || ""
        : control.value.trim();

    if (!isCheckbox && !isDate) {
      control.value = nextValue;
    }

    if (nextValue === previousValue) {
      control.dataset.dirty = "false";
      return;
    }

    control.dataset.saving = "true";
    pendingSaves += 1;
    renderAccountState();

    const { data, error } = await supabaseClient
      .from("course_progress")
      .update({ [column]: isCheckbox ? nextValue : nextValue || null })
      .eq("session", session)
      .select(selectedColumns.join(", "))
      .maybeSingle();

    delete control.dataset.saving;
    pendingSaves = Math.max(0, pendingSaves - 1);

    if (error || !data) {
      setControlValue(control, previousValue);
      refreshCompletion();
      showControlError("Save failed");
      console.error("Could not save course progress:", error);
    } else {
      applyProgressRow(data, column);
      refreshCompletion();
      renderAccountState();
    }

    setEditorAccess();
  }

  async function saveCategoryPresence(toggle) {
    const session = Number(toggle.dataset.session);
    const column = toggle.dataset.column;

    if (
      !canEditProgress() ||
      !Number.isFinite(session) ||
      !nullableBooleanColumns.has(column)
    ) {
      return;
    }

    const nextValue = toggle.dataset.present === "true" ? null : false;

    toggle.dataset.saving = "true";
    pendingSaves += 1;
    renderAccountState();

    const { data, error } = await supabaseClient
      .from("course_progress")
      .update({ [column]: nextValue })
      .eq("session", session)
      .select(selectedColumns.join(", "))
      .maybeSingle();

    delete toggle.dataset.saving;
    pendingSaves = Math.max(0, pendingSaves - 1);

    if (error || !data) {
      showControlError("Save failed");
      console.error("Could not change category availability:", error);
    } else {
      applyProgressRow(data, column);
      refreshCompletion();
      renderAccountState();
    }

    setEditorAccess();
  }

  async function saveLink(button, nextValue) {
    const session = Number(button.dataset.session);
    const column = button.dataset.column;
    const savedLink = nextValue ? nextValue.trim() : "";

    if (
      !canEditProgress() ||
      !Number.isFinite(session) ||
      !linkColumns.has(column)
    ) {
      return false;
    }

    button.dataset.saving = "true";
    pendingSaves += 1;
    renderAccountState();

    const { data, error } = await supabaseClient
      .from("course_progress")
      .update({ [column]: savedLink || null })
      .eq("session", session)
      .select(selectedColumns.join(", "))
      .maybeSingle();

    delete button.dataset.saving;
    pendingSaves = Math.max(0, pendingSaves - 1);

    if (error || !data) {
      showControlError("Save failed");
      console.error("Could not save the link:", error);
      setEditorAccess();
      return false;
    }

    applyProgressRow(data, column);
    renderAccountState();
    setEditorAccess();
    return true;
  }

  function openAddLinkDialog(button) {
    activeLinkButton = button;
    linkMessage.textContent = "";
    linkInput.value = button.dataset.savedValue || "";
    linkDialog.showModal();
    window.setTimeout(() => linkInput.focus(), 0);
  }

  function openDeleteLinkDialog(button) {
    activeLinkButton = button;
    linkDeleteDialog.showModal();
  }

  function closeLinkDialogs() {
    if (linkDialog.open) {
      linkDialog.close();
    }

    if (linkDeleteDialog.open) {
      linkDeleteDialog.close();
    }

    activeLinkButton = null;
    linkMessage.textContent = "";
    linkInput.value = "";
  }

  async function handleLinkSubmit(event) {
    event.preventDefault();

    if (!activeLinkButton) {
      return;
    }

    const nextValue = linkInput.value.trim();

    if (!nextValue) {
      linkMessage.textContent = "Enter a link first.";
      return;
    }

    linkSubmit.disabled = true;
    const saved = await saveLink(activeLinkButton, nextValue);
    linkSubmit.disabled = false;

    if (saved) {
      closeLinkDialogs();
    } else {
      linkMessage.textContent = "Could not save the link.";
    }
  }

  async function handleLinkDelete(event) {
    event.preventDefault();

    if (!activeLinkButton) {
      return;
    }

    linkDeleteConfirm.disabled = true;
    const saved = await saveLink(activeLinkButton, null);
    linkDeleteConfirm.disabled = false;

    if (saved) {
      closeLinkDialogs();
    }
  }

  function applySession(session) {
    activeSession = session;

    if (!isOwnerSession()) {
      editMode = false;
    }

    editToggle.hidden = !isOwnerSession();
    editToggle.setAttribute("aria-pressed", String(editMode));
    authControls.dataset.editing = String(editMode);
    renderAccountState();
    persistMissingAttendance();

    if (isOwnerSession() && authDialog.open) {
      authDialog.close();
    }
  }

  function openLoginDialog() {
    authMessage.textContent = "";
    authPassword.value = "";
    authDialog.showModal();
    window.setTimeout(() => authEmail.focus(), 0);
  }

  async function handleAuthAction() {
    if (!activeSession) {
      openLoginDialog();
      return;
    }

    authAction.disabled = true;
    accessStatus.textContent = "Signing out";
    const { error } = await supabaseClient.auth.signOut();

    if (error) {
      showControlError("Sign out failed");
      console.error("Could not sign out:", error);
      authAction.disabled = false;
      return;
    }

    applySession(null);
  }

  async function handleLogin(event) {
    event.preventDefault();
    authMessage.textContent = "";
    authSubmit.disabled = true;
    authSubmit.textContent = "Signing in";

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: authEmail.value.trim(),
      password: authPassword.value,
    });

    authSubmit.disabled = false;
    authSubmit.textContent = "Sign in";

    if (error) {
      authMessage.textContent = error.message;
      return;
    }

    if (data.user?.id !== OWNER_USER_ID) {
      await supabaseClient.auth.signOut();
      authMessage.textContent = "This account does not have editing access.";
      return;
    }

    authPassword.value = "";
    authDialog.close();
  }

  function subscribeToProgress() {
    supabaseClient
      .channel("course-progress")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "course_progress",
        },
        ({ eventType, new: row }) => {
          if (eventType === "UPDATE") {
            applyProgressRow(row);
            refreshCompletion();
            return;
          }

          window.clearTimeout(reloadTimer);
          reloadTimer = window.setTimeout(loadProgress, 100);
        },
      )
      .subscribe();
  }

  if (!window.supabase || !progressUI) {
    authControls.dataset.mode = "error";
    accessStatus.textContent = "Connection error";
    authAction.disabled = true;
    console.error("The Supabase client or course interface did not load.");
    return;
  }

  const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
  );

  courseRows.addEventListener("input", (event) => {
    const control = event.target.closest("[data-progress-field]");

    if (
      !control ||
      control.matches(".session-checkbox") ||
      control.matches(".progress-date")
    ) {
      return;
    }

    control.dataset.dirty = String(
      control.value !== (control.dataset.savedValue || ""),
    );
  });

  courseRows.addEventListener("change", (event) => {
    const control = event.target.closest("[data-progress-field]");

    if (control) {
      saveProgress(control);
    }
  });

  courseRows.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-category-toggle]");
    const linkButton = event.target.closest("[data-link-action]");

    if (toggle) {
      saveCategoryPresence(toggle);
      return;
    }

    if (!linkButton || !canEditProgress()) {
      return;
    }

    if (linkButton.dataset.hasLink === "true") {
      openDeleteLinkDialog(linkButton);
    } else {
      openAddLinkDialog(linkButton);
    }
  });

  courseRows.addEventListener("keydown", (event) => {
    const control = event.target.closest(".progress-name");

    if (!control || control.matches(".progress-date")) {
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      control.blur();
    } else if (event.key === "Escape") {
      setControlValue(control, control.dataset.savedValue || "");
      control.blur();
    }
  });

  authAction.addEventListener("click", handleAuthAction);
  editToggle.addEventListener("click", () => {
    setEditMode(!editMode);
  });
  authForm.addEventListener("submit", handleLogin);
  authCancel.addEventListener("click", () => authDialog.close());
  authDialog.addEventListener("close", () => {
    authMessage.textContent = "";
    authPassword.value = "";
  });
  authDialog.addEventListener("click", (event) => {
    if (event.target === authDialog) {
      authDialog.close();
    }
  });
  linkForm.addEventListener("submit", handleLinkSubmit);
  linkCancel.addEventListener("click", closeLinkDialogs);
  linkDialog.addEventListener("click", (event) => {
    if (event.target === linkDialog) {
      closeLinkDialogs();
    }
  });
  linkDialog.addEventListener("close", () => {
    linkMessage.textContent = "";
    linkInput.value = "";
  });
  linkDeleteForm.addEventListener("submit", handleLinkDelete);
  linkDeleteCancel.addEventListener("click", closeLinkDialogs);
  linkDeleteDialog.addEventListener("click", (event) => {
    if (event.target === linkDeleteDialog) {
      closeLinkDialogs();
    }
  });

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    window.setTimeout(() => applySession(session), 0);
  });

  Promise.all([
    loadProgress(),
    supabaseClient.auth.getSession().then(({ data, error }) => {
      if (error) {
        showControlError("Auth error");
        console.error("Could not restore the login session:", error);
        return;
      }

      applySession(data.session);
    }),
  ]);

  subscribeToProgress();
})();
