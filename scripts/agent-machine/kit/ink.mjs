import { iso, segment, slabOf, solidSvg } from "./iso-kit.mjs";

export const PALETTES = {
  mint: ["#93d3b0", "#71b693", "#1f4034"],
  cobalt: ["#76a0e2", "#5a82c6", "#1c2948"],
  mustard: ["#f4b829", "#d49c1f", "#4e4a18"],
  tomato: ["#ef6a4c", "#cf5038", "#4a2219"],
  blush: ["#f3a6bb", "#d8869c", "#4b2430"],
};

export const LIGHT = [-0.09, 0.26];

export function inkSolid(paths, style = {}) {
  const material = style.material || style.tone || "hi";
  return solidSvg(paths, { ...style, className: [`m-${material}`, style.className].filter(Boolean).join(" ") });
}

export function hull(points) {
  const pts = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const turn = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  const upper = [];
  for (const p of pts) {
    while (lower.length >= 2 && turn(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  for (const p of pts.reverse()) {
    while (upper.length >= 2 && turn(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

const ringPath = (ring) => "M" + ring.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L") + "Z";

export function silhouetteSvg(points3, P) {
  return `<path class="sil" d="${ringPath(hull(points3.map((p) => iso(p, P))))}"/>`;
}

export function castShadowSvg(points3, P, z0 = 0, light = LIGHT) {
  const flat = points3.map(([x, y, z]) => iso([x + (z - z0) * light[0], y + (z - z0) * light[1], z0], P));
  return `<path class="cast" d="${ringPath(hull(flat))}"/>`;
}

export function glassSvg(x0, y0, z0, x1, y1, z1, P) {
  const panel = inkSolid(slabOf({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r: 0 }, z0, z1 - z0, P, 1, 0), { material: "glass", tone: "lo" });
  const streak = (t, len) => {
    const xa = x0 + (x1 - x0) * t;
    return segment([xa, y1, z0 + (z1 - z0) * 0.25], [xa + (x1 - x0) * len, y1, z0 + (z1 - z0) * 0.85], P);
  };
  return panel + `<path class="streak" d="${streak(0.2, 0.08)}${streak(0.32, 0.05)}"/>`;
}

export function pillSvg([ax, ay], dx, dy, text, on, size = 10.5) {
  const w = text.length * size * 0.62 + size * 1.6;
  const h = size * 1.85;
  const cx = ax + dx;
  const cy = ay + dy;
  const r = (v) => v.toFixed(1);
  return `<g class="pill${on ? " on" : ""}"><path class="lead" d="M${r(ax)} ${r(ay)}L${r(cx)} ${r(cy + h / 2)}"/><circle class="lead-dot" cx="${r(ax)}" cy="${r(ay)}" r="1.6"/><rect x="${r(cx - w / 2)}" y="${r(cy - h / 2)}" width="${r(w)}" height="${r(h)}" rx="${r(h / 2)}"/><text x="${r(cx)}" y="${r(cy + size * 0.36)}" font-size="${size}" text-anchor="middle">${text}</text></g>`;
}

export const wobbleFilter = (id = "iso-hand", scale = 2.4) =>
  `<defs><filter id="${id}" x="-2%" y="-4%" width="104%" height="108%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4" result="warp"/><feDisplacementMap data-wobble in="SourceGraphic" in2="warp" scale="${scale}" xChannelSelector="R" yChannelSelector="G"/></filter></defs>`;

export function blend(a, b, t) {
  return "#" + [1, 3, 5].map((i) => Math.round(parseInt(a.substr(i, 2), 16) * (1 - t) + parseInt(b.substr(i, 2), 16) * t).toString(16).padStart(2, "0")).join("");
}

export const INK_CSS = `
.iso-ink{--paper:#f2efe7;--ink:#1b2340;--ink-soft:rgba(27,35,64,.55);--body-l:#93d3b0;--body-m:#71b693;--body-d:#1f4034;--ride-l:#f4b829;--ride-m:#d49c1f;--ride-d:#4e4a18;--ceramic-l:#fbfaf3;--ceramic-m:#e3e0d2;--ceramic-d:#bdb8a6;--metal-l:#eef0f0;--metal-m:#c6ccce;--metal-d:#8f989b;--board-l:#e6e1d4;--board-m:#cfc8b8;--board-d:#aaa293;--glass:#cfe9f0;--cast:#8a7f6e;--cast-opacity:.42;--ok:#43c25c;--bad:#e2483d;--pill:#fff4d6;--pill-on:var(--anatomy-lit,#3553ff);--hot-top:var(--anatomy-lit-top,#f1f3ff)}
:root[data-theme="dark"] .iso-ink,.iso-ink[data-theme="dark"]{--paper:#1f1c18;--ink:#efe6d3;--ink-soft:rgba(239,230,211,.5);--ceramic-l:#6d685d;--ceramic-m:#57534a;--ceramic-d:#3b3832;--metal-l:#5d6366;--metal-m:#484d50;--metal-d:#33373a;--board-l:#3d3831;--board-m:#312d27;--board-d:#24211c;--glass:#6f9aa6;--cast:#0b0907;--cast-opacity:.55;--pill:#3a352c;--hot-top:#3d4f9c}
.iso-ink .m-mid{--c-l:var(--body-l);--c-m:var(--body-m);--c-d:var(--body-d)}
.iso-ink .m-ride{--c-l:var(--ride-l);--c-m:var(--ride-m);--c-d:var(--ride-d)}
.iso-ink .m-hi{--c-l:var(--ceramic-l);--c-m:var(--ceramic-m);--c-d:var(--ceramic-d)}
.iso-ink .m-lo,.iso-ink .m-faint{--c-l:var(--metal-l);--c-m:var(--metal-m);--c-d:var(--metal-d)}
.iso-ink .m-board{--c-l:var(--board-l);--c-m:var(--board-m);--c-d:var(--board-d)}
.iso-ink .m-chip{--c-l:#4d4943;--c-m:#3a3732;--c-d:#26241f}
.iso-ink .iso-face-text{fill:var(--ink);font-weight:700}
.iso-ink .on-dark .iso-face-text{fill:#efe6d3}
.iso-ink .m-lamp{--c-l:#8d8a80;--c-m:#6f6c63;--c-d:#4c4a43}
.iso-ink [data-state="ok"] .m-lamp{--c-l:var(--ok);--c-m:#33a04a;--c-d:#1d6b2e}
.iso-ink [data-state="bad"] .m-lamp{--c-l:var(--bad);--c-m:#c23a30;--c-d:#7a221c}
.iso-ink .iso-fill{fill:var(--c-m)}
.iso-ink .iso-top,.iso-ink .iso-shade[data-shade="3"]{fill:var(--c-l)}
.iso-ink .iso-shade[data-shade="2"],.iso-ink .iso-shade[data-shade="1"]{fill:var(--c-m)}
.iso-ink .iso-shade[data-shade="0"]{fill:color-mix(in srgb,var(--c-m) 62%,var(--c-d))}
.iso-ink .m-glass>.iso-fill,.iso-ink .m-glass>.iso-shade{fill:var(--glass);opacity:.26}
.iso-ink .m-glass>.iso-top{fill:var(--glass);opacity:.14}
.iso-ink .m-glass>.iso-edge{stroke-width:.8;opacity:.7}
.iso-ink .streak{fill:none;stroke:#fff;stroke-width:1.6;opacity:.38;stroke-linecap:round}
.iso-ink path.iso-edge{stroke:var(--ink);stroke-width:1.2}
.iso-ink path.iso-line:not(.iso-edge){stroke:var(--ink-soft);stroke-width:.7}
.iso-ink path.iso-crease,.iso-ink path.iso-bevel{stroke:var(--ink-soft);stroke-width:.6}
.iso-ink .sil{fill:none;stroke:var(--ink);stroke-width:2.6;stroke-linejoin:round;vector-effect:non-scaling-stroke}
.iso-ink .cast{fill:var(--cast);opacity:var(--cast-opacity);stroke:none}
.iso-ink .iso-dots circle{fill:var(--ink)}
.iso-ink .iso-halo{display:none}
.iso-ink [data-hot] .iso-top{fill:var(--hot-top)}
.iso-ink [data-hot] path.iso-edge{stroke:var(--pill-on)}
.iso-ink [data-off] .m-mid,.iso-ink [data-off] .m-hi{--c-l:var(--board-l);--c-m:var(--board-m);--c-d:var(--board-d)}
.iso-ink [data-off] path.iso-edge{stroke:var(--ink-soft)}
.iso-ink .pill path.lead{fill:none;stroke:var(--ink);stroke-width:1;vector-effect:non-scaling-stroke}
.iso-ink .pill .lead-dot{fill:var(--ink)}
.iso-ink .pill rect{fill:var(--pill);stroke:var(--ink);stroke-width:1.2;vector-effect:non-scaling-stroke}
.iso-ink .pill text{fill:var(--ink);font-family:var(--font-mono,var(--anatomy-mono,Menlo,Consolas,monospace));font-weight:700;letter-spacing:.04em}
.iso-ink .pill.on rect{fill:var(--pill-on)}
.iso-ink .pill.on text{fill:#fff}
:root[data-theme="dark"] .iso-ink .pill.on text,.iso-ink[data-theme="dark"] .pill.on text{fill:var(--paper)}
.iso-ink .pill.on path.lead{stroke:var(--pill-on)}
.iso-ink .pill.on .lead-dot{fill:var(--pill-on)}
:root.iso-nolabels .iso-ink [data-pills]{display:none}
`;
