const page = document.documentElement;
const siteHeader = document.querySelector(".site-header");
const progressPanel = document.querySelector(".progress-panel");
const courseRows = document.querySelector("#course-rows");
const completionPercent = document.querySelector("#completion-percent");
const ratioColumns = ["attendance", "workshops", "assignments", "readings"];

const categoryColumns = [
  {
    label: "Workshop",
    nameColumn: "workshop_name",
    checkedColumn: "workshops",
    linkColumn: "workshop_links",
  },
  {
    label: "Assignment",
    nameColumn: "assignment_name",
    checkedColumn: "assignments",
    linkColumn: "assignment_links",
  },
  {
    label: "Reading",
    nameColumn: "reading_name",
    checkedColumn: "readings",
    linkColumn: "reading_links",
  },
];

const completionColors = {
  red: [255, 77, 77],
  grey: [211, 211, 211],
  green: [75, 207, 111],
};

const monthLabels = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const weekdayLabels = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function parseDateValue(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  const formatted = /^(\d{4}) ([A-Z][a-z]{2}) (\d{2})$/.exec(String(value));

  if (formatted) {
    const month = monthLabels.indexOf(formatted[2]);

    if (month >= 0) {
      return new Date(Number(formatted[1]), month, Number(formatted[3]));
    }
  }

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));

  if (iso) {
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }

  return null;
}

function toIsoDate(value) {
  const date = parseDateValue(value);

  if (!date) {
    return "";
  }

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}

function formatSessionDate(value) {
  const date = parseDateValue(value);

  if (!date) {
    return "";
  }

  return `${date.getFullYear()} ${monthLabels[date.getMonth()]} ${String(date.getDate()).padStart(2, "0")}`;
}

function applyDateValue(input, value) {
  const iso = toIsoDate(value);

  input.value = formatSessionDate(iso);
  input.dataset.isoDate = iso;
  input.dataset.savedValue = iso;
  input.dataset.dirty = "false";
}

function updateViewportType() {
  const width = window.innerWidth;
  const aspectRatio = width / window.innerHeight;

  let viewportType = "square";

  if (width <= 600) {
    viewportType = "mobile";
  } else if (aspectRatio >= 4 / 3) {
    viewportType = "wide";
  } else if (aspectRatio < 1) {
    viewportType = "portrait";
  }

  page.dataset.viewport = viewportType;
  positionCompletion();
}

updateViewportType();
window.addEventListener("resize", updateViewportType);

function mixColor(start, end, amount) {
  const color = start.map((channel, index) =>
    Math.round(channel + (end[index] - channel) * amount),
  );

  return `rgb(${color.join(" ")})`;
}

function getCompletionColor(percentage) {
  if (percentage <= 50) {
    return mixColor(
      completionColors.red,
      completionColors.grey,
      percentage / 50,
    );
  }

  return mixColor(
    completionColors.grey,
    completionColors.green,
    (percentage - 50) / 50,
  );
}

function isCountableCheckbox(checkbox) {
  if (checkbox.closest(".category-content")?.hidden) {
    return false;
  }

  return (
    checkbox.dataset.savedValue === "true" ||
    checkbox.dataset.savedValue === "false"
  );
}

function isPinnedChromeViewport() {
  return (
    page.dataset.viewport === "portrait" || page.dataset.viewport === "mobile"
  );
}

function getPercentPadding() {
  const value = Number.parseFloat(
    getComputedStyle(page).getPropertyValue("--percent-padding"),
  );

  return Number.isFinite(value) ? value : 12;
}

function positionCompletion() {
  if (!completionPercent || !progressPanel || !siteHeader) {
    return;
  }

  if (isPinnedChromeViewport()) {
    completionPercent.style.removeProperty("top");
    return;
  }

  const padding = getPercentPadding();
  const headerBottom =
    siteHeader.getBoundingClientRect().bottom + window.scrollY;
  const tableTop = progressPanel.getBoundingClientRect().top + window.scrollY;
  const percentHeight = completionPercent.offsetHeight || 40;
  const midpoint = (headerBottom + tableTop) / 2;
  const minTop = headerBottom + padding + percentHeight / 2;
  const maxTop = tableTop - padding - percentHeight / 2;
  const top =
    maxTop >= minTop
      ? Math.min(Math.max(midpoint, minTop), maxTop)
      : minTop;

  completionPercent.style.top = `${Math.max(top, 0)}px`;
}

