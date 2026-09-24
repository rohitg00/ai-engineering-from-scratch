function subscriptionStreamFigure(host) {
  ensureStyles();
  var beats = [
    {dir: 'right', cls: 'ok', label: 'listen id=1: toolsListChanged, config.json'},
    {dir: 'left', cls: 'ok', label: 'ack: _meta.subscriptionId=1'},
    {dir: 'right', cls: 'ok', label: 'listen id=2: resourcesListChanged'},
    {dir: 'left', cls: 'ok', label: 'ack: _meta.subscriptionId=2'},
    {dir: 'left', cls: 'ok', label: 'resources/updated, subscriptionId=1'},
    {dir: 'left', cls: 'ok', label: 'resources/list_changed, subscriptionId=2'},
    {dir: 'right', cls: 'ok', label: 'tools/call id=3, _meta.progressToken=job-42'},
    {dir: 'left', cls: 'prog', label: 'progress 0.2, 0.6, 1.0: no subscriptionId'},
    {dir: 'left', cls: 'ok', label: 'result id=3: resultType complete'},
    {dir: 'right', cls: 'no', label: 'notifications/cancelled requestId=2'},
    {dir: 'left', cls: 'drop', label: 'late update for sub=2: dropped locally'}
  ];
  var clientX = 61;
  var serverX = 499;
  var top = 46;
  var step = 26;
  var rows = [];
  var i;
  var y;
  var x1;
  var x2;
  var marker;
  for (i = 0; i < beats.length; i++) {
    y = top + i * step;
    x1 = beats[i].dir === 'right' ? clientX : serverX;
    x2 = beats[i].dir === 'right' ? serverX : clientX;
    marker = (beats[i].cls === 'no' || beats[i].cls === 'drop') ? 'l16arrowmute' : 'l16arrow';
    rows.push('<line class="l16' + beats[i].cls + '" x1="' + x1 + '" y1="' + y + '" x2="' + x2 + '" y2="' + y + '" marker-end="url(#' + marker + ')"/>');
    rows.push('<text class="l16lbl" x="280" y="' + (y - 6) + '" text-anchor="middle">' + beats[i].label + '</text>');
  }
  var lastY = top + (beats.length - 1) * step;
  var lifelineBottom = lastY + 14;
  var shell = document.createElement('div');
  shell.className = 'mf-shell';
  shell.innerHTML = [
    '<div class="mf-head"><strong>Notification Streams, Progress, and Cancellation</strong> the listen stream tags every message with a subscriptionId; a request’s own progress never does</div>',
    '<div class="mf-body">',
    '<svg viewBox="0 0 560 330" role="img" aria-label="Sequence between a client and a server. The client opens two subscriptions/listen requests, id 1 and id 2; each is acknowledged first with the matching subscriptionId in _meta, then resources/updated and list_changed notifications arrive tagged with that same id so the client can tell them apart. A separate tools/call request runs on its own response channel: its progress notifications carry only a progressToken, never a subscriptionId, and its result arrives on that same request, not on the listen stream. The client then cancels subscription 2 with notifications/cancelled, and a stray update for subscription 2 that arrives afterward is dropped rather than delivered.">',
    '<style>',
    '.l16x{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}',
    '.l16t{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}',
    '.l16lbl{fill:var(--ink-soft,#555);font:11px var(--font-mono,monospace)}',
    '.l16life{stroke:var(--rule-soft,#ccc);stroke-width:1;stroke-dasharray:2 3}',
    '.l16ok{stroke:var(--blueprint,#3553ff);stroke-width:1.6;fill:none}',
    '.l16prog{stroke:var(--ink,#111);stroke-width:1.4;fill:none;stroke-dasharray:1 3;stroke-linecap:round}',
    '.l16no{stroke:var(--ink-mute,#888);stroke-width:1.4;fill:none;stroke-dasharray:5 3}',
    '.l16drop{stroke:var(--ink-mute,#888);stroke-width:1.2;fill:none;stroke-dasharray:2 4;opacity:.7}',
    '</style>',
    '<marker id="l16arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--blueprint,#3553ff)"/></marker>',
    '<marker id="l16arrowmute" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--ink-mute,#888)"/></marker>',
    '<rect class="l16x" x="16" y="6" width="90" height="22"/><text class="l16t" x="26" y="21">client</text>',
    '<rect class="l16x" x="454" y="6" width="90" height="22"/><text class="l16t" x="464" y="21">server</text>',
    '<line class="l16life" x1="' + clientX + '" y1="28" x2="' + clientX + '" y2="' + lifelineBottom + '"/>',
    '<line class="l16life" x1="' + serverX + '" y1="28" x2="' + serverX + '" y2="' + lifelineBottom + '"/>',
    rows.join(''),
    '</svg>',
    '</div>',
    '<div class="mf-caption">Two subscriptions share one channel and are told apart only by the subscriptionId every acknowledgment and notification carries in _meta, matching the id of the subscriptions/listen request that opened it. Progress and the final result for an ordinary call travel on that call’s own response, never on the listen stream, so they never carry a subscriptionId. Cancelling a subscription stops new messages for it; a message already in flight when the cancel lands still arrives and must be dropped, not delivered.</div>'
  ].join('');
  host.appendChild(shell);
}
// register as: mcpa-16-subscription-stream
