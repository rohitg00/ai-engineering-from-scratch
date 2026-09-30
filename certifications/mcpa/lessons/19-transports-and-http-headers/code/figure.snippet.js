function transportsFigure(host) {
  ensureStyles();
  var parts = [];
  parts.push('<text class="l19h" x="8" y="16">STDIO (SUBPROCESS)</text>');
  parts.push('<rect class="l19x" x="8" y="24" width="254" height="28" rx="3"/><text class="l19t" x="18" y="43">client process</text>');
  parts.push('<rect class="l19x" x="8" y="118" width="254" height="28" rx="3"/><text class="l19t" x="18" y="137">server (child process)</text>');
  parts.push('<line class="l19a" x1="60" y1="52" x2="60" y2="116" marker-end="url(#l19arrow)"/><text class="l19s" x="68" y="80">stdin</text>');
  parts.push('<line class="l19a" x1="150" y1="116" x2="150" y2="52" marker-end="url(#l19arrow)"/><text class="l19s" x="158" y="80">stdout</text>');
  parts.push('<line class="l19a" x1="220" y1="116" x2="220" y2="52" stroke-dasharray="3,3" marker-end="url(#l19arrow)"/><text class="l19s" x="196" y="100">stderr</text>');
  parts.push('<text class="l19h" x="296" y="16">STREAMABLE HTTP (POST /mcp)</text>');
  parts.push('<rect class="l19x" x="296" y="24" width="256" height="28" rx="3"/><text class="l19t" x="306" y="43">client (any HTTP peer)</text>');
  parts.push('<rect class="l19x" x="296" y="118" width="256" height="28" rx="3"/><text class="l19t" x="306" y="137">server (validate + dispatch)</text>');
  parts.push('<line class="l19a" x1="350" y1="52" x2="350" y2="116" marker-end="url(#l19arrow)"/><text class="l19s" x="358" y="80">POST /mcp</text>');
  parts.push('<line class="l19a" x1="470" y1="116" x2="470" y2="52" marker-end="url(#l19arrow)"/><text class="l19s" x="422" y="80">response</text>');
  parts.push('<circle class="l19f" cx="372" cy="100" r="7"/><text class="l19m" x="372" y="104">!</text>');
  parts.push('<text class="l19s" x="384" y="104">mismatch: 400 + -32020</text>');
  parts.push('<text class="l19c" x="8" y="178">protocol semantics are identical on every transport; only the binding differs</text>');
  parts.push('<text class="l19c" x="8" y="194">stdio has no header layer: version and capabilities travel only in _meta</text>');
  parts.push('<text class="l19c" x="8" y="210">HTTP mirrors method, name, and x-mcp-header params; a mismatch is 400 + -32020</text>');
  var shell = document.createElement('div');
  shell.className = 'mf-shell';
  shell.innerHTML = [
    '<div class="mf-head"><strong>Transports and Headers</strong> the same message, two bindings</div>',
    '<div class="mf-body">',
    '<svg viewBox="0 0 560 232" role="img" aria-label="Left: stdio transport between a client and a child server process, connected by a stdin line down, a stdout line up, and a dashed stderr line up, with no header layer at all. Right: Streamable HTTP, where a client posts to the server and the server posts back a response; a checkpoint on the request arrow marks where mismatched headers are rejected with HTTP 400 and error code -32020.">',
    '<style>.l19h{fill:var(--ink-mute,#777);font:11px var(--font-mono,monospace);text-transform:uppercase;letter-spacing:.06em}.l19x{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.l19t{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}.l19a{stroke:var(--blueprint,#3553ff);stroke-width:1.4;fill:none}.l19s{fill:var(--ink-mute,#777);font:11px var(--font-mono,monospace)}.l19f{fill:#c94a34}.l19m{fill:#fff;font:bold 9px var(--font-mono,monospace);text-anchor:middle}.l19c{fill:var(--ink-soft,#555);font:11px var(--font-mono,monospace)}</style>',
    parts.join(''),
    '<defs><marker id="l19arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="var(--blueprint,#3553ff)"/></marker></defs>',
    '</svg>',
    '</div>',
    '<div class="mf-caption">stdio carries every message inline over stdin and stdout, with logs on a separate stderr line and no header layer at all. Streamable HTTP mirrors the method, the tool or resource name, and any x-mcp-header argument into headers so a gateway can route without parsing the body, but the body stays the source of truth: a header that disagrees with it is rejected with HTTP 400 and a HeaderMismatch (-32020) error before the tool ever runs.</div>'
  ].join('');
  host.appendChild(shell);
}
// register as: mcpa-19-transports
