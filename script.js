const page = document.documentElement;

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
}

updateViewportType();
window.addEventListener("resize", updateViewportType);

document.querySelectorAll(".session-list").forEach((list) => {
  const resourceName = list.dataset.resource;
  const sessions = document.createDocumentFragment();

  for (let session = 1; session <= 12; session += 1) {
    const sessionNumber = String(session).padStart(2, "0");
    const item = document.createElement("li");
    const isEmptyFirstRow = session === 1 && resourceName !== "Workshops";

    item.className = "session-item";

    if (isEmptyFirstRow) {
      item.setAttribute("aria-hidden", "true");
      sessions.append(item);
      continue;
    }

    const plus = document.createElement("span");
    const name = document.createElement("span");
    const checkbox = document.createElement("input");

    plus.className = "session-plus";
    plus.textContent = "+";
    plus.setAttribute("aria-hidden", "true");
    name.className = "session-name";
    name.textContent = `Session ${sessionNumber}`;
    checkbox.className = "session-checkbox";
    checkbox.type = "checkbox";
    checkbox.disabled = true;
    checkbox.dataset.itemId =
      `${resourceName.toLowerCase()}-${sessionNumber}`;
    checkbox.setAttribute(
      "aria-label",
      `Mark ${resourceName} Session ${sessionNumber} complete`,
    );

    item.append(plus, name, checkbox);
    sessions.append(item);
  }

  list.append(sessions);
});

const completion = document.querySelector("#completion");
const checkboxes = [...document.querySelectorAll(".session-checkbox")];
const completionColors = {
  red: [255, 77, 77],
  grey: [211, 211, 211],
  green: [75, 207, 111],
};

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

function updateCompletion() {
  const checkedCount = checkboxes.filter((checkbox) => checkbox.checked).length;
  const percentage = Math.round((checkedCount / checkboxes.length) * 100);

  completion.textContent = `${percentage} %`;
  completion.style.color = getCompletionColor(percentage);
  completion.setAttribute("aria-label", `${percentage} percent complete`);
}

checkboxes.forEach((checkbox) => {
  checkbox.addEventListener("change", updateCompletion);
});

document.querySelectorAll(".resource-card").forEach((card) => {
  card.addEventListener("pointermove", (event) => {
    const bounds = card.getBoundingClientRect();

    card.style.setProperty("--pointer-x", `${event.clientX - bounds.left}px`);
    card.style.setProperty("--pointer-y", `${event.clientY - bounds.top}px`);
  });
});

updateCompletion();
