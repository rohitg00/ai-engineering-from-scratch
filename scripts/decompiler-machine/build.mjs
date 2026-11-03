import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../agent-machine/kit/iso-kit.mjs";
import * as ink from "../agent-machine/kit/ink.mjs";
import * as Gm from "./geometry.mjs";
import * as M from "./model.mjs";
import { CONCEPT, INFO, PART_ORDER, READY_HINT, SCENARIOS } from "./content.mjs";
import { FIXTURE } from "./fixture.mjs";
import * as Ck from "./clock.mjs";
import * as Pt from "./parts.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const OUT = process.argv[2] || join(ROOT, "site", "inside-a-decompiler.html");
const ORIGIN = "https://aiengineeringfromscratch.com";
const SLUG = "inside-a-decompiler";

const exportsOf = (source) => [...source.matchAll(/^export (?:const|function|let) ([A-Za-z_$][\w$]*)/gm)].map((match) => match[1]);
function module(file, name, replace = []) {
  let source = readFileSync(join(HERE, file), "utf8");
  for (const [from, to] of replace) source = source.replace(from, to);
  return `const ${name} = (() => {\n${source.replace(/^export /gm, "")}\nreturn { ${exportsOf(source).join(", ")} };\n})();`;
}

const RIG = Gm.build();
const round = (value) => Math.round(value * 1000) / 1000;

const SOURCES = {
  "ledger-O2": "ledger.c · percent_change · clang -O2 · ledger-x86_64-O2.o",
  "ledger-O0": "ledger.c · percent_change · clang -O0 · ledger-x86_64-O0.o",
  trap: "sweep-trap.s · lookup · hand-written · sweep-trap.o",
};

const items = Gm.items.map((item) => ({ id: item.id, asm: item.asm, key: round(item.key) }));
const body = Gm.items.map((item) => `<g data-i="${item.id}" data-asm="${item.asm}">${item.svg}</g>`).join("");
const LABEL =
  "A decompiler built as a machine on a bench, drawn in isometric view. A carriage rides one straight rail past nine stations in order: a tape reel with a magic gauge for the file header, a section cabinet with a symbol index, a decode bed with a moving cursor for disassembly, a block board with a drop bin for the control-flow graph, a lift press with an IR stack, a board of type pins, a structuring jig with two jaws, a pseudocode printer, and an evidence ledger with four trays.";
const FILTER = ink.wobbleFilter("dm-hand", 1.8);
const svg = k.figureSvg({ width: Gm.W, height: Gm.H, label: LABEL, body: `${FILTER}<g data-layer filter="url(#dm-hand)">${body}</g><g data-pills></g><g data-sfx></g>`, className: "dm-svg" }).replace("<svg ", "<svg data-dm-svg ");

const BREAK_NOTES = [
  "Broke the symbols: the name and the end of the function are unknown.",
  "Broke the decoder: linear sweep at -O0 decodes the padding.",
  "Broke both: no symbols, so the sweep runs to the end of .text.",
  "Data in code: the sweep decodes four data bytes and misses 0x14.",
  "Data in code with descent: the jump skips the data, then the lifter stops.",
];

