'use strict';

const { figure } = require('../../../_shared/figkit.js');

const rows = [
  { seen: '503 after 5.06 s', body: ['no worker has room for the actor'], cause: 'the pool is full', why: ['every worker is reserved'], hue: 'violet', fix: 'free a worker', how: ['suspend, or add workers'] },
  { seen: '503 in 0.07 s', body: ['AssignWorker prerequisite not met'], cause: 'actor is CRASHED', why: ['only SUSPENDED resumes'], hue: 'amber', fix: 'revert the actor', how: ['kubectl ate revert actor'] },
  { seen: '500 in 0.08 s', body: ['error resuming actor lab-c/x1'], cause: 'node copy is gone', why: ['lost before the upload'], hue: 'teal', fix: 'revert the actor', how: ['recent calls are lost'] },
  { seen: 'timeout, then 500', body: ['error resuming actor lab-e/e-run'], cause: 'Postgres is away', why: ['the row is not readable'], hue: 'teal', fix: 'restore the database', how: ['resumes lag 27 s'] },
  { seen: '503 after 3 to 5 s', body: ['actor lab-e/e-run unavailable'], cause: 'no ate-api-server', why: ['the router got no answer'], hue: 'blue', fix: 'check its pods', how: ['then check Postgres'] },
  { seen: '503 in 0.06 s', body: ['upstream connect error', 'reason: connection termination'], cause: 'the process exited', why: ['state stays RUNNING'], hue: 'green', fix: 'suspend, then revert', how: ['use --mode sync'] },
];

module.exports = figure('fig-8-3', {
  height: 420,
  title: 'From a failed request to its cause',
  desc: 'Six failed requests in rows. Each row gives the status code, the delay, and the body that the client saw, then the cause that our runs proved, then the fix. Two rows have a 500 and four have a 503, and the delay and the body tell them apart.',
}, f => {
  f.kicker(20, 20, 'the client saw');
  f.kicker(262, 20, 'cause');
  f.kicker(450, 20, 'fix');
  rows.forEach((row, index) => {
    const y = 30 + index * 64;
    const h = 54;
    f.box({ x: 20, y, w: 226, h, hue: 'rose', title: row.seen, sub: row.body });
    f.box({ x: 262, y, w: 172, h, hue: row.hue, title: row.cause, sub: row.why });
    f.box({ x: 450, y, w: 170, h, hue: 'grey', title: row.fix, sub: row.how, titleSize: 11.5 });
    f.arrow([246, y + h / 2], [261, y + h / 2], {});
    f.arrow([434, y + h / 2], [449, y + h / 2], {});
  });
});
