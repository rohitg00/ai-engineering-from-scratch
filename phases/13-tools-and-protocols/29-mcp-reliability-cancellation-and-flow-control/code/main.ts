// Lesson: MCP Reliability, Cancellation, and Flow Control (phase 13 / lesson 29)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/13-tools-and-protocols/29-mcp-reliability-cancellation-and-flow-control/docs/en.md
// Run: npx tsx phases/13-tools-and-protocols/29-mcp-reliability-cancellation-and-flow-control/code/main.ts

import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

type Dict = Record<string, any>;
type RequestId = number | string;

const STDIO = "stdio";
const STREAMABLE_HTTP = "streamable_http";
const IN_PROGRESS = "in_progress";
const COMPLETED = "completed";
const CANCELLED = "cancelled";

class ReliabilityError extends Error {}

function isDict(value: unknown): value is Dict {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRequestId(value: unknown): value is RequestId {
  return (typeof value === "number" && Number.isInteger(value)) || typeof value === "string";
}

function pyRepr(value: unknown): string {
  if (value === null || value === undefined) return "None";
  if (value === true) return "True";
  if (value === false) return "False";
  return String(value);
}

function asciiJson(value: string | number | boolean): string {
  return JSON.stringify(value).replace(/[\u007f-\uffff]/g, (ch) => "\\u" + ch.charCodeAt(0).toString(16).padStart(4, "0"));
}

function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return asciiJson(value);
  }
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  const keys = Object.keys(value as Dict).sort();
  return "{" + keys.map((key) => `${asciiJson(key)}:${canonicalJson((value as Dict)[key])}`).join(",") + "}";
}

class InFlightRequest {
  requestId: RequestId;
  operation: string;
  transport: string;
  startedAtMs: number;
  idleTimeoutMs: number;
  maxTimeoutMs: number;
  progressToken: RequestId | null;
  lastActivityMs: number;
  lastProgress: number | null = null;
  state: string = IN_PROGRESS;
  cancelReason: string | null = null;
  response: Dict | null = null;

  constructor(
    requestId: RequestId,
    operation: string,
    transport: string,
    startedAtMs: number,
    idleTimeoutMs: number,
    maxTimeoutMs: number,
    progressToken: RequestId | null = null,
  ) {
    this.requestId = requestId;
    this.operation = operation;
    this.transport = transport;
    this.startedAtMs = startedAtMs;
    this.idleTimeoutMs = idleTimeoutMs;
    this.maxTimeoutMs = maxTimeoutMs;
    this.progressToken = progressToken;
    this.lastActivityMs = startedAtMs;
  }
}

interface StartOptions {
  transport: string;
  startedAtMs: number;
  idleTimeoutMs: number;
  maxTimeoutMs: number;
  progressToken?: RequestId | null;
}

class RequestCoordinator {
  requests: Map<RequestId, InFlightRequest> = new Map();
  events: Dict[] = [];

  private get(requestId: RequestId): InFlightRequest {
    const request = this.requests.get(requestId);
    if (request === undefined) throw new Error(`KeyError: ${requestId}`);
    return request;
  }

  start(requestId: RequestId, operation: string, options: StartOptions): InFlightRequest {
    const progressToken = options.progressToken ?? null;
    if (!isRequestId(requestId)) throw new ReliabilityError("request id must be an integer or string");
    if (progressToken !== null && !isRequestId(progressToken)) {
      throw new ReliabilityError("progress token must be an integer or string");
    }
    if (this.requests.has(requestId)) throw new ReliabilityError("request ids must be unique while tracked");
    if (options.transport !== STDIO && options.transport !== STREAMABLE_HTTP) {
      throw new ReliabilityError("unsupported transport");
    }
    if (options.idleTimeoutMs <= 0 || options.maxTimeoutMs < options.idleTimeoutMs) {
      throw new ReliabilityError("timeouts must be positive and maximum must cover idle");
    }
    const request = new InFlightRequest(
      requestId,
      operation,
      options.transport,
      options.startedAtMs,
      options.idleTimeoutMs,
      options.maxTimeoutMs,
      progressToken,
    );
    this.requests.set(requestId, request);
    return request;
  }