function selfCheck() {
  const rows = [];
  const check = (what, shown, model) => rows.push({ what, ok: String(shown) === String(model), shown, model });
  for (const program of M.PROGRAMS)
    for (const symbols of [true, false])
      for (const sweep of M.SWEEPS)
        for (const opt of program === "trap" ? ["O2"] : M.OPTS) {
          const config = { program, symbols, sweep, opt };
          const tag = `${M.keyOf(config)} ${symbols ? "named" : "stripped"} ${sweep}`;
          const sim = M.simulate(config);
          const fx = FIXTURE[M.keyOf(config)];
          const header = sim.events.find((ev) => ev.type === "header");
          check(`${tag}: card magic`, "7f 45 4c 46", header.magic);
          check(`${tag}: card E_SHNUM`, fx.header.shnum, (header.trace.match(/(\d+) section headers/) || [])[1]);
          check(`${tag}: drawers`, fx.sections.length, Pt.drawersSvg(fx.sections).match(/data-name=/g).length);
          const { run } = M.decodeOf(config);
          const decode = sim.events.find((ev) => ev.type === "decode");
          check(`${tag}: tiles`, run.insns.length, decode.insns.length);
          const graph = Pt.graphSvg(run).match(/(\d+) BLOCKS? · (\d+) EDGES?/);
          const cfg = sim.events.find((ev) => ev.type === "cfg");
          check(`${tag}: board blocks`, graph[1], cfg.live);
          check(`${tag}: board edges`, graph[2], run.edges.filter((edge) => run.blocks.some((b) => b.live && b.s === edge.f) && run.blocks.some((b) => b.live && b.s === edge.t)).length);
          const slots = Pt.slotList(fx.lift).length;
          check(`${tag}: slots`, slots, fx.lift.error ? 0 : fx.lift.params.length + fx.lift.locals.length + 1);
          const trays = M.tallyOf(sim.events[sim.events.length - 1].ledger);
          check(`${tag}: trays`, Object.values(trays).reduce((a, b) => a + b, 0), sim.ledger.length);
          for (const ev of sim.events) {
            const real = Ck.realOf(config, ev.type);
            if (["ledger", "exit"].includes(ev.type)) check(`${tag}: ${ev.type} has no real time`, real, null);
            else check(`${tag}: ${ev.type} real time`, real && real.seconds > 0, true);
          }
        }
  const bad = rows.filter((row) => !row.ok);
  bad.forEach((row) => console.error("self-check mismatch:", row.what, "shown", row.shown, "model", row.model));
  return { checked: rows.length, bad: bad.length };
}
const SELF = selfCheck();
console.log(`self-check: ${SELF.checked} machine numbers read from the model, ${SELF.bad} disagree`);
if (SELF.bad) process.exit(1);

const DATA = {
  LABELS: Gm.LABELS,
  EXPLODE: Gm.EXPLODE,
  ASSEMBLIES: Gm.ASSEMBLIES,
  SOURCES,
  BREAK_NOTES,
  items,
};

const script = [
  module("../agent-machine/kit/iso-kit.mjs", "K"),
  module("../agent-machine/kit/ink.mjs", "Ink", [['import { iso, segment, slabOf, solidSvg } from "./iso-kit.mjs";', "const { iso, segment, slabOf, solidSvg } = K;"]]),
  module("parts.mjs", "Pt", [['import * as k from "../agent-machine/kit/iso-kit.mjs";', "const k = K;"], ['import * as ink from "../agent-machine/kit/ink.mjs";', "const ink = Ink;"]]),
  module("content.mjs", "C"),
  module("fixture.mjs", "F"),
  module("model.mjs", "M", [['import { FIXTURE } from "./fixture.mjs";', "const { FIXTURE } = F;"]]),
  module("timing.mjs", "Tm"),
  module("clock.mjs", "Ck", [['import { TIMING } from "./timing.mjs";', "const { TIMING } = Tm;"], ['import { keyOf } from "./model.mjs";', "const { keyOf } = M;"]]),
  `const D = ${JSON.stringify(DATA)};`,
  readFileSync(join(HERE, "live.js"), "utf8"),
].join("\n");
const wrapped = `(() => {\n${script}\n})();`;

const escape = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const TITLE = "Inside a Decompiler";
const HOOK = "A decompiler turns bytes into code you can read. Break the machine to see which parts are facts and which are guesses.";
const SUB = "Strip the symbols. Switch the decoder. Watch the ledger.";
const DESCRIPTION = "An interactive machine that decompiles one small function stage by stage: header, sections, disassembly, control flow, lifting, types, structuring and pseudocode, with an evidence ledger of what was observed and what was inferred.";

