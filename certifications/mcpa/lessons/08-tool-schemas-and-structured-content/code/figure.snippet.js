function schemaContractFigure(host) {
  ensureStyles();
  var shell = document.createElement('div');
  shell.className = 'mf-shell';
  shell.innerHTML = [
    '<div class="mf-head"><strong>The Schema Contract</strong> one gate, two ways out</div>',
    '<div class="mf-body">',
    '<svg viewBox="0 0 560 260" role="img" aria-label="A tool definition with inputSchema and outputSchema. Arguments enter a validate gate. A schema failure returns a result with isError true. A pass runs the handler and returns structuredContent plus a text mirror conforming to outputSchema. A tool name the server never advertised takes a separate path to a protocol error, -32602, off to the side of the gate.">',
    '<style>',
    '.l08x{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}',
    '.l08t{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}',
    '.l08m{fill:var(--ink-mute,#777);font:11px var(--font-mono,monospace)}',
    '.l08l{stroke:var(--ink-mute,#999);stroke-width:1.1;fill:none;marker-end:url(#l08arrow)}',
    '.l08g{fill:var(--bg-surface,#f4f4f4);stroke:var(--blueprint,#3553ff);stroke-width:1.4}',
    '.l08ok{fill:var(--bg-surface,#eee);stroke:var(--blueprint,#3553ff);stroke-width:1.2}',
    '.l08err{fill:var(--bg-surface,#eee);stroke:var(--ink-mute,#999);stroke-width:1.2;stroke-dasharray:3,2}',
    '</style>',
    '<defs><marker id="l08arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="var(--ink-mute,#999)"/></marker></defs>',

    '<rect class="l08x" x="16" y="14" width="190" height="64" rx="3"/>',
    '<text class="l08t" x="24" y="30">tool: lookup_product</text>',
    '<text class="l08m" x="24" y="44">inputSchema: sku required</text>',
    '<text class="l08m" x="24" y="58">outputSchema: 4 fields</text>',
    '<text class="l08m" x="24" y="72">extra properties: refused</text>',

    '<rect class="l08x" x="16" y="92" width="190" height="32" rx="3"/>',
    '<text class="l08t" x="24" y="113">arguments: {"sku": "X"}</text>',

    '<path class="l08l" d="M111,78 L111,90"/>',
    '<path class="l08l" d="M111,124 L111,148"/>',

    '<rect class="l08g" x="51" y="150" width="120" height="32" rx="4"/>',
    '<text class="l08t" x="71" y="171">validate()</text>',

    '<path class="l08l" d="M81,182 L81,196"/>',
    '<rect class="l08err" x="14" y="198" width="192" height="30" rx="4"/>',
    '<text class="l08t" x="22" y="218">result isError: true</text>',

    '<path class="l08l" d="M171,166 L328,166"/>',

    '<rect class="l08x" x="330" y="14" width="212" height="46" rx="3"/>',
    '<text class="l08t" x="340" y="30">name: "delete_catalog"</text>',
    '<text class="l08m" x="340" y="44">not in tools/list</text>',

    '<path class="l08l" d="M436,60 L436,74"/>',
    '<rect class="l08err" x="330" y="76" width="212" height="32" rx="4"/>',
    '<text class="l08t" x="344" y="97">error -32602 Invalid params</text>',

    '<rect class="l08ok" x="330" y="150" width="212" height="32" rx="4"/>',
    '<text class="l08t" x="344" y="171">handler(arguments)</text>',

    '<path class="l08l" d="M436,182 L436,196"/>',
    '<rect class="l08ok" x="330" y="198" width="212" height="48" rx="4"/>',
    '<text class="l08t" x="344" y="216">structuredContent: {...}</text>',
    '<text class="l08m" x="344" y="230">content[0].text: same JSON</text>',

    '</svg>',
    '</div>',
    '<div class="mf-caption">A schema failure inside a known tool comes back as a normal result with isError true, content the model can read and correct. A tool name the server never advertised comes back as a JSON-RPC protocol error instead, on a separate path that never reaches the handler.</div>'
  ].join('');
  host.appendChild(shell);
}
// register as: mcpa-08-schema-contract
