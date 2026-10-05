(() => {
  const SUPABASE_URL = "https://riniefacxvoxdhnnxlrq.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_H5w8N4NROSynsrCnp74ZTQ_axYmJNCF";
  const OWNER_USER_ID = "f4081d8b-aa93-482a-b7ce-f0625b8c3d0f";

  const authControls = document.querySelector(".auth-controls");
  const accessStatus = document.querySelector("#access-status");
  const authAction = document.querySelector("#auth-action");
  const authDialog = document.querySelector("#auth-dialog");
  const authForm = document.querySelector("#auth-form");
  const authEmail = document.querySelector("#auth-email");
  const authPassword = document.querySelector("#auth-password");
  const authMessage = document.querySelector("#auth-message");
  const authSubmit = document.querySelector("#auth-submit");
  const authCancel = document.querySelector("#auth-cancel");
  const progressCheckboxes = [
    ...document.querySelectorAll(".session-checkbox"),
  ];
  const checkboxById = new Map(
    progressCheckboxes.map((checkbox) => [
      checkbox.dataset.itemId,
      checkbox,
    ]),
  );

  let activeSession = null;
  let dataReady = false;
  let statusResetTimer = null;

  function refreshCompletion() {
    if (typeof window.updateCompletion === "function") {
      window.updateCompletion();
    }
  }

  function isOwnerSession(session = activeSession) {
    return session?.user?.id === OWNER_USER_ID;
  }

  function setCheckboxAccess() {
    const canEdit = dataReady && isOwnerSession();

    progressCheckboxes.forEach((checkbox) => {
      checkbox.disabled = !canEdit || checkbox.dataset.saving === "true";
    });
  }

  function renderAccountState() {
    window.clearTimeout(statusResetTimer);
    authAction.disabled = false;

    if (isOwnerSession()) {
      authControls.dataset.mode = "owner";
      accessStatus.textContent = dataReady ? "Editing" : "Loading";
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

    setCheckboxAccess();
  }

  function showControlError(message) {
    window.clearTimeout(statusResetTimer);
    authControls.dataset.mode = "error";
    accessStatus.textContent = message;
    statusResetTimer = window.setTimeout(renderAccountState, 3000);
  }

  function applyProgressRow(row) {
    const checkbox = checkboxById.get(row.id);

    if (!checkbox) {
      return;
    }

    checkbox.checked = Boolean(row.checked);
  }

  async function loadProgress() {
    const { data, error } = await supabaseClient
      .from("course_progress")
      .select("id, checked");

    if (error) {
      dataReady = false;
      showControlError("Data error");
      setCheckboxAccess();
      console.error("Could not load course progress:", error);
      return;
    }

    data.forEach(applyProgressRow);
    dataReady = true;
    refreshCompletion();
    renderAccountState();
  }

  async function saveProgress(checkbox) {
    const previousValue = !checkbox.checked;

    if (!isOwnerSession() || !dataReady) {
      checkbox.checked = previousValue;
      refreshCompletion();
      return;
    }

    checkbox.dataset.saving = "true";
    checkbox.disabled = true;

    const { data, error } = await supabaseClient
      .from("course_progress")
      .update({ checked: checkbox.checked })
      .eq("id", checkbox.dataset.itemId)
      .select("id, checked")
      .maybeSingle();

    delete checkbox.dataset.saving;

    if (error || !data) {
      checkbox.checked = previousValue;
      refreshCompletion();
      showControlError("Save failed");
      console.error("Could not save course progress:", error);
    } else {
      applyProgressRow(data);
      refreshCompletion();
    }

    setCheckboxAccess();
  }

  function applySession(session) {
    activeSession = session;
    renderAccountState();

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
          event: "UPDATE",
          schema: "public",
          table: "course_progress",
        },
        ({ new: row }) => {
          applyProgressRow(row);
          refreshCompletion();
        },
      )
      .subscribe();
  }

  if (!window.supabase) {
    authControls.dataset.mode = "error";
    accessStatus.textContent = "Connection error";
    authAction.disabled = true;
    console.error("The Supabase client library did not load.");
    return;
  }

  const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
  );

  progressCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", () => saveProgress(checkbox));
  });

  authAction.addEventListener("click", handleAuthAction);
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
