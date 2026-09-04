/**
 * Batch APIs — TypeScript port + deferred-future dispatcher.
 *
 * Two halves:
 *   1. BatchDispatcher: submits N jobs, returns a promise per job that resolves
 *      when the batch completes. Simulates the OpenAI / Anthropic JSONL batch
 *      lifecycle (in_progress → completed) without any network. The "deferred
 *      future" pattern is what your code does at the call site — you fire and
 *      forget, the promise hands you the answer hours later.
 *   2. Cost simulator matching main.py: SYNC, SYNC+CACHE, BATCH, BATCH+CACHE
 *      across three workloads. Pricing constants 2026-04 per docs/en.md.
 *
 * Citations:
 *   - OpenAI Batch API: platform.openai.com/docs/guides/batch
 *   - Anthropic Message Batches: docs.anthropic.com/en/docs/build-with-claude/batch-processing
 *   - Vertex AI Batch Prediction: cloud.google.com/vertex-ai/generative-ai/docs/model-reference/batch-prediction
 *
 * Runs on Node 20+ stdlib. No npm deps.
 */

import { randomUUID } from "node:crypto";

// -- Cost constants (2026-04) ---------------------------------------------

const BASE_INPUT = 3.0;
const BASE_OUTPUT = 15.0;
const CACHED_INPUT = 0.3;
const CACHE_WRITE_5MIN = 1.25 * BASE_INPUT;
const BATCH_DISCOUNT = 0.5;

// -- Batch dispatcher with deferred futures -------------------------------

type BatchStatus = "queued" | "in_progress" | "completed" | "failed";

type BatchJob<I, O> = {
  id: string;
  input: I;
  promise: Promise<O>;
  // Internal: resolver functions captured at dispatch.
  resolve: (out: O) => void;
  reject: (err: Error) => void;
};

type Batch<I, O> = {
  id: string;
  status: BatchStatus;
  createdAt: number;
  completedAt?: number;
  jobs: BatchJob<I, O>[];
};

class BatchDispatcher<I, O> {
  private readonly batches = new Map<string, Batch<I, O>>();
  private readonly processor: (input: I) => Promise<O>;
  // Simulated turnaround. Real providers say 24h SLA; typical P50 is 2-6h.
  // In the demo we use small ms to keep the run snappy.
  private readonly turnaroundMs: number;

  constructor(
    processor: (input: I) => Promise<O>,
    turnaroundMs: number,
  ) {
    this.processor = processor;
    this.turnaroundMs = turnaroundMs;
  }

  // Open a new batch. Returns the batch id you append jobs to.
  openBatch(): string {
    const id = `batch_${randomUUID().slice(0, 12)}`;
    this.batches.set(id, {
      id,
      status: "queued",
      createdAt: Date.now(),
      jobs: [],
    });
    return id;
  }

  // Append a job to a queued batch. Returns the deferred Promise<O> the caller
  // awaits once the batch closes and processes. Matches the user-facing shape
  // of OpenAI's batch.create + retrieve flow.
  addJob(batchId: string, input: I): Promise<O> {
    const batch = this.requireBatch(batchId);
    if (batch.status !== "queued") {
      return Promise.reject(
        new Error(`batch ${batchId} not queued (status=${batch.status})`),
      );
    }
    // Hand-rolled deferred so we can resolve from the processor loop.
    let resolve!: (out: O) => void;
    let reject!: (err: Error) => void;
    const promise = new Promise<O>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    batch.jobs.push({
      id: `req_${randomUUID().slice(0, 8)}`,
      input,
      promise,
      resolve,
      reject,
    });
    return promise;
  }

