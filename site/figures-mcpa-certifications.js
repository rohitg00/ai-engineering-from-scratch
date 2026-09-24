/* figures-mcpa-certifications.js: mechanism figures for the MCPA certification
   curriculum. Loads after lesson-figures.js and registers through window.LF.
   Vanilla ES5, no dependencies. */
(function () {
  'use strict';

  var LF = window.LF;
  if (!LF) return;

  function ensureStyles() {
    if (document.getElementById('mcpa-figure-styles')) return;
    var style = document.createElement('style');
    style.id = 'mcpa-figure-styles';
    style.textContent = [
      '.mf-shell{border:1px solid var(--rule-soft,#ddd);background:var(--bg,#fafaf5);margin:28px 0;font-family:var(--font-body,serif)}',
      '.mf-head{padding:12px 16px;border-bottom:1px solid var(--rule-soft,#ddd);font-family:var(--font-mono,monospace);font-size:.68rem;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-mute,#777)}',
      '.mf-head strong{color:var(--blueprint,#3553ff);font-weight:600}',
      '.mf-body{padding:16px}',
      '.mf-caption{padding:12px 16px;border-top:1px solid var(--rule-soft,#ddd);font-size:.92rem;line-height:1.55;color:var(--ink-soft,#555)}'
    ].join('');
    document.head.appendChild(style);
  }

  function rolesFigure(host) {
    ensureStyles();
    var shell = document.createElement('div');
    shell.className = 'mf-shell';
    shell.innerHTML = [
      '<div class="mf-head"><strong>MCP Fundamentals</strong> host / client / server / tool</div>',
      '<div class="mf-body">',
      '<svg viewBox="0 0 520 200" role="img" aria-label="A user request flows from the host through a client to a server and a tool, and the result flows back">',
      '<style>.mfx{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.mft{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}.mfl{fill:var(--ink-mute,#777);font:9px var(--font-mono,monospace)}.mfa{stroke:var(--blueprint,#3553ff);fill:none;stroke-width:1.5}</style>',
      '<rect class="mfx" x="8" y="70" width="96" height="60"/><text class="mft" x="20" y="95">host</text><text class="mfl" x="20" y="112">the app</text>',
      '<rect class="mfx" x="150" y="70" width="96" height="60"/><text class="mft" x="162" y="95">client</text><text class="mfl" x="162" y="112">one link</text>',
      '<rect class="mfx" x="292" y="70" width="96" height="60"/><text class="mft" x="304" y="95">server</text><text class="mfl" x="304" y="112">exposes</text>',
      '<rect class="mfx" x="434" y="70" width="78" height="60"/><text class="mft" x="446" y="95">tool</text><text class="mfl" x="446" y="112">an action</text>',
      '<path class="mfa" d="M104 92 L150 92" marker-end="url(#mfarrow)"/>',
      '<path class="mfa" d="M246 92 L292 92" marker-end="url(#mfarrow)"/>',
      '<path class="mfa" d="M388 92 L434 92" marker-end="url(#mfarrow)"/>',
      '<path class="mfa" d="M434 118 L104 118" marker-end="url(#mfarrow)"/>',
      '<text class="mfl" x="196" y="150">result flows back across the trust boundary</text>',
      '<defs><marker id="mfarrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="var(--blueprint,#3553ff)"/></marker></defs>',
      '</svg>',
      '</div>',
      '<div class="mf-caption">One protocol connects four roles. A request travels host to client to server to tool; the result returns as untrusted content entering the model context.</div>'
    ].join('');
    host.appendChild(shell);
  }

  LF.register({ 'mcpa-01-mcp-roles': rolesFigure });
})();
