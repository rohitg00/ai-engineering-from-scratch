function eraMatrixFigure(host) {
  ensureStyles();
  var mid = [
    ['DiscoverResult', 95],
    ['-32022 (recognized)', 280],
    ['other error / timeout', 465]
  ];
  var out = [
    ['Modern: use it', 95],
    ['Modern: retry version', 280],
    ['Legacy: use initialize', 465]
  ];
  var svg = [];
  svg.push('<defs><marker id="l05arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path class="l05p" d="M0,0 L6,3 L0,6 Z"/></marker></defs>');
  svg.push('<rect class="l05x" x="190" y="10" width="180" height="30" rx="4"/>');
  svg.push('<text class="l05t" x="207" y="29">server/discover probe</text>');
  var i;
  for (i = 0; i < mid.length; i++) {
    var cx = mid[i][1];
    svg.push('<line class="l05a" marker-end="url(#l05arrow)" x1="280" y1="40" x2="' + cx + '" y2="78"/>');
    svg.push('<rect class="l05x" x="' + (cx - 85) + '" y="80" width="170" height="28" rx="4"/>');
    svg.push('<text class="l05t" x="' + (cx - 77) + '" y="98">' + mid[i][0] + '</text>');
    svg.push('<line class="l05a" marker-end="url(#l05arrow)" x1="' + cx + '" y1="108" x2="' + cx + '" y2="148"/>');
    svg.push('<rect class="l05o" x="' + (cx - 85) + '" y="150" width="170" height="28" rx="4"/>');
    svg.push('<text class="l05t" x="' + (cx - 77) + '" y="168">' + out[i][0] + '</text>');
  }
  svg.push('<text class="l05c" x="92" y="200">Era is a property of the server: cache the decision per process (stdio) or origin (HTTP).</text>');
  var shell = document.createElement('div');
  shell.className = 'mf-shell';
  shell.innerHTML = [
    '<div class="mf-head"><strong>Protocol Era Probe</strong> one server/discover probe, three outcomes, no handshake required to ask</div>',
    '<div class="mf-body">',
    '<svg viewBox="0 0 560 210" role="img" aria-label="A server/discover probe fans out to three outcomes: a DiscoverResult means the server is modern, a recognized -32022 UnsupportedProtocolVersion error means modern with a different version to retry, and any other error or a timeout means legacy, falling back to the initialize handshake.">',
    '<style>.l05x{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.l05o{fill:var(--bg-surface,#eee);stroke:var(--blueprint,#3553ff);stroke-width:1.2}.l05t{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}.l05a{stroke:var(--ink-mute,#999);stroke-width:1}.l05p{fill:var(--ink-mute,#999)}.l05c{fill:var(--ink-soft,#777);font:11px var(--font-mono,monospace)}</style>',
    svg.join(''),
    '</svg>',
    '</div>',
    '<div class="mf-caption">The same probe sorts every stdio server into modern, modern with a different version, or legacy. A recognized modern error never falls back; only an unrecognized error or a timeout does.</div>'
  ].join('');
  host.appendChild(shell);
}
// register as: mcpa-05-era-matrix
