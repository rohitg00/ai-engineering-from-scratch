function mrtrFigure(host) {
  ensureStyles();
  var clientX = 100;
  var serverX = 460;
  var rows = [
    {y: 70, dir: 'right', label: 'tools/call (id 1): deploy_release'},
    {y: 118, dir: 'left', label: 'input_required: confirm + requestState'},
    {y: 160, dir: 'note', label: 'client gathers confirmation from the user'},
    {y: 206, dir: 'right', label: 'tools/call (id 2): new id, inputResponses'},
    {y: 254, dir: 'left', label: 'complete: deployed = true'}
  ];
  var parts = [];
  parts.push('<line class="l14lane" x1="' + clientX + '" y1="40" x2="' + clientX + '" y2="272"/>');
  parts.push('<line class="l14lane" x1="' + serverX + '" y1="40" x2="' + serverX + '" y2="272"/>');
  parts.push('<rect class="l14box" x="' + (clientX - 36) + '" y="16" width="72" height="22"/><text class="l14role" x="' + clientX + '" y="31" text-anchor="middle">Client</text>');
  parts.push('<rect class="l14box" x="' + (serverX - 36) + '" y="16" width="72" height="22"/><text class="l14role" x="' + serverX + '" y="31" text-anchor="middle">Server</text>');
  var mid = (clientX + serverX) / 2;
  var i;
  for (i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (row.dir === 'note') {
      parts.push('<text class="l14note" x="' + mid + '" y="' + row.y + '" text-anchor="middle">' + row.label + '</text>');
      continue;
    }
    var x1 = row.dir === 'right' ? clientX : serverX;
    var x2 = row.dir === 'right' ? serverX : clientX;
    parts.push('<text class="l14lbl" x="' + mid + '" y="' + (row.y - 10) + '" text-anchor="middle">' + row.label + '</text>');
    parts.push('<line class="l14arrow" x1="' + x1 + '" y1="' + row.y + '" x2="' + x2 + '" y2="' + row.y + '" marker-end="url(#l14arrowhead)"/>');
  }
  var shell = document.createElement('div');
  shell.className = 'mf-shell';
  shell.innerHTML = [
    '<div class="mf-head"><strong>Multi Round-Trip Requests</strong> one call, an input_required pause, a fresh retry that echoes requestState</div>',
    '<div class="mf-body">',
    '<svg viewBox="0 0 560 290" role="img" aria-label="A client sends tools/call with id 1. The server ends that request with an input_required result carrying inputRequests and requestState instead of holding a stream open. The client gathers the confirmation from the user, then sends an independent tools/call with a new id 2 that carries inputResponses and echoes requestState exactly. The server replies complete.">',
    '<defs><marker id="l14arrowhead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path class="l14arrowfill" d="M0,0 L10,5 L0,10 z"/></marker></defs>',
    '<style>.l14lane{stroke:var(--rule-soft,#ccc);stroke-width:1;stroke-dasharray:3,3}.l14box{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.l14role{fill:var(--ink,#111);font:bold 12px var(--font-mono,monospace)}.l14arrow{stroke:var(--blueprint,#3553ff);stroke-width:1.6}.l14arrowfill{fill:var(--blueprint,#3553ff)}.l14lbl{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}.l14note{fill:var(--ink-mute,#777);font:italic 11px var(--font-mono,monospace)}</style>',
    parts.join(''),
    '</svg>',
    '</div>',
    '<div class="mf-caption">The server never pushes a request to the client. It ends the first call with input_required, and the client starts an independent second call, with a new JSON-RPC id, that echoes requestState byte for byte and supplies inputResponses.</div>'
  ].join('');
  host.appendChild(shell);
}
// register as: mcpa-14-mrtr
