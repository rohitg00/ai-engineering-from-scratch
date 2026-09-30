function tracePropagationFigure(host) {
  ensureStyles();
  var shell = document.createElement('div');
  shell.className = 'mf-shell';
  shell.innerHTML = [
    '<div class="mf-head"><strong>Trace Propagation and the Audit Chain</strong> one trace id, three programs, two independent logs</div>',
    '<div class="mf-body">',
    '<svg viewBox="0 0 560 170" role="img" aria-label="A client calls ops-desk, which calls credential-vault. Both arrows carry the same trace id and a different span id per hop. Below ops-desk and credential-vault, two separate three-entry hash chains represent each server keeping its own independent audit log.">',
    '<style>.tpfbox{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.tpft{fill:var(--ink,#111);font:11px var(--font-mono,monospace);text-anchor:middle}.tpfl{fill:var(--ink-mute,#767676);font:11px var(--font-mono,monospace);text-anchor:middle}.tpfarrow{stroke:var(--blueprint,#3553ff);stroke-width:1.5;fill:none}.tpfchain{fill:var(--bg-surface,#eee);stroke:var(--blueprint,#3553ff)}.tpfchainline{stroke:var(--blueprint,#3553ff);stroke-width:1.3}</style>',
    '<rect class="tpfbox" x="8" y="20" width="92" height="34"/><text class="tpft" x="54" y="41">client</text>',
    '<rect class="tpfbox" x="234" y="20" width="92" height="34"/><text class="tpft" x="280" y="41">ops-desk</text>',
    '<rect class="tpfbox" x="460" y="20" width="92" height="34"/><text class="tpft" x="506" y="41">cred-vault</text>',
    '<path class="tpfarrow" d="M100 37 L228 37" marker-end="url(#tpfarrow)"/>',
    '<path class="tpfarrow" d="M326 37 L454 37" marker-end="url(#tpfarrow)"/>',
    '<text class="tpfl" x="167" y="64">trace a1e4c9d0</text><text class="tpfl" x="167" y="78">span 5f2b8e13</text>',
    '<text class="tpfl" x="393" y="64">trace a1e4c9d0</text><text class="tpfl" x="393" y="78">span d40a7c66</text>',
    '<text class="tpfl" x="280" y="104">own audit log</text>',
    '<text class="tpfl" x="506" y="104">own audit log</text>',
    '<rect class="tpfchain" x="245" y="112" width="14" height="14" rx="2"/><rect class="tpfchain" x="273" y="112" width="14" height="14" rx="2"/><rect class="tpfchain" x="301" y="112" width="14" height="14" rx="2"/>',
    '<line class="tpfchainline" x1="259" y1="119" x2="273" y2="119"/><line class="tpfchainline" x1="287" y1="119" x2="301" y2="119"/>',
    '<rect class="tpfchain" x="471" y="112" width="14" height="14" rx="2"/><rect class="tpfchain" x="499" y="112" width="14" height="14" rx="2"/><rect class="tpfchain" x="527" y="112" width="14" height="14" rx="2"/>',
    '<line class="tpfchainline" x1="485" y1="119" x2="499" y2="119"/><line class="tpfchainline" x1="513" y1="119" x2="527" y2="119"/>',
    '<text class="tpfl" x="280" y="148">same trace id above, its own hash chain below</text>',
    '<text class="tpfl" x="506" y="148">same trace id above, its own hash chain below</text>',
    '<defs><marker id="tpfarrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="var(--blueprint,#3553ff)"/></marker></defs>',
    '</svg>',
    '</div>',
    '<div class="mf-caption">The trace id stays constant across both hops while each arrow mints its own span id. ops-desk and credential-vault each keep an independent, hash-chained audit log: neither log reads or writes the other’s entries, so the only thing that ties one server’s entry to the other’s is a shared trace id, never a shared request id.</div>'
  ].join('');
  host.appendChild(shell);
}
// register as: mcpa-27-trace-propagation
