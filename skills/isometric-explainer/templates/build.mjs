import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../kit/iso-kit.mjs";
import * as ink from "../kit/ink.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] || join(HERE, "out.html");

const W = 720;
const H = 440;
const AZIMUTH = 60;
const PLATE = { x: -72, y: -38, w: 144, d: 68, r: 4 };
const STOPS = { intake: -48, cache: -16, origin: 16, exit: 48 };
const CONCEPT = { intake: "REQUEST", cache: "CACHE", origin: "ORIGIN", exit: "RESPONSE" };
const EXPLODE = { base: [0, 0, 0], rail: [0, 0, 0], intake: [-16, -8, 10], cache: [-2, -14, 20], origin: [12, -16, 28], exit: [16, 14, 6], carriage: [0, 0, 18] };

const P = k.fitProjection([...k.boxCorners(PLATE, -5, 0), [16, -30, 36], [-16, -34, 30], [28, -46, 64], [-18, -50, 50], [-74, -46, 26]], W, H, { pad: 20, azimuth: AZIMUTH });
const depth = (p) => k.depthOf(p, P);
const S = (paths, style) => ink.inkSolid(paths, { tone: "mid", ...style });
const box = (x0, y0, z0, x1, y1, z1, style = {}, r = 0.6) => S(k.slabOf({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r }, z0, z1 - z0, P, r ? 3 : 1), style);

const items = [];
function put(id, asm, ref, svg, bias = 0) {
  items.push({ id, asm, key: depth(ref) + bias, svg });
}

