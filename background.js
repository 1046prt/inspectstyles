// InspectStyles Background Service Worker

chrome.runtime.onInstalled.addListener(() => {
  console.log("InspectStyles extension installed");
});

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // Inject content script if needed
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });

    // Then send message to activate inspection
    await chrome.tabs.sendMessage(tab.id, { action: "toggle" });
  } catch (error) {
    console.error(
      "Failed to inject content script or toggle inspection:",
      error
    );
  }
});

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "elementSelected") {
    // Forward message to popup if it's open
    chrome.runtime.sendMessage(request).catch(() => {
      // Popup might not be open, ignore error
    });
  }

  return true; // Keep message channel open for async response
});
