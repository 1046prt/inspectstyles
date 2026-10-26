// InspectStyles popup

const toggleBtn = document.getElementById("toggle");
const statusEl = document.getElementById("status");
const errorEl = document.getElementById("error");
const swatchesEl = document.getElementById("swatches");
const emptyEl = document.getElementById("saved-empty");
const countEl = document.getElementById("saved-count");

let tabId = null;

function setActive(active) {
  toggleBtn.textContent = active ? "Stop inspecting" : "Start inspecting";
  toggleBtn.classList.toggle("stop", active);
  statusEl.textContent = active ? "Inspector is on" : "Ready";
  statusEl.classList.toggle("on", active);
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
}

async function ping() {
  try {
    const res = await chrome.tabs.sendMessage(tabId, { action: "ping" });
    return res && res.ok ? res : null;
  } catch (e) {
    return null; // content script isn't on this page yet
  }
}

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  tabId = tab && tab.id;
  const url = (tab && tab.url) || "";
  if (!tabId || /^(chrome|edge|about|chrome-extension):/.test(url) || url.startsWith("https://chromewebstore.google.com")) {
    toggleBtn.disabled = true;
    showError("Browser pages can't be inspected. Open a regular website and try again.");
  } else {
    const res = await ping();
    setActive(!!(res && res.active));
  }
  renderPalette();
}

toggleBtn.addEventListener("click", async () => {
  errorEl.hidden = true;
  try {
    // only inject when the script isn't there, so listeners never double up
    if (!(await ping())) {
      await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
    }
    const res = await chrome.tabs.sendMessage(tabId, { action: "toggle" });
    setActive(res.active);
    if (res.active) setTimeout(() => window.close(), 120);
  } catch (e) {
    showError("Couldn't start on this page. Reload the tab and try again.");
  }
});

async function renderPalette() {
  let palette = [];
  try {
    const data = await chrome.storage.local.get("palette");
    if (Array.isArray(data.palette)) palette = data.palette;
  } catch (e) { /* storage unavailable */ }

  swatchesEl.textContent = "";
  countEl.textContent = palette.length ? `${palette.length} saved` : "";
  emptyEl.hidden = palette.length > 0;
  palette.slice(0, 16).forEach((hex) => {
    const b = document.createElement("button");
    b.className = "sw";
    b.style.background = hex;
    b.title = `Copy ${hex}`;
    b.setAttribute("aria-label", `Copy ${hex}`);
    b.addEventListener("click", async () => {
      await navigator.clipboard.writeText(hex);
      countEl.textContent = `Copied ${hex}`;
    });
    swatchesEl.appendChild(b);
  });
}

init();