  progress(
    requestId: RequestId,
    value: number,
    options: { nowMs: number; total?: number | null; message?: string | null },
  ): Dict | null {
    const request = this.get(requestId);
    if (request.state !== IN_PROGRESS || request.progressToken === null) return null;
    if (request.lastProgress !== null && value <= request.lastProgress) {
      throw new ReliabilityError("progress must increase");
    }
    request.lastProgress = value;
    request.lastActivityMs = options.nowMs;
    const params: Dict = { progressToken: request.progressToken, progress: value };
    if (options.total !== undefined && options.total !== null) params["total"] = options.total;
    if (options.message !== undefined && options.message !== null) params["message"] = options.message;
    const notification = { jsonrpc: "2.0", method: "notifications/progress", params };
    this.events.push(notification);
    return notification;
  }

  timeoutSignal(requestId: RequestId, options: { nowMs: number }): Dict | null {
    const request = this.get(requestId);
    if (request.state !== IN_PROGRESS) return null;
    const hardDue = options.nowMs - request.startedAtMs >= request.maxTimeoutMs;
    const idleDue = options.nowMs - request.lastActivityMs >= request.idleTimeoutMs;
    if (!hardDue && !idleDue) return null;
    const reason = hardDue ? "maximum timeout" : "idle timeout";
    return this.clientCancelSignal(requestId, { reason });
  }

  clientCancelSignal(requestId: RequestId, options: { reason: string }): Dict {
    const request = this.get(requestId);
    if (request.transport === STDIO) {
      return {
        jsonrpc: "2.0",
        method: "notifications/cancelled",
        params: { requestId, reason: options.reason },
      };
    }
    return { action: "close_response_stream", requestId, reason: options.reason };
  }

  receiveStdioCancellation(notification: Dict): null {
    if (notification["method"] !== "notifications/cancelled") return null;
    const params = notification["params"];
    if (!isDict(params)) return null;
    const requestId = params["requestId"];
    if (!isRequestId(requestId)) return null;
    const request = this.requests.get(requestId);
    if (request === undefined || request.transport !== STDIO || request.state !== IN_PROGRESS) return null;
    request.state = CANCELLED;
    const reason = params["reason"];
    request.cancelReason = typeof reason === "string" ? reason : null;
    this.events.push({ event: "request_cancelled", requestId: request.requestId, transport: STDIO });
    return null;
  }

  closeHttpStream(requestId: RequestId, options: { reason: string }): null {
    const request = this.requests.get(requestId);
    if (request === undefined || request.transport !== STREAMABLE_HTTP) return null;
    if (request.state === IN_PROGRESS) {
      request.state = CANCELLED;
      request.cancelReason = options.reason;
      this.events.push({ event: "request_cancelled", requestId, transport: STREAMABLE_HTTP });
    }
    return null;
  }

  complete(requestId: RequestId, result: Dict): Dict | null {
    const request = this.get(requestId);
    if (request.state === CANCELLED) return null;
    if (request.state === COMPLETED) return request.response;
    const response = { jsonrpc: "2.0", id: requestId, result };
    request.state = COMPLETED;
    request.response = response;
    this.events.push(response);
    return response;
  }

  serverCancelSubscription(requestId: RequestId): Dict {
    const request = this.requests.get(requestId);
    if (request === undefined || request.transport !== STDIO || request.operation !== "subscriptions/listen") {
      throw new ReliabilityError("server-sent notifications/cancelled is reserved for stdio subscriptions/listen");
    }
    if (request.state !== IN_PROGRESS) throw new ReliabilityError("subscription request is no longer in progress");
    request.state = CANCELLED;
    return {
      jsonrpc: "2.0",
      method: "notifications/cancelled",
      params: { requestId, reason: "subscription closed by server" },
    };
  }
}

class RetryDecision {
  constructor(readonly classification: string, readonly reason: string) {}
}

function classifyRetry(options: { sideEffect: boolean; idempotencyKey: string | null }): RetryDecision {
  if (!options.sideEffect) return new RetryDecision("safe", "operation is read-only by application contract");
  if (options.idempotencyKey) {
    return new RetryDecision("conditional", "retry only with the same idempotency key and identical arguments");
  }
  return new RetryDecision("unsafe", "a new JSON-RPC id cannot deduplicate a side effect");
}

interface LedgerState {
  executions: number;
  idempotencyRecords: Record<string, { fingerprint: string; resultJson: string }>;
}

class MutationLedger {
  databasePath: string;
  private closed = false;

  constructor(databasePath: string) {
    this.databasePath = databasePath;
    if (!existsSync(this.databasePath)) {
      this.commit({ executions: 0, idempotencyRecords: {} });
    }
  }