function updateCompletion() {
  ratioColumns.forEach((column) => {
    const ratio = document.querySelector(`[data-ratio-column="${column}"]`);
    const checkboxes = [
      ...courseRows.querySelectorAll(`.session-checkbox[data-column="${column}"]`),
    ].filter(isCountableCheckbox);
    const trueCount = checkboxes.filter((checkbox) => checkbox.checked).length;
    const total = checkboxes.length;
    const percentage = total ? Math.round((trueCount / total) * 100) : 0;

    if (!ratio) {
      return;
    }

    ratio.textContent = `${trueCount}/${total}`;
    ratio.style.color = total
      ? getCompletionColor(percentage)
      : "rgb(211 211 211)";
    ratio.setAttribute(
      "aria-label",
      `${trueCount} of ${total} ${column} complete`,
    );
  });

  const allCheckboxes = [
    ...courseRows.querySelectorAll(".session-checkbox"),
  ].filter(isCountableCheckbox);
  const trueCount = allCheckboxes.filter((checkbox) => checkbox.checked).length;
  const total = allCheckboxes.length;
  const percentage = total ? Math.round((trueCount / total) * 100) : 0;

  completionPercent.textContent = `${percentage}%`;
  completionPercent.style.color = total
    ? getCompletionColor(percentage)
    : "rgb(211 211 211)";
  completionPercent.setAttribute(
    "aria-label",
    `${trueCount} of ${total} complete`,
  );
  positionCompletion();
}

function getVisitUrl(value) {
  if (!hasLinkValue(value)) {
    return "";
  }

  const trimmed = value.trim();
  const candidate = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const url = new URL(candidate);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "";
    }

    return url.href;
  } catch {
    return "";
  }
}

function applyVisitLink(input, value) {
  const visitUrl = getVisitUrl(value);
  const hasLink = Boolean(visitUrl);

  input.dataset.visitUrl = visitUrl;
  input.dataset.hasLink = String(hasLink);
  input.classList.toggle("is-linked", hasLink);
  syncLinkedName(input);
}

function syncLinkedName(input) {
  const canEdit = progressPanel.dataset.canEdit === "true";
  const hasLink = input.dataset.hasLink === "true";

  if (!canEdit && hasLink) {
    input.setAttribute("role", "link");
    input.tabIndex = 0;
    input.setAttribute("aria-description", "Opens in a new tab");
    return;
  }

  input.removeAttribute("role");
  input.removeAttribute("aria-description");
  input.tabIndex = canEdit && input.dataset.saving !== "true" ? 0 : -1;
}

function syncLinkedNames() {
  getControls()
    .filter(
      (control) =>
        control.classList.contains("progress-name") &&
        !control.classList.contains("progress-date"),
    )
    .forEach(syncLinkedName);
}

