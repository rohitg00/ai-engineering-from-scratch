'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SKILLS = path.join(ROOT, 'skills');
const OUT = path.join(__dirname, 'skills.html');
const MARKDOWN = path.join(__dirname, 'skills.md');
const ORIGIN = 'https://aiengineeringfromscratch.com';
const REPO = 'rohitg00/ai-engineering-from-scratch';
const GITHUB = `https://github.com/${REPO}`;
const AGENTS = 'Claude, Cursor, Codex, OpenClaw, Hermes, or any agent that reads SKILL.md';

const GROUPS = [
  {
    id: 'start',
    title: 'Start',
    when: 'Use these once, on your first day with the course.',
    skills: {
      'start-learning': { line: 'Asks about your goals and time, runs the placement quiz, and writes a study plan the other skills follow.', say: ['start learning', 'set up the course'], writes: 'LEARNING.md' },
      'find-your-level': { line: 'A short adaptive quiz that tells you which phase to start in and which lessons you can skip.', say: ['find my level', 'where should I start'], writes: 'Nothing. It prints a starting point.' },
      'course-guide': { line: 'Give it a topic, a question, or an error. It names the lessons that teach it and the next command to run.', say: ['which lesson covers RAG', 'I am stuck on attention'], writes: 'Nothing. It points you to lessons.' },
    },
  },
  {
    id: 'learn',
    title: 'Learn and practise',
    when: 'Use these every session. They read and update your plan.',
    skills: {
      learn: { line: 'Teaches your next lesson section by section in the terminal, asks questions, and records what you finished.', say: ['/learn', 'teach me the next lesson'], writes: 'LEARNING.md' },
      'lesson-screen': { line: 'Opens a screen in your browser next to the terminal. It shows the lesson figure for each step and traces the code with real values. It also builds a figure for your lesson while you learn, from a blueprint to a 3D model. After the quiz, it writes a practice page with a timed drill and spaced review. Without a local browser, it gives you the lesson page instead.', say: ['open the lesson screen', 'build a figure for this lesson'], writes: 'A .lesson-screen folder with each screen it showed' },
      'check-understanding': { line: 'Quizzes you on a phase and tells you which lessons to read again before you move on.', say: ['quiz me on phase 3', 'check my understanding'], writes: 'Nothing. It prints your score and what to review.' },
      'build-project': { line: 'Guides one stage of a course project per session. It gives hints only. You write the code and run the stage grader.', say: ['build a project', 'continue my project'], writes: 'PROJECTS-LEARNING.md' },
    },
  },
  {
    id: 'paths',
    title: 'Focused paths',
    when: 'Use these to study one topic lesson by lesson.',
    skills: {
      'learn-mcp': { line: 'One lesson at a time through the Model Context Protocol path: clients, servers, transports, security, gateways, and conformance.', say: ['teach me MCP', 'continue the MCP path'], writes: 'MCP-LEARNING.md' },
      'learn-agent-skills': { line: 'One lesson at a time through the Agent Skills path: write, find, run, secure, test, package, and port skills.', say: ['teach me agent skills', 'continue the skills path'], writes: 'AGENT-SKILLS-LEARNING.md' },
      'learn-reverse-engineering': { line: 'One lesson at a time through the Reverse Engineering path: read a compiled program you built, decode it, lift it, record evidence, and prove a rebuild equal.', say: ['teach me reverse engineering', 'continue the reverse engineering path'], writes: 'REVERSE-ENGINEERING-LEARNING.md' },
    },
  },
  {
    id: 'certify',
    title: 'Certification prep',
    when: 'Use these to prepare for an exam with lessons, labs, and timed practice.',
    skills: {
      'claude-certification': { line: 'Tutor for the four independent Claude certification tracks: choose a track, learn lesson by lesson, run labs, and take practice exams.', say: ['prepare for the Claude certification', 'resume my certification'], writes: 'CLAUDE-CERTIFICATION.md' },
      'mcpa-certification': { line: 'Tutor for the Model Context Protocol Associate exam: lessons, practical labs, and practice questions with feedback.', say: ['prepare for MCPA', 'MCPA practice exam'], writes: 'MCPA-CERTIFICATION.md' },
    },
  },
  {
    id: 'make',
    title: 'Make figures and manuals',
    when: 'Use these to make figures and manuals that match this site.',
    skills: {
      'course-style': { line: 'Colours for light and dark, fonts, figure labels, and the plain technical English rules. The other skills in this group read it.', say: ['use the course style', 'check this text for plain English'], writes: 'Nothing. Other skills read it.' },
      'blueprint-figure': { line: 'Static SVG figures for lessons, READMEs, and manuals. It has nine figure kinds, colour rules, and checks for label size and overlap.', say: ['draw a figure of the request path', 'make FIG_012 for this lesson'], writes: 'An SVG file' },
      'motion-figure': { line: 'Animated and interactive figures: SVG animations, slider widgets, figures with controls and a computed result, and dither bands like the one at the top of this page.', say: ['animate this concept', 'show how this system works'], writes: 'A lesson figure, a standalone figure, or a dither band' },
      'isometric-explainer': { line: 'An interactive isometric machine that shows a process step by step. A tested state model drives it. Controls let you break a part and see what fails.', say: ['explain how a cache evicts entries as a machine', 'make an isometric explainer for this lesson'], writes: 'A standalone HTML page and its source' },
      'write-manual': { line: 'A long manual about one tool at one pinned version, with sources, a table of contents, offline captures of every listing, figures, and an audit.', say: ['write a manual for this tool', 'start a 101 manual'], writes: 'A manual folder: manual.json, sections, figures, captures' },
    },
  },
];

