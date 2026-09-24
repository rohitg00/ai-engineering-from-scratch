function errorTaxonomyFigure(host) {
  ensureStyles();
  var protocolCodes = [
    { code: '-32601', name: 'Method not found' },
    { code: '-32602', name: 'Invalid params (unknown tool)' },
    { code: '-32020', name: 'HeaderMismatch' },
    { code: '-32021', name: 'MissingRequiredClientCapability' },
    { code: '-32022', name: 'UnsupportedProtocolVersion' }
  ];
  var rowH = 32;
  var gap = 6;
  var startY = 40;
  var left = '';
  var i;
  var y;
  for (i = 0; i < protocolCodes.length; i++) {
    y = startY + i * (rowH + gap);
    left += '<rect class="l18x" x="16" y="' + y + '" width="250" height="' + rowH + '" rx="3"/>';
    left += '<text class="l18h" x="24" y="' + (y + 13) + '">' + protocolCodes[i].code + '</text>';
    left += '<text class="l18t" x="24" y="' + (y + 26) + '">' + protocolCodes[i].name + '</text>';
  }
  var shell = document.createElement('div');
  shell.className = 'mf-shell';
  shell.innerHTML = [
    '<div class="mf-head"><strong>Two Ways for a Request to Fail</strong> a protocol error travels as a JSON-RPC error object; a tool problem travels as a normal result with isError true</div>',
    '<div class="mf-body">',
    '<svg viewBox="0 0 560 300" role="img" aria-label="Left column: five JSON-RPC protocol error codes, -32601 method not found, -32602 invalid params, -32020 header mismatch, -32021 missing required client capability, -32022 unsupported protocol version. Right column: a tool problem card showing API failures, input validation errors, business logic refusals, and expired handles all reported as a result with isError true, which is content the model reads and then retries with a fix. Bottom band: the forbidden zone, -32000 to -32019 legacy and -32002 and -32042 retired, labeled as codes a 2026-07-28 server must refuse to put on the wire.">',
    '<style>.l18x{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.l18h{fill:var(--ink,#111);font:bold 12px var(--font-mono,monospace)}.l18t{fill:var(--ink-mute,#777);font:11px var(--font-mono,monospace)}.l18cap{fill:var(--ink-soft,#555);font:bold 11px var(--font-mono,monospace)}.l18d{stroke:var(--rule-soft,#ccc);stroke-width:1}.l18f{fill:none;stroke:var(--ink-mute,#999);stroke-width:1.2;stroke-dasharray:4 3}.l18fh{fill:var(--ink,#111);font:bold 11px var(--font-mono,monospace)}.l18ft{fill:var(--ink-mute,#777);font:11px var(--font-mono,monospace)}</style>',
    '<text class="l18cap" x="16" y="14">two channels answer a failed request; only one of them is content the model reads</text>',
    '<text class="l18cap" x="16" y="30">protocol error -&gt; JSON-RPC error</text>',
    '<text class="l18cap" x="296" y="30">tool problem -&gt; isError: true</text>',
    '<line class="l18d" x1="282" y1="36" x2="282" y2="224"/>',
    left,
    '<rect class="l18x" x="296" y="40" width="248" height="184"/>',
    '<text class="l18h" x="304" y="58">isError: true</text>',
    '<text class="l18t" x="304" y="76">API failures</text>',
    '<text class="l18t" x="304" y="92">input validation errors</text>',
    '<text class="l18t" x="304" y="108">business logic refusals</text>',
    '<text class="l18t" x="304" y="124">expired server-minted handles</text>',
    '<line class="l18d" x1="304" y1="138" x2="536" y2="138"/>',
    '<text class="l18t" x="304" y="158">content the model reads,</text>',
    '<text class="l18t" x="304" y="176">then retries with a fix</text>',
    '<rect class="l18f" x="16" y="240" width="528" height="48" rx="3"/>',
    '<text class="l18fh" x="28" y="260">forbidden: -32000 to -32019 legacy, -32002 and -32042 retired</text>',
    '<text class="l18ft" x="28" y="278">a 2026-07-28 server must refuse to put any of these on the wire</text>',
    '</svg>',
    '</div>',
    '<div class="mf-caption">A protocol error is a JSON-RPC error object the client handles itself. A tool problem is a normal result with isError true, content the model can read and act on. Both are legitimate channels; a code from the forbidden band below is never legitimate, whichever channel would carry it.</div>'
  ].join('');
  host.appendChild(shell);
}
// register as: mcpa-18-error-taxonomy
