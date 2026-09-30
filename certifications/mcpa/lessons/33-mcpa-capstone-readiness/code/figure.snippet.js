function capstoneFlowFigure(host) {
  ensureStyles();
  var parts = [];
  parts.push('<rect class="l33x" x="4" y="28" width="84" height="44" rx="4"/><text class="l33t" x="12" y="54">discover</text>');
  parts.push('<rect class="l33x" x="96" y="28" width="108" height="44" rx="4"/><text class="l33t" x="104" y="54">schema check</text>');
  parts.push('<rect class="l33x" x="212" y="28" width="116" height="44" rx="4"/><text class="l33t" x="220" y="54">MRTR consent</text>');
  parts.push('<rect class="l33x" x="336" y="28" width="92" height="44" rx="4"/><text class="l33t" x="344" y="54">task poll</text>');
  parts.push('<rect class="l33x" x="436" y="28" width="120" height="44" rx="4"/><text class="l33t" x="444" y="54">audited result</text>');
  parts.push('<path class="l33a" d="M88 50 L96 50" marker-end="url(#l33arrow)"/>');
  parts.push('<path class="l33a" d="M204 50 L212 50" marker-end="url(#l33arrow)"/>');
  parts.push('<path class="l33a" d="M328 50 L336 50" marker-end="url(#l33arrow)"/>');
  parts.push('<path class="l33a" d="M428 50 L436 50" marker-end="url(#l33arrow)"/>');
  parts.push('<text class="l33c" x="4" y="84">traceparent: one trace id end to end</text>');
  parts.push('<path class="l33d" d="M4 90 L556 90"/>');
  parts.push('<circle class="l33p" cx="46" cy="90" r="3"/>');
  parts.push('<circle class="l33p" cx="150" cy="90" r="3"/>');
  parts.push('<circle class="l33p" cx="270" cy="90" r="3"/>');
  parts.push('<circle class="l33p" cx="382" cy="90" r="3"/>');
  parts.push('<circle class="l33p" cx="496" cy="90" r="3"/>');
  parts.push('<text class="l33c" x="4" y="153">audit log:</text>');
  parts.push('<rect class="l33e" x="76" y="134" width="30" height="30" rx="3"/><text class="l33t" x="84" y="153">e1</text>');
  parts.push('<rect class="l33e" x="118" y="134" width="30" height="30" rx="3"/><text class="l33t" x="126" y="153">e2</text>');
  parts.push('<rect class="l33e" x="160" y="134" width="30" height="30" rx="3"/><text class="l33t" x="168" y="153">e3</text>');
  parts.push('<rect class="l33e" x="202" y="134" width="30" height="30" rx="3"/><text class="l33t" x="210" y="153">e4</text>');
  parts.push('<path class="l33a" d="M106 149 L118 149" marker-end="url(#l33arrow)"/>');
  parts.push('<path class="l33a" d="M148 149 L160 149" marker-end="url(#l33arrow)"/>');
  parts.push('<path class="l33a" d="M190 149 L202 149" marker-end="url(#l33arrow)"/>');
  parts.push('<text class="l33c" x="240" y="153">verify: ok</text>');
  parts.push('<rect class="l33o" x="330" y="134" width="226" height="30" rx="4"/><text class="l33t" x="338" y="153">OAuth: audience checked</text>');
  var shell = document.createElement('div');
  shell.className = 'mf-shell';
  shell.innerHTML = [
    '<div class="mf-head"><strong>Capstone Exchange</strong> discovery through consent, a task, and an audited result</div>',
    '<div class="mf-body">',
    '<svg viewBox="0 0 560 176" role="img" aria-label="A capstone exchange: server discover feeds a schema check, an MRTR consent round trip, a task that is polled to completion, and an audited result. A dashed line beneath the pipeline shows one trace id propagated across every stage. Below that, a four entry hash chained audit log verifies, and a separate OAuth audience check gates one HTTP call.">',
    '<defs><marker id="l33arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="var(--blueprint,#3553ff)"/></marker></defs>',
    '<style>.l33x{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.l33e{fill:var(--bg-surface,#eee);stroke:var(--blueprint,#3553ff);stroke-width:1.2}.l33o{fill:none;stroke:var(--ink-mute,#999);stroke-width:1.2;stroke-dasharray:3 2}.l33t{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}.l33c{fill:var(--ink-mute,#777);font:11px var(--font-mono,monospace)}.l33a{stroke:var(--blueprint,#3553ff);fill:none;stroke-width:1.5}.l33d{stroke:var(--ink-mute,#999);stroke-width:1;stroke-dasharray:2 3}.l33p{fill:var(--blueprint,#3553ff)}</style>',
    parts.join(''),
    '</svg>',
    '</div>',
    '<div class="mf-caption">One incident response exchange touches every domain at once: discovery with cache hints, a schema check that returns isError before it ever asks for consent, an MRTR round trip protected by an HMAC signed requestState, a task polled to completion, and a result. The same trace id threads every hop, an OAuth audience check gates the one HTTP call, and a hash chained audit log records the outcome of each step and still verifies at the end.</div>'
  ].join('');
  host.appendChild(shell);
}
// register as: mcpa-33-capstone-flow
