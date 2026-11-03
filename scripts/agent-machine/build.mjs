import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as k from "./kit/iso-kit.mjs";
import * as Gm from "./geometry.mjs";
import { CONCEPT, INFO, PART_ORDER, SCENARIOS, TOUR } from "./content.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const STUDIO = process.argv.includes("--studio");
const OUT = STUDIO ? process.argv[process.argv.indexOf("--studio") + 1] : join(ROOT, "site", "inside-an-ai-agent.html");
if (STUDIO && !OUT) throw new Error("usage: node build.mjs --studio <output.html>");
const ORIGIN = "https://aiengineeringfromscratch.com";

const exportsOf = (source) => [...source.matchAll(/^export (?:const|function|let) ([A-Za-z_$][\w$]*)/gm)].map((match) => match[1]);
function module(file, name) {
  const source = readFileSync(join(HERE, file), "utf8");
  const names = exportsOf(source);
  return `const ${name} = (() => {\n${source.replace(/^export /gm, "")}\nreturn { ${names.join(", ")} };\n})();`;
}

const RIG = Gm.build();
const round = (value) => Math.round(value * 1000) / 1000;
const track = [];
for (let s = 0; s <= Math.ceil(Gm.LOOP); s++) track.push(Gm.trackPoint(s).map((v) => Math.round(v * 100) / 100));

const items = Gm.items.map((item) => ({ id: item.id, asm: item.asm, key: round(item.key) }));
const body = Gm.items.map((item) => `<g data-i="${item.id}" data-asm="${item.asm}">${item.svg}</g>`).join("");
const LABEL =
  "A card-processing machine on a bench, drawn in isometric view. A request card rides a carriage round a loop track past an intake hopper, a memory drum, a filing cabinet with a pick head, a sealed model housing, a tool bay with a schema gauge, a permission bolt and a calculator, a verifier gauge, an exit chute and a trace printer. A runtime controller in the middle of the loop counts steps, turns and simulated time.";
const svg = k.figureSvg({ width: Gm.W, height: Gm.H, label: LABEL, body: `<g data-layer>${body}</g>`, className: "am-svg" }).replace("<svg ", "<svg data-am-svg ");

const DATA = {
  P: Gm.P,
  V: Gm.V.map(round),
  LOOP: round(Gm.LOOP),
  track,
  STOPS: Object.fromEntries(Object.entries(Gm.STOPS).map(([name, s]) => [name, round(s)])),
  RIG: JSON.parse(JSON.stringify(RIG, (key, value) => (typeof value === "number" ? round(value) : value))),
  slots: Array.from({ length: Gm.RACK.slots }, (_, i) => Gm.slotOf(i)),
  TRAY: Gm.TRAY,
  TRACK: Gm.TRACK,
  RACK: Gm.RACK,
  GRIP_HOME: RIG.gripHome,
  GANTRY_Z: RIG.gantryZ,
  EXPLODE: Gm.EXPLODE,
  ASSEMBLIES: Gm.ASSEMBLIES,
  items,
  INFO,
  CONCEPT,
  W: Gm.W,
  H: Gm.H,
  CSS: k.ISO_CSS + readFileSync(join(HERE, "page.css"), "utf8").split("\n").filter((line) => line.startsWith(".am-svg [data-hot]")).join(""),
  TOUR,
};
DATA.STOPS.verifier = round(Gm.STOPS.verifier);

const script = [
  module("kit/iso-kit.mjs", "K"),
  module("model.mjs", "M"),
  `const D = ${JSON.stringify(DATA)};`,
  readFileSync(join(HERE, "live.js"), "utf8"),
  ...(STUDIO ? [readFileSync(join(HERE, "export.js"), "utf8")] : []),
].join("\n");
const wrapped = `(() => {\n${script}\n})();`;

const escape = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const TITLE = "Inside an AI Agent";
const HOOK = "An AI agent is more than an LLM call. Break the machine to see why.";
const SUB = "Run a request. Remove a component. Watch what fails.";
const DESCRIPTION = "An interactive machine that shows how an AI agent turns a request into a grounded, tool-using, verified answer. Switch off retrieval, tools or the verifier and watch the same request fail.";

const kitCss = k.ISO_CSS;
const STUDIO_PANEL = `          <p class="am-label am-label--gap">Download</p>
          <div class="am-export">
            <button type="button" class="am-btn" data-am-export="gif">GIF of this run</button>
            <button type="button" class="am-btn" data-am-export="video">Video of this run</button>
            <button type="button" class="am-btn" data-am-export="tour">Video of the tour</button>
            <button type="button" class="am-btn" data-am-export="png">PNG of this frame</button>
            <a class="am-btn" href="anatomy/inside-an-ai-agent-poster.png" download>Poster</a>
          </div>
          <p class="am-export-status" data-am-export-status aria-live="polite">Exports are made in your browser from the same simulation. Video and GIF use the switches set above.</p>
          <button type="button" class="am-btn" data-am-export-cancel hidden>Cancel export</button>`;
const css = readFileSync(join(HERE, "page.css"), "utf8");

