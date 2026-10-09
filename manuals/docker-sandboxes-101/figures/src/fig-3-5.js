'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-3-5', {
  height: 300,
  title: 'A host allow and a kit HTTP rule on api.github.com',
  desc: 'Two columns. On the left, the default-code-and-containers group of the balanced preset allows github.com:443 and every subdomain, so a POST to api.github.com /repos/o/r/issues carrying data in its body is allowed, because a host rule reads host and port only. On the right, a network-policy@2 deny entry with hosts api.github.com and methods DELETE blocks DELETE /repos/o/r while the same POST still passes, because deny wins only where the method matches.',
}, f => {
  f.kicker(20, 18, 'A · host allow, balanced preset');
  f.kicker(336, 18, 'B · kit HTTP rule, network-policy@2');
  f.rule(320, 8, 320, 292, { dash: 'dashed' });
  const left = [
    { hue: 'teal', title: 'default-code-and-containers', sub: ['github.com:443 · **.github.com:443', 'allow · net:connect:tcp'] },
    { hue: 'indigo', title: 'POST api.github.com /repos/o/r/issues', sub: 'body: your data', titleSize: 11.5 },
    { hue: 'indigo', title: 'allowed: any method, path, body', sub: 'a host rule reads host and port only' },
  ];
  const right = [
    { hue: 'teal', title: 'runtime.deny entry', sub: ['hosts: [api.github.com]', 'methods: [DELETE]'] },
    { hue: 'rose', title: 'DELETE api.github.com /repos/o/r', sub: 'blocked by the HTTP rule', titleSize: 11.5 },
    { hue: 'indigo', title: 'POST /repos/o/r/issues still passes', sub: 'deny wins only where it matches', titleSize: 11.5 },
  ];
  [[left, 20], [right, 336]].forEach(([column, x]) => {
    column.forEach((item, index) => {
      const y = 30 + index * 90;
      f.box({ x, y, w: 284, h: 60, ...item });
      if (index < column.length - 1) f.arrow([x + 142, y + 60], [x + 142, y + 89], { style: index === 0 ? 'call' : (item.hue === 'rose' ? 'fail' : 'state') });
    });
  });
});
