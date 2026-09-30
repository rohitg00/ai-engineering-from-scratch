function registrationPathsFigure(host) {
  ensureStyles();
  var steps = [
    { rank: '1', label: 'Pre-registered credentials', detail: 'client id already on file', deprecated: false },
    { rank: '2', label: 'Client ID Metadata Document', detail: 'AS advertises CIMD support', deprecated: false },
    { rank: '3', label: 'Dynamic Client Registration', detail: 'deprecated fallback via DCR', deprecated: true },
    { rank: '4', label: 'Ask the user', detail: 'no automated path available', deprecated: false }
  ];
  var checklist = [
    'client_id equals the URL',
    'https scheme with a path',
    'redirect_uris validated',
    'kept keyed by issuer'
  ];
  var rowH = 54;
  var gapY = 16;
  var top = 18;
  var colX = 8;
  var colW = 300;
  var parts = [];
  var i;
  for (i = 0; i < steps.length; i++) {
    var step = steps[i];
    var y = top + i * (rowH + gapY);
    var boxClass = step.deprecated ? 'l24bd' : 'l24b';
    parts.push('<rect class="' + boxClass + '" x="' + colX + '" y="' + y + '" width="' + colW + '" height="' + rowH + '" rx="4"/>');
    parts.push('<text class="l24r" x="' + (colX + 12) + '" y="' + (y + 22) + '">' + step.rank + '</text>');
    parts.push('<text class="l24l" x="' + (colX + 30) + '" y="' + (y + 22) + '">' + step.label + '</text>');
    parts.push('<text class="l24d" x="' + (colX + 30) + '" y="' + (y + 39) + '">' + step.detail + '</text>');
    if (i < steps.length - 1) {
      var midX = colX + colW / 2;
      var lineY1 = y + rowH;
      var lineY2 = y + rowH + gapY - 4;
      parts.push('<line class="l24a" x1="' + midX + '" y1="' + lineY1 + '" x2="' + midX + '" y2="' + lineY2 + '" marker-end="url(#l24arrow)"/>');
      parts.push('<text class="l24n" x="' + (midX + 10) + '" y="' + (lineY1 + gapY / 2 + 4) + '">if unavailable</text>');
    }
  }
  var panelX = colX + colW + 18;
  var panelW = 560 - panelX - 8;
  var panelTop = top;
  var panelH = steps.length * (rowH + gapY) - gapY;
  parts.push('<rect class="l24p" x="' + panelX + '" y="' + panelTop + '" width="' + panelW + '" height="' + panelH + '" rx="4"/>');
  parts.push('<text class="l24pt" x="' + (panelX + 12) + '" y="' + (panelTop + 22) + '">a CIMD checked like this</text>');
  for (i = 0; i < checklist.length; i++) {
    var cy = panelTop + 46 + i * 46;
    parts.push('<circle class="l24c" cx="' + (panelX + 18) + '" cy="' + cy + '" r="5"/>');
    parts.push('<text class="l24ct" x="' + (panelX + 32) + '" y="' + (cy + 4) + '">' + checklist[i] + '</text>');
  }
  var shell = document.createElement('div');
  shell.className = 'mf-shell';
  shell.innerHTML = [
    '<div class="mf-head"><strong>Client Registration Paths</strong> priority order for a client an authorization server has never met</div>',
    '<div class="mf-body">',
    '<svg viewBox="0 0 560 300" role="img" aria-label="A four step priority ladder: pre-registered credentials, Client ID Metadata Document, Dynamic Client Registration marked deprecated, and asking the user, each tried in order when the one above is unavailable. Beside it, a checklist of what an authorization server verifies in a Client ID Metadata Document and why credentials are kept per issuer.">',
    '<defs><marker id="l24arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path class="l24af" d="M0,0 L8,4 L0,8 z"/></marker></defs>',
    '<style>.l24b{fill:var(--bg-surface,#eee);stroke:var(--blueprint,#3553ff);stroke-width:1.4}.l24bd{fill:var(--bg-surface,#eee);stroke:var(--ink-mute,#999);stroke-width:1.2;stroke-dasharray:4,3}.l24r{fill:var(--blueprint,#3553ff);font:bold 13px var(--font-mono,monospace)}.l24l{fill:var(--ink,#111);font:bold 11px var(--font-mono,monospace)}.l24d{fill:var(--ink-mute,#666);font:11px var(--font-mono,monospace)}.l24a{stroke:var(--ink-mute,#999);stroke-width:1.2}.l24af{fill:var(--ink-mute,#999)}.l24n{fill:var(--ink-soft,#777);font:11px var(--font-mono,monospace)}.l24p{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.l24pt{fill:var(--ink,#111);font:bold 11px var(--font-mono,monospace)}.l24c{fill:var(--blueprint,#3553ff)}.l24ct{fill:var(--ink-mute,#555);font:11px var(--font-mono,monospace)}</style>',
    parts.join(''),
    '</svg>',
    '</div>',
    '<div class="mf-caption">A client tries each path in order and stops at the first one available: pre-registered credentials, then a Client ID Metadata Document if the authorization server advertises it, then Dynamic Client Registration as a deprecated fallback, then asking the user. Credentials from any path are kept keyed by the issuing authorization server and are never reused against a different one.</div>'
  ].join('');
  host.appendChild(shell);
}
// register as: mcpa-24-registration-paths
