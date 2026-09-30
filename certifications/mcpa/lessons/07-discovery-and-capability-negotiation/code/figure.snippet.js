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
// register as: mcpa-07-discover
