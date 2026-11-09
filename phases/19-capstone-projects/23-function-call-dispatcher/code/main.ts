// Lesson: Function Call Dispatcher (phase 19 / lesson 23)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/19-capstone-projects/23-function-call-dispatcher/docs/en.md
// Run: npx tsx phases/19-capstone-projects/23-function-call-dispatcher/code/main.ts

import { performance } from "node:perf_hooks";

export const ERR_METHOD_NOT_FOUND = -32601;
export const ERR_INVALID_PARAMS = -32602;
export const ERR_INTERNAL = -32603;

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type Args = Record<string, unknown>;
type Handler = (args: Args) => unknown;
type Schema = {
  type?: string;
  required?: string[];
  properties?: Record<string, Schema>;
};

export class TransientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransientError";
  }
}

class DispatchedError extends Error {
  error: DispatchError;
  constructor(error: DispatchError) {
    super(error.message);
    this.name = "_DispatchedError";
    this.error = error;
  }
}

class AsyncTimeoutError extends Error {
  constructor() {
    super("timeout");
    this.name = "TimeoutError";
  }
}

export class DispatchError extends Error {
  kind: string;
  attempts: number;
  jsonrpcCode: number;
  constructor(kind: string, message: string, attempts: number, jsonrpcCode: number = ERR_INTERNAL) {
    super(message);
    this.name = "DispatchError";
    this.kind = kind;
    this.attempts = attempts;
    this.jsonrpcCode = jsonrpcCode;
  }

  toEnvelope(): Record<string, Json> {
    return {
      code: this.jsonrpcCode,
      message: this.message,
      data: { kind: this.kind, attempts: this.attempts },
    };
  }
}

export class DispatchOk {
  constructor(public result: unknown, public attempts: number) {}
}

type ToolRecord = {
  name: string;
  schema: Schema;
  handler: Handler;
  idempotent: boolean;
  timeoutMs: number;
};

class KeyError extends Error {
  constructor(key: string) {
    super(key);
    this.name = "KeyError";
  }
}

export class MiniRegistry {
  private recs = new Map<string, ToolRecord>();

  register(
    name: string, schema: Schema, handler: Handler,
    opts: { idempotent?: boolean; timeoutMs?: number } = {},
  ): void {
    this.recs.set(name, {
      name, schema, handler,
      idempotent: opts.idempotent ?? false,
      timeoutMs: opts.timeoutMs ?? 30_000,
    });
  }

  get(name: string): ToolRecord {
    const rec = this.recs.get(name);
    if (rec === undefined) throw new KeyError(name);
    return rec;
  }

  validate(name: string, args: unknown): string[] {
    const rec = this.get(name);
    const errs: string[] = [];
    walk(rec.schema, args, "", errs);
    return errs;
  }
}

function pyTypeName(value: unknown): string {
  if (value === null || value === undefined) return "NoneType";
  if (typeof value === "boolean") return "bool";
  if (typeof value === "number") return Number.isInteger(value) ? "int" : "float";
  if (typeof value === "string") return "str";
  if (Array.isArray(value)) return "list";
  return "dict";
}