function openVisitUrl(url) {
  if (!url) {
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

function createNameInput({
  session,
  column,
  label,
  value,
  placeholder,
  linkValue,
}) {
  const input = document.createElement("input");
  const savedValue = typeof value === "string" ? value : "";

  input.className = "progress-name";
  input.type = "text";
  input.value = savedValue;
  input.placeholder = placeholder;
  input.maxLength = 160;
  input.autocomplete = "off";
  input.readOnly = true;
  input.tabIndex = -1;
  input.dataset.progressField = "";
  input.dataset.session = String(session);
  input.dataset.column = column;
  input.dataset.savedValue = savedValue;
  input.setAttribute("aria-label", `${label} for Session ${session}`);
  input.setAttribute("aria-readonly", "true");

  if (linkValue !== undefined) {
    applyVisitLink(input, linkValue);
  }

  return input;
}

function createDateInput({ session, value }) {
  const input = document.createElement("input");
  const iso = toIsoDate(value);

  input.className = "progress-name progress-date";
  input.type = "text";
  input.value = formatSessionDate(iso);
  input.placeholder = "Date";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.readOnly = true;
  input.tabIndex = -1;
  input.dataset.progressField = "";
  input.dataset.session = String(session);
  input.dataset.column = "date";
  input.dataset.isoDate = iso;
  input.dataset.savedValue = iso;
  input.dataset.locked = "true";
  input.setAttribute("aria-label", `Date for Session ${session}`);
  input.setAttribute("aria-readonly", "true");
  input.setAttribute("aria-haspopup", "dialog");

  return input;
}

function isCategoryPresent(value) {
  return value !== null && value !== undefined;
}

function createCheckbox({
  session,
  column,
  label,
  value,
  canBeAbsent = true,
}) {
  const checkbox = document.createElement("input");
  const isPresent = !canBeAbsent || isCategoryPresent(value);
  const checked = isPresent && Boolean(value);

  checkbox.className = "session-checkbox";
  checkbox.type = "checkbox";
  checkbox.checked = checked;
  checkbox.disabled = true;
  checkbox.dataset.progressField = "";
  checkbox.dataset.session = String(session);
  checkbox.dataset.column = column;
  checkbox.dataset.canBeAbsent = String(canBeAbsent);
  checkbox.dataset.savedValue = isPresent ? String(checked) : "null";
  checkbox.setAttribute(
    "aria-label",
    column === "attendance"
      ? `Mark attendance for Session ${session}`
      : `Mark ${label} for Session ${session} complete`,
  );

  return checkbox;
}

function hasLinkValue(value) {
  return typeof value === "string" && value.trim() !== "";
}

function applyLinkButton(button, value) {
  const hasLink = hasLinkValue(value);
  const label = button.dataset.categoryLabel;

  button.dataset.hasLink = String(hasLink);
  button.dataset.savedValue = hasLink ? value.trim() : "";
  button.textContent = hasLink ? "⌫" : "↗";
  button.setAttribute(
    "aria-label",
    hasLink
      ? `Delete ${label} link for Session ${button.dataset.session}`
      : `Add ${label} link for Session ${button.dataset.session}`,
  );
}

function createLinkButton({ session, column, label, value }) {
  const button = document.createElement("button");

  button.className = "link-action";
  button.type = "button";
  button.disabled = true;
  button.dataset.linkAction = "";
  button.dataset.session = String(session);
  button.dataset.column = column;
  button.dataset.categoryLabel = label;
  applyLinkButton(button, value);

  return button;
}

function createCategoryToggle({ session, column, label, value }) {
  const button = document.createElement("button");
  const isPresent = isCategoryPresent(value);

  button.className = "category-toggle";
  button.type = "button";
  button.textContent = isPresent ? "-" : "+";
  button.disabled = true;
  button.dataset.categoryToggle = "";
  button.dataset.session = String(session);
  button.dataset.column = column;
  button.dataset.categoryLabel = label;
  button.dataset.present = String(isPresent);
  button.setAttribute(
    "aria-label",
    `${isPresent ? "Remove" : "Add"} ${label} for Session ${session}`,
  );

  return button;
}

function createSessionRow(row) {
  const session = Number(row.session);
  const sessionNumber = String(session).padStart(2, "0");
  const progressRow = document.createElement("div");
  const sessionCell = document.createElement("div");
  const number = document.createElement("span");

  progressRow.className = "progress-row";
  progressRow.dataset.sessionRow = String(session);
  progressRow.setAttribute("role", "row");

  sessionCell.className = "progress-cell progress-cell--session";
  sessionCell.dataset.label = "Session";
  sessionCell.setAttribute("role", "cell");

  number.className = "session-number";
  number.textContent = sessionNumber;
  number.setAttribute("aria-hidden", "true");

  sessionCell.append(
    number,
    createDateInput({
      session,
      value: row.date,
    }),
    createNameInput({
      session,
      column: "session_name",
      label: "Session name",
      value: row.session_name,
      placeholder: "Session name",
    }),
    createCheckbox({
      session,
      column: "attendance",
      label: "Attendance",
      value: row.attendance,
      canBeAbsent: false,
    }),
  );
  progressRow.append(sessionCell);

  categoryColumns.forEach(
    ({ label, nameColumn, checkedColumn, linkColumn }) => {
      const cell = document.createElement("div");
      const content = document.createElement("div");
      const isPresent = isCategoryPresent(row[checkedColumn]);

      cell.className = "progress-cell progress-cell--category";
      cell.dataset.label = label;
      cell.classList.toggle("is-absent", !isPresent);
      cell.setAttribute("role", "cell");

      content.className = "category-content";
      content.hidden = !isPresent;
      content.append(
        createNameInput({
          session,
          column: nameColumn,
          label: `${label} name`,
          value: row[nameColumn],
          placeholder: `${label} name`,
          linkValue: linkColumn ? row[linkColumn] : undefined,
        }),
      );

      if (linkColumn) {
        content.append(
          createLinkButton({
            session,
            column: linkColumn,
            label,
            value: row[linkColumn],
          }),
        );
      }

      content.append(
        createCheckbox({
          session,
          column: checkedColumn,
          label,
          value: row[checkedColumn],
        }),
      );
      cell.append(
        createCategoryToggle({
          session,
          column: checkedColumn,
          label,
          value: row[checkedColumn],
        }),
        content,
      );
      progressRow.append(cell);
    },
  );

  return progressRow;
}

function renderRows(rows) {
  const fragment = document.createDocumentFragment();
  const validRows = rows
    .filter((row) => Number.isFinite(Number(row.session)))
    .sort((first, second) => Number(first.session) - Number(second.session));

  courseRows.replaceChildren();

  if (!validRows.length) {
    const message = document.createElement("p");

    message.className = "progress-table__message";
    message.textContent = "No course sessions found";
    courseRows.append(message);
  } else {
    validRows.forEach((row) => fragment.append(createSessionRow(row)));
    courseRows.append(fragment);
  }

  progressPanel.setAttribute("aria-busy", "false");
  updateCompletion();
  window.requestAnimationFrame(positionCompletion);
}

function getControls() {
  return [...courseRows.querySelectorAll("[data-progress-field]")];
}

function getControl(session, column) {
  return getControls().find(
    (control) =>
      control.dataset.session === String(session) &&
      control.dataset.column === column,
  );
}

function getToggles() {
  return [...courseRows.querySelectorAll("[data-category-toggle]")];
}

function getLinkButtons() {
  return [...courseRows.querySelectorAll("[data-link-action]")];
}

function getLinkButton(session, column) {
  return getLinkButtons().find(
    (button) =>
      button.dataset.session === String(session) &&
      button.dataset.column === column,
  );
}

function setLinkValue(session, column, value) {
  const button = getLinkButton(session, column);
  const category = categoryColumns.find((item) => item.linkColumn === column);
  const nameInput = category
    ? getControl(session, category.nameColumn)
    : null;

  if (button) {
    applyLinkButton(button, value);
  }

  if (nameInput) {
    applyVisitLink(nameInput, value);
  }
}

function getToggle(session, column) {
  return getToggles().find(
    (toggle) =>
      toggle.dataset.session === String(session) &&
      toggle.dataset.column === column,
  );
}

function setCategoryPresence(session, column, value) {
  const toggle = getToggle(session, column);

  if (!toggle) {
    return;
  }

  const isPresent = isCategoryPresent(value);
  const label = toggle.dataset.categoryLabel;
  const cell = toggle.closest(".progress-cell--category");
  const content = cell.querySelector(".category-content");

  toggle.textContent = isPresent ? "-" : "+";
  toggle.dataset.present = String(isPresent);
  toggle.setAttribute(
    "aria-label",
    `${isPresent ? "Remove" : "Add"} ${label} for Session ${session}`,
  );
  content.hidden = !isPresent;
  cell.classList.toggle("is-absent", !isPresent);
}

const datePicker = document.createElement("div");
const datePickerLabel = document.createElement("p");
const datePickerDays = document.createElement("div");
let datePickerInput = null;
let datePickerMonth = new Date();

datePicker.className = "date-picker";
datePicker.hidden = true;
datePicker.setAttribute("role", "dialog");
datePicker.setAttribute("aria-label", "Choose a session date");

datePickerLabel.className = "date-picker__label";
datePickerDays.className = "date-picker__days";

const datePickerHeader = document.createElement("div");
const datePickerPrevious = document.createElement("button");
const datePickerNext = document.createElement("button");
const datePickerWeekdays = document.createElement("div");

datePickerHeader.className = "date-picker__header";
datePickerPrevious.className = "date-picker__nav";
datePickerPrevious.type = "button";
datePickerPrevious.textContent = "‹";
datePickerPrevious.setAttribute("aria-label", "Previous month");
datePickerNext.className = "date-picker__nav";
datePickerNext.type = "button";
datePickerNext.textContent = "›";
datePickerNext.setAttribute("aria-label", "Next month");
datePickerWeekdays.className = "date-picker__weekdays";
weekdayLabels.forEach((label) => {
  const weekday = document.createElement("span");

  weekday.textContent = label;
  datePickerWeekdays.append(weekday);
});

datePickerHeader.append(datePickerPrevious, datePickerLabel, datePickerNext);
datePicker.append(datePickerHeader, datePickerWeekdays, datePickerDays);
document.body.append(datePicker);

function closeDatePicker() {
  datePicker.hidden = true;
  datePickerInput = null;
}

function positionDatePicker() {
  if (!datePickerInput) {
    return;
  }

  const bounds = datePickerInput.getBoundingClientRect();
  const pickerWidth = datePicker.offsetWidth || 260;
  const left = Math.min(
    Math.max(12, bounds.left),
    window.innerWidth - pickerWidth - 12,
  );
  const top = bounds.bottom + 8;

  datePicker.style.left = `${left}px`;
  datePicker.style.top = `${Math.min(top, window.innerHeight - 280)}px`;
}

function renderDatePicker() {
  const year = datePickerMonth.getFullYear();
  const month = datePickerMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const selected = parseDateValue(datePickerInput?.dataset.isoDate);
  const today = new Date();

  datePickerLabel.textContent = `${monthLabels[month]} ${year}`;
  datePickerDays.replaceChildren();

  for (let spacer = 0; spacer < firstDay; spacer += 1) {
    const empty = document.createElement("span");

    empty.className = "date-picker__day is-empty";
    datePickerDays.append(empty);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const button = document.createElement("button");
    const isSelected =
      selected &&
      selected.getFullYear() === year &&
      selected.getMonth() === month &&
      selected.getDate() === day;
    const isToday =
      today.getFullYear() === year &&
      today.getMonth() === month &&
      today.getDate() === day;

    button.className = "date-picker__day";
    button.type = "button";
    button.textContent = String(day);
    button.dataset.day = String(day);
    button.classList.toggle("is-selected", Boolean(isSelected));
    button.classList.toggle("is-today", isToday && !isSelected);
    datePickerDays.append(button);
  }

  positionDatePicker();
}

function openDatePicker(input) {
  if (input.dataset.locked === "true") {
    return;
  }

  datePickerInput = input;
  datePickerMonth = parseDateValue(input.dataset.isoDate) || new Date();
  datePicker.hidden = false;
  renderDatePicker();
}

courseRows.addEventListener("change", (event) => {
  const checkbox = event.target.closest(".session-checkbox");

  if (!checkbox || checkbox.closest(".category-content")?.hidden) {
    return;
  }

  updateCompletion();
});

courseRows.addEventListener("click", (event) => {
  const dateInput = event.target.closest(".progress-date");

  if (dateInput) {
    openDatePicker(dateInput);
    return;
  }

  const linkedName = event.target.closest(".progress-name.is-linked");

  if (
    linkedName &&
    progressPanel.dataset.canEdit !== "true" &&
    linkedName.dataset.visitUrl
  ) {
    event.preventDefault();
    openVisitUrl(linkedName.dataset.visitUrl);
  }
});

courseRows.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  const linkedName = event.target.closest(".progress-name.is-linked");

  if (
    !linkedName ||
    progressPanel.dataset.canEdit === "true" ||
    !linkedName.dataset.visitUrl
  ) {
    return;
  }

  event.preventDefault();
  openVisitUrl(linkedName.dataset.visitUrl);
});

