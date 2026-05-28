/**
 * Batch APIs — TypeScript port + deferred-future dispatcher.
 *
 * 2つの部分:
 *   1. BatchDispatcher: N 個の job を submit し、job ごとに promise を返す。
 *      batch が完了すると resolve される。network なしで OpenAI / Anthropic の
 *      JSONL batch lifecycle（in_progress → completed）を simulate する。
 *      "deferred future" pattern は call site で起きることそのものだ。投げっぱなしに
 *      して、promise が数時間後に答えを渡す。
 *   2. main.py と同じ cost simulator: 3つの workload に対して
 *      SYNC、SYNC+CACHE、BATCH、BATCH+CACHE を比較する。
 *      Pricing constants は docs/en.md の 2026-04 時点。
 *
 * Citations:
 *   - OpenAI Batch API: platform.openai.com/docs/guides/batch
 *   - Anthropic Message Batches: docs.anthropic.com/en/docs/build-with-claude/batch-processing
 *   - Vertex AI Batch Prediction: cloud.google.com/vertex-ai/generative-ai/docs/model-reference/batch-prediction
 *
 * Node 20+ stdlib で動作する。npm deps は不要。
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
  // Internal: dispatch 時に capture した resolver functions。
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
  // simulated turnaround。実 provider は 24h SLA と言うが、典型 P50 は 2-6h。
  // demo では実行を速くするため小さな ms を使う。
  private readonly turnaroundMs: number;

  constructor(
    processor: (input: I) => Promise<O>,
    turnaroundMs: number,
  ) {
    this.processor = processor;
    this.turnaroundMs = turnaroundMs;
  }

  // 新しい batch を開く。job を追加するための batch id を返す。
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

  // queued batch に job を追加する。caller が batch close/process 後に await する
  // deferred Promise<O> を返す。OpenAI の batch.create + retrieve flow の
  // user-facing shape と対応する。
  addJob(batchId: string, input: I): Promise<O> {
    const batch = this.requireBatch(batchId);
    if (batch.status !== "queued") {
      return Promise.reject(
        new Error(`batch ${batchId} は queued ではありません (status=${batch.status})`),
      );
    }
    // processor loop から resolve できるよう、手書きの deferred を作る。
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

  // Close + process。すべての job が resolved/rejected されたら返る。
  // async iteration model は実 batch と同じ。job ごとに await せず、
  // batch 全体を await する。
  async closeBatch(batchId: string): Promise<Batch<I, O>> {
    const batch = this.requireBatch(batchId);
    batch.status = "in_progress";
    // provider scheduling delay を simulate する。
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
    if (!b) throw new Error(`その batch は存在しません: ${id}`);
    return b;
  }
}

// -- Mocked classification processor (no network) --------------------------

type ClassifyIn = { docId: string; text: string };
type ClassifyOut = { docId: string; label: string; confidence: number };

async function fakeClassifier(input: ClassifyIn): Promise<ClassifyOut> {
  // input length の偶奇だけを見る deterministic toy classifier。
  const label = input.text.length % 2 === 0 ? "positive" : "neutral";
  return {
    docId: input.docId,
    label,
    confidence: 0.5 + (input.text.length % 5) / 10,
  };
}

async function batchDemo(): Promise<void> {
  console.log("--- deferred future を使う Batch dispatcher ---");
  // demo では turnaround を 50ms に設定する（production: 24h SLA）。
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
  console.log(`close 前の status: ${dispatcher.getStatus(batchId)}`);
  // caller は jobs を await し、dispatcher は同時に batch を close する。
  const closePromise = dispatcher.closeBatch(batchId);
  const results = await Promise.all(futures);
  await closePromise;
  console.log(`close 後の status: ${dispatcher.getStatus(batchId)}`);
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
  console.log(`  SYNC + CACHE    : ${fmtCost(scc)}  (baseline の ${fmtPct(scc, sc)})`);
  console.log(`  BATCH           : ${fmtCost(bc)}  (baseline の ${fmtPct(bc, sc)})`);
  console.log(`  BATCH + CACHE   : ${fmtCost(bcc)}  (baseline の ${fmtPct(bcc, sc)})`);
}

async function main(): Promise<void> {
  await batchDemo();
  console.log("\n" + "=".repeat(80));
  console.log(
    "BATCH API ECONOMICS — batch と prompt caching を重ねて sync bill の約10%へ",
  );
  console.log("=".repeat(80));
  runScenario(
    "夜間の文書要約 (50k docs)",
    50_000,
    4000,
    2000,
    200,
  );
  runScenario(
    "コンテンツ分類 (200k items, short per item)",
    200_000,
    1500,
    300,
    50,
  );
  runScenario(
    "大きなレポート草案 (small N, heavy per item)",
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