const parts = PART_ORDER.map((asm, i) => `<button type="button" class="dm-part" data-dm-part="${asm}" aria-pressed="false"><span class="dm-part-n">${String(i + 1).padStart(2, "0")}</span><strong>${escape(CONCEPT[asm])}</strong><span class="dm-part-s">${escape(INFO[asm].name)}</span></button>`).join("");
const flags = (text) => escape(text).replace(/(-O\d)/g, '<span class="dm-nobr">$1</span>');
const scenarios = SCENARIOS.map((item) => `<button type="button" class="dm-scenario" data-dm-scenario='${escape(JSON.stringify(item.config))}'><strong>${flags(item.label)}</strong><span>${flags(item.note)}</span></button>`).join("");

const plate = k.plateHtml({
  fig: "FIG_DEC · interactive simulation",
  title: "Decompiler bench",
  hint: "Click a part · Space runs · → steps",
  readout: "ready",
  body: `<div class="dm-stage" data-dm-stage tabindex="0" role="group" aria-label="Decompiler machine. Space or Enter runs or pauses. Right arrow advances one step. E explodes the machine. B breaks one stage. R repairs it. Click a part to inspect it.">${svg}<span class="dm-badge" data-dm-badge hidden></span><div class="dm-cut" data-dm-cut hidden><p class="dm-cut-t" data-dm-cut-title>Inside</p><div class="dm-cut-row"><code data-dm-cut-cause></code><span class="dm-cut-arrow" aria-hidden="true">→</span><code data-dm-cut-result></code></div></div></div>`,
});

