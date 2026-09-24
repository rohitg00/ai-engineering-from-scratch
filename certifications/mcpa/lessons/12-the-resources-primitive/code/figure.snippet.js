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
// register as: mcpa-12-resource-read
