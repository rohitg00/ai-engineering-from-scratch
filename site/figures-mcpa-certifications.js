/* figures-mcpa-certifications.js: mechanism figures for the MCPA certification
   curriculum. Loads after lesson-figures.js and registers through window.LF.
   Vanilla ES5, no dependencies. */
(function () {
  'use strict';

  var LF = window.LF;
  if (!LF) return;

  function ensureStyles() {
    if (document.getElementById('mcpa-figure-styles')) return;
    var style = document.createElement('style');
    style.id = 'mcpa-figure-styles';
    style.textContent = [
      '.mf-shell{border:1px solid var(--rule-soft,#ddd);background:var(--bg,#fafaf5);margin:28px 0;font-family:var(--font-body,serif)}',
      '.mf-head{padding:12px 16px;border-bottom:1px solid var(--rule-soft,#ddd);font-family:var(--font-mono,monospace);font-size:.68rem;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-mute,#777)}',
      '.mf-head strong{color:var(--blueprint,#3553ff);font-weight:600}',
      '.mf-body{padding:16px}',
      '.mf-caption{padding:12px 16px;border-top:1px solid var(--rule-soft,#ddd);font-size:.92rem;line-height:1.55;color:var(--ink-soft,#555)}'
    ].join('');
    document.head.appendChild(style);
  }

  function rolesFigure(host) {
    ensureStyles();
    var shell = document.createElement('div');
    shell.className = 'mf-shell';
    shell.innerHTML = [
      '<div class="mf-head"><strong>MCP Fundamentals</strong> host / client / server / tool</div>',
      '<div class="mf-body">',
      '<svg viewBox="0 0 520 200" role="img" aria-label="A user request flows from the host through a client to a server and a tool, and the result flows back">',
      '<style>.mfx{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.mft{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}.mfl{fill:var(--ink-mute,#777);font:9px var(--font-mono,monospace)}.mfa{stroke:var(--blueprint,#3553ff);fill:none;stroke-width:1.5}</style>',
      '<rect class="mfx" x="8" y="70" width="96" height="60"/><text class="mft" x="20" y="95">host</text><text class="mfl" x="20" y="112">the app</text>',
      '<rect class="mfx" x="150" y="70" width="96" height="60"/><text class="mft" x="162" y="95">client</text><text class="mfl" x="162" y="112">one link</text>',
      '<rect class="mfx" x="292" y="70" width="96" height="60"/><text class="mft" x="304" y="95">server</text><text class="mfl" x="304" y="112">exposes</text>',
      '<rect class="mfx" x="434" y="70" width="78" height="60"/><text class="mft" x="446" y="95">tool</text><text class="mfl" x="446" y="112">an action</text>',
      '<path class="mfa" d="M104 92 L150 92" marker-end="url(#mfarrow)"/>',
      '<path class="mfa" d="M246 92 L292 92" marker-end="url(#mfarrow)"/>',
      '<path class="mfa" d="M388 92 L434 92" marker-end="url(#mfarrow)"/>',
      '<path class="mfa" d="M434 118 L104 118" marker-end="url(#mfarrow)"/>',
      '<text class="mfl" x="196" y="150">result flows back across the trust boundary</text>',
      '<defs><marker id="mfarrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="var(--blueprint,#3553ff)"/></marker></defs>',
      '</svg>',
      '</div>',
      '<div class="mf-caption">One protocol connects four roles. A request travels host to client to server to tool; the result returns as untrusted content entering the model context.</div>'
    ].join('');
    host.appendChild(shell);
  }

function blueprintWeightsFigure(host) {
  ensureStyles();

  var domains = [
    { label: 'Fundamentals', weight: 16 },
    { label: 'Architecture', weight: 14 },
    { label: 'Interactions', weight: 26 },
    { label: 'Security', weight: 24 },
    { label: 'Use Cases', weight: 20 }
  ];

  var baseline = 210;
  var barWidth = 70;
  var step = 100;
  var startX = 45;
  var pxPerPercent = 5;

  var bars = '';
  var i, d, x, barHeight, barY, valueY, labelY, centerX;
  for (i = 0; i < domains.length; i += 1) {
    d = domains[i];
    x = startX + i * step;
    centerX = x + barWidth / 2;
    barHeight = d.weight * pxPerPercent;
    barY = baseline - barHeight;
    valueY = barY - 8;
    labelY = baseline + 18;
    bars += '<rect class="mfbar" x="' + x + '" y="' + barY + '" width="' + barWidth + '" height="' + barHeight + '"/>';
    bars += '<text class="mfval" x="' + centerX + '" y="' + valueY + '">' + d.weight + '%</text>';
    bars += '<text class="mflabel" x="' + centerX + '" y="' + labelY + '">' + d.label + '</text>';
  }

  var shell = document.createElement('div');
  shell.className = 'mf-shell';
  shell.innerHTML = [
    '<div class="mf-head"><strong>MCPA Blueprint</strong> five domains weighted by percent of exam content</div>',
    '<div class="mf-body">',
    '<svg viewBox="0 0 560 250" role="img" aria-label="Bar chart of the five MCPA domain weights: MCP Fundamentals 16 percent, Architecture and Components 14 percent, Interactions and Execution 26 percent, Security and Governance 24 percent, Use Cases and Ecosystem 20 percent">',
    '<style>.mfbar{fill:var(--blueprint,#3553ff);opacity:.85}.mfval{fill:var(--ink,#111);font:11px var(--font-mono,monospace);text-anchor:middle}.mflabel{fill:var(--ink-mute,#777);font:9px var(--font-mono,monospace);text-anchor:middle}.mfaxis{stroke:var(--rule-soft,#ccc);stroke-width:1}</style>',
    '<line class="mfaxis" x1="30" y1="210" x2="530" y2="210"/>',
    bars,
    '</svg>',
    '</div>',
    '<div class="mf-caption">Interactions and Execution and Security and Governance together carry half the blueprint. Study hours split evenly across five domains would starve the two tallest bars.</div>'
  ].join('');
  host.appendChild(shell);
}

function processTopologyFigure(host) {
  ensureStyles();
  var shell = document.createElement('div');
  shell.className = 'mf-shell';
  shell.innerHTML = [
    '<div class="mf-head"><strong>Architecture and Components</strong> one host, two clients, two server processes</div>',
    '<div class="mf-body">',
    '<svg viewBox="0 0 560 240" role="img" aria-label="A host process embeds two clients; each client holds one connection to its own separate server process">',
    '<style>.mfx{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.mfb{fill:none;stroke:var(--ink-mute,#999);stroke-dasharray:4 3}.mft{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}.mfl{fill:var(--ink-mute,#777);font:9px var(--font-mono,monospace)}.mfa{stroke:var(--blueprint,#3553ff);fill:none;stroke-width:1.5}</style>',
    '<rect class="mfb" x="8" y="10" width="200" height="220"/><text class="mfl" x="18" y="26">host process boundary</text>',
    '<rect class="mfx" x="26" y="42" width="164" height="64"/><text class="mft" x="38" y="66">client A</text><text class="mfl" x="38" y="84">one connection</text>',
    '<rect class="mfx" x="26" y="148" width="164" height="64"/><text class="mft" x="38" y="172">client B</text><text class="mfl" x="38" y="190">one connection</text>',
    '<rect class="mfb" x="372" y="26" width="180" height="78"/><text class="mfl" x="382" y="42">server process boundary</text>',
    '<rect class="mfx" x="388" y="54" width="148" height="40"/><text class="mft" x="398" y="78">server: files</text>',
    '<rect class="mfb" x="372" y="138" width="180" height="78"/><text class="mfl" x="382" y="154">server process boundary</text>',
    '<rect class="mfx" x="388" y="166" width="148" height="40"/><text class="mft" x="398" y="190">server: search</text>',
    '<path class="mfa" d="M190 74 L372 74" marker-end="url(#mfarrow02)"/>',
    '<path class="mfa" d="M190 180 L372 186" marker-end="url(#mfarrow02)"/>',
    '<text class="mfl" x="210" y="228">each link is a private one-to-one connection</text>',
    '<defs><marker id="mfarrow02" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="var(--blueprint,#3553ff)"/></marker></defs>',
    '</svg>',
    '</div>',
    '<div class="mf-caption">One host process embeds two clients. Each client holds exactly one connection to exactly one server, and each server runs as its own process, often its own trust domain, so a result crossing back is content entering the host from a separate process boundary.</div>'
  ].join('');
  host.appendChild(shell);
}

function schemaShapeFigure(host) {
  ensureStyles();
  var shell = document.createElement('div');
  shell.className = 'mf-shell';
  shell.innerHTML = [
    '<div class="mf-head"><strong>Architecture and Components</strong> tool definition and argument validation</div>',
    '<div class="mf-body">',
    '<svg viewBox="0 0 560 260" role="img" aria-label="A tool definition with a name, description, and inputSchema; an incoming arguments object is checked against the schema and either runs the handler or returns an INVALID_PARAMS error">',
    '<style>.mfx{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.mft{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}.mfl{fill:var(--ink-mute,#777);font:9px var(--font-mono,monospace)}.mfa{stroke:var(--blueprint,#3553ff);fill:none;stroke-width:1.5}.mfok{stroke:#2a8f4f}.mferr{stroke:#b23b3b}</style>',
    '<rect class="mfx" x="8" y="10" width="220" height="150"/>',
    '<text class="mft" x="18" y="30">create_ticket</text>',
    '<text class="mfl" x="18" y="46">tool name + description</text>',
    '<text class="mfl" x="18" y="68">inputSchema.properties</text>',
    '<text class="mfl" x="26" y="84">title: string</text>',
    '<text class="mfl" x="26" y="98">priority: string, enum</text>',
    '<text class="mfl" x="26" y="112">points: integer</text>',
    '<text class="mfl" x="18" y="132">required</text>',
    '<text class="mfl" x="26" y="148">[title, priority]</text>',
    '<rect class="mfx" x="270" y="10" width="150" height="60"/>',
    '<text class="mft" x="280" y="32">arguments</text>',
    '<text class="mfl" x="280" y="48">{title, priority, ...}</text>',
    '<path class="mfa" d="M228 60 L270 40" marker-end="url(#mf03arrow)"/>',
    '<rect class="mfx" x="270" y="100" width="150" height="60"/>',
    '<text class="mft" x="280" y="122">validate</text>',
    '<text class="mfl" x="280" y="138">type + required + enum</text>',
    '<path class="mfa" d="M345 70 L345 100" marker-end="url(#mf03arrow)"/>',
    '<rect class="mfx" x="460" y="30" width="92" height="50"/>',
    '<text class="mft" x="470" y="50">run tool</text>',
    '<text class="mfl" x="470" y="66">result</text>',
    '<path class="mfa mfok" d="M420 115 L460 55" marker-end="url(#mf03arrow)"/>',
    '<rect class="mfx" x="460" y="150" width="92" height="60"/>',
    '<text class="mft" x="470" y="172">-32602</text>',
    '<text class="mfl" x="470" y="188">INVALID_PARAMS</text>',
    '<path class="mfa mferr" d="M420 145 L460 175" marker-end="url(#mf03arrow)"/>',
    '<text class="mfl" x="20" y="240">checked before the handler runs, in both directions</text>',
    '<defs><marker id="mf03arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="var(--blueprint,#3553ff)"/></marker></defs>',
    '</svg>',
    '</div>',
    '<div class="mf-caption">A tool advertises a name, a description, and an inputSchema with typed properties and a required list. An incoming arguments object is checked against that schema before anything runs: a match reaches the handler, a mismatch returns an INVALID_PARAMS error.</div>'
  ].join('');
  host.appendChild(shell);
}

function primitivesFigure(host) {
  ensureStyles();
  var shell = document.createElement('div');
  shell.className = 'mf-shell';
  shell.innerHTML = [
    '<div class="mf-head"><strong>Interactions and Execution</strong> requests, notifications, and the three primitives</div>',
    '<div class="mf-body">',
    '<svg viewBox="0 0 560 246" role="img" aria-label="A request carries an id and receives a response keyed to it. A notification carries no id and receives nothing back, ever. A server exposes three primitive families: tools, resources, and prompts.">',
    '<style>.mfx{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.mft{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}.mfl{fill:var(--ink-mute,#777);font:9px var(--font-mono,monospace)}.mfa{stroke:var(--blueprint,#3553ff);fill:none;stroke-width:1.5}.mfd{stroke:var(--ink-mute,#999);fill:none;stroke-width:1.5;stroke-dasharray:3,3}</style>',
    '<text class="mfl" x="8" y="16">a request carries an id</text>',
    '<rect class="mfx" x="8" y="22" width="86" height="56"/><text class="mft" x="20" y="54">client</text>',
    '<rect class="mfx" x="220" y="22" width="86" height="56"/><text class="mft" x="232" y="54">server</text>',
    '<path class="mfa" d="M94 40 L220 40" marker-end="url(#mfarrow)"/><text class="mfl" x="100" y="36">request, id 7</text>',
    '<path class="mfa" d="M220 62 L94 62" marker-end="url(#mfarrow)"/><text class="mfl" x="96" y="76">response, id 7</text>',
    '<text class="mfl" x="8" y="100">a notification carries none</text>',
    '<rect class="mfx" x="8" y="106" width="86" height="56"/><text class="mft" x="20" y="138">client</text>',
    '<rect class="mfx" x="220" y="106" width="86" height="56"/><text class="mft" x="232" y="138">server</text>',
    '<path class="mfa" d="M94 124 L220 124" marker-end="url(#mfarrow)"/><text class="mfl" x="88" y="120">notification, no id</text>',
    '<path class="mfd" d="M220 146 L160 146"/><text class="mft" x="146" y="150">x</text><text class="mfl" x="316" y="150">no response, ever</text>',
    '<text class="mfl" x="8" y="186">a server exposes three primitive families</text>',
    '<rect class="mfx" x="8" y="192" width="170" height="48"/><text class="mft" x="18" y="212">tool</text><text class="mfl" x="18" y="228">the model calls it</text>',
    '<rect class="mfx" x="195" y="192" width="170" height="48"/><text class="mft" x="205" y="212">resource</text><text class="mfl" x="205" y="228">the host attaches it</text>',
    '<rect class="mfx" x="382" y="192" width="170" height="48"/><text class="mft" x="392" y="212">prompt</text><text class="mfl" x="392" y="228">the user picks it</text>',
    '<defs><marker id="mfarrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="var(--blueprint,#3553ff)"/></marker></defs>',
    '</svg>',
    '</div>',
    '<div class="mf-caption">The id field is the whole difference: a request carries one and gets back a response keyed to it; a notification carries none and gets nothing back, ever, even when its method is unknown. A server\'s capabilities split into three addressable families: tools the model calls, resources the host attaches, and prompts the user picks.</div>'
  ].join('');
  host.appendChild(shell);
}

function lifecycleFigure(host) {
  ensureStyles();
  var shell = document.createElement('div');
  shell.className = 'mf-shell';
  shell.innerHTML = [
    '<div class="mf-head"><strong>Interactions and Execution</strong> tool invocation lifecycle</div>',
    '<div class="mf-body">',
    '<svg viewBox="0 0 640 250" role="img" aria-label="A tools/call request moves through received, parsed, validated, and executed before a result, with a branch to a JSON-RPC error at each of the last three checkpoints">',
    '<style>.mfx{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.mfe{fill:var(--bg-surface,#eee);stroke:var(--ink-mute,#999)}.mft{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}.mfl{fill:var(--ink-mute,#777);font:9px var(--font-mono,monospace)}.mfa{stroke:var(--blueprint,#3553ff);fill:none;stroke-width:1.5}.mfb{stroke:var(--ink-mute,#999);fill:none;stroke-width:1.2;stroke-dasharray:4 3}</style>',
    '<rect class="mfx" x="8" y="18" width="92" height="56"/><text class="mft" x="18" y="42">received</text><text class="mfl" x="18" y="60">raw payload</text>',
    '<rect class="mfx" x="132" y="18" width="92" height="56"/><text class="mft" x="142" y="42">parsed</text><text class="mfl" x="142" y="60">JSON + envelope</text>',
    '<rect class="mfx" x="254" y="18" width="108" height="56"/><text class="mft" x="264" y="42">validated</text><text class="mfl" x="264" y="60">method + schema</text>',
    '<rect class="mfx" x="394" y="18" width="92" height="56"/><text class="mft" x="404" y="42">executed</text><text class="mfl" x="404" y="60">handler runs</text>',
    '<rect class="mfx" x="518" y="18" width="100" height="56"/><text class="mft" x="528" y="42">result</text><text class="mfl" x="528" y="60">keyed to id</text>',
    '<path class="mfa" d="M100 46 L132 46" marker-end="url(#mfarrow05)"/>',
    '<path class="mfa" d="M224 46 L254 46" marker-end="url(#mfarrow05)"/>',
    '<path class="mfa" d="M362 46 L394 46" marker-end="url(#mfarrow05)"/>',
    '<path class="mfa" d="M486 46 L518 46" marker-end="url(#mfarrow05)"/>',
    '<rect class="mfe" x="96" y="152" width="164" height="50"/><text class="mft" x="104" y="172">-32700 / -32600</text><text class="mfl" x="104" y="190">parse / invalid request</text>',
    '<rect class="mfe" x="226" y="152" width="176" height="50"/><text class="mft" x="234" y="172">-32601 / -32602</text><text class="mfl" x="234" y="190">not found / bad params</text>',
    '<rect class="mfe" x="368" y="152" width="140" height="50"/><text class="mft" x="376" y="172">-32603</text><text class="mfl" x="376" y="190">internal error</text>',
    '<path class="mfb" d="M178 74 L178 152" marker-end="url(#mfarrow05)"/>',
    '<path class="mfb" d="M308 74 L314 152" marker-end="url(#mfarrow05)"/>',
    '<path class="mfb" d="M440 74 L438 152" marker-end="url(#mfarrow05)"/>',
    '<defs><marker id="mfarrow05" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="var(--blueprint,#3553ff)"/></marker></defs>',
    '</svg>',
    '</div>',
    '<div class="mf-caption">A tools/call request moves left to right through four checkpoints. A dashed branch at parsed, validated, or executed peels a failing call off toward one of the five JSON-RPC error codes instead of a result, always keyed to the original request id.</div>'
  ].join('');
  host.appendChild(shell);
}

function trustBoundaryFigure(host) {
  ensureStyles();
  var shell = document.createElement('div');
  shell.className = 'mf-shell';
  shell.innerHTML = [
    '<div class="mf-head"><strong>Trust Boundaries and Consent</strong> host/client trusted, server/tool untrusted</div>',
    '<div class="mf-body">',
    '<svg viewBox="0 0 560 230" role="img" aria-label="The host and client sit inside a trusted zone on the left. The server and tool sit in an untrusted zone on the right. A consent gate sits on the boundary for side-effecting calls. Results return marked as untrusted content.">',
    '<style>.tbx{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.tbt{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}.tbl{fill:var(--ink-mute,#777);font:9px var(--font-mono,monospace)}.tba{stroke:var(--blueprint,#3553ff);fill:none;stroke-width:1.5}.tbr{stroke:var(--blueprint,#3553ff);fill:none;stroke-width:1.5;stroke-dasharray:4,3}.tbz{stroke:var(--rule-soft,#ccc);stroke-dasharray:3,3}.tbg{fill:var(--bg-surface,#eee);stroke:var(--blueprint,#3553ff);stroke-width:2}</style>',
    '<text class="tbl" x="14" y="18">trusted zone</text>',
    '<text class="tbl" x="392" y="18" text-anchor="middle">untrusted zone</text>',
    '<line class="tbz" x1="278" y1="26" x2="278" y2="192"/>',
    '<text class="tbl" x="284" y="40">trust boundary</text>',
    '<rect class="tbx" x="14" y="80" width="100" height="60"/><text class="tbt" x="26" y="104">host</text><text class="tbl" x="26" y="122">the app</text>',
    '<rect class="tbx" x="150" y="80" width="100" height="60"/><text class="tbt" x="162" y="104">client</text><text class="tbl" x="162" y="122">one link</text>',
    '<rect class="tbx" x="306" y="80" width="100" height="60"/><text class="tbt" x="318" y="104">server</text><text class="tbl" x="318" y="122">third party</text>',
    '<rect class="tbx" x="442" y="80" width="104" height="60"/><text class="tbt" x="454" y="104">tool</text><text class="tbl" x="454" y="122">an action</text>',
    '<path class="tba" d="M114 110 L150 110" marker-end="url(#tbarrow)"/>',
    '<path class="tba" d="M406 110 L442 110" marker-end="url(#tbarrow)"/>',
    '<path class="tba" d="M250 100 L306 100" marker-end="url(#tbarrow)"/>',
    '<path class="tbr" d="M306 120 L250 120" marker-end="url(#tbarrowr)"/>',
    '<polygon class="tbg" points="278,87 291,100 278,113 265,100"/>',
    '<text class="tbl" x="278" y="72" text-anchor="middle">consent gate</text>',
    '<text class="tbl" x="278" y="155" text-anchor="middle">side-effecting calls must pass the gate; results return untrusted</text>',
    '<defs>',
    '<marker id="tbarrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="var(--blueprint,#3553ff)"/></marker>',
    '<marker id="tbarrowr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="var(--blueprint,#3553ff)"/></marker>',
    '</defs>',
    '</svg>',
    '</div>',
    '<div class="mf-caption">The host and its client are inside the user\'s trust domain; the server and its tools are not. A side-effecting call must clear a consent gate scoped to that one tool before it runs. A read-only call may cross without one. Every result that returns is untrusted content entering the model\'s context, not a message the host already vetted.</div>'
  ].join('');
  host.appendChild(shell);
}

function auditTrailFigure(host) {
  ensureStyles();
  var shell = document.createElement('div');
  shell.className = 'mf-shell';
  shell.innerHTML = [
    '<div class="mf-head"><strong>Risk Controls and Auditability</strong> append-only log, hash chain, redaction</div>',
    '<div class="mf-body">',
    '<svg viewBox="0 0 560 210" role="img" aria-label="Four audit log entries in a row, each linking to the previous one by a hash, with a sensitive field redacted before entry 1 is hashed, and new entries only ever appended on the right">',
    '<style>.atf-box{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.atf-boxnew{fill:var(--bg-surface,#eee);stroke:var(--blueprint,#3553ff);stroke-dasharray:3,2}.atf-t{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}.atf-l{fill:var(--ink-mute,#777);font:9px var(--font-mono,monospace)}.atf-link{stroke:var(--blueprint,#3553ff);fill:none;stroke-width:1.5}.atf-redact{fill:var(--bg,#fafaf5);stroke:var(--ink-mute,#999);stroke-dasharray:2,2}.atf-strike{fill:var(--ink-mute,#777);font:9px var(--font-mono,monospace);text-decoration:line-through}</style>',
    '<rect class="atf-box" x="8" y="56" width="124" height="64"/><text class="atf-t" x="18" y="78">entry 0</text><text class="atf-l" x="18" y="93">tool: lookup_order</text><text class="atf-l" x="18" y="108">hash: 7c2f9a..</text>',
    '<rect class="atf-box" x="146" y="56" width="124" height="64"/><text class="atf-t" x="156" y="78">entry 1</text><text class="atf-l" x="156" y="93">tool: reset_password</text><text class="atf-l" x="156" y="108">hash: 3ea01d..</text>',
    '<rect class="atf-box" x="284" y="56" width="124" height="64"/><text class="atf-t" x="294" y="78">entry 2</text><text class="atf-l" x="294" y="93">tool: lookup_order</text><text class="atf-l" x="294" y="108">hash: b64c22..</text>',
    '<rect class="atf-boxnew" x="422" y="56" width="124" height="64"/><text class="atf-t" x="432" y="78">entry 3</text><text class="atf-l" x="432" y="93">new entries</text><text class="atf-l" x="432" y="108">append only</text>',
    '<path class="atf-link" d="M132 88 L146 88" marker-end="url(#atfarrow)"/>',
    '<path class="atf-link" d="M270 88 L284 88" marker-end="url(#atfarrow)"/>',
    '<path class="atf-link" d="M408 88 L422 88" marker-end="url(#atfarrow)"/>',
    '<text class="atf-l" x="180" y="46">hash = previous hash + this entry content</text>',
    '<rect class="atf-redact" x="146" y="140" width="124" height="46"/><text class="atf-strike" x="156" y="156">new_password</text><text class="atf-l" x="156" y="171">-&gt; ***REDACTED***</text><path class="atf-link" d="M195 140 L195 120" marker-end="url(#atfarrow)"/>',
    '<text class="atf-l" x="140" y="200">redacted before the entry is written or hashed</text>',
    '<defs><marker id="atfarrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="var(--blueprint,#3553ff)"/></marker></defs>',
    '</svg>',
    '</div>',
    '<div class="mf-caption">An append-only log: entries are only ever added on the right, never edited or removed. Each entry hash covers the previous entry hash plus its own content, so an edited past entry breaks the chain one step later. A flagged field, like a new password, is redacted before the entry is ever written or hashed.</div>'
  ].join('');
  host.appendChild(shell);
}

function portabilityFigure(host) {
  ensureStyles();
  var shell = document.createElement('div');
  shell.className = 'mf-shell';
  shell.innerHTML = [
    '<div class="mf-head"><strong>Use Cases and Ecosystem</strong> one server, two hosts</div>',
    '<div class="mf-body">',
    '<svg viewBox="0 0 560 220" role="img" aria-label="Host A and host B each call the same unmodified server and receive the same result payload, but render it differently">',
    '<style>.mfx{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.mft{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}.mfl{fill:var(--ink-mute,#777);font:9px var(--font-mono,monospace)}.mfa{stroke:var(--blueprint,#3553ff);fill:none;stroke-width:1.5}</style>',
    '<rect class="mfx" x="8" y="80" width="112" height="60"/><text class="mft" x="20" y="105">host A</text><text class="mfl" x="20" y="122">chat ui</text>',
    '<rect class="mfx" x="224" y="80" width="112" height="60"/><text class="mft" x="236" y="105">server</text><text class="mfl" x="236" y="122">one process</text>',
    '<rect class="mfx" x="440" y="80" width="112" height="60"/><text class="mft" x="452" y="105">host B</text><text class="mfl" x="452" y="122">sidebar ui</text>',
    '<path class="mfa" d="M120 96 L224 96" marker-end="url(#pfarrow)"/>',
    '<path class="mfa" d="M224 122 L120 122" marker-end="url(#pfarrow)"/>',
    '<path class="mfa" d="M440 96 L336 96" marker-end="url(#pfarrow)"/>',
    '<path class="mfa" d="M336 122 L440 122" marker-end="url(#pfarrow)"/>',
    '<text class="mfl" x="20" y="150">renders: chat bubble</text>',
    '<text class="mfl" x="236" y="150">same tools, same payload</text>',
    '<text class="mfl" x="452" y="150">renders: sidebar panel</text>',
    '<defs><marker id="pfarrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="var(--blueprint,#3553ff)"/></marker></defs>',
    '</svg>',
    '</div>',
    '<div class="mf-caption">Host A and host B are different applications with different presentation, but each embeds a client that speaks the same protocol to the same server. Discovery and tool calls return the identical payload; only the rendering differs.</div>'
  ].join('');
  host.appendChild(shell);
}

function capstoneFlowFigure(host) {
  ensureStyles();
  var shell = document.createElement('div');
  shell.className = 'mf-shell';
  shell.innerHTML = [
    '<div class="mf-head"><strong>MCPA Capstone</strong> one exchange, every domain</div>',
    '<div class="mf-body">',
    '<svg viewBox="0 0 730 200" role="img" aria-label="A tool call flows through six stages: handshake, discovery, schema validation, a consent gate, audited execution, and a result that crosses back into the host">',
    '<style>.mfx{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.mft{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}.mfl{fill:var(--ink-mute,#777);font:9px var(--font-mono,monospace)}.mfa{stroke:var(--blueprint,#3553ff);fill:none;stroke-width:1.5}</style>',
    '<rect class="mfx" x="10" y="60" width="100" height="60"/><text class="mft" x="22" y="85">handshake</text><text class="mfl" x="22" y="102">initialize</text>',
    '<rect class="mfx" x="130" y="60" width="100" height="60"/><text class="mft" x="142" y="85">discovery</text><text class="mfl" x="142" y="102">tools/list</text>',
    '<rect class="mfx" x="250" y="60" width="100" height="60"/><text class="mft" x="262" y="85">validate</text><text class="mfl" x="262" y="102">schema check</text>',
    '<rect class="mfx" x="370" y="60" width="100" height="60"/><text class="mft" x="382" y="85">consent</text><text class="mfl" x="382" y="102">required</text>',
    '<rect class="mfx" x="490" y="60" width="100" height="60"/><text class="mft" x="502" y="85">execute</text><text class="mfl" x="502" y="102">+ audit log</text>',
    '<rect class="mfx" x="610" y="60" width="100" height="60"/><text class="mft" x="622" y="85">result</text><text class="mfl" x="622" y="102">crosses back</text>',
    '<path class="mfa" d="M110 90 L130 90" marker-end="url(#mfarrow09)"/>',
    '<path class="mfa" d="M230 90 L250 90" marker-end="url(#mfarrow09)"/>',
    '<path class="mfa" d="M350 90 L370 90" marker-end="url(#mfarrow09)"/>',
    '<path class="mfa" d="M470 90 L490 90" marker-end="url(#mfarrow09)"/>',
    '<path class="mfa" d="M590 90 L610 90" marker-end="url(#mfarrow09)"/>',
    '<path class="mfa" d="M660 120 L660 168 L60 168 L60 120" marker-end="url(#mfarrow09)"/>',
    '<text class="mfl" x="175" y="188">result re-enters the host across the trust boundary</text>',
    '<defs><marker id="mfarrow09" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="var(--blueprint,#3553ff)"/></marker></defs>',
    '</svg>',
    '</div>',
    '<div class="mf-caption">Six stages, one exchange: initialize negotiates the version, discovery lists what a client may call, a schema check rejects a malformed call before it runs, a consent gate stops an unapproved side effect, execution is written to an append-only audit log, and the result re-enters the host across the trust boundary.</div>'
  ].join('');
  host.appendChild(shell);
}

  LF.register({
    'mcpa-01-mcp-roles': rolesFigure,
    'mcpa-00-blueprint-weights': blueprintWeightsFigure,
    'mcpa-02-process-topology': processTopologyFigure,
    'mcpa-03-schema-shape': schemaShapeFigure,
    'mcpa-04-primitives': primitivesFigure,
    'mcpa-05-lifecycle': lifecycleFigure,
    'mcpa-06-trust-boundary': trustBoundaryFigure,
    'mcpa-07-audit-trail': auditTrailFigure,
    'mcpa-08-portability': portabilityFigure,
    'mcpa-09-capstone-flow': capstoneFlowFigure
  });
})();
