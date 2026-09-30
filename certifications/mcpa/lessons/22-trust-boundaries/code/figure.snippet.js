function trustZonesFigure(host) {
  ensureStyles();
  var shell = document.createElement('div');
  shell.className = 'mf-shell';
  shell.innerHTML = [
    '<div class="mf-head"><strong>Trust Zones in an MCP Exchange</strong> host and client trusted, server and upstream untrusted, the model reads only labeled content</div>',
    '<div class="mf-body">',
    '<svg viewBox="0 0 560 230" role="img" aria-label="Host, client, and model sit inside a trusted zone on the left, connected by short arrows. A dashed trust boundary separates them from the server zone on the right. A request crosses the boundary to the server. Content returning from the server crosses back through a trust filter marked untrusted before the model reads it. The server connects onward to upstream systems that the client never sees directly.">',
    '<style>.tz22x{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.tz22t{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}.tz22l{fill:var(--ink-mute,#777);font:11px var(--font-mono,monospace)}.tz22z{fill:none;stroke:var(--rule-soft,#ccc);stroke-dasharray:3,3}.tz22a{stroke:var(--blueprint,#3553ff);fill:none;stroke-width:1.5}.tz22r{stroke:var(--ink-mute,#999);fill:none;stroke-width:1.4;stroke-dasharray:4,3}.tz22u{stroke:var(--ink-mute,#999);fill:none;stroke-width:1.2;stroke-dasharray:2,3}.tz22g{fill:var(--bg-surface,#eee);stroke:var(--blueprint,#3553ff);stroke-width:2}</style>',
    '<text class="tz22l" x="91" y="18" text-anchor="middle">trusted zone</text>',
    '<text class="tz22l" x="380" y="18" text-anchor="middle">untrusted zone</text>',
    '<rect class="tz22z" x="8" y="26" width="166" height="180"/>',
    '<line class="tz22z" x1="190" y1="26" x2="190" y2="206"/>',
    '<text class="tz22l" x="196" y="34">trust boundary</text>',
    '<rect class="tz22x" x="20" y="40" width="140" height="36"/>',
    '<text class="tz22t" x="32" y="56">host</text>',
    '<text class="tz22l" x="32" y="70">the user\'s app</text>',
    '<rect class="tz22x" x="20" y="88" width="140" height="36"/>',
    '<text class="tz22t" x="32" y="104">client</text>',
    '<text class="tz22l" x="32" y="118">one per server</text>',
    '<rect class="tz22x" x="20" y="156" width="140" height="40"/>',
    '<text class="tz22t" x="32" y="174">model</text>',
    '<text class="tz22l" x="32" y="188">sees labeled data</text>',
    '<rect class="tz22x" x="230" y="94" width="110" height="36"/>',
    '<text class="tz22t" x="242" y="110">server</text>',
    '<text class="tz22l" x="242" y="124">third party</text>',
    '<rect class="tz22x" x="390" y="94" width="140" height="36"/>',
    '<text class="tz22t" x="402" y="110">upstream systems</text>',
    '<text class="tz22l" x="402" y="124">once removed</text>',
    '<path class="tz22a" d="M90 76 L90 88" marker-end="url(#tz22arrow)"/>',
    '<path class="tz22a" d="M90 124 L90 156" marker-end="url(#tz22arrow)"/>',
    '<path class="tz22a" d="M160 98 L230 98" marker-end="url(#tz22arrow)"/>',
    '<path class="tz22r" d="M230 118 L160 118" marker-end="url(#tz22arrowm)"/>',
    '<path class="tz22u" d="M340 112 L390 112" marker-end="url(#tz22arrowm)"/>',
    '<polygon class="tz22g" points="190,90 206,108 190,126 174,108"/>',
    '<text class="tz22l" x="195" y="142" text-anchor="middle">trust filter</text>',
    '<defs>',
    '<marker id="tz22arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="var(--blueprint,#3553ff)"/></marker>',
    '<marker id="tz22arrowm" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="var(--ink-mute,#999)"/></marker>',
    '</defs>',
    '</svg>',
    '</div>',
    '<div class="mf-caption">The host and the client it owns sit with the model inside one trust domain. A request crosses the dashed boundary to reach the server; whatever the server returns crosses back through the trust filter, marked untrusted, before the model reads it. The server may reach further upstream systems that the client never observes directly.</div>'
  ].join('');
  host.appendChild(shell);
}
// register as: mcpa-22-trust-zones