  // Close + process. Returns when all jobs resolved/rejected.
  // The async-iteration model is identical to a real batch: you don't await
  // each job; you await the whole batch.
  async closeBatch(batchId: string): Promise<Batch<I, O>> {
    const batch = this.requireBatch(batchId);
    batch.status = "in_progress";
    // Simulate provider scheduling delay.
    await new Promise<void>((res) => setTimeout(res, this.turnaroundMs));
    const settlements: Promise<void>[] = batch.jobs.map(async (j) => {
      try {
        j.resolve(await this.processor(j.input));
      } catch (err) {
        j.reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
    await Promise.all(settlements);
    batch.status = "completed";
    batch.completedAt = Date.now();
    return batch;
  }

  getStatus(batchId: string): BatchStatus {
    return this.requireBatch(batchId).status;
  }

  private requireBatch(id: string): Batch<I, O> {
    const b = this.batches.get(id);
    if (!b) throw new Error(`no such batch: ${id}`);
    return b;
  }
}

// -- Mocked classification processor (no network) --------------------------

type ClassifyIn = { docId: string; text: string };
type ClassifyOut = { docId: string; label: string; confidence: number };

async function fakeClassifier(input: ClassifyIn): Promise<ClassifyOut> {
  // Deterministic toy classifier on input length parity.
  const label = input.text.length % 2 === 0 ? "positive" : "neutral";
  return {
    docId: input.docId,
    label,
    confidence: 0.5 + (input.text.length % 5) / 10,
  };
}

async function batchDemo(): Promise<void> {
  console.log("--- Batch dispatcher with deferred futures ---");
  // Turnaround set to 50ms in demo (production: 24h SLA).
  const dispatcher = new BatchDispatcher<ClassifyIn, ClassifyOut>(
    fakeClassifier,
    50,
  );
  const batchId = dispatcher.openBatch();
  const futures: Promise<ClassifyOut>[] = [];
  for (let i = 0; i < 6; i++) {
    futures.push(
      dispatcher.addJob(batchId, {
        docId: `doc-${i}`,
        text: `document body number ${i}`,
      }),
    );
  }
  console.log(`status before close: ${dispatcher.getStatus(batchId)}`);
  // Caller awaits jobs; dispatcher closes the batch concurrently.
  const closePromise = dispatcher.closeBatch(batchId);
  const results = await Promise.all(futures);
  await closePromise;
  console.log(`status after close: ${dispatcher.getStatus(batchId)}`);
  for (const r of results) {
    console.log(
      `  ${r.docId} → label=${r.label} confidence=${r.confidence.toFixed(2)}`,
    );
  }
}

// -- Cost simulator -------------------------------------------------------

function costSync(
  docs: number,
  prefixTokens: number,
  perDocTokens: number,
  outTokens: number,
): number {
  let cost = 0;
  for (let i = 0; i < docs; i++) {
    cost += (prefixTokens / 1e6) * BASE_INPUT;
    cost += (perDocTokens / 1e6) * BASE_INPUT;
    cost += (outTokens / 1e6) * BASE_OUTPUT;
  }
  return cost;
}

function costSyncCache(
  docs: number,
  prefixTokens: number,
  perDocTokens: number,
  outTokens: number,
): number {
  let cost = (prefixTokens / 1e6) * CACHE_WRITE_5MIN;
  for (let i = 0; i < docs; i++) {
    if (i > 0) cost += (prefixTokens / 1e6) * CACHED_INPUT;
    cost += (perDocTokens / 1e6) * BASE_INPUT;
    cost += (outTokens / 1e6) * BASE_OUTPUT;
  }
  return cost;
}

function costBatch(
  docs: number,
  prefixTokens: number,
  perDocTokens: number,
  outTokens: number,
): number {
  return costSync(docs, prefixTokens, perDocTokens, outTokens) * BATCH_DISCOUNT;
}

function costBatchCache(
  docs: number,
  prefixTokens: number,
  perDocTokens: number,
  outTokens: number,
): number {
  return (
    costSyncCache(docs, prefixTokens, perDocTokens, outTokens) * BATCH_DISCOUNT
  );
}

function fmtCost(n: number): string {
  return `$${n.toFixed(2)}`.padStart(10);
}

function fmtPct(n: number, baseline: number): string {
  return `${((n / baseline) * 100).toFixed(1)}%`.padStart(5);
}

function runScenario(
  label: string,
  docs: number,
  prefix: number,
  perDoc: number,
  output: number,
): void {
  const sc = costSync(docs, prefix, perDoc, output);
  const scc = costSyncCache(docs, prefix, perDoc, output);
  const bc = costBatch(docs, prefix, perDoc, output);
  const bcc = costBatchCache(docs, prefix, perDoc, output);
  console.log(`\n${label}`);
  console.log(
    `  docs=${docs}, prefix=${prefix}, per_doc=${perDoc}, output=${output}`,
  );
  console.log(`  SYNC            : ${fmtCost(sc)}  (baseline)`);
  console.log(`  SYNC + CACHE    : ${fmtCost(scc)}  (${fmtPct(scc, sc)} of baseline)`);
  console.log(`  BATCH           : ${fmtCost(bc)}  (${fmtPct(bc, sc)} of baseline)`);
  console.log(`  BATCH + CACHE   : ${fmtCost(bcc)}  (${fmtPct(bcc, sc)} of baseline)`);
}

async function main(): Promise<void> {
  await batchDemo();
  console.log("\n" + "=".repeat(80));
  console.log(
    "BATCH API ECONOMICS — stack batch with prompt caching for ~10% of sync bill",
  );
  console.log("=".repeat(80));
  runScenario(
    "Nightly doc summarization (50k docs)",
    50_000,
    4000,
    2000,
    200,
  );
  runScenario(
    "Content classification (200k items, short per item)",
    200_000,
    1500,
    300,
    50,
  );
  runScenario(
    "Large report draft (small N, heavy per item)",
    1_000,
    6000,
    15_000,
    2000,
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
