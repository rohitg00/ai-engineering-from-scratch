'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-1-2', {
  height: 330,
  title: 'A dead engine does not stop the job',
  desc: 'Two runs on one time axis. Without a watchdog, the engine stopped at start, and the rollout loop then logged 200,533 HTTP 503 errors over 63 minutes while the GPU did nothing, until we stopped the container. With watchdog.sh, a test container that logged the same error without a break stopped after 183 seconds, when six checks in a row found more than 100 errors. A healthy 16-answer run logged bursts of this error of up to 60 seconds, two of them 45 seconds apart. A replay of that run stopped it in more than half of the cases with six checks and in none with ten, so we run the watchdog with ten.',
}, f => {
  const x0 = 150;
  const w = 470;
  const px = minutes => x0 + (minutes / 65) * w;
  f.kicker(20, 28, 'minutes after the engine stopped');
  for (const t of [0, 15, 30, 45, 60]) {
    f.rule(px(t), 232, px(t), 240, { hue: 'ink' });
    f.text(px(t), 254, String(t), { size: 11, anchor: 'middle', hue: 'ink-soft' });
  }

  f.text(20, 82, 'no watchdog', { size: 12, weight: 700 });
  f.text(20, 100, 'the job keeps going', { size: 11, serif: true, hue: 'ink-soft' });
  f.rect(px(0), 62, px(63) - px(0), 44, { hue: 'rose', dash: 'dashed' });
  f.text(px(31.5), 82, '200,533 lines of HTTP 503 from /generate', { size: 11.5, anchor: 'middle', hue: 'rose', weight: 700 });
  f.text(px(31.5), 98, 'GPU idle, no failure reported', { size: 11, anchor: 'middle', serif: true, hue: 'ink-soft' });
  f.text(px(63), 124, 'we stopped it at 63 min', { size: 11, anchor: 'end', serif: true, hue: 'ink-soft' });

  f.text(20, 172, 'watchdog.sh test', { size: 12, weight: 700 });
  f.text(20, 190, 'needs 6 bad checks', { size: 11, serif: true, hue: 'ink-soft' });
  f.rect(px(0), 152, px(3.05) - px(0), 44, { hue: 'rose', dash: 'dashed' });
  f.arrow([px(3.05) + 2, 174], [px(9), 174], { style: 'state' });
  f.text(px(9) + 2, 214, 'the watchdog stops the container', { size: 11, serif: true, hue: 'amber' });
  f.box({ x: px(9) + 2, y: 152, w: 250, h: 44, hue: 'amber', title: 'exit 1 after 183 s', sub: ['more than 100 errors in six checks'] });

  f.text(20, 290, 'Start every unattended run with a watchdog. The job alone never fails.', { size: 12, serif: true });
  f.text(20, 312, 'Healthy bursts came 45 s apart, so six checks are too few. Run it with ten.', { size: 12, serif: true, hue: 'ink-soft' });
});
