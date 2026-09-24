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

// register as: mcpa-02-process-topology
