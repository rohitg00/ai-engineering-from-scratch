/* figures-re-35.js - evidence ledger lab for lesson 35 (reverse engineering).
   Every record below is real. The rea record comes from rea-agents 6.5.0 with
   the Ghidra 12.1.4 provider on ledger-x86_64-O1.o. The other records come from
   the lesson's own reader, byte model, predictions, and host runs
   (phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns/code/fixtures). */
(function () {
  'use strict';

  var LF = window.LF;
  if (!LF) return;

  var el = LF.el;
  var labCount = 0;

  function ensureStyles() {
    if (document.getElementById('re35-lab-styles')) return;
    var style = document.createElement('style');
    style.id = 're35-lab-styles';
    style.textContent = [
      '.re35-lab{margin:0;border:0;background:transparent;color:var(--ink,#1a1a1a)}',
      '.re35-lab *{box-sizing:border-box}',
      '.re35-lab__head{align-items:flex-start}',
      '.re35-lab__head .re35-lab__title{color:var(--blueprint,#3553ff)}',
      '.re35-lab__body{padding:16px;display:grid;gap:16px}',
      '.re35-lab__prompt{margin:0!important;color:var(--ink-soft,#555)!important;font-family:var(--font-body,serif)!important;font-size:.96rem!important;line-height:1.55!important;text-align:left!important}',
      '.re35-lab__label{font-family:var(--font-mono,monospace);font-size:.72rem;line-height:1.4;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-mute,#777)}',
      '.re35-lab__toggles{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:8px}',
      '.re35-lab button{min-height:40px;padding:8px 10px;border:1px solid var(--rule-soft,#ddd);background:var(--bg,#fafaf5);color:var(--ink,#1a1a1a);font-family:var(--font-mono,monospace);font-size:.74rem;line-height:1.4;text-align:left;cursor:pointer;display:grid;gap:3px}',
      '.re35-lab__toggle{transition:transform var(--motion-press,160ms) var(--ease-out,cubic-bezier(.23,1,.32,1)),opacity var(--motion-feedback,180ms) var(--ease-out,cubic-bezier(.23,1,.32,1)),border-color var(--motion-feedback,180ms) ease,background-color var(--motion-feedback,180ms) ease}',
      '.re35-lab button:active{transform:scale(.97)}',
      '.re35-lab button:focus-visible{outline:2px solid var(--blueprint,#3553ff);outline-offset:2px}',
      '@media(hover:hover) and (pointer:fine){.re35-lab button:hover{border-color:var(--blueprint,#3553ff)}}',
      '.re35-lab__toggle[aria-pressed="true"]{border-color:var(--blueprint,#3553ff);background:var(--blueprint-tint,rgba(53,83,255,.08))}',
      '.re35-lab__toggle[aria-pressed="false"]{opacity:.62}',
      '.re35-lab__toggle-id{color:var(--blueprint,#3553ff);font-weight:600}',
      '.re35-lab__toggle[aria-pressed="false"] .re35-lab__toggle-id{color:var(--ink-mute,#777);text-decoration:line-through}',
      '.re35-lab__toggle-meta{color:var(--ink-mute,#777);font-size:.68rem;letter-spacing:.04em}',
      '.re35-lab__toggle-text{color:var(--ink,#1a1a1a)}',
      '.re35-lab__workspace{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:14px;align-items:start}',
      '.re35-lab__panel{min-width:0;border:1px solid var(--rule-soft,#ddd);background:var(--bg-surface,#f1f1eb)}',
      '.re35-lab__panel-head{padding:8px 12px;border-bottom:1px solid var(--rule-soft,#ddd);font-family:var(--font-mono,monospace);font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;color:var(--blueprint,#3553ff)}',
      '.re35-lab__row{display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;align-items:start;padding:10px 12px;border-bottom:1px solid var(--rule-soft,#ddd);transition:opacity var(--motion-feedback,180ms) var(--ease-out,cubic-bezier(.23,1,.32,1)),transform var(--motion-feedback,220ms) var(--ease-out,cubic-bezier(.23,1,.32,1))}',
      '.re35-lab__row:last-child{border-bottom:0}',
      '.re35-lab__status{display:inline-flex;align-items:center;min-height:24px;padding:2px 7px;border:1px solid var(--ink-mute,#777);color:var(--ink-mute,#777);font-family:var(--font-mono,monospace);font-size:.68rem;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap}',
      '.re35-lab__status[data-tone="pass"]{border-color:var(--blueprint,#3553ff);color:var(--blueprint,#3553ff)}',
      '.re35-lab__status[data-tone="derived"]{border-color:var(--blueprint,#3553ff);color:var(--blueprint,#3553ff);border-style:dashed}',
      '.re35-lab__status[data-tone="unknown"]{border-color:var(--warn,#b8870f);color:var(--warn,#b8870f);border-style:dashed}',
      '.re35-lab__status[data-tone="fail"],.re35-lab__status[data-tone="dangling"]{border-color:var(--warn,#b8870f);color:var(--warn,#b8870f)}',
      '.re35-lab__claim{font-family:var(--font-mono,monospace);font-size:.78rem;line-height:1.4;color:var(--ink,#1a1a1a);word-break:break-word}',
      '.re35-lab__detail{margin-top:3px;font-family:var(--font-body,serif);font-size:.86rem;line-height:1.45;color:var(--ink-soft,#555)}',
      '.re35-lab__ids{margin-top:3px;font-family:var(--font-mono,monospace);font-size:.68rem;line-height:1.5;color:var(--ink-mute,#777);word-break:break-all}',
      '.re35-lab__verdict{padding:12px;border:1px solid var(--rule-soft,#ddd);background:var(--bg-surface,#f1f1eb);font-family:var(--font-mono,monospace);font-size:.86rem;line-height:1.5;color:var(--ink,#1a1a1a)}',
      '.re35-lab figcaption{padding:12px 16px;border-top:1px solid var(--rule-soft,#ddd);font-family:var(--font-body,serif);font-size:.92rem;line-height:1.5;color:var(--ink-soft,#555)}',
      '@media(max-width:640px){.re35-lab__body{padding:12px}.re35-lab__workspace{grid-template-columns:1fr}.re35-lab__toggles{grid-template-columns:1fr}.re35-lab__row{grid-template-columns:1fr}.re35-lab__claim{font-size:.8rem}.re35-lab__detail{font-size:.88rem}}',
      '@media(prefers-reduced-motion:reduce){.re35-lab__toggle,.re35-lab__row{transition:none!important;transform:none!important}.re35-lab button:active{transform:none!important}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  var EVIDENCE = [
    {
      key: 'bytes',
      id: 'ev_a467c2427bfc0c5647d4468a2bcc2d8f1af6877400df96437d8441f8b446d27d',
      confidence: 'observed',
      authority: 'shipped-artifact',
      text: 'read_function_bytes grade: 46 bytes at .text+0x10',
      on: true
    },
    {
      key: 'model',
      id: 'ev_605106bff2d9998f58690b6314cf2d976d114c60090b7684a7cda838fb6fc59b',
      confidence: 'derived',
      authority: 'shipped-artifact',
      text: 'derive_switch_model grade: table 1,2,3,4,4 at .rodata+0x14, index = score/10 - 6',
      links: ['bytes'],
      on: true
    },
    {
      key: 'ghidra',
      id: 'ev_67b6d3f992eaf49a2e16de084b6ebfdd9884e8c5c7f75e175b7bb20f4f748ce1',
      confidence: 'observed',
      authority: 'shipped-artifact',
      text: 'Ghidra 12.1.4 analyze_function grade: pseudocode and 14 instructions',
      on: true
    },
    {
      key: 'run95',
      id: 'ev_f4ffbe8f922ec7fe9b2b260593635e70163f20942a895d500832a27f0d4c992f',
      confidence: 'observed',
      authority: 'controlled-replay',
      text: 'execute_function grade(95): host build printed 4',
      run: { fn: 'grade', args: [95], result: 4 },
      on: true
    },
    {
      key: 'run55',
      id: 'ev_7be90c0c1403272f28f4f3b839307371548c4cfdd7dff2416bb52e088cf59462',
      confidence: 'observed',
      authority: 'controlled-replay',
      text: 'execute_function grade(55): host build printed 0',
      run: { fn: 'grade', args: [55], result: 0 },
      on: false
    },
    {
      key: 'run100',
      id: 'ev_7372c4f8330bdd8ef8246ddcb5bd8347dd71f4e416c635d5dcacabb16448d55a',
      confidence: 'observed',
      authority: 'controlled-replay',
      text: 'execute_function grade(100): host build printed 4',
      run: { fn: 'grade', args: [100], result: 4 },
      on: false
    },
    {
      key: 'runpc',
      id: 'ev_7eb6b4589c40278645428875c62c202667343df133f83dc765d9f20a4b1b826a',
      confidence: 'observed',
      authority: 'controlled-replay',
      text: 'execute_function percent_change(12400, 15500): host build printed 25',
      run: { fn: 'percent_change', args: [12400, 15500], result: 25 },
      on: true
    }
  ];

  var RANGE_CASES = [];
  for (var score = 90; score <= 100; score++) RANGE_CASES.push([[score], 4]);

  var CLAIMS = [
    {
      id: 'grade(95)',
      text: 'grade(95) == 4',
      kind: 'run',
      fn: 'grade',
      cases: [[[95], 4]],
      prediction: 'ev_ef89eea46fd892feaef1b7e323381d842753c07784311e408c7058724104aa19',
      unknown: 'unk_8471cd5e61a7c5800a5223fba5b537b4d848c18a0e012482d2ae1f1ce521299f'
    },
    {
      id: 'grade(55)',
      text: 'grade(55) == 0',
      kind: 'run',
      fn: 'grade',
      cases: [[[55], 0]],
      prediction: 'ev_d51dd456405897203f403a6c27538d998e7f1d31cba4cd8f9f9d41a6840e61e4',
      unknown: 'unk_1175ff2086d60f52a12e62667238f5f92de8cb38adb21ec8b2e085ca4afe10c7',
      note: 'The Ghidra pseudocode writes the default path as -(param_1 >> 0x1f) ^ (uint)(...). The bytes say xor eax, eax. Only a run observes the 0.'
    },
    {
      id: 'percent_change(12400, 15500)',
      text: 'percent_change(12400, 15500) == 25',
      kind: 'run',
      fn: 'percent_change',
      cases: [[[12400, 15500], 25]],
      prediction: 'ev_3bc03ec0b9352c58a68d56b300e6c5707d7d14bcff05ffd1f431e73766080bea',
      unknown: 'unk_c8d398aecc691d3ecd47dfd57198ffe87b228f67387ebc958673db7cdfca8b35'
    },
    {
      id: 'grade(90..100)',
      text: 'grade(score) == 4 for every score from 90 to 100',
      kind: 'run',
      fn: 'grade',
      cases: RANGE_CASES,
      prediction: 'ev_16a0c37372f930202fae53c3cd5d16e63af3c40fdca2767e7983a4203c0ca522',
      unknown: 'unk_f2eb0d7f84c80a19f1fa95a91e9ef90da1827816a34a57f160be23aee5cddd2d'
    },
    {
      id: 'table',
      text: 'the grade table holds 1,2,3,4,4 at .rodata+0x14',
      kind: 'derived'
    }
  ];

  function shortId(id) {
    return id.slice(0, 16);
  }

  function sameArgs(left, right) {
    var index;
    if (left.length !== right.length) return false;
    for (index = 0; index < left.length; index++) {
      if (left[index] !== right[index]) return false;
    }
    return true;
  }

  function byKey(key) {
    var index;
    for (index = 0; index < EVIDENCE.length; index++) {
      if (EVIDENCE[index].key === key) return EVIDENCE[index];
    }
    return null;
  }

  function evaluateClaim(claim, state) {
    var support = [];
    var contra = [];
    var covered = 0;
    var status;
    var detail;
    if (claim.kind === 'derived') {
      if (state.model && state.bytes) {
        return { status: 'derived', detail: 'Computed from the observed bytes. It reads the file and makes no claim about behaviour.', ids: [byKey('model').id, byKey('bytes').id], covered: 1, total: 1 };
      }
      if (state.model) {
        return { status: 'dangling', detail: 'The derived record is present, but the bytes record it links to is missing. Its basis cannot be checked.', ids: [byKey('model').id], covered: 0, total: 1 };
      }
      return { status: 'unsupported', detail: 'No derived record states the table.', ids: [], covered: 0, total: 1 };
    }
    claim.cases.forEach(function (one) {
      var agree = false;
      var disagree = false;
      EVIDENCE.forEach(function (item) {
        if (!item.run || !state[item.key]) return;
        if (item.run.fn !== claim.fn || !sameArgs(item.run.args, one[0])) return;
        if (item.run.result === one[1]) {
          agree = true;
          support.push(item.id);
        } else {
          disagree = true;
          contra.push(item.id);
        }
      });
      if (agree && !disagree) covered += 1;
    });
    if (contra.length) {
      status = 'fail';
      detail = 'An observed run disagrees with the prediction.';
    } else if (covered === claim.cases.length) {
      status = 'pass';
      detail = 'Every input has an observed run that agrees. The run executed a host build of the same source, and that limitation travels with the claim.';
    } else if (covered === 0) {
      status = 'unsupported';
      if (claim.fn === 'grade' && (state.model || state.ghidra)) {
        detail = 'Derived and provider records exist, and none of them is a run. The prediction stays inferred.';
      } else {
        detail = 'No observed run names this function with these arguments.';
      }
      if (claim.note) detail += ' ' + claim.note;
    } else {
      status = 'unknown';
      detail = covered + ' of ' + claim.cases.length + ' inputs have an observed run. Partial coverage stays unknown.';
    }
    return { status: status, detail: detail, ids: support.concat(contra), covered: covered, total: claim.cases.length };
  }

  function unknownState(status) {
    if (status === 'pass') {
      return { status: 'resolved', revision: 2, tone: 'pass', detail: 'Resolved with the run id. Revision 2 names the digest of revision 1.' };
    }
    if (status === 'unknown') {
      return { status: 'investigating', revision: 2, tone: 'unknown', detail: 'Some inputs have runs. The probe for the rest is execute_function on the host build.' };
    }
    if (status === 'fail') {
      return { status: 'contradicted', revision: 2, tone: 'fail', detail: 'Requires observed evidence with authority controlled-replay.' };
    }
    return { status: 'open', revision: 1, tone: 'open', detail: 'Requires observed evidence with authority controlled-replay.' };
  }

  function evidenceLedgerLab(host) {
    ensureStyles();
    labCount += 1;
    var titleId = 're35-lab-title-' + labCount;
    var state = {};
    EVIDENCE.forEach(function (item) { state[item.key] = item.on; });

    var title = el('span', { id: titleId, class: 're35-lab__title' }, ['EVIDENCE LEDGER']);
    var header = el('div', { class: 'lf-head re35-lab__head' }, [title, el('span', {}, ['toggle which records exist'])]);
    var prompt = el('p', { class: 're35-lab__prompt' }, [
      'Each claim is a prediction about ledger-x86_64-O1.o. Toggle which evidence records exist. The ledger recomputes every claim status and every unknown from the records that remain. Ids show the first 16 characters.'
    ]);

    var toggles = el('div', { class: 're35-lab__toggles', role: 'group', 'aria-label': 'Evidence records' });
    var toggleButtons = {};
    EVIDENCE.forEach(function (item) {
      var button = el('button', { type: 'button', class: 're35-lab__toggle', 'aria-pressed': item.on ? 'true' : 'false' }, [
        el('span', { class: 're35-lab__toggle-id' }, [shortId(item.id)]),
        el('span', { class: 're35-lab__toggle-meta' }, [item.confidence + ' · ' + item.authority]),
        el('span', { class: 're35-lab__toggle-text' }, [item.text])
      ]);
      button.addEventListener('click', function () {
        state[item.key] = !state[item.key];
        render();
      });
      toggleButtons[item.key] = button;
      toggles.appendChild(button);
    });
    var toggleBlock = el('div', { style: 'display:grid;gap:8px' }, [el('div', { class: 're35-lab__label' }, ['Evidence records in the ledger']), toggles]);

    var claimList = el('div', { 'aria-label': 'Claims' });
    var unknownList = el('div', { 'aria-label': 'Residual unknowns' });
    var claimPanel = el('div', { class: 're35-lab__panel' }, [el('div', { class: 're35-lab__panel-head' }, ['Claims']), claimList]);
    var unknownPanel = el('div', { class: 're35-lab__panel' }, [el('div', { class: 're35-lab__panel-head' }, ['Residual unknowns']), unknownList]);
    var workspace = el('div', { class: 're35-lab__workspace' }, [claimPanel, unknownPanel]);
    var verdict = el('div', { class: 're35-lab__verdict', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
    var caption = el('figcaption', {}, [
      'Blue solid: pass or an observed record. Blue dashed: derived. Amber dashed: unknown, a partial set of runs. Amber solid: a dangling link. Grey: unsupported or open. The verdict counts the rows above it.'
    ]);
    var body = el('div', { class: 're35-lab__body' }, [prompt, toggleBlock, workspace, verdict]);
    var figure = el('figure', { class: 're35-lab lf', 'aria-labelledby': titleId }, [header, body, caption]);

    function clear(node) {
      while (node.firstChild) node.removeChild(node.firstChild);
    }

    function render() {
      var counts = { pass: 0, fail: 0, unknown: 0, unsupported: 0, derived: 0, dangling: 0 };
      var openUnknowns = 0;
      var records = 0;
      EVIDENCE.forEach(function (item) {
        toggleButtons[item.key].setAttribute('aria-pressed', state[item.key] ? 'true' : 'false');
        if (state[item.key]) records += 1;
      });
      clear(claimList);
      clear(unknownList);
      CLAIMS.forEach(function (claim) {
        var result = evaluateClaim(claim, state);
        var ids = result.ids.map(shortId);
        var idLine;
        counts[result.status] += 1;
        if (claim.prediction) ids.unshift(shortId(claim.prediction) + ' (inferred prediction)');
        idLine = ids.length ? ids.join('  ') : 'no evidence ids';
        claimList.appendChild(el('div', { class: 're35-lab__row', 'data-status': result.status }, [
          el('span', { class: 're35-lab__status', 'data-tone': result.status }, [result.status + (result.total > 1 ? ' ' + result.covered + '/' + result.total : '')]),
          el('div', {}, [
            el('div', { class: 're35-lab__claim' }, [claim.text]),
            el('div', { class: 're35-lab__detail' }, [result.detail]),
            el('div', { class: 're35-lab__ids' }, [idLine])
          ])
        ]));
        if (claim.kind === 'run') {
          var unknown = unknownState(result.status);
          if (unknown.status !== 'resolved') openUnknowns += 1;
          unknownList.appendChild(el('div', { class: 're35-lab__row', 'data-status': unknown.status }, [
            el('span', { class: 're35-lab__status', 'data-tone': unknown.tone }, [unknown.status + ' rev ' + unknown.revision]),
            el('div', {}, [
              el('div', { class: 're35-lab__claim' }, ['Does ' + claim.text + ' hold when the compiled function runs?']),
              el('div', { class: 're35-lab__detail' }, [unknown.detail]),
              el('div', { class: 're35-lab__ids' }, [shortId(claim.unknown)])
            ])
          ]));
        }
      });
      verdict.textContent = records + ' of ' + EVIDENCE.length + ' records present. ' +
        counts.pass + ' pass, ' + counts.unknown + ' unknown, ' + counts.unsupported + ' unsupported, ' +
        counts.derived + ' derived, ' + counts.dangling + ' dangling. ' + openUnknowns + ' of 4 unknowns still open.';
      figure.setAttribute('data-open-unknowns', String(openUnknowns));
    }

    host.appendChild(figure);
    render();
  }

  LF.register({
    're-evidence-ledger': evidenceLedgerLab
  });
}());
