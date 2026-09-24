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

// register as: mcpa-09-capstone-flow
