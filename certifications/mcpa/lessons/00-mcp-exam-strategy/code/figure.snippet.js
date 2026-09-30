function blueprintWeightsFigure(host) {
  ensureStyles();

  var domains = [
    { label: 'Fundamentals', weight: 16 },
    { label: 'Architecture', weight: 14 },
    { label: 'Interactions', weight: 26 },
    { label: 'Security', weight: 24 },
    { label: 'Use Cases', weight: 20 }
  ];

  var baseline = 210;
  var barWidth = 70;
  var step = 100;
  var startX = 45;
  var pxPerPercent = 5;

  var bars = '';
  var i, d, x, barHeight, barY, valueY, labelY, centerX;
  for (i = 0; i < domains.length; i += 1) {
    d = domains[i];
    x = startX + i * step;
    centerX = x + barWidth / 2;
    barHeight = d.weight * pxPerPercent;
    barY = baseline - barHeight;
    valueY = barY - 8;
    labelY = baseline + 18;
    bars += '<rect class="mfbar" x="' + x + '" y="' + barY + '" width="' + barWidth + '" height="' + barHeight + '"/>';
    bars += '<text class="mfval" x="' + centerX + '" y="' + valueY + '">' + d.weight + '%</text>';
    bars += '<text class="mflabel" x="' + centerX + '" y="' + labelY + '">' + d.label + '</text>';
  }

  var shell = document.createElement('div');
  shell.className = 'mf-shell';
  shell.innerHTML = [
    '<div class="mf-head"><strong>MCPA Blueprint</strong> five domains weighted by percent of exam content</div>',
    '<div class="mf-body">',
    '<svg viewBox="0 0 560 250" role="img" aria-label="Bar chart of the five MCPA domain weights: MCP Fundamentals 16 percent, Architecture and Components 14 percent, Interactions and Execution 26 percent, Security and Governance 24 percent, Use Cases and Ecosystem 20 percent">',
    '<style>.mfbar{fill:var(--blueprint,#3553ff);opacity:.85}.mfval{fill:var(--ink,#111);font:11px var(--font-mono,monospace);text-anchor:middle}.mflabel{fill:var(--ink-mute,#777);font:11px var(--font-mono,monospace);text-anchor:middle}.mfaxis{stroke:var(--rule-soft,#ccc);stroke-width:1}</style>',
    '<line class="mfaxis" x1="30" y1="210" x2="530" y2="210"/>',
    bars,
    '</svg>',
    '</div>',
    '<div class="mf-caption">Interactions and Execution and Security and Governance together carry half the blueprint. Study hours split evenly across five domains would starve the two tallest bars.</div>'
  ].join('');
  host.appendChild(shell);
}

// register as: mcpa-00-blueprint-weights
