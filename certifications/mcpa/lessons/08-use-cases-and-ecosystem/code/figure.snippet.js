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

// register as: mcpa-08-portability
