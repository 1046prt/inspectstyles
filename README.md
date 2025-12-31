# InspectStyles - Font & Color Identifier Browser Extension

A lightweight browser extension that allows users to inspect fonts and colors used on any webpage in real time.

## Features

- **Font Inspection**: Font family, size, weight, line height, letter spacing
- **Color Inspection**: Text color, background color in RGB and HEX formats
- **One-click copy** for each value
- **Hover to preview** styles
- **Click to lock** selection
- **Minimal UI** with maximum clarity

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory
5. The InspectStyles icon should appear in your toolbar

## Usage

1. Click the InspectStyles extension icon
2. Click "Activate" to start inspecting styles
3. Hover over any text or element to preview styles
4. Click to lock the selected element
5. Copy font or color values as needed
6. Press Escape to deactivate

## File Structure

```bash
inspectstyles/
├── manifest.json          # Extension configuration
├── content.js            # Webpage interaction logic
├── background.js         # Extension lifecycle management
├── popup/
│   ├── popup.html       # Extension popup interface
│   ├── popup.css        # Popup styling
│   └── popup.js         # Popup functionality
├── icons/               # Extension icons
└── README.md           # This file
```

## Permissions

- `activeTab`: Access only the currently active page when used
- `scripting`: Inject content scripts safely

## Technical Details

- Built with Chrome Extension Manifest V3
- Uses `window.getComputedStyle()` for accurate style extraction
- No DOM modification or external requests
- Converts RGB colors to HEX format automatically
- Resolves CSS variables to computed values

## License

MIT License - Free to use, modify, and distribute.