const LOADER = [
  { say: 'find my level', skill: 'find-your-level', refs: ['references/answer-key.md'] },
  { say: 'teach me MCP', skill: 'learn-mcp', refs: [] },
  { say: 'draw a figure of the request path', skill: 'blueprint-figure', refs: ['references/kinds.md', 'references/grammar.md', 'references/checks.md'] },
  { say: 'write a manual for this tool', skill: 'write-manual', refs: ['references/manual-json.md', 'references/section-template.md', 'references/research-and-sources.md', 'references/prose-rules.md'] },
];

const tokens = (text) => Math.round(Buffer.byteLength(text, 'utf8') / 4);

function description(text) {
  const head = /^---\n([\s\S]*?)\n---/.exec(text)[1].split('\n');
  const start = head.findIndex((line) => /^description:/.test(line));
  if (start < 0) return '';
  const inline = head[start].replace(/^description:\s*/, '');
  if (inline && !/^[>|][-+]?$/.test(inline)) return inline.replace(/^["']|["']$/g, '');
  const lines = [];
  for (let i = start + 1; i < head.length && /^\s+\S/.test(head[i]); i++) lines.push(head[i].trim());
  return lines.join(' ');
}

function loaderData() {
  const order = GROUPS.flatMap((group) => Object.keys(group.skills));
  const skills = order.map((name) => {
    const text = fs.readFileSync(path.join(SKILLS, name, 'SKILL.md'), 'utf8');
    return { name, tokens: tokens(`name: ${name}\ndescription: ${description(text)}`) };
  });
  let full = 0;
  for (const name of order) {
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(file);
        else if (entry.name.endsWith('.md')) full += tokens(fs.readFileSync(file, 'utf8'));
      }
    };
    walk(path.join(SKILLS, name));
  }
  const requests = LOADER.map((ask) => {
    const text = fs.readFileSync(path.join(SKILLS, ask.skill, 'SKILL.md'), 'utf8');
    const body = text.replace(/^---\n[\s\S]*?\n---\n?/, '');
    const files = [{ path: `${ask.skill}/SKILL.md`, tokens: tokens(body) }].concat(ask.refs.map((ref) => ({ path: ref, tokens: tokens(fs.readFileSync(path.join(SKILLS, ask.skill, ref), 'utf8')) })));
    return { say: ask.say, skill: ask.skill, files };
  });
  return { skills, requests, full };
}

