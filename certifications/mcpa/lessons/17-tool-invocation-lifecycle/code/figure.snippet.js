function toolLifecycleFigure(host) {
  ensureStyles();
  var stages = [
    'DISCOVER: server/discover',
    'LIST: tools/list, cached',
    'SELECT: model picks a tool',
    'CONFIRM: host approval gate',
    'CALL: tools/call sent',
    'VALIDATE: is the tool known',
    'EXECUTE: validate args, run',
    'RESULT: resultType'
  ];
  var barX = 16;
  var barW = 234;
  var barH = 26;
  var gap = 14;
  var step = barH + gap;
  var parts = [];
  var i;
  for (i = 0; i < stages.length; i++) {
    var y = 14 + i * step;
    parts.push('<rect class="l17bar" x="' + barX + '" y="' + y + '" width="' + barW + '" height="' + barH + '"/>');
    parts.push('<text class="l17lbl" x="' + (barX + 10) + '" y="' + (y + 17) + '">' + stages[i] + '</text>');
    if (i < stages.length - 1) {
      var midX = barX + barW / 2;
      parts.push('<line class="l17chain" x1="' + midX + '" y1="' + (y + barH) + '" x2="' + midX + '" y2="' + (y + barH + gap) + '" marker-end="url(#l17arrow)"/>');
    }
  }
  var yCall = 14 + 4 * step;
  var yValidate = 14 + 5 * step;
  var yExecute = 14 + 6 * step;
  var yResult = 14 + 7 * step;
  var yRetry = yResult + step;
  var rightX = 340;
  var rightW = 204;
  var rightEdge = barX + barW;

  parts.push('<line class="l17dash" x1="' + rightEdge + '" y1="' + (yValidate + 13) + '" x2="' + rightX + '" y2="' + (yValidate + 13) + '"/>');
  parts.push('<rect class="l17err" x="' + rightX + '" y="' + yValidate + '" width="' + rightW + '" height="' + barH + '"/>');
  parts.push('<text class="l17lbl" x="' + (rightX + 10) + '" y="' + (yValidate + 17) + '">unknown tool: -32602</text>');

  parts.push('<line class="l17dash" x1="' + rightEdge + '" y1="' + (yExecute + 13) + '" x2="' + rightX + '" y2="' + (yExecute + 13) + '"/>');
  parts.push('<rect class="l17soft" x="' + rightX + '" y="' + yExecute + '" width="' + rightW + '" height="' + barH + '"/>');
  parts.push('<text class="l17lbl" x="' + (rightX + 10) + '" y="' + (yExecute + 17) + '">isError (actionable)</text>');

  parts.push('<line class="l17dash" x1="' + rightEdge + '" y1="' + (yResult + 13) + '" x2="' + rightX + '" y2="' + (yResult + 13) + '"/>');
  parts.push('<rect class="l17ok" x="' + rightX + '" y="' + yResult + '" width="' + rightW + '" height="' + barH + '"/>');
  parts.push('<text class="l17lbl" x="' + (rightX + 10) + '" y="' + (yResult + 17) + '">complete: final</text>');

  var elbowX = rightEdge + 30;
  var connectY = yRetry + 8;
  parts.push('<line class="l17dash" x1="' + rightEdge + '" y1="' + (yResult + 13) + '" x2="' + elbowX + '" y2="' + (yResult + 13) + '"/>');
  parts.push('<line class="l17dash" x1="' + elbowX + '" y1="' + (yResult + 13) + '" x2="' + elbowX + '" y2="' + connectY + '"/>');
  parts.push('<line class="l17dash" x1="' + elbowX + '" y1="' + connectY + '" x2="' + rightX + '" y2="' + connectY + '"/>');
  parts.push('<rect class="l17soft" x="' + rightX + '" y="' + yRetry + '" width="' + rightW + '" height="' + barH + '"/>');
  parts.push('<text class="l17lbl" x="' + (rightX + 10) + '" y="' + (yRetry + 17) + '">input_required: retry</text>');

  var loopX = rightEdge + 18;
  var loopY = yRetry + 18;
  parts.push('<path class="l17loop" d="M ' + rightX + ' ' + loopY + ' L ' + loopX + ' ' + loopY + ' L ' + loopX + ' ' + (yCall + 13) + ' L ' + (rightEdge + 2) + ' ' + (yCall + 13) + '" marker-end="url(#l17arrow)"/>');

  var height = yRetry + barH + 24;
  var shell = document.createElement('div');
  shell.className = 'mf-shell';
  shell.innerHTML = [
    '<div class="mf-head"><strong>The Tool Invocation Lifecycle</strong> eight checkpoints, two error channels, one loop back for input_required</div>',
    '<div class="mf-body">',
    '<svg viewBox="0 0 560 ' + height + '" role="img" aria-label="A vertical chain of eight checkpoints: discover, list, select, confirm, call, validate, execute, result. Validate branches right to an unknown tool -32602 protocol error. Execute branches right to an isError tool execution result. Result branches right to two outcomes: complete, which is final, and input_required, which loops back up to call with a new request id.">',
    '<defs><marker id="l17arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path class="l17arrowfill" d="M0,0 L10,5 L0,10 z"/></marker></defs>',
    '<style>.l17bar{fill:var(--bg-surface,#eee);stroke:var(--ink,#111)}.l17lbl{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}.l17chain{stroke:var(--blueprint,#3553ff);stroke-width:1.4}.l17arrowfill{fill:var(--blueprint,#3553ff)}.l17dash{stroke:var(--ink-mute,#888);stroke-width:1;stroke-dasharray:3,3}.l17err{fill:var(--bg-surface,#eee);stroke:var(--blueprint,#3553ff);stroke-width:1.6}.l17soft{fill:var(--bg-surface,#eee);stroke:var(--ink-mute,#888)}.l17ok{fill:var(--bg-surface,#eee);stroke:var(--ink,#111);stroke-width:1.6}.l17loop{fill:none;stroke:var(--ink,#111);stroke-width:1.4}</style>',
    parts.join(''),
    '</svg>',
    '</div>',
    '<div class="mf-caption">Validate only asks whether the tool exists; failing there is always a protocol error, -32602, with no execute or result stage after it. Everything discovered once execute has started, a bad argument or a business rule, comes back isError inside a normal complete result so the model can read it and retry. A result of input_required is not the end: the client answers it and calls again with a new id, running validate, execute, and result a second time.</div>'
  ].join('');
  host.appendChild(shell);
}
// register as: mcpa-17-lifecycle
