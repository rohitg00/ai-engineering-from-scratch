function lifecycleFigure(host) {
  ensureStyles();
  var shell = document.createElement('div');
  shell.className = 'mf-shell';
  shell.innerHTML = [
    '<div class="mf-head"><strong>Interactions and Execution</strong> tool invocation lifecycle</div>',
    '<div class="mf-body">',
    '<svg viewBox="0 0 640 250" role="img" aria-label="A tools/call request moves through received, parsed, validated, and executed before a result, with a branch to a JSON-RPC error at each of the last three checkpoints">',
    '<style>.mfx{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.mfe{fill:var(--bg-surface,#eee);stroke:var(--ink-mute,#999)}.mft{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}.mfl{fill:var(--ink-mute,#777);font:9px var(--font-mono,monospace)}.mfa{stroke:var(--blueprint,#3553ff);fill:none;stroke-width:1.5}.mfb{stroke:var(--ink-mute,#999);fill:none;stroke-width:1.2;stroke-dasharray:4 3}</style>',
    '<rect class="mfx" x="8" y="18" width="92" height="56"/><text class="mft" x="18" y="42">received</text><text class="mfl" x="18" y="60">raw payload</text>',
    '<rect class="mfx" x="132" y="18" width="92" height="56"/><text class="mft" x="142" y="42">parsed</text><text class="mfl" x="142" y="60">JSON + envelope</text>',
    '<rect class="mfx" x="254" y="18" width="108" height="56"/><text class="mft" x="264" y="42">validated</text><text class="mfl" x="264" y="60">method + schema</text>',
    '<rect class="mfx" x="394" y="18" width="92" height="56"/><text class="mft" x="404" y="42">executed</text><text class="mfl" x="404" y="60">handler runs</text>',
    '<rect class="mfx" x="518" y="18" width="100" height="56"/><text class="mft" x="528" y="42">result</text><text class="mfl" x="528" y="60">keyed to id</text>',
    '<path class="mfa" d="M100 46 L132 46" marker-end="url(#mfarrow05)"/>',
    '<path class="mfa" d="M224 46 L254 46" marker-end="url(#mfarrow05)"/>',
    '<path class="mfa" d="M362 46 L394 46" marker-end="url(#mfarrow05)"/>',
    '<path class="mfa" d="M486 46 L518 46" marker-end="url(#mfarrow05)"/>',
    '<rect class="mfe" x="96" y="152" width="164" height="50"/><text class="mft" x="104" y="172">-32700 / -32600</text><text class="mfl" x="104" y="190">parse / invalid request</text>',
    '<rect class="mfe" x="226" y="152" width="176" height="50"/><text class="mft" x="234" y="172">-32601 / -32602</text><text class="mfl" x="234" y="190">not found / bad params</text>',
    '<rect class="mfe" x="368" y="152" width="140" height="50"/><text class="mft" x="376" y="172">-32603</text><text class="mfl" x="376" y="190">internal error</text>',
    '<path class="mfb" d="M178 74 L178 152" marker-end="url(#mfarrow05)"/>',
    '<path class="mfb" d="M308 74 L314 152" marker-end="url(#mfarrow05)"/>',
    '<path class="mfb" d="M440 74 L438 152" marker-end="url(#mfarrow05)"/>',
    '<defs><marker id="mfarrow05" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="var(--blueprint,#3553ff)"/></marker></defs>',
    '</svg>',
    '</div>',
    '<div class="mf-caption">A tools/call request moves left to right through four checkpoints. A dashed branch at parsed, validated, or executed peels a failing call off toward one of the five JSON-RPC error codes instead of a result, always keyed to the original request id.</div>'
  ].join('');
  host.appendChild(shell);
}

// register as: mcpa-05-lifecycle