function loaderFigure() {
  const data = loaderData();
  const always = data.skills.reduce((sum, skill) => sum + skill.tokens, 0);
  const asks = data.requests.map((ask, i) => `<button type="button" class="sl-ask" data-ask="${i}" aria-pressed="${i === 0}">${escape(ask.say)}</button>`).join('');
  const rows = data.skills.map((skill) => `<li data-skill="${skill.name}"><span>${skill.name}</span><b>${skill.tokens}</b></li>`).join('');
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return `<div class="sk-example sk-example--live"><figure class="sl" data-skill-loader>
            <div class="sl-head"><span>Skill loader · one agent session</span><button type="button" class="sl-replay">Replay</button></div>
            <p class="sl-note">Pick a request. The agent always holds every skill's name and description. It reads a full SKILL.md, then the references it names, only when a request matches.</p>
            <div class="sl-asks" role="group" aria-label="Requests">${asks}</div>
            <div class="sl-pane"><h4><span>Always loaded</span><span>${data.skills.length} descriptions · ${always.toLocaleString('en-US')} tokens</span></h4><ol class="sl-always">${rows}</ol></div>
            <div class="sl-pane"><h4><span>Loaded for this request</span><span data-loaded-total></span></h4><ol class="sl-loaded" data-loaded></ol></div>
            <div class="sl-meter"><p><span>Context used</span><span data-meter-label></span></p><div class="sl-track"><i data-meter></i></div></div>
            <p class="sl-verdict" data-verdict aria-live="polite"></p>
            <script type="application/json" class="sl-data">${json}</script>
          </figure><span>Live: pick a request. Token counts are file bytes divided by 4, read from the real skill files.</span></div>`;
}

const EXAMPLES = {
  'isometric-explainer': () => `<a class="sk-example" href="inside-an-ai-agent.html"><img class="sk-light" src="anatomy/inside-an-ai-agent-machine.png" width="2400" height="1260" loading="lazy" decoding="async" alt="An isometric card-processing machine that shows how an AI agent handles one request."><img class="sk-dark" src="anatomy/inside-an-ai-agent-machine-dark.png" width="2400" height="1260" loading="lazy" decoding="async" alt=""><span>Made with it: Inside an AI Agent →</span></a>`,
  'blueprint-figure': () => {
    const svg = fs.readFileSync(path.join(ROOT, 'manuals', 'a2a-101', 'figures', 'fig-four-parts.svg'), 'utf8').replace(/<\?xml[^>]*>/, '');
    return `<a class="sk-example sk-example--svg" href="manuals.html">${svg}<span>Made with it: a figure from the A2A 101 manual →</span></a>`;
  },
  'motion-figure': loaderFigure,
  'write-manual': () => `<a class="sk-example sk-example--text" href="manuals.html"><strong>Manuals</strong><span>Two manuals are published. Each one covers one pinned version. Read them →</span></a>`,
  'course-style': () => `<div class="sk-example sk-swatches" aria-label="Course colours"><i style="background:var(--bg)"></i><i style="background:var(--bg-surface)"></i><i style="background:var(--ink)"></i><i style="background:var(--blueprint)"></i><i style="background:var(--warn)"></i><span>Paper, surface, ink, blueprint, warning. Both themes.</span></div>`,
};

const escape = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function frontmatter(file) {
  const text = fs.readFileSync(file, 'utf8');
  const match = /^---\n([\s\S]*?)\n---/.exec(text);
  if (!match) throw new Error(`${file}: no frontmatter`);
  const name = /^name:\s*(.+)$/m.exec(match[1]);
  const version = /^version:\s*(.+)$/m.exec(match[1]);
  return { name: name ? name[1].trim() : '', version: version ? version[1].trim() : '' };
}