  private load(): LedgerState {
    if (this.closed) throw new ReliabilityError("ledger is closed");
    return JSON.parse(readFileSync(this.databasePath, "utf8")) as LedgerState;
  }

  private commit(state: LedgerState): void {
    const staging = `${this.databasePath}.tmp`;
    writeFileSync(staging, JSON.stringify(state));
    renameSync(staging, this.databasePath);
  }

  close(): void {
    this.closed = true;
  }

  get executions(): number {
    const state = this.load();
    if (typeof state.executions !== "number") throw new ReliabilityError("mutation counter is missing");
    return state.executions;
  }

  static fingerprint(account: string, cents: number): string {
    const payload = canonicalJson({ account, cents });
    return createHash("sha256").update(payload, "utf8").digest("hex");
  }

  charge(
    account: string,
    cents: number,
    options: { rpcId: RequestId; idempotencyKey?: string | null },
  ): Dict {
    const idempotencyKey = options.idempotencyKey ?? null;
    if (cents <= 0) throw new ReliabilityError("charge must be positive");
    const fingerprint = MutationLedger.fingerprint(account, cents);
    const state = this.load();
    if (idempotencyKey !== null) {
      const stored = Object.hasOwn(state.idempotencyRecords, idempotencyKey)
        ? state.idempotencyRecords[idempotencyKey]
        : undefined;
      if (stored !== undefined) {
        if (stored.fingerprint !== fingerprint) {
          throw new ReliabilityError("idempotency key was reused with different arguments");
        }
        return JSON.parse(stored.resultJson);
      }
    }

    if (typeof state.executions !== "number") throw new ReliabilityError("mutation counter is missing");
    const executionNumber = state.executions + 1;
    const result = {
      receipt: `charge-${String(executionNumber).padStart(3, "0")}`,
      rpcId: options.rpcId,
      account,
      cents,
    };
    const resultJson = canonicalJson(result);
    state.executions = executionNumber;
    if (idempotencyKey !== null) {
      state.idempotencyRecords[idempotencyKey] = { fingerprint, resultJson };
    }
    this.commit(state);
    return JSON.parse(resultJson);
  }
}

class DurableTask {
  constructor(public taskId: string, public status: string = "working", public cancelRequested = false) {}
}

class DurableTaskService {
  tasks: Map<string, DurableTask> = new Map();

  private get(taskId: string): DurableTask {
    const task = this.tasks.get(taskId);
    if (task === undefined) throw new Error(`KeyError: ${taskId}`);
    return task;
  }

  create(taskId: string): DurableTask {
    const task = new DurableTask(taskId);
    this.tasks.set(taskId, task);
    return task;
  }

  cancel(taskId: string): Dict {
    const task = this.get(taskId);
    if (task.status === "working") task.cancelRequested = true;
    return { resultType: "complete" };
  }

  workerCheckpoint(taskId: string): DurableTask {
    const task = this.get(taskId);
    if (task.status === "working" && task.cancelRequested) task.status = "cancelled";
    return task;
  }

  finish(taskId: string): DurableTask {
    const task = this.get(taskId);
    if (task.status === "working") task.status = "completed";
    return task;
  }
}

class BoundedSseBuffer {
  capacity: number;
  events: Dict[] = [];
  droppedProgress = 0;
  needsRefetch = false;

  constructor(capacity: number) {
    if (capacity < 2) throw new ReliabilityError("SSE buffer capacity must be at least two");
    this.capacity = capacity;
  }

  private dropOldestProgress(): boolean {
    const index = this.events.findIndex((event) => event["kind"] === "progress");
    if (index === -1) return false;
    this.events.splice(index, 1);
    this.droppedProgress += 1;
    this.needsRefetch = true;
    return true;
  }

  pushProgress(token: RequestId, value: number): void {
    const last = this.events[this.events.length - 1];
    if (last !== undefined && last["kind"] === "progress") {
      if (last["token"] === token) {
        this.events[this.events.length - 1] = { kind: "progress", token, value };
        this.droppedProgress += 1;
        this.needsRefetch = true;
        return;
      }
    }
    if (this.events.length >= this.capacity && !this.dropOldestProgress()) {
      this.droppedProgress += 1;
      this.needsRefetch = true;
      return;
    }
    this.events.push({ kind: "progress", token, value });
  }

