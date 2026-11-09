// Lesson: Parallel / Swarm / Networked Architectures (phase 16 / lesson 09)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/16-multi-agent-and-swarms/09-parallel-swarm-networks/docs/en.md
// Run: npx tsx phases/16-multi-agent-and-swarms/09-parallel-swarm-networks/code/main.ts

import { setTimeout as sleep } from "node:timers/promises";

interface Task {
  task_id: number;
  duration: number;
  pre_assigned: number;
}

type Counts = Map<number, number>;

function now(): number {
  return performance.now() / 1000;
}

function pyCounts(c: Counts): string {
  return "{" + [...c.entries()].map(([k, v]) => `${k}: ${v}`).join(", ") + "}";
}

async function fakeWork(task: Task): Promise<string> {
  await sleep(task.duration * 1000);
  return `task-${task.task_id}-done`;
}

async function runSequential(tasks: Task[]): Promise<[number, Counts]> {
  const t0 = now();
  const counts: Counts = new Map([[0, 0]]);
  for (const t of tasks) {
    await fakeWork(t);
    counts.set(0, counts.get(0)! + 1);
  }
  return [now() - t0, counts];
}

async function runFixedAssignment(tasks: Task[], nWorkers: number): Promise<[number, Counts]> {
  const perWorker = new Map<number, Task[]>();
  for (let i = 0; i < nWorkers; i++) perWorker.set(i, []);
  for (const t of tasks) perWorker.get(t.pre_assigned)!.push(t);
  const counts: Counts = new Map();
  for (let i = 0; i < nWorkers; i++) counts.set(i, 0);

  const worker = async (wid: number): Promise<void> => {
    for (const t of perWorker.get(wid)!) {
      await fakeWork(t);
      counts.set(wid, counts.get(wid)! + 1);
    }
  };

  const t0 = now();
  const workers: Promise<void>[] = [];
  for (let i = 0; i < nWorkers; i++) workers.push(worker(i));
  await Promise.all(workers);
  return [now() - t0, counts];
}

async function runSwarm(tasks: Task[], nWorkers: number): Promise<[number, Counts]> {
  const q: Task[] = [...tasks];
  const counts: Counts = new Map();
  for (let i = 0; i < nWorkers; i++) counts.set(i, 0);

  const worker = async (wid: number): Promise<void> => {
    while (true) {
      const task = q.shift();
      if (task === undefined) return;
      await fakeWork(task);
      counts.set(wid, counts.get(wid)! + 1);
    }
  };

  const t0 = now();
  const workers: Promise<void>[] = [];
  for (let i = 0; i < nWorkers; i++) workers.push(worker(i));
  await Promise.all(workers);
  return [now() - t0, counts];
}

function makeTasks(nWorkers = 4): Task[] {
  const tasks: Task[] = [];
  for (let i = 0; i < 8; i++) {
    const isSlow = i < 4;
    tasks.push({
      task_id: i,
      duration: isSlow ? 0.4 : 0.1,
      pre_assigned: isSlow ? 0 : (((i - 3) % nWorkers) + nWorkers) % nWorkers,
    });
  }
  return tasks;
}

async function main(): Promise<void> {
  console.log("Swarm architecture demo: variable-duration workload");
  console.log("-".repeat(56));
  const nWorkers = 4;

  const tasks = makeTasks(nWorkers);
  const totalWork = tasks.reduce((s, t) => s + t.duration, 0);
  console.log(`${tasks.length} tasks, 4 slow (0.4s) + 4 fast (0.1s)`);
  console.log(`Total work-seconds: ${totalWork.toFixed(2)}s`);
  console.log(`Ideal parallel time with ${nWorkers} workers: ${(totalWork / nWorkers).toFixed(2)}s`);

  const [seqTime, seqCounts] = await runSequential(tasks);
  console.log(`\nSequential (1 worker):      wall=${seqTime.toFixed(2)}s, counts=${pyCounts(seqCounts)}`);

  const [fixedTime, fixedCounts] = await runFixedAssignment(tasks, nWorkers);
  console.log(`Fixed assignment (${nWorkers} workers): wall=${fixedTime.toFixed(2)}s, counts=${pyCounts(fixedCounts)}`);
  console.log("  worker 0 got all 4 slow tasks; other workers idle after their fast ones.");

  const [swarmTime, swarmCounts] = await runSwarm(tasks, nWorkers);
  console.log(`Swarm (${nWorkers} workers):            wall=${swarmTime.toFixed(2)}s, counts=${pyCounts(swarmCounts)}`);
  console.log("  load balances automatically: slow workers finish first, fast pull next job.");

  const speedupVsSeq = swarmTime > 0 ? seqTime / swarmTime : Infinity;
  const speedupVsFixed = swarmTime > 0 ? fixedTime / swarmTime : Infinity;
  console.log(`\nSwarm speedup vs sequential: ${speedupVsSeq.toFixed(2)}x`);
  console.log(`Swarm speedup vs fixed:      ${speedupVsFixed.toFixed(2)}x`);
  console.log("\nTakeaway: swarm wins when duration varies and assignment is hard to predict.");
  console.log("Tradeoff: no central trace; debugging requires per-task IDs and durable logs.");
}

main();
