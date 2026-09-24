function primitivesFigure(host) {
  ensureStyles();
  var shell = document.createElement('div');
  shell.className = 'mf-shell';
  shell.innerHTML = [
    '<div class="mf-head"><strong>Interactions and Execution</strong> requests, notifications, and the three primitives</div>',
    '<div class="mf-body">',
    '<svg viewBox="0 0 560 246" role="img" aria-label="A request carries an id and receives a response keyed to it. A notification carries no id and receives nothing back, ever. A server exposes three primitive families: tools, resources, and prompts.">',
    '<style>.mfx{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.mft{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}.mfl{fill:var(--ink-mute,#777);font:9px var(--font-mono,monospace)}.mfa{stroke:var(--blueprint,#3553ff);fill:none;stroke-width:1.5}.mfd{stroke:var(--ink-mute,#999);fill:none;stroke-width:1.5;stroke-dasharray:3,3}</style>',
    '<text class="mfl" x="8" y="16">a request carries an id</text>',
    '<rect class="mfx" x="8" y="22" width="86" height="56"/><text class="mft" x="20" y="54">client</text>',
    '<rect class="mfx" x="220" y="22" width="86" height="56"/><text class="mft" x="232" y="54">server</text>',
    '<path class="mfa" d="M94 40 L220 40" marker-end="url(#mfarrow)"/><text class="mfl" x="100" y="36">request, id 7</text>',
    '<path class="mfa" d="M220 62 L94 62" marker-end="url(#mfarrow)"/><text class="mfl" x="96" y="76">response, id 7</text>',
    '<text class="mfl" x="8" y="100">a notification carries none</text>',
    '<rect class="mfx" x="8" y="106" width="86" height="56"/><text class="mft" x="20" y="138">client</text>',
    '<rect class="mfx" x="220" y="106" width="86" height="56"/><text class="mft" x="232" y="138">server</text>',
    '<path class="mfa" d="M94 124 L220 124" marker-end="url(#mfarrow)"/><text class="mfl" x="88" y="120">notification, no id</text>',
    '<path class="mfd" d="M220 146 L160 146"/><text class="mft" x="146" y="150">x</text><text class="mfl" x="316" y="150">no response, ever</text>',
    '<text class="mfl" x="8" y="186">a server exposes three primitive families</text>',
    '<rect class="mfx" x="8" y="192" width="170" height="48"/><text class="mft" x="18" y="212">tool</text><text class="mfl" x="18" y="228">the model calls it</text>',
    '<rect class="mfx" x="195" y="192" width="170" height="48"/><text class="mft" x="205" y="212">resource</text><text class="mfl" x="205" y="228">the host attaches it</text>',
    '<rect class="mfx" x="382" y="192" width="170" height="48"/><text class="mft" x="392" y="212">prompt</text><text class="mfl" x="392" y="228">the user picks it</text>',
    '<defs><marker id="mfarrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="var(--blueprint,#3553ff)"/></marker></defs>',
    '</svg>',
    '</div>',
    '<div class="mf-caption">The id field is the whole difference: a request carries one and gets back a response keyed to it; a notification carries none and gets nothing back, ever, even when its method is unknown. A server\'s capabilities split into three addressable families: tools the model calls, resources the host attaches, and prompts the user picks.</div>'
  ].join('');
  host.appendChild(shell);
}

// register as: mcpa-04-primitives
