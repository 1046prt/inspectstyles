// InspectStyles content script.
// Everything the user sees lives in a shadow root so page CSS can't touch it.

(() => {
  if (window.__inspectStyles) return; // already injected, the existing instance keeps listening

  const ICONS = {
    pick: '<path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    auto: '<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8M12 17v4"/>',
    dock: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/>',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    plus: '<path d="M5 12h14M12 5v14"/>',
    trash: '<path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    unlock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
  };
  const icon = (name) =>
    `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

  const WEIGHT_NAMES = {
    100: "Thin", 200: "Extra light", 300: "Light", 400: "Regular", 500: "Medium",
    600: "Semi bold", 700: "Bold", 800: "Extra bold", 900: "Black",
  };

  const MIN_WIDTH = 300;
  const MAX_WIDTH = 720;
  const DEFAULT_WIDTH = 380;

  // ---------- helpers ----------

  const esc = (v) =>
    String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  let colorCanvas = null;
  function parseColor(str) {
    if (!str) return { r: 0, g: 0, b: 0, a: 0 };
    if (str === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
    const m = str.match(/^rgba?\(\s*(\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/);
    if (m) {
      let a = 1;
      if (m[4] !== undefined) a = m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
      return { r: Math.round(+m[1]), g: Math.round(+m[2]), b: Math.round(+m[3]), a };
    }
    // oklch(), color(display-p3 ...) and friends: let the browser convert it
    try {
      if (!colorCanvas) {
        colorCanvas = document.createElement("canvas");
        colorCanvas.width = colorCanvas.height = 1;
      }
      const ctx = colorCanvas.getContext("2d", { willReadFrequently: true });
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = "#000";
      ctx.fillStyle = str;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      return { r, g, b, a: +(a / 255).toFixed(3) };
    } catch (e) {
      return { r: 0, g: 0, b: 0, a: 1 };
    }
  }

  const hex2 = (n) => n.toString(16).padStart(2, "0");
  function toHex(c) {
    const base = "#" + hex2(c.r) + hex2(c.g) + hex2(c.b);
    return c.a < 1 ? base + hex2(Math.round(c.a * 255)) : base;
  }
  function toRgb(c) {
    return c.a < 1 ? `rgba(${c.r}, ${c.g}, ${c.b}, ${+c.a.toFixed(2)})` : `rgb(${c.r}, ${c.g}, ${c.b})`;
  }
  function toHsl(c) {
    const r = c.r / 255, g = c.g / 255, b = c.b / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    const base = `${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%`;
    return c.a < 1 ? `hsla(${base}, ${+c.a.toFixed(2)})` : `hsl(${base})`;
  }
  function formatColor(c, fmt) {
    if (c.a === 0) return "transparent";
    if (fmt === "rgb") return toRgb(c);
    if (fmt === "hsl") return toHsl(c);
    return toHex(c);
  }

  function blend(top, bottom) {
    const a = top.a + bottom.a * (1 - top.a);
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    const mix = (t, b) => Math.round((t * top.a + b * bottom.a * (1 - top.a)) / a);
    return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a };
  }

  function luminance(c) {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }
  function contrastRatio(a, b) {
    const l1 = luminance(a), l2 = luminance(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }

  function firstFamily(stack) {
    const first = (stack || "").split(",")[0] || "";
    return first.trim().replace(/^["']|["']$/g, "");
  }

  function px(v) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  const round = (n) => Math.round(n * 100) / 100;

  function cssSelector(el) {
    let s = el.tagName.toLowerCase();
    if (el.id && /^[\w-]+$/.test(el.id)) return `${s}#${el.id}`;
    const cls = typeof el.className === "string" ? el.className : (el.className && el.className.baseVal) || "";
    const names = cls.split(/\s+/).filter((c) => /^[\w-]+$/.test(c)).slice(0, 2);
    return names.length ? `${s}.${names.join(".")}` : s;
  }

  // ---------- styles for the shadow root ----------

  const CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.root {
  --bg: #f4f6f8; --surface: #ffffff; --ink: #17222b; --muted: #5b6a76; --line: #e0e6eb;
  --accent: #1a7fd4; --accent-soft: rgba(26,127,212,.12); --accent-ink: #ffffff;
  --good: #14804a; --good-soft: rgba(20,128,74,.12); --bad: #c0392b; --bad-soft: rgba(192,57,43,.12);
  --margin: rgba(246,153,64,.30); --padding: rgba(110,190,100,.32); --content: rgba(26,127,212,.18);
  --shadow: 0 0 0 1px rgba(23,34,43,.04), -12px 0 32px rgba(23,34,43,.14);
  font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: var(--ink);
}
.root[data-theme="dark"] {
  --bg: #0f161b; --surface: #172029; --ink: #e8eef2; --muted: #92a2ae; --line: #26323c;
  --accent: #4aa8f5; --accent-soft: rgba(74,168,245,.16); --accent-ink: #08121a;
  --good: #4cc38a; --good-soft: rgba(76,195,138,.16); --bad: #ff7b6b; --bad-soft: rgba(255,123,107,.16);
  --shadow: 0 0 0 1px rgba(255,255,255,.04), -12px 0 32px rgba(0,0,0,.5);
}
.mono { font-family: ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace; font-size: 12px; }
button { font: inherit; color: inherit; cursor: pointer; border: 0; background: none; padding: 0; }
button:focus-visible, [tabindex]:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

/* highlight layers */
.layer { position: fixed; pointer-events: none; display: none; }
.l-margin { background: var(--margin); }
.l-box { outline: 2px solid var(--accent); outline-offset: -1px; background: var(--padding); }
.l-content { background: var(--content); }
.l-hover { outline: 1.5px dashed var(--accent); outline-offset: -1px; }
.root.locked .l-box { outline-style: solid; }
.tag {
  position: fixed; display: none; pointer-events: none; white-space: nowrap;
  background: var(--ink); color: var(--surface); padding: 3px 8px; border-radius: 6px;
  font-size: 11.5px; box-shadow: 0 4px 14px rgba(0,0,0,.25);
}
.tag b { font-weight: 600; }
.tag span { opacity: .7; margin-left: 8px; }

/* sidebar */
aside {
  position: fixed; top: 0; right: 0; bottom: 0; pointer-events: auto;
  display: flex; flex-direction: column; background: var(--bg); border-left: 1px solid var(--line);
  box-shadow: var(--shadow); min-width: ${MIN_WIDTH}px;
}
.float aside { top: 12px; right: 12px; bottom: 12px; border: 1px solid var(--line); border-radius: 14px; overflow: hidden; }
.grip { position: absolute; left: -4px; top: 0; bottom: 0; width: 9px; cursor: ew-resize; z-index: 3; }
.grip::after { content: ""; position: absolute; left: 3px; top: 50%; width: 3px; height: 36px; margin-top: -18px; border-radius: 3px; background: var(--line); transition: background .15s, height .15s; }
.grip:hover::after, .grip.drag::after { background: var(--accent); height: 56px; margin-top: -28px; }

header { display: flex; align-items: center; gap: 8px; padding: 12px 12px 8px 16px; }
.brand { display: flex; align-items: center; gap: 9px; flex: 1; min-width: 0; }
.brand img { width: 24px; height: 24px; border-radius: 6px; }
.brand strong { font-size: 14px; font-weight: 650; letter-spacing: -.01em; }
.hbtns { display: flex; gap: 2px; }
.ib { width: 28px; height: 28px; border-radius: 7px; display: inline-grid; place-items: center; color: var(--muted); transition: background .12s, color .12s; }
.ib:hover { background: var(--accent-soft); color: var(--accent); }
.ib.on { color: var(--accent); background: var(--accent-soft); }

nav { display: flex; gap: 2px; padding: 0 12px; border-bottom: 1px solid var(--line); }
nav button { padding: 8px 12px 9px; color: var(--muted); font-weight: 550; border-bottom: 2px solid transparent; margin-bottom: -1px; }
nav button:hover { color: var(--ink); }
nav button[aria-selected="true"] { color: var(--accent); border-bottom-color: var(--accent); }
nav .count { margin-left: 5px; font-size: 11px; background: var(--accent-soft); color: var(--accent); padding: 1px 6px; border-radius: 99px; }

main > * { flex: none; }
main { flex: 1; min-height: 0; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 12px; scrollbar-width: thin; }

.card { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
.card > h3 { margin: 0; padding: 10px 14px 6px; font-size: 12px; font-weight: 650; color: var(--muted); display: flex; justify-content: space-between; align-items: center; }
.card > .body { padding: 0 6px 6px; }

.crumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 2px; padding: 10px 12px 4px; }
.crumbs button { padding: 2px 6px; border-radius: 6px; color: var(--muted); font-size: 12px; }
.crumbs button:hover { background: var(--accent-soft); color: var(--accent); }
.crumbs button.cur { color: var(--ink); background: var(--accent-soft); font-weight: 600; }
.crumbs i { color: var(--line); font-style: normal; }
.meta { display: flex; align-items: center; justify-content: space-between; padding: 4px 14px 12px; color: var(--muted); font-size: 12px; gap: 8px; }
.chip { display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px 3px 7px; border-radius: 99px; background: var(--accent-soft); color: var(--accent); font-weight: 600; font-size: 11.5px; }
.chip.live { background: var(--good-soft); color: var(--good); }
.chip button { display: inline-grid; place-items: center; }

.spec { margin: 0 8px 8px; border-radius: 9px; padding: 14px 16px; border: 1px solid var(--line); overflow: hidden; }
.spec-aa { line-height: 1.05; margin-bottom: 8px; }
.spec-txt { opacity: .9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 14px; }

.row { display: flex; align-items: center; gap: 10px; padding: 6px 8px; border-radius: 8px; min-height: 34px; }
.row:hover { background: var(--bg); }
.k { width: 96px; flex: none; color: var(--muted); }
.v { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.v em { font-style: normal; color: var(--muted); margin-left: 6px; }
.row .ib { width: 24px; height: 24px; opacity: 0; }
.row:hover .ib, .row .ib:focus-visible { opacity: 1; }
.sw { width: 28px; height: 28px; flex: none; border-radius: 7px; border: 1px solid var(--line); overflow: hidden; background-image: conic-gradient(#cfd6dc 25%, #fff 0 50%, #cfd6dc 0 75%, #fff 0); background-size: 10px 10px; }
.sw i { display: block; width: 100%; height: 100%; }
.crow .v small { display: block; color: var(--muted); font-size: 11.5px; }
.seg { display: inline-flex; background: var(--bg); border-radius: 7px; padding: 2px; }
.seg button { padding: 1px 8px; border-radius: 5px; font-size: 11px; color: var(--muted); font-weight: 600; }
.seg button[aria-pressed="true"] { background: var(--surface); color: var(--ink); box-shadow: 0 1px 2px rgba(0,0,0,.12); }

.contrast { display: flex; gap: 14px; align-items: center; padding: 6px 10px 12px; }
.ratio { font-size: 30px; font-weight: 700; letter-spacing: -.02em; line-height: 1; }
.ratio small { display: block; font-size: 11.5px; font-weight: 500; letter-spacing: 0; color: var(--muted); margin-top: 4px; }
.badges { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; flex: 1; }
.badge { display: flex; justify-content: space-between; gap: 6px; padding: 4px 8px; border-radius: 7px; font-size: 11.5px; font-weight: 600; }
.badge.pass { background: var(--good-soft); color: var(--good); }
.badge.fail { background: var(--bad-soft); color: var(--bad); }
.note { padding: 0 14px 10px; color: var(--muted); font-size: 11.5px; }

.box { margin: 4px 8px 10px; display: grid; place-items: center; }
.bm { background: var(--margin); border-radius: 8px; padding: 22px 18px; width: 100%; position: relative; }
.bb { background: rgba(120,120,120,.28); padding: 20px 16px; position: relative; border-radius: 4px; }
.bp { background: var(--padding); padding: 20px 16px; position: relative; border-radius: 4px; }
.bc { background: var(--content); text-align: center; padding: 6px; border-radius: 3px; font-size: 11.5px; }
.bm > b, .bb > b, .bp > b { position: absolute; font-size: 10.5px; font-weight: 600; color: var(--muted); }
.bm > b:nth-of-type(1), .bb > b:nth-of-type(1), .bp > b:nth-of-type(1) { top: 3px; left: 50%; transform: translateX(-50%); }
.bm > b:nth-of-type(2), .bb > b:nth-of-type(2), .bp > b:nth-of-type(2) { right: 4px; top: 50%; transform: translateY(-50%); }
.bm > b:nth-of-type(3), .bb > b:nth-of-type(3), .bp > b:nth-of-type(3) { bottom: 3px; left: 50%; transform: translateX(-50%); }
.bm > b:nth-of-type(4), .bb > b:nth-of-type(4), .bp > b:nth-of-type(4) { left: 4px; top: 50%; transform: translateY(-50%); }
.bm > span.t, .bb > span.t, .bp > span.t { position: absolute; top: 2px; left: 6px; font-size: 10px; color: var(--muted); opacity: .8; }

.actions { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; position: sticky; bottom: -12px; margin: 0 -12px -12px; padding: 10px 12px 12px; background: linear-gradient(to bottom, transparent, var(--bg) 22%); }
.btn { padding: 9px 8px; border-radius: 9px; font-weight: 600; background: var(--surface); border: 1px solid var(--line); text-align: center; transition: border-color .12s, background .12s; }
.btn:hover { border-color: var(--accent); color: var(--accent); }
.btn.primary { background: var(--accent); color: var(--accent-ink); border-color: var(--accent); }
.btn.primary:hover { color: var(--accent-ink); filter: brightness(1.08); }
.btn.danger:hover { border-color: var(--bad); color: var(--bad); }

.empty { text-align: center; padding: 36px 20px; color: var(--muted); }
.empty h2 { margin: 0 0 6px; font-size: 15px; color: var(--ink); }
.empty p { margin: 0 auto 14px; max-width: 280px; }
.keys { display: inline-grid; grid-template-columns: auto auto; gap: 6px 12px; text-align: left; margin-top: 6px; }
kbd { font: 11px ui-monospace, Menlo, Consolas, monospace; background: var(--surface); border: 1px solid var(--line); border-bottom-width: 2px; border-radius: 5px; padding: 1px 6px; color: var(--ink); }

.bar { height: 5px; border-radius: 3px; background: var(--accent-soft); margin-top: 5px; overflow: hidden; }
.bar i { display: block; height: 100%; background: var(--accent); border-radius: 3px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(78px, 1fr)); gap: 8px; padding: 4px 8px 10px; }
.chipc { text-align: left; border: 1px solid var(--line); border-radius: 9px; overflow: hidden; background: var(--surface); position: relative; }
.chipc:hover { border-color: var(--accent); }
.chipc .fill { display: block; height: 38px; border-bottom: 1px solid var(--line); }
.chipc .fill-wrap { display: block; background-image: conic-gradient(#cfd6dc 25%, #fff 0 50%, #cfd6dc 0 75%, #fff 0); background-size: 10px 10px; }
.chipc .lbl { display: block; padding: 4px 6px 5px; font-size: 11px; }
.chipc .lbl small { color: var(--muted); }
.chipc .add { position: absolute; top: 4px; right: 4px; width: 20px; height: 20px; border-radius: 6px; background: var(--surface); color: var(--ink); display: none; place-items: center; box-shadow: 0 1px 4px rgba(0,0,0,.25); }
.chipc:hover .add, .chipc:focus-within .add { display: grid; }
.chipc .add svg { width: 12px; height: 12px; }

.toast { position: absolute; left: 50%; bottom: 16px; transform: translate(-50%, 12px); background: var(--ink); color: var(--surface); padding: 8px 14px; border-radius: 99px; font-weight: 550; opacity: 0; pointer-events: none; transition: opacity .15s, transform .15s; display: flex; gap: 8px; align-items: center; max-width: 90%; z-index: 5; box-shadow: 0 8px 24px rgba(0,0,0,.3); }
.toast.show { opacity: 1; transform: translate(-50%, 0); }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
`;

  // ---------- the inspector ----------

  class InspectStyles {
    constructor() {
      this.active = false;
      this.locked = null;
      this.hovered = null;
      this.tab = "inspect";
      this.picking = false;
      this.palette = [];
      this.scan = null;
      this.settings = { theme: "auto", format: "hex", dock: true, width: DEFAULT_WIDTH };
      this.origMargin = "";
      this.raf = 0;

      this.onMove = this.onMove.bind(this);
      this.onClick = this.onClick.bind(this);
      this.onSwallow = this.onSwallow.bind(this);
      this.onKey = this.onKey.bind(this);
      this.onReflow = this.onReflow.bind(this);

      chrome.runtime.onMessage.addListener((req, sender, respond) => {
        if (!chrome.runtime?.id) return;
        if (req.action === "ping") respond({ ok: true, active: this.active });
        else if (req.action === "toggle") {
          this.active ? this.deactivate() : this.activate();
          respond({ active: this.active });
        }
      });
    }

    // --- storage ---
    async load() {
      try {
        const data = await chrome.storage.local.get(["settings", "palette"]);
        if (data.settings) Object.assign(this.settings, data.settings);
        if (Array.isArray(data.palette)) this.palette = data.palette;
      } catch (e) { /* context invalidated or storage unavailable */ }
      this.settings.width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, this.settings.width || DEFAULT_WIDTH));
    }
    save(key) {
      try { chrome.storage.local.set({ [key]: key === "settings" ? this.settings : this.palette }); } catch (e) { /* ignore */ }
    }

    // --- lifecycle ---
    async activate() {
      if (this.active) return;
      this.active = true;
      await this.load();
      if (!this.active) return;
      this.build();
      document.addEventListener("mousemove", this.onMove, true);
      document.addEventListener("click", this.onClick, true);
      for (const t of ["mousedown", "mouseup", "pointerdown", "pointerup", "auxclick", "dblclick", "contextmenu"]) {
        document.addEventListener(t, this.onSwallow, true);
      }
      document.addEventListener("keydown", this.onKey, true);
      window.addEventListener("resize", this.onReflow);
      window.addEventListener("scroll", this.onReflow, true);
      this.applyDock();
      this.renderPanel();
    }

    deactivate() {
      if (!this.active && !this.host) return;
      this.active = false;
      document.removeEventListener("mousemove", this.onMove, true);
      document.removeEventListener("click", this.onClick, true);
      for (const t of ["mousedown", "mouseup", "pointerdown", "pointerup", "auxclick", "dblclick", "contextmenu"]) {
        document.removeEventListener(t, this.onSwallow, true);
      }
      document.removeEventListener("keydown", this.onKey, true);
      window.removeEventListener("resize", this.onReflow);
      window.removeEventListener("scroll", this.onReflow, true);
      cancelAnimationFrame(this.raf);
      if (this.host) { this.host.remove(); this.host = null; }
      document.body.style.marginRight = this.origMargin;
      this.locked = this.hovered = null;
    }

    // --- DOM ---
    build() {
      this.host = document.createElement("div");
      this.host.id = "inspectstyles-host";
      this.host.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;";
      this.shadow = this.host.attachShadow({ mode: "open" });
      const iconUrl = chrome.runtime.getURL("icons/InspectStyles.png");
      this.shadow.innerHTML = `
        <style>${CSS}</style>
        <div class="root" tabindex="-1">
          <div class="layer l-margin"></div>
          <div class="layer l-box"></div>
          <div class="layer l-content"></div>
          <div class="layer l-hover"></div>
          <div class="tag"></div>
          <aside aria-label="InspectStyles">
            <div class="grip" role="separator" aria-orientation="vertical" title="Drag to resize"></div>
            <header>
              <div class="brand"><img src="${iconUrl}" alt=""><strong>InspectStyles</strong></div>
              <div class="hbtns">
                <button class="ib" data-act="eyedropper" title="Pick a color from the screen">${icon("pick")}</button>
                <button class="ib" data-act="dock" title="Dock or float"></button>
                <button class="ib" data-act="theme" title="Theme"></button>
                <button class="ib" data-act="close" title="Close (Esc)">${icon("x")}</button>
              </div>
            </header>
            <nav role="tablist"></nav>
            <main></main>
            <div class="toast" role="status" aria-live="polite"></div>
          </aside>
        </div>`;
      this.origMargin = document.body.style.marginRight;
      document.documentElement.appendChild(this.host);

      const q = (s) => this.shadow.querySelector(s);
      this.root = q(".root");
      this.aside = q("aside");
      this.mainEl = q("main");
      this.navEl = q("nav");
      this.toastEl = q(".toast");
      this.layers = { margin: q(".l-margin"), box: q(".l-box"), content: q(".l-content"), hover: q(".l-hover"), tag: q(".tag") };

      this.shadow.addEventListener("click", (e) => this.onPanelClick(e));
      this.setupResize(q(".grip"));
      this.applyTheme();
    }

    applyTheme() {
      let t = this.settings.theme;
      if (t === "auto") t = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      this.root.dataset.theme = t;
      const btn = this.shadow.querySelector('[data-act="theme"]');
      btn.innerHTML = icon(this.settings.theme === "auto" ? "auto" : this.settings.theme === "dark" ? "moon" : "sun");
      btn.title = `Theme: ${this.settings.theme} (click to change)`;
    }

    applyDock() {
      const w = this.settings.width;
      this.aside.style.width = w + "px";
      this.root.classList.toggle("float", !this.settings.dock);
      const dockBtn = this.shadow.querySelector('[data-act="dock"]');
      dockBtn.innerHTML = icon("dock");
      dockBtn.classList.toggle("on", this.settings.dock);
      dockBtn.title = this.settings.dock ? "Docked: page moves over. Click to float" : "Floating over the page. Click to dock";
      document.body.style.marginRight = this.settings.dock ? w + "px" : this.origMargin;
    }

    setupResize(grip) {
      grip.addEventListener("pointerdown", (e) => {
        grip.setPointerCapture(e.pointerId);
        grip.classList.add("drag");
        const startX = e.clientX, startW = this.settings.width;
        const move = (ev) => {
          this.settings.width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startW + (startX - ev.clientX)));
          this.applyDock();
          this.reposition();
        };
        const up = () => {
          grip.classList.remove("drag");
          grip.removeEventListener("pointermove", move);
          grip.removeEventListener("pointerup", up);
          this.save("settings");
        };
        grip.addEventListener("pointermove", move);
        grip.addEventListener("pointerup", up);
        e.preventDefault();
      });
    }

    // --- page events ---
    isOurs(e) { return e.target === this.host; }

    onMove(e) {
      if (this.picking || this.isOurs(e)) { this.hideHover(); return; }
      const el = e.target;
      if (el === this.hovered) return;
      this.hovered = el;
      this.reposition();
      if (!this.locked && this.tab === "inspect") {
        cancelAnimationFrame(this.raf);
        this.raf = requestAnimationFrame(() => this.renderPanel());
      }
    }

    onClick(e) {
      if (this.picking || this.isOurs(e)) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      this.select(e.target);
    }

    onSwallow(e) {
      if (this.picking || this.isOurs(e)) return;
      e.stopPropagation();
      if (e.type === "contextmenu") return; // let right click work as normal
      e.preventDefault();
    }

    onKey(e) {
      if (this.picking) return;
      const inPanel = e.composedPath()[0] !== document.body && this.shadow && e.composedPath().includes(this.host);
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        this.deactivate();
        return;
      }
      if (inPanel && (e.key === "Enter" || e.key === " ")) return;
      const cur = this.locked;
      const arrows = { ArrowUp: () => cur && cur.parentElement && cur.parentElement !== document.documentElement ? cur.parentElement : null,
        ArrowDown: () => cur && cur.firstElementChild,
        ArrowLeft: () => cur && cur.previousElementSibling,
        ArrowRight: () => cur && cur.nextElementSibling };
      if (arrows[e.key] && cur) {
        const next = arrows[e.key]();
        e.preventDefault();
        e.stopPropagation();
        if (next) this.select(next);
      } else if ((e.key === "u" || e.key === "U") && cur && !e.metaKey && !e.ctrlKey) {
        this.unlock();
      }
    }

    onReflow() {
      cancelAnimationFrame(this.raf2);
      this.raf2 = requestAnimationFrame(() => this.reposition());
    }

    select(el) {
      this.locked = el;
      this.hovered = el;
      if (this.tab !== "inspect") this.setTab("inspect"); else this.renderPanel();
      this.reposition();
      if (el.scrollIntoView && !this.inViewport(el)) el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    unlock() { this.locked = null; this.renderPanel(); this.reposition(); }
    inViewport(el) {
      const r = el.getBoundingClientRect();
      return r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
    }

    // --- highlight ---
    place(layer, x, y, w, h) {
      const s = layer.style;
      s.display = "block"; s.left = x + "px"; s.top = y + "px"; s.width = Math.max(0, w) + "px"; s.height = Math.max(0, h) + "px";
    }
    hideHover() { if (this.layers) this.layers.hover.style.display = "none"; }

    reposition() {
      if (!this.layers) return;
      const L = this.layers;
      const target = this.locked || this.hovered;
      this.root.classList.toggle("locked", !!this.locked);
      if (!target || !target.isConnected) {
        for (const k of Object.keys(L)) L[k].style.display = "none";
        return;
      }
      const cs = getComputedStyle(target);
      const r = target.getBoundingClientRect();
      const m = { t: px(cs.marginTop), r: px(cs.marginRight), b: px(cs.marginBottom), l: px(cs.marginLeft) };
      const b = { t: px(cs.borderTopWidth), r: px(cs.borderRightWidth), b: px(cs.borderBottomWidth), l: px(cs.borderLeftWidth) };
      const p = { t: px(cs.paddingTop), r: px(cs.paddingRight), b: px(cs.paddingBottom), l: px(cs.paddingLeft) };
      this.place(L.margin, r.left - m.l, r.top - m.t, r.width + m.l + m.r, r.height + m.t + m.b);
      this.place(L.box, r.left, r.top, r.width, r.height);
      this.place(L.content, r.left + b.l + p.l, r.top + b.t + p.t, r.width - b.l - b.r - p.l - p.r, r.height - b.t - b.b - p.t - p.b);

      if (this.locked && this.hovered && this.hovered !== this.locked && this.hovered.isConnected) {
        const h = this.hovered.getBoundingClientRect();
        this.place(L.hover, h.left, h.top, h.width, h.height);
      } else {
        L.hover.style.display = "none";
      }

      const tag = L.tag;
      tag.innerHTML = `<b>${esc(cssSelector(target))}</b><span>${round(r.width)} × ${round(r.height)}</span>`;
      tag.style.display = "block";
      const th = tag.offsetHeight;
      let ty = r.top - th - 6;
      if (ty < 4) ty = Math.min(window.innerHeight - th - 4, r.bottom + 6);
      const maxX = window.innerWidth - (this.settings.dock ? this.settings.width : 0) - tag.offsetWidth - 8;
      tag.style.left = Math.max(4, Math.min(r.left, maxX)) + "px";
      tag.style.top = ty + "px";
    }

    // --- panel ---
    onPanelClick(e) {
      const t = e.target.closest("[data-act],[data-copy],[data-save],[data-tab],[data-fmt],[data-crumb],[data-remove]");
      if (!t) return;
      if (t.dataset.copy !== undefined) return this.copy(t.dataset.copy);
      if (t.dataset.save !== undefined) return this.addColor(t.dataset.save);
      if (t.dataset.tab) return this.setTab(t.dataset.tab);
      if (t.dataset.fmt) { this.settings.format = t.dataset.fmt; this.save("settings"); return this.renderPanel(); }
      if (t.dataset.crumb !== undefined) { const el = this.crumbs && this.crumbs[+t.dataset.crumb]; if (el) this.select(el); return; }
      if (t.dataset.remove !== undefined) { this.palette.splice(+t.dataset.remove, 1); this.save("palette"); return this.renderPanel(); }
      switch (t.dataset.act) {
        case "close": return this.deactivate();
        case "theme": {
          const order = ["auto", "light", "dark"];
          this.settings.theme = order[(order.indexOf(this.settings.theme) + 1) % 3];
          this.save("settings");
          return this.applyTheme();
        }
        case "dock": this.settings.dock = !this.settings.dock; this.save("settings"); this.applyDock(); return this.reposition();
        case "eyedropper": return this.eyedrop();
        case "unlock": return this.unlock();
        case "copy-css": return this.locked || this.hovered ? this.copy(this.exportCSS(this.locked || this.hovered), "CSS copied") : null;
        case "copy-tw": return this.locked || this.hovered ? this.copy(this.exportTailwind(this.locked || this.hovered), "Tailwind classes copied") : null;
        case "copy-json": return this.locked || this.hovered ? this.copy(this.exportJSON(this.locked || this.hovered), "JSON copied") : null;
        case "scan": this.scan = this.scanPage(); return this.renderPanel();
        case "palette-css": return this.copy(this.paletteCSS(), "CSS variables copied");
        case "palette-json": return this.copy(JSON.stringify(this.palette, null, 2), "Palette JSON copied");
        case "palette-clear": this.palette = []; this.save("palette"); return this.renderPanel();
      }
    }

    setTab(tab) {
      this.tab = tab;
      if (tab === "page" && !this.scan) this.scan = this.scanPage();
      this.renderPanel();
      this.mainEl.scrollTop = 0;
    }

    renderPanel() {
      if (!this.shadow) return;
      const tabs = [["inspect", "Inspect"], ["page", "Page"], ["saved", "Saved"]];
      this.navEl.innerHTML = tabs.map(([id, label]) =>
        `<button role="tab" data-tab="${id}" aria-selected="${this.tab === id}">${label}${id === "saved" && this.palette.length ? `<span class="count">${this.palette.length}</span>` : ""}</button>`
      ).join("");
      const keep = this.mainEl.scrollTop;
      this.mainEl.innerHTML =
        this.tab === "inspect" ? this.viewInspect() : this.tab === "page" ? this.viewPage() : this.viewSaved();
      this.mainEl.scrollTop = keep;
    }

    fmt(c) { return formatColor(c, this.settings.format); }

    describe(el) {
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const rootSize = px(getComputedStyle(document.documentElement).fontSize) || 16;
      const color = parseColor(cs.color);
      const own = parseColor(cs.backgroundColor);
      // work out the colour actually visible behind the text
      const layers = [];
      let imageNote = false;
      for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
        const ncs = n === el ? cs : getComputedStyle(n);
        if (ncs.backgroundImage && ncs.backgroundImage !== "none") imageNote = true;
        const c = parseColor(ncs.backgroundColor);
        if (c.a > 0) layers.push(c);
        if (c.a >= 1) break;
      }
      let effective = layers.length && layers[layers.length - 1].a >= 1 ? layers.pop() : { r: 255, g: 255, b: 255, a: 1 };
      while (layers.length) effective = blend(layers.pop(), effective);
      const textOnBg = blend(color, effective);
      const sizePx = px(cs.fontSize);
      const weight = parseInt(cs.fontWeight, 10) || 400;
      const large = sizePx >= 24 || (sizePx >= 18.66 && weight >= 700);
      const border = parseColor(cs.borderTopColor);
      const sides = (a, b, c, d) => ({ t: px(cs[a]), r: px(cs[b]), b: px(cs[c]), l: px(cs[d]) });
      const margin = sides("marginTop", "marginRight", "marginBottom", "marginLeft");
      const padding = sides("paddingTop", "paddingRight", "paddingBottom", "paddingLeft");
      const bw = sides("borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth");
      const ownText = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(" ").trim();
      return {
        cs, rect, rootSize, color, own, effective, ratio: contrastRatio(textOnBg, effective), large, imageNote, border,
        borderOn: bw.t > 0 && border.a > 0 && cs.borderTopStyle !== "none",
        margin, padding, bw, sizePx, weight, sample: ownText.slice(0, 48),
        family: firstFamily(cs.fontFamily),
      };
    }

    row(label, value, extra, copyValue) {
      const cv = copyValue !== undefined ? copyValue : value;
      return `<div class="row"><span class="k">${esc(label)}</span><span class="v mono">${esc(value)}${extra ? `<em>${esc(extra)}</em>` : ""}</span>
        <button class="ib" data-copy="${esc(cv)}" title="Copy ${esc(label.toLowerCase())}" aria-label="Copy ${esc(label.toLowerCase())}">${icon("copy")}</button></div>`;
    }

    colorRow(label, c, note) {
      const value = this.fmt(c);
      const hex = toHex(c);
      return `<div class="row crow"><span class="sw"><i style="background:${esc(toRgb(c))}"></i></span>
        <span class="v"><span>${esc(label)}</span><small class="mono">${esc(value)}${note ? ` · ${esc(note)}` : ""}</small></span>
        <button class="ib" data-copy="${esc(value)}" title="Copy ${esc(label.toLowerCase())}" aria-label="Copy ${esc(label.toLowerCase())}">${icon("copy")}</button>
        <button class="ib" data-save="${esc(hex)}" title="Save to palette" aria-label="Save ${esc(label.toLowerCase())} to palette">${icon("plus")}</button></div>`;
    }

    formatSwitch() {
      return `<span class="seg" role="group" aria-label="Color format">${["hex", "rgb", "hsl"].map((f) =>
        `<button data-fmt="${f}" aria-pressed="${this.settings.format === f}">${f.toUpperCase()}</button>`).join("")}</span>`;
    }

    viewInspect() {
      const el = this.locked || this.hovered;
      if (!el || !el.isConnected) {
        return `<div class="empty"><h2>Move over the page</h2><p>Hover any element to read its styles. Click to lock it in place.</p>
          <div class="keys"><kbd>Click</kbd><span>Lock an element</span><kbd>↑ ↓ ← →</kbd><span>Parent, child, siblings</span><kbd>U</kbd><span>Unlock</span><kbd>Esc</kbd><span>Close</span></div></div>`;
      }
      const d = this.describe(el);
      const cs = d.cs;

      // breadcrumb of ancestors
      const chain = [];
      for (let n = el; n && n.nodeType === 1 && chain.length < 4; n = n.parentElement) {
        if (n === document.documentElement) break;
        chain.unshift(n);
      }
      this.crumbs = chain;
      const crumbs = chain.map((n, i) =>
        `<button data-crumb="${i}" class="${n === el ? "cur" : ""}">${esc(cssSelector(n))}</button>`).join("<i>›</i>");

      const status = this.locked
        ? `<span class="chip">Locked <button class="ib" style="width:18px;height:18px" data-act="unlock" title="Unlock (U)" aria-label="Unlock">${icon("unlock")}</button></span>`
        : `<span class="chip live">Live preview</span>`;

      const ls = cs.letterSpacing;
      const weightName = WEIGHT_NAMES[d.weight] ? ` ${WEIGHT_NAMES[d.weight]}` : "";
      const specSize = Math.min(Math.max(d.sizePx, 28), 56);
      const specBg = toRgb(d.effective);
      const spec = `<div class="spec" style="background:${esc(specBg)};color:${esc(toRgb(d.color))};font-family:${esc(cs.fontFamily)};font-weight:${esc(cs.fontWeight)};font-style:${esc(cs.fontStyle)}">
        <div class="spec-aa" style="font-size:${specSize}px">Aa</div><div class="spec-txt">${esc(d.sample || "The quick brown fox jumps over the lazy dog")}</div></div>`;

      const typo = spec + [
        this.row("Font", d.family, "", cs.fontFamily),
        this.row("Size", cs.fontSize, round(d.sizePx / d.rootSize) + "rem"),
        this.row("Weight", String(d.weight), WEIGHT_NAMES[d.weight] || ""),
        this.row("Line height", cs.lineHeight, cs.lineHeight !== "normal" && d.sizePx ? round(px(cs.lineHeight) / d.sizePx) + "×" : ""),
        ls !== "normal" && ls !== "0px" ? this.row("Letter spacing", ls) : "",
        this.row("Style", `${cs.fontStyle}${cs.textTransform !== "none" ? ", " + cs.textTransform : ""}${cs.textDecorationLine !== "none" ? ", " + cs.textDecorationLine : ""}`.replace(/^normal, /, "")),
        this.row("Align", cs.textAlign),
      ].join("");

      const cr = d.ratio;
      const t = (min) => cr >= min;
      const badge = (name, ok) => `<span class="badge ${ok ? "pass" : "fail"}"><span>${name}</span><span>${ok ? "Pass" : "Fail"}</span></span>`;
      const contrast = `<div class="contrast"><div class="ratio">${cr.toFixed(2)}<small>contrast ratio</small></div>
        <div class="badges">${badge("AA text", t(4.5))}${badge("AA large", t(3))}${badge("AAA text", t(7))}${badge("AAA large", t(4.5))}</div></div>
        <div class="note">${d.large ? "This text counts as large." : "This text counts as normal size."}${d.imageNote ? " A background image sits behind it, so the real ratio may differ." : ""}</div>`;

      const colors = this.colorRow("Text", d.color) +
        this.colorRow("Background", d.own.a > 0 ? d.own : d.effective, d.own.a > 0 ? "" : "from a parent") +
        (d.borderOn ? this.colorRow("Border", d.border) : "");

      const bx = (s) => ({ t: round(s.t), r: round(s.r), b: round(s.b), l: round(s.l) });
      const M = bx(d.margin), B = bx(d.bw), P = bx(d.padding);
      const cw = round(d.rect.width - d.bw.l - d.bw.r - d.padding.l - d.padding.r);
      const ch = round(d.rect.height - d.bw.t - d.bw.b - d.padding.t - d.padding.b);
      const sideLabels = (o) => `<b>${o.t}</b><b>${o.r}</b><b>${o.b}</b><b>${o.l}</b>`;
      const boxModel = `<div class="box"><div class="bm"><span class="t">margin</span>${sideLabels(M)}
        <div class="bb"><span class="t">border</span>${sideLabels(B)}
        <div class="bp"><span class="t">padding</span>${sideLabels(P)}
        <div class="bc mono">${cw} × ${ch}</div></div></div></div></div>`;

      const layoutRows = [
        this.row("Display", cs.display),
        cs.position !== "static" ? this.row("Position", cs.position) : "",
        this.row("Size", `${round(d.rect.width)} × ${round(d.rect.height)}`, "", `${round(d.rect.width)}px ${round(d.rect.height)}px`),
        /flex|grid/.test(cs.display) && cs.gap !== "normal" ? this.row("Gap", cs.gap) : "",
        cs.display.includes("flex") ? this.row("Flex", `${cs.flexDirection}, ${cs.justifyContent}, ${cs.alignItems}`) : "",
        cs.borderRadius !== "0px" ? this.row("Radius", cs.borderRadius) : "",
        cs.boxShadow !== "none" ? this.row("Shadow", cs.boxShadow) : "",
        cs.opacity !== "1" ? this.row("Opacity", cs.opacity) : "",
      ].join("");

      return `
        <div class="card"><div class="crumbs">${crumbs}</div><div class="meta">${status}<span class="mono">${round(d.rect.width)} × ${round(d.rect.height)}</span></div></div>
        <div class="card"><h3>Typography</h3><div class="body">${typo}</div></div>
        <div class="card"><h3>Colors ${this.formatSwitch()}</h3><div class="body">${colors}</div></div>
        <div class="card"><h3>Contrast</h3>${contrast}</div>
        <div class="card"><h3>Spacing</h3>${boxModel}<div class="body">${layoutRows}</div></div>
        <div class="actions">
          <button class="btn primary" data-act="copy-css">Copy CSS</button>
          <button class="btn" data-act="copy-tw">Tailwind</button>
          <button class="btn" data-act="copy-json">JSON</button>
        </div>`;
    }

    // --- page scan ---
    scanPage() {
      const fonts = new Map(), text = new Map(), bgs = new Map();
      const els = document.body.querySelectorAll("*");
      const skip = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "META", "LINK", "BR", "HEAD", "TITLE", "SVG", "PATH"]);
      const limit = Math.min(els.length, 6000);
      let seen = 0;
      for (let i = 0; i < limit; i++) {
        const el = els[i];
        if (skip.has(el.tagName.toUpperCase())) continue;
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden") continue;
        seen++;
        const bg = parseColor(cs.backgroundColor);
        if (bg.a > 0) bgs.set(toHex(bg), (bgs.get(toHex(bg)) || 0) + 1);
        const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if (!hasText) continue;
        const fam = firstFamily(cs.fontFamily);
        const f = fonts.get(fam) || { count: 0, weights: new Set(), sizes: new Set(), stack: cs.fontFamily };
        f.count++; f.weights.add(parseInt(cs.fontWeight, 10) || 400); f.sizes.add(Math.round(px(cs.fontSize)));
        fonts.set(fam, f);
        const c = toHex(parseColor(cs.color));
        text.set(c, (text.get(c) || 0) + 1);
      }
      const top = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
      return { fonts: [...fonts.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 8), text: top(text), bgs: top(bgs), seen, capped: els.length > limit };
    }

    colorChip(hex, count) {
      const c = parseColor(hex);
      return `<div class="chipc"><button style="display:block;width:100%;text-align:left" data-copy="${esc(this.fmt(c))}" title="Copy ${esc(this.fmt(c))}">
        <span class="fill-wrap"><span class="fill" style="background:${esc(toRgb(c))}"></span></span>
        <span class="lbl mono">${esc(this.fmt(c).replace(/^#/, "#"))}${count ? ` <small>×${count}</small>` : ""}</span></button>
        <button class="add" data-save="${esc(hex)}" title="Save to palette" aria-label="Save ${esc(hex)} to palette">${icon("plus")}</button></div>`;
    }

    viewPage() {
      const s = this.scan;
      if (!s) return `<div class="empty"><h2>Scan this page</h2><p>See every font and color the page uses, most common first.</p><button class="btn primary" data-act="scan">Scan page</button></div>`;
      const maxCount = s.fonts.length ? s.fonts[0][1].count : 1;
      const fonts = s.fonts.map(([name, f]) => `
        <div class="row" style="align-items:flex-start;flex-direction:column;gap:0;padding:8px 10px">
          <div style="display:flex;width:100%;justify-content:space-between;gap:8px">
            <span style="font-family:${esc(f.stack)};font-size:15px;font-weight:600">${esc(name)}</span>
            <button class="ib" style="opacity:1;margin-top:-2px" data-copy="${esc(f.stack)}" title="Copy font stack" aria-label="Copy font stack for ${esc(name)}">${icon("copy")}</button>
          </div>
          <span class="mono" style="color:var(--muted)">weights ${[...f.weights].sort((a, b) => a - b).join(", ")} · sizes ${[...f.sizes].sort((a, b) => a - b).slice(0, 6).join(", ")}px</span>
          <div class="bar" style="width:100%"><i style="width:${Math.round((f.count / maxCount) * 100)}%"></i></div>
        </div>`).join("") || `<div class="note">No visible text found.</div>`;
      return `
        <div class="card"><h3>Fonts <span class="mono" style="font-weight:400">${s.fonts.length} found</span></h3><div class="body">${fonts}</div></div>
        <div class="card"><h3>Text colors ${this.formatSwitch()}</h3><div class="grid">${s.text.map(([h, n]) => this.colorChip(h, n)).join("")}</div></div>
        <div class="card"><h3>Background colors</h3><div class="grid">${s.bgs.map(([h, n]) => this.colorChip(h, n)).join("") || '<div class="note">Only the default white background was found.</div>'}</div></div>
        <div class="note" style="padding:0 4px">Scanned ${s.seen} elements${s.capped ? " (stopped at the first 6000)" : ""}.</div>
        <button class="btn" data-act="scan">Scan again</button>`;
    }

    viewSaved() {
      if (!this.palette.length) {
        return `<div class="empty"><h2>No saved colors yet</h2><p>Use the eyedropper in the header, or press + next to any color to keep it here.</p><button class="btn primary" data-act="eyedropper">Pick a color</button></div>`;
      }
      const rows = this.palette.map((hex, i) => {
        const c = parseColor(hex);
        return `<div class="row crow"><span class="sw"><i style="background:${esc(toRgb(c))}"></i></span>
          <span class="v"><span class="mono">${esc(this.fmt(c))}</span></span>
          <button class="ib" style="opacity:1" data-copy="${esc(this.fmt(c))}" title="Copy" aria-label="Copy ${esc(hex)}">${icon("copy")}</button>
          <button class="ib" style="opacity:1" data-remove="${i}" title="Remove" aria-label="Remove ${esc(hex)}">${icon("trash")}</button></div>`;
      }).join("");
      return `<div class="card"><h3>Your palette ${this.formatSwitch()}</h3><div class="body">${rows}</div></div>
        <div class="actions"><button class="btn primary" data-act="palette-css">CSS variables</button><button class="btn" data-act="palette-json">JSON</button><button class="btn danger" data-act="palette-clear">Clear all</button></div>`;
    }

    // --- actions ---
    async copy(text, message) {
      try {
        await navigator.clipboard.writeText(text);
      } catch (e) {
        // clipboard API can be blocked by page policy, fall back to execCommand
        const ta = document.createElement("textarea");
        ta.value = text; ta.style.cssText = "position:fixed;opacity:0";
        document.body.appendChild(ta); ta.select();
        try { document.execCommand("copy"); } catch (err) { /* ignore */ }
        ta.remove();
      }
      this.showToast(message || `Copied ${text.length > 34 ? text.slice(0, 32) + "…" : text}`);
    }

    showToast(msg) {
      if (!this.toastEl) return;
      this.toastEl.innerHTML = `${icon("check")}<span>${esc(msg)}</span>`;
      this.toastEl.classList.add("show");
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => this.toastEl && this.toastEl.classList.remove("show"), 1600);
    }

    addColor(hex) {
      hex = hex.toLowerCase();
      if (this.palette.includes(hex)) return this.showToast("Already in your palette");
      this.palette.unshift(hex);
      this.palette = this.palette.slice(0, 60);
      this.save("palette");
      this.showToast(`Saved ${hex}`);
      this.renderPanel();
    }

    async eyedrop() {
      if (!window.EyeDropper) return this.showToast("Eyedropper needs Chrome 95 or newer");
      this.picking = true;
      this.hideHover();
      try {
        const { sRGBHex } = await new window.EyeDropper().open();
        const c = parseColor(sRGBHex);
        const value = this.fmt(c);
        await this.copy(value, `Copied ${value} and saved it`);
        this.addColorQuiet(toHex(c));
      } catch (e) {
        // user pressed Esc to cancel
      } finally {
        this.picking = false;
        if (this.active) { this.tab = "saved"; this.renderPanel(); }
      }
    }
    addColorQuiet(hex) {
      if (!this.palette.includes(hex)) { this.palette.unshift(hex); this.palette = this.palette.slice(0, 60); this.save("palette"); }
    }

    // --- exports ---
    exportCSS(el) {
      const d = this.describe(el);
      const cs = d.cs;
      const lines = [];
      const add = (k, v) => v && lines.push(`  ${k}: ${v};`);
      add("font-family", cs.fontFamily);
      add("font-size", cs.fontSize);
      add("font-weight", cs.fontWeight);
      if (cs.fontStyle !== "normal") add("font-style", cs.fontStyle);
      add("line-height", cs.lineHeight);
      if (cs.letterSpacing !== "normal" && cs.letterSpacing !== "0px") add("letter-spacing", cs.letterSpacing);
      if (!["start", "left"].includes(cs.textAlign)) add("text-align", cs.textAlign);
      if (cs.textTransform !== "none") add("text-transform", cs.textTransform);
      add("color", toHex(d.color));
      if (d.own.a > 0) add("background-color", toHex(d.own));
      if (d.borderOn) add("border", `${cs.borderTopWidth} ${cs.borderTopStyle} ${toHex(d.border)}`);
      if (cs.borderRadius !== "0px") add("border-radius", cs.borderRadius);
      const spacing = (name, s) => {
        const v = [s.t, s.r, s.b, s.l].map((n) => round(n) + "px");
        if (v.every((x) => x === "0px")) return;
        if (v[0] === v[1] && v[1] === v[2] && v[2] === v[3]) add(name, v[0]);
        else if (v[0] === v[2] && v[1] === v[3]) add(name, `${v[0]} ${v[1]}`);
        else add(name, v.join(" "));
      };
      spacing("margin", d.margin);
      spacing("padding", d.padding);
      if (cs.display !== "inline") add("display", cs.display);
      if (cs.position !== "static") add("position", cs.position);
      if (cs.boxShadow !== "none") add("box-shadow", cs.boxShadow);
      return `${cssSelector(el)} {\n${lines.join("\n")}\n}`;
    }

    exportTailwind(el) {
      const d = this.describe(el);
      const cs = d.cs;
      const u = (s) => String(s).trim().replace(/\s+/g, "_");
      const out = [];
      out.push(`font-['${u(d.family)}']`, `text-[${cs.fontSize}]`, `font-[${d.weight}]`);
      if (cs.lineHeight !== "normal") out.push(`leading-[${cs.lineHeight}]`);
      if (cs.letterSpacing !== "normal" && cs.letterSpacing !== "0px") out.push(`tracking-[${cs.letterSpacing}]`);
      out.push(`text-[${toHex(d.color)}]`);
      if (d.own.a > 0) out.push(`bg-[${toHex(d.own)}]`);
      if (cs.borderRadius !== "0px") out.push(`rounded-[${u(cs.borderRadius)}]`);
      const sp = (prefix, s) => {
        const v = [s.t, s.r, s.b, s.l].map((n) => round(n));
        if (v.every((n) => n === 0)) return;
        if (v.every((n) => n === v[0])) out.push(`${prefix}-[${v[0]}px]`);
        else {
          if (v[0] === v[2] && v[0]) out.push(`${prefix}y-[${v[0]}px]`); else { if (v[0]) out.push(`${prefix}t-[${v[0]}px]`); if (v[2]) out.push(`${prefix}b-[${v[2]}px]`); }
          if (v[1] === v[3] && v[1]) out.push(`${prefix}x-[${v[1]}px]`); else { if (v[1]) out.push(`${prefix}r-[${v[1]}px]`); if (v[3]) out.push(`${prefix}l-[${v[3]}px]`); }
        }
      };
      sp("p", d.padding);
      sp("m", d.margin);
      return out.join(" ");
    }

    exportJSON(el) {
      const d = this.describe(el);
      const cs = d.cs;
      return JSON.stringify({
        selector: cssSelector(el),
        typography: { fontFamily: cs.fontFamily, fontSize: cs.fontSize, fontWeight: cs.fontWeight, lineHeight: cs.lineHeight, letterSpacing: cs.letterSpacing, textAlign: cs.textAlign },
        colors: { text: toHex(d.color), background: d.own.a > 0 ? toHex(d.own) : null, effectiveBackground: toHex(d.effective), contrastRatio: +d.ratio.toFixed(2) },
        layout: { display: cs.display, position: cs.position, width: round(d.rect.width), height: round(d.rect.height), margin: d.margin, padding: d.padding, borderRadius: cs.borderRadius },
      }, null, 2);
    }

    paletteCSS() {
      return `:root {\n${this.palette.map((h, i) => `  --color-${i + 1}: ${h};`).join("\n")}\n}`;
    }
  }

  window.__inspectStyles = new InspectStyles();
})();
