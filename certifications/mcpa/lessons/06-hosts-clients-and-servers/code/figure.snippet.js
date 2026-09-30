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
// register as: mcpa-06-topology
