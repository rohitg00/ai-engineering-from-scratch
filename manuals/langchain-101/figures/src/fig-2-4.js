'use strict';

const { figure } = require('../../../_shared/figkit.js');

const rows = [
  ['bad arguments', "{'a': 'two'}", 'ToolMessage, status error', 'the model tries again', 'green'],
  ['unknown tool name', 'subtract', 'ToolMessage, status error', 'the model tries again', 'green'],
  ['exception, middleware', 'ToolErrorMiddleware', 'ToolMessage, status error', 'text from on_error', 'green'],
  ['exception, no middleware', 'RuntimeError', 'invoke raises', 'disk on fire', 'rose'],
];

module.exports = figure('fig-2-4', {
  height: 330,
  title: 'What each kind of tool failure does to a run',
  desc: 'Four rows, each from a failure on the left to its result on the right. Bad arguments such as a equal to two become a ToolMessage with status error and the model tries again. An unknown tool name such as subtract becomes a ToolMessage with status error. An exception with ToolErrorMiddleware becomes a ToolMessage with status error that holds the text from on_error. An exception with no middleware, RuntimeError disk on fire, raises out of invoke and ends the run.',
}, f => {
  f.kicker(20, 20, 'the failure');
  f.kicker(380, 20, 'what the run gets');
  rows.forEach(([kind, example, result, after, hue], i) => {
    const y = 34 + i * 70;
    const left = f.box({ x: 20, y, w: 250, h: 52, hue: 'grey', title: kind, sub: example, align: 'left' });
    const right = f.box({ x: 380, y, w: 240, h: 52, hue, title: result, sub: after, align: 'left' });
    f.arrow(left.right(), [right.x - 1, left.cy], { style: hue === 'rose' ? 'fail' : 'reply' });
  });
  f.text(20, 322, 'The first three go on to the next model call. The last one ends the run.', { size: 11, serif: true, hue: 'ink-soft' });
});
