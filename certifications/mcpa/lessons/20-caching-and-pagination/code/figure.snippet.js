function cacheFreshnessFigure(host) {
  ensureStyles();
  var parts = [];
  parts.push('<style>');
  parts.push('.l20f{fill:var(--blueprint,#3553ff);opacity:.20}');
  parts.push('.l20s{fill:var(--ink-mute,#8a8a8a);opacity:.16}');
  parts.push('.l20a{stroke:var(--rule-soft,#ccc);stroke-width:1}');
  parts.push('.l20t{fill:var(--ink,#111);font:12px var(--font-mono,monospace)}');
  parts.push('.l20m{fill:var(--ink-mute,#767676);font:11px var(--font-mono,monospace)}');
  parts.push('.l20d{stroke:var(--ink-soft,#bbb);stroke-width:1;stroke-dasharray:4,3}');
  parts.push('.l20n{stroke:var(--blueprint,#3553ff);stroke-width:1.6}');
  parts.push('.l20p{fill:var(--blueprint,#3553ff)}');
  parts.push('</style>');
  parts.push('<text class="l20t" x="70" y="16">A. TTL alone: fresh until t_received + ttlMs</text>');
  parts.push('<rect class="l20f" x="70" y="30" width="240" height="24"/>');
  parts.push('<rect class="l20s" x="310" y="30" width="190" height="24"/>');
  parts.push('<line class="l20a" x1="70" y1="54" x2="500" y2="54"/>');
  parts.push('<text class="l20t" x="190" y="46" text-anchor="middle">fresh</text>');
  parts.push('<text class="l20t" x="405" y="46" text-anchor="middle">stale</text>');
  parts.push('<line class="l20a" x1="70" y1="54" x2="70" y2="60"/>');
  parts.push('<line class="l20a" x1="310" y1="54" x2="310" y2="60"/>');
  parts.push('<text class="l20m" x="70" y="72">t_received</text>');
  parts.push('<text class="l20m" x="310" y="72" text-anchor="middle">t_received + ttlMs</text>');
  parts.push('<text class="l20t" x="70" y="100">B. Notification during the window: stale immediately</text>');
  parts.push('<text class="l20m" x="230" y="124" text-anchor="middle">list_changed notification</text>');
  parts.push('<line class="l20n" x1="230" y1="130" x2="230" y2="148"/>');
  parts.push('<polygon id="l20arrow" class="l20p" points="230,152 224,144 236,144"/>');
  parts.push('<rect class="l20f" x="70" y="154" width="160" height="24"/>');
  parts.push('<rect class="l20s" x="230" y="154" width="270" height="24"/>');
  parts.push('<line class="l20a" x1="70" y1="178" x2="500" y2="178"/>');
  parts.push('<text class="l20t" x="150" y="170" text-anchor="middle">fresh</text>');
  parts.push('<text class="l20t" x="365" y="170" text-anchor="middle">stale</text>');
  parts.push('<line class="l20d" x1="310" y1="150" x2="310" y2="178"/>');
  parts.push('<line class="l20a" x1="70" y1="178" x2="70" y2="184"/>');
  parts.push('<line class="l20a" x1="310" y1="178" x2="310" y2="184"/>');
  parts.push('<text class="l20m" x="70" y="196">t_received</text>');
  parts.push('<text class="l20m" x="310" y="196" text-anchor="middle">ttl would end here</text>');
  var shell = document.createElement('div');
  shell.className = 'mf-shell';
  shell.innerHTML = [
    '<div class="mf-head"><strong>Cache Freshness</strong> a TTL window ends on the clock, unless a notification ends it first</div>',
    '<div class="mf-body">',
    '<svg viewBox="0 0 560 208" role="img" aria-label="Two timelines that share the same t_received. In scenario A the cached response stays fresh until t_received plus ttlMs, then goes stale. In scenario B a list_changed notification arrives before the TTL would have expired, and the response goes stale immediately at the notification, leaving the remaining TTL unused.">',
    parts.join(''),
    '</svg>',
    '</div>',
    '<div class="mf-caption">A cached response stays fresh until its ttlMs runs out, but a relevant list_changed notification invalidates it immediately on arrival, even with time left on the clock. TTL and notifications are complementary, not competing.</div>'
  ].join('');
  host.appendChild(shell);
}
// register as: mcpa-20-cache-freshness