datePickerPrevious.addEventListener("click", () => {
  datePickerMonth = new Date(
    datePickerMonth.getFullYear(),
    datePickerMonth.getMonth() - 1,
    1,
  );
  renderDatePicker();
});

datePickerNext.addEventListener("click", () => {
  datePickerMonth = new Date(
    datePickerMonth.getFullYear(),
    datePickerMonth.getMonth() + 1,
    1,
  );
  renderDatePicker();
});

datePickerDays.addEventListener("click", (event) => {
  const day = event.target.closest("[data-day]");

  if (!day || !datePickerInput) {
    return;
  }

  const iso = toIsoDate(
    new Date(
      datePickerMonth.getFullYear(),
      datePickerMonth.getMonth(),
      Number(day.dataset.day),
    ),
  );

  datePickerInput.value = formatSessionDate(iso);
  datePickerInput.dataset.isoDate = iso;
  datePickerInput.dataset.dirty = String(iso !== datePickerInput.dataset.savedValue);
  datePickerInput.dispatchEvent(new Event("change", { bubbles: true }));
  closeDatePicker();
});

document.addEventListener("pointerdown", (event) => {
  if (
    datePicker.hidden ||
    datePicker.contains(event.target) ||
    event.target.closest(".progress-date")
  ) {
    return;
  }

  closeDatePicker();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !datePicker.hidden) {
    closeDatePicker();
  }
});

window.addEventListener("resize", () => {
  positionCompletion();

  if (!datePicker.hidden) {
    positionDatePicker();
  }
});

if (typeof ResizeObserver === "function") {
  new ResizeObserver(positionCompletion).observe(progressPanel);
}

progressPanel.addEventListener("pointermove", (event) => {
  const bounds = progressPanel.getBoundingClientRect();

  progressPanel.style.setProperty(
    "--pointer-x",
    `${event.clientX - bounds.left}px`,
  );
  progressPanel.style.setProperty(
    "--pointer-y",
    `${event.clientY - bounds.top}px`,
  );
});

window.courseProgressUI = Object.freeze({
  applyDateValue,
  getControl,
  getControls,
  getLinkButtons,
  getToggles,
  renderRows,
  setCategoryPresence,
  setLinkValue,
  syncLinkedNames,
  updateCompletion,
});

updateCompletion();
