'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-7-2', {
  height: 436,
  title: 'From Docker Home to a SIEM',
  desc: 'Top row: an organization policy written in Docker Home under AI Platform is pulled by sandboxd within five minutes and merged with the local policy, whose 194 allow rules become inactive while its deny rules stay active. Second row: the proxy decides one request, example.com:443 from m101-policy, with the reason no applicable policies for op(action=net:connect:tcp, resource=net:domain:example.com:443), and the decision AUDIT_DECISION_DENY. Third row: the daemon writes one record to an audit-<utc>-<uuid>-<seq>.jsonl file under the auditkit directory, and rotation finalizes the file every 5 minutes, 1000 events, or 50 MiB. Bottom row: Docker Cloud delivery keeps the record searchable for 90 days and forwards it to a SIEM destination. A note says this capture had no organization and wrote no record.',
}, f => {
  f.kicker(20, 18, 'where the rules come from');
  const home = f.box({ x: 20, y: 30, w: 200, h: 58, hue: 'grey', title: 'Docker Home', sub: ['Network, Filesystem, MCP', 'policies, org or team scope'] });
  const daemon = f.box({ x: 250, y: 30, w: 180, h: 58, hue: 'blue', title: 'sandboxd', sub: ['pulls within 5 minutes', 'sbx policy reset forces it'] });
  const local = f.box({ x: 480, y: 30, w: 140, h: 58, hue: 'teal', title: 'local-policy', sub: ['194 allow: inactive', 'deny: still applied'] });
  f.arrow(home.right(), [daemon.x - 1, home.cy], { style: 'call', label: 'pull' });
  f.arrow(local.left(), [daemon.x + daemon.w + 1, local.cy], { style: 'call', label: 'merge' });

  const decision = f.box({ x: 20, y: 130, w: 600, h: 64, hue: 'indigo', title: 'the proxy decides: example.com:443 from m101-policy', sub: ['no applicable policies for op(action=net:connect:tcp,', 'resource=net:domain:example.com:443), decision AUDIT_DECISION_DENY'] });
  f.arrow(daemon.bottom(), [daemon.cx, decision.y - 1], { style: 'call', label: 'effective rules' });

  const audit = f.box({ x: 20, y: 232, w: 360, h: 64, hue: 'teal', title: 'audit-<utc>-<uuid>-<seq>.jsonl', sub: ['~/Library/Logs/com.docker.sandboxes/sandboxes/auditkit/', 'written by the daemon under an enforced org policy'] });
  f.path(`M${decision.cx} ${decision.y + decision.h} V214 H${audit.cx} V${audit.y - 1}`, { style: 'write' });
  f.text(330, 219, 'one record per decision', { size: 11.5, hue: 'teal', knock: true });
  const rotate = f.box({ x: 440, y: 232, w: 180, h: 64, hue: 'amber', title: 'rotation', sub: ['every 5 min, 1000 events,', 'or 50 MiB, .tmp to .jsonl'] });
  f.arrow(audit.right(), [rotate.x - 1, audit.cy], { style: 'state' });

  const cloud = f.box({ x: 20, y: 334, w: 290, h: 58, hue: 'grey', title: 'Docker Cloud delivery (default on)', sub: ['searchable 90 days, CSV up to 1 000 000 rows', 'app.docker.com, AI Platform, Audit logs'] });
  const siem = f.box({ x: 330, y: 334, w: 290, h: 58, hue: 'grey', title: 'SIEM destination', sub: ['Splunk Cloud, Dynatrace, Datadog, Sumo Logic', 'needs sbx 0.39.0 and cloud delivery'] });
  f.path(`M${audit.cx} ${audit.y + audit.h} V316 H${cloud.cx} V${cloud.y - 1}`, { style: 'effect' });
  f.text(210, 321, 'upload', { size: 11.5, hue: 'olive', knock: true });
  f.arrow(cloud.right(), [siem.x - 1, cloud.cy], { style: 'effect' });

  f.text(20, 422, 'this capture: no organization, no license, no record written (03-policy-org.txt)', { size: 11, serif: true, hue: 'ink-soft' });
});
