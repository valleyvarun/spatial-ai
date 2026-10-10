const drawingCanvas = document.querySelector("#drawing-canvas");
const drawToggle = document.querySelector("#draw-toggle");
const clearDrawingButton = document.querySelector("#clear-drawing");
const drawingContext = drawingCanvas.getContext("2d");

const strokes = [];
let activeStroke = null;
let activePointerId = null;
let drawingEnabled = false;
let canvasWidth = 0;
let canvasHeight = 0;
let canvasScale = 1;
let resizeFrame = null;

function getDocumentSize() {
  const root = document.documentElement;
  const pageElements = [...document.body.children].filter(
    (element) =>
      element !== drawingCanvas &&
      !element.classList.contains("drawing-tools") &&
      !element.classList.contains("site-footer"),
  );
  const elementBounds = pageElements.map((element) =>
    element.getBoundingClientRect(),
  );

  return {
    width: Math.ceil(
      Math.max(
        root.clientWidth,
        ...elementBounds.map((bounds) => bounds.right + window.scrollX),
      ),
    ),
    height: Math.ceil(
      Math.max(
        root.clientHeight,
        ...elementBounds.map((bounds) => bounds.bottom + window.scrollY),
      ),
    ),
  };
}

function clearCanvas() {
  drawingContext.clearRect(0, 0, canvasWidth, canvasHeight);
}

function drawCrayonDab(point) {
  const pressure = point.pressure || 0.5;
  const radius = 2.5 + pressure * 2;

  drawingContext.save();

  for (let particle = 0; particle < 18; particle += 1) {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * radius;
    const size = 0.7 + Math.random() * 1.5;

    drawingContext.fillStyle = `rgb(139 92 246 / ${0.2 + Math.random() * 0.35})`;
    drawingContext.fillRect(
      point.x + Math.cos(angle) * distance,
      point.y + Math.sin(angle) * distance,
      size,
      size,
    );
  }

  drawingContext.restore();
}

function drawCrayonSegment(start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.hypot(dx, dy);
  const pressure = (start.pressure + end.pressure) / 2 || 0.5;
  const strokeWidth = 4 + pressure * 3;

  if (distance < 0.25) {
    drawCrayonDab(end);
    return;
  }

  drawingContext.save();
  drawingContext.lineCap = "round";
  drawingContext.lineJoin = "round";

  drawingContext.beginPath();
  drawingContext.moveTo(start.x, start.y);
  drawingContext.lineTo(end.x, end.y);
  drawingContext.lineWidth = strokeWidth;
  drawingContext.strokeStyle = "rgb(139 92 246 / 42%)";
  drawingContext.stroke();

  for (let layer = 0; layer < 5; layer += 1) {
    const startJitterX = (Math.random() - 0.5) * strokeWidth;
    const startJitterY = (Math.random() - 0.5) * strokeWidth;
    const endJitterX = (Math.random() - 0.5) * strokeWidth;
    const endJitterY = (Math.random() - 0.5) * strokeWidth;

    drawingContext.beginPath();
    drawingContext.moveTo(start.x + startJitterX, start.y + startJitterY);
    drawingContext.lineTo(end.x + endJitterX, end.y + endJitterY);
    drawingContext.lineWidth = 0.7 + Math.random() * 1.4;
    drawingContext.strokeStyle = `rgb(161 112 255 / ${0.18 + Math.random() * 0.18})`;
    drawingContext.stroke();
  }

  const particleCount = Math.max(1, Math.floor(distance / 2.5));

  for (let particle = 0; particle < particleCount; particle += 1) {
    const amount = Math.random();
    const offset = (Math.random() - 0.5) * strokeWidth;
    const length = Math.max(distance, 1);
    const normalX = -dy / length;
    const normalY = dx / length;
    const size = 0.6 + Math.random() * 1.2;

    drawingContext.fillStyle = `rgb(116 67 216 / ${0.18 + Math.random() * 0.28})`;
    drawingContext.fillRect(
      start.x + dx * amount + normalX * offset,
      start.y + dy * amount + normalY * offset,
      size,
      size,
    );
  }

  drawingContext.restore();
}