function loadSkills() {
  const folders = fs.readdirSync(SKILLS).filter((name) => fs.existsSync(path.join(SKILLS, name, 'SKILL.md'))).sort();
  const listed = new Set(GROUPS.flatMap((group) => Object.keys(group.skills)));
  const missing = folders.filter((name) => !listed.has(name));
  const extra = [...listed].filter((name) => !folders.includes(name));
  if (missing.length || extra.length) throw new Error(`skills page out of sync. No card: ${missing.join(', ') || 'none'}. No folder: ${extra.join(', ') || 'none'}`);
  const meta = {};
  for (const name of folders) {
    const fm = frontmatter(path.join(SKILLS, name, 'SKILL.md'));
    if (fm.name !== name) throw new Error(`skills/${name}/SKILL.md: name is "${fm.name}"`);
    meta[name] = fm;
  }
  return meta;
}

function countArtifacts() {
  let skills = 0;
  let prompts = 0;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (path.basename(path.dirname(full)) === 'outputs') {
        if (/^skill-.*\.md$/.test(entry.name)) skills += 1;
        if (/^prompt-.*\.md$/.test(entry.name)) prompts += 1;
      }
    }
  };
  walk(path.join(ROOT, 'phases'));
  return { skills, prompts };
}

function card(name, info, meta) {
  const install = `npx skills add ${REPO} --skill ${name}`;
  const example = EXAMPLES[name] ? EXAMPLES[name]() : '';
  return `<article class="sk-card${example ? ' sk-card--example' : ''}" id="${name}">
          <header><h3><code>/${name}</code></h3><span class="sk-version">v${escape(meta.version || '1.0.0')}</span></header>
          <p class="sk-line">${escape(info.line)}</p>
          <dl>
            <dt>Say</dt><dd>${info.say.map((phrase) => `<q>${escape(phrase)}</q>`).join(' ')}</dd>
            <dt>Writes</dt><dd>${escape(info.writes)}</dd>
          </dl>
          ${example}
          <footer>
            <button type="button" class="sk-copy" data-copy="${escape(install)}" aria-label="Copy the install command for ${name}">Copy install</button>
            <a href="${GITHUB}/blob/main/skills/${name}/SKILL.md" target="_blank" rel="noopener">Read SKILL.md ↗</a>
          </footer>
        </article>`;
}

