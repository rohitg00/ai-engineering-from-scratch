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
// register as: mcpa-30-extension-negotiation
