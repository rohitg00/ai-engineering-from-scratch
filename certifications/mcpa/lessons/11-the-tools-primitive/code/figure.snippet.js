function toolCallFigure(host) {
  ensureStyles();
  var chipLabels = ['text', 'image', 'audio', 'resource_link', 'resource'];
  var chipX = [8, 120, 232, 344, 456];
  var chipW = [104, 104, 104, 104, 96];
  var chips = [];
  var i;
  for (i = 0; i < chipLabels.length; i++) {
    chips.push('<rect class="l11x" x="' + chipX[i] + '" y="122" width="' + chipW[i] + '" height="26" rx="3"/>');
    chips.push('<text class="l11t" x="' + (chipX[i] + chipW[i] / 2) + '" y="139" text-anchor="middle">' + chipLabels[i] + '</text>');
  }
  var shell = document.createElement('div');
  shell.className = 'mf-shell';
  shell.innerHTML = [
    '<div class="mf-head"><strong>The Tools Primitive</strong> one call, five kinds of content, two error channels</div>',
    '<div class="mf-body">',
    '<svg viewBox="0 0 560 230" role="img" aria-label="A client sends tools/call to a server and gets back a CallToolResult. The result content list can hold text, image, audio, resource_link, or resource blocks. The same result also reports isError, omitted or false on success, true when the tool itself failed.">',
    '<defs><marker id="l11arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path class="l11m" d="M0,0 L6,3 L0,6 Z"/></marker></defs>',
    '<style>.l11x{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.l11t{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}.l11a{stroke:var(--blueprint,#3553ff);stroke-width:1.4;fill:none}.l11m{fill:var(--blueprint,#3553ff)}.l11n{fill:var(--ink-mute,#777);font:11px var(--font-mono,monospace)}</style>',
    '<rect class="l11x" x="16" y="36" width="110" height="40" rx="4"/><text class="l11t" x="71" y="60" text-anchor="middle">Client</text>',
    '<rect class="l11x" x="434" y="36" width="110" height="40" rx="4"/><text class="l11t" x="489" y="60" text-anchor="middle">Server</text>',
    '<line class="l11a" x1="126" y1="48" x2="434" y2="48" marker-end="url(#l11arrow)"/><text class="l11n" x="280" y="40" text-anchor="middle">tools/call</text>',
    '<line class="l11a" x1="434" y1="70" x2="126" y2="70" marker-end="url(#l11arrow)"/><text class="l11n" x="280" y="86" text-anchor="middle">CallToolResult</text>',
    '<text class="l11n" x="8" y="112" text-anchor="start">content can hold:</text>',
    chips.join(''),
    '<text class="l11n" x="8" y="172" text-anchor="start">and reports:</text>',
    '<rect class="l11x" x="8" y="182" width="140" height="26" rx="3"/><text class="l11t" x="78" y="199" text-anchor="middle">isError omitted</text>',
    '<rect class="l11x" x="170" y="182" width="140" height="26" rx="3"/><text class="l11t" x="240" y="199" text-anchor="middle">isError: true</text>',
    '</svg>',
    '</div>',
    '<div class="mf-caption">A tools/call request names one tool and its arguments; the CallToolResult that comes back carries a content list built from any mix of the five block types, an optional structuredContent value, and isError. Omitted or false means the call succeeded; true means the tool ran into a problem the model can read and correct.</div>'
  ].join('');
  host.appendChild(shell);
}
// register as: mcpa-11-tool-call