const LABELS = [
  { asm: "intake", at: [-48, -21, 16], dx: -10, dy: -70 },
  { asm: "cache", at: [-16, -33, 27], dx: 0, dy: -46 },
  { asm: "origin", at: [16, -27, 34], dx: 10, dy: -40 },
  { asm: "exit", at: [48, 20, 4], dx: 64, dy: -14 },
];
const BODIES = [[-58, -28, 0, -38, -14, 16], [-26, -36, 0, -6, -12, 27], [6, -32, 0, 26, -12, 34]];
const corners3 = ([x0, y0, z0, x1, y1, z1]) => [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
put("shadows", "base", [0, 0, -90], BODIES.map((b) => ink.castShadowSvg(corners3(b), P)).join(""), -900);

put("base", "base", [0, 0, -100], S(k.slabOf(PLATE, -5, 5, P, 6, 1), { material: "board" }) + ink.silhouetteSvg(k.boxCorners(PLATE, -5, 0), P), -1000);
put("rail", "rail", [0, 0, -50], box(-62, -2.5, 0, 62, 2.5, 1.5, { tone: "lo" }, 0) + Object.values(STOPS).map((x) => k.lineSvg(k.lineOnTop([x, -2.5], [x, 2.5], 1.5, P), { tone: "faint" })).join(""), -500);

put("intake", "intake", [-48, -21, 8], box(-58, -28, 0, -38, -14, 16) + box(-51, -14, 6, -45, -2.5, 7, { tone: "lo" }, 0));

put("cache", "cache", [-16, -21, 5], box(-26, -30, 0, -6, -12, 10) + box(-18, -36, 0, -14, -32, 27, {}, 0.4));
put("cache-arm", "cache", [-16, -16, 25], box(-18, -36, 25, -14, 0, 28, { tone: "hi" }, 0.4), 4);
put("probe", "cache", [-16, 0, 20], box(-19, -3, 18, -13, 3, 25, { tone: "hi" }), 6);
for (let i = 0; i < 3; i++) {
  put(`bin${i}`, "cache", [-16, -27 + i * 4, 13], `<g data-live="bin${i}" style="display:none">${box(-21, -27 + i * 4, 10, -11, -26.2 + i * 4, 17, { tone: "hi" }, 0)}</g>`, 3 + 0.1 * i);
}
const dial = [-32, 19];
const dialSvg = S(k.cylinder(dial[0], dial[1], 6, 0, 2, P, 40)) + k.lineSvg(k.ring(dial[0], dial[1], 4.6, 2, P, 40), { tone: "lo" });
const ticks = [0, 1, 2, 3].map((n) => tickOf(n / 3)).join("");
put("gauge", "cache", [dial[0], dial[1], 1], dialSvg + k.lineSvg(ticks, { tone: "mid" }) + `<path class="iso-line" data-tone="hi" data-live="needle" d=""/>` + S(k.cylinder(dial[0], dial[1], 0.8, 2, 0.4, P, 12), { tone: "hi" }));
function tickOf(share) {
  const a = -0.75 * Math.PI + share * 1.5 * Math.PI;
  return k.lineOnTop([dial[0] + Math.sin(a) * 4.6, dial[1] - Math.cos(a) * 4.6], [dial[0] + Math.sin(a) * 6, dial[1] - Math.cos(a) * 6], 2, P);
}

put("origin", "origin", [16, -21, 10], box(6, -32, 0, 26, -12, 6) + box(12, -30, 6, 20, -24, 34, { tone: "mid" }, 0.4));
put("origin-arm", "origin", [16, -12, 30], box(13, -24, 28, 19, 4, 32, { tone: "hi" }, 0.4) + `<path class="iso-line" data-tone="mid" data-live="rod" style="stroke-width:1.4" d=""/>`, 4);
put("head", "origin", [16, 0, 22], box(13.5, -3, 19, 18.5, 3, 25, { tone: "hi" }), 6);

put("exit", "exit", [48, 20, 1], box(40, 13, 0, 56, 27, 1.5, { tone: "lo" }) + box(40, 26, 1.5, 56, 27, 4, {}, 0));
for (let i = 0; i < 3; i++) {
  put(`tray${i}`, "exit", [48, 19, 2 + i], `<g data-live="tray${i}" style="display:none">${box(43, 15, 1.5 + i * 0.8, 53, 23, 2.1 + i * 0.8, { tone: "hi" }, 0.2)}</g>`, 3 + 0.1 * i);
}

put("carriage", "carriage", [0, 0, 6], S(k.cylinder(0, 0, 6, 1.5, 3, P, 40)) + box(-4, -0.4, 4.5, 4, 0.4, 15, { tone: "hi" }, 0), 0);

const exportsOf = (source) => [...source.matchAll(/^export (?:const|function|let) ([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
function inline(file, name) {
  const source = readFileSync(join(HERE, file), "utf8");
  const body = source.replace(/^import \{([^}]+)\} from "\.\/iso-kit\.mjs";$/m, "const {$1} = K;").replace(/^export /gm, "");
  return `const ${name} = (() => {\n${body}\nreturn { ${exportsOf(source).join(", ")} };\n})();`;
}

const V = [depth([1, 0, 0]), depth([0, 1, 0]), depth([0, 0, 1])];
const DATA = { P, V, STOPS, EXPLODE, LABELS, CONCEPT, DIAL: [dial[0], dial[1], 2.4], ROD: [16, 0, 28, 25], items: items.map(({ id, asm, key }) => ({ id, asm, key })) };
const LABEL = "A shuttle on a rail carries a request card past a cache bin with a probe, an origin press and a response tray. A dial counts cache hits.";
const body = items.map((item) => `<g data-i="${item.id}" data-asm="${item.asm}">${item.svg}</g>`).join("");
const svg = k.figureSvg({ width: W, height: H, label: LABEL, body: `${ink.wobbleFilter()}<g data-layer filter="url(#iso-hand)">${body}</g><g data-pills></g>` }).replace("<svg ", "<svg data-ie-svg ");
const script = [inline("../kit/iso-kit.mjs", "K"), inline("../kit/ink.mjs", "Ink"), inline("model.mjs", "M"), `const D = ${JSON.stringify(DATA)};`, readFileSync(join(HERE, "live.js"), "utf8")].join("\n");

const CSS = `
.iso{--anatomy-lit:#6b8eff;--anatomy-lit-top:#1d2650;--anatomy-lit-shade:#182045}
.iso[data-theme="light"]{--anatomy-lit:#3553ff;--anatomy-lit-top:#f1f3ff;--anatomy-lit-shade:#e0e5ff}
.iso-ink{background:var(--paper)}
*{box-sizing:border-box}
body{margin:0;color:var(--anatomy-text);font:14px/1.5 ui-sans-serif,system-ui,sans-serif}
.ie{display:grid;grid-template-rows:auto auto minmax(0,1fr) auto auto;height:100svh;min-height:560px;padding:12px 16px;gap:10px}
.ie h1{margin:0;font:600 1.4rem/1.2 var(--anatomy-mono);color:var(--anatomy-strong)}
.ie-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-family:var(--anatomy-mono)}
.ie-btn{min-height:44px;padding:8px 14px;border:1px solid var(--anatomy-mid);background:var(--anatomy-card);color:var(--anatomy-strong);font:inherit;cursor:pointer}
.ie-btn[aria-pressed="true"]{background:var(--anatomy-strong);color:var(--anatomy-page)}
.ie-stage{min-height:0;display:flex;outline:none}
.ie-stage:focus-visible{outline:1px solid var(--anatomy-muted)}
.ie-stage .iso-svg{width:100%;height:100%}
.ie-readouts{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:1px;background:var(--anatomy-faint);border:1px solid var(--anatomy-faint)}
.ie-readouts div{display:grid;gap:2px;padding:8px 10px;background:var(--anatomy-page)}
.ie-readouts span{font:0.7rem var(--anatomy-mono);text-transform:uppercase;color:var(--anatomy-muted)}
.ie-readouts strong{font:500 0.86rem var(--anatomy-mono);color:var(--anatomy-strong);font-variant-numeric:tabular-nums}
.ie-honest{margin:0;color:var(--anatomy-muted);font-size:0.82rem}
[data-hot] .iso-edge{stroke:var(--anatomy-lit)}
[data-hot] .iso-top{fill:var(--anatomy-lit-top)}
[data-hot] .iso-shade{fill:var(--anatomy-lit-shade)}
[data-hot] .iso-face-text{fill:var(--anatomy-lit)}
@media (max-width:640px){.ie{height:auto}.ie-stage .iso-svg{height:auto}.ie-readouts{grid-template-columns:repeat(2,minmax(0,1fr))}}
`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Inside a Cache</title>
<style>${k.ISO_CSS}${ink.INK_CSS}${CSS}</style>
</head>
<body class="iso iso-ink">
<script>
  var asked = /[?&]theme=(light|dark)/.exec(location.search);
  document.body.setAttribute("data-theme", asked ? asked[1] : matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
</script>
<main class="ie">
  <h1>Inside a cache</h1>
  <div class="ie-bar" role="group" aria-label="Machine controls">
    <button type="button" class="ie-btn" data-ie-run aria-pressed="false">Run</button>
    <button type="button" class="ie-btn" data-ie-step>Step</button>
    <button type="button" class="ie-btn" data-ie-break>Break</button>
    <button type="button" class="ie-btn" data-ie-repair>Repair</button>
    <button type="button" class="ie-btn" data-ie-explode aria-pressed="false">Explode</button>
    <button type="button" class="ie-btn" data-ie-reset>Reset</button>
    <label><input type="checkbox" id="ie-cache" checked> Cache</label>
    <button type="button" class="ie-btn" data-ie-theme>Theme</button>
    <label>Wobble <input type="range" id="ie-wobble" min="0" max="6" step="0.1" value="2.4"></label>
    <label><input type="checkbox" id="ie-labels" checked> Labels</label>
  </div>
  <div class="ie-stage" data-ie-stage tabindex="0" role="group" aria-label="Cache machine. Space runs or pauses. Right arrow steps. E explodes. B breaks the cache. R repairs it.">${svg}</div>
  <div class="ie-readouts" aria-label="Live readouts">
    <div><span>Stage</span><strong data-ie-stage-name>ready</strong></div>
    <div><span>Step</span><strong data-ie-steps>0</strong></div>
    <div><span>Cache hits</span><strong data-ie-hits>0</strong></div>
    <div><span>Origin fetches</span><strong data-ie-fetches>0</strong></div>
    <div><span>Simulated time</span><strong data-ie-clock>0 ms</strong></div>
  </div>
  <p class="ie-honest">This is a simulation. Times are fixed costs set by the model, not measurements. <span data-ie-live aria-live="polite"></span></p>
</main>
<script>(() => {
${script.replace(/<\/(script)/gi, "<\\/$1")}
})();</script>
</body>
</html>
`;

writeFileSync(OUT, html);
console.log("wrote", OUT, (html.length / 1024).toFixed(0) + " KB", items.length + " items");
