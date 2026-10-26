// InspectStyles background service worker.
// The popup handles the toolbar click, so this file only deals with the keyboard shortcut.

async function ensureInjected(tabId) {
  try {
    const res = await chrome.tabs.sendMessage(tabId, { action: "ping" });
    if (res && res.ok) return;
  } catch (e) {
    // content script not there yet
  }
  await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-inspector") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;
  try {
    await ensureInjected(tab.id);
    await chrome.tabs.sendMessage(tab.id, { action: "toggle" });
  } catch (e) {
    // chrome:// pages and the Web Store can't be inspected
  }
});
