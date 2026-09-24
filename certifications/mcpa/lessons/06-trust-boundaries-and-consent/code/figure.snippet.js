function trustBoundaryFigure(host) {
  ensureStyles();
  var shell = document.createElement('div');
  shell.className = 'mf-shell';
  shell.innerHTML = [
    '<div class="mf-head"><strong>Trust Boundaries and Consent</strong> host/client trusted, server/tool untrusted</div>',
    '<div class="mf-body">',
    '<svg viewBox="0 0 560 230" role="img" aria-label="The host and client sit inside a trusted zone on the left. The server and tool sit in an untrusted zone on the right. A consent gate sits on the boundary for side-effecting calls. Results return marked as untrusted content.">',
    '<style>.tbx{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.tbt{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}.tbl{fill:var(--ink-mute,#777);font:9px var(--font-mono,monospace)}.tba{stroke:var(--blueprint,#3553ff);fill:none;stroke-width:1.5}.tbr{stroke:var(--blueprint,#3553ff);fill:none;stroke-width:1.5;stroke-dasharray:4,3}.tbz{stroke:var(--rule-soft,#ccc);stroke-dasharray:3,3}.tbg{fill:var(--bg-surface,#eee);stroke:var(--blueprint,#3553ff);stroke-width:2}</style>',
    '<text class="tbl" x="14" y="18">trusted zone</text>',
    '<text class="tbl" x="392" y="18" text-anchor="middle">untrusted zone</text>',
    '<line class="tbz" x1="278" y1="26" x2="278" y2="192"/>',
    '<text class="tbl" x="284" y="40">trust boundary</text>',
    '<rect class="tbx" x="14" y="80" width="100" height="60"/><text class="tbt" x="26" y="104">host</text><text class="tbl" x="26" y="122">the app</text>',
    '<rect class="tbx" x="150" y="80" width="100" height="60"/><text class="tbt" x="162" y="104">client</text><text class="tbl" x="162" y="122">one link</text>',
    '<rect class="tbx" x="306" y="80" width="100" height="60"/><text class="tbt" x="318" y="104">server</text><text class="tbl" x="318" y="122">third party</text>',
    '<rect class="tbx" x="442" y="80" width="104" height="60"/><text class="tbt" x="454" y="104">tool</text><text class="tbl" x="454" y="122">an action</text>',
    '<path class="tba" d="M114 110 L150 110" marker-end="url(#tbarrow)"/>',
    '<path class="tba" d="M406 110 L442 110" marker-end="url(#tbarrow)"/>',
    '<path class="tba" d="M250 100 L306 100" marker-end="url(#tbarrow)"/>',
    '<path class="tbr" d="M306 120 L250 120" marker-end="url(#tbarrowr)"/>',
    '<polygon class="tbg" points="278,87 291,100 278,113 265,100"/>',
    '<text class="tbl" x="278" y="72" text-anchor="middle">consent gate</text>',
    '<text class="tbl" x="278" y="155" text-anchor="middle">side-effecting calls must pass the gate; results return untrusted</text>',
    '<defs>',
    '<marker id="tbarrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="var(--blueprint,#3553ff)"/></marker>',
    '<marker id="tbarrowr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="var(--blueprint,#3553ff)"/></marker>',
    '</defs>',
    '</svg>',
    '</div>',
    '<div class="mf-caption">The host and its client are inside the user\'s trust domain; the server and its tools are not. A side-effecting call must clear a consent gate scoped to that one tool before it runs. A read-only call may cross without one. Every result that returns is untrusted content entering the model\'s context, not a message the host already vetted.</div>'
  ].join('');
  host.appendChild(shell);
}

// register as: mcpa-06-trust-boundary
