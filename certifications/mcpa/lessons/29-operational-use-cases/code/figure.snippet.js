function useCaseMatrixFigure(host) {
  ensureStyles();
  var header = ['use case', 'primitive', 'transport', 'extension'];
  var rows = [
    ['developer tools', 'tool', 'stdio', 'none'],
    ['data access', 'resource', 'http', 'none'],
    ['long job', 'tool', 'http', 'tasks'],
    ['interactive UI', 'tool', 'http', 'ui'],
    ['reusable flow', 'prompt', 'http', 'skills'],
    ['M2M sync', 'tool', 'http', 'auth-cc']
  ];
  var colX = [8, 148, 250, 352, 452];
  var colW = [140, 102, 102, 100, 100];
  var rowH = 28;
  var headerH = 28;
  var top = 20;
  var parts = [];
  var i;
  var c;
  parts.push('<rect class="l29g" x="' + colX[0] + '" y="' + top + '" width="544" height="' + (headerH + rows.length * rowH) + '" rx="4"/>');
  parts.push('<rect class="l29hh" x="' + colX[0] + '" y="' + top + '" width="544" height="' + headerH + '" rx="4"/>');
  for (c = 0; c < header.length; c++) {
    parts.push('<text class="l29ht" x="' + (colX[c] + 8) + '" y="' + (top + 18) + '">' + header[c] + '</text>');
  }
  for (i = 0; i < rows.length; i++) {
    var rowY = top + headerH + i * rowH;
    if (i % 2 === 1) {
      parts.push('<rect class="l29z" x="' + colX[0] + '" y="' + rowY + '" width="544" height="' + rowH + '"/>');
    }
    for (c = 0; c < rows[i].length; c++) {
      var cls = c === 0 ? 'l29lbl' : 'l29rt';
      parts.push('<text class="' + cls + '" x="' + (colX[c] + 8) + '" y="' + (rowY + 19) + '">' + rows[i][c] + '</text>');
    }
  }
  for (c = 1; c < colX.length; c++) {
    parts.push('<line class="l29v" x1="' + colX[c] + '" y1="' + top + '" x2="' + colX[c] + '" y2="' + (top + headerH + rows.length * rowH) + '"/>');
  }
  var shell = document.createElement('div');
  shell.className = 'mf-shell';
  shell.innerHTML = [
    '<div class="mf-head"><strong>Operational Use Case Matrix</strong> six scenarios, four questions each</div>',
    '<div class="mf-body">',
    '<svg viewBox="0 0 560 220" role="img" aria-label="A table of six operational use cases (developer tools, data access, long job, interactive UI, reusable flow, machine to machine sync) against the MCP primitive, transport, and extension each one recommends. Developer tools takes a tool over stdio with no extension. Data access takes a resource over HTTP. A long job takes a tool with the tasks extension. An interactive UI takes a tool with the MCP Apps ui extension. A reusable flow takes a prompt with the skills extension. Machine to machine sync takes a tool with the OAuth client credentials extension.">',
    '<style>.l29g{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.l29hh{fill:var(--blueprint,#3553ff);opacity:.12}.l29ht{fill:var(--ink,#111);font:bold 11px var(--font-mono,monospace)}.l29lbl{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}.l29rt{fill:var(--ink-mute,#555);font:11px var(--font-mono,monospace)}.l29z{fill:var(--ink-soft,#777);opacity:.06}.l29v{stroke:var(--rule-soft,#ccc);stroke-width:.6}.l29c{fill:var(--ink-soft,#777);font:11px var(--font-mono,monospace)}</style>',
    parts.join(''),
    '<text class="l29c" x="8" y="216">http stands for streamable-http; auth-cc stands for the OAuth client credentials extension</text>',
    '</svg>',
    '</div>',
    '<div class="mf-caption">Four questions, who initiates the call, how sensitive is the data, how long does it run, and does it need an interactive surface, pick the primitive, the transport, the auth path, and the extension for each use case in this lesson\'s catalog.</div>'
  ].join('');
  host.appendChild(shell);
}
// register as: mcpa-29-use-case-matrix
