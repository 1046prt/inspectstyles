# InspectStyles

A Chrome extension that shows the fonts, colors, contrast and spacing of any element on any webpage. Pick colors, save a palette, and copy styles as CSS, Tailwind classes or JSON.

## What's new in 2.0

- Redesigned popup and sidebar with light, dark and automatic themes
- Sidebar runs in a shadow root, so page CSS can't break it
- Live preview on hover, click to lock, arrow keys to walk the DOM tree
- Font specimen drawn in the element's real colors
- Contrast ratio with AA and AAA results (handles transparent layers)
- Margin, border and padding drawn on the page and shown as a box model
- Page tab: every font and color on the page, ranked by use
- Eyedropper and a saved palette (export as CSS variables or JSON)
- HEX, RGB and HSL switching, including modern color spaces like oklch
- Copy as CSS, Tailwind classes or JSON
- Dock or float the panel, resizable, remembers your settings
- Keyboard shortcut: Alt+Shift+I
- Fixed: the content script was injected on every popup click, duplicating listeners
- Fixed: dead toolbar-click code in the background worker
- Fixed: width was saved per-site in page localStorage, now in extension storage

## Install

1. Open `chrome://extensions` and turn on Developer mode
2. Click Load unpacked and choose this folder
3. Pin InspectStyles, open any website and press Start inspecting

## Use

| Action | How |
| --- | --- |
| Turn on or off | Popup button or `Alt+Shift+I` |
| Preview an element | Hover it |
| Lock an element | Click it |
| Parent, child, siblings | Arrow keys |
| Unlock | `U` |
| Close | `Esc` |

## Permissions

- `activeTab` and `scripting`: run on the tab you choose, only when you start it
- `storage`: keep your palette, theme and panel width

No network requests are made.

## Website

`website/index.html` is a standalone landing page with a live demo. Host it anywhere static (GitHub Pages, Netlify, Vercel).

## License

MIT
