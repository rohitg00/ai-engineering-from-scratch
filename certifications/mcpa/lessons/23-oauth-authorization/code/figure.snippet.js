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
// register as: mcpa-23-oauth-flow