function isDict(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function walk(schema: Schema, value: unknown, path: string, errs: string[]): void {
  const t = schema.type;
  let typeOk = true;
  if (t === "object" && !isDict(value)) typeOk = false;
  else if (t === "integer" && !(typeof value === "number" && Number.isInteger(value))) typeOk = false;
  else if (t === "string" && typeof value !== "string") typeOk = false;
  else if (t === "array" && !Array.isArray(value)) typeOk = false;
  if (!typeOk) {
    errs.push(`${path || "/"}: expected ${t}, got ${pyTypeName(value)}`);
    return;
  }
  if (t === "object" && isDict(value)) {
    for (const req of schema.required ?? []) {
      if (!(req in value)) errs.push(`${path}/${req}: required`);
    }
    for (const [k, sub] of Object.entries(schema.properties ?? {})) {
      if (k in value) walk(sub, value[k], `${path}/${k}`, errs);
    }
  }
}

class Deferred {
  promise: Promise<unknown>;
  done = false;
  resolve!: (v: unknown) => void;
  reject!: (e: unknown) => void;
  constructor() {
    this.promise = new Promise((res, rej) => {
      this.resolve = (v) => { this.done = true; res(v); };
      this.reject = (e) => { this.done = true; rej(e); };
    });
    this.promise.catch(() => undefined);
  }
}

type InFlight = { future: Deferred; startedAt: number };

class Semaphore {
  private waiters: (() => void)[] = [];
  constructor(private value: number) {}
  tryAcquire(): boolean {
    if (this.value > 0) {
      this.value -= 1;
      return true;
    }
    return false;
  }
  async acquire(): Promise<void> {
    if (this.tryAcquire()) return;
    await new Promise<void>((res) => this.waiters.push(res));
  }
  release(): void {
    const next = this.waiters.shift();
    if (next) next();
    else this.value += 1;
  }
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(23);

function monotonic(): number {
  return performance.now() / 1000;
}

function asyncSleep(seconds: number): Promise<void> {
  return new Promise((res) => setTimeout(res, seconds * 1000));
}

function waitFor<T>(p: Promise<T>, timeoutS: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new AsyncTimeoutError()), timeoutS * 1000);
    p.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

export class Dispatcher {
  registry: MiniRegistry;
  maxAttempts: number;
  private sem: Semaphore;
  private inflight = new Map<string, InFlight>();
  private cache = new Map<string, [unknown, number]>();
  private cacheTtl: number;
  private sleep: (s: number) => Promise<void>;

  constructor(
    registry: MiniRegistry,
    opts: {
      maxAttempts?: number;
      concurrency?: number;
      cacheTtlSeconds?: number;
      sleep?: (s: number) => Promise<void>;
    } = {},
  ) {
    const maxAttempts = opts.maxAttempts ?? 3;
    if (maxAttempts <= 0) throw new Error("max_attempts must be > 0");
    this.registry = registry;
    this.maxAttempts = maxAttempts;
    this.sem = new Semaphore(opts.concurrency ?? 8);
    this.cacheTtl = opts.cacheTtlSeconds ?? 60.0;
    this.sleep = opts.sleep ?? asyncSleep;
  }

  async dispatch(
    name: string,
    args: Args,
    opts: {
      timeoutMsOverride?: number;
      idempotencyKey?: string;
      budgetToolCallsRemaining?: number;
    } = {},
  ): Promise<DispatchOk | DispatchError> {
    let rec: ToolRecord;
    try {
      rec = this.registry.get(name);
    } catch {
      return new DispatchError("not_found", `tool '${name}'`, 0, ERR_METHOD_NOT_FOUND);
    }

    const errs = this.registry.validate(name, args);
    if (errs.length > 0) {
      return new DispatchError("schema", errs.join("; "), 0, ERR_INVALID_PARAMS);
    }

    const budget = opts.budgetToolCallsRemaining;
    if (budget !== undefined && budget <= 0) {
      return new DispatchError("budget_exceeded", "tool_calls remaining is 0", 0);
    }

    const key = opts.idempotencyKey;
    if (key !== undefined) {
      const now = monotonic();
      const cached = this.cache.get(key);
      if (cached !== undefined && now - cached[1] < this.cacheTtl) {
        return new DispatchOk(cached[0], 0);
      }
      const inflight = this.inflight.get(key);
      if (inflight !== undefined) {
        try {
          const res = await inflight.future.promise;
          return new DispatchOk(res, 0);
        } catch (exc) {
          return mapException(exc, 0);
        }
      }
    }

    if (!this.sem.tryAcquire()) await this.sem.acquire();
    try {
      return await this.runWithRetries(rec, args, opts.timeoutMsOverride, key);
    } finally {
      this.sem.release();
    }
  }

  private async runWithRetries(
    rec: ToolRecord,
    args: Args,
    timeoutOverride: number | undefined,
    idempotencyKey: string | undefined,
  ): Promise<DispatchOk | DispatchError> {
    const timeoutMs = timeoutOverride !== undefined ? timeoutOverride : rec.timeoutMs;
    const timeoutS = timeoutMs / 1000.0;
    let attempt = 0;
    let lastError: DispatchError | null = null;

    let future: Deferred | null = null;
    if (idempotencyKey !== undefined) {
      future = new Deferred();
      this.inflight.set(idempotencyKey, { future, startedAt: monotonic() });
    }

    try {
      while (attempt < this.maxAttempts) {
        attempt += 1;
        let result: unknown;
        try {
          result = await waitFor(invoke(rec.handler, args), timeoutS);
        } catch (exc) {
          if (exc instanceof AsyncTimeoutError) {
            lastError = new DispatchError("timeout", `timeout after ${timeoutMs}ms`, attempt);
            if (!rec.idempotent) break;
            if (attempt >= this.maxAttempts) break;
            await this.sleep(backoff(attempt));
            continue;
          }
          if (exc instanceof TransientError) {
            lastError = new DispatchError("transient", exc.message, attempt);
            if (attempt >= this.maxAttempts) break;
            await this.sleep(backoff(attempt));
            continue;
          }
          const err = mapException(exc, attempt);
          if (future !== null && !future.done) future.reject(new DispatchedError(err));
          return err;
        }
        if (future !== null && !future.done) future.resolve(result);
        if (idempotencyKey !== undefined) this.cache.set(idempotencyKey, [result, monotonic()]);
        return new DispatchOk(result, attempt);
      }

      if (lastError === null) throw new Error("AssertionError");
      if (future !== null && !future.done) future.reject(new DispatchedError(lastError));
      return lastError;
    } finally {
      if (idempotencyKey !== undefined) this.inflight.delete(idempotencyKey);
    }
  }

  async gatherBounded(calls: Iterable<[string, Args]>): Promise<(DispatchOk | DispatchError)[]> {
    return Promise.all([...calls].map(([n, a]) => this.dispatch(n, a)));
  }
}

async function invoke(handler: Handler, args: Args): Promise<unknown> {
  const result = handler(args);
  if (result instanceof Promise) return await result;
  return result;
}

function backoff(attempt: number): number {
  const base = 0.1 * 4 ** (attempt - 1);
  return base * (1 + random() * 0.5);
}

function mapException(exc: unknown, attempts: number): DispatchError {
  if (exc instanceof DispatchedError) {
    const original = exc.error;
    return new DispatchError(original.kind, original.message, original.attempts, original.jsonrpcCode);
  }
  const name = exc instanceof Error ? exc.name : "Exception";
  const msg = exc instanceof Error ? exc.message : String(exc);
  return new DispatchError("internal", `${name}: ${msg}`, attempts);
}

async function demo(): Promise<void> {
  const reg = new MiniRegistry();

  const counter = { a: 0, b: 0 };

  const flakyFetch = async (args: Args): Promise<Record<string, Json>> => {
    counter.a += 1;
    if (counter.a < 2) throw new TransientError("upstream not ready");
    return { id: args.id as number, name: "ada" };
  };

  const slow = async (args: Args): Promise<number> => {
    counter.b += 1;
    await asyncSleep(0.05);
    return args.n as number;
  };

  reg.register(
    "fetch_user",
    { type: "object", required: ["id"], properties: { id: { type: "integer" } } },
    flakyFetch, { idempotent: true, timeoutMs: 200 },
  );
  reg.register(
    "slow",
    { type: "object", required: ["n"], properties: { n: { type: "integer" } } },
    slow, { idempotent: true, timeoutMs: 10 },
  );
  reg.register(
    "noop",
    { type: "object", properties: {} },
    () => "ok",
  );

  const disp = new Dispatcher(reg, { maxAttempts: 3, concurrency: 4 });

  const outRetry = await disp.dispatch("fetch_user", { id: 42 });
  const outTimeout = await disp.dispatch("slow", { n: 1 });
  const outSchema = await disp.dispatch("fetch_user", { id: "x" });
  const outMissing = await disp.dispatch("does_not_exist", {});
  const outOk = await disp.dispatch("noop", {});

  const [a, b] = await Promise.all([
    disp.dispatch("noop", {}, { idempotencyKey: "k1" }),
    disp.dispatch("noop", {}, { idempotencyKey: "k1" }),
  ]);
  const report = {
    retry_then_success: {
      attempts: outRetry.attempts ?? null,
      ok: outRetry instanceof DispatchOk,
    },
    timeout: { kind: outTimeout instanceof DispatchError ? outTimeout.kind : null },
    schema: { kind: outSchema instanceof DispatchError ? outSchema.kind : null },
    missing: { kind: outMissing instanceof DispatchError ? outMissing.kind : null },
    happy: { result: outOk instanceof DispatchOk ? outOk.result : null },
    idempotency_pair: [a instanceof DispatchOk, b instanceof DispatchOk],
  };
  console.log(JSON.stringify(report, null, 2));
}

demo();
