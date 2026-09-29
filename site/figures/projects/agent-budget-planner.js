(function () {
  'use strict';
  const unit = 'teaching units';
  const number = (key, label, value) => ({ key, label, type: 'number', value, min: 0, step: 1 });
  const integer = (value, label) => {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error(label + ' needs a nonnegative safe integer.');
    return value;
  };
  const copy = value => JSON.parse(JSON.stringify(value));
  const item = (id, label, value, detail, tone = 'neutral') => ({ id, label, value, detail, tone });
  const lane = (id, label, items) => ({ id, label, items });
  const finish = frames => Object.assign({}, frames[frames.length - 1], { frames });
  const held = state => Object.values(state.holds).reduce((sum, value) => sum + value, 0);
  const available = state => state.limit - state.spent - held(state);
  const bars = state => [
    { label: 'Spent', value: state.spent, max: state.limit, unit },
    { label: 'Held', value: held(state), max: state.limit, unit },
    { label: 'Available', value: available(state), max: state.limit, unit },
  ];
  function initialLedger(v, holdKey) {
    const state = {
      limit: integer(v.limit, 'Limit'), spent: integer(v.spent, 'Earlier spending'),
      holds: { A: integer(v[holdKey], 'Existing hold A') }, closed: [],
    };
    integer(state.spent + held(state), 'Committed capacity');
    if (available(state) < 0) throw new Error('Earlier spending and existing holds must fit the limit.');
    return state;
  }
  function ledgerLanes(state, pending = []) {
    return [
      lane('spent', 'Spent', [item('prior-spend', 'Earlier usage', state.spent, unit)]),
      lane('held', 'Held', Object.entries(state.holds).map(([id, amount]) => item('hold-' + id, 'Request ' + id, amount, unit, 'warn'))),
      lane('available', 'Available', [item('free-capacity', 'Unassigned capacity', available(state), unit)]),
      lane('pending', 'Request', pending),
    ];
  }
  function ledgerFrame(label, explanation, state, pending, extra) {
    return Object.assign({ label, explanation, summary: label, lanes: ledgerLanes(state, pending), bars: bars(state), receipt: copy(state) }, extra);
  }

  window.AIFSProjectFigures.register('pj-agent-budget-planner-1', {
    title: 'Estimate a request in integer teaching units',
    caption: 'An estimate combines prompt cost and the output ceiling. The rates here are arbitrary teaching units.',
    lab: {
      question: 'If the output ceiling is zero, which part of the request still costs something?',
      controls: [number('inputTokens', 'Input tokens', 120), number('outputLimit', 'Output ceiling (tokens)', 40), number('inputRate', 'Input rate (teaching units/token)', 2), number('outputRate', 'Output rate (teaching units/token)', 5)],
      scenarios: [{ label: 'Default request', values: {} }, { label: 'No output tokens', values: { outputLimit: 0 } }, { label: 'Larger output ceiling', values: { outputLimit: 400 } }],
      calculate(v) {
        const inputTokens = integer(v.inputTokens, 'Input tokens'), outputLimit = integer(v.outputLimit, 'Output ceiling');
        const inputRate = integer(v.inputRate, 'Input rate'), outputRate = integer(v.outputRate, 'Output rate');
        const inputCost = integer(inputTokens * inputRate, 'Input product'), outputCost = integer(outputLimit * outputRate, 'Output product');
        const total = integer(inputCost + outputCost, 'Total estimate');
        const operands = [item('prompt', 'Input tokens', inputTokens, 'tokens'), item('input-rate', 'Input rate', inputRate, unit + '/token'), item('output', 'Output ceiling', outputLimit, 'tokens'), item('output-rate', 'Output rate', outputRate, unit + '/token')];
        const inputTerm = item('input-term', 'Prompt cost', inputCost, unit, 'active');
        const outputTerm = item('output-term', 'Output ceiling cost', outputCost, unit, 'active');
        return finish([
          { label: 'Validate operands', explanation: 'All four operands must be nonnegative integers. The ceiling is a token bound, not a receipt.', summary: 'Two token counts and two integer rates', lanes: [lane('operands', 'Operands', operands), lane('products', 'Products', [])], formula: 'input tokens × input rate + output ceiling × output rate' },
          { label: 'Price the prompt', explanation: 'Input tokens are charged even when the output ceiling is zero.', summary: 'Prompt cost computed', lanes: [lane('operands', 'Operands', operands), lane('products', 'Products', [inputTerm])], links: [{ from: 'prompt', to: 'input-term', label: 'Multiply by input rate' }], formula: `${inputTokens} × ${inputRate} = ${inputCost} ${unit}`, metrics: [{ label: 'Prompt cost', value: inputCost + ' ' + unit }] },
          { label: 'Price the output ceiling', explanation: 'Multiply the maximum permitted output tokens by the output rate. No actual usage has been observed yet.', summary: 'Both cost components computed', lanes: [lane('operands', 'Operands', operands), lane('products', 'Products', [inputTerm, outputTerm])], links: [{ from: 'output', to: 'output-term', label: 'Multiply by output rate' }], formula: `${outputLimit} × ${outputRate} = ${outputCost} ${unit}`, metrics: [{ label: 'Prompt cost', value: inputCost }, { label: 'Output ceiling cost', value: outputCost }] },
          { label: 'Add the estimate', explanation: `The request needs a ceiling of ${total} ${unit}. Settlement will later use an actual receipt.`, summary: 'Estimated ceiling: ' + total + ' ' + unit, lanes: [lane('products', 'Cost components', [inputTerm, outputTerm]), lane('estimate', 'Estimate', [item('total', 'Request ceiling', total, unit, 'good')])], links: [{ from: 'input-term', to: 'total', label: 'Add prompt cost' }, { from: 'output-term', to: 'total', label: 'Add output ceiling cost' }], formula: `${inputCost} + ${outputCost} = ${total} ${unit}`, metrics: [{ label: 'Estimated ceiling', value: total + ' ' + unit }], receipt: { unit: 'teaching_units', input_cost: inputCost, output_ceiling_cost: outputCost, estimate: total } },
        ]);
      },
    },
  });

  window.AIFSProjectFigures.register('pj-agent-budget-planner-2', {
    title: 'Reserve capacity before dispatch',
    caption: 'Admission counts spending and existing holds. A rejected reservation preserves the original ledger.',
    lab: {
      question: 'After counting spending and existing holds, does the requested reservation fit the remaining capacity?',
      controls: [number('limit', 'Limit (teaching units)', 100), number('spent', 'Earlier spending', 20), number('existingHold', 'Existing hold A', 30), { key: 'requestId', label: 'New request ID', type: 'text', value: 'B' }, number('amount', 'Requested reservation', 60)],
      scenarios: [{ label: 'Insufficient capacity', values: {} }, { label: 'Fill remaining capacity', values: { amount: 50 } }, { label: 'Duplicate request ID', values: { requestId: 'A', amount: 1 } }, { label: 'Zero reservation', values: { amount: 0 } }],
      calculate(v) {
        const before = initialLedger(v, 'existingHold');
        const amount = integer(v.amount, 'Reservation');
        const id = v.requestId;
        const validId = typeof id === 'string' && id.length > 0 && !Object.hasOwn(before.holds, id) && !before.closed.includes(id);
        const request = item('new-request', 'Request ' + (id || '(empty)'), amount, 'requested ' + unit, 'active');
        const frames = [ledgerFrame('Read the ledger', `${before.limit} − ${before.spent} − ${held(before)} = ${available(before)} ${unit} available. Existing hold A remains committed.`, before, [request], { formula: `${before.limit} − ${before.spent} − ${held(before)} = ${available(before)}` })];
        frames.push(ledgerFrame('Check request identity', validId ? `ID ${id} is neither held nor closed. Check capacity next.` : 'A reservation needs a new nonempty ID. Identity fails before capacity is checked.', before, [Object.assign({}, request, { tone: validId ? 'active' : 'bad' })]));
        const reason = !validId ? 'new request id required' : amount > available(before) ? 'budget exceeded' : null;
        if (reason) {
          frames.push(ledgerFrame('Reject without mutation', reason === 'budget exceeded' ? `${amount} requested exceeds ${available(before)} available. No capacity moves and A keeps its hold.` : 'No reservation is created. Spending, hold A and available capacity keep their original values.', before, [Object.assign({}, request, { tone: 'bad', detail: reason })], { receipt: { status: 'rejected', reason, before: copy(before), after: copy(before) } }));
        } else {
          frames.push(ledgerFrame('Capacity fits', `${amount} ≤ ${available(before)}. Admission and reservation can now form one transition.`, before, [request], { formula: `${amount} ≤ ${available(before)}` }));
          const after = { ...before, holds: { ...before.holds, [id]: amount }, closed: [...before.closed] };
          const lanes = ledgerLanes(before);
          lanes.find(entry => entry.id === 'available').items[0].value = available(after);
          lanes.find(entry => entry.id === 'held').items.push(Object.assign({}, request, { label: 'Request ' + id, detail: 'reserved ' + unit, tone: 'good' }));
          frames.push(ledgerFrame('Reservation recorded', `${amount} ${unit} move from available capacity to hold ${id}. The original ledger is unchanged; the returned ledger contains both holds.`, after, [], { lanes, links: [{ from: 'free-capacity', to: 'new-request', label: amount + ' ' + unit + ' reserved' }], receipt: { status: 'reserved', before: copy(before), after: copy(after) } }));
        }
        return finish(frames);
      },
    },
  });

  window.AIFSProjectFigures.register('pj-agent-budget-planner-3', {
    title: 'Settle actual usage and release unused capacity',
    caption: 'A missing or over-ceiling receipt keeps its hold for reconciliation. A valid zero receipt releases the hold.',
    lab: {
      question: 'When a valid receipt arrives, where do actual usage and the unused part of the reservation go?',
      controls: [number('limit', 'Limit (teaching units)', 100), number('spent', 'Earlier spending', 20), number('hold', 'Existing hold A', 70), number('actual', 'Actual receipt (teaching units)', 20), { key: 'missing', label: 'Receipt missing', type: 'checkbox', value: false }, { key: 'duplicate', label: 'Deliver the receipt twice', type: 'checkbox', value: false }],
      scenarios: [{ label: 'Settle 20, release 50', values: {} }, { label: 'Confirmed zero receipt', values: { actual: 0 } }, { label: 'Missing receipt', values: { missing: true } }, { label: 'Above the ceiling', values: { actual: 71 } }, { label: 'Duplicate receipt', values: { duplicate: true } }],
      calculate(v) {
        const before = initialLedger(v, 'hold');
        const actual = v.missing ? null : integer(v.actual, 'Actual receipt');
        const frames = [ledgerFrame('Locate reservation A', `A holds ${v.hold} ${unit}. Its final cost is not yet settled; ${available(before)} remain available.`, before, [])];
        if (v.missing || actual > v.hold) {
          const reason = v.missing ? 'missing receipt' : 'actual cost exceeds reservation';
          frames.push(ledgerFrame('Keep A held', v.missing ? 'No receipt means the work may have completed. Releasing A would hide an unknown cost; keep its entire hold for reconciliation.' : `${actual} exceeds A's ${v.hold}-unit ceiling. Reject the receipt and keep the ledger unchanged for reconciliation.`, before, [], { summary: 'Needs reconciliation; hold A retained', receipt: { status: 'needs_reconciliation', reason, ledger: copy(before) } }));
          return finish(frames);
        }
        frames.push(ledgerFrame('Validate the receipt', `${actual} is a nonnegative integer no greater than the ${v.hold}-unit hold. A is still open.`, before, [], { formula: `0 ≤ ${actual} ≤ ${v.hold}`, receipt: { request_id: 'A', actual, ledger: copy(before) } }));
        const unused = v.hold - actual;
        const partition = ledgerLanes(before);
        partition.find(entry => entry.id === 'held').items = [item('hold-A', 'A: actual portion', actual, 'still held; not yet spent', 'active'), item('unused-A', 'A: unused portion', unused, 'still held; not yet available', 'active')];
        frames.push(ledgerFrame('Partition the hold', `${v.hold} = ${actual} actual + ${unused} unused. These two portions still belong to the hold until settlement commits.`, before, [], { lanes: partition, formula: `${v.hold} = ${actual} + ${unused}` }));
        const after = { limit: before.limit, spent: before.spent + actual, holds: {}, closed: ['A'] };
        const settled = copy(partition);
        settled.find(entry => entry.id === 'held').items = [];
        settled.find(entry => entry.id === 'spent').items.push(item('hold-A', 'A: settled usage', actual, unit, 'good'));
        settled.find(entry => entry.id === 'available').items.push(item('unused-A', 'A: released capacity', unused, unit, 'good'));
        const receipt = { status: 'settled', actual, released: unused, before: copy(before), after: copy(after) };
        frames.push(ledgerFrame('Commit settlement once', `${actual} move into spending and ${unused} return to available capacity. A closes; available capacity is now ${available(after)}.`, after, [], { lanes: settled, metrics: [{ label: 'Actual usage', value: actual + ' ' + unit }, { label: 'Released', value: unused + ' ' + unit }], receipt }));
        if (v.duplicate) {
          frames.push(ledgerFrame('Reject the second receipt', 'A is closed and no longer has a hold. A second receipt cannot charge the same work again; the settled ledger stays unchanged.', after, [], { lanes: settled, receipt: { ...receipt, second_receipt: { status: 'rejected', reason: 'unknown reservation', before: copy(after), after: copy(after) } } }));
        }
        return finish(frames);
      },
    },
  });

  window.AIFSProjectFigures.register('pj-agent-budget-planner-4', {
    title: 'Replay ordered jobs under budget and deadline limits',
    caption: 'Deterministic admission replay uses known costs and durations. It does not interrupt a synchronous live callback.',
    lab: {
      question: 'Which jobs does each gate admit or reject? How do those decisions change spending and elapsed time?',
      controls: [
        number('limit', 'Budget limit (teaching units)', 100), number('deadline', 'Deadline (ms)', 100),
        number('costA', 'A cost (teaching units)', 60), number('durationA', 'A duration (ms)', 40),
        number('costB', 'B cost (teaching units)', 50), number('durationB', 'B duration (ms)', 30),
        number('costC', 'C cost (teaching units)', 30), number('durationC', 'C duration (ms)', 80),
        number('costD', 'D cost (teaching units)', 20), number('durationD', 'D duration (ms)', 20),
        { key: 'order', label: 'Job order', type: 'select', value: 'ABCD', options: [{ value: 'ABCD', label: 'A, B, C, D' }, { value: 'DCBA', label: 'D, C, B, A' }, { value: 'ACBD', label: 'A, C, B, D' }] },
      ],
      scenarios: [{ label: 'Two different rejections', values: {} }, { label: 'Exactly at the deadline', values: { deadline: 60 } }, { label: 'All jobs fit', values: { limit: 160, deadline: 170 } }, { label: 'Reverse the order', values: { order: 'DCBA' } }, { label: 'Deadline before budget', values: { deadline: 10, limit: 10 } }],
      calculate(v) {
        const limit = integer(v.limit, 'Budget limit'), deadline = integer(v.deadline, 'Deadline');
        if (!['ABCD', 'DCBA', 'ACBD'].includes(v.order)) throw new Error('Choose a listed job order.');
        const jobs = [...v.order].map(id => ({ id, cost: integer(v['cost' + id], id + ' cost'), duration_ms: integer(v['duration' + id], id + ' duration') }));
        let state = { limit, spent: 0, holds: {}, closed: [] }, elapsed = 0;
        const events = [], locations = Object.fromEntries(jobs.map(job => [job.id, 'queue'])), notes = {}, frames = [];
        function snapshot(label, explanation, formula) {
          const lanes = ['queue', 'deadline', 'budget', 'completed', 'rejected'].map(id => lane(id, { queue: 'Ordered queue', deadline: 'Deadline gate', budget: 'Budget gate', completed: 'Completed', rejected: 'Rejected' }[id], jobs.filter(job => locations[job.id] === id).map(job => item('job-' + job.id, 'Job ' + job.id, `${job.cost} units / ${job.duration_ms} ms`, notes[job.id] || 'waiting', id === 'completed' ? 'good' : id === 'rejected' ? 'bad' : id === 'queue' ? 'neutral' : 'active'))));
          frames.push({ label, explanation, summary: `${state.spent} ${unit} spent; ${elapsed} ms elapsed`, formula, lanes, bars: [...bars(state), { label: 'Elapsed time', value: elapsed, max: deadline, unit: 'ms' }], receipt: { ledger: copy(state), events: copy(events), elapsed_ms: elapsed } });
        }
        snapshot('Read the ordered queue', 'Each job first faces the deadline gate, then the budget gate. Only completion advances time and spending.');
        for (const job of jobs) {
          const predicted = integer(elapsed + job.duration_ms, 'Predicted completion');
          locations[job.id] = 'deadline';
          notes[job.id] = `${elapsed} + ${job.duration_ms} = ${predicted} ms`;
          snapshot(job.id + ': check deadline', `Predicted completion is ${predicted} ms against a ${deadline} ms deadline. Equality is allowed.`, `${elapsed} + ${job.duration_ms} = ${predicted} ms`);
          if (predicted > deadline) {
            locations[job.id] = 'rejected'; notes[job.id] = 'deadline';
            events.push({ id: job.id, status: 'rejected', reason: 'deadline' });
            snapshot(job.id + ': reject for deadline', `${predicted} > ${deadline}. Skip the budget gate. This rejection does not spend or advance time.`);
            continue;
          }
          locations[job.id] = 'budget'; notes[job.id] = `${job.cost} requested / ${available(state)} available`;
          snapshot(job.id + ': check budget', `The deadline passes. Compare cost ${job.cost} with available capacity ${available(state)}.`, `${job.cost} ≤ ${available(state)}?`);
          if (job.cost > available(state)) {
            locations[job.id] = 'rejected'; notes[job.id] = 'budget exceeded';
            events.push({ id: job.id, status: 'rejected', reason: 'budget exceeded' });
            snapshot(job.id + ': reject for budget', `${job.cost} exceeds available capacity. Spending and elapsed time remain unchanged.`);
            continue;
          }
          state = { ...state, holds: { [job.id]: job.cost } };
          notes[job.id] = `${job.cost} held before completion`;
          snapshot(job.id + ': reserve capacity', `${job.cost} ${unit} move from available to held. Completion has not advanced time yet.`);
          state = { ...state, spent: state.spent + job.cost, holds: {}, closed: [...state.closed, job.id] };
          elapsed = predicted;
          locations[job.id] = 'completed'; notes[job.id] = `completed at ${elapsed} ms`;
          events.push({ id: job.id, status: 'completed', cost: job.cost, elapsed_ms: elapsed });
          snapshot(job.id + ': complete', `Settle the known ${job.cost}-unit cost and advance time by ${job.duration_ms} ms. No unresolved hold remains.`);
        }
        return finish(frames);
      },
    },
  });
}());
