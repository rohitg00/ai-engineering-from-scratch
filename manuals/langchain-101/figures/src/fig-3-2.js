'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-3-2', {
  height: 520,
  title: 'Which strategy runs, and how it fails',
  desc: 'A decision figure. An explicit ToolStrategy and an explicit ProviderStrategy are kept as they are. A plain schema or AutoStrategy becomes ProviderStrategy when the model profile says structured_output is true, or when the model name is in a fixed list, and ToolStrategy otherwise. ToolStrategy fails by retrying a parse error with no count, by looping to the recursion limit when the agent has no tools, and by ending with no structured_response when the agent has a tool of its own. ProviderStrategy fails with ValueError at build time for a union, raises on a 400 for response_format, and raises on bad JSON on the first call.',
}, f => {
  f.kicker(20, 20, 'what you pass as response_format');
  const tool = f.box({ x: 20, y: 34, w: 196, h: 50, hue: 'violet', title: 'ToolStrategy(s)', sub: 'explicit' });
  const auto = f.box({ x: 222, y: 34, w: 196, h: 50, hue: 'violet', title: 'a plain schema', sub: 'or AutoStrategy(s)' });
  const prov = f.box({ x: 424, y: 34, w: 196, h: 50, hue: 'violet', title: 'ProviderStrategy(s)', sub: 'explicit' });
  const profile = f.box({ x: 222, y: 118, w: 196, h: 50, hue: 'amber', title: 'model.profile', sub: 'says structured_output?' });
  const name = f.box({ x: 222, y: 202, w: 196, h: 50, hue: 'amber', title: 'model name', sub: 'in the fixed list?' });
  const toolOut = f.box({ x: 20, y: 290, w: 260, h: 50, hue: 'blue', title: 'ToolStrategy runs', sub: 'one tool per schema, tool_choice any' });
  const provOut = f.box({ x: 360, y: 290, w: 260, h: 50, hue: 'blue', title: 'ProviderStrategy runs', sub: 'response_format, one attempt' });
  f.arrow([70, tool.y + tool.h], [70, toolOut.y - 1], { style: 'call', label: 'kept' });
  f.arrow([570, prov.y + prov.h], [570, provOut.y - 1], { style: 'call', label: 'kept' });
  f.arrow([auto.cx, auto.y + auto.h], [auto.cx, profile.y - 1], { style: 'call' });
  f.path(`M${profile.x + profile.w} ${profile.cy} H510 V${provOut.y - 1}`, { style: 'state' });
  f.text(426, profile.cy - 6, 'yes', { size: 11, hue: 'amber', knock: true });
  f.arrow([profile.cx, profile.y + profile.h], [profile.cx, name.y - 1], { style: 'state', label: 'no' });
  f.path(`M${name.x + name.w} ${name.cy} H460 V${provOut.y - 1}`, { style: 'state' });
  f.text(426, name.cy - 6, 'yes', { size: 11, hue: 'amber', knock: true });
  f.path(`M${name.x} ${name.cy} H170 V${toolOut.y - 1}`, { style: 'state' });
  f.text(186, name.cy - 6, 'no', { size: 11, hue: 'amber', knock: true });
  f.kicker(20, 372, 'how each one fails');
  const toolFail = f.box({ x: 20, y: 384, w: 290, h: 92, hue: 'rose', title: 'ToolStrategy', sub: ['parse error: retry with no count', 'tools=[]: loops to the recursion limit', 'your tool + plain text: no result, no error'], align: 'left' });
  const provFail = f.box({ x: 330, y: 384, w: 290, h: 92, hue: 'rose', title: 'ProviderStrategy', sub: ['a union: ValueError at build', 'a 400 on response_format: raises', 'bad JSON: raises on the first call'], align: 'left' });
  f.arrow([230, toolOut.y + toolOut.h], [230, toolFail.y - 1], { style: 'fail' });
  f.arrow([490, provOut.y + provOut.h], [490, provFail.y - 1], { style: 'fail' });
  f.text(20, 504, 'No failure at run time moves a run from one strategy to the other.', { size: 11, serif: true, hue: 'ink-soft' });
});
