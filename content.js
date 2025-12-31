class InspectStyles {
  // InspectStyles Content Script
  constructor() {
    this.isActive = false;
    this.selectedElement = null;
    this.overlay = null;
    this.sidebar = null;
    this.boundHandlers = {
      mousemove: this.handleMouseMove.bind(this),
      click: this.handleClick.bind(this),
      keydown: this.handleKeydown.bind(this),
      resize: this.handleResize.bind(this),
    };

    this.init();
  }

  init() {
    // Check if extension context is valid
    if (!chrome.runtime?.id) {
      console.log(
        "InspectStyles: Extension context invalidated, cleaning up..."
      );
      this.cleanup();
      return;
    }

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      try {
        if (!chrome.runtime?.id) {
          console.log(
            "InspectStyles: Extension context lost during message handling"
          );
          this.cleanup();
          return;
        }

        if (request.action === "toggle") {
          this.toggle();
          sendResponse({ active: this.isActive });
        } else if (request.action === "getStyles") {
          sendResponse(this.getSelectedStyles());
        }
      } catch (error) {
        console.error("InspectStyles: Error handling message:", error);
        this.cleanup();
      }
    });

    // Listen for extension context invalidation
    if (chrome.runtime.onConnect) {
      chrome.runtime.onConnect.addListener(() => {
        // Extension is still valid
      });
    }
  }

  cleanup() {
    // Clean up any existing UI elements
    this.deactivate();

    // Remove any existing InspectStyles elements
    const existingSidebar = document.getElementById("inspectstyles-sidebar");
    if (existingSidebar) {
      existingSidebar.remove();
    }

    const existingOverlay = document.querySelector(
      '[style*="border: 2px solid #007acc"]'
    );
    if (existingOverlay) {
      existingOverlay.remove();
    }

    // Restore page layout
    document.body.style.marginRight = "";
    document.body.style.cursor = "";
  }

  toggle() {
    if (this.isActive) {
      this.deactivate();
    } else {
      this.activate();
    }
  }

  activate() {
    this.isActive = true;
    this.createSidebar();
    this.createOverlay();
    this.addEventListeners();
    this.adjustPageLayout();
    document.body.style.cursor = "crosshair";
  }

  deactivate() {
    this.isActive = false;
    this.removeEventListeners();
    this.removeOverlay();
    this.removeSidebar();
    this.restorePageLayout();
    document.body.style.cursor = "";
    this.selectedElement = null;
  }

  createSidebar() {
    this.sidebar = document.createElement("div");
    this.sidebar.id = "inspectstyles-sidebar";
    this.sidebar.innerHTML = this.getSidebarHTML();
    this.sidebar.style.cssText = this.getSidebarCSS();
    document.body.appendChild(this.sidebar);

    // Add event listeners for sidebar interactions
    this.addSidebarEventListeners();

    // Add resize functionality
    this.addResizeHandle();
  }

  getSidebarCSS() {
    // Load saved width preference
    const width = this.loadWidthPreference();
    this.sidebarWidth = width;

    return `
      position: fixed;
      top: 0;
      right: 0;
      width: ${width}px;
      height: 100vh;
      background: #f8f9fa;
      color: #2d3748;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 13px;
      z-index: 2147483647;
      box-shadow: -4px 0 20px rgba(0,0,0,0.08);
      overflow-y: auto;
      border-left: 1px solid #e2e8f0;
      transition: transform 0.2s ease;
    `;
  }

  addSidebarEventListeners() {
    // Close button
    const closeBtn = document.getElementById("inspectstyles-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => this.deactivate());
    }

    // Copy all button
    const copyAllBtn = document.getElementById("inspectstyles-copy-all");
    if (copyAllBtn) {
      copyAllBtn.addEventListener("click", () => this.copyAllStyles());
    }
  }

  getSidebarHTML() {
    const iconUrl = chrome.runtime.getURL("icons/InspectStyles.png");
    return `
      <!-- Resize Handle -->
      <div id="inspectstyles-resize-handle" style="position: absolute; left: 0; top: 0; width: 6px; height: 100%; background: #f1f5f9; cursor: ew-resize; z-index: 10; transition: background 0.2s; display: flex; align-items: center; justify-content: center; border-right: 1px solid #e2e8f0;">
        <div style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 12px; height: 32px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.5px;">
          <div style="width: 0; height: 0; border-left: 2.5px solid transparent; border-right: 2.5px solid transparent; border-bottom: 2.5px solid #9ca3af;"></div>
          <div style="width: 5px; height: 1px; background: #9ca3af; border-radius: 0.5px;"></div>
          <div style="width: 5px; height: 1px; background: #9ca3af; border-radius: 0.5px;"></div>
          <div style="width: 5px; height: 1px; background: #9ca3af; border-radius: 0.5px;"></div>
          <div style="width: 5px; height: 1px; background: #9ca3af; border-radius: 0.5px;"></div>
          <div style="width: 5px; height: 1px; background: #9ca3af; border-radius: 0.5px;"></div>
          <div style="width: 5px; height: 1px; background: #9ca3af; border-radius: 0.5px;"></div>
          <div style="width: 0; height: 0; border-left: 2.5px solid transparent; border-right: 2.5px solid transparent; border-top: 2.5px solid #9ca3af;"></div>
        </div>
      </div>
      
      <div style="height: 100%; display: flex; flex-direction: column; position: relative;">
        <!-- Header -->
        <div style="background: #ffffff; padding: 16px 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; min-height: 60px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <img src="${iconUrl}" style="width: 20px; height: 20px; border-radius: 4px;" alt="InspectStyles">
            <div>
              <div style="font-weight: 600; color: #1a202c; font-size: 14px;">InspectStyles</div>
              <div style="font-size: 11px; color: #718096; margin-top: 1px;">Element Analysis</div>
            </div>
          </div>
          <button id="inspectstyles-close" style="background: #f7fafc; border: 1px solid #e2e8f0; color: #4a5568; cursor: pointer; padding: 6px 8px; border-radius: 6px; font-size: 14px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;" title="Close Inspector">×</button>
        </div>

        <!-- Status Bar -->
        <div id="inspectstyles-status" style="padding: 12px 20px; background: #edf2f7; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #4a5568;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 6px; height: 6px; background: #38a169; border-radius: 50%;"></div>
            <span>Hover elements to preview • Click to inspect</span>
          </div>
        </div>

        <!-- Content Area -->
        <div id="inspectstyles-content" style="flex: 1; overflow-y: auto;">
          <div id="inspectstyles-placeholder" style="padding: 60px 20px; text-align: center; color: #a0aec0;">
            <div style="width: 64px; height: 64px; margin: 0 auto 20px; background: #f7fafc; border: 2px dashed #cbd5e0; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
              <div style="width: 24px; height: 24px; background: #cbd5e0; border-radius: 4px;"></div>
            </div>
            <div style="font-size: 14px; color: #718096; margin-bottom: 8px;">No element selected</div>
            <div style="font-size: 12px; color: #a0aec0;">Click on any element to view its computed styles</div>
          </div>
          
          <div id="inspectstyles-styles" style="display: none;">
            <!-- Element Info -->
            <div style="padding: 20px; border-bottom: 1px solid #e2e8f0; background: #ffffff;">
              <div style="font-size: 11px; color: #718096; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; font-weight: 500;">Selected Element</div>
              <div id="inspectstyles-element-info" style="font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, monospace; font-size: 13px; color: #2d3748; background: #f7fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0; font-weight: 500;"></div>
            </div>

            <!-- Typography Section -->
            <div style="background: #ffffff; border-bottom: 1px solid #e2e8f0;">
              <div style="padding: 16px 20px; background: #f7fafc; font-weight: 600; font-size: 13px; color: #2d3748; border-bottom: 1px solid #e2e8f0;">
                Typography
              </div>
              <div id="inspectstyles-typography"></div>
            </div>

            <!-- Colors Section -->
            <div style="background: #ffffff; border-bottom: 1px solid #e2e8f0;">
              <div style="padding: 16px 20px; background: #f7fafc; font-weight: 600; font-size: 13px; color: #2d3748; border-bottom: 1px solid #e2e8f0;">
                Colors
              </div>
              <div id="inspectstyles-colors"></div>
            </div>

            <!-- Layout Section -->
            <div style="background: #ffffff; border-bottom: 1px solid #e2e8f0;">
              <div style="padding: 16px 20px; background: #f7fafc; font-weight: 600; font-size: 13px; color: #2d3748; border-bottom: 1px solid #e2e8f0;">
                Layout & Spacing
              </div>
              <div id="inspectstyles-layout"></div>
            </div>

            <!-- Actions -->
            <div style="padding: 20px; background: #ffffff;">
              <button id="inspectstyles-copy-all" style="width: 100%; background: #3182ce; color: white; border: none; padding: 12px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px; transition: all 0.15s ease;">
                Copy CSS Rules
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>
        #inspectstyles-sidebar * {
          box-sizing: border-box;
        }
        
        #inspectstyles-resize-handle:hover {
          background: #e2e8f0 !important;
        }
        
        #inspectstyles-resize-handle:hover > div > div {
          border-color: #4a5568 !important;
          background: #4a5568 !important;
        }
        
        #inspectstyles-close:hover {
          background: #edf2f7 !important;
          border-color: #cbd5e0 !important;
        }
        
        #inspectstyles-copy-all:hover {
          background: #2c5aa0 !important;
        }
        
        #inspectstyles-copy-all:active {
          background: #2a4d8d !important;
          transform: translateY(1px);
        }
        
        .inspectstyles-property {
          padding: 16px 20px;
          border-bottom: 1px solid #f1f5f9;
          transition: background-color 0.1s ease;
        }
        
        .inspectstyles-property:hover {
          background: #f8fafc;
        }
        
        .inspectstyles-property:last-child {
          border-bottom: none;
        }
        
        .inspectstyles-property-label {
          font-size: 12px;
          color: #4a5568;
          margin-bottom: 6px;
          font-weight: 500;
        }
        
        .inspectstyles-property-value {
          font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, monospace;
          font-size: 12px;
          color: #1a202c;
          background: #f7fafc;
          padding: 8px 12px;
          border-radius: 4px;
          border: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          word-break: break-all;
          line-height: 1.4;
        }
        
        .inspectstyles-copy-btn {
          background: #ffffff;
          border: 1px solid #d1d5db;
          color: #6b7280;
          padding: 4px 8px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 11px;
          margin-left: 12px;
          transition: all 0.1s ease;
          flex-shrink: 0;
          font-weight: 500;
        }
        
        .inspectstyles-copy-btn:hover {
          background: #f9fafb;
          border-color: #9ca3af;
          color: #374151;
        }
        
        .inspectstyles-copy-btn:active {
          background: #f3f4f6;
          transform: translateY(1px);
        }
        
        .inspectstyles-color-preview {
          width: 18px;
          height: 18px;
          border-radius: 3px;
          border: 1px solid #d1d5db;
          margin-right: 12px;
          flex-shrink: 0;
          background-image: 
            linear-gradient(45deg, #f3f4f6 25%, transparent 25%), 
            linear-gradient(-45deg, #f3f4f6 25%, transparent 25%), 
            linear-gradient(45deg, transparent 75%, #f3f4f6 75%), 
            linear-gradient(-45deg, transparent 75%, #f3f4f6 75%);
          background-size: 6px 6px;
          background-position: 0 0, 0 3px, 3px -3px, -3px 0px;
        }
        
        .inspectstyles-color-container {
          display: flex;
          align-items: flex-start;
          gap: 0;
        }
        
        .inspectstyles-color-values {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
      </style>
    `;
  }

  addResizeHandle() {
    const resizeHandle = document.getElementById("inspectstyles-resize-handle");
    if (!resizeHandle) return;

    let isResizing = false;
    let startX = 0;
    let startWidth = 380; // Default width

    // Store current width
    this.sidebarWidth = 380;

    resizeHandle.addEventListener("mousedown", (e) => {
      isResizing = true;
      startX = e.clientX;
      startWidth = this.sidebarWidth;

      // Prevent text selection during resize
      document.body.style.userSelect = "none";
      document.body.style.cursor = "ew-resize";

      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!isResizing) return;

      // Calculate new width (drag left to increase width)
      const deltaX = startX - e.clientX;
      let newWidth = startWidth + deltaX;

      // Set minimum and maximum width constraints
      newWidth = Math.max(280, Math.min(800, newWidth));

      // Update sidebar width
      this.sidebarWidth = newWidth;
      this.sidebar.style.width = newWidth + "px";

      // Update page margin
      document.body.style.marginRight = newWidth + "px";

      e.preventDefault();
    });

    document.addEventListener("mouseup", () => {
      if (isResizing) {
        isResizing = false;
        document.body.style.userSelect = "";
        document.body.style.cursor = "";

        // Save the width preference
        this.saveWidthPreference(this.sidebarWidth);
      }
    });
  }

  saveWidthPreference(width) {
    try {
      localStorage.setItem("inspectstyles-sidebar-width", width.toString());
    } catch (error) {
      console.log("Could not save width preference:", error);
    }
  }

  loadWidthPreference() {
    try {
      const savedWidth = localStorage.getItem("inspectstyles-sidebar-width");
      if (savedWidth) {
        const width = parseInt(savedWidth);
        if (width >= 280 && width <= 800) {
          return width;
        }
      }
    } catch (error) {
      console.log("Could not load width preference:", error);
    }
    return 380; // Default width
  }

  createOverlay() {
    this.overlay = document.createElement("div");
    this.overlay.style.cssText = `
      position: absolute;
      pointer-events: none;
      border: 2px solid #007acc;
      background: rgba(0, 122, 204, 0.1);
      z-index: 2147483646;
      display: none;
      transition: all 0.1s ease;
    `;
    document.body.appendChild(this.overlay);
  }

  removeSidebar() {
    if (this.sidebar) {
      this.sidebar.remove();
      this.sidebar = null;
    }
  }

  removeOverlay() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  adjustPageLayout() {
    // Use the current sidebar width
    const width = this.sidebarWidth || 380;
    document.body.style.marginRight = width + "px";
    document.body.style.transition = "margin-right 0.2s ease";
  }

  restorePageLayout() {
    // Remove margin from body
    document.body.style.marginRight = "";
    document.body.style.transition = "";
  }

  addEventListeners() {
    document.addEventListener("mousemove", this.boundHandlers.mousemove, true);
    document.addEventListener("click", this.boundHandlers.click, true);
    document.addEventListener("keydown", this.boundHandlers.keydown, true);
    window.addEventListener("resize", this.boundHandlers.resize);
  }

  removeEventListeners() {
    document.removeEventListener(
      "mousemove",
      this.boundHandlers.mousemove,
      true
    );
    document.removeEventListener("click", this.boundHandlers.click, true);
    document.removeEventListener("keydown", this.boundHandlers.keydown, true);
    window.removeEventListener("resize", this.boundHandlers.resize);
  }

  handleMouseMove(event) {
    if (!this.isActive || !this.sidebar) return;

    const element = event.target;

    // Don't highlight sidebar elements
    if (element.closest("#inspectstyles-sidebar")) return;

    this.highlightElement(element);
  }

  handleClick(event) {
    if (!this.isActive || !this.sidebar) return;

    // Don't handle clicks on sidebar
    if (event.target.closest("#inspectstyles-sidebar")) return;

    event.preventDefault();
    event.stopPropagation();

    this.selectedElement = event.target;
    this.highlightElement(this.selectedElement, true);
    this.updateSidebar(this.selectedElement);
  }

  handleKeydown(event) {
    if (event.key === "Escape") {
      this.deactivate();
    }
  }

  handleResize() {
    if (this.selectedElement) {
      this.highlightElement(this.selectedElement, true);
    }
  }

  highlightElement(element, selected = false) {
    if (!this.overlay) return;

    const rect = element.getBoundingClientRect();
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    this.overlay.style.display = "block";
    this.overlay.style.left = rect.left + scrollX + "px";
    this.overlay.style.top = rect.top + scrollY + "px";
    this.overlay.style.width = rect.width + "px";
    this.overlay.style.height = rect.height + "px";
    this.overlay.style.borderColor = selected ? "#ff6b35" : "#007acc";
    this.overlay.style.background = selected
      ? "rgba(255, 107, 53, 0.1)"
      : "rgba(0, 122, 204, 0.1)";
  }

  updateSidebar(element) {
    const styles = this.extractStyles(element);

    // Show styles panel, hide placeholder
    document.getElementById("inspectstyles-placeholder").style.display = "none";
    document.getElementById("inspectstyles-styles").style.display = "block";

    // Update element info
    const elementInfo = this.getElementInfo(element);
    document.getElementById("inspectstyles-element-info").textContent =
      elementInfo;

    // Update typography
    this.updateTypographySection(styles);

    // Update colors
    this.updateColorsSection(styles);

    // Update layout
    this.updateLayoutSection(styles);
  }

  getElementInfo(element) {
    let info = element.tagName.toLowerCase();
    if (element.id) info += `#${element.id}`;
    if (element.className) {
      // Handle both string and SVGAnimatedString types
      const classNameStr =
        typeof element.className === "string"
          ? element.className
          : element.className.baseVal || element.className.toString();

      const classes = classNameStr.split(" ").filter((c) => c.trim());
      if (classes.length > 0) {
        info += "." + classes.join(".");
      }
    }
    return info;
  }

  updateTypographySection(styles) {
    const container = document.getElementById("inspectstyles-typography");
    container.innerHTML = "";

    const typographyProps = [
      { label: "Font Family", key: "fontFamily" },
      { label: "Font Size", key: "fontSize" },
      { label: "Font Weight", key: "fontWeight" },
      { label: "Line Height", key: "lineHeight" },
      { label: "Letter Spacing", key: "letterSpacing" },
      { label: "Text Align", key: "textAlign" },
    ];

    typographyProps.forEach((prop) => {
      container.appendChild(
        this.createPropertyElement(prop.label, styles[prop.key], prop.key)
      );
    });
  }

  updateColorsSection(styles) {
    const container = document.getElementById("inspectstyles-colors");
    container.innerHTML = "";

    // Text color
    container.appendChild(
      this.createColorPropertyElement(
        "Text Color",
        styles.color,
        styles.colorHex,
        "color"
      )
    );

    // Background color
    container.appendChild(
      this.createColorPropertyElement(
        "Background Color",
        styles.backgroundColor,
        styles.backgroundColorHex,
        "backgroundColor"
      )
    );
  }

  updateLayoutSection(styles) {
    const container = document.getElementById("inspectstyles-layout");
    container.innerHTML = "";

    const layoutProps = [
      { label: "Display", key: "display" },
      { label: "Position", key: "position" },
      { label: "Width", key: "width" },
      { label: "Height", key: "height" },
      { label: "Margin", key: "margin" },
      { label: "Padding", key: "padding" },
    ];

    layoutProps.forEach((prop) => {
      container.appendChild(
        this.createPropertyElement(prop.label, styles[prop.key], prop.key)
      );
    });
  }

  createPropertyElement(label, value, key) {
    const div = document.createElement("div");
    div.className = "inspectstyles-property";
    div.innerHTML = `
      <div class="inspectstyles-property-label">${label}</div>
      <div class="inspectstyles-property-value">
        <span>${value}</span>
        <button class="inspectstyles-copy-btn" data-value="${value.replace(
          /"/g,
          "&quot;"
        )}">Copy</button>
      </div>
    `;

    // Add event listener for copy button
    const copyBtn = div.querySelector(".inspectstyles-copy-btn");
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(value);
        copyBtn.textContent = "✓";
        copyBtn.style.background = "#4caf50";
        copyBtn.style.borderColor = "#4caf50";
        copyBtn.style.color = "white";

        setTimeout(() => {
          copyBtn.textContent = "Copy";
          copyBtn.style.background = "none";
          copyBtn.style.borderColor = "#555";
          copyBtn.style.color = "#cccccc";
        }, 1000);
      } catch (error) {
        console.error("Failed to copy:", error);
      }
    });

    return div;
  }

  createColorPropertyElement(label, rgbValue, hexValue, key) {
    const div = document.createElement("div");
    div.className = "inspectstyles-property";
    div.innerHTML = `
      <div class="inspectstyles-property-label">${label}</div>
      <div style="display: flex; align-items: center; margin-bottom: 8px;">
        <div class="inspectstyles-color-preview" style="background-color: ${rgbValue};"></div>
        <div style="flex: 1;">
          <div class="inspectstyles-property-value" style="margin-bottom: 4px;">
            <span>${rgbValue}</span>
            <button class="inspectstyles-copy-btn" data-value="${rgbValue}">Copy</button>
          </div>
          <div class="inspectstyles-property-value">
            <span>${hexValue}</span>
            <button class="inspectstyles-copy-btn" data-value="${hexValue}">Copy</button>
          </div>
        </div>
      </div>
    `;

    // Add event listeners for copy buttons
    const copyBtns = div.querySelectorAll(".inspectstyles-copy-btn");
    copyBtns.forEach((copyBtn) => {
      copyBtn.addEventListener("click", async () => {
        try {
          const value = copyBtn.getAttribute("data-value");
          await navigator.clipboard.writeText(value);
          copyBtn.textContent = "✓";
          copyBtn.style.background = "#4caf50";
          copyBtn.style.borderColor = "#4caf50";
          copyBtn.style.color = "white";

          setTimeout(() => {
            copyBtn.textContent = "Copy";
            copyBtn.style.background = "none";
            copyBtn.style.borderColor = "#555";
            copyBtn.style.color = "#cccccc";
          }, 1000);
        } catch (error) {
          console.error("Failed to copy:", error);
        }
      });
    });

    return div;
  }

  extractStyles(element) {
    const computed = window.getComputedStyle(element);

    return {
      // Font properties
      fontFamily: computed.fontFamily,
      fontSize: computed.fontSize,
      fontWeight: computed.fontWeight,
      lineHeight: computed.lineHeight,
      letterSpacing: computed.letterSpacing,
      textAlign: computed.textAlign,

      // Color properties
      color: computed.color,
      backgroundColor: computed.backgroundColor,

      // Convert colors to hex
      colorHex: this.rgbToHex(computed.color),
      backgroundColorHex: this.rgbToHex(computed.backgroundColor),

      // Layout properties
      display: computed.display,
      position: computed.position,
      width: computed.width,
      height: computed.height,
      margin: `${computed.marginTop} ${computed.marginRight} ${computed.marginBottom} ${computed.marginLeft}`,
      padding: `${computed.paddingTop} ${computed.paddingRight} ${computed.paddingBottom} ${computed.paddingLeft}`,
    };
  }

  rgbToHex(rgb) {
    if (!rgb || rgb === "transparent" || rgb === "rgba(0, 0, 0, 0)") {
      return "transparent";
    }

    const match = rgb.match(
      /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/
    );
    if (!match) return rgb;

    const r = parseInt(match[1]);
    const g = parseInt(match[2]);
    const b = parseInt(match[3]);
    const alpha = match[4] ? parseFloat(match[4]) : 1;

    if (alpha < 1) {
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    return (
      "#" +
      [r, g, b]
        .map((x) => {
          const hex = x.toString(16);
          return hex.length === 1 ? "0" + hex : hex;
        })
        .join("")
    );
  }

  async copyAllStyles() {
    if (!this.selectedElement) return;

    // Check if extension context is still valid
    if (!chrome.runtime?.id) {
      console.log("InspectStyles: Extension context lost, cannot copy styles");
      this.cleanup();
      return;
    }

    const styles = this.extractStyles(this.selectedElement);
    const css = this.generateCSSString(styles);

    try {
      await navigator.clipboard.writeText(css);
      const button = document.getElementById("inspectstyles-copy-all");
      if (button) {
        const originalText = button.textContent;
        button.textContent = "✅ Copied!";
        button.style.background = "linear-gradient(45deg, #4caf50, #66bb6a)";

        setTimeout(() => {
          if (button && chrome.runtime?.id) {
            button.textContent = originalText;
            button.style.background =
              "linear-gradient(45deg, #007acc, #0099ff)";
          }
        }, 2000);
      }
    } catch (error) {
      console.error("Failed to copy styles:", error);
    }
  }

  generateCSSString(styles) {
    const elementInfo = this.getElementInfo(this.selectedElement);

    // Create a proper CSS selector
    let selector = elementInfo;
    if (!selector.includes("#") && !selector.includes(".")) {
      selector = `/* ${selector} */\n.your-element`;
    } else {
      selector = `/* Selected: ${selector} */\n${selector}`;
    }

    // Format CSS with proper indentation and organization
    let css = `${selector} {\n`;

    // Typography section
    css += `  /* Typography */\n`;
    css += `  font-family: ${this.formatCSSValue(styles.fontFamily)};\n`;
    css += `  font-size: ${styles.fontSize};\n`;
    css += `  font-weight: ${styles.fontWeight};\n`;
    css += `  line-height: ${styles.lineHeight};\n`;

    if (styles.letterSpacing !== "normal") {
      css += `  letter-spacing: ${styles.letterSpacing};\n`;
    }

    if (styles.textAlign !== "start" && styles.textAlign !== "left") {
      css += `  text-align: ${styles.textAlign};\n`;
    }

    css += `\n`;

    // Colors section
    css += `  /* Colors */\n`;
    css += `  color: ${styles.colorHex};\n`;

    if (styles.backgroundColorHex !== "transparent") {
      css += `  background-color: ${styles.backgroundColorHex};\n`;
    }

    css += `\n`;

    // Layout section
    css += `  /* Layout */\n`;

    if (styles.display !== "inline") {
      css += `  display: ${styles.display};\n`;
    }

    if (styles.position !== "static") {
      css += `  position: ${styles.position};\n`;
    }

    // Only include dimensions if they're not auto
    if (
      (styles.width !== "auto" && !styles.width.includes("px")) ||
      parseFloat(styles.width) > 0
    ) {
      css += `  width: ${styles.width};\n`;
    }

    if (
      (styles.height !== "auto" && !styles.height.includes("px")) ||
      parseFloat(styles.height) > 0
    ) {
      css += `  height: ${styles.height};\n`;
    }

    // Format margin and padding
    const margin = this.formatSpacing(styles.margin);
    const padding = this.formatSpacing(styles.padding);

    if (margin !== "0px 0px 0px 0px") {
      css += `  margin: ${margin};\n`;
    }

    if (padding !== "0px 0px 0px 0px") {
      css += `  padding: ${padding};\n`;
    }

    css += `}`;

    return css;
  }

  formatCSSValue(value) {
    // Add quotes around font families with spaces
    if (value.includes(" ") && !value.includes('"') && !value.includes("'")) {
      return `"${value}"`;
    }
    return value;
  }

  formatSpacing(spacing) {
    // Convert "10px 20px 10px 20px" format to shorthand if possible
    const values = spacing.split(" ");
    if (values.length === 4) {
      const [top, right, bottom, left] = values;

      // All same
      if (top === right && right === bottom && bottom === left) {
        return top;
      }

      // Top/bottom same, left/right same
      if (top === bottom && right === left) {
        return `${top} ${right}`;
      }

      // Left/right same
      if (right === left) {
        return `${top} ${right} ${bottom}`;
      }
    }

    return spacing;
  }

  getSelectedStyles() {
    if (!this.selectedElement) {
      return null;
    }
    return this.extractStyles(this.selectedElement);
  }
}

// Initialize InspectStyles only if not already initialized
if (!window.inspectStylesInstance) {
  window.inspectStylesInstance = new InspectStyles();
} else {
  // Clean up existing instance and create new one
  if (window.inspectStylesInstance.cleanup) {
    window.inspectStylesInstance.cleanup();
  }
  window.inspectStylesInstance = new InspectStyles();
}
