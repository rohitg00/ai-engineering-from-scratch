function taskStateLifecycleFigure(host) {
  ensureStyles();
  var boxes = [
    { cls: 'l21x', x: 30, y: 24, w: 150, h: 44, tx: 105, ty: 51, label: 'input_required' },
    { cls: 'l21x', x: 30, y: 188, w: 150, h: 44, tx: 105, ty: 215, label: 'working' },
    { cls: 'l21x l21f', x: 380, y: 20, w: 150, h: 40, tx: 455, ty: 44, label: 'completed' },
    { cls: 'l21x l21f', x: 380, y: 110, w: 150, h: 40, tx: 455, ty: 134, label: 'cancelled' },
    { cls: 'l21x l21f', x: 380, y: 200, w: 150, h: 40, tx: 455, ty: 224, label: 'failed' }
  ];
  var parts = [];
  var i;
  for (i = 0; i < boxes.length; i++) {
    var b = boxes[i];
    parts.push('<rect class="' + b.cls + '" x="' + b.x + '" y="' + b.y + '" width="' + b.w + '" height="' + b.h + '" rx="4"/>');
    parts.push('<text class="l21t" x="' + b.tx + '" y="' + b.ty + '">' + b.label + '</text>');
  }
  var edges = [
    ['95', '185', '95', '71', '6', '105', 'needs input'],
    ['118', '71', '118', '185', '132', '155', 'tasks/update'],
    ['183', '193', '377', '42', '250', '128', 'work finishes'],
    ['183', '210', '377', '130', '250', '169', 'tasks/cancel'],
    ['183', '227', '377', '218', '250', '208', 'protocol error']
  ];
  for (i = 0; i < edges.length; i++) {
    var e = edges[i];
    parts.push('<line class="l21a" x1="' + e[0] + '" y1="' + e[1] + '" x2="' + e[2] + '" y2="' + e[3] + '" marker-end="url(#l21arrow)"/>');
    parts.push('<text class="l21e" x="' + e[4] + '" y="' + e[5] + '">' + e[6] + '</text>');
  }
  var shell = document.createElement('div');
  shell.className = 'mf-shell';
  shell.innerHTML = [
    '<div class="mf-head"><strong>Task Status Lifecycle</strong> working pauses at input_required until tasks/update resumes it, then ends in one terminal status</div>',
    '<div class="mf-body">',
    '<svg viewBox="0 0 560 260" role="img" aria-label="State diagram of an MCP task. Working moves to input_required when the server needs client input, and back to working after a tasks/update call. Working moves to completed when the work finishes, to cancelled after tasks/cancel, or to failed on a protocol error. Completed, cancelled, and failed are terminal and shown with a dashed border.">',
    '<defs><marker id="l21arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path class="l21p" d="M0,0 L10,5 L0,10 Z"/></marker></defs>',
    '<style>.l21x{fill:var(--bg-surface,#eee);stroke:var(--ink-soft,#999);stroke-width:1.2}.l21f{stroke-dasharray:4,2}.l21t{fill:var(--ink,#111);font:12px var(--font-mono,monospace);text-anchor:middle}.l21a{stroke:var(--blueprint,#3553ff);stroke-width:1.6;fill:none}.l21p{fill:var(--blueprint,#3553ff)}.l21e{fill:var(--ink-mute,#666);font:11px var(--font-mono,monospace)}</style>',
    parts.join(''),
    '</svg>',
    '</div>',
    '<div class="mf-caption">Every tasks/get poll repeats a working snapshot until a terminal status arrives; that self-loop is not drawn. A cancel or a protocol error can also end a task directly from input_required. SEP-2663 inlines the completed result and the failed error into this same tasks/get response; there is no separate tasks/result call.</div>'
  ].join('');
  host.appendChild(shell);
}
// register as: mcpa-21-task-states
