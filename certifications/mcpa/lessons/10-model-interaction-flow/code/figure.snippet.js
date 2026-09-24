function modelInteractionFlowFigure(host) {
  ensureStyles();
  var parts = [];
  parts.push('<rect class="l10x" x="6" y="26" width="90" height="44" rx="4"/><text class="l10t" x="14" y="53">user asks</text>');
  parts.push('<rect class="l10x" x="104" y="26" width="116" height="44" rx="4"/><text class="l10t" x="112" y="53">host: context</text>');
  parts.push('<rect class="l10x" x="228" y="26" width="112" height="44" rx="4"/><text class="l10t" x="236" y="53">model selects</text>');
  parts.push('<rect class="l10g" x="348" y="26" width="104" height="44" rx="4"/><text class="l10t" x="356" y="53">confirm gate</text>');
  parts.push('<rect class="l10x" x="460" y="26" width="94" height="44" rx="4"/><text class="l10t" x="468" y="53">server</text>');
  parts.push('<path class="l10a" d="M96 48 L104 48" marker-end="url(#l10arrow)"/>');
  parts.push('<path class="l10a" d="M220 48 L228 48" marker-end="url(#l10arrow)"/>');
  parts.push('<path class="l10a" d="M340 48 L348 48" marker-end="url(#l10arrow)"/>');
  parts.push('<path class="l10a" d="M452 48 L460 48" marker-end="url(#l10arrow)"/>');
  parts.push('<text class="l10c" x="410" y="18">approved</text>');
  parts.push('<rect class="l10h" x="20" y="110" width="140" height="40" rx="4"/><text class="l10t" x="28" y="134">held (denied)</text>');
  parts.push('<path class="l10a" d="M402 70 L90 110" marker-end="url(#l10arrow)"/>');
  parts.push('<text class="l10c" x="330" y="92">denied, never sent</text>');
  parts.push('<rect class="l10x" x="20" y="180" width="110" height="44" rx="4"/><text class="l10t" x="28" y="207">complete</text>');
  parts.push('<rect class="l10x" x="160" y="180" width="140" height="44" rx="4"/><text class="l10t" x="168" y="207">isError: true</text>');
  parts.push('<rect class="l10x" x="330" y="180" width="170" height="44" rx="4"/><text class="l10t" x="338" y="207">input_required</text>');
  parts.push('<path class="l10a" d="M507 70 L75 180" marker-end="url(#l10arrow)"/>');
  parts.push('<path class="l10a" d="M507 70 L230 180" marker-end="url(#l10arrow)"/>');
  parts.push('<path class="l10a" d="M507 70 L415 180" marker-end="url(#l10arrow)"/>');
  parts.push('<path class="l10fb" d="M230 180 L230 80 L284 80 L284 70" marker-end="url(#l10arrow)"/>');
  parts.push('<path class="l10fb" d="M415 180 L415 86 L300 86 L300 70" marker-end="url(#l10arrow)"/>');
  parts.push('<text class="l10c" x="196" y="76">retry, corrected args</text>');
  parts.push('<text class="l10c" x="330" y="170">retry, new id, requestState echoed</text>');
  parts.push('<rect class="l10x" x="10" y="250" width="150" height="36" rx="4"/><text class="l10t" x="18" y="272">answer to user</text>');
  parts.push('<path class="l10a" d="M75 224 L85 250" marker-end="url(#l10arrow)"/>');
  var shell = document.createElement('div');
  shell.className = 'mf-shell';
  shell.innerHTML = [
    '<div class="mf-head"><strong>Model Interaction Flow</strong> context, selection, confirmation, call, and back</div>',
    '<div class="mf-body">',
    '<svg viewBox="0 0 560 296" role="img" aria-label="A user request flows through a host that builds model context, a model that selects a tool and drafts arguments, and a confirmation gate. An approved call reaches the server; a denied one is held and never sent. The server can return a complete result that becomes the answer, a tool execution error that sends the model back to correct its arguments, or an input required result that sends the host to gather an answer and retry with a new id and the same requestState.">',
    '<defs><marker id="l10arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="var(--blueprint,#3553ff)"/></marker></defs>',
    '<style>.l10x{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.l10g{fill:var(--bg-surface,#eee);stroke:var(--blueprint,#3553ff);stroke-width:1.5}.l10h{fill:none;stroke:var(--ink-mute,#999);stroke-width:1.2;stroke-dasharray:3 2}.l10t{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}.l10c{fill:var(--ink-mute,#777);font:11px var(--font-mono,monospace)}.l10a{stroke:var(--blueprint,#3553ff);fill:none;stroke-width:1.5}.l10fb{stroke:var(--ink-mute,#999);fill:none;stroke-width:1.4;stroke-dasharray:4 3}</style>',
    parts.join(''),
    '</svg>',
    '</div>',
    '<div class="mf-caption">The loop has one branch the wire never sees: a denied confirmation stops before the client sends anything. Of the branches that reach the server, a tool execution error and an input required result both return control to the model, but only the input required branch is a retry with a new id and an echoed requestState; a protocol error also returns control to the model, with nothing to correct, so the loop does not send it again.</div>'
  ].join('');
  host.appendChild(shell);
}
// register as: mcpa-10-interaction-flow