function build() {
  const meta = loadSkills();
  const total = Object.keys(meta).length;
  const artifacts = countArtifacts();
  const install = `npx skills add ${REPO}`;
  const nav = GROUPS.map((group, i) => `<a href="#${group.id}"><span>${String(i + 1).padStart(2, '0')}</span>${group.title}</a>`).join('') + `<a href="#artifacts"><span>${String(GROUPS.length + 1).padStart(2, '0')}</span>Lesson artifacts</a>`;
  const sections = GROUPS.map((group, i) => `
      <section class="sk-group" id="${group.id}" aria-labelledby="${group.id}-title">
        <div class="sk-group-head">
          <span class="sk-num">${String(i + 1).padStart(2, '0')}</span>
          <div><h2 id="${group.id}-title">${group.title}</h2><p>${group.when}</p></div>
        </div>
        <div class="sk-cards">
        ${Object.entries(group.skills).map(([name, info]) => card(name, info, meta[name])).join('\n        ')}
        </div>
      </section>`).join('');

  const html = `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Skills - AI Engineering from Scratch</title>
  <link rel="icon" href="/favicon.ico" sizes="48x48">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <meta name="description" content="Skills for your coding agent from AI Engineering from Scratch. They start the course, teach lessons, prepare you for certifications, and make figures and manuals.">
  <link rel="canonical" href="${ORIGIN}/skills.html">
  <link rel="alternate" type="text/markdown" href="${ORIGIN}/skills.md">
  <meta property="og:title" content="Skills · AI Engineering from Scratch">
  <meta property="og:description" content="${total} skills for your coding agent: course lessons, level tests, certification prep, and figure and manual tools.">
  <meta property="og:image" content="${ORIGIN}/og/page/skills.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="Skills for your coding agent - AI Engineering from Scratch">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${ORIGIN}/og/page/skills.png">
  <meta name="twitter:image:alt" content="Skills for your coding agent - AI Engineering from Scratch">
  <meta property="og:url" content="${ORIGIN}/skills.html">
  <meta property="og:type" content="website">
  <meta name="twitter:title" content="Skills · AI Engineering from Scratch">
  <meta name="twitter:description" content="${total} skills for your coding agent: course lessons, level tests, certification prep, and figure and manual tools.">
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
    })();
  </script>
  <style>${fs.readFileSync(path.join(ROOT, 'manuals', '_shared', 'tokens.css'), 'utf8')}${fs.readFileSync(path.join(__dirname, 'skills.css'), 'utf8')}</style>
</head>
<body>
  <a href="#main" class="skip-link">Skip to content</a>
  <header class="site-header">
    <div class="header-inner">
      <a href="index.html" class="logo"><span class="logo-icon" aria-hidden="true"></span> AI / FROM SCRATCH</a>
      <nav class="header-nav">
        <a href="index.html#contents">Contents</a>
        <a href="catalog.html">Catalog</a>
        <a href="skills.html">Skills</a>
        <a href="roadmap.html">Roadmap</a>
        <a href="glossary.html">Glossary</a>
        <a href="about.html">About</a>
        <a href="${GITHUB}" target="_blank" rel="noopener" class="header-github">GitHub <span class="star-count" data-loading="true" aria-label="GitHub stars">…</span></a>
      </nav>
      <button class="theme-toggle" id="themeToggle" aria-label="Toggle theme" type="button"><span class="theme-icon" id="themeIcon">N</span></button>
    </div>
  </header>

  <main id="main" class="sk">
    <section class="sk-hero container">
      <div class="dither sk-band" data-seed="skills" data-label="${total} skills · for your agent" aria-hidden="true"></div>
      <p class="sk-eyebrow">FIG_SKL · Skills for your coding agent</p>
      <h1>Skills</h1>
      <p class="sk-lede">A skill is a short instruction file. Your agent reads it when your request matches the skill, then follows its steps. These ${total} skills teach the course, test your level, and make figures and manuals.</p>
      <div class="sk-install">
        <div class="sk-install-bar"><span>Install all ${total}</span><button type="button" class="sk-copy" data-copy="${escape(install)}">Copy</button></div>
        <pre><code>${escape(install)}</code></pre>
        <p>One skill: add <code>--skill &lt;name&gt;</code>. List them first: add <code>--list</code>. Works with ${AGENTS}.</p>
      </div>
      <nav class="sk-index" aria-label="Skill groups">${nav}</nav>
    </section>

    <div class="container">${sections}

      <section class="sk-group" id="artifacts" aria-labelledby="artifacts-title">
        <div class="sk-group-head">
          <span class="sk-num">${String(GROUPS.length + 1).padStart(2, '0')}</span>
          <div><h2 id="artifacts-title">Lesson artifacts</h2><p>Many lessons end with a skill or prompt file. You can install them by phase or by tag.</p></div>
        </div>
        <div class="sk-artifacts">
          <p><strong>${artifacts.skills} skills and ${artifacts.prompts} prompts</strong> live next to the lessons that teach them, under <code>phases/**/outputs/</code>. Clone the repo, then copy the ones you want into your agent's skills folder.</p>
          <pre><code>python3 scripts/install_skills.py ~/.claude/skills --phase 14
python3 scripts/install_skills.py ~/.cursor/skills --tag rag
python3 scripts/install_skills.py .skills --type all --dry-run</code></pre>
          <p><a href="catalog.html">Browse the lessons in the catalog →</a></p>
        </div>
      </section>

      <section class="sk-how" aria-labelledby="how-title">
        <h2 id="how-title">Ask for a figure</h2>
        <p>Tell the skill what the reader must understand and where the figure goes: a lesson, a README, a manual, or a standalone page. Give real numbers when you have them. The figure then computes its result from those numbers.</p>
        <p>Example: <q>Make a figure for the skills lesson that shows how an agent loads a skill. Use the real file sizes.</q></p>
      </section>

      <section class="sk-cta">
        <p>How agents find and load skills</p>
        <a class="sk-btn sk-btn--primary" href="lesson?path=phases%2F13-tools-and-protocols%2F22-skills-and-agent-sdks">Read the lesson</a>
        <a class="sk-btn" href="${GITHUB}/tree/main/skills" target="_blank" rel="noopener">All skills on GitHub ↗</a>
      </section>
    </div>
  </main>

  <footer class="site-footer">
    <div class="container footer-inner">
      <p>© 2026 · open source · free forever</p>
      <div class="footer-links">
        <a href="${GITHUB}" target="_blank" rel="noopener">GitHub</a>
        <a href="about.html">About</a>
        <a href="catalog.html">Catalog</a>
        <a href="skills.html">Skills</a>
        <a href="glossary.html">Glossary</a>
        <a href="${GITHUB}/issues/new/choose" target="_blank" rel="noopener">Report</a>
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
      document.addEventListener('click', function (event) {
        var button = event.target.closest('[data-copy]');
        if (!button) return;
        var done = function () { var label = button.textContent; button.textContent = 'Copied'; setTimeout(function () { button.textContent = label; }, 1400); };
        if (navigator.clipboard) navigator.clipboard.writeText(button.getAttribute('data-copy')).then(done, function () {});
      });
    })();
  </script>
  <script src="header.js?v=20261021a" defer></script>
  <script src="dither.js?v=20261013a" defer></script>
  <script src="skills-demo.js?v=20261013a" defer></script>
</body>
</html>
`;
  fs.writeFileSync(OUT, html);
  fs.writeFileSync(MARKDOWN, markdown(meta, artifacts));
  return { total, artifacts };
}