const parts = PART_ORDER.map((asm, i) => `<button type="button" class="am-part" data-am-part="${asm}" aria-pressed="false"><span class="am-part-n">${String(i + 1).padStart(2, "0")}</span><strong>${escape(CONCEPT[asm])}</strong><span class="am-part-s">${escape(INFO[asm].name)}</span></button>`).join("");
const scenarios = SCENARIOS.map((item) => `<button type="button" class="am-scenario" data-am-scenario='${escape(JSON.stringify(item.config))}'><strong>${escape(item.label)}</strong><span>${escape(item.note)}</span></button>`).join("");

const plate = k.plateHtml({
  fig: "FIG_AGT · interactive simulation",
  title: "Request bench",
  hint: "Click a part · Space runs · → steps",
  readout: "ready",
  body: `<div class="am-stage" data-am-stage tabindex="0" role="group" aria-label="Agent machine. Space or Enter runs or pauses. Right arrow advances one step. E explodes the machine. B breaks a dependency. R repairs it. Click a part to inspect it.">${svg}</div>`,
});

const html = `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">${STUDIO ? `\n  <base href="${pathToFileURL(join(ROOT, "site")).href}/">\n  <meta name="robots" content="noindex">` : ""}
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${TITLE} - AI Engineering from Scratch</title>
  <link rel="icon" href="/favicon.ico" sizes="48x48">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <meta name="description" content="${escape(DESCRIPTION)}">
  <link rel="canonical" href="${ORIGIN}/inside-an-ai-agent.html">
  <meta property="og:title" content="${TITLE} · AI Engineering from Scratch">
  <meta property="og:description" content="${escape(HOOK)}">
  <meta property="og:image" content="${ORIGIN}/og/page/inside-an-ai-agent.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${TITLE} - AI Engineering from Scratch">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${ORIGIN}/og/page/inside-an-ai-agent.png">
  <meta name="twitter:image:alt" content="${TITLE} - AI Engineering from Scratch">
  <meta property="og:url" content="${ORIGIN}/inside-an-ai-agent.html">
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
      root.setAttribute('data-theme', stored || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
      var poster = /[?&]poster(?:=([a-z0-9]))?\\b/.exec(location.search); if (poster) root.setAttribute('data-poster', poster[1] || '1');
    })();
  </script>
  <style>${kitCss}${css}</style>
</head>
<body data-am-depth="intro">
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

  <main id="main" class="am">
    <div class="am-screen">
    <section class="am-hero">
      <p class="am-eyebrow">FIG_AGT · An interactive simulation</p>
      <div class="am-hero-row">
        <h1>${TITLE}</h1>
        <p class="am-hook">${escape(HOOK)} <span class="am-sub">${escape(SUB)}</span></p>
      </div>
    </section>

    <section class="am-app" aria-label="The machine">
      <div class="am-toolbar" role="group" aria-label="Machine controls">
        <div class="am-buttons">
          <button type="button" class="am-btn am-btn--primary" data-am-run aria-pressed="false">Run</button>
          <button type="button" class="am-btn" data-am-step>Step</button>
          <button type="button" class="am-btn am-btn--break" data-am-break>Break</button>
          <button type="button" class="am-btn" data-am-repair>Repair</button>
          <button type="button" class="am-btn" data-am-explode aria-pressed="false">Explode</button>
          <button type="button" class="am-btn" data-am-reset>Reset</button>
        </div>
        <div class="am-switches">
          <label class="am-switch"><input type="checkbox" id="am-retrieval" checked><span>Retrieval</span></label>
          <label class="am-switch"><input type="checkbox" id="am-tools" checked><span>Tool access</span></label>
          <label class="am-switch"><input type="checkbox" id="am-verify" checked><span>Verification</span></label>
          <label class="am-select"><span>Tool fault</span>
            <select id="am-fault">
              <option value="none">None</option>
              <option value="timeout-once">Times out once</option>
              <option value="timeout-always">Always times out</option>
              <option value="malformed">Malformed call</option>
            </select>
          </label>
          <div class="am-speed" role="group" aria-label="Animation speed">
            <span>Speed</span>
            <button type="button" data-am-speed="0.5" aria-pressed="false">½×</button>
            <button type="button" data-am-speed="1" aria-pressed="true">1×</button>
            <button type="button" data-am-speed="2" aria-pressed="false">2×</button>
            <button type="button" data-am-speed="4" aria-pressed="false">4×</button>
          </div>
        </div>
        <p class="am-sr" data-am-live aria-live="polite"></p>
      </div>

      <aside class="am-left" aria-label="Scenarios">
        <h2>Try to break it</h2>
        <p class="am-muted">Each one sets the switches and replays the same request.</p>
        <div class="am-scenarios">${scenarios}</div>
        <div class="am-tourbox">
          <button type="button" class="am-btn am-btn--primary" data-am-tour-start>Take the 60-second tour</button>
          <div class="am-tour" data-am-tour hidden>
            <p class="am-label" data-am-tour-n></p>
            <h3 data-am-tour-title></h3>
            <p data-am-tour-text></p>
            <div class="am-tour-nav"><button type="button" class="am-btn" data-am-tour-prev>Back</button><button type="button" class="am-btn am-btn--primary" data-am-tour-next>Next</button></div>
          </div>
        </div>
      </aside>

      <div class="am-center">
        <div class="am-figure iso">${plate}</div>
        <p class="am-flash" data-am-flash aria-live="polite"></p>
        <div class="am-readouts" aria-label="Live readouts">
          <div class="am-readout am-readout--wide"><span>Stage</span><strong data-am-stage-name>Ready</strong></div>
          <div class="am-readout"><span>Evidence</span><strong data-am-evidence>none</strong></div>
          <div class="am-readout"><span>Tool calls</span><strong data-am-calls>0 calls</strong></div>
          <div class="am-readout"><span>Verification</span><strong data-am-verdict>not run yet</strong></div>
          <div class="am-readout"><span>Steps</span><strong data-am-steps>0</strong></div>
          <div class="am-readout"><span>Simulated time</span><strong data-am-clock>0.00 s</strong></div>
        </div>
      </div>

      <aside class="am-right" aria-label="Run details">
        <div class="am-tabs" role="tablist" aria-label="Details">
          <button type="button" role="tab" id="am-tab-run" aria-controls="am-panel-run" aria-selected="true" data-am-tab="run">Run</button>
          <button type="button" role="tab" id="am-tab-inspect" aria-controls="am-panel-inspect" aria-selected="false" tabindex="-1" data-am-tab="inspect">Inspect</button>
          <button type="button" role="tab" id="am-tab-trace" aria-controls="am-panel-trace" aria-selected="false" tabindex="-1" data-am-tab="trace">Trace</button>
        </div>
        <div class="am-panel" id="am-panel-run" role="tabpanel" aria-labelledby="am-tab-run" data-am-panel="run">
          <p class="am-label">Request</p>
          <p class="am-request">Compare our April and May cloud invoices. How much did spending increase?</p>
          <p class="am-label">In context now</p>
          <ul class="am-context" data-am-context><li>empty</li></ul>
          <p class="am-label">Output <span class="am-status" data-am-status data-status="idle">waiting</span></p>
          <p class="am-output" data-am-output>No answer yet.</p>
          <p class="am-truth" data-am-truth></p>
          <p class="am-honest">This is a simulation. The model step is a fixed script that reads the cards on the carriage and picks the next move. No model runs in your browser. The invoices, the arithmetic and every check are real. Times are fixed costs set by the simulation, not measurements.</p>
          <div class="am-share">
            <button type="button" class="am-btn" data-am-share>Copy link to this setup</button>
          </div>
${STUDIO ? STUDIO_PANEL : `          <a class="am-btn am-poster" href="anatomy/inside-an-ai-agent-poster.png" download>Download poster</a>`}
        </div>
        <div class="am-panel" id="am-panel-inspect" role="tabpanel" aria-labelledby="am-tab-inspect" data-am-panel="inspect" hidden>
          <div class="am-depth" role="group" aria-label="Detail level">
            <button type="button" data-am-depth="intro" aria-pressed="true">Beginner</button>
            <button type="button" data-am-depth="deep" aria-pressed="false">Engineer</button>
          </div>
          <div class="am-parts">${parts}</div>
          <div class="am-inspect" data-am-inspect aria-live="polite"><p class="am-muted">Click a part of the machine, or pick one from the list, to see what it stands for in a real agent.</p></div>
        </div>
        <div class="am-panel" id="am-panel-trace" role="tabpanel" aria-labelledby="am-tab-trace" data-am-panel="trace" hidden>
          <p class="am-muted">The printer on the bench writes the same lines on its tape.</p>
          <ol class="am-trace" data-am-trace></ol>
        </div>
      </aside>
    </section>
    </div>

    <section class="am-why container">
      <h2>What the machine shows</h2>
      <div class="am-why-grid">
        <p><strong>The model only proposes.</strong> It reads the cards it is given and prints a slip. It never opens the cabinet or turns the calculator crank. The runtime does that work, and decides whether to do it at all.</p>
        <p><strong>Knowledge comes from three places.</strong> The sealed drum is what the model learned in training. The memory drum is what this system saved about you. The cabinet holds your private documents. Only cards on the carriage reach the model.</p>
        <p><strong>A tool call is untrusted input.</strong> The schema gauge rejects malformed arguments, the permission bolt refuses tools this run must not use, and the timer stops a slow tool from holding the run.</p>
        <p><strong>Checks live outside the model.</strong> The verifier recomputes from the evidence. Turn it off and a wrong answer can leave the machine looking exactly like a right one.</p>
      </div>
      <div class="am-cta">
        <p>Learn to build every part from scratch.</p>
        <a class="am-btn am-btn--primary" href="/lesson?path=phases%2F14-agent-engineering%2F01-the-agent-loop">Start with the agent loop</a>
        <a class="am-btn" href="catalog.html">Browse the full course</a>
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
