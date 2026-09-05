const frameDelayMs = 300;
const retryDelayMs = 1000;

const viewerStatus = document.getElementById("viewerStatus");
const screenImage = document.getElementById("screenImage");
const screenPointer = document.getElementById("screenPointer");

let frameTimer = null;
let frameRequest = null;
let frameObjectUrl = "";

function stopFrames() {
  if (frameTimer) clearTimeout(frameTimer);
  frameTimer = null;
  frameRequest?.abort();
  frameRequest = null;
}

function scheduleFrame(delay = frameDelayMs) {
  if (document.hidden || frameTimer) return;
  frameTimer = setTimeout(() => {
    frameTimer = null;
    void loadFrame();
  }, delay);
}

async function loadFrame() {
  if (document.hidden || frameRequest) return;
  const controller = new AbortController();
  frameRequest = controller;
  try {
    const response = await fetch(`/api/live-screen/frame?t=${Date.now()}`, {
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      viewerStatus.textContent = result.error || "Captura nu este disponibilă momentan.";
      scheduleFrame(retryDelayMs);
      return;
    }

    const pointerVisible = response.headers.get("X-Live-Screen-Pointer-Visible") === "1";
    const pointerX = Math.max(0, Math.min(1, Number(response.headers.get("X-Live-Screen-Pointer-X") || 0)));
    const pointerY = Math.max(0, Math.min(1, Number(response.headers.get("X-Live-Screen-Pointer-Y") || 0)));
    const pointerWidth = Math.max(0, Math.min(0.2, Number(response.headers.get("X-Live-Screen-Pointer-Width") || 0)));
    const pointerHeight = Math.max(0, Math.min(0.2, Number(response.headers.get("X-Live-Screen-Pointer-Height") || 0)));
    const frame = await response.blob();
    if (document.hidden) return;
    const nextObjectUrl = URL.createObjectURL(frame);
    const previousObjectUrl = frameObjectUrl;
    frameObjectUrl = nextObjectUrl;
    screenImage.src = nextObjectUrl;
    screenPointer.hidden = !pointerVisible;
    screenPointer.setAttribute("x", `${pointerX * 100}%`);
    screenPointer.setAttribute("y", `${pointerY * 100}%`);
    screenPointer.setAttribute("width", `${pointerWidth * 100}%`);
    screenPointer.setAttribute("height", `${pointerHeight * 100}%`);
    if (previousObjectUrl) URL.revokeObjectURL(previousObjectUrl);
    viewerStatus.textContent = `Live · actualizat la ${new Date().toLocaleTimeString("ro-RO")}`;
    scheduleFrame();
  } catch (error) {
    if (error.name !== "AbortError") {
      viewerStatus.textContent = "Conexiune întreruptă. Se reîncearcă…";
      scheduleFrame(retryDelayMs);
    }
  } finally {
    if (frameRequest === controller) frameRequest = null;
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopFrames();
  } else {
    void loadFrame();
  }
});

window.addEventListener("pagehide", () => {
  stopFrames();
  if (frameObjectUrl) URL.revokeObjectURL(frameObjectUrl);
  frameObjectUrl = "";
});

void loadFrame();
