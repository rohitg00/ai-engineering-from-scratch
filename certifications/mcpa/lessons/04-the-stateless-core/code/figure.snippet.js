function statelessRequestsFigure(host) {
  ensureStyles();
  var shell = document.createElement('div');
  shell.className = 'mf-shell';
  shell.innerHTML = [
    '<div class="mf-head"><strong>The Stateless Core</strong> any replica answers, because state lives off the process</div>',
    '<div class="mf-body">',
    '<svg viewBox="0 0 560 230" role="img" aria-label="Two clients, alice and bob, send requests through a round robin router to two interchangeable server replicas, A and B. Both replicas read and write the same shared handle store, so whichever replica gets the next request answers it correctly.">',
    '<defs><marker id="l04arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" class="l04p"/></marker></defs>',
    '<style>.l04x{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.l04s{fill:var(--bg,#fff);stroke:var(--blueprint,#3553ff);stroke-dasharray:3,2}.l04t{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}.l04l{stroke:var(--ink-soft,#aaa);stroke-width:1;opacity:.85}.l04a{stroke:var(--blueprint,#3553ff);stroke-width:1.4}.l04p{fill:var(--blueprint,#3553ff)}.l04c{fill:var(--ink-mute,#777);font:11px var(--font-mono,monospace)}</style>',
    '<rect class="l04x" x="14" y="26" width="76" height="26"/><text class="l04t" x="22" y="43">alice</text>',
    '<rect class="l04x" x="14" y="140" width="76" height="26"/><text class="l04t" x="22" y="157">bob</text>',
    '<rect class="l04x" x="150" y="80" width="100" height="40"/><text class="l04t" x="158" y="97">router</text><text class="l04t" x="158" y="112">round robin</text>',
    '<rect class="l04x" x="300" y="14" width="100" height="30"/><text class="l04t" x="308" y="33">replica A</text>',
    '<rect class="l04x" x="300" y="156" width="100" height="30"/><text class="l04t" x="308" y="175">replica B</text>',
    '<rect class="l04s" x="452" y="60" width="96" height="80"/><text class="l04t" x="460" y="95">shared</text><text class="l04t" x="460" y="113">store</text>',
    '<line class="l04l" x1="90" y1="39" x2="148" y2="90" marker-end="url(#l04arrow)"/>',
    '<line class="l04l" x1="90" y1="153" x2="148" y2="110" marker-end="url(#l04arrow)"/>',
    '<line class="l04a" x1="250" y1="90" x2="298" y2="29" marker-end="url(#l04arrow)"/>',
    '<line class="l04a" x1="250" y1="110" x2="298" y2="171" marker-end="url(#l04arrow)"/>',
    '<line class="l04a" x1="400" y1="29" x2="450" y2="80" marker-end="url(#l04arrow)"/>',
    '<line class="l04a" x1="400" y1="171" x2="450" y2="120" marker-end="url(#l04arrow)"/>',
    '<text class="l04c" x="14" y="222">same handle, either replica</text>',
    '<text class="l04c" x="300" y="222">state lives in the store</text>',
    '</svg>',
    '</div>',
    '<div class="mf-caption">Alice\'s and bob\'s requests are routed round robin, with no stickiness to either replica. Neither replica keeps basket state in memory; both read and write the same shared store keyed by the opaque handle a tool call returned, so whichever replica answers the next request answers it correctly.</div>'
  ].join('');
  host.appendChild(shell);
}
// register as: mcpa-04-stateless-requests
