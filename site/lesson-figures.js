/* lesson-figures.js — interactive, theme-aware figures embedded in lessons.
   Authoring: a fenced block in docs/en.md
       ```figure
       kv-cache
       ```
   renders <div class="lesson-figure" data-figure="kv-cache">, which this file
   hydrates into a real interactive widget. No deps. Uses the site's CSS vars
   so it follows the blueprint theme in light and dark. */
(function () {
  'use strict';

  // Scoped styles, injected once.
  function ensureStyles() {
    if (document.getElementById('lf-styles')) return;
    var s = document.createElement('style');
    s.id = 'lf-styles';
    s.textContent = [
      '.lf{border:1px solid var(--rule-soft,#ddd);background:var(--bg,#fafaf5);margin:28px 0;padding:0;font-family:var(--font-body,serif)}',
      '.lf-head{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:12px 16px;border-bottom:1px solid var(--rule-soft,#ddd);font-family:var(--font-mono,monospace);font-size:.68rem;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-mute,#777)}',
      '.lf-head .lf-label{color:var(--blueprint,#3553ff)}',
      '.lf-body{padding:16px}',
      '.lf-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 24px}',
      '@media(max-width:640px){.lf-grid{grid-template-columns:1fr}}',
      '.lf-ctrl{display:flex;flex-direction:column;gap:4px}',
      '.lf-ctrl label{font-family:var(--font-mono,monospace);font-size:.7rem;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-soft,#555);display:flex;justify-content:space-between}',
      '.lf-ctrl label b{color:var(--blueprint,#3553ff);font-variant-numeric:tabular-nums}',
      '.lf-ctrl input[type=range]{width:100%;accent-color:var(--blueprint,#3553ff)}',
      '.lf-ctrl select{font-family:var(--font-mono,monospace);font-size:.82rem;padding:4px 6px;background:var(--bg,#fafaf5);color:var(--ink,#1a1a1a);border:1px solid var(--rule-soft,#ddd)}',
      '.lf-out{margin-top:18px;padding-top:14px;border-top:1px dashed var(--rule-soft,#ddd)}',
      '.lf-num{font-family:var(--font-mono,monospace);font-size:2rem;color:var(--blueprint,#3553ff);font-variant-numeric:tabular-nums;line-height:1}',
      '.lf-num small{font-size:.9rem;color:var(--ink-soft,#555);letter-spacing:.04em}',
      '.lf-bar{position:relative;height:10px;background:var(--rule-soft,#eee);margin-top:12px;overflow:hidden}',
      '.lf-bar i{position:absolute;inset:0 auto 0 0;width:0;background:var(--blueprint,#3553ff);transition:width .12s ease}',
      '.lf-bar.over i{background:var(--warn,#b8870f)}',
      '.lf-meta{font-family:var(--font-mono,monospace);font-size:.7rem;color:var(--ink-mute,#777);margin-top:8px;letter-spacing:.04em}',
      '.lf-formula{font-family:var(--font-mono,monospace);font-size:.72rem;color:var(--ink-soft,#555);margin-top:6px;word-break:break-word}',
      '.lf-cap{font-family:var(--font-body,serif);font-size:.92rem;color:var(--ink-soft,#555);line-height:1.5;padding:12px 16px;border-top:1px solid var(--rule-soft,#ddd)}',
      '.lesson-figure.lf-animated{border:1px solid var(--rule-soft,#ddd);background:var(--bg,#fafaf5);margin:28px 0;padding:14px}',
      '.lesson-figure.lf-animated svg{display:block;width:100%;height:auto;max-width:760px;margin:0 auto;color:var(--blueprint,#3553ff)}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function fmtInt(n) { return n.toLocaleString('en-US'); }
  function fmtSeq(n) { return n >= 1024 ? (n / 1024) + 'K' : String(n); }

  function slider(state, key, label, min, max, step, fmt) {
    var val = el('b', {}, [fmt ? fmt(state[key]) : String(state[key])]);
    var input = el('input', { type: 'range', min: min, max: max, step: step, value: state[key] });
    input.addEventListener('input', function () {
      state[key] = Number(input.value);
      val.textContent = fmt ? fmt(state[key]) : String(state[key]);
      state._render();
    });
    return el('div', { class: 'lf-ctrl' }, [el('label', {}, [label, val]), input]);
  }

  // ── kv-cache: drag the dims, watch the cache size ──────────────────────
  function kvCache(host, cfg) {
    var GiB = Math.pow(1024, 3);
    var REF = (cfg && cfg.refGiB) || 80; // one H100 / A100 80GB
    var state = {
      seq: 8192, batch: 8, layers: (cfg && cfg.layers) || 32,
      kvHeads: (cfg && cfg.kvHeads) || 8, headDim: (cfg && cfg.headDim) || 128, dbytes: 2
    };

    var num = el('span', { class: 'lf-num' });
    var bar = el('i');
    var barWrap = el('div', { class: 'lf-bar' }, [bar]);
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });

    state._render = function () {
      var bytes = 2 * state.layers * state.kvHeads * state.headDim * state.seq * state.batch * state.dbytes;
      var gib = bytes / GiB;
      num.innerHTML = gib.toFixed(gib < 10 ? 2 : 1) + ' <small>GiB</small>';
      var pct = Math.min(100, gib / REF * 100);
      bar.style.width = pct + '%';
      barWrap.classList.toggle('over', gib > REF);
      meta.textContent = (gib > REF ? '⚠ exceeds ' : '') + Math.round(gib / REF * 100) + '% of one ' + REF + ' GiB GPU';
      formula.textContent = '2 · ' + state.layers + ' layers · ' + state.kvHeads + ' kv-heads · ' + state.headDim +
        ' head-dim · ' + fmtInt(state.seq) + ' tokens · ' + state.batch + ' batch · ' + state.dbytes + ' B';
    };

    var dtype = el('select');
    [['fp16 / bf16', 2], ['fp8', 1], ['int8', 1]].forEach(function (o) {
      var op = el('option', { value: o[1] }, [o[0]]); dtype.appendChild(op);
    });
    dtype.addEventListener('change', function () { state.dbytes = Number(dtype.value); state._render(); });

    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'seq', 'sequence length', 256, 131072, 256, fmtSeq),
      slider(state, 'batch', 'batch size', 1, 128, 1),
      slider(state, 'layers', 'layers', 1, 128, 1),
      slider(state, 'kvHeads', 'kv heads (GQA)', 1, 128, 1),
      slider(state, 'headDim', 'head dim', 32, 256, 8),
      el('div', { class: 'lf-ctrl' }, [el('label', {}, ['dtype']), dtype])
    ]);

    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['KV-CACHE SIZER']), el('span', {}, ['drag the dimensions'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [num, barWrap, meta, formula])]),
      el('div', { class: 'lf-cap' }, ['The cache holds one key and one value per token, per layer, per kv-head. It grows linearly with sequence length and batch — which is why long context at high batch is what fills the GPU, not the weights.'])
    ]));
    state._render();
  }

  // Interactive widgets defined here. Animated figures live in figures.js and
  // are reached through window.AIFS_FIGURES (same fenced-block syntax).
  var FIGS = { 'kv-cache-sizer': kvCache };

  function mountLessonFigures(root) {
    ensureStyles();
    (root || document).querySelectorAll('.lesson-figure[data-figure]').forEach(function (host) {
      if (host.dataset.lfMounted) return;
      var parts = (host.dataset.figure || '').trim().split(/\s+/);
      var name = parts[0];
      var cfg = {};
      var rest = host.dataset.figure.trim().slice(name.length).trim();
      if (rest) { try { cfg = JSON.parse(rest); } catch (e) {} }

      var local = FIGS[name];
      var animated = window.AIFS_FIGURES && window.AIFS_FIGURES[name];
      try {
        if (local) {
          local(host, cfg);
        } else if (animated) {
          host.classList.add('lf-animated');
          animated(host, cfg);
        } else {
          return; // unknown figure; leave the empty host out
        }
        host.dataset.lfMounted = '1';
      } catch (e) {
        console.warn('lesson figure "' + name + '" failed:', e);
      }
    });
  }

  window.mountLessonFigures = mountLessonFigures;
  window.LESSON_FIGURES = FIGS;
})();
