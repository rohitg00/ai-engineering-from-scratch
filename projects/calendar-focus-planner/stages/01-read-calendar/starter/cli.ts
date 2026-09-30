import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { parseCalendar, schedule, exportCalendar, renderPlan } from './main.ts';

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 3 || args.includes('--help')) {
    console.log('node cli.ts calendar.ics tasks.json YYYY-MM-DD [output-directory] [buffer-minutes]');
    return args.includes('--help') ? 0 : 2;
  }
  const [calendarFile, taskFile, day, output = 'focus-output', buffer = '10'] = args;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('Use YYYY-MM-DD');
  const start = Date.parse(day + 'T09:00:00Z'), end = Date.parse(day + 'T17:00:00Z');
  if (!Number.isFinite(start) || new Date(start).toISOString().slice(0, 10) !== day) throw new Error('Invalid date');
  const events = parseCalendar(await readFile(calendarFile, 'utf8'));
  const tasks = JSON.parse(await readFile(taskFile, 'utf8'));
  const plan = schedule(tasks, events, { start, end }, Number(buffer));
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, 'focus.ics'), exportCalendar(plan, start));
  await writeFile(path.join(output, 'plan.json'), JSON.stringify(plan, null, 2) + '\n');
  await writeFile(path.join(output, 'plan.html'), renderPlan(plan));
  console.log(JSON.stringify({ output, scheduled: plan.scheduled.map(task => ({ title: task.title, start: new Date(task.start).toISOString(), minutes: task.minutes })), unscheduled: plan.unscheduled }, null, 2));
  return 0;
}
main().then(code => { process.exitCode = code; }).catch(error => { console.error('focus planner: ' + error.message); process.exitCode = 2; });