function markdown(meta, artifacts) {
  const lines = ['# Skills · AI Engineering from Scratch', '', `Canonical page: ${ORIGIN}/skills.html`, '', `Install every skill: \`npx skills add ${REPO}\`. One skill: add \`--skill <name>\`. Works with ${AGENTS}.`, ''];
  GROUPS.forEach((group, i) => {
    lines.push(`## ${String(i + 1).padStart(2, '0')} ${group.title}`, '', group.when, '');
    for (const [name, info] of Object.entries(group.skills)) {
      lines.push(`### ${name} (v${meta[name].version || '1.0.0'})`, '', info.line, '', `- Say: ${info.say.map((phrase) => `"${phrase}"`).join(', ')}`, `- Writes: ${info.writes}`, `- Install: \`npx skills add ${REPO} --skill ${name}\``, `- Source: ${GITHUB}/blob/main/skills/${name}/SKILL.md`, '');
    }
  });
  lines.push(`## ${String(GROUPS.length + 1).padStart(2, '0')} Lesson artifacts`, '', `${artifacts.skills} skills and ${artifacts.prompts} prompts live under \`phases/**/outputs/\`. Install with \`python3 scripts/install_skills.py <target> --phase <n>\` or \`--tag <tag>\`.`, '');
  return lines.join('\n');
}

if (require.main === module) {
  const result = build();
  console.log(`Wrote skills.html and skills.md: ${result.total} skills, ${result.artifacts.skills} lesson skills, ${result.artifacts.prompts} prompts.`);
}

module.exports = { GROUPS, LOADER, build, loadSkills, loaderData };
