// InspectStyles Popup Script
class PopupController {
  constructor() {
    this.isActive = false;
    this.init();
  }

  init() {
    this.bindEvents();
    this.checkActiveState();
  }

  bindEvents() {
    const toggleBtn = document.getElementById("toggleBtn");
    const deactivateBtn = document.getElementById("deactivateBtn");

    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => this.toggleInspection());
    }

    if (deactivateBtn) {
      deactivateBtn.addEventListener("click", () => this.toggleInspection());
    }
  }

  async checkActiveState() {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: "getStyles",
      });

      if (response) {
        this.setActiveState(true);
      }
    } catch (error) {
      // Content script not injected or not active
      this.setActiveState(false);
    }
  }

  async toggleInspection() {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      // Inject content script if needed
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content.js"],
        });
      } catch (error) {
        // Script might already be injected
      }

      const response = await chrome.tabs.sendMessage(tab.id, {
        action: "toggle",
      });
      this.setActiveState(response.active);

      // Close the popup after activating the inspector
      if (response.active) {
        setTimeout(() => {
          window.close();
        }, 100);
      }
    } catch (error) {
      console.error("Failed to toggle inspection:", error);
      this.showError(
        "Failed to activate inspector. Please refresh the page and try again."
      );
    }
  }

  setActiveState(active) {
    this.isActive = active;
    const instructions = document.getElementById("instructions");
    const activeState = document.getElementById("activeState");

    if (active) {
      instructions.classList.add("hidden");
      activeState.classList.remove("hidden");
    } else {
      instructions.classList.remove("hidden");
      activeState.classList.add("hidden");
    }
  }

  showError(message) {
    // Create a simple error notification
    const errorDiv = document.createElement("div");
    errorDiv.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      right: 10px;
      background: #fee2e2;
      color: #dc2626;
      padding: 12px;
      border-radius: 6px;
      border: 1px solid #fecaca;
      font-size: 12px;
      z-index: 1000;
    `;
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);

    setTimeout(() => {
      errorDiv.remove();
    }, 5000);
  }
}

// Initialize popup when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new PopupController();
});
