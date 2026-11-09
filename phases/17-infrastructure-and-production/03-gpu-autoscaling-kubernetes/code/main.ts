// Lesson: GPU Autoscaling on Kubernetes: Karpenter, KAI Scheduler, Gang Scheduling (phase 17 / lesson 03)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/17-infrastructure-and-production/03-gpu-autoscaling-kubernetes/docs/en.md
// Run: npx tsx phases/17-infrastructure-and-production/03-gpu-autoscaling-kubernetes/code/main.ts

function fixed(x: number, digits: number): string {
  const rounded = x.toFixed(digits);
  if (Math.abs(x) >= 1e21) return rounded;
  const exact = x.toFixed(100);
  const dot = exact.indexOf(".");
  if (!/^50*$/.test(exact.slice(dot + 1 + digits))) return rounded;
  const kept = digits === 0 ? exact.slice(0, dot) : exact.slice(0, dot + 1 + digits);
  return Number(kept.slice(-1)) % 2 === 0 ? kept : rounded;
}

const rj = (s: string | number, w: number): string => String(s).padStart(w);
const lj = (s: string, w: number): string => s.padEnd(w);

class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  random(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

const NODE_PROVISION_SEC = 50;
const MODEL_LOAD_SEC = 45;
const REQUEST_PREFILL_SEC = 0.6;
const REQUEST_DECODE_SEC = 1.8;
const MIN_WARM_REPLICAS = 1;
const MAX_REPLICAS = 16;
const HPA_TICK_SEC = 15;
const TARGET_GPU_UTIL = 70;

interface Request {
  arrivedAt: number;
  startedAt: number | null;
  completedAt: number | null;
  dropped: boolean;
}

function request(arrivedAt: number): Request {
  return { arrivedAt, startedAt: null, completedAt: null, dropped: false };
}

function makeWorkload(durationSec = 3600, seed = 11): Request[] {
  const rng = new Rng(seed);
  const reqs: Request[] = [];
  for (let t = 0; t < Math.trunc(durationSec); t++) {
    let rate: number;
    if (t < 600) rate = 0.5;
    else if (t < 1800) rate = 4.0;
    else rate = 1.2;
    if (rng.random() < rate / 10) reqs.push(request(t));
  }
  return reqs;
}

interface Row {
  strategy: string;
  total: number;
  completed: number;
  dropped: number;
  meanWaitS: number;
  idleGpuMin: number;
  peakReplicas: number;
}

function simulate(strategy: string, input: Request[]): Row {
  let replicasReady = MIN_WARM_REPLICAS;
  let replicasTarget = MIN_WARM_REPLICAS;
  const replicaAvailableAt = new Map<number, number>();
  for (let i = 0; i < MIN_WARM_REPLICAS; i++) replicaAvailableAt.set(i, 0.0);
  let queue: Request[] = [];
  const reqs = [...input].sort((a, b) => a.arrivedAt - b.arrivedAt);
  let cursor = 0;
  let now = 0.0;
  const simEnd = Math.max(...reqs.map((r) => r.arrivedAt)) + 60;
  let idleGpuSec = 0.0;
  let pendingReplicas: [number, number][] = [];
  let nextReplicaId = MIN_WARM_REPLICAS;
  let peakReplicas = replicasReady;

  while (now < simEnd) {
    while (cursor < reqs.length && reqs[cursor].arrivedAt <= now) {
      queue.push(reqs[cursor]);
      cursor += 1;
    }
    for (const [readyAt, rid] of [...pendingReplicas]) {
      if (readyAt <= now) {
        replicaAvailableAt.set(rid, now);
        replicasReady += 1;
        pendingReplicas = pendingReplicas.filter(([a, b]) => !(a === readyAt && b === rid));
      }
    }

    const freeReplicas = [...replicaAvailableAt].filter(([, t]) => t <= now).map(([rid]) => rid);
    for (const rid of freeReplicas) {
      const r = queue.shift();
      if (r !== undefined) {
        r.startedAt = now;
        const serviceTime = REQUEST_PREFILL_SEC + REQUEST_DECODE_SEC;
        r.completedAt = now + serviceTime;
        replicaAvailableAt.set(rid, r.completedAt);
      } else {
        idleGpuSec += HPA_TICK_SEC;
      }
    }

    if (strategy === "DUTY_CYCLE") {
      const pendingIds = new Set(pendingReplicas.map(([, rid]) => rid));
      let busy = 0;
      for (const [rid, t] of replicaAvailableAt) if (t > now && !pendingIds.has(rid)) busy += 1;
      const util = (busy / Math.max(replicasReady, 1)) * 100;
      if (util > TARGET_GPU_UTIL && replicasTarget < MAX_REPLICAS) replicasTarget += 1;
      else if (util < 20 && replicasTarget > MIN_WARM_REPLICAS) replicasTarget -= 1;
    } else if (strategy === "QUEUE_DEPTH") {
      const qd = queue.length;
      if (qd > 5 && replicasTarget < MAX_REPLICAS) {
        replicasTarget = Math.min(MAX_REPLICAS, replicasTarget + Math.max(1, Math.floor(qd / 5)));
      } else if (qd === 0 && replicasTarget > MIN_WARM_REPLICAS) {
        replicasTarget = Math.max(MIN_WARM_REPLICAS, replicasTarget - 1);
      }
    } else if (strategy === "KAI_GANG") {
      const qd = queue.length;
      if (qd > 3 && replicasTarget < MAX_REPLICAS) {
        replicasTarget = Math.min(MAX_REPLICAS, replicasTarget + Math.max(2, Math.floor(qd / 3)));
      } else if (qd === 0 && replicasTarget > MIN_WARM_REPLICAS) {
        replicasTarget = Math.max(MIN_WARM_REPLICAS, replicasTarget - 1);
      }
    }

    while (replicasReady + pendingReplicas.length < replicasTarget) {
      const readyAt = now + NODE_PROVISION_SEC + MODEL_LOAD_SEC;
      pendingReplicas.push([readyAt, nextReplicaId]);
      replicaAvailableAt.set(nextReplicaId, readyAt);
      nextReplicaId += 1;
    }
    peakReplicas = Math.max(peakReplicas, replicasReady + pendingReplicas.length);
    if (replicasReady > replicasTarget) {
      const idle = [...replicaAvailableAt].filter(([, t]) => t <= now).map(([rid]) => rid);
      if (idle.length) {
        replicaAvailableAt.delete(idle[0]);
        replicasReady -= 1;
      }
    }

    for (const r of [...queue]) {
      if (now - r.arrivedAt > 30) {
        r.dropped = true;
        queue = queue.filter((q) => q !== r);
      }
    }

    now += HPA_TICK_SEC;
  }

  const dropped = reqs.filter((r) => r.dropped).length;
  const completed = reqs.filter((r) => r.completedAt !== null).length;
  const started = reqs.filter((r) => r.startedAt !== null);
  const meanWait = started.length ? started.reduce((acc, r) => acc + ((r.startedAt ?? 0) - r.arrivedAt), 0) / started.length : 0.0;
  return {
    strategy,
    total: reqs.length,
    completed,
    dropped,
    meanWaitS: meanWait,
    idleGpuMin: idleGpuSec / 60,
    peakReplicas,
  };
}

function report(row: Row): void {
  console.log(
    `${lj(row.strategy, 14)}  reqs=${rj(row.total, 4)}  ` +
      `done=${rj(row.completed, 4)}  dropped=${rj(row.dropped, 3)}  ` +
      `mean_wait=${rj(fixed(row.meanWaitS, 1), 5)}s  ` +
      `idle_gpu=${rj(fixed(row.idleGpuMin, 1), 6)}min  peak=${rj(row.peakReplicas, 2)}`,
  );
}

function main(): void {
  console.log("=".repeat(80));
  console.log("GPU AUTOSCALING: three strategies on a bursty workload (1-hour sim)");
  console.log("=".repeat(80));
  const base = makeWorkload();
  const header = `${lj("Strategy", 14)}  reqs       done  dropped  mean_wait  idle_gpu   peak`;
  console.log(header);
  console.log("-".repeat(header.length));
  for (const strategy of ["DUTY_CYCLE", "QUEUE_DEPTH", "KAI_GANG"]) {
    const reqs = base.map((r) => request(r.arrivedAt));
    report(simulate(strategy, reqs));
  }

  console.log("\nRead: DUTY_CYCLE drops requests because DCGM_FI_DEV_GPU_UTIL");
  console.log("is a duty-cycle metric. QUEUE_DEPTH reacts to the actual backlog.");
  console.log("KAI_GANG scales more aggressively and avoids partial-alloc stalls.");
}

main();
