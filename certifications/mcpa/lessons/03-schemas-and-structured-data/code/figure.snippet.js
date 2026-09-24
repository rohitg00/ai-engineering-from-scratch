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
// register as: mcpa-03-schema-shape
