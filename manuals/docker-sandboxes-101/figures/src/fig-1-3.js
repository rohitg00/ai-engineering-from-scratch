'use strict';

const { figure } = require('../../../_shared/figkit.js');

const lanes = [
  { title: 'operator', sub: 'your shell', hue: 'grey' },
  { title: 'docker-agent', sub: 'v1.149.0', hue: 'violet' },
  { title: '.m101 dirs', sub: 'in workspace', hue: 'teal' },
  { title: 'sbx', sub: 'and sandboxd', hue: 'blue' },
  { title: 'sandbox VM', sub: 'the guest', hue: 'blue' },
  { title: 'proxy :3128', sub: 'on the host', hue: 'indigo' },
  { title: 'Model Runner', sub: ':12434', hue: 'plum' },
];
const cx = index => 52 + index * 89;

const rows = [
  [0, 1, 'call', 'sandbox allow', 'localhost:12434'],
  [1, 2, 'write', '+ localhost:12434', 'persistent allowlist'],
  [0, 1, 'call', 'run --sandbox --exec', 'files-sandbox.yaml', 100],
  [1, 2, 'write', 'sandbox-kits/<hash>', 'the auto-kit'],
  [1, 3, 'call', 'create docker-agent-<hash>', 'docker-agent-sbx-templates:latest'],
  [3, 4, 'state', 'created, running', 'cpu 10, memory 32 GiB'],
  [1, 5, 'write', 'allow models.dev', 'and localhost:12434'],
  [4, 2, 'fail', 'readonly database (1032)', 'creating session store'],
  [0, 4, 'call', 'sbx exec docker-agent run', 'data dirs in /tmp/m101'],
  [4, 5, 'model', 'host.docker.internal:12434', 'through HTTP_PROXY'],
  [5, 6, 'model', 'localhost:12434', 'the sandbox allow rule'],
  [6, 4, 'event', 'chat.completion.chunk', 'the streamed answer'],
  [4, 0, 'reply', 'README.md with 1 line', 'exit 0'],
  [0, 3, 'call', 'sbx rm --force', null],
  [3, 4, 'state', 'removed', null],
];

module.exports = figure('fig-1-3', {
  height: 716,
  title: 'One docker-agent run --sandbox, step by step',
  desc: 'Seven lifelines: the operator, docker-agent v1.149.0 on the host, the .m101 state directories in the workspace, sbx with sandboxd, the sandbox VM, the host proxy on port 3128, and Docker Model Runner on port 12434. Fifteen rows: sandbox allow writes localhost:12434 to the persistent allowlist; run --sandbox --exec stages the kit sandbox-kits/<hash>, asks sbx to create docker-agent-<hash> from docker-agent-sbx-templates:latest, the sandbox becomes running with 10 CPUs and 32 GiB, and docker-agent allows models.dev and localhost:12434 on the proxy. Inside the VM the session store fails with readonly database (1032). An sbx exec then runs docker-agent inside with its data in /tmp/m101; its model call goes to host.docker.internal:12434 through the proxy, which forwards it to localhost:12434; the answer streams back as chat.completion.chunk events and the operator reads README.md with 1 line. sbx rm --force removes the sandbox.',
}, f => {
  lanes.forEach((lane, index) => {
    f.box({ x: cx(index), y: 8, w: 86, h: 40, hue: lane.hue, title: lane.title, sub: lane.sub, titleSize: 11, anchor: 'middle', pad: 3 });
    f.lifeline(cx(index), 48, 708);
  });
  rows.forEach(([from, to, style, label, note, labelX], index) => {
    const y = 80 + index * 42;
    f.beat(index + 1);
    f.step(16, y, index + 1, { hue: style === 'fail' ? 'rose' : undefined });
    const x1 = cx(from);
    const x2 = cx(to);
    f.arrow([x1, y], [x2 + (x2 > x1 ? -1 : 1), y], { style, label, note: note || undefined, labelX });
  });
});
