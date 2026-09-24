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
      '<style>.mfbar{fill:var(--blueprint,#3553ff);opacity:.85}.mfval{fill:var(--ink,#111);font:11px var(--font-mono,monospace);text-anchor:middle}.mflabel{fill:var(--ink-mute,#777);font:11px var(--font-mono,monospace);text-anchor:middle}.mfaxis{stroke:var(--rule-soft,#ccc);stroke-width:1}</style>',
      '<line class="mfaxis" x1="30" y1="210" x2="530" y2="210"/>',
      bars,
      '</svg>',
      '</div>',
      '<div class="mf-caption">Interactions and Execution and Security and Governance together carry half the blueprint. Study hours split evenly across five domains would starve the two tallest bars.</div>'
    ].join('');
    host.appendChild(shell);
  }

  function specMapFigure(host) {
    ensureStyles();
    var must = ['Base Protocol', 'Versioning', 'Message Patterns'];
    var may = ['Authorization', 'Server Features', 'Client Features', 'Utilities'];
    var mustW = 150, mustGap = 10, mustStartX = 45, mustY = 66, mustH = 26;
    var mayW = 125, mayGap = 8, mayStartX = 18, mayY = 138, mayH = 26;
    var rootX = 200, rootY = 12, rootW = 160, rootH = 32;
    var rootCx = rootX + rootW / 2;
    var nodes = [];
    var lines = [];
    var i;
    var x;
    for (i = 0; i < must.length; i++) {
      x = mustStartX + i * (mustW + mustGap);
      nodes.push('<rect class="l01m" x="' + x + '" y="' + mustY + '" width="' + mustW + '" height="' + mustH + '" rx="3"/>');
      nodes.push('<text class="l01mt" x="' + (x + mustW / 2) + '" y="' + (mustY + 17) + '" text-anchor="middle">' + must[i] + '</text>');
      lines.push('<line class="l01l" x1="' + rootCx + '" y1="' + (rootY + rootH) + '" x2="' + (x + mustW / 2) + '" y2="' + mustY + '"/>');
    }
    for (i = 0; i < may.length; i++) {
      x = mayStartX + i * (mayW + mayGap);
      nodes.push('<rect class="l01y" x="' + x + '" y="' + mayY + '" width="' + mayW + '" height="' + mayH + '" rx="3"/>');
      nodes.push('<text class="l01yt" x="' + (x + mayW / 2) + '" y="' + (mayY + 17) + '" text-anchor="middle">' + may[i] + '</text>');
      lines.push('<line class="l01l" x1="' + rootCx + '" y1="' + (rootY + rootH) + '" x2="' + (x + mayW / 2) + '" y2="' + mayY + '"/>');
    }
    var chips = ['Active', 'Deprecated', 'Removed'];
    var chipW = 110, chipGap = 40, chipStartX = 75, chipY = 210, chipH = 26;
    var chipNodes = [];
    var arrowLines = [];
    for (i = 0; i < chips.length; i++) {
      x = chipStartX + i * (chipW + chipGap);
      chipNodes.push('<rect class="l01c" x="' + x + '" y="' + chipY + '" width="' + chipW + '" height="' + chipH + '" rx="13"/>');
      chipNodes.push('<text class="l01ct" x="' + (x + chipW / 2) + '" y="' + (chipY + 17) + '" text-anchor="middle">' + chips[i] + '</text>');
      if (i > 0) {
        arrowLines.push('<line class="l01a" marker-end="url(#l01arrow)" x1="' + (chipStartX + (i - 1) * (chipW + chipGap) + chipW) + '" y1="' + (chipY + chipH / 2) + '" x2="' + (x - 4) + '" y2="' + (chipY + chipH / 2) + '"/>');
      }
    }
    var shell = document.createElement('div');
    shell.className = 'mf-shell';
    shell.innerHTML = [
      '<div class="mf-head"><strong>Reading the Specification</strong> what every implementation MUST support, what it MAY add, and how a feature ages</div>',
      '<div class="mf-body">',
      '<svg viewBox="0 0 560 300" role="img" aria-label="A map of the MCP specification: a root node for the 2026-07-28 Current revision branches to three MUST-support components, base protocol, versioning, and message patterns, and four MAY components, authorization, server features, client features, and utilities. Below, three chips show a feature moving from Active to Deprecated to Removed, a lifecycle independent of the revision.">',
      '<style>.l01r{fill:var(--bg-surface,#eee);stroke:var(--blueprint,#3553ff);stroke-width:1.4}.l01rt{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}.l01m{fill:var(--blueprint,#3553ff);fill-opacity:.14;stroke:var(--blueprint,#3553ff);stroke-width:1.2}.l01mt{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}.l01y{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc);stroke-width:1}.l01yt{fill:var(--ink-mute,#666);font:11px var(--font-mono,monospace)}.l01l{stroke:var(--ink-mute,#999);stroke-width:.7;opacity:.65}.l01c{fill:var(--bg-surface,#eee);stroke:var(--ink-soft,#888);stroke-width:1}.l01ct{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}.l01a{stroke:var(--blueprint,#3553ff);stroke-width:1.4}.l01cap{fill:var(--ink-mute,#777);font:11px var(--font-mono,monospace)}</style>',
      '<marker id="l01arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--blueprint,#3553ff)"/></marker>',
      '<rect class="l01r" x="' + rootX + '" y="' + rootY + '" width="' + rootW + '" height="' + rootH + '" rx="4"/>',
      '<text class="l01rt" x="' + rootCx + '" y="' + (rootY + 14) + '" text-anchor="middle">Specification</text>',
      '<text class="l01rt" x="' + rootCx + '" y="' + (rootY + 27) + '" text-anchor="middle">2026-07-28, Current</text>',
      lines.join(''),
      nodes.join(''),
      '<text class="l01cap" x="' + mustStartX + '" y="' + (mustY - 6) + '">MUST support</text>',
      '<text class="l01cap" x="' + mayStartX + '" y="' + (mayY - 6) + '">MAY support</text>',
      chipNodes.join(''),
      arrowLines.join(''),
      '<text class="l01cap" x="75" y="' + (chipY + chipH + 18) + '">feature lifecycle, independent of the revision state</text>',
      '</svg>',
      '</div>',
      '<div class="mf-caption">Every implementation MUST support the base protocol, versioning, and message patterns. Authorization, server features, client features, and utilities are added as needed. A feature also carries its own Active, Deprecated, or Removed state, tracked separately from whether the document itself is Draft, Current, or Final.</div>'
    ].join('');
    host.appendChild(shell);
  }

  function nByMFigure(host) {
    ensureStyles();
    var apps = ['chat', 'editor', 'agent', 'portal'];
    var systems = ['files', 'tickets', 'crm', 'docs', 'db', 'ci'];
    var left = [];
    var right = [];
    var i;
    var j;
    for (i = 0; i < apps.length; i++) {
      for (j = 0; j < systems.length; j++) {
        left.push('<line class="nbl" x1="92" y1="' + (46 + i * 44) + '" x2="208" y2="' + (30 + j * 30) + '"/>');
      }
    }
    for (i = 0; i < apps.length; i++) {
      left.push('<rect class="nbx" x="16" y="' + (34 + i * 44) + '" width="76" height="24"/><text class="nbt" x="24" y="' + (50 + i * 44) + '">' + apps[i] + '</text>');
      right.push('<rect class="nbx" x="300" y="' + (34 + i * 44) + '" width="76" height="24"/><text class="nbt" x="308" y="' + (50 + i * 44) + '">' + apps[i] + '</text>');
      right.push('<line class="nba" x1="376" y1="' + (46 + i * 44) + '" x2="420" y2="120"/>');
    }
    for (j = 0; j < systems.length; j++) {
      left.push('<rect class="nbx" x="208" y="' + (18 + j * 30) + '" width="60" height="22"/><text class="nbt" x="214" y="' + (33 + j * 30) + '">' + systems[j] + '</text>');
      right.push('<rect class="nbx" x="486" y="' + (18 + j * 30) + '" width="60" height="22"/><text class="nbt" x="492" y="' + (33 + j * 30) + '">' + systems[j] + '</text>');
      right.push('<line class="nba" x1="440" y1="120" x2="486" y2="' + (29 + j * 30) + '"/>');
    }
    var shell = document.createElement('div');
    shell.className = 'mf-shell';
    shell.innerHTML = [
      '<div class="mf-head"><strong>The Integration Problem</strong> 24 custom links versus 10 protocol implementations</div>',
      '<div class="mf-body">',
      '<svg viewBox="0 0 560 230" role="img" aria-label="Left: four applications wired to six systems with twenty-four links. Right: the same applications and systems each connect once to one shared protocol, ten connections.">',
      '<style>.nbx{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.nbt{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}.nbl{stroke:var(--ink-mute,#999);stroke-width:.6;opacity:.7}.nba{stroke:var(--blueprint,#3553ff);stroke-width:1.4}.nbp{fill:var(--blueprint,#3553ff)}.nbc{fill:var(--ink-mute,#777);font:11px var(--font-mono,monospace)}</style>',
      left.join(''),
      right.join(''),
      '<rect class="nbp" x="420" y="100" width="20" height="40" rx="3"/>',
      '<text class="nbc" x="96" y="222">N x M = 24 integrations</text>',
      '<text class="nbc" x="358" y="222">N + M = 10 implementations</text>',
      '</svg>',
      '</div>',
      '<div class="mf-caption">Bespoke glue grows with every application-system pair. With one protocol, each application implements a client once and each system implements a server once, and any client can discover any server at runtime.</div>'
    ].join('');
    host.appendChild(shell);
  }

  function envelopeFigure(host) {
    ensureStyles();
    var shapes = [
      { title: 'request', l1: 'id required', l2: 'not null' },
      { title: 'notification', l1: 'no id field', l2: 'no reply sent' },
      { title: 'result', l1: 'id matches call', l2: 'has resultType' },
      { title: 'error', l1: 'id if readable', l2: 'code + message' }
    ];
    var cardW = 120;
    var gap = 12;
    var startX = 18;
    var cards = '';
    var i;
    var x;
    for (i = 0; i < shapes.length; i++) {
      x = startX + i * (cardW + gap);
      cards += '<rect class="l03x" x="' + x + '" y="22" width="' + cardW + '" height="70" rx="4"/>';
      cards += '<text class="l03h" x="' + (x + 8) + '" y="40">' + shapes[i].title + '</text>';
      cards += '<text class="l03t" x="' + (x + 8) + '" y="60">' + shapes[i].l1 + '</text>';
      cards += '<text class="l03t" x="' + (x + 8) + '" y="80">' + shapes[i].l2 + '</text>';
    }

    function seg(text, x0, cls, y) {
      var w = text.length * 7.2;
      return { markup: '<text class="' + cls + '" x="' + x0 + '" y="' + y + '">' + text + '</text>', next: x0 + w, width: w, x0: x0 };
    }

    var a1 = seg('io.', 18, 'l03p', 136);
    var a2 = seg('modelcontextprotocol', a1.next, 'l03chk', 136);
    var a3 = seg('/protocolVersion', a2.next, 'l03p', 136);
    var reservedHighlight = '<rect class="l03hl" x="' + (a2.x0 - 3) + '" y="124" width="' + (a2.width + 6) + '" height="16"/>';

    var b1 = seg('com.', 18, 'l03p', 182);
    var b2 = seg('example', b1.next, 'l03chk', 182);
    var b3 = seg('.mcp/scanId', b2.next, 'l03p', 182);
    var freeHighlight = '<rect class="l03hf" x="' + (b2.x0 - 3) + '" y="170" width="' + (b2.width + 6) + '" height="16"/>';

    var shell = document.createElement('div');
    shell.className = 'mf-shell';
    shell.innerHTML = [
      '<div class="mf-head"><strong>The JSON-RPC Envelope</strong> four message shapes and the _meta key anatomy</div>',
      '<div class="mf-body">',
      '<svg viewBox="0 0 560 220" role="img" aria-label="Top row: four message shape cards, request, notification, result, and error, each with the field that defines it. Bottom: two _meta keys split into prefix labels and a name, with the second label highlighted. io dot modelcontextprotocol is reserved because its second label is modelcontextprotocol. com dot example dot mcp is not reserved because its second label is example.">',
      '<style>.l03x{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.l03h{fill:var(--ink,#111);font:bold 11px var(--font-mono,monospace)}.l03t{fill:var(--ink-mute,#777);font:11px var(--font-mono,monospace)}.l03p{fill:var(--ink-soft,#555);font:12px var(--font-mono,monospace)}.l03chk{fill:var(--ink,#111);font:bold 12px var(--font-mono,monospace)}.l03hl{fill:var(--blueprint,#3553ff);opacity:.22}.l03hf{fill:var(--rule-soft,#ccc);opacity:.6}.l03cap{fill:var(--ink-mute,#777);font:11px var(--font-mono,monospace)}</style>',
      '<text class="l03h" x="18" y="14">four message shapes share one envelope</text>',
      cards,
      '<text class="l03h" x="18" y="112">is a _meta key reserved for MCP?</text>',
      reservedHighlight,
      a1.markup, a2.markup, a3.markup,
      '<text class="l03cap" x="18" y="154">second label is modelcontextprotocol: reserved</text>',
      freeHighlight,
      b1.markup, b2.markup, b3.markup,
      '<text class="l03cap" x="18" y="200">second label is example, not mcp: not reserved</text>',
      '</svg>',
      '</div>',
      '<div class="mf-caption">A request always carries a non-null id, a notification never carries one, and a result or error echoes the id it answers. A _meta key is reserved for MCP only when its second dot-separated label is modelcontextprotocol or mcp, wherever mcp itself might also appear.</div>'
    ].join('');
    host.appendChild(shell);
  }

  function statelessRequestsFigure(host) {
    ensureStyles();
    var shell = document.createElement('div');
    shell.className = 'mf-shell';
    shell.innerHTML = [
      '<div class="mf-head"><strong>The Stateless Core</strong> any replica answers, because state lives off the process</div>',
      '<div class="mf-body">',
      '<svg viewBox="0 0 560 230" role="img" aria-label="Two clients, alice and bob, send requests through a round robin router to two interchangeable server replicas, A and B. Both replicas read and write the same shared handle store, so whichever replica gets the next request answers it correctly.">',
      '<defs><marker id="l04arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" class="l04p"/></marker></defs>',
      '<style>.l04x{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.l04s{fill:var(--bg,#fff);stroke:var(--blueprint,#3553ff);stroke-dasharray:3,2}.l04t{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}.l04l{stroke:var(--ink-soft,#aaa);stroke-width:1;opacity:.85}.l04a{stroke:var(--blueprint,#3553ff);stroke-width:1.4}.l04p{fill:var(--blueprint,#3553ff)}.l04c{fill:var(--ink-mute,#777);font:11px var(--font-mono,monospace)}</style>',
      '<rect class="l04x" x="14" y="26" width="76" height="26"/><text class="l04t" x="22" y="43">alice</text>',
      '<rect class="l04x" x="14" y="140" width="76" height="26"/><text class="l04t" x="22" y="157">bob</text>',
      '<rect class="l04x" x="150" y="80" width="100" height="40"/><text class="l04t" x="158" y="97">router</text><text class="l04t" x="158" y="112">round robin</text>',
      '<rect class="l04x" x="300" y="14" width="100" height="30"/><text class="l04t" x="308" y="33">replica A</text>',
      '<rect class="l04x" x="300" y="156" width="100" height="30"/><text class="l04t" x="308" y="175">replica B</text>',
      '<rect class="l04s" x="452" y="60" width="96" height="80"/><text class="l04t" x="460" y="95">shared</text><text class="l04t" x="460" y="113">store</text>',
      '<line class="l04l" x1="90" y1="39" x2="148" y2="90" marker-end="url(#l04arrow)"/>',
      '<line class="l04l" x1="90" y1="153" x2="148" y2="110" marker-end="url(#l04arrow)"/>',
      '<line class="l04a" x1="250" y1="90" x2="298" y2="29" marker-end="url(#l04arrow)"/>',
      '<line class="l04a" x1="250" y1="110" x2="298" y2="171" marker-end="url(#l04arrow)"/>',
      '<line class="l04a" x1="400" y1="29" x2="450" y2="80" marker-end="url(#l04arrow)"/>',
      '<line class="l04a" x1="400" y1="171" x2="450" y2="120" marker-end="url(#l04arrow)"/>',
      '<text class="l04c" x="14" y="222">same handle, either replica</text>',
      '<text class="l04c" x="300" y="222">state lives in the store</text>',
      '</svg>',
      '</div>',
      '<div class="mf-caption">Alice\'s and bob\'s requests are routed round robin, with no stickiness to either replica. Neither replica keeps basket state in memory; both read and write the same shared store keyed by the opaque handle a tool call returned, so whichever replica answers the next request answers it correctly.</div>'
    ].join('');
    host.appendChild(shell);
  }

  function eraMatrixFigure(host) {
    ensureStyles();
    var mid = [
      ['DiscoverResult', 95],
      ['-32022 (recognized)', 280],
      ['other error / timeout', 465]
    ];
    var out = [
      ['Modern: use it', 95],
      ['Modern: retry version', 280],
      ['Legacy: use initialize', 465]
    ];
    var svg = [];
    svg.push('<defs><marker id="l05arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path class="l05p" d="M0,0 L6,3 L0,6 Z"/></marker></defs>');
    svg.push('<rect class="l05x" x="190" y="10" width="180" height="30" rx="4"/>');
    svg.push('<text class="l05t" x="207" y="29">server/discover probe</text>');
    var i;
    for (i = 0; i < mid.length; i++) {
      var cx = mid[i][1];
      svg.push('<line class="l05a" marker-end="url(#l05arrow)" x1="280" y1="40" x2="' + cx + '" y2="78"/>');
      svg.push('<rect class="l05x" x="' + (cx - 85) + '" y="80" width="170" height="28" rx="4"/>');
      svg.push('<text class="l05t" x="' + (cx - 77) + '" y="98">' + mid[i][0] + '</text>');
      svg.push('<line class="l05a" marker-end="url(#l05arrow)" x1="' + cx + '" y1="108" x2="' + cx + '" y2="148"/>');
      svg.push('<rect class="l05o" x="' + (cx - 85) + '" y="150" width="170" height="28" rx="4"/>');
      svg.push('<text class="l05t" x="' + (cx - 77) + '" y="168">' + out[i][0] + '</text>');
    }
    svg.push('<text class="l05c" x="92" y="200">Era is a property of the server: cache the decision per process (stdio) or origin (HTTP).</text>');
    var shell = document.createElement('div');
    shell.className = 'mf-shell';
    shell.innerHTML = [
      '<div class="mf-head"><strong>Protocol Era Probe</strong> one server/discover probe, three outcomes, no handshake required to ask</div>',
      '<div class="mf-body">',
      '<svg viewBox="0 0 560 210" role="img" aria-label="A server/discover probe fans out to three outcomes: a DiscoverResult means the server is modern, a recognized -32022 UnsupportedProtocolVersion error means modern with a different version to retry, and any other error or a timeout means legacy, falling back to the initialize handshake.">',
      '<style>.l05x{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.l05o{fill:var(--bg-surface,#eee);stroke:var(--blueprint,#3553ff);stroke-width:1.2}.l05t{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}.l05a{stroke:var(--ink-mute,#999);stroke-width:1}.l05p{fill:var(--ink-mute,#999)}.l05c{fill:var(--ink-soft,#777);font:11px var(--font-mono,monospace)}</style>',
      svg.join(''),
      '</svg>',
      '</div>',
      '<div class="mf-caption">The same probe sorts every stdio server into modern, modern with a different version, or legacy. A recognized modern error never falls back; only an unrecognized error or a timeout does.</div>'
    ].join('');
    host.appendChild(shell);
  }

  function topologyFigure(host) {
    ensureStyles();
    var rows = [
      { id: 'files', label: 'client: files', s1: 'server: files', s2: 'local . stdio . tools', s3: 'reports: "primary"', y: 32 },
      { id: 'notes', label: 'client: notes', s1: 'server: notes', s2: 'local . stdio . tools', s3: 'reports: "primary"', y: 104 },
      { id: 'metrics', label: 'client: metrics', s1: 'server: metrics', s2: 'remote . http . resources', s3: 'reports: "metrics-svc"', y: 176 }
    ];
    var parts = [];
    var i;
    for (i = 0; i < rows.length; i++) {
      var r = rows[i];
      var cy = r.y + 27;
      parts.push('<rect class="l06x" x="22" y="' + r.y + '" width="160" height="54" rx="3"/>');
      parts.push('<text class="l06t" x="32" y="' + (r.y + 32) + '">' + r.label + '</text>');
      parts.push('<line class="l06a" x1="182" y1="' + cy + '" x2="350" y2="' + cy + '" marker-end="url(#l06arrow)"/>');
      parts.push('<rect class="l06x" x="350" y="' + r.y + '" width="200" height="54" rx="3"/>');
      parts.push('<text class="l06t" x="360" y="' + (r.y + 18) + '">' + r.s1 + '</text>');
      parts.push('<text class="l06s" x="360" y="' + (r.y + 32) + '">' + r.s2 + '</text>');
      parts.push('<text class="l06s" x="360" y="' + (r.y + 46) + '">' + r.s3 + '</text>');
    }
    var shell = document.createElement('div');
    shell.className = 'mf-shell';
    shell.innerHTML = [
      '<div class="mf-head"><strong>Hosts, Clients, and Servers</strong> one client per server, one registry behind the host</div>',
      '<div class="mf-body">',
      '<svg viewBox="0 0 560 330" role="img" aria-label="One host embeds three clients, each bound to one server. Files and notes run locally over stdio and both self-report the name primary. Metrics runs remotely over Streamable HTTP. The registry keeps search for files and prefixes the colliding notes tool as notes slash search.">',
      '<style>.l06h{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.l06x{fill:var(--bg,#fafaf5);stroke:var(--rule-soft,#ccc)}.l06t{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}.l06s{fill:var(--ink-mute,#777);font:11px var(--font-mono,monospace)}.l06a{stroke:var(--blueprint,#3553ff);stroke-width:1.4}.l06c{fill:var(--ink-soft,#555);font:11px var(--font-mono,monospace)}.l06l{fill:var(--ink-mute,#777);font:11px var(--font-mono,monospace);text-transform:uppercase;letter-spacing:.08em}</style>',
      '<rect class="l06h" x="6" y="6" width="190" height="248" rx="4"/>',
      '<text class="l06l" x="16" y="22">host process</text>',
      parts.join(''),
      '<text class="l06c" x="20" y="282">registry keys are host-assigned ids, never serverInfo.name</text>',
      '<text class="l06c" x="20" y="300">search -&gt; files (first to declare the name keeps it)</text>',
      '<text class="l06c" x="20" y="316">notes/search -&gt; notes (the collision gets a server-id prefix)</text>',
      '<defs><marker id="l06arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="var(--blueprint,#3553ff)"/></marker></defs>',
      '</svg>',
      '</div>',
      '<div class="mf-caption">The host embeds one client per server. Files and notes are local stdio subprocesses that both self-report the name "primary", so the host keys its registry on the connection id it assigned, files and notes, never on that self-reported name. Metrics is a remote Streamable HTTP server with no tools capability, so its tools are never listed. Both files and notes declare a tool named search; the aggregator keeps the first as the canonical name and exposes the second as notes/search.</div>'
    ].join('');
    host.appendChild(shell);
  }

  function discoverCapabilityFigure(host) {
    ensureStyles();
    var shell = document.createElement('div');
    shell.className = 'mf-shell';
    var svg = [
      '<svg viewBox="0 0 560 210" role="img" aria-label="Top lane: a client calls server/discover once, optionally, and gets back supported versions, capabilities, instructions, and cache hints. Bottom lane: every tools/call still declares its own client capabilities in that request; without elicitation declared the server returns -32021, and with it declared the call completes.">',
      '<style>',
      '.l07x{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}',
      '.l07t{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}',
      '.l07h{fill:var(--ink,#111);font:12px var(--font-mono,monospace);font-weight:700}',
      '.l07lbl{fill:var(--ink-soft,#555);font:11px var(--font-mono,monospace)}',
      '.l07ok{stroke:var(--blueprint,#3553ff);stroke-width:1.6;fill:none}',
      '.l07no{stroke:var(--ink-mute,#888);stroke-width:1.4;fill:none;stroke-dasharray:4 3}',
      '</style>',
      '<marker id="l07arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--blueprint,#3553ff)"/></marker>',
      '<marker id="l07arrowmute" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--ink-mute,#888)"/></marker>',
      '<text class="l07h" x="16" y="24">discover: optional, once</text>',
      '<rect class="l07x" x="16" y="34" width="84" height="24"/><text class="l07t" x="26" y="50">client</text>',
      '<rect class="l07x" x="460" y="34" width="84" height="24"/><text class="l07t" x="470" y="50">server</text>',
      '<line class="l07ok" x1="100" y1="46" x2="460" y2="46" marker-end="url(#l07arrow)"/>',
      '<text class="l07lbl" x="280" y="38" text-anchor="middle">server/discover</text>',
      '<text class="l07lbl" x="280" y="60" text-anchor="middle">supportedVersions + capabilities + ttlMs</text>',
      '<text class="l07h" x="16" y="100">every tools/call: declare capabilities again</text>',
      '<rect class="l07x" x="16" y="112" width="84" height="24"/><text class="l07t" x="26" y="128">client</text>',
      '<rect class="l07x" x="460" y="112" width="84" height="24"/><text class="l07t" x="470" y="128">server</text>',
      '<line class="l07no" x1="100" y1="124" x2="460" y2="124" marker-end="url(#l07arrowmute)"/>',
      '<text class="l07lbl" x="280" y="116" text-anchor="middle">clientCapabilities: {}</text>',
      '<text class="l07lbl" x="280" y="138" text-anchor="middle">-32021 missing elicitation</text>',
      '<rect class="l07x" x="16" y="160" width="84" height="24"/><text class="l07t" x="26" y="176">client</text>',
      '<rect class="l07x" x="460" y="160" width="84" height="24"/><text class="l07t" x="470" y="176">server</text>',
      '<line class="l07ok" x1="100" y1="172" x2="460" y2="172" marker-end="url(#l07arrow)"/>',
      '<text class="l07lbl" x="280" y="164" text-anchor="middle">clientCapabilities: {elicitation:{form:{}}}</text>',
      '<text class="l07lbl" x="280" y="186" text-anchor="middle">result: complete</text>',
      '</svg>'
    ].join('');
    shell.innerHTML = [
      '<div class="mf-head"><strong>Discovery and Capability Negotiation</strong> discover once; declare capabilities on every call</div>',
      '<div class="mf-body">',
      svg,
      '</div>',
      '<div class="mf-caption">server/discover is optional and cacheable, a one-time summary of what a server can do. Every tools/call still carries its own clientCapabilities in _meta, checked fresh: missing elicitation gets -32021 naming it, declaring it lets the call complete.</div>'
    ].join('');
    host.appendChild(shell);
  }

  function schemaContractFigure(host) {
    ensureStyles();
    var shell = document.createElement('div');
    shell.className = 'mf-shell';
    shell.innerHTML = [
      '<div class="mf-head"><strong>The Schema Contract</strong> one gate, two ways out</div>',
      '<div class="mf-body">',
      '<svg viewBox="0 0 560 260" role="img" aria-label="A tool definition with inputSchema and outputSchema. Arguments enter a validate gate. A schema failure returns a result with isError true. A pass runs the handler and returns structuredContent plus a text mirror conforming to outputSchema. A tool name the server never advertised takes a separate path to a protocol error, -32602, off to the side of the gate.">',
      '<style>',
      '.l08x{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}',
      '.l08t{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}',
      '.l08m{fill:var(--ink-mute,#777);font:11px var(--font-mono,monospace)}',
      '.l08l{stroke:var(--ink-mute,#999);stroke-width:1.1;fill:none;marker-end:url(#l08arrow)}',
      '.l08g{fill:var(--bg-surface,#f4f4f4);stroke:var(--blueprint,#3553ff);stroke-width:1.4}',
      '.l08ok{fill:var(--bg-surface,#eee);stroke:var(--blueprint,#3553ff);stroke-width:1.2}',
      '.l08err{fill:var(--bg-surface,#eee);stroke:var(--ink-mute,#999);stroke-width:1.2;stroke-dasharray:3,2}',
      '</style>',
      '<defs><marker id="l08arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="var(--ink-mute,#999)"/></marker></defs>',

      '<rect class="l08x" x="16" y="14" width="190" height="64" rx="3"/>',
      '<text class="l08t" x="24" y="30">tool: lookup_product</text>',
      '<text class="l08m" x="24" y="44">inputSchema: sku required</text>',
      '<text class="l08m" x="24" y="58">outputSchema: 4 fields</text>',
      '<text class="l08m" x="24" y="72">extra properties: refused</text>',

      '<rect class="l08x" x="16" y="92" width="190" height="32" rx="3"/>',
      '<text class="l08t" x="24" y="113">arguments: {"sku": "X"}</text>',

      '<path class="l08l" d="M111,78 L111,90"/>',
      '<path class="l08l" d="M111,124 L111,148"/>',

      '<rect class="l08g" x="51" y="150" width="120" height="32" rx="4"/>',
      '<text class="l08t" x="71" y="171">validate()</text>',

      '<path class="l08l" d="M81,182 L81,196"/>',
      '<rect class="l08err" x="14" y="198" width="192" height="30" rx="4"/>',
      '<text class="l08t" x="22" y="218">result isError: true</text>',

      '<path class="l08l" d="M171,166 L328,166"/>',

      '<rect class="l08x" x="330" y="14" width="212" height="46" rx="3"/>',
      '<text class="l08t" x="340" y="30">name: "delete_catalog"</text>',
      '<text class="l08m" x="340" y="44">not in tools/list</text>',

      '<path class="l08l" d="M436,60 L436,74"/>',
      '<rect class="l08err" x="330" y="76" width="212" height="32" rx="4"/>',
      '<text class="l08t" x="344" y="97">error -32602 Invalid params</text>',

      '<rect class="l08ok" x="330" y="150" width="212" height="32" rx="4"/>',
      '<text class="l08t" x="344" y="171">handler(arguments)</text>',

      '<path class="l08l" d="M436,182 L436,196"/>',
      '<rect class="l08ok" x="330" y="198" width="212" height="48" rx="4"/>',
      '<text class="l08t" x="344" y="216">structuredContent: {...}</text>',
      '<text class="l08m" x="344" y="230">content[0].text: same JSON</text>',

      '</svg>',
      '</div>',
      '<div class="mf-caption">A schema failure inside a known tool comes back as a normal result with isError true, content the model can read and correct. A tool name the server never advertised comes back as a JSON-RPC protocol error instead, on a separate path that never reaches the handler.</div>'
    ].join('');
    host.appendChild(shell);
  }

  function manifestAnatomyFigure(host) {
    ensureStyles();
    var panels = [
      {
        title: 'server/discover',
        x: 8,
        rows: [
          { t: 'capabilities', f: false },
          { t: 'instructions', f: true },
          { t: 'cacheScope, ttlMs', f: false }
        ]
      },
      {
        title: 'tools/list',
        x: 196,
        rows: [
          { t: 'annotations: none', f: true },
          { t: 'x-mcp-header', f: true },
          { t: 'cacheScope: public', f: true }
        ]
      },
      {
        title: 'server.json',
        x: 384,
        rows: [
          { t: 'name: acme-tools', f: true },
          { t: 'packages: npm', f: false },
          { t: 'remotes: http', f: false }
        ]
      }
    ];
    var panelWidth = 168;
    var headerHeight = 26;
    var rowHeight = 34;
    var bodyTop = 30;
    var parts = [];
    var i;
    var j;
    for (i = 0; i < panels.length; i++) {
      var panel = panels[i];
      var bodyHeight = headerHeight + panel.rows.length * rowHeight + 10;
      parts.push('<rect class="l09p" x="' + panel.x + '" y="' + bodyTop + '" width="' + panelWidth + '" height="' + bodyHeight + '" rx="4"/>');
      parts.push('<rect class="l09h" x="' + panel.x + '" y="' + bodyTop + '" width="' + panelWidth + '" height="' + headerHeight + '" rx="4"/>');
      parts.push('<text class="l09ht" x="' + (panel.x + 9) + '" y="' + (bodyTop + 17) + '">' + panel.title + '</text>');
      for (j = 0; j < panel.rows.length; j++) {
        var row = panel.rows[j];
        var rowY = bodyTop + headerHeight + 14 + j * rowHeight;
        var markerClass = row.f ? 'l09f' : 'l09k';
        parts.push('<circle class="' + markerClass + '" cx="' + (panel.x + 13) + '" cy="' + rowY + '" r="6"/>');
        if (row.f) {
          parts.push('<text class="l09m" x="' + (panel.x + 13) + '" y="' + (rowY + 4) + '">!</text>');
        }
        parts.push('<text class="l09t" x="' + (panel.x + 26) + '" y="' + (rowY + 4) + '">' + row.t + '</text>');
      }
    }
    var shell = document.createElement('div');
    shell.className = 'mf-shell';
    shell.innerHTML = [
      '<div class="mf-head"><strong>Manifest Anatomy</strong> three documents, read before the first call</div>',
      '<div class="mf-body">',
      '<svg viewBox="0 0 560 200" role="img" aria-label="Three panels: a server/discover result with capabilities and instructions, a tools/list result with a tool\'s annotations and x-mcp-header, and a registry server.json with its namespaced name. Flagged fields mark what a reviewer checks first: steering instructions, a tool with no annotations, a header exposing a secret-looking parameter, and a name with no namespace.">',
      '<style>.l09p{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.l09h{fill:none;stroke:var(--rule-soft,#ccc)}.l09ht{fill:var(--ink,#111);font:bold 11px var(--font-mono,monospace)}.l09t{fill:var(--ink-mute,#555);font:11px var(--font-mono,monospace)}.l09k{fill:var(--blueprint,#3553ff)}.l09f{fill:#c94a34}.l09m{fill:#fff;font:bold 9px var(--font-mono,monospace);text-anchor:middle}.l09c{fill:var(--ink-soft,#777);font:11px var(--font-mono,monospace)}</style>',
      parts.join(''),
      '<text class="l09c" x="8" y="188">circle marks a field; the exclamation is one a reviewer should not skip</text>',
      '</svg>',
      '</div>',
      '<div class="mf-caption">A manifest is three documents: what a server claims to support, what it currently offers, and how the registry names it. Marked fields, steering instructions, a tool with no annotations, a header exposing a secret-looking parameter, and a namespace-free name, are the ones a reviewer checks before the first real call.</div>'
    ].join('');
    host.appendChild(shell);
  }

  function modelInteractionFlowFigure(host) {
    ensureStyles();
    var parts = [];
    parts.push('<rect class="l10x" x="6" y="26" width="90" height="44" rx="4"/><text class="l10t" x="14" y="53">user asks</text>');
    parts.push('<rect class="l10x" x="104" y="26" width="116" height="44" rx="4"/><text class="l10t" x="112" y="53">host: context</text>');
    parts.push('<rect class="l10x" x="228" y="26" width="112" height="44" rx="4"/><text class="l10t" x="236" y="53">model selects</text>');
    parts.push('<rect class="l10g" x="348" y="26" width="104" height="44" rx="4"/><text class="l10t" x="356" y="53">confirm gate</text>');
    parts.push('<rect class="l10x" x="460" y="26" width="94" height="44" rx="4"/><text class="l10t" x="468" y="53">server</text>');
    parts.push('<path class="l10a" d="M96 48 L104 48" marker-end="url(#l10arrow)"/>');
    parts.push('<path class="l10a" d="M220 48 L228 48" marker-end="url(#l10arrow)"/>');
    parts.push('<path class="l10a" d="M340 48 L348 48" marker-end="url(#l10arrow)"/>');
    parts.push('<path class="l10a" d="M452 48 L460 48" marker-end="url(#l10arrow)"/>');
    parts.push('<text class="l10c" x="410" y="18">approved</text>');
    parts.push('<rect class="l10h" x="20" y="110" width="140" height="40" rx="4"/><text class="l10t" x="28" y="134">held (denied)</text>');
    parts.push('<path class="l10a" d="M402 70 L90 110" marker-end="url(#l10arrow)"/>');
    parts.push('<text class="l10c" x="330" y="92">denied, never sent</text>');
    parts.push('<rect class="l10x" x="20" y="180" width="110" height="44" rx="4"/><text class="l10t" x="28" y="207">complete</text>');
    parts.push('<rect class="l10x" x="160" y="180" width="140" height="44" rx="4"/><text class="l10t" x="168" y="207">isError: true</text>');
    parts.push('<rect class="l10x" x="330" y="180" width="170" height="44" rx="4"/><text class="l10t" x="338" y="207">input_required</text>');
    parts.push('<path class="l10a" d="M507 70 L75 180" marker-end="url(#l10arrow)"/>');
    parts.push('<path class="l10a" d="M507 70 L230 180" marker-end="url(#l10arrow)"/>');
    parts.push('<path class="l10a" d="M507 70 L415 180" marker-end="url(#l10arrow)"/>');
    parts.push('<path class="l10fb" d="M230 180 L230 80 L284 80 L284 70" marker-end="url(#l10arrow)"/>');
    parts.push('<path class="l10fb" d="M415 180 L415 86 L300 86 L300 70" marker-end="url(#l10arrow)"/>');
    parts.push('<text class="l10c" x="196" y="76">retry, corrected args</text>');
    parts.push('<text class="l10c" x="330" y="170">retry, new id, requestState echoed</text>');
    parts.push('<rect class="l10x" x="10" y="250" width="150" height="36" rx="4"/><text class="l10t" x="18" y="272">answer to user</text>');
    parts.push('<path class="l10a" d="M75 224 L85 250" marker-end="url(#l10arrow)"/>');
    var shell = document.createElement('div');
    shell.className = 'mf-shell';
    shell.innerHTML = [
      '<div class="mf-head"><strong>Model Interaction Flow</strong> context, selection, confirmation, call, and back</div>',
      '<div class="mf-body">',
      '<svg viewBox="0 0 560 296" role="img" aria-label="A user request flows through a host that builds model context, a model that selects a tool and drafts arguments, and a confirmation gate. An approved call reaches the server; a denied one is held and never sent. The server can return a complete result that becomes the answer, a tool execution error that sends the model back to correct its arguments, or an input required result that sends the host to gather an answer and retry with a new id and the same requestState.">',
      '<defs><marker id="l10arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="var(--blueprint,#3553ff)"/></marker></defs>',
      '<style>.l10x{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.l10g{fill:var(--bg-surface,#eee);stroke:var(--blueprint,#3553ff);stroke-width:1.5}.l10h{fill:none;stroke:var(--ink-mute,#999);stroke-width:1.2;stroke-dasharray:3 2}.l10t{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}.l10c{fill:var(--ink-mute,#777);font:11px var(--font-mono,monospace)}.l10a{stroke:var(--blueprint,#3553ff);fill:none;stroke-width:1.5}.l10fb{stroke:var(--ink-mute,#999);fill:none;stroke-width:1.4;stroke-dasharray:4 3}</style>',
      parts.join(''),
      '</svg>',
      '</div>',
      '<div class="mf-caption">The loop has one branch the wire never sees: a denied confirmation stops before the client sends anything. Of the branches that reach the server, a tool execution error and an input required result both return control to the model, but only the input required branch is a retry with a new id and an echoed requestState; a protocol error also returns control to the model, with nothing to correct, so the loop does not send it again.</div>'
    ].join('');
    host.appendChild(shell);
  }

  function toolCallFigure(host) {
    ensureStyles();
    var chipLabels = ['text', 'image', 'audio', 'resource_link', 'resource'];
    var chipX = [8, 120, 232, 344, 456];
    var chipW = [104, 104, 104, 104, 96];
    var chips = [];
    var i;
    for (i = 0; i < chipLabels.length; i++) {
      chips.push('<rect class="l11x" x="' + chipX[i] + '" y="122" width="' + chipW[i] + '" height="26" rx="3"/>');
      chips.push('<text class="l11t" x="' + (chipX[i] + chipW[i] / 2) + '" y="139" text-anchor="middle">' + chipLabels[i] + '</text>');
    }
    var shell = document.createElement('div');
    shell.className = 'mf-shell';
    shell.innerHTML = [
      '<div class="mf-head"><strong>The Tools Primitive</strong> one call, five kinds of content, two error channels</div>',
      '<div class="mf-body">',
      '<svg viewBox="0 0 560 230" role="img" aria-label="A client sends tools/call to a server and gets back a CallToolResult. The result content list can hold text, image, audio, resource_link, or resource blocks. The same result also reports isError, omitted or false on success, true when the tool itself failed.">',
      '<defs><marker id="l11arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path class="l11m" d="M0,0 L6,3 L0,6 Z"/></marker></defs>',
      '<style>.l11x{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.l11t{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}.l11a{stroke:var(--blueprint,#3553ff);stroke-width:1.4;fill:none}.l11m{fill:var(--blueprint,#3553ff)}.l11n{fill:var(--ink-mute,#777);font:11px var(--font-mono,monospace)}</style>',
      '<rect class="l11x" x="16" y="36" width="110" height="40" rx="4"/><text class="l11t" x="71" y="60" text-anchor="middle">Client</text>',
      '<rect class="l11x" x="434" y="36" width="110" height="40" rx="4"/><text class="l11t" x="489" y="60" text-anchor="middle">Server</text>',
      '<line class="l11a" x1="126" y1="48" x2="434" y2="48" marker-end="url(#l11arrow)"/><text class="l11n" x="280" y="40" text-anchor="middle">tools/call</text>',
      '<line class="l11a" x1="434" y1="70" x2="126" y2="70" marker-end="url(#l11arrow)"/><text class="l11n" x="280" y="86" text-anchor="middle">CallToolResult</text>',
      '<text class="l11n" x="8" y="112" text-anchor="start">content can hold:</text>',
      chips.join(''),
      '<text class="l11n" x="8" y="172" text-anchor="start">and reports:</text>',
      '<rect class="l11x" x="8" y="182" width="140" height="26" rx="3"/><text class="l11t" x="78" y="199" text-anchor="middle">isError omitted</text>',
      '<rect class="l11x" x="170" y="182" width="140" height="26" rx="3"/><text class="l11t" x="240" y="199" text-anchor="middle">isError: true</text>',
      '</svg>',
      '</div>',
      '<div class="mf-caption">A tools/call request names one tool and its arguments; the CallToolResult that comes back carries a content list built from any mix of the five block types, an optional structuredContent value, and isError. Omitted or false means the call succeeded; true means the tool ran into a problem the model can read and correct.</div>'
    ].join('');
    host.appendChild(shell);
  }

  function resourceReadFigure(host) {
    ensureStyles();
    var shell = document.createElement('div');
    shell.className = 'mf-shell';
    shell.innerHTML = [
      '<div class="mf-head"><strong>Reading a Resource</strong> one URI, two lawful outcomes</div>',
      '<div class="mf-body">',
      '<svg viewBox="0 0 560 232" role="img" aria-label="A URI template, file colon slash slash slash project slash plus path, expands into a concrete URI, which resources read resolves against the project root. A resource that exists returns a complete result carrying contents, ttlMs, and cacheScope. A resource that is missing, or a path that tries to climb outside the root, returns JSON-RPC error -32602 naming the requested URI in data.uri, never a result with an empty contents array.">',
      '<style>.l12x{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.l12h{fill:var(--ink,#111);font:bold 11px var(--font-mono,monospace)}.l12t{fill:var(--ink-mute,#555);font:11px var(--font-mono,monospace)}.l12l{fill:var(--ink-mute,#777);font:11px var(--font-mono,monospace)}.l12a{stroke:var(--blueprint,#3553ff);fill:none;stroke-width:1.5}.l12err{stroke:#c94a34;fill:none;stroke-width:1.5}.l12errt{fill:#c94a34;font:bold 11px var(--font-mono,monospace)}.l12c{fill:var(--ink-soft,#777);font:11px var(--font-mono,monospace)}</style>',
      '<rect class="l12x" x="8" y="76" width="148" height="64" rx="4"/>',
      '<text class="l12h" x="18" y="96">template</text>',
      '<text class="l12t" x="18" y="112">file:///project/{+path}</text>',
      '<text class="l12l" x="18" y="128">path = src/app.py</text>',
      '<path class="l12a" d="M156 108 L204 108" marker-end="url(#l12arrow)"/>',
      '<text class="l12l" x="160" y="100">expand</text>',
      '<rect class="l12x" x="204" y="76" width="140" height="64" rx="4"/>',
      '<text class="l12h" x="214" y="96">resources/read</text>',
      '<text class="l12t" x="214" y="112">sanitize against root</text>',
      '<text class="l12l" x="214" y="128">then look up the uri</text>',
      '<path class="l12a" d="M344 92 L410 40" marker-end="url(#l12arrow)"/>',
      '<text class="l12l" x="350" y="72">found</text>',
      '<path class="l12err" d="M344 124 L410 176" marker-end="url(#l12errarrow)"/>',
      '<text class="l12l" x="350" y="150">missing</text>',
      '<rect class="l12x" x="410" y="10" width="142" height="66" rx="4"/>',
      '<text class="l12h" x="420" y="30">complete</text>',
      '<text class="l12t" x="420" y="46">contents[]</text>',
      '<text class="l12t" x="420" y="62">ttlMs + cacheScope</text>',
      '<rect class="l12x" x="410" y="146" width="142" height="66" rx="4"/>',
      '<text class="l12errt" x="420" y="166">-32602</text>',
      '<text class="l12t" x="420" y="182">data.uri</text>',
      '<text class="l12l" x="420" y="198">never empty contents[]</text>',
      '<text class="l12c" x="8" y="222">sanitize before lookup: a path segment can never resolve outside the project root</text>',
      '<defs>',
      '<marker id="l12arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="var(--blueprint,#3553ff)"/></marker>',
      '<marker id="l12errarrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="#c94a34"/></marker>',
      '</defs>',
      '</svg>',
      '</div>',
      '<div class="mf-caption">A URI template expands into a concrete URI, and resources/read sanitizes it against the server\'s root before any lookup. A resource that exists returns a complete result carrying contents, ttlMs, and cacheScope. A resource that does not exist, or a path that tries to climb outside the root, returns JSON-RPC error -32602 naming the requested URI in data.uri, never a successful result with an empty contents array.</div>'
    ].join('');
    host.appendChild(shell);
  }

  function promptTemplateFigure(host) {
    ensureStyles();
    var shell = document.createElement('div');
    shell.className = 'mf-shell';
    shell.innerHTML = [
      '<div class="mf-head"><strong>Prompt Template and Completion</strong> arguments fill a template; context narrows suggestions</div>',
      '<div class="mf-body">',
      '<svg viewBox="0 0 560 300" role="img" aria-label="Left: a code_review prompt template fills language and framework placeholders to render its text. Right: completion for the framework argument returns three matches with no context, narrowing to two once context.arguments supplies the chosen language.">',
      '<defs><marker id="l13arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="l13m"/></marker></defs>',
      '<style>.l13x{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.l13p{fill:var(--bg-surface,#eee);stroke:var(--blueprint,#3553ff);stroke-width:1.6}.l13t{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}.l13c{fill:var(--ink-mute,#777);font:11px var(--font-mono,monospace)}.l13a{stroke:var(--blueprint,#3553ff);stroke-width:1.4;marker-end:url(#l13arrow)}.l13m{fill:var(--blueprint,#3553ff)}</style>',
      '<text class="l13c" x="14" y="18">prompts/get renders a template</text>',
      '<rect class="l13x" x="14" y="26" width="234" height="44"/>',
      '<text class="l13t" x="22" y="42">text: {language} snippet,</text>',
      '<text class="l13t" x="22" y="58">follow {framework} style</text>',
      '<line class="l13a" x1="131" y1="70" x2="131" y2="84"/>',
      '<rect class="l13x" x="14" y="86" width="234" height="44"/>',
      '<text class="l13t" x="22" y="102">language: python</text>',
      '<text class="l13t" x="22" y="118">framework: flask</text>',
      '<line class="l13a" x1="131" y1="130" x2="131" y2="144"/>',
      '<rect class="l13p" x="14" y="146" width="234" height="44"/>',
      '<text class="l13t" x="22" y="162">rendered: python snippet,</text>',
      '<text class="l13t" x="22" y="178">follow flask style</text>',
      '<text class="l13c" x="312" y="18">completion narrows with context</text>',
      '<rect class="l13x" x="312" y="26" width="234" height="44"/>',
      '<text class="l13t" x="320" y="42">framework "fa", no context:</text>',
      '<text class="l13t" x="320" y="58">falcon, fastapi, fastify</text>',
      '<line class="l13a" x1="429" y1="70" x2="429" y2="84"/>',
      '<text class="l13c" x="366" y="80">+ context</text>',
      '<rect class="l13p" x="312" y="86" width="234" height="44"/>',
      '<text class="l13t" x="320" y="102">language: python</text>',
      '<text class="l13t" x="320" y="118">narrows to: falcon, fastapi</text>',
      '<text class="l13c" x="312" y="146">3 matches narrow to 2</text>',
      '</svg>',
      '</div>',
      '<div class="mf-caption">A prompt argument fills its placeholder to render PromptMessage content. completion/complete ranks suggestions for one argument, and narrows them further once context.arguments carries an answer already given, such as the chosen language.</div>'
    ].join('');
    host.appendChild(shell);
  }

  function mrtrFigure(host) {
    ensureStyles();
    var clientX = 100;
    var serverX = 460;
    var rows = [
      {y: 70, dir: 'right', label: 'tools/call (id 1): deploy_release'},
      {y: 118, dir: 'left', label: 'input_required: confirm + requestState'},
      {y: 160, dir: 'note', label: 'client gathers confirmation from the user'},
      {y: 206, dir: 'right', label: 'tools/call (id 2): new id, inputResponses'},
      {y: 254, dir: 'left', label: 'complete: deployed = true'}
    ];
    var parts = [];
    parts.push('<line class="l14lane" x1="' + clientX + '" y1="40" x2="' + clientX + '" y2="272"/>');
    parts.push('<line class="l14lane" x1="' + serverX + '" y1="40" x2="' + serverX + '" y2="272"/>');
    parts.push('<rect class="l14box" x="' + (clientX - 36) + '" y="16" width="72" height="22"/><text class="l14role" x="' + clientX + '" y="31" text-anchor="middle">Client</text>');
    parts.push('<rect class="l14box" x="' + (serverX - 36) + '" y="16" width="72" height="22"/><text class="l14role" x="' + serverX + '" y="31" text-anchor="middle">Server</text>');
    var mid = (clientX + serverX) / 2;
    var i;
    for (i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (row.dir === 'note') {
        parts.push('<text class="l14note" x="' + mid + '" y="' + row.y + '" text-anchor="middle">' + row.label + '</text>');
        continue;
      }
      var x1 = row.dir === 'right' ? clientX : serverX;
      var x2 = row.dir === 'right' ? serverX : clientX;
      parts.push('<text class="l14lbl" x="' + mid + '" y="' + (row.y - 10) + '" text-anchor="middle">' + row.label + '</text>');
      parts.push('<line class="l14arrow" x1="' + x1 + '" y1="' + row.y + '" x2="' + x2 + '" y2="' + row.y + '" marker-end="url(#l14arrowhead)"/>');
    }
    var shell = document.createElement('div');
    shell.className = 'mf-shell';
    shell.innerHTML = [
      '<div class="mf-head"><strong>Multi Round-Trip Requests</strong> one call, an input_required pause, a fresh retry that echoes requestState</div>',
      '<div class="mf-body">',
      '<svg viewBox="0 0 560 290" role="img" aria-label="A client sends tools/call with id 1. The server ends that request with an input_required result carrying inputRequests and requestState instead of holding a stream open. The client gathers the confirmation from the user, then sends an independent tools/call with a new id 2 that carries inputResponses and echoes requestState exactly. The server replies complete.">',
      '<defs><marker id="l14arrowhead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path class="l14arrowfill" d="M0,0 L10,5 L0,10 z"/></marker></defs>',
      '<style>.l14lane{stroke:var(--rule-soft,#ccc);stroke-width:1;stroke-dasharray:3,3}.l14box{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.l14role{fill:var(--ink,#111);font:bold 12px var(--font-mono,monospace)}.l14arrow{stroke:var(--blueprint,#3553ff);stroke-width:1.6}.l14arrowfill{fill:var(--blueprint,#3553ff)}.l14lbl{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}.l14note{fill:var(--ink-mute,#777);font:italic 11px var(--font-mono,monospace)}</style>',
      parts.join(''),
      '</svg>',
      '</div>',
      '<div class="mf-caption">The server never pushes a request to the client. It ends the first call with input_required, and the client starts an independent second call, with a new JSON-RPC id, that echoes requestState byte for byte and supplies inputResponses.</div>'
    ].join('');
    host.appendChild(shell);
  }

  function deprecationTimelineFigure(host) {
    ensureStyles();
    var depX = 150;
    var remX = 360;
    var endX = 524;
    var lanes = [
      {label: 'Roots', y: 84},
      {label: 'Sampling', y: 112},
      {label: 'Logging', y: 140}
    ];
    var stillValid = [
      'roots/list (MRTR input request)',
      'sampling/createMessage (MRTR)',
      'logLevel + notifications/message'
    ];
    var removed = [
      'logging/setLevel',
      'notifications/roots/list_changed'
    ];
    var parts = [];
    var i;
    parts.push('<line class="l15l" x1="' + depX + '" y1="40" x2="' + endX + '" y2="40"/>');
    parts.push('<circle class="l15p" cx="' + depX + '" cy="40" r="4"/>');
    parts.push('<circle class="l15p" cx="' + remX + '" cy="40" r="4"/>');
    parts.push('<text class="l15t" x="' + depX + '" y="24">Deprecated</text>');
    parts.push('<text class="l15t" x="' + remX + '" y="24">Eligible for removal</text>');
    parts.push('<text class="l15c" x="' + depX + '" y="56">2026-07-28</text>');
    parts.push('<text class="l15c" x="' + remX + '" y="56">2027-07-28+</text>');
    for (i = 0; i < lanes.length; i++) {
      var y = lanes[i].y;
      parts.push('<text class="l15lbl" x="18" y="' + (y + 4) + '">' + lanes[i].label + '</text>');
      parts.push('<line class="l15solid" x1="' + depX + '" y1="' + y + '" x2="' + remX + '" y2="' + y + '"/>');
      parts.push('<line class="l15dash" x1="' + remX + '" y1="' + y + '" x2="' + endX + '" y2="' + y + '"/>');
      parts.push('<circle class="l15dot" cx="' + depX + '" cy="' + y + '" r="3"/>');
    }
    parts.push('<line class="l15rule" x1="18" y1="160" x2="542" y2="160"/>');
    parts.push('<text class="l15h" x="18" y="176">Deprecated, still on the wire</text>');
    parts.push('<text class="l15h" x="300" y="176">Fully removed</text>');
    for (i = 0; i < stillValid.length; i++) {
      var sy = 196 + i * 20;
      parts.push('<rect class="l15still" x="18" y="' + (sy - 8) + '" width="6" height="6"/>');
      parts.push('<text class="l15lbl" x="30" y="' + sy + '">' + stillValid[i] + '</text>');
    }
    for (i = 0; i < removed.length; i++) {
      var ry = 196 + i * 20;
      parts.push('<rect class="l15gone" x="300" y="' + (ry - 8) + '" width="6" height="6"/>');
      parts.push('<text class="l15lbl" x="312" y="' + ry + '">' + removed[i] + '</text>');
    }
    var shell = document.createElement('div');
    shell.className = 'mf-shell';
    shell.innerHTML = [
      '<div class="mf-head"><strong>Deprecated, Not Removed</strong> roots, sampling, and logging keep answering through the removal window</div>',
      '<div class="mf-body">',
      '<svg viewBox="0 0 560 256" role="img" aria-label="Timeline from the 2026-07-28 deprecation of roots, sampling, and logging to their earliest possible removal on or after 2027-07-28, each lane solid then dashed to show the feature keeps working past the marker. Below, one column lists roots/list, sampling/createMessage, and per-request logLevel with notifications/message as still valid on the wire, and a second column lists logging/setLevel and notifications/roots/list_changed as already removed.">',
      '<style>.l15l{stroke:var(--ink-mute,#999);stroke-width:1}.l15p{fill:var(--blueprint,#3553ff)}.l15t{fill:var(--ink,#111);font:11px var(--font-mono,monospace);text-anchor:middle}.l15c{fill:var(--ink-mute,#777);font:11px var(--font-mono,monospace);text-anchor:middle}.l15lbl{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}.l15solid{stroke:var(--blueprint,#3553ff);stroke-width:5;stroke-linecap:round}.l15dash{stroke:var(--ink-soft,#bbb);stroke-width:5;stroke-linecap:round;stroke-dasharray:6 4}.l15dot{fill:var(--blueprint,#3553ff)}.l15rule{stroke:var(--rule-soft,#ccc);stroke-width:1}.l15h{fill:var(--ink,#111);font:11px var(--font-mono,monospace);font-weight:bold}.l15still{fill:var(--blueprint,#3553ff)}.l15gone{fill:var(--ink-mute,#999)}</style>',
      parts.join(''),
      '</svg>',
      '</div>',
      '<div class="mf-caption">Deprecated in 2026-07-28 starts a twelve month clock, not a deletion: roots, sampling, and logging keep their exact wire shape past the earliest-removal marker, while logging/setLevel and notifications/roots/list_changed are already gone, replaced by MRTR input requests and a per-request logLevel key.</div>'
    ].join('');
    host.appendChild(shell);
  }

  function subscriptionStreamFigure(host) {
    ensureStyles();
    var beats = [
      {dir: 'right', cls: 'ok', label: 'listen id=1: toolsListChanged, config.json'},
      {dir: 'left', cls: 'ok', label: 'ack: _meta.subscriptionId=1'},
      {dir: 'right', cls: 'ok', label: 'listen id=2: resourcesListChanged'},
      {dir: 'left', cls: 'ok', label: 'ack: _meta.subscriptionId=2'},
      {dir: 'left', cls: 'ok', label: 'resources/updated, subscriptionId=1'},
      {dir: 'left', cls: 'ok', label: 'resources/list_changed, subscriptionId=2'},
      {dir: 'right', cls: 'ok', label: 'tools/call id=3, _meta.progressToken=job-42'},
      {dir: 'left', cls: 'prog', label: 'progress 0.2, 0.6, 1.0: no subscriptionId'},
      {dir: 'left', cls: 'ok', label: 'result id=3: resultType complete'},
      {dir: 'right', cls: 'no', label: 'notifications/cancelled requestId=2'},
      {dir: 'left', cls: 'drop', label: 'late update for sub=2: dropped locally'}
    ];
    var clientX = 61;
    var serverX = 499;
    var top = 46;
    var step = 26;
    var rows = [];
    var i;
    var y;
    var x1;
    var x2;
    var marker;
    for (i = 0; i < beats.length; i++) {
      y = top + i * step;
      x1 = beats[i].dir === 'right' ? clientX : serverX;
      x2 = beats[i].dir === 'right' ? serverX : clientX;
      marker = (beats[i].cls === 'no' || beats[i].cls === 'drop') ? 'l16arrowmute' : 'l16arrow';
      rows.push('<line class="l16' + beats[i].cls + '" x1="' + x1 + '" y1="' + y + '" x2="' + x2 + '" y2="' + y + '" marker-end="url(#' + marker + ')"/>');
      rows.push('<text class="l16lbl" x="280" y="' + (y - 6) + '" text-anchor="middle">' + beats[i].label + '</text>');
    }
    var lastY = top + (beats.length - 1) * step;
    var lifelineBottom = lastY + 14;
    var shell = document.createElement('div');
    shell.className = 'mf-shell';
    shell.innerHTML = [
      '<div class="mf-head"><strong>Notification Streams, Progress, and Cancellation</strong> the listen stream tags every message with a subscriptionId; a request’s own progress never does</div>',
      '<div class="mf-body">',
      '<svg viewBox="0 0 560 330" role="img" aria-label="Sequence between a client and a server. The client opens two subscriptions/listen requests, id 1 and id 2; each is acknowledged first with the matching subscriptionId in _meta, then resources/updated and list_changed notifications arrive tagged with that same id so the client can tell them apart. A separate tools/call request runs on its own response channel: its progress notifications carry only a progressToken, never a subscriptionId, and its result arrives on that same request, not on the listen stream. The client then cancels subscription 2 with notifications/cancelled, and a stray update for subscription 2 that arrives afterward is dropped rather than delivered.">',
      '<style>',
      '.l16x{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}',
      '.l16t{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}',
      '.l16lbl{fill:var(--ink-soft,#555);font:11px var(--font-mono,monospace)}',
      '.l16life{stroke:var(--rule-soft,#ccc);stroke-width:1;stroke-dasharray:2 3}',
      '.l16ok{stroke:var(--blueprint,#3553ff);stroke-width:1.6;fill:none}',
      '.l16prog{stroke:var(--ink,#111);stroke-width:1.4;fill:none;stroke-dasharray:1 3;stroke-linecap:round}',
      '.l16no{stroke:var(--ink-mute,#888);stroke-width:1.4;fill:none;stroke-dasharray:5 3}',
      '.l16drop{stroke:var(--ink-mute,#888);stroke-width:1.2;fill:none;stroke-dasharray:2 4;opacity:.7}',
      '</style>',
      '<marker id="l16arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--blueprint,#3553ff)"/></marker>',
      '<marker id="l16arrowmute" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--ink-mute,#888)"/></marker>',
      '<rect class="l16x" x="16" y="6" width="90" height="22"/><text class="l16t" x="26" y="21">client</text>',
      '<rect class="l16x" x="454" y="6" width="90" height="22"/><text class="l16t" x="464" y="21">server</text>',
      '<line class="l16life" x1="' + clientX + '" y1="28" x2="' + clientX + '" y2="' + lifelineBottom + '"/>',
      '<line class="l16life" x1="' + serverX + '" y1="28" x2="' + serverX + '" y2="' + lifelineBottom + '"/>',
      rows.join(''),
      '</svg>',
      '</div>',
      '<div class="mf-caption">Two subscriptions share one channel and are told apart only by the subscriptionId every acknowledgment and notification carries in _meta, matching the id of the subscriptions/listen request that opened it. Progress and the final result for an ordinary call travel on that call’s own response, never on the listen stream, so they never carry a subscriptionId. Cancelling a subscription stops new messages for it; a message already in flight when the cancel lands still arrives and must be dropped, not delivered.</div>'
    ].join('');
    host.appendChild(shell);
  }

  function toolLifecycleFigure(host) {
    ensureStyles();
    var stages = [
      'DISCOVER: server/discover',
      'LIST: tools/list, cached',
      'SELECT: model picks a tool',
      'CONFIRM: host approval gate',
      'CALL: tools/call sent',
      'VALIDATE: is the tool known',
      'EXECUTE: validate args, run',
      'RESULT: resultType'
    ];
    var barX = 16;
    var barW = 234;
    var barH = 26;
    var gap = 14;
    var step = barH + gap;
    var parts = [];
    var i;
    for (i = 0; i < stages.length; i++) {
      var y = 14 + i * step;
      parts.push('<rect class="l17bar" x="' + barX + '" y="' + y + '" width="' + barW + '" height="' + barH + '"/>');
      parts.push('<text class="l17lbl" x="' + (barX + 10) + '" y="' + (y + 17) + '">' + stages[i] + '</text>');
      if (i < stages.length - 1) {
        var midX = barX + barW / 2;
        parts.push('<line class="l17chain" x1="' + midX + '" y1="' + (y + barH) + '" x2="' + midX + '" y2="' + (y + barH + gap) + '" marker-end="url(#l17arrow)"/>');
      }
    }
    var yCall = 14 + 4 * step;
    var yValidate = 14 + 5 * step;
    var yExecute = 14 + 6 * step;
    var yResult = 14 + 7 * step;
    var yRetry = yResult + step;
    var rightX = 340;
    var rightW = 204;
    var rightEdge = barX + barW;

    parts.push('<line class="l17dash" x1="' + rightEdge + '" y1="' + (yValidate + 13) + '" x2="' + rightX + '" y2="' + (yValidate + 13) + '"/>');
    parts.push('<rect class="l17err" x="' + rightX + '" y="' + yValidate + '" width="' + rightW + '" height="' + barH + '"/>');
    parts.push('<text class="l17lbl" x="' + (rightX + 10) + '" y="' + (yValidate + 17) + '">unknown tool: -32602</text>');

    parts.push('<line class="l17dash" x1="' + rightEdge + '" y1="' + (yExecute + 13) + '" x2="' + rightX + '" y2="' + (yExecute + 13) + '"/>');
    parts.push('<rect class="l17soft" x="' + rightX + '" y="' + yExecute + '" width="' + rightW + '" height="' + barH + '"/>');
    parts.push('<text class="l17lbl" x="' + (rightX + 10) + '" y="' + (yExecute + 17) + '">isError (actionable)</text>');

    parts.push('<line class="l17dash" x1="' + rightEdge + '" y1="' + (yResult + 13) + '" x2="' + rightX + '" y2="' + (yResult + 13) + '"/>');
    parts.push('<rect class="l17ok" x="' + rightX + '" y="' + yResult + '" width="' + rightW + '" height="' + barH + '"/>');
    parts.push('<text class="l17lbl" x="' + (rightX + 10) + '" y="' + (yResult + 17) + '">complete: final</text>');

    var elbowX = rightEdge + 30;
    var connectY = yRetry + 8;
    parts.push('<line class="l17dash" x1="' + rightEdge + '" y1="' + (yResult + 13) + '" x2="' + elbowX + '" y2="' + (yResult + 13) + '"/>');
    parts.push('<line class="l17dash" x1="' + elbowX + '" y1="' + (yResult + 13) + '" x2="' + elbowX + '" y2="' + connectY + '"/>');
    parts.push('<line class="l17dash" x1="' + elbowX + '" y1="' + connectY + '" x2="' + rightX + '" y2="' + connectY + '"/>');
    parts.push('<rect class="l17soft" x="' + rightX + '" y="' + yRetry + '" width="' + rightW + '" height="' + barH + '"/>');
    parts.push('<text class="l17lbl" x="' + (rightX + 10) + '" y="' + (yRetry + 17) + '">input_required: retry</text>');

    var loopX = rightEdge + 18;
    var loopY = yRetry + 18;
    parts.push('<path class="l17loop" d="M ' + rightX + ' ' + loopY + ' L ' + loopX + ' ' + loopY + ' L ' + loopX + ' ' + (yCall + 13) + ' L ' + (rightEdge + 2) + ' ' + (yCall + 13) + '" marker-end="url(#l17arrow)"/>');

    var height = yRetry + barH + 24;
    var shell = document.createElement('div');
    shell.className = 'mf-shell';
    shell.innerHTML = [
      '<div class="mf-head"><strong>The Tool Invocation Lifecycle</strong> eight checkpoints, two error channels, one loop back for input_required</div>',
      '<div class="mf-body">',
      '<svg viewBox="0 0 560 ' + height + '" role="img" aria-label="A vertical chain of eight checkpoints: discover, list, select, confirm, call, validate, execute, result. Validate branches right to an unknown tool -32602 protocol error. Execute branches right to an isError tool execution result. Result branches right to two outcomes: complete, which is final, and input_required, which loops back up to call with a new request id.">',
      '<defs><marker id="l17arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path class="l17arrowfill" d="M0,0 L10,5 L0,10 z"/></marker></defs>',
      '<style>.l17bar{fill:var(--bg-surface,#eee);stroke:var(--ink,#111)}.l17lbl{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}.l17chain{stroke:var(--blueprint,#3553ff);stroke-width:1.4}.l17arrowfill{fill:var(--blueprint,#3553ff)}.l17dash{stroke:var(--ink-mute,#888);stroke-width:1;stroke-dasharray:3,3}.l17err{fill:var(--bg-surface,#eee);stroke:var(--blueprint,#3553ff);stroke-width:1.6}.l17soft{fill:var(--bg-surface,#eee);stroke:var(--ink-mute,#888)}.l17ok{fill:var(--bg-surface,#eee);stroke:var(--ink,#111);stroke-width:1.6}.l17loop{fill:none;stroke:var(--ink,#111);stroke-width:1.4}</style>',
      parts.join(''),
      '</svg>',
      '</div>',
      '<div class="mf-caption">Validate only asks whether the tool exists; failing there is always a protocol error, -32602, with no execute or result stage after it. Everything discovered once execute has started, a bad argument or a business rule, comes back isError inside a normal complete result so the model can read it and retry. A result of input_required is not the end: the client answers it and calls again with a new id, running validate, execute, and result a second time.</div>'
    ].join('');
    host.appendChild(shell);
  }

  function errorTaxonomyFigure(host) {
    ensureStyles();
    var protocolCodes = [
      { code: '-32601', name: 'Method not found' },
      { code: '-32602', name: 'Invalid params (unknown tool)' },
      { code: '-32020', name: 'HeaderMismatch' },
      { code: '-32021', name: 'MissingRequiredClientCapability' },
      { code: '-32022', name: 'UnsupportedProtocolVersion' }
    ];
    var rowH = 32;
    var gap = 6;
    var startY = 40;
    var left = '';
    var i;
    var y;
    for (i = 0; i < protocolCodes.length; i++) {
      y = startY + i * (rowH + gap);
      left += '<rect class="l18x" x="16" y="' + y + '" width="250" height="' + rowH + '" rx="3"/>';
      left += '<text class="l18h" x="24" y="' + (y + 13) + '">' + protocolCodes[i].code + '</text>';
      left += '<text class="l18t" x="24" y="' + (y + 26) + '">' + protocolCodes[i].name + '</text>';
    }
    var shell = document.createElement('div');
    shell.className = 'mf-shell';
    shell.innerHTML = [
      '<div class="mf-head"><strong>Two Ways for a Request to Fail</strong> a protocol error travels as a JSON-RPC error object; a tool problem travels as a normal result with isError true</div>',
      '<div class="mf-body">',
      '<svg viewBox="0 0 560 300" role="img" aria-label="Left column: five JSON-RPC protocol error codes, -32601 method not found, -32602 invalid params, -32020 header mismatch, -32021 missing required client capability, -32022 unsupported protocol version. Right column: a tool problem card showing API failures, input validation errors, business logic refusals, and expired handles all reported as a result with isError true, which is content the model reads and then retries with a fix. Bottom band: the forbidden zone, -32000 to -32019 legacy and -32002 and -32042 retired, labeled as codes a 2026-07-28 server must refuse to put on the wire.">',
      '<style>.l18x{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.l18h{fill:var(--ink,#111);font:bold 12px var(--font-mono,monospace)}.l18t{fill:var(--ink-mute,#777);font:11px var(--font-mono,monospace)}.l18cap{fill:var(--ink-soft,#555);font:bold 11px var(--font-mono,monospace)}.l18d{stroke:var(--rule-soft,#ccc);stroke-width:1}.l18f{fill:none;stroke:var(--ink-mute,#999);stroke-width:1.2;stroke-dasharray:4 3}.l18fh{fill:var(--ink,#111);font:bold 11px var(--font-mono,monospace)}.l18ft{fill:var(--ink-mute,#777);font:11px var(--font-mono,monospace)}</style>',
      '<text class="l18cap" x="16" y="14">two channels answer a failed request; only one of them is content the model reads</text>',
      '<text class="l18cap" x="16" y="30">protocol error -&gt; JSON-RPC error</text>',
      '<text class="l18cap" x="296" y="30">tool problem -&gt; isError: true</text>',
      '<line class="l18d" x1="282" y1="36" x2="282" y2="224"/>',
      left,
      '<rect class="l18x" x="296" y="40" width="248" height="184"/>',
      '<text class="l18h" x="304" y="58">isError: true</text>',
      '<text class="l18t" x="304" y="76">API failures</text>',
      '<text class="l18t" x="304" y="92">input validation errors</text>',
      '<text class="l18t" x="304" y="108">business logic refusals</text>',
      '<text class="l18t" x="304" y="124">expired server-minted handles</text>',
      '<line class="l18d" x1="304" y1="138" x2="536" y2="138"/>',
      '<text class="l18t" x="304" y="158">content the model reads,</text>',
      '<text class="l18t" x="304" y="176">then retries with a fix</text>',
      '<rect class="l18f" x="16" y="240" width="528" height="48" rx="3"/>',
      '<text class="l18fh" x="28" y="260">forbidden: -32000 to -32019 legacy, -32002 and -32042 retired</text>',
      '<text class="l18ft" x="28" y="278">a 2026-07-28 server must refuse to put any of these on the wire</text>',
      '</svg>',
      '</div>',
      '<div class="mf-caption">A protocol error is a JSON-RPC error object the client handles itself. A tool problem is a normal result with isError true, content the model can read and act on. Both are legitimate channels; a code from the forbidden band below is never legitimate, whichever channel would carry it.</div>'
    ].join('');
    host.appendChild(shell);
  }

  function transportsFigure(host) {
    ensureStyles();
    var parts = [];
    parts.push('<text class="l19h" x="8" y="16">STDIO (SUBPROCESS)</text>');
    parts.push('<rect class="l19x" x="8" y="24" width="254" height="28" rx="3"/><text class="l19t" x="18" y="43">client process</text>');
    parts.push('<rect class="l19x" x="8" y="118" width="254" height="28" rx="3"/><text class="l19t" x="18" y="137">server (child process)</text>');
    parts.push('<line class="l19a" x1="60" y1="52" x2="60" y2="116" marker-end="url(#l19arrow)"/><text class="l19s" x="68" y="80">stdin</text>');
    parts.push('<line class="l19a" x1="150" y1="116" x2="150" y2="52" marker-end="url(#l19arrow)"/><text class="l19s" x="158" y="80">stdout</text>');
    parts.push('<line class="l19a" x1="220" y1="116" x2="220" y2="52" stroke-dasharray="3,3" marker-end="url(#l19arrow)"/><text class="l19s" x="196" y="100">stderr</text>');
    parts.push('<text class="l19h" x="296" y="16">STREAMABLE HTTP (POST /mcp)</text>');
    parts.push('<rect class="l19x" x="296" y="24" width="256" height="28" rx="3"/><text class="l19t" x="306" y="43">client (any HTTP peer)</text>');
    parts.push('<rect class="l19x" x="296" y="118" width="256" height="28" rx="3"/><text class="l19t" x="306" y="137">server (validate + dispatch)</text>');
    parts.push('<line class="l19a" x1="350" y1="52" x2="350" y2="116" marker-end="url(#l19arrow)"/><text class="l19s" x="358" y="80">POST /mcp</text>');
    parts.push('<line class="l19a" x1="470" y1="116" x2="470" y2="52" marker-end="url(#l19arrow)"/><text class="l19s" x="422" y="80">response</text>');
    parts.push('<circle class="l19f" cx="372" cy="100" r="7"/><text class="l19m" x="372" y="104">!</text>');
    parts.push('<text class="l19s" x="384" y="104">mismatch: 400 + -32020</text>');
    parts.push('<text class="l19c" x="8" y="178">protocol semantics are identical on every transport; only the binding differs</text>');
    parts.push('<text class="l19c" x="8" y="194">stdio has no header layer: version and capabilities travel only in _meta</text>');
    parts.push('<text class="l19c" x="8" y="210">HTTP mirrors method, name, and x-mcp-header params; a mismatch is 400 + -32020</text>');
    var shell = document.createElement('div');
    shell.className = 'mf-shell';
    shell.innerHTML = [
      '<div class="mf-head"><strong>Transports and Headers</strong> the same message, two bindings</div>',
      '<div class="mf-body">',
      '<svg viewBox="0 0 560 232" role="img" aria-label="Left: stdio transport between a client and a child server process, connected by a stdin line down, a stdout line up, and a dashed stderr line up, with no header layer at all. Right: Streamable HTTP, where a client posts to the server and the server posts back a response; a checkpoint on the request arrow marks where mismatched headers are rejected with HTTP 400 and error code -32020.">',
      '<style>.l19h{fill:var(--ink-mute,#777);font:11px var(--font-mono,monospace);text-transform:uppercase;letter-spacing:.06em}.l19x{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.l19t{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}.l19a{stroke:var(--blueprint,#3553ff);stroke-width:1.4;fill:none}.l19s{fill:var(--ink-mute,#777);font:11px var(--font-mono,monospace)}.l19f{fill:#c94a34}.l19m{fill:#fff;font:bold 9px var(--font-mono,monospace);text-anchor:middle}.l19c{fill:var(--ink-soft,#555);font:11px var(--font-mono,monospace)}</style>',
      parts.join(''),
      '<defs><marker id="l19arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="var(--blueprint,#3553ff)"/></marker></defs>',
      '</svg>',
      '</div>',
      '<div class="mf-caption">stdio carries every message inline over stdin and stdout, with logs on a separate stderr line and no header layer at all. Streamable HTTP mirrors the method, the tool or resource name, and any x-mcp-header argument into headers so a gateway can route without parsing the body, but the body stays the source of truth: a header that disagrees with it is rejected with HTTP 400 and a HeaderMismatch (-32020) error before the tool ever runs.</div>'
    ].join('');
    host.appendChild(shell);
  }

  function cacheFreshnessFigure(host) {
    ensureStyles();
    var parts = [];
    parts.push('<style>');
    parts.push('.l20f{fill:var(--blueprint,#3553ff);opacity:.20}');
    parts.push('.l20s{fill:var(--ink-mute,#8a8a8a);opacity:.16}');
    parts.push('.l20a{stroke:var(--rule-soft,#ccc);stroke-width:1}');
    parts.push('.l20t{fill:var(--ink,#111);font:12px var(--font-mono,monospace)}');
    parts.push('.l20m{fill:var(--ink-mute,#767676);font:11px var(--font-mono,monospace)}');
    parts.push('.l20d{stroke:var(--ink-soft,#bbb);stroke-width:1;stroke-dasharray:4,3}');
    parts.push('.l20n{stroke:var(--blueprint,#3553ff);stroke-width:1.6}');
    parts.push('.l20p{fill:var(--blueprint,#3553ff)}');
    parts.push('</style>');
    parts.push('<text class="l20t" x="70" y="16">A. TTL alone: fresh until t_received + ttlMs</text>');
    parts.push('<rect class="l20f" x="70" y="30" width="240" height="24"/>');
    parts.push('<rect class="l20s" x="310" y="30" width="190" height="24"/>');
    parts.push('<line class="l20a" x1="70" y1="54" x2="500" y2="54"/>');
    parts.push('<text class="l20t" x="190" y="46" text-anchor="middle">fresh</text>');
    parts.push('<text class="l20t" x="405" y="46" text-anchor="middle">stale</text>');
    parts.push('<line class="l20a" x1="70" y1="54" x2="70" y2="60"/>');
    parts.push('<line class="l20a" x1="310" y1="54" x2="310" y2="60"/>');
    parts.push('<text class="l20m" x="70" y="72">t_received</text>');
    parts.push('<text class="l20m" x="310" y="72" text-anchor="middle">t_received + ttlMs</text>');
    parts.push('<text class="l20t" x="70" y="100">B. Notification during the window: stale immediately</text>');
    parts.push('<text class="l20m" x="230" y="124" text-anchor="middle">list_changed notification</text>');
    parts.push('<line class="l20n" x1="230" y1="130" x2="230" y2="148"/>');
    parts.push('<polygon id="l20arrow" class="l20p" points="230,152 224,144 236,144"/>');
    parts.push('<rect class="l20f" x="70" y="154" width="160" height="24"/>');
    parts.push('<rect class="l20s" x="230" y="154" width="270" height="24"/>');
    parts.push('<line class="l20a" x1="70" y1="178" x2="500" y2="178"/>');
    parts.push('<text class="l20t" x="150" y="170" text-anchor="middle">fresh</text>');
    parts.push('<text class="l20t" x="365" y="170" text-anchor="middle">stale</text>');
    parts.push('<line class="l20d" x1="310" y1="150" x2="310" y2="178"/>');
    parts.push('<line class="l20a" x1="70" y1="178" x2="70" y2="184"/>');
    parts.push('<line class="l20a" x1="310" y1="178" x2="310" y2="184"/>');
    parts.push('<text class="l20m" x="70" y="196">t_received</text>');
    parts.push('<text class="l20m" x="310" y="196" text-anchor="middle">ttl would end here</text>');
    var shell = document.createElement('div');
    shell.className = 'mf-shell';
    shell.innerHTML = [
      '<div class="mf-head"><strong>Cache Freshness</strong> a TTL window ends on the clock, unless a notification ends it first</div>',
      '<div class="mf-body">',
      '<svg viewBox="0 0 560 208" role="img" aria-label="Two timelines that share the same t_received. In scenario A the cached response stays fresh until t_received plus ttlMs, then goes stale. In scenario B a list_changed notification arrives before the TTL would have expired, and the response goes stale immediately at the notification, leaving the remaining TTL unused.">',
      parts.join(''),
      '</svg>',
      '</div>',
      '<div class="mf-caption">A cached response stays fresh until its ttlMs runs out, but a relevant list_changed notification invalidates it immediately on arrival, even with time left on the clock. TTL and notifications are complementary, not competing.</div>'
    ].join('');
    host.appendChild(shell);
  }

  function taskStateLifecycleFigure(host) {
    ensureStyles();
    var boxes = [
      { cls: 'l21x', x: 30, y: 24, w: 150, h: 44, tx: 105, ty: 51, label: 'input_required' },
      { cls: 'l21x', x: 30, y: 188, w: 150, h: 44, tx: 105, ty: 215, label: 'working' },
      { cls: 'l21x l21f', x: 380, y: 20, w: 150, h: 40, tx: 455, ty: 44, label: 'completed' },
      { cls: 'l21x l21f', x: 380, y: 110, w: 150, h: 40, tx: 455, ty: 134, label: 'cancelled' },
      { cls: 'l21x l21f', x: 380, y: 200, w: 150, h: 40, tx: 455, ty: 224, label: 'failed' }
    ];
    var parts = [];
    var i;
    for (i = 0; i < boxes.length; i++) {
      var b = boxes[i];
      parts.push('<rect class="' + b.cls + '" x="' + b.x + '" y="' + b.y + '" width="' + b.w + '" height="' + b.h + '" rx="4"/>');
      parts.push('<text class="l21t" x="' + b.tx + '" y="' + b.ty + '">' + b.label + '</text>');
    }
    var edges = [
      ['95', '185', '95', '71', '6', '105', 'needs input'],
      ['118', '71', '118', '185', '132', '155', 'tasks/update'],
      ['183', '193', '377', '42', '250', '128', 'work finishes'],
      ['183', '210', '377', '130', '250', '169', 'tasks/cancel'],
      ['183', '227', '377', '218', '250', '208', 'protocol error']
    ];
    for (i = 0; i < edges.length; i++) {
      var e = edges[i];
      parts.push('<line class="l21a" x1="' + e[0] + '" y1="' + e[1] + '" x2="' + e[2] + '" y2="' + e[3] + '" marker-end="url(#l21arrow)"/>');
      parts.push('<text class="l21e" x="' + e[4] + '" y="' + e[5] + '">' + e[6] + '</text>');
    }
    var shell = document.createElement('div');
    shell.className = 'mf-shell';
    shell.innerHTML = [
      '<div class="mf-head"><strong>Task Status Lifecycle</strong> working pauses at input_required until tasks/update resumes it, then ends in one terminal status</div>',
      '<div class="mf-body">',
      '<svg viewBox="0 0 560 260" role="img" aria-label="State diagram of an MCP task. Working moves to input_required when the server needs client input, and back to working after a tasks/update call. Working moves to completed when the work finishes, to cancelled after tasks/cancel, or to failed on a protocol error. Completed, cancelled, and failed are terminal and shown with a dashed border.">',
      '<defs><marker id="l21arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path class="l21p" d="M0,0 L10,5 L0,10 Z"/></marker></defs>',
      '<style>.l21x{fill:var(--bg-surface,#eee);stroke:var(--ink-soft,#999);stroke-width:1.2}.l21f{stroke-dasharray:4,2}.l21t{fill:var(--ink,#111);font:12px var(--font-mono,monospace);text-anchor:middle}.l21a{stroke:var(--blueprint,#3553ff);stroke-width:1.6;fill:none}.l21p{fill:var(--blueprint,#3553ff)}.l21e{fill:var(--ink-mute,#666);font:11px var(--font-mono,monospace)}</style>',
      parts.join(''),
      '</svg>',
      '</div>',
      '<div class="mf-caption">Every tasks/get poll repeats a working snapshot until a terminal status arrives; that self-loop is not drawn. A cancel or a protocol error can also end a task directly from input_required. SEP-2663 inlines the completed result and the failed error into this same tasks/get response; there is no separate tasks/result call.</div>'
    ].join('');
    host.appendChild(shell);
  }

  function trustZonesFigure(host) {
    ensureStyles();
    var shell = document.createElement('div');
    shell.className = 'mf-shell';
    shell.innerHTML = [
      '<div class="mf-head"><strong>Trust Zones in an MCP Exchange</strong> host and client trusted, server and upstream untrusted, the model reads only labeled content</div>',
      '<div class="mf-body">',
      '<svg viewBox="0 0 560 230" role="img" aria-label="Host, client, and model sit inside a trusted zone on the left, connected by short arrows. A dashed trust boundary separates them from the server zone on the right. A request crosses the boundary to the server. Content returning from the server crosses back through a trust filter marked untrusted before the model reads it. The server connects onward to upstream systems that the client never sees directly.">',
      '<style>.tz22x{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.tz22t{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}.tz22l{fill:var(--ink-mute,#777);font:11px var(--font-mono,monospace)}.tz22z{fill:none;stroke:var(--rule-soft,#ccc);stroke-dasharray:3,3}.tz22a{stroke:var(--blueprint,#3553ff);fill:none;stroke-width:1.5}.tz22r{stroke:var(--ink-mute,#999);fill:none;stroke-width:1.4;stroke-dasharray:4,3}.tz22u{stroke:var(--ink-mute,#999);fill:none;stroke-width:1.2;stroke-dasharray:2,3}.tz22g{fill:var(--bg-surface,#eee);stroke:var(--blueprint,#3553ff);stroke-width:2}</style>',
      '<text class="tz22l" x="91" y="18" text-anchor="middle">trusted zone</text>',
      '<text class="tz22l" x="380" y="18" text-anchor="middle">untrusted zone</text>',
      '<rect class="tz22z" x="8" y="26" width="166" height="180"/>',
      '<line class="tz22z" x1="190" y1="26" x2="190" y2="206"/>',
      '<text class="tz22l" x="196" y="34">trust boundary</text>',
      '<rect class="tz22x" x="20" y="40" width="140" height="36"/>',
      '<text class="tz22t" x="32" y="56">host</text>',
      '<text class="tz22l" x="32" y="70">the user\'s app</text>',
      '<rect class="tz22x" x="20" y="88" width="140" height="36"/>',
      '<text class="tz22t" x="32" y="104">client</text>',
      '<text class="tz22l" x="32" y="118">one per server</text>',
      '<rect class="tz22x" x="20" y="156" width="140" height="40"/>',
      '<text class="tz22t" x="32" y="174">model</text>',
      '<text class="tz22l" x="32" y="188">sees labeled data</text>',
      '<rect class="tz22x" x="230" y="94" width="110" height="36"/>',
      '<text class="tz22t" x="242" y="110">server</text>',
      '<text class="tz22l" x="242" y="124">third party</text>',
      '<rect class="tz22x" x="390" y="94" width="140" height="36"/>',
      '<text class="tz22t" x="402" y="110">upstream systems</text>',
      '<text class="tz22l" x="402" y="124">once removed</text>',
      '<path class="tz22a" d="M90 76 L90 88" marker-end="url(#tz22arrow)"/>',
      '<path class="tz22a" d="M90 124 L90 156" marker-end="url(#tz22arrow)"/>',
      '<path class="tz22a" d="M160 98 L230 98" marker-end="url(#tz22arrow)"/>',
      '<path class="tz22r" d="M230 118 L160 118" marker-end="url(#tz22arrowm)"/>',
      '<path class="tz22u" d="M340 112 L390 112" marker-end="url(#tz22arrowm)"/>',
      '<polygon class="tz22g" points="190,90 206,108 190,126 174,108"/>',
      '<text class="tz22l" x="195" y="142" text-anchor="middle">trust filter</text>',
      '<defs>',
      '<marker id="tz22arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="var(--blueprint,#3553ff)"/></marker>',
      '<marker id="tz22arrowm" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="var(--ink-mute,#999)"/></marker>',
      '</defs>',
      '</svg>',
      '</div>',
      '<div class="mf-caption">The host and the client it owns sit with the model inside one trust domain. A request crosses the dashed boundary to reach the server; whatever the server returns crosses back through the trust filter, marked untrusted, before the model reads it. The server may reach further upstream systems that the client never observes directly.</div>'
    ].join('');
    host.appendChild(shell);
  }

  function oauthFlowFigure(host) {
    ensureStyles();
    var shell = document.createElement('div');
    shell.className = 'mf-shell';
    var svg = [
      '<svg viewBox="0 0 560 228" role="img" aria-label="Three lanes. Top: the client calls tools/call with no token and the server replies HTTP 401 with a WWW-Authenticate header naming the Protected Resource Metadata URL, no JSON-RPC body. Middle: the client discovers Protected Resource Metadata and authorization server metadata, generates a PKCE S256 pair, and the authorization server returns a code and an iss value the client checks against what it recorded. Bottom: the client retries the same tools/call with an Authorization Bearer header and the server returns a complete result after validating the token audience.">',
      '<style>',
      '.l23x{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}',
      '.l23t{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}',
      '.l23h{fill:var(--ink,#111);font:12px var(--font-mono,monospace);font-weight:700}',
      '.l23lbl{fill:var(--ink-soft,#555);font:11px var(--font-mono,monospace)}',
      '.l23ok{stroke:var(--blueprint,#3553ff);stroke-width:1.6;fill:none}',
      '.l23no{stroke:var(--ink-mute,#888);stroke-width:1.4;fill:none;stroke-dasharray:4 3}',
      '</style>',
      '<marker id="l23arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--blueprint,#3553ff)"/></marker>',
      '<marker id="l23arrowmute" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--ink-mute,#888)"/></marker>',
      '<text class="l23h" x="16" y="24">1. tools/call with no token</text>',
      '<rect class="l23x" x="16" y="34" width="84" height="24"/><text class="l23t" x="26" y="50">client</text>',
      '<rect class="l23x" x="460" y="34" width="84" height="24"/><text class="l23t" x="466" y="50">mcp server</text>',
      '<line class="l23no" x1="100" y1="46" x2="460" y2="46" marker-end="url(#l23arrowmute)"/>',
      '<text class="l23lbl" x="280" y="38" text-anchor="middle">tools/call, no Authorization header</text>',
      '<text class="l23lbl" x="280" y="60" text-anchor="middle">401 + WWW-Authenticate: resource_metadata=...</text>',
      '<text class="l23h" x="16" y="100">2. discover, PKCE, authorize</text>',
      '<rect class="l23x" x="16" y="110" width="84" height="24"/><text class="l23t" x="26" y="126">client</text>',
      '<rect class="l23x" x="460" y="110" width="84" height="24"/><text class="l23t" x="466" y="126">auth server</text>',
      '<line class="l23ok" x1="100" y1="122" x2="460" y2="122" marker-end="url(#l23arrow)"/>',
      '<text class="l23lbl" x="280" y="114" text-anchor="middle">PRM + AS metadata + S256 challenge + resource + state</text>',
      '<text class="l23lbl" x="280" y="136" text-anchor="middle">code + iss checked against the recorded issuer</text>',
      '<text class="l23h" x="16" y="176">3. retry with a bearer token</text>',
      '<rect class="l23x" x="16" y="186" width="84" height="24"/><text class="l23t" x="26" y="202">client</text>',
      '<rect class="l23x" x="460" y="186" width="84" height="24"/><text class="l23t" x="466" y="202">mcp server</text>',
      '<line class="l23ok" x1="100" y1="198" x2="460" y2="198" marker-end="url(#l23arrow)"/>',
      '<text class="l23lbl" x="280" y="190" text-anchor="middle">tools/call, Authorization: Bearer &lt;token&gt;</text>',
      '<text class="l23lbl" x="280" y="212" text-anchor="middle">200, resultType complete (audience validated)</text>',
      '</svg>'
    ].join('');
    shell.innerHTML = [
      '<div class="mf-head"><strong>Authorizing an MCP Request</strong> a 401, a round trip to the authorization server, then a bearer-authenticated retry</div>',
      '<div class="mf-body">',
      svg,
      '</div>',
      '<div class="mf-caption">Rejection happens at the HTTP layer with no JSON-RPC body. The middle lane resolves entirely outside the MCP wire: Protected Resource Metadata, authorization server metadata, PKCE, and an iss check the client applies itself. Only the retried tools/call, now carrying a bearer token whose audience matches this server, reaches the tool.</div>'
    ].join('');
    host.appendChild(shell);
  }

  function registrationPathsFigure(host) {
    ensureStyles();
    var steps = [
      { rank: '1', label: 'Pre-registered credentials', detail: 'client id already on file', deprecated: false },
      { rank: '2', label: 'Client ID Metadata Document', detail: 'AS advertises CIMD support', deprecated: false },
      { rank: '3', label: 'Dynamic Client Registration', detail: 'deprecated fallback via DCR', deprecated: true },
      { rank: '4', label: 'Ask the user', detail: 'no automated path available', deprecated: false }
    ];
    var checklist = [
      'client_id equals the URL',
      'https scheme with a path',
      'redirect_uris validated',
      'kept keyed by issuer'
    ];
    var rowH = 54;
    var gapY = 16;
    var top = 18;
    var colX = 8;
    var colW = 300;
    var parts = [];
    var i;
    for (i = 0; i < steps.length; i++) {
      var step = steps[i];
      var y = top + i * (rowH + gapY);
      var boxClass = step.deprecated ? 'l24bd' : 'l24b';
      parts.push('<rect class="' + boxClass + '" x="' + colX + '" y="' + y + '" width="' + colW + '" height="' + rowH + '" rx="4"/>');
      parts.push('<text class="l24r" x="' + (colX + 12) + '" y="' + (y + 22) + '">' + step.rank + '</text>');
      parts.push('<text class="l24l" x="' + (colX + 30) + '" y="' + (y + 22) + '">' + step.label + '</text>');
      parts.push('<text class="l24d" x="' + (colX + 30) + '" y="' + (y + 39) + '">' + step.detail + '</text>');
      if (i < steps.length - 1) {
        var midX = colX + colW / 2;
        var lineY1 = y + rowH;
        var lineY2 = y + rowH + gapY - 4;
        parts.push('<line class="l24a" x1="' + midX + '" y1="' + lineY1 + '" x2="' + midX + '" y2="' + lineY2 + '" marker-end="url(#l24arrow)"/>');
        parts.push('<text class="l24n" x="' + (midX + 10) + '" y="' + (lineY1 + gapY / 2 + 4) + '">if unavailable</text>');
      }
    }
    var panelX = colX + colW + 18;
    var panelW = 560 - panelX - 8;
    var panelTop = top;
    var panelH = steps.length * (rowH + gapY) - gapY;
    parts.push('<rect class="l24p" x="' + panelX + '" y="' + panelTop + '" width="' + panelW + '" height="' + panelH + '" rx="4"/>');
    parts.push('<text class="l24pt" x="' + (panelX + 12) + '" y="' + (panelTop + 22) + '">a CIMD checked like this</text>');
    for (i = 0; i < checklist.length; i++) {
      var cy = panelTop + 46 + i * 46;
      parts.push('<circle class="l24c" cx="' + (panelX + 18) + '" cy="' + cy + '" r="5"/>');
      parts.push('<text class="l24ct" x="' + (panelX + 32) + '" y="' + (cy + 4) + '">' + checklist[i] + '</text>');
    }
    var shell = document.createElement('div');
    shell.className = 'mf-shell';
    shell.innerHTML = [
      '<div class="mf-head"><strong>Client Registration Paths</strong> priority order for a client an authorization server has never met</div>',
      '<div class="mf-body">',
      '<svg viewBox="0 0 560 300" role="img" aria-label="A four step priority ladder: pre-registered credentials, Client ID Metadata Document, Dynamic Client Registration marked deprecated, and asking the user, each tried in order when the one above is unavailable. Beside it, a checklist of what an authorization server verifies in a Client ID Metadata Document and why credentials are kept per issuer.">',
      '<defs><marker id="l24arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path class="l24af" d="M0,0 L8,4 L0,8 z"/></marker></defs>',
      '<style>.l24b{fill:var(--bg-surface,#eee);stroke:var(--blueprint,#3553ff);stroke-width:1.4}.l24bd{fill:var(--bg-surface,#eee);stroke:var(--ink-mute,#999);stroke-width:1.2;stroke-dasharray:4,3}.l24r{fill:var(--blueprint,#3553ff);font:bold 13px var(--font-mono,monospace)}.l24l{fill:var(--ink,#111);font:bold 11px var(--font-mono,monospace)}.l24d{fill:var(--ink-mute,#666);font:11px var(--font-mono,monospace)}.l24a{stroke:var(--ink-mute,#999);stroke-width:1.2}.l24af{fill:var(--ink-mute,#999)}.l24n{fill:var(--ink-soft,#777);font:11px var(--font-mono,monospace)}.l24p{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.l24pt{fill:var(--ink,#111);font:bold 11px var(--font-mono,monospace)}.l24c{fill:var(--blueprint,#3553ff)}.l24ct{fill:var(--ink-mute,#555);font:11px var(--font-mono,monospace)}</style>',
      parts.join(''),
      '</svg>',
      '</div>',
      '<div class="mf-caption">A client tries each path in order and stops at the first one available: pre-registered credentials, then a Client ID Metadata Document if the authorization server advertises it, then Dynamic Client Registration as a deprecated fallback, then asking the user. Credentials from any path are kept keyed by the issuing authorization server and are never reused against a different one.</div>'
    ].join('');
    host.appendChild(shell);
  }

  function consentGatesFigure(host) {
    ensureStyles();
    var shell = document.createElement('div');
    shell.className = 'mf-shell';
    shell.innerHTML = [
      '<div class="mf-head"><strong>Consent and Least Privilege</strong> one tools/call, two independent gates before it runs</div>',
      '<div class="mf-body">',
      '<svg viewBox="0 0 560 210" role="img" aria-label="A client tools/call first meets a scope check. Insufficient scope returns HTTP 403 and the client retries with the union of its old and challenged scopes. Once scope is sufficient the call meets a consent check. If consent is required the server returns input_required and the client retries after an elicitation round trip. Only then does the tool run.">',
      '<style>',
      '.l25box{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}',
      '.l25t{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}',
      '.l25tm{fill:var(--ink-mute,#777);font:11px var(--font-mono,monospace)}',
      '.l25tl{fill:var(--ink-soft,#666);font:11px var(--font-mono,monospace)}',
      '.l25arrow{stroke:var(--blueprint,#3553ff);stroke-width:1.6;fill:none}',
      '.l25loop{stroke:var(--ink-soft,#999);stroke-width:1.2;fill:none;stroke-dasharray:3 2}',
      '.l25m{fill:var(--blueprint,#3553ff)}',
      '</style>',
      '<defs>',
      '<marker id="l25arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path class="l25m" d="M0 0 L6 3 L0 6 Z"/></marker>',
      '<marker id="l25loopend" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path class="l25m" d="M0 0 L6 3 L0 6 Z"/></marker>',
      '</defs>',
      '<rect class="l25box" x="8" y="40" width="88" height="40"/>',
      '<text class="l25t" x="14" y="56">tools/call</text>',
      '<text class="l25tm" x="14" y="70">client sends</text>',
      '<rect class="l25box" x="140" y="40" width="112" height="40"/>',
      '<text class="l25t" x="146" y="56">scope check</text>',
      '<text class="l25tm" x="146" y="70">403 if short</text>',
      '<rect class="l25box" x="304" y="40" width="112" height="40"/>',
      '<text class="l25t" x="310" y="56">consent check</text>',
      '<text class="l25tm" x="310" y="70">input_required</text>',
      '<rect class="l25box" x="468" y="40" width="84" height="40"/>',
      '<text class="l25t" x="474" y="56">tool runs</text>',
      '<text class="l25tm" x="474" y="70">isError: false</text>',
      '<line class="l25arrow" x1="96" y1="60" x2="138" y2="60" marker-end="url(#l25arrow)"/>',
      '<line class="l25arrow" x1="252" y1="60" x2="302" y2="60" marker-end="url(#l25arrow)"/>',
      '<text class="l25tl" x="256" y="52">scope ok</text>',
      '<line class="l25arrow" x1="416" y1="60" x2="466" y2="60" marker-end="url(#l25arrow)"/>',
      '<text class="l25tl" x="420" y="52">consent ok</text>',
      '<path class="l25loop" d="M172 80 C 150 132, 245 132, 222 80" marker-end="url(#l25loopend)"/>',
      '<text class="l25tl" x="137" y="150">403: union + retry</text>',
      '<path class="l25loop" d="M334 80 C 310 132, 410 132, 386 80" marker-end="url(#l25loopend)"/>',
      '<text class="l25tl" x="273" y="150">no consent: elicit, retry</text>',
      '</svg>',
      '</div>',
      '<div class="mf-caption">A tools/call meets the scope gate first: insufficient scope comes back as HTTP 403, and the client retries with the union of its old and newly challenged scopes, capped at a few attempts. Only once scope clears does the call meet the consent gate: a tool needing approval comes back input_required, and the client retries after an elicitation round trip. Either gate can turn a call away on its own.</div>'
    ].join('');
    host.appendChild(shell);
  }

  function attackSurfaceFigure(host) {
    ensureStyles();
    var threats = [
      'poisoned description',
      'rug pull',
      'tool shadowing',
      'token passthrough',
      'requestState tamper',
      'network $ref (SSRF)',
      'DNS rebinding',
      'supply chain drift'
    ];
    var cx = 280;
    var cy = 150;
    var r = 108;
    var boxW = 122;
    var boxH = 24;
    var n = threats.length;
    var spokes = [];
    var nodes = [];
    var labels = [];
    var i;
    for (i = 0; i < n; i++) {
      var angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      var x = cx + r * Math.cos(angle);
      var y = cy + r * Math.sin(angle);
      var bx = x - boxW / 2;
      var by = y - boxH / 2;
      spokes.push('<line class="l26l" x1="' + cx + '" y1="' + cy + '" x2="' + x.toFixed(1) + '" y2="' + y.toFixed(1) + '"/>');
      nodes.push('<rect class="l26x" x="' + bx.toFixed(1) + '" y="' + by.toFixed(1) + '" width="' + boxW + '" height="' + boxH + '" rx="3"/>');
      labels.push('<text class="l26t" x="' + (bx + 6).toFixed(1) + '" y="' + (by + 15).toFixed(1) + '">' + threats[i] + '</text>');
    }
    var shell = document.createElement('div');
    shell.className = 'mf-shell';
    shell.innerHTML = [
      '<div class="mf-head"><strong>Attack Surface Around a Tool Call</strong> eight threats a gateway still faces after consent and OAuth are both correct</div>',
      '<div class="mf-body">',
      '<svg viewBox="0 0 560 300" role="img" aria-label="A central gateway node surrounded by eight labeled threats: poisoned description, rug pull, tool shadowing, token passthrough, requestState tamper, network dollar-ref SSRF, DNS rebinding, and supply chain drift, each connected to the gateway by a spoke.">',
      '<style>.l26x{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.l26t{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}.l26l{stroke:var(--ink-mute,#999);stroke-width:1;opacity:.8}.l26g{fill:var(--bg,#fff);stroke:var(--blueprint,#3553ff);stroke-width:1.6}.l26gt{fill:var(--ink,#111);font:11px var(--font-mono,monospace);font-weight:600}.l26gc{fill:var(--ink-soft,#555);font:11px var(--font-mono,monospace)}</style>',
      spokes.join(''),
      '<circle class="l26g" cx="' + cx + '" cy="' + cy + '" r="46"/>',
      '<text class="l26gt" x="' + (cx - 28) + '" y="' + (cy - 4) + '">gateway</text>',
      '<text class="l26gc" x="' + (cx - 38) + '" y="' + (cy + 13) + '">pin . scan . limit</text>',
      nodes.join(''),
      labels.join(''),
      '</svg>',
      '</div>',
      '<div class="mf-caption">Each spoke names one threat this lesson covers. The gateway at the center holds the controls that answer them: definition pinning and quarantine for rug pulls, an injection scanner for poisoned descriptions, server-qualified names against shadowing, audience validation against passthrough, integrity-protected state, a refusal to auto-dereference network references, and admission pinning against supply chain drift, so no single control has to catch everything alone.</div>'
    ].join('');
    host.appendChild(shell);
  }

  function tracePropagationFigure(host) {
    ensureStyles();
    var shell = document.createElement('div');
    shell.className = 'mf-shell';
    shell.innerHTML = [
      '<div class="mf-head"><strong>Trace Propagation and the Audit Chain</strong> one trace id, three programs, two independent logs</div>',
      '<div class="mf-body">',
      '<svg viewBox="0 0 560 170" role="img" aria-label="A client calls ops-desk, which calls credential-vault. Both arrows carry the same trace id and a different span id per hop. Below ops-desk and credential-vault, two separate three-entry hash chains represent each server keeping its own independent audit log.">',
      '<style>.tpfbox{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.tpft{fill:var(--ink,#111);font:11px var(--font-mono,monospace);text-anchor:middle}.tpfl{fill:var(--ink-mute,#767676);font:11px var(--font-mono,monospace);text-anchor:middle}.tpfarrow{stroke:var(--blueprint,#3553ff);stroke-width:1.5;fill:none}.tpfchain{fill:var(--bg-surface,#eee);stroke:var(--blueprint,#3553ff)}.tpfchainline{stroke:var(--blueprint,#3553ff);stroke-width:1.3}</style>',
      '<rect class="tpfbox" x="8" y="20" width="92" height="34"/><text class="tpft" x="54" y="41">client</text>',
      '<rect class="tpfbox" x="234" y="20" width="92" height="34"/><text class="tpft" x="280" y="41">ops-desk</text>',
      '<rect class="tpfbox" x="460" y="20" width="92" height="34"/><text class="tpft" x="506" y="41">cred-vault</text>',
      '<path class="tpfarrow" d="M100 37 L228 37" marker-end="url(#tpfarrow)"/>',
      '<path class="tpfarrow" d="M326 37 L454 37" marker-end="url(#tpfarrow)"/>',
      '<text class="tpfl" x="167" y="64">trace a1e4c9d0</text><text class="tpfl" x="167" y="78">span 5f2b8e13</text>',
      '<text class="tpfl" x="393" y="64">trace a1e4c9d0</text><text class="tpfl" x="393" y="78">span d40a7c66</text>',
      '<text class="tpfl" x="280" y="104">own audit log</text>',
      '<text class="tpfl" x="506" y="104">own audit log</text>',
      '<rect class="tpfchain" x="245" y="112" width="14" height="14" rx="2"/><rect class="tpfchain" x="273" y="112" width="14" height="14" rx="2"/><rect class="tpfchain" x="301" y="112" width="14" height="14" rx="2"/>',
      '<line class="tpfchainline" x1="259" y1="119" x2="273" y2="119"/><line class="tpfchainline" x1="287" y1="119" x2="301" y2="119"/>',
      '<rect class="tpfchain" x="471" y="112" width="14" height="14" rx="2"/><rect class="tpfchain" x="499" y="112" width="14" height="14" rx="2"/><rect class="tpfchain" x="527" y="112" width="14" height="14" rx="2"/>',
      '<line class="tpfchainline" x1="485" y1="119" x2="499" y2="119"/><line class="tpfchainline" x1="513" y1="119" x2="527" y2="119"/>',
      '<text class="tpfl" x="280" y="148">same trace id above, its own hash chain below</text>',
      '<text class="tpfl" x="506" y="148">same trace id above, its own hash chain below</text>',
      '<defs><marker id="tpfarrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="var(--blueprint,#3553ff)"/></marker></defs>',
      '</svg>',
      '</div>',
      '<div class="mf-caption">The trace id stays constant across both hops while each arrow mints its own span id. ops-desk and credential-vault each keep an independent, hash-chained audit log: neither log reads or writes the other’s entries, so the only thing that ties one server’s entry to the other’s is a shared trace id, never a shared request id.</div>'
    ].join('');
    host.appendChild(shell);
  }

  function rolesMapFigure(host) {
    ensureStyles();
    var panels = [
      {
        title: 'stdio',
        x: 8,
        rows: [
          { t: 'author: discover', f: false },
          { t: 'operator: env creds', f: true },
          { t: 'user: can deny call', f: false }
        ]
      },
      {
        title: 'http, no gateway',
        x: 196,
        rows: [
          { t: 'author: PRM, origin', f: true },
          { t: 'client: RFC 8707', f: false },
          { t: 'governance: tokens', f: false }
        ]
      },
      {
        title: 'gateway-fronted',
        x: 384,
        rows: [
          { t: 'operator: origin', f: true },
          { t: 'author: keeps PRM', f: false },
          { t: 'governance: tokens', f: false }
        ]
      }
    ];
    var panelWidth = 168;
    var headerHeight = 26;
    var rowHeight = 34;
    var bodyTop = 30;
    var parts = [];
    var i;
    var j;
    for (i = 0; i < panels.length; i++) {
      var panel = panels[i];
      var bodyHeight = headerHeight + panel.rows.length * rowHeight + 10;
      parts.push('<rect class="l28p" x="' + panel.x + '" y="' + bodyTop + '" width="' + panelWidth + '" height="' + bodyHeight + '" rx="4"/>');
      parts.push('<rect class="l28h" x="' + panel.x + '" y="' + bodyTop + '" width="' + panelWidth + '" height="' + headerHeight + '" rx="4"/>');
      parts.push('<text class="l28ht" x="' + (panel.x + 9) + '" y="' + (bodyTop + 17) + '">' + panel.title + '</text>');
      for (j = 0; j < panel.rows.length; j++) {
        var row = panel.rows[j];
        var rowY = bodyTop + headerHeight + 14 + j * rowHeight;
        var markerClass = row.f ? 'l28f' : 'l28k';
        parts.push('<circle class="' + markerClass + '" cx="' + (panel.x + 13) + '" cy="' + rowY + '" r="6"/>');
        if (row.f) {
          parts.push('<text class="l28m" x="' + (panel.x + 13) + '" y="' + (rowY + 4) + '">!</text>');
        }
        parts.push('<text class="l28t" x="' + (panel.x + 26) + '" y="' + (rowY + 4) + '">' + row.t + '</text>');
      }
    }
    var shell = document.createElement('div');
    shell.className = 'mf-shell';
    shell.innerHTML = [
      '<div class="mf-head"><strong>Roles Map</strong> the same MUST, three deployments, two different owners</div>',
      '<div class="mf-body">',
      '<svg viewBox="0 0 560 200" role="img" aria-label="Three panels: stdio, plain HTTP with no gateway, and a gateway-fronted deployment. Each panel names which role owns a sample of that shape\'s MUST and SHOULD requirements. The origin validation requirement is flagged in both HTTP panels: the server author owns it under plain HTTP, but ownership moves to the platform or gateway operator once a gateway sits in front of the server.">',
      '<style>.l28p{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.l28h{fill:none;stroke:var(--rule-soft,#ccc)}.l28ht{fill:var(--ink,#111);font:bold 11px var(--font-mono,monospace)}.l28t{fill:var(--ink-mute,#555);font:11px var(--font-mono,monospace)}.l28k{fill:var(--blueprint,#3553ff)}.l28f{fill:#c94a34}.l28m{fill:#fff;font:bold 9px var(--font-mono,monospace);text-anchor:middle}.l28c{fill:var(--ink-soft,#777);font:11px var(--font-mono,monospace)}</style>',
      parts.join(''),
      '<text class="l28c" x="8" y="188">circle marks the owner; the flagged row is the requirement that changes owner</text>',
      '</svg>',
      '</div>',
      '<div class="mf-caption">Adoption changes who signs up for a MUST, not whether it still applies. Origin validation is a server MUST in every HTTP-reachable deployment; plain HTTP leaves it with the server author, and a gateway-fronted deployment moves it to the platform or gateway operator who terminates the connection first.</div>'
    ].join('');
    host.appendChild(shell);
  }

  function useCaseMatrixFigure(host) {
    ensureStyles();
    var header = ['use case', 'primitive', 'transport', 'extension'];
    var rows = [
      ['developer tools', 'tool', 'stdio', 'none'],
      ['data access', 'resource', 'http', 'none'],
      ['long job', 'tool', 'http', 'tasks'],
      ['interactive UI', 'tool', 'http', 'ui'],
      ['reusable flow', 'prompt', 'http', 'skills'],
      ['M2M sync', 'tool', 'http', 'auth-cc']
    ];
    var colX = [8, 148, 250, 352, 452];
    var colW = [140, 102, 102, 100, 100];
    var rowH = 28;
    var headerH = 28;
    var top = 20;
    var parts = [];
    var i;
    var c;
    parts.push('<rect class="l29g" x="' + colX[0] + '" y="' + top + '" width="544" height="' + (headerH + rows.length * rowH) + '" rx="4"/>');
    parts.push('<rect class="l29hh" x="' + colX[0] + '" y="' + top + '" width="544" height="' + headerH + '" rx="4"/>');
    for (c = 0; c < header.length; c++) {
      parts.push('<text class="l29ht" x="' + (colX[c] + 8) + '" y="' + (top + 18) + '">' + header[c] + '</text>');
    }
    for (i = 0; i < rows.length; i++) {
      var rowY = top + headerH + i * rowH;
      if (i % 2 === 1) {
        parts.push('<rect class="l29z" x="' + colX[0] + '" y="' + rowY + '" width="544" height="' + rowH + '"/>');
      }
      for (c = 0; c < rows[i].length; c++) {
        var cls = c === 0 ? 'l29lbl' : 'l29rt';
        parts.push('<text class="' + cls + '" x="' + (colX[c] + 8) + '" y="' + (rowY + 19) + '">' + rows[i][c] + '</text>');
      }
    }
    for (c = 1; c < colX.length; c++) {
      parts.push('<line class="l29v" x1="' + colX[c] + '" y1="' + top + '" x2="' + colX[c] + '" y2="' + (top + headerH + rows.length * rowH) + '"/>');
    }
    var shell = document.createElement('div');
    shell.className = 'mf-shell';
    shell.innerHTML = [
      '<div class="mf-head"><strong>Operational Use Case Matrix</strong> six scenarios, four questions each</div>',
      '<div class="mf-body">',
      '<svg viewBox="0 0 560 220" role="img" aria-label="A table of six operational use cases (developer tools, data access, long job, interactive UI, reusable flow, machine to machine sync) against the MCP primitive, transport, and extension each one recommends. Developer tools takes a tool over stdio with no extension. Data access takes a resource over HTTP. A long job takes a tool with the tasks extension. An interactive UI takes a tool with the MCP Apps ui extension. A reusable flow takes a prompt with the skills extension. Machine to machine sync takes a tool with the OAuth client credentials extension.">',
      '<style>.l29g{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.l29hh{fill:var(--blueprint,#3553ff);opacity:.12}.l29ht{fill:var(--ink,#111);font:bold 11px var(--font-mono,monospace)}.l29lbl{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}.l29rt{fill:var(--ink-mute,#555);font:11px var(--font-mono,monospace)}.l29z{fill:var(--ink-soft,#777);opacity:.06}.l29v{stroke:var(--rule-soft,#ccc);stroke-width:.6}.l29c{fill:var(--ink-soft,#777);font:11px var(--font-mono,monospace)}</style>',
      parts.join(''),
      '<text class="l29c" x="8" y="216">http stands for streamable-http; auth-cc stands for the OAuth client credentials extension</text>',
      '</svg>',
      '</div>',
      '<div class="mf-caption">Four questions, who initiates the call, how sensitive is the data, how long does it run, and does it need an interactive surface, pick the primitive, the transport, the auth path, and the extension for each use case in this lesson\'s catalog.</div>'
    ].join('');
    host.appendChild(shell);
  }

  function extensionNegotiationFigure(host) {
    ensureStyles();
    var shell = document.createElement('div');
    shell.className = 'mf-shell';
    var svg = [
      '<svg viewBox="0 0 560 248" role="img" aria-label="Two boxes show what the client declares in its per-request clientCapabilities.extensions and what the server declares in its server/discover capabilities.extensions. A solid line converges the identifier present in both into an active box; dashed lines show identifiers only one side declared. Below, three outcomes: both sides declaring an optional extension gives an enhanced response, only one side declaring it gives a core fallback, and a required extension that is not mutually active is rejected with -32021.">',
      '<style>',
      '.l30x{fill:none;stroke:var(--rule-soft,#ccc)}',
      '.l30c{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}',
      '.l30active{fill:var(--bg-surface,#eee);stroke:var(--blueprint,#3553ff);stroke-width:1.4}',
      '.l30t{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}',
      '.l30h{fill:var(--ink,#111);font:12px var(--font-mono,monospace);font-weight:700}',
      '.l30lbl{fill:var(--ink-soft,#555);font:11px var(--font-mono,monospace)}',
      '.l30ok{stroke:var(--blueprint,#3553ff);stroke-width:1.6;fill:none}',
      '.l30no{stroke:var(--ink-mute,#999);stroke-width:1.2;fill:none;stroke-dasharray:4 3}',
      '.l30bok{fill:var(--blueprint,#3553ff)}',
      '.l30bno{fill:var(--bg-surface,#eee);stroke:var(--ink-mute,#999);stroke-dasharray:3 2}',
      '.l30brej{fill:var(--ink,#111)}',
      '</style>',
      '<marker id="l30arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--blueprint,#3553ff)"/></marker>',
      '<marker id="l30arrowmute" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--ink-mute,#999)"/></marker>',
      '<text class="l30h" x="16" y="26">client _meta declares</text>',
      '<text class="l30h" x="304" y="26">server capabilities declares</text>',
      '<rect class="l30x" x="16" y="34" width="240" height="70" rx="4"/>',
      '<rect class="l30x" x="304" y="34" width="240" height="70" rx="4"/>',
      '<rect class="l30c" x="26" y="44" width="220" height="20" rx="3"/><text class="l30t" x="32" y="58">io.modelcontextprotocol/ui</text>',
      '<rect class="l30c" x="26" y="70" width="220" height="20" rx="3"/><text class="l30t" x="32" y="84">com.example/priority-routing</text>',
      '<rect class="l30c" x="314" y="44" width="220" height="20" rx="3"/><text class="l30t" x="320" y="58">com.example/priority-routing</text>',
      '<rect class="l30c" x="314" y="70" width="220" height="20" rx="3"/><text class="l30t" x="320" y="84">io.modelcontextprotocol/tasks</text>',
      '<line class="l30no" x1="136" y1="64" x2="96" y2="118"/>',
      '<line class="l30no" x1="424" y1="90" x2="464" y2="118" marker-end="url(#l30arrowmute)"/>',
      '<line class="l30ok" x1="136" y1="104" x2="270" y2="132" marker-end="url(#l30arrow)"/>',
      '<line class="l30ok" x1="424" y1="104" x2="290" y2="132" marker-end="url(#l30arrow)"/>',
      '<rect class="l30active" x="150" y="132" width="260" height="28" rx="4"/>',
      '<text class="l30t" x="160" y="150">active: com.example/priority-routing</text>',
      '<rect class="l30bok" x="16" y="176" width="12" height="12"/>',
      '<text class="l30lbl" x="36" y="186">both sides declare an optional extension: it activates, response is enhanced</text>',
      '<rect class="l30bno" x="16" y="198" width="12" height="12"/>',
      '<text class="l30lbl" x="36" y="208">only one side declares it: the call falls back to core behavior</text>',
      '<rect class="l30brej" x="16" y="220" width="12" height="12"/>',
      '<text class="l30lbl" x="36" y="230">required but not mutually active: the call is rejected, -32021</text>',
      '</svg>'
    ].join('');
    shell.innerHTML = [
      '<div class="mf-head"><strong>The Extensions Framework</strong> per-request negotiation, then activate, fall back, or reject</div>',
      '<div class="mf-body">',
      svg,
      '</div>',
      '<div class="mf-caption">The client declares extensions in _meta[\'io.modelcontextprotocol/clientCapabilities\'].extensions on every request; the server declares its own in server/discover capabilities.extensions. Only an identifier both sides name becomes active. An unmatched optional extension falls back to core behavior; an unmatched mandatory extension gets MissingRequiredClientCapability, -32021, naming what was needed.</div>'
    ].join('');
    host.appendChild(shell);
  }

  function appSandboxFigure(host) {
    ensureStyles();
    var shell = document.createElement('div');
    shell.className = 'mf-shell';
    shell.innerHTML = [
      '<div class="mf-head"><strong>Rendering an Interactive Interface</strong> negotiate, review, then render or fall back</div>',
      '<div class="mf-body">',
      '<svg viewBox="0 0 560 260" role="img" aria-label="A tool\'s ui resource flows from the server through a host review of its mime type and CSP origins, either rendering inside a sandboxed iframe that requests further tool calls through a consent gate back to the server, or falling back to plain text when the extension is not declared or the review fails.">',
      '<style>.l31x{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.l31d{fill:var(--bg-surface,#eee);stroke:var(--blueprint,#3553ff);stroke-dasharray:4,3}.l31t{fill:var(--ink,#111);font:11px var(--font-mono,monospace);font-weight:600}.l31l{fill:var(--ink-mute,#777);font:11px var(--font-mono,monospace)}.l31a{stroke:var(--blueprint,#3553ff);fill:none;stroke-width:1.5}</style>',
      '<text class="l31l" x="10" y="16">negotiate the ui extension per request, then review before rendering</text>',
      '<rect class="l31x" x="8" y="92" width="84" height="56"/>',
      '<text class="l31t" x="16" y="114">server</text>',
      '<text class="l31l" x="16" y="132">tool + ui</text>',
      '<rect class="l31x" x="126" y="92" width="104" height="56"/>',
      '<text class="l31t" x="134" y="114">review</text>',
      '<text class="l31l" x="134" y="132">mime + csp</text>',
      '<rect class="l31x" x="270" y="92" width="120" height="56"/>',
      '<text class="l31t" x="278" y="114">app view</text>',
      '<text class="l31l" x="278" y="132">in sandbox</text>',
      '<rect class="l31x" x="426" y="92" width="110" height="56"/>',
      '<text class="l31t" x="434" y="114">consent</text>',
      '<text class="l31l" x="434" y="132">tool call</text>',
      '<rect class="l31d" x="128" y="190" width="100" height="38"/>',
      '<text class="l31t" x="136" y="206">fallback</text>',
      '<text class="l31l" x="136" y="220">no ui ext</text>',
      '<path class="l31a" d="M92 120 L126 120" marker-end="url(#l31arrow)"/>',
      '<text class="l31l" x="40" y="84">resources/read</text>',
      '<path class="l31a" d="M230 120 L270 120" marker-end="url(#l31arrow)"/>',
      '<text class="l31l" x="200" y="84">review passes</text>',
      '<path class="l31a" d="M390 120 L426 120" marker-end="url(#l31arrow)"/>',
      '<text class="l31l" x="355" y="84">app requests call</text>',
      '<path class="l31a" d="M178 148 L178 190" marker-end="url(#l31arrow)"/>',
      '<text class="l31l" x="186" y="172">reject</text>',
      '<path class="l31a" d="M481 148 L481 240 L50 240 L50 148" marker-end="url(#l31arrow)"/>',
      '<text class="l31l" x="250" y="232">tools/call, new id</text>',
      '<defs><marker id="l31arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="var(--blueprint,#3553ff)"/></marker></defs>',
      '</svg>',
      '</div>',
      '<div class="mf-caption">A tool\'s ui:// resource only becomes a sandboxed app after the host checks its mime type and CSP origins against its own allowlist; failing either check, or never declaring the extension at all, routes to the same text fallback every tool already returns. An app-initiated tool call still crosses the host\'s consent gate before it reaches the server as an ordinary tools/call.</div>'
    ].join('');
    host.appendChild(shell);
  }

  function registryGatewayFigure(host) {
    ensureStyles();
    var parts = [];
    function box(cls, x, y, w, h, title, sub, titleCls, subCls) {
      parts.push('<rect class="' + cls + '" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="4"/>');
      parts.push('<text class="' + (titleCls || 'l32bt') + '" x="' + (x + 10) + '" y="' + (y + 18) + '">' + title + '</text>');
      if (sub) {
        parts.push('<text class="' + (subCls || 'l32bs') + '" x="' + (x + 10) + '" y="' + (y + 34) + '">' + sub + '</text>');
      }
    }
    function arrow(cls, marker, x1, y1, x2, y2) {
      parts.push('<line class="' + cls + '" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" marker-end="url(#' + marker + ')"/>');
    }
    function label(x, y, text) {
      parts.push('<text class="l32n" x="' + x + '" y="' + y + '">' + text + '</text>');
    }

    box('l32b', 30, 20, 120, 44, 'Publisher', 'proves owner');
    box('l32b', 200, 20, 150, 44, 'Registry', 'server.json');
    box('l32b', 420, 20, 120, 44, 'Aggregator', 'polls hourly');
    arrow('l32a', 'l32arrow', 150, 42, 200, 42);
    arrow('l32a', 'l32arrow', 350, 42, 420, 42);
    label(148, 14, 'verified');
    label(358, 14, 'polled');
    label(30, 78, 'public listings only; the registry is a preview');

    box('l32b', 30, 104, 110, 44, 'Client', 'the caller');
    box('l32b', 190, 104, 170, 44, 'Gateway', 'header = body?');
    box('l32b', 410, 104, 120, 44, 'Backend', 'Tier 1 SDK');
    box('l32bx', 190, 180, 170, 40, '-32020', 'header != body');
    arrow('l32a', 'l32arrow', 140, 126, 190, 126);
    arrow('l32am', 'l32arrowm', 360, 126, 410, 126);
    arrow('l32a', 'l32arrow', 275, 148, 275, 180);
    label(370, 118, 'match');
    label(283, 172, 'mismatch');

    label(30, 246, 'SDK conformance tiers, checked continuously');
    box('l32tb', 30, 256, 160, 46, 'Tier 1', '100% conformance', 'l32tt', 'l32ts');
    box('l32tb', 210, 256, 160, 46, 'Tier 2', '80% conformance', 'l32tt', 'l32ts');
    box('l32tb', 390, 256, 160, 46, 'Tier 3', 'experimental', 'l32tt', 'l32ts');

    var shell = document.createElement('div');
    shell.className = 'mf-shell';
    shell.innerHTML = [
      '<div class="mf-head"><strong>Finding, Routing To, and Trusting a Server</strong> registry admission, gateway header checks, and SDK tiers as three separate gates</div>',
      '<div class="mf-body">',
      '<svg viewBox="0 0 560 320" role="img" aria-label="A publisher proves namespace ownership before the registry admits a server.json entry, which an aggregator polls on its own schedule. Separately, a client request to a gateway is routed only after its Mcp-Method and Mcp-Name headers are checked against the request body: a match reaches a Tier 1 backend, a mismatch is rejected as error -32020 before any backend is touched. Below, three SDK conformance tier badges show the pass rate each tier requires, checked continuously rather than once.">',
      '<defs>',
      '<marker id="l32arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path class="l32af" d="M0,0 L8,4 L0,8 z"/></marker>',
      '<marker id="l32arrowm" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path class="l32afm" d="M0,0 L8,4 L0,8 z"/></marker>',
      '</defs>',
      '<style>',
      '.l32b{fill:var(--bg-surface,#eee);stroke:var(--blueprint,#3553ff);stroke-width:1.4}',
      '.l32bx{fill:var(--bg-surface,#eee);stroke:var(--ink-mute,#999);stroke-width:1.2;stroke-dasharray:4,3}',
      '.l32bt{fill:var(--ink,#111);font:bold 11px var(--font-mono,monospace)}',
      '.l32bs{fill:var(--ink-mute,#666);font:11px var(--font-mono,monospace)}',
      '.l32a{stroke:var(--ink-mute,#999);stroke-width:1.2}',
      '.l32am{stroke:var(--blueprint,#3553ff);stroke-width:1.6}',
      '.l32af{fill:var(--ink-mute,#999)}',
      '.l32afm{fill:var(--blueprint,#3553ff)}',
      '.l32n{fill:var(--ink-soft,#777);font:11px var(--font-mono,monospace)}',
      '.l32tb{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}',
      '.l32tt{fill:var(--blueprint,#3553ff);font:bold 11px var(--font-mono,monospace)}',
      '.l32ts{fill:var(--ink-mute,#666);font:11px var(--font-mono,monospace)}',
      '</style>',
      parts.join(''),
      '</svg>',
      '</div>',
      '<div class="mf-caption">A verified namespace gets a server.json into the registry, where only an aggregator reads it on its own schedule. That is unrelated to whether any one request later reaches a backend: a gateway checks Mcp-Method and Mcp-Name against the request body first, routes a match to the backend, and rejects a mismatch as -32020 before it goes further. An SDK tier badge is a third, independent fact, re-measured continuously rather than granted once.</div>'
    ].join('');
    host.appendChild(shell);
  }

  function capstoneFlowFigure(host) {
    ensureStyles();
    var parts = [];
    parts.push('<rect class="l33x" x="4" y="28" width="84" height="44" rx="4"/><text class="l33t" x="12" y="54">discover</text>');
    parts.push('<rect class="l33x" x="96" y="28" width="108" height="44" rx="4"/><text class="l33t" x="104" y="54">schema check</text>');
    parts.push('<rect class="l33x" x="212" y="28" width="116" height="44" rx="4"/><text class="l33t" x="220" y="54">MRTR consent</text>');
    parts.push('<rect class="l33x" x="336" y="28" width="92" height="44" rx="4"/><text class="l33t" x="344" y="54">task poll</text>');
    parts.push('<rect class="l33x" x="436" y="28" width="120" height="44" rx="4"/><text class="l33t" x="444" y="54">audited result</text>');
    parts.push('<path class="l33a" d="M88 50 L96 50" marker-end="url(#l33arrow)"/>');
    parts.push('<path class="l33a" d="M204 50 L212 50" marker-end="url(#l33arrow)"/>');
    parts.push('<path class="l33a" d="M328 50 L336 50" marker-end="url(#l33arrow)"/>');
    parts.push('<path class="l33a" d="M428 50 L436 50" marker-end="url(#l33arrow)"/>');
    parts.push('<text class="l33c" x="4" y="84">traceparent: one trace id end to end</text>');
    parts.push('<path class="l33d" d="M4 90 L556 90"/>');
    parts.push('<circle class="l33p" cx="46" cy="90" r="3"/>');
    parts.push('<circle class="l33p" cx="150" cy="90" r="3"/>');
    parts.push('<circle class="l33p" cx="270" cy="90" r="3"/>');
    parts.push('<circle class="l33p" cx="382" cy="90" r="3"/>');
    parts.push('<circle class="l33p" cx="496" cy="90" r="3"/>');
    parts.push('<text class="l33c" x="4" y="153">audit log:</text>');
    parts.push('<rect class="l33e" x="76" y="134" width="30" height="30" rx="3"/><text class="l33t" x="84" y="153">e1</text>');
    parts.push('<rect class="l33e" x="118" y="134" width="30" height="30" rx="3"/><text class="l33t" x="126" y="153">e2</text>');
    parts.push('<rect class="l33e" x="160" y="134" width="30" height="30" rx="3"/><text class="l33t" x="168" y="153">e3</text>');
    parts.push('<rect class="l33e" x="202" y="134" width="30" height="30" rx="3"/><text class="l33t" x="210" y="153">e4</text>');
    parts.push('<path class="l33a" d="M106 149 L118 149" marker-end="url(#l33arrow)"/>');
    parts.push('<path class="l33a" d="M148 149 L160 149" marker-end="url(#l33arrow)"/>');
    parts.push('<path class="l33a" d="M190 149 L202 149" marker-end="url(#l33arrow)"/>');
    parts.push('<text class="l33c" x="240" y="153">verify: ok</text>');
    parts.push('<rect class="l33o" x="330" y="134" width="226" height="30" rx="4"/><text class="l33t" x="338" y="153">OAuth: audience checked</text>');
    var shell = document.createElement('div');
    shell.className = 'mf-shell';
    shell.innerHTML = [
      '<div class="mf-head"><strong>Capstone Exchange</strong> discovery through consent, a task, and an audited result</div>',
      '<div class="mf-body">',
      '<svg viewBox="0 0 560 176" role="img" aria-label="A capstone exchange: server discover feeds a schema check, an MRTR consent round trip, a task that is polled to completion, and an audited result. A dashed line beneath the pipeline shows one trace id propagated across every stage. Below that, a four entry hash chained audit log verifies, and a separate OAuth audience check gates one HTTP call.">',
      '<defs><marker id="l33arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="var(--blueprint,#3553ff)"/></marker></defs>',
      '<style>.l33x{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.l33e{fill:var(--bg-surface,#eee);stroke:var(--blueprint,#3553ff);stroke-width:1.2}.l33o{fill:none;stroke:var(--ink-mute,#999);stroke-width:1.2;stroke-dasharray:3 2}.l33t{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}.l33c{fill:var(--ink-mute,#777);font:11px var(--font-mono,monospace)}.l33a{stroke:var(--blueprint,#3553ff);fill:none;stroke-width:1.5}.l33d{stroke:var(--ink-mute,#999);stroke-width:1;stroke-dasharray:2 3}.l33p{fill:var(--blueprint,#3553ff)}</style>',
      parts.join(''),
      '</svg>',
      '</div>',
      '<div class="mf-caption">One incident response exchange touches every domain at once: discovery with cache hints, a schema check that returns isError before it ever asks for consent, an MRTR round trip protected by an HMAC signed requestState, a task polled to completion, and a result. The same trace id threads every hop, an OAuth audience check gates the one HTTP call, and a hash chained audit log records the outcome of each step and still verifies at the end.</div>'
    ].join('');
    host.appendChild(shell);
  }

  LF.register({
    'mcpa-00-blueprint-weights': blueprintWeightsFigure,
    'mcpa-01-spec-map': specMapFigure,
    'mcpa-02-n-by-m': nByMFigure,
    'mcpa-03-envelope': envelopeFigure,
    'mcpa-04-stateless-requests': statelessRequestsFigure,
    'mcpa-05-era-matrix': eraMatrixFigure,
    'mcpa-06-topology': topologyFigure,
    'mcpa-07-discover': discoverCapabilityFigure,
    'mcpa-08-schema-contract': schemaContractFigure,
    'mcpa-09-manifest-anatomy': manifestAnatomyFigure,
    'mcpa-10-interaction-flow': modelInteractionFlowFigure,
    'mcpa-11-tool-call': toolCallFigure,
    'mcpa-12-resource-read': resourceReadFigure,
    'mcpa-13-prompt-template': promptTemplateFigure,
    'mcpa-14-mrtr': mrtrFigure,
    'mcpa-15-deprecation-timeline': deprecationTimelineFigure,
    'mcpa-16-subscription-stream': subscriptionStreamFigure,
    'mcpa-17-lifecycle': toolLifecycleFigure,
    'mcpa-18-error-taxonomy': errorTaxonomyFigure,
    'mcpa-19-transports': transportsFigure,
    'mcpa-20-cache-freshness': cacheFreshnessFigure,
    'mcpa-21-task-states': taskStateLifecycleFigure,
    'mcpa-22-trust-zones': trustZonesFigure,
    'mcpa-23-oauth-flow': oauthFlowFigure,
    'mcpa-24-registration-paths': registrationPathsFigure,
    'mcpa-25-consent-gates': consentGatesFigure,
    'mcpa-26-attack-surface': attackSurfaceFigure,
    'mcpa-27-trace-propagation': tracePropagationFigure,
    'mcpa-28-roles-map': rolesMapFigure,
    'mcpa-29-use-case-matrix': useCaseMatrixFigure,
    'mcpa-30-extension-negotiation': extensionNegotiationFigure,
    'mcpa-31-app-sandbox': appSandboxFigure,
    'mcpa-32-registry-flow': registryGatewayFigure,
    'mcpa-33-capstone-flow': capstoneFlowFigure
  });
})();