const html = `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${TITLE} - AI Engineering from Scratch</title>
  <link rel="icon" href="/favicon.ico" sizes="48x48">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <meta name="description" content="${escape(DESCRIPTION)}">
  <link rel="canonical" href="${ORIGIN}/${SLUG}.html">
  <meta property="og:title" content="${TITLE} · AI Engineering from Scratch">
  <meta property="og:description" content="${escape(HOOK)}">
  <meta property="og:image" content="${ORIGIN}/og/page/${SLUG}.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${TITLE} - AI Engineering from Scratch">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${ORIGIN}/og/page/${SLUG}.png">
  <meta name="twitter:image:alt" content="${TITLE} - AI Engineering from Scratch">
  <meta property="og:url" content="${ORIGIN}/${SLUG}.html">
  <meta property="og:type" content="website">
  <meta name="twitter:title" content="${TITLE} · AI Engineering from Scratch">
  <meta name="twitter:description" content="${escape(HOOK)}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=VT323&family=Source+Serif+4:ital,opsz,wght@0,8..60,400..700;1,8..60,400..700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="style.css?v=20261015a">
  <script>
    (function () {
      var root = document.documentElement;
      var stored = '';
      try { stored = localStorage.getItem('theme') || ''; } catch (_) {}
      var asked = /[?&]theme=(light|dark)\\b/.exec(location.search);
      root.setAttribute('data-theme', asked ? asked[1] : stored || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
      var poster = /[?&]poster(?:=([a-z0-9]))?\\b/.exec(location.search); if (poster) root.setAttribute('data-poster', poster[1] || '1');
    })();
  </script>
  <style>${k.ISO_CSS}${ink.INK_CSS}${readFileSync(join(HERE, "page.css"), "utf8")}</style>
</head>
<body>
  <a href="#main" class="skip-link">Skip to content</a>
  <header class="site-header">
    <div class="header-inner">
      <a href="index.html" class="logo"><span class="logo-icon" aria-hidden="true"></span> AI / FROM SCRATCH</a>
      <nav class="header-nav">
        <a href="index.html#contents">Contents</a>
        <a href="catalog.html">Catalog</a>
        <a href="roadmap.html">Roadmap</a>
        <a href="glossary.html">Glossary</a>
        <a href="about.html">About</a>
        <a href="https://github.com/rohitg00/ai-engineering-from-scratch" target="_blank" rel="noopener" class="header-github">GitHub <span class="star-count" data-loading="true" aria-label="GitHub stars">…</span></a>
      </nav>
      <button class="theme-toggle" id="themeToggle" aria-label="Toggle theme" type="button"><span class="theme-icon" id="themeIcon">N</span></button>
    </div>
  </header>

  <main id="main" class="dm">
    <div class="dm-screen">
    <section class="dm-hero">
      <p class="dm-eyebrow">FIG_DEC · An interactive simulation</p>
      <div class="dm-hero-row">
        <h1>${TITLE}</h1>
        <p class="dm-hook">${escape(HOOK)} <span class="dm-sub">${escape(SUB)}</span></p>
      </div>
    </section>

    <section class="dm-app" aria-label="The machine">
      <div class="dm-toolbar">
        <div class="dm-group" role="group" aria-labelledby="dm-g-run">
          <span class="dm-group-k" id="dm-g-run">Run</span>
          <button type="button" class="dm-btn dm-btn--primary" data-dm-run aria-pressed="false">Run</button>
          <button type="button" class="dm-btn" data-dm-step>Step</button>
          <button type="button" class="dm-btn dm-btn--break" data-dm-break>Break</button>
          <button type="button" class="dm-btn" data-dm-repair>Repair</button>
          <button type="button" class="dm-btn" data-dm-explode aria-pressed="false">Explode</button>
          <button type="button" class="dm-btn" data-dm-reset>Reset</button>
          <div class="dm-speed" role="group" aria-label="Animation speed">
            <button type="button" data-dm-speed="0.5" aria-pressed="false">½×</button>
            <button type="button" data-dm-speed="1" aria-pressed="true">1×</button>
            <button type="button" data-dm-speed="2" aria-pressed="false">2×</button>
            <button type="button" data-dm-speed="4" aria-pressed="false">4×</button>
          </div>
        </div>
        <div class="dm-group" role="group" aria-labelledby="dm-g-setup">
          <span class="dm-group-k" id="dm-g-setup">Setup</span>
          <label class="dm-select"><span>Program</span>
            <select id="dm-program">
              <option value="ledger">percent_change</option>
              <option value="trap">Data in code</option>
            </select>
          </label>
          <label class="dm-switch"><input type="checkbox" id="dm-symbols" checked><span>Symbols</span></label>
          <label class="dm-select"><span>Decoder</span>
            <select id="dm-sweep">
              <option value="descent">Recursive descent</option>
              <option value="linear">Linear sweep</option>
            </select>
          </label>
          <label class="dm-select"><span>Build</span>
            <select id="dm-opt">
              <option value="O2">-O2</option>
              <option value="O0">-O0</option>
            </select>
          </label>
        </div>
        <div class="dm-group" role="group" aria-labelledby="dm-g-look">
          <span class="dm-group-k" id="dm-g-look">Look</span>
          <label class="dm-range">Wobble <input type="range" id="dm-wobble" min="0" max="6" step="0.1" value="1.8"></label>
          <span class="dm-swatches" role="group" aria-label="Body colour">${["mint", "cobalt", "mustard", "tomato", "blush"].map((name) => `<button type="button" class="dm-sw" data-dm-pal="${name}" aria-label="${name}" aria-pressed="${name === "mint"}"></button>`).join("")}</span>
          <label class="dm-switch"><input type="checkbox" id="dm-labels" checked><span>Labels</span></label>
        </div>
        <p class="dm-sr" data-dm-live aria-live="polite"></p>
      </div>

      <div class="dm-center">
        <div class="dm-work">
          <nav class="dm-steps" aria-label="Steps">
            <div class="dm-mode" role="group" aria-label="Run mode"><button type="button" data-dm-mode="manual" aria-pressed="true">Manual</button><button type="button" data-dm-mode="auto" aria-pressed="false">Auto</button></div>
            <ol class="dm-steplist" data-dm-steplist></ol>
            <a href="#" class="dm-restart" data-dm-restart>Start over</a>
          </nav>
          <div class="dm-figure-col">
            <p class="dm-hint" data-dm-hint aria-live="polite">${escape(READY_HINT)}</p>
            <div class="dm-figure iso iso-ink">${plate}</div>
          </div>
        </div>
        <p class="dm-flash" data-dm-flash aria-live="polite"></p>
        <div class="dm-readouts" aria-label="Live readouts">
          <div class="dm-readout dm-readout--wide"><span>Stage</span><strong data-dm-stage-name>Ready</strong></div>
          <div class="dm-readout"><span>Instructions</span><strong data-dm-decoded>0</strong></div>
          <div class="dm-readout"><span>Blocks</span><strong data-dm-blocks>0</strong></div>
          <div class="dm-readout"><span>Names and types</span><strong data-dm-names>none yet</strong></div>
          <div class="dm-readout"><span>Unknowns</span><strong data-dm-unknowns>0</strong></div>
          <div class="dm-readout"><span>Evidence</span><strong data-dm-evidence>0 observed</strong></div>
          <div class="dm-readout"><span>Steps</span><strong data-dm-steps>0</strong></div>
        </div>
        <p class="dm-idea"><strong>The big idea</strong>A decompiler only ever reads bytes. Every station after the bytes adds a claim, and the ledger keeps what the bytes showed apart from what the machine guessed.</p>
      </div>

      <aside class="dm-right" aria-label="Run details">
        <div class="dm-tabs" role="tablist" aria-label="Details">
          <button type="button" role="tab" id="dm-tab-run" aria-controls="dm-panel-run" aria-selected="true" data-dm-tab="run">Run</button>
          <button type="button" role="tab" id="dm-tab-try" aria-controls="dm-panel-try" aria-selected="false" tabindex="-1" data-dm-tab="try">Try</button>
          <button type="button" role="tab" id="dm-tab-ledger" aria-controls="dm-panel-ledger" aria-selected="false" tabindex="-1" data-dm-tab="ledger">Ledger</button>
          <button type="button" role="tab" id="dm-tab-inspect" aria-controls="dm-panel-inspect" aria-selected="false" tabindex="-1" data-dm-tab="inspect">Inspect</button>
          <button type="button" role="tab" id="dm-tab-trace" aria-controls="dm-panel-trace" aria-selected="false" tabindex="-1" data-dm-tab="trace">Trace</button>
        </div>
        <div class="dm-panel" id="dm-panel-run" role="tabpanel" aria-labelledby="dm-tab-run" data-dm-panel="run">
          <p class="dm-label">Input</p>
          <p class="dm-source" data-dm-source></p>
          <p class="dm-bytes" data-dm-bytes></p>
          <p class="dm-label">Instructions</p>
          <ol class="dm-listing" data-dm-listing></ol>
          <p class="dm-label">Output <span class="dm-status" data-dm-status data-status="idle">waiting</span></p>
          <pre class="dm-output" data-dm-output>No pseudocode yet.</pre>
          <p class="dm-honest">This is a simulation. The page does not run a decompiler in your browser. Every byte, instruction, block, IR line and line of pseudocode on this page was captured from the course lessons' own tools on the fixture objects. The motion is slowed down so you can see it. The speed badge compares each step with the real time of the lesson's Python code for that step, ${escape(Ck.SOURCE.method)} on one machine (${escape(Ck.SOURCE.machine)}); a badge with ≈ shares one timed call with the steps next to it. The 16-byte window on the decoder chip is a common x86 fetch width that this page uses to group the bytes; it is not from the fixture. Self-check at build: ${SELF.checked} numbers on the machine read from the model, ${SELF.bad} disagree.</p>
          <div class="dm-share">
            <button type="button" class="dm-btn" data-dm-share>Copy link to this setup</button>
          </div>
          <a class="dm-btn dm-poster" href="anatomy/${SLUG}-poster.png" download>Download poster</a>
        </div>
        <div class="dm-panel" id="dm-panel-try" role="tabpanel" aria-labelledby="dm-tab-try" data-dm-panel="try" hidden>
          <p class="dm-muted">Try to break it. Each one sets the switches and decompiles the same bytes again.</p>
          <div class="dm-scenarios">${scenarios}</div>
        </div>
        <div class="dm-panel" id="dm-panel-ledger" role="tabpanel" aria-labelledby="dm-tab-ledger" data-dm-panel="ledger" hidden>
          <p class="dm-muted">Each station files its findings. Observed: read from the bytes. Derived: computed from observed facts. Inferred: a claim that no observation states yet. Unknown: a gap that the machine could not close.</p>
          <ol class="dm-ledger" data-dm-ledger></ol>
        </div>
        <div class="dm-panel" id="dm-panel-inspect" role="tabpanel" aria-labelledby="dm-tab-inspect" data-dm-panel="inspect" hidden>
          <div class="dm-parts">${parts}</div>
          <div class="dm-inspect" data-dm-inspect aria-live="polite"><p class="dm-muted">Select a part of the machine, or pick one from the list, to see which stage of a decompiler it does.</p></div>
        </div>
        <div class="dm-panel" id="dm-panel-trace" role="tabpanel" aria-labelledby="dm-tab-trace" data-dm-panel="trace" hidden>
          <p class="dm-muted">One line for each step of the run.</p>
          <ol class="dm-trace" data-dm-trace></ol>
        </div>
      </aside>
    </section>
    </div>

    <section class="dm-why container">
      <h2>What the machine shows</h2>
      <div class="dm-why-grid">
        <p><strong>Every stage feeds the next.</strong> The header gives the sections, the sections give the bytes, the decoder gives the instructions, and the graph gives the shape. A mistake at one station rides on the carriage to every later station.</p>
        <p><strong>Bytes do not say which bytes are code.</strong> Recursive descent follows the jumps. Linear sweep decodes every byte. On the data-in-code program, the sweep reads four data bytes as instructions and misses the real instruction at 0x14.</p>
        <p><strong>Symbols carry names, not meaning.</strong> Strip them and the logic of the function stays the same, but the name, the size and the end become unknowns. The parameter names were never in the file.</p>
        <p><strong>Pseudocode is a claim.</strong> The ledger keeps what the bytes showed apart from what the machine inferred. Lesson 36 proves a candidate equal by running it and rebuilding it.</p>
      </div>
      <div class="dm-cta">
        <p>Build every station from scratch.</p>
        <a class="dm-btn dm-btn--primary" href="/lesson?path=phases%2F13-tools-and-protocols%2F32-program-anatomy-elf-from-scratch">Start with the ELF reader</a>
        <a class="dm-btn" href="manual-reverse-engineering-101.html">Read the RE 101 manual</a>
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <div class="container footer-inner">
      <p>© 2026 · open source · free forever</p>
      <div class="footer-links">
        <a href="https://github.com/rohitg00/ai-engineering-from-scratch" target="_blank" rel="noopener">GitHub</a>
        <a href="about.html">About</a>
        <a href="catalog.html">Catalog</a>
        <a href="glossary.html">Glossary</a>
        <a href="https://github.com/rohitg00/ai-engineering-from-scratch/issues/new/choose" target="_blank" rel="noopener">Report</a>
        <a href="sponsors.html">Sponsor us</a>
      </div>
    </div>
  </footer>
  <script>
    (function () {
      var root = document.documentElement;
      var icon = document.getElementById('themeIcon');
      var sync = function () { if (icon) icon.textContent = root.getAttribute('data-theme') === 'light' ? 'N' : 'D'; };
      sync();
      document.getElementById('themeToggle').addEventListener('click', function () {
        var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        root.setAttribute('data-theme', next);
        try { localStorage.setItem('theme', next); } catch (_) {}
        sync();
      });
    })();
  </script>
  <script src="header.js?v=20261103a" defer></script>
  <script>${wrapped.replace(/<\/(script)/gi, "<\\/$1")}</script>
</body>
</html>
`;

writeFileSync(OUT, html);
console.log("wrote", OUT, (html.length / 1024).toFixed(0) + " KB", Gm.items.length + " items");
