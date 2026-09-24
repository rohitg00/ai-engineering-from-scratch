function auditTrailFigure(host) {
  ensureStyles();
  var shell = document.createElement('div');
  shell.className = 'mf-shell';
  shell.innerHTML = [
    '<div class="mf-head"><strong>Risk Controls and Auditability</strong> append-only log, hash chain, redaction</div>',
    '<div class="mf-body">',
    '<svg viewBox="0 0 560 210" role="img" aria-label="Four audit log entries in a row, each linking to the previous one by a hash, with a sensitive field redacted before entry 1 is hashed, and new entries only ever appended on the right">',
    '<style>.atf-box{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.atf-boxnew{fill:var(--bg-surface,#eee);stroke:var(--blueprint,#3553ff);stroke-dasharray:3,2}.atf-t{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}.atf-l{fill:var(--ink-mute,#777);font:9px var(--font-mono,monospace)}.atf-link{stroke:var(--blueprint,#3553ff);fill:none;stroke-width:1.5}.atf-redact{fill:var(--bg,#fafaf5);stroke:var(--ink-mute,#999);stroke-dasharray:2,2}.atf-strike{fill:var(--ink-mute,#777);font:9px var(--font-mono,monospace);text-decoration:line-through}</style>',
    '<rect class="atf-box" x="8" y="56" width="124" height="64"/><text class="atf-t" x="18" y="78">entry 0</text><text class="atf-l" x="18" y="93">tool: lookup_order</text><text class="atf-l" x="18" y="108">hash: 7c2f9a..</text>',
    '<rect class="atf-box" x="146" y="56" width="124" height="64"/><text class="atf-t" x="156" y="78">entry 1</text><text class="atf-l" x="156" y="93">tool: reset_password</text><text class="atf-l" x="156" y="108">hash: 3ea01d..</text>',
    '<rect class="atf-box" x="284" y="56" width="124" height="64"/><text class="atf-t" x="294" y="78">entry 2</text><text class="atf-l" x="294" y="93">tool: lookup_order</text><text class="atf-l" x="294" y="108">hash: b64c22..</text>',
    '<rect class="atf-boxnew" x="422" y="56" width="124" height="64"/><text class="atf-t" x="432" y="78">entry 3</text><text class="atf-l" x="432" y="93">new entries</text><text class="atf-l" x="432" y="108">append only</text>',
    '<path class="atf-link" d="M132 88 L146 88" marker-end="url(#atfarrow)"/>',
    '<path class="atf-link" d="M270 88 L284 88" marker-end="url(#atfarrow)"/>',
    '<path class="atf-link" d="M408 88 L422 88" marker-end="url(#atfarrow)"/>',
    '<text class="atf-l" x="180" y="46">hash = previous hash + this entry content</text>',
    '<rect class="atf-redact" x="146" y="140" width="124" height="46"/><text class="atf-strike" x="156" y="156">new_password</text><text class="atf-l" x="156" y="171">-&gt; ***REDACTED***</text><path class="atf-link" d="M195 140 L195 120" marker-end="url(#atfarrow)"/>',
    '<text class="atf-l" x="140" y="200">redacted before the entry is written or hashed</text>',
    '<defs><marker id="atfarrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="var(--blueprint,#3553ff)"/></marker></defs>',
    '</svg>',
    '</div>',
    '<div class="mf-caption">An append-only log: entries are only ever added on the right, never edited or removed. Each entry hash covers the previous entry hash plus its own content, so an edited past entry breaks the chain one step later. A flagged field, like a new password, is redacted before the entry is ever written or hashed.</div>'
  ].join('');
  host.appendChild(shell);
}

// register as: mcpa-07-audit-trail