function redrawStrokes() {
  clearCanvas();

  strokes.forEach((stroke) => {
    if (stroke.points.length === 1) {
      drawCrayonDab(stroke.points[0]);
      return;
    }

    for (let point = 1; point < stroke.points.length; point += 1) {
      drawCrayonSegment(stroke.points[point - 1], stroke.points[point]);
    }
  });
}

function resizeCanvas() {
  const documentSize = getDocumentSize();
  const nextScale = Math.min(window.devicePixelRatio || 1, 2);

  canvasWidth = documentSize.width;
  canvasHeight = documentSize.height;
  canvasScale = nextScale;

  drawingCanvas.style.width = `${canvasWidth}px`;
  drawingCanvas.style.height = `${canvasHeight}px`;
  drawingCanvas.width = Math.round(canvasWidth * canvasScale);
  drawingCanvas.height = Math.round(canvasHeight * canvasScale);
  drawingContext.setTransform(canvasScale, 0, 0, canvasScale, 0, 0);
  redrawStrokes();
}

function scheduleCanvasResize() {
  window.cancelAnimationFrame(resizeFrame);
  resizeFrame = window.requestAnimationFrame(resizeCanvas);
}

function getPoint(event) {
  return {
    x: event.clientX + window.scrollX,
    y: event.clientY + window.scrollY,
    pressure: event.pressure > 0 ? event.pressure : 0.5,
  };
}

function startStroke(event) {
  if (!drawingEnabled || (event.pointerType === "mouse" && event.button !== 0)) {
    return;
  }

  event.preventDefault();
  activePointerId = event.pointerId;
  activeStroke = { points: [getPoint(event)] };
  strokes.push(activeStroke);
  drawingCanvas.setPointerCapture(event.pointerId);
  drawCrayonDab(activeStroke.points[0]);
}

function continueStroke(event) {
  if (!activeStroke || event.pointerId !== activePointerId) {
    return;
  }

  event.preventDefault();
  const pointerEvents = event.getCoalescedEvents?.() || [event];

  pointerEvents.forEach((pointerEvent) => {
    const nextPoint = getPoint(pointerEvent);
    const previousPoint = activeStroke.points.at(-1);

    if (
      Math.abs(nextPoint.x - previousPoint.x) < 0.2 &&
      Math.abs(nextPoint.y - previousPoint.y) < 0.2
    ) {
      return;
    }

    activeStroke.points.push(nextPoint);
    drawCrayonSegment(previousPoint, nextPoint);
  });
}

function finishStroke(event) {
  if (event.pointerId !== activePointerId) {
    return;
  }

  activeStroke = null;
  activePointerId = null;
}

function setDrawingEnabled(enabled) {
  drawingEnabled = enabled;
  activeStroke = null;
  activePointerId = null;
  document.documentElement.classList.toggle("drawing-active", drawingEnabled);
  drawToggle.setAttribute("aria-pressed", String(drawingEnabled));
}

function clearDrawing() {
  strokes.length = 0;
  activeStroke = null;
  activePointerId = null;
  clearCanvas();
}

drawToggle.addEventListener("click", () => {
  setDrawingEnabled(!drawingEnabled);
});

clearDrawingButton.addEventListener("click", clearDrawing);
drawingCanvas.addEventListener("pointerdown", startStroke);
drawingCanvas.addEventListener("pointermove", continueStroke);
drawingCanvas.addEventListener("pointerup", finishStroke);
drawingCanvas.addEventListener("pointercancel", finishStroke);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && drawingEnabled) {
    setDrawingEnabled(false);
  }
});

window.addEventListener("resize", scheduleCanvasResize);

if ("ResizeObserver" in window) {
  new ResizeObserver(scheduleCanvasResize).observe(document.body);
}

resizeCanvas();
