function promptTemplateFigure(host) {
  ensureStyles();
  var shell = document.createElement('div');
  shell.className = 'mf-shell';
  shell.innerHTML = [
    '<div class="mf-head"><strong>Prompt Template and Completion</strong> arguments fill a template; context narrows suggestions</div>',
    '<div class="mf-body">',
    '<svg viewBox="0 0 560 300" role="img" aria-label="Left: a code_review prompt template fills language and framework placeholders to render its text. Right: completion for the framework argument returns three matches with no context, narrowing to two once context.arguments supplies the chosen language.">',
    '<defs><marker id="l13arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="l13m"/></marker></defs>',
    '<style>.l13x{fill:var(--bg-surface,#eee);stroke:var(--rule-soft,#ccc)}.l13p{fill:var(--bg-surface,#eee);stroke:var(--blueprint,#3553ff);stroke-width:1.6}.l13t{fill:var(--ink,#111);font:11px var(--font-mono,monospace)}.l13c{fill:var(--ink-mute,#777);font:11px var(--font-mono,monospace)}.l13a{stroke:var(--blueprint,#3553ff);stroke-width:1.4;marker-end:url(#l13arrow)}.l13m{fill:var(--blueprint,#3553ff)}</style>',
    '<text class="l13c" x="14" y="18">prompts/get renders a template</text>',
    '<rect class="l13x" x="14" y="26" width="234" height="44"/>',
    '<text class="l13t" x="22" y="42">text: {language} snippet,</text>',
    '<text class="l13t" x="22" y="58">follow {framework} style</text>',
    '<line class="l13a" x1="131" y1="70" x2="131" y2="84"/>',
    '<rect class="l13x" x="14" y="86" width="234" height="44"/>',
    '<text class="l13t" x="22" y="102">language: python</text>',
    '<text class="l13t" x="22" y="118">framework: flask</text>',
    '<line class="l13a" x1="131" y1="130" x2="131" y2="144"/>',
    '<rect class="l13p" x="14" y="146" width="234" height="44"/>',
    '<text class="l13t" x="22" y="162">rendered: python snippet,</text>',
    '<text class="l13t" x="22" y="178">follow flask style</text>',
    '<text class="l13c" x="312" y="18">completion narrows with context</text>',
    '<rect class="l13x" x="312" y="26" width="234" height="44"/>',
    '<text class="l13t" x="320" y="42">framework "fa", no context:</text>',
    '<text class="l13t" x="320" y="58">falcon, fastapi, fastify</text>',
    '<line class="l13a" x1="429" y1="70" x2="429" y2="84"/>',
    '<text class="l13c" x="366" y="80">+ context</text>',
    '<rect class="l13p" x="312" y="86" width="234" height="44"/>',
    '<text class="l13t" x="320" y="102">language: python</text>',
    '<text class="l13t" x="320" y="118">narrows to: falcon, fastapi</text>',
    '<text class="l13c" x="312" y="146">3 matches narrow to 2</text>',
    '</svg>',
    '</div>',
    '<div class="mf-caption">A prompt argument fills its placeholder to render PromptMessage content. completion/complete ranks suggestions for one argument, and narrows them further once context.arguments carries an answer already given, such as the chosen language.</div>'
  ].join('');
  host.appendChild(shell);
}
// register as: mcpa-13-prompt-template
