'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-6-5', {
  height: 380,
  title: 'evaluate with upload_results=False on two targets',
  desc: 'Two columns, one evaluate call each, both with upload_results set to False and a recording client. On the left the target is a plain function that adds two numbers, over three examples, with the evaluator exact and the summary evaluator accuracy. The rows scored true, false, and true, accuracy was 0.667, and the client got no request. On the right the target is a create_agent run over one example, with the evaluator same_answer. The row scored true, and the client got POST /runs 7 times and PATCH 7 times, because evaluate runs the target inside tracing_context with enabled set to local.',
}, f => {
  f.kicker(20, 20, 'a plain function target');
  f.kicker(330, 20, 'a create_agent target');
  const col = (x, title, sub, ev, rows, out) => {
    const data = f.box({ x, y: 32, w: 290, h: 46, hue: 'violet', title, sub, align: 'left' });
    const target = f.box({ x, y: 108, w: 290, h: 46, hue: 'grey', title: 'target in tracing_context', sub: 'enabled="local", set by evaluate', align: 'left' });
    const evals = f.box({ x, y: 178, w: 200, h: 58, hue: 'green', title: ev, sub: rows, align: 'left' });
    const sent = f.box({ x, y: 278, w: 290, h: 52, hue: out[0], title: out[1], sub: out[2], align: 'left' });
    f.arrow([x + 40, data.y + data.h], [x + 40, target.y - 1], { style: 'call' });
    f.arrow([x + 40, target.y + target.h], [x + 40, evals.y - 1], { style: 'reply' });
    f.path(`M${x + 250} ${target.y + target.h} V${sent.y - 1}`, { style: out[0] === 'rose' ? 'fail' : 'reply' });
    f.text(x + 244, 262, 'requests', { size: 11, serif: true, hue: 'ink-soft', anchor: 'end' });
  };
  col(20, '3 examples: a + b', 'adder(), one answer wrong on purpose', 'exact, then accuracy', ['true, false, true', 'accuracy 0.667'], ['grey', 'the client got 0 requests', 'nothing left the process']);
  col(330, '1 example: What is 2 + 3?', 'create_agent with the fake model', 'same_answer', 'true', ['rose', 'POST /runs 7, PATCH 7', 'the LangChain runs of the agent']);
  f.text(20, 362, 'From the kit, langsmith 0.14.17, with a client that records each request.', { size: 11, serif: true, hue: 'ink-soft' });
});