  pushFinal(response: Dict): void {
    while (this.events.length >= this.capacity) {
      if (!this.dropOldestProgress()) throw new ReliabilityError("buffer cannot discard a final response");
    }
    this.events.push({ kind: "final", response });
  }

  drain(): Dict[] {
    const drained = [...this.events];
    this.events.length = 0;
    return drained;
  }
}

function sseResponseHeaders(): Record<string, string> {
  return { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "X-Accel-Buffering": "no" };
}

function sseKeepalive(): string {
  return ":\r\n";
}

function reconnectPlan(
  previousSubscriptionId: RequestId,
  affectedResources: string[],
  options: { unsafeMutationWasInFlight: boolean },
): Dict {
  return {
    newSubscriptionId: `${previousSubscriptionId}-retry`,
    sendLastEventId: false,
    refetch: [...new Set(affectedResources)].sort(),
    retryUnsafeMutation: !options.unsafeMutationWasInFlight,
  };
}

function retryDelayMs(clientId: string, attempt: number): number {
  if (attempt < 0) throw new ReliabilityError("attempt must be non-negative");
  const ceiling = Math.min(8_000, 250 * 2 ** attempt);
  const floor = Math.max(1, Math.floor(ceiling / 2));
  const hash = createHash("sha256").update(`${clientId}:${attempt}`, "utf8").digest();
  const jitter = hash.readUInt32BE(0) % Math.max(1, ceiling - floor + 1);
  return floor + jitter;
}

function main(): void {
  const coordinator = new RequestCoordinator();
  coordinator.start(7, "tools/call", {
    transport: STDIO,
    startedAtMs: 0,
    idleTimeoutMs: 500,
    maxTimeoutMs: 2_000,
    progressToken: "progress-7",
  });
  coordinator.progress(7, 1, { nowMs: 100, total: 3, message: "started" });
  const signal = coordinator.timeoutSignal(7, { nowMs: 600 });
  coordinator.receiveStdioCancellation(signal!);
  const cancelledResponse = coordinator.complete(7, { resultType: "complete" });

  coordinator.start(8, "tools/call", { transport: STDIO, startedAtMs: 0, idleTimeoutMs: 500, maxTimeoutMs: 2_000 });
  const completedResponse = coordinator.complete(8, { resultType: "complete" });
  const lateSignal = coordinator.clientCancelSignal(8, { reason: "late user action" });
  coordinator.receiveStdioCancellation(lateSignal);

  const directory = mkdtempSync(join(tmpdir(), "mcp-ledger-"));
  let firstCharge: Dict;
  let secondCharge: Dict;
  let mutationExecutions: number;
  try {
    const ledger = new MutationLedger(join(directory, "mutations.json"));
    try {
      firstCharge = ledger.charge("acct-7", 1200, { rpcId: 41, idempotencyKey: "checkout-7" });
      secondCharge = ledger.charge("acct-7", 1200, { rpcId: 42, idempotencyKey: "checkout-7" });
      mutationExecutions = ledger.executions;
    } finally {
      ledger.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }

  const buffer = new BoundedSseBuffer(3);
  for (let value = 0; value < 6; value++) buffer.pushProgress("progress-9", value);
  buffer.pushFinal({ jsonrpc: "2.0", id: 9, result: { resultType: "complete" } });

  const tasks = new DurableTaskService();
  tasks.create("task-29");
  const taskAck = tasks.cancel("task-29");
  const beforeCheckpoint = tasks.tasks.get("task-29")!.status;
  const afterCheckpoint = tasks.workerCheckpoint("task-29").status;

  console.log("cancel before completion returns:", pyRepr(cancelledResponse));
  console.log("complete before cancel keeps response:", pyRepr(completedResponse !== null));
  console.log("idempotent receipts equal:", pyRepr(firstCharge["receipt"] === secondCharge["receipt"]));
  console.log("mutation executions:", String(mutationExecutions));
  console.log("buffer size and dropped progress:", String(buffer.events.length), String(buffer.droppedProgress));
  console.log("final response preserved:", pyRepr(buffer.events.some((event) => event["kind"] === "final")));
  console.log("task cancel acknowledgement:", taskAck["resultType"]);
  console.log("task status before and after worker checkpoint:", beforeCheckpoint, afterCheckpoint);
}

export { classifyRetry, sseResponseHeaders, sseKeepalive, reconnectPlan, retryDelayMs };

main();
