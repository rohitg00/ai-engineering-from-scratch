function deprecationTimelineFigure(host) {
  ensureStyles();
  var depX = 150;
  var remX = 360;
  var endX = 524;
  var lanes = [
    {label: 'Roots', y: 84},
    {label: 'Sampling', y: 112},
    {label: 'Logging', y: 140}
  ];
  var stillValid = [
    'roots/list (MRTR input request)',
    'sampling/createMessage (MRTR)',
    'logLevel + notifications/message'
  ];
  var removed = [
    'logging/setLevel',
    'notifications/roots/list_changed'
  ];
  var parts = [];
  var i;
  parts.push('<line class="l15l" x1="' + depX + '" y1="40" x2="' + endX + '" y2="40"/>');
  parts.push('<circle class="l15p" cx="' + depX + '" cy="40" r="4"/>');
  parts.push('<circle class="l15p" cx="' + remX + '" cy="40" r="4"/>');
  parts.push('<text class="l15t" x="' + depX + '" y="24">Deprecated</text>');
  parts.push('<text class="l15t" x="' + remX + '" y="24">Eligible for removal</text>');
  parts.push('<text class="l15c" x="' + depX + '" y="56">2026-07-28</text>');
  parts.push('<text class="l15c" x="' + remX + '" y="56">2027-07-28+</text>');
  for (i = 0; i < lanes.length; i++) {
    var y = lanes[i].y;
    parts.push('<text class="l15lbl" x="18" y="' + (y + 4) + '">' + lanes[i].label + '</text>');
    parts.push('<line class="l15solid" x1="' + depX + '" y1="' + y + '" x2="' + remX + '" y2="' + y + '"/>');
    parts.push('<line class="l15dash" x1="' + remX + '" y1="' + y + '" x2="' + endX + '" y2="' + y + '"/>');
    parts.push('<circle class="l15dot" cx="' + depX + '" cy="' + y + '" r="3"/>');
  }
  parts.push('<line class="l15rule" x1="18" y1="160" x2="542" y2="160"/>');
  parts.push('<text class="l15h" x="18" y="176">Deprecated, still on the wire</text>');
  parts.push('<text class="l15h" x="300" y="176">Fully removed</text>');
  for (i = 0; i < stillValid.length; i++) {
    var sy = 196 + i * 20;
    parts.push('<rect class="l15still" x="18" y="' + (sy - 8) + '" width="6" height="6"/>');
    parts.push('<text class="l15lbl" x="30" y="' + sy + '">' + stillValid[i] + '</text>');
  }
  for (i = 0; i < removed.length; i++) {
    var ry = 196 + i * 20;
    parts.push('<rect class="l15gone" x="300" y="' + (ry - 8) + '" width="6" height="6"/>');
    parts.push('<text class="l15lbl" x="312" y="' + ry + '">' + removed[i] + '</text>');
  }
  var shell = document.createElement('div');
  shell.className = 'mf-shell';
  shell.innerHTML = [
    '<div class="mf-head"><strong>Deprecated, Not Removed</strong> roots, sampling, and logging keep answering through the removal window</div>',
    '<div class="mf-body">',
    '<svg viewBox="0 0 560 256" role="img" aria-label="Timeline from the 2026-07-28 deprecation of roots, sampling, and logging to their earliest possible removal on or after 2027-07-28, each lane solid then dashed to show the feature keeps working past the marker. Below, one column lists roots/list, sampling/createMessage, and per-request logLevel with notifications/message as still valid on the wire, and a second column lists logging/setLevel and notifications/roots/list_changed as already removed.">',
    '<style>.l15l{stroke:var(--ink-mute,#999);stroke-width:1}.l15p{fill:var(--blueprint,#3553ff)}.l15t{fill:var(--ink,#111);font:11px var(--font-mono,monospace);text-anchor:middle}.l15c{fill:var(--ink-mute,#777);font:11px var(--font-mono,monospace);text-anchor:middle}.l15lbl{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}.l15solid{stroke:var(--blueprint,#3553ff);stroke-width:5;stroke-linecap:round}.l15dash{stroke:var(--ink-soft,#bbb);stroke-width:5;stroke-linecap:round;stroke-dasharray:6 4}.l15dot{fill:var(--blueprint,#3553ff)}.l15rule{stroke:var(--rule-soft,#ccc);stroke-width:1}.l15h{fill:var(--ink,#111);font:11px var(--font-mono,monospace);font-weight:bold}.l15still{fill:var(--blueprint,#3553ff)}.l15gone{fill:var(--ink-mute,#999)}</style>',
    parts.join(''),
    '</svg>',
    '</div>',
    '<div class="mf-caption">Deprecated in 2026-07-28 starts a twelve month clock, not a deletion: roots, sampling, and logging keep their exact wire shape past the earliest-removal marker, while logging/setLevel and notifications/roots/list_changed are already gone, replaced by MRTR input requests and a per-request logLevel key.</div>'
  ].join('');
  host.appendChild(shell);
}
// register as: mcpa-15-deprecation-timeline
