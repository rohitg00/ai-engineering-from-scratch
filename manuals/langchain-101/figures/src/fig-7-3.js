'use strict';

const { figure } = require('../../../_shared/figkit.js');

const rows = [
  ['a checkpoint row names a class', ['an edited SqliteSaver row,', 'read with get_state'], 'default: get_state built the lab class', 'LANGGRAPH_STRICT_MSGPACK=true: raw fields'],
  ['a user id of *', ['a store prefix built', 'from that id'], 'list_namespaces listed every user', 'search on the same prefix: one user only'],
  ['an edit switches the tool', ['send_email edited into', 'a call of delete_file'], 'batched: delete_file ran in 3 of 3 runs', 'per_call: ValidationError, nothing ran'],
  ['an agent inside a local trace', ['tracing_context with', 'enabled="local"'], 'requests to api.smith.langchain.com', 'enabled=False: no request at all'],
];

module.exports = figure('fig-7-3', {
  height: 452,
  title: 'Where input crosses into code, by default and with the setting',
  desc: 'Four rows, each from an input on the left to two results on the right: the default result in rose and the result with a setting in violet. An edited SqliteSaver checkpoint row that names a class makes get_state build the class, and LANGGRAPH_STRICT_MSGPACK=true gives back the raw fields. A user id of star makes list_namespaces list every user, while search on the same prefix returns one user. A batched review lets an edit of send_email into delete_file run delete_file, and per-call review raises ValidationError. An agent inside tracing_context with enabled local sends requests to api.smith.langchain.com, and enabled False sends nothing.',
}, f => {
  f.kicker(20, 22, 'the input');
  f.kicker(300, 22, 'the default, then the change');
  rows.forEach(([title, sub, bad, good], i) => {
    const y = 34 + i * 96;
    const input = f.box({ x: 20, y, w: 252, h: 76, hue: 'grey', title, sub, align: 'left' });
    const worse = f.box({ x: 300, y, w: 320, h: 34, hue: 'rose', title: bad, align: 'left', titleSize: 11.5 });
    const better = f.box({ x: 300, y: y + 42, w: 320, h: 34, hue: 'violet', title: good, align: 'left', titleSize: 11.5 });
    f.path(`M${input.x + input.w} ${worse.cy} H${worse.x - 1}`, { style: 'fail' });
    f.path(`M${input.x + input.w} ${better.cy} H${better.x - 1}`, { style: 'call' });
  });
  f.text(20, 428, 'Rose: the result with the default. Violet: the result after the change.', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, 444, 'Each result is a recorded run on the Mac or a capture of the kit.', { size: 11, serif: true, hue: 'ink-soft' });
});
