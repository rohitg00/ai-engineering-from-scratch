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
// register as: mcpa-31-app-sandbox
