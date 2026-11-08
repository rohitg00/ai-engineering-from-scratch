'use strict';

const { figure } = require('../../../_shared/figkit.js');

const lanes = [
  { title: 'client', sub: 'Python script', hue: 'olive' },
  { title: 'tokenizer', sub: 'manager', hue: 'blue' },
  { title: 'scheduler', sub: 'event loop', hue: 'blue' },
  { title: 'model', sub: 'MLX, Qwen3', hue: 'violet' },
  { title: 'detokenizer', sub: 'manager', hue: 'blue' },
  { title: 'macOS', sub: 'Metal, disk', hue: 'grey' },
];
const cx = index => 60 + index * 104;

const rows = [
  [0, 1, 'call', 'POST /v1/chat/completions', 'a call · solid ink'],
  [1, 2, 'event', 'TokenizedGenerateReqInput', 'a ZMQ message · dotted indigo'],
  [2, 3, 'state', 'request waiting to running', 'a state change · dashed amber'],
  [2, 3, 'model', 'prefill 1 new token, 2998 cached', 'model compute · solid plum'],
  [3, 5, 'effect', 'Metal memory limit 51.8 GB', 'an outside effect · dashed olive'],
  [3, 5, 'write', '9 model files to the HF cache', 'a durable write · solid teal'],
  [2, 4, 'event', 'BatchTokenIDOutput', 'a ZMQ message · dotted indigo'],
  [1, 0, 'reply', '200 OK, cached_tokens 2998', 'a reply · dashed ink'],
  [3, 2, 'fail', 'Insufficient Memory at c=32', 'a failure · dashed rose'],
];

module.exports = figure('fig-0-1', {
  height: 520,
  title: 'Reading a sequence figure in this manual',
  desc: 'Six lifelines: the client script, the tokenizer manager, the scheduler, the model on MLX, the detokenizer manager, and macOS. Nine numbered rows use the eight arrow styles: POST /v1/chat/completions as a solid ink call, TokenizedGenerateReqInput as a dotted indigo ZMQ message, waiting to running as a dashed amber state change, a prefill of 1 new token with 2998 cached as a solid plum model call, the Metal memory limit of 51.8 GB as a dashed olive outside effect, the model files in the Hugging Face cache as a solid teal durable write, BatchTokenIDOutput as a dotted indigo message, 200 OK with cached_tokens 2998 as a dashed ink reply, and Insufficient Memory at concurrency 32 as a dashed rose failure.',
}, f => {
  lanes.forEach((lane, index) => {
    f.box({ x: cx(index), y: 8, w: 92, h: 40, hue: lane.hue, title: lane.title, sub: lane.sub, titleSize: 11, anchor: 'middle', pad: 3 });
    f.lifeline(cx(index), 48, 512);
  });
  rows.forEach(([from, to, style, label, note], index) => {
    const y = 84 + index * 48;
    f.beat(index + 1);
    f.step(16, y, index + 1, { hue: style === 'fail' ? 'rose' : undefined });
    const x1 = cx(from);
    let x2 = cx(to);
    if (from === to) x2 = x1 + 70;
    const labelX = from === to ? x1 + 90 : undefined;
    f.arrow([x1, y], [x2 + (x2 > x1 ? -1 : 1), y], { style, label, note, labelX });
  });
});
