function consentGatesFigure(host) {
  ensureStyles();
  var shell = document.createElement('div');
  shell.className = 'mf-shell';
  shell.innerHTML = [
    '<div class="mf-head"><strong>Consent and Least Privilege</strong> one tools/call, two independent gates before it runs</div>',
    '<div class="mf-body">',
    '<svg viewBox="0 0 560 210" role="img" aria-label="A client tools/call first meets a scope check. Insufficient scope returns HTTP 403 and the client retries with the union of its old and challenged scopes. Once scope is sufficient the call meets a consent check. If consent is required the server returns input_required and the client retries after an elicitation round trip. Only then does the tool run.">',
    '<style>',
    '.l25box{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}',
    '.l25t{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}',
    '.l25tm{fill:var(--ink-mute,#777);font:11px var(--font-mono,monospace)}',
    '.l25tl{fill:var(--ink-soft,#666);font:11px var(--font-mono,monospace)}',
    '.l25arrow{stroke:var(--blueprint,#3553ff);stroke-width:1.6;fill:none}',
    '.l25loop{stroke:var(--ink-soft,#999);stroke-width:1.2;fill:none;stroke-dasharray:3 2}',
    '.l25m{fill:var(--blueprint,#3553ff)}',
    '</style>',
    '<defs>',
    '<marker id="l25arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path class="l25m" d="M0 0 L6 3 L0 6 Z"/></marker>',
    '<marker id="l25loopend" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path class="l25m" d="M0 0 L6 3 L0 6 Z"/></marker>',
    '</defs>',
    '<rect class="l25box" x="8" y="40" width="88" height="40"/>',
    '<text class="l25t" x="14" y="56">tools/call</text>',
    '<text class="l25tm" x="14" y="70">client sends</text>',
    '<rect class="l25box" x="140" y="40" width="112" height="40"/>',
    '<text class="l25t" x="146" y="56">scope check</text>',
    '<text class="l25tm" x="146" y="70">403 if short</text>',
    '<rect class="l25box" x="304" y="40" width="112" height="40"/>',
    '<text class="l25t" x="310" y="56">consent check</text>',
    '<text class="l25tm" x="310" y="70">input_required</text>',
    '<rect class="l25box" x="468" y="40" width="84" height="40"/>',
    '<text class="l25t" x="474" y="56">tool runs</text>',
    '<text class="l25tm" x="474" y="70">isError: false</text>',
    '<line class="l25arrow" x1="96" y1="60" x2="138" y2="60" marker-end="url(#l25arrow)"/>',
    '<line class="l25arrow" x1="252" y1="60" x2="302" y2="60" marker-end="url(#l25arrow)"/>',
    '<text class="l25tl" x="256" y="52">scope ok</text>',
    '<line class="l25arrow" x1="416" y1="60" x2="466" y2="60" marker-end="url(#l25arrow)"/>',
    '<text class="l25tl" x="420" y="52">consent ok</text>',
    '<path class="l25loop" d="M172 80 C 150 132, 245 132, 222 80" marker-end="url(#l25loopend)"/>',
    '<text class="l25tl" x="137" y="150">403: union + retry</text>',
    '<path class="l25loop" d="M334 80 C 310 132, 410 132, 386 80" marker-end="url(#l25loopend)"/>',
    '<text class="l25tl" x="273" y="150">no consent: elicit, retry</text>',
    '</svg>',
    '</div>',
    '<div class="mf-caption">A tools/call meets the scope gate first: insufficient scope comes back as HTTP 403, and the client retries with the union of its old and newly challenged scopes, capped at a few attempts. Only once scope clears does the call meet the consent gate: a tool needing approval comes back input_required, and the client retries after an elicitation round trip. Either gate can turn a call away on its own.</div>'
  ].join('');
  host.appendChild(shell);
}
// register as: mcpa-25-consent-gates
