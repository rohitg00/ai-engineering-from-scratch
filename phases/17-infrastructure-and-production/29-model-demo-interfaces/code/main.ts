// Lesson: Model Demo Interfaces, From a Function to a Shareable App (phase 17 / lesson 29)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/17-infrastructure-and-production/29-model-demo-interfaces/docs/en.md
// Run: npx tsx phases/17-infrastructure-and-production/29-model-demo-interfaces/code/main.ts

import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { createServer, request as httpRequestRaw } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { performance } from "node:perf_hooks";

const MAX_CHARS = 500;
const MAX_BODY_BYTES = 4096;
const DRAIN_LIMIT_BYTES = 65536;
const BUCKET_CAPACITY = 5;
const REFILL_PER_SECOND = 0.5;
const DAILY_CALL_CAP = 2000;
const SERVE_TOKEN_DELAY = 0.04;

const EXAMPLES: readonly string[] = [
  "The battery lasts all day and the screen is bright.",
  "The update broke my login and support never replied.",
  "The package arrived on Tuesday.",
];

const POSITIVE: ReadonlySet<string> = new Set([
  "good", "great", "love", "excellent", "fast", "bright", "lasts",
  "happy", "easy", "works", "helpful", "clear", "reliable",
]);
const NEGATIVE: ReadonlySet<string> = new Set([
  "bad", "broke", "broken", "slow", "never", "hate", "poor",
  "crash", "crashes", "late", "worst", "confusing", "lost",
]);

const WORD_RE = /[a-z']+/g;
const CONTROL_RE = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/;

type Classification = {
  label: string;
  score: number;
  positive_cues: number;
  negative_cues: number;
  words: number;
};

type Headers = Record<string, string>;

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function classify(text: string): Classification {
  const words = text.toLowerCase().match(WORD_RE) ?? [];
  const positive = words.filter((word) => POSITIVE.has(word)).length;
  const negative = words.filter((word) => NEGATIVE.has(word)).length;
  const score = (positive - negative) / Math.max(1, positive + negative);
  let label: string;
  if (score > 0) {
    label = "positive";
  } else if (score < 0) {
    label = "negative";
  } else {
    label = "neutral";
  }
  return {
    label,
    score: round(score, 3),
    positive_cues: positive,
    negative_cues: negative,
    words: words.length,
  };
}

function* generate(text: string): Generator<string> {
  const result = classify(text);
  const reply =
    `Label: ${result.label}. Positive cues: ${result.positive_cues}. ` +
    `Negative cues: ${result.negative_cues}. Words read: ${result.words}.`;
  const parts = reply.split(" ");
  yield parts[0];
  for (const part of parts.slice(1)) {
    yield " " + part;
  }
}

function predict(text: string): { label: string; score: number; reply: string } {
  const result = classify(text);
  return { label: result.label, score: result.score, reply: [...generate(text)].join("") };
}

class DemoError extends Error {
  status: number;
  code: string;
  hint: string;
  headers: Headers;

  constructor(status: number, code: string, message: string, hint: string, headers: Headers | null = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.hint = hint;
    this.headers = { ...(headers ?? {}) };
  }
}

function errorBody(err: DemoError, requestId: string): { error: Record<string, string> } {
  return {
    error: {
      code: err.code,
      message: err.message,
      hint: err.hint,
      request_id: requestId,
    },
  };
}

function checkBodySize(contentLength: string | undefined, maxBytes: number = MAX_BODY_BYTES): number {
  if (contentLength === undefined) {
    throw new DemoError(411, "length_required", "The request has no Content-Length header.",
      "Send the body with a Content-Length header. Browsers add it for you.");
  }
  const trimmed = contentLength.trim();
  let size = /^[+-]?\d+$/.test(trimmed) ? Number(trimmed) : -1;
  if (Number.isNaN(size)) {
    size = -1;
  }
  if (size < 0) {
    throw new DemoError(400, "bad_length", "The Content-Length header is not a valid number.",
      "Send a whole number of bytes in Content-Length.");
  }
  if (size > maxBytes) {
    throw new DemoError(413, "body_too_large", `The request body has ${size} bytes. The limit is ${maxBytes} bytes.`,
      "Send a shorter text.");
  }
  return size;
}

function parseJsonBody(contentType: string | undefined, raw: Buffer): Record<string, unknown> {
  const mediaType = (contentType ?? "").split(";")[0].trim().toLowerCase();
  if (mediaType !== "application/json") {
    throw new DemoError(415, "unsupported_media_type", "The request body is not JSON.",
      "Send the body with Content-Type: application/json.");
  }
  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw));
  } catch {
    throw new DemoError(400, "bad_json", "The request body is not valid JSON.",
      'Send an object such as {"text": "The screen is bright."}.');
  }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new DemoError(400, "bad_json", "The JSON body is not an object.",
      'Send an object such as {"text": "The screen is bright."}.');
  }
  return payload as Record<string, unknown>;
}

function charCount(text: string): number {
  return [...text].length;
}

function validateText(payload: Record<string, unknown>, maxChars: number = MAX_CHARS): string {
  if (!("text" in payload)) {
    throw new DemoError(422, "missing_text", 'The field "text" is missing.', 'Add a "text" field with your input.');
  }
  const raw = payload["text"];
  if (typeof raw !== "string") {
    throw new DemoError(422, "text_not_string", 'The field "text" is not a string.', "Send the input as a string.");
  }
  const text = raw.trim();
  if (!text) {
    throw new DemoError(422, "empty_text", "The text is empty.", "Type a sentence or pick an example.");
  }
  if (charCount(text) > maxChars) {
    throw new DemoError(422, "text_too_long", `The text has ${charCount(text)} characters. The limit is ${maxChars}.`,
      `Shorten the text to ${maxChars} characters or fewer.`);
  }
  if (CONTROL_RE.test(text)) {
    throw new DemoError(422, "control_characters", "The text contains control characters.",
      "Remove the hidden characters, then send the text again.");
  }
  return text;
}

type Clock = () => number;

class FakeClock {
  now: number;

  constructor(start: number = 1000.0) {
    this.now = start;
  }

  call(): number {
    return this.now;
  }

  advance(seconds: number): void {
    this.now += seconds;
  }
}

const monotonic: Clock = () => performance.now() / 1000;
const wallTime: Clock = () => Date.now() / 1000;

class TokenBucket {
  capacity: number;
  refillPerSecond: number;
  tokens: number;
  updated: number;

  constructor(capacity: number, refillPerSecond: number, now: number) {
    if (capacity < 1) {
      throw new Error("capacity must be at least 1");
    }
    if (refillPerSecond <= 0) {
      throw new Error("refill_per_second must be positive");
    }
    this.capacity = capacity;
    this.refillPerSecond = refillPerSecond;
    this.tokens = capacity;
    this.updated = now;
  }

  take(now: number, cost: number = 1.0): number {
    const elapsed = Math.max(0.0, now - this.updated);
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerSecond);
    this.updated = now;
    if (this.tokens >= cost) {
      this.tokens -= cost;
      return 0.0;
    }
    return (cost - this.tokens) / this.refillPerSecond;
  }
}

class RateLimiter {
  capacity: number;
  refillPerSecond: number;
  clock: Clock;
  maxClients: number;
  buckets: Map<string, TokenBucket> = new Map();

  constructor(capacity: number, refillPerSecond: number, clock: Clock = monotonic, maxClients: number = 10000) {
    new TokenBucket(capacity, refillPerSecond, 0.0);
    this.capacity = capacity;
    this.refillPerSecond = refillPerSecond;
    this.clock = clock;
    this.maxClients = maxClients;
  }

  check(clientId: string): number {
    const now = this.clock();
    let bucket = this.buckets.get(clientId);
    this.buckets.delete(clientId);
    if (bucket === undefined) {
      bucket = new TokenBucket(this.capacity, this.refillPerSecond, now);
    }
    this.buckets.set(clientId, bucket);
    while (this.buckets.size > this.maxClients) {
      const oldest = this.buckets.keys().next().value;
      if (oldest === undefined) {
        break;
      }
      this.buckets.delete(oldest);
    }
    return bucket.take(now);
  }
}

class UsageCap {
  maxCalls: number;
  windowSeconds: number;
  clock: Clock;
  window: number | null = null;
  used = 0;

  constructor(maxCalls: number, windowSeconds: number = 86400.0, clock: Clock = wallTime) {
    this.maxCalls = maxCalls;
    this.windowSeconds = windowSeconds;
    this.clock = clock;
  }

  spend(): number {
    const now = this.clock();
    const window = Math.floor(now / this.windowSeconds);
    if (window !== this.window) {
      this.window = window;
      this.used = 0;
    }
    if (this.used >= this.maxCalls) {
      return (window + 1) * this.windowSeconds - now;
    }
    this.used += 1;
    return 0.0;
  }
}

function plural(count: number, word: string): string {
  return count === 1 ? `${count} ${word}` : `${count} ${word}s`;
}

function compareDigest(a: string, b: string): boolean {
  const left = createHash("sha256").update(a, "utf8").digest();
  const right = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(left, right) && a === b;
}

function checkAuth(authorization: string | undefined, expectedToken: string | null): void {
  if (!expectedToken) {
    return;
  }
  const prefix = "Bearer ";
  const supplied = authorization && authorization.startsWith(prefix) ? authorization.slice(prefix.length) : "";
  if (!compareDigest(supplied, expectedToken)) {
    throw new DemoError(401, "unauthorized", "The access token is missing or wrong.",
      "Paste the access token that the demo owner gave you.",
      { "WWW-Authenticate": 'Bearer realm="demo"' });
  }
}

function sseEvent(event: string, data: object): Buffer {
  const payload = JSON.stringify(data);
  return Buffer.from(`event: ${event}\ndata: ${payload}\n\n`, "utf8");
}

function parseSse(raw: Buffer): Array<[string, Record<string, unknown>]> {
  const events: Array<[string, Record<string, unknown>]> = [];
  for (const block of raw.toString("utf8").split("\n\n")) {
    if (!block.trim()) {
      continue;
    }
    let name = "message";
    const dataLines: string[] = [];
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) {
        name = line.slice("event:".length).trim();
      } else if (line.startsWith("data:")) {
        const value = line.slice("data:".length);
        dataLines.push(value.startsWith(" ") ? value.slice(1) : value);
      }
    }
    events.push([name, JSON.parse(dataLines.join("\n")) as Record<string, unknown>]);
  }
  return events;
}

const MODEL_ERROR = {
  code: "model_error",
  message: "The model stopped before it finished the reply.",
  hint: "Send the text again. If it fails again, try a shorter text.",
};

function sleepSeconds(seconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

async function* streamEvents(
  text: string,
  generateFn: (text: string) => Iterable<string> = generate,
  delay: number = 0.0,
  sleep: (seconds: number) => Promise<void> = sleepSeconds,
): AsyncGenerator<Buffer> {
  let count = 0;
  try {
    for (const token of generateFn(text)) {
      yield sseEvent("token", { index: count, text: token });
      count += 1;
      if (delay) {
        await sleep(delay);
      }
    }
  } catch {
    yield sseEvent("error", MODEL_ERROR);
    return;
  }
  const result = classify(text);
  yield sseEvent("done", { label: result.label, score: result.score, tokens: count });
}

function pyLogLine(entry: LogEntry): string {
  const parts = Object.entries(entry).map(([key, value]) => {
    let text: string;
    if (typeof value === "number") {
      text = key === "latency_ms" && Number.isInteger(value) ? value.toFixed(1) : String(value);
    } else {
      text = JSON.stringify(value).replace(/[\u0080-\uffff]/g, (ch) => "\\u" + ch.charCodeAt(0).toString(16).padStart(4, "0"));
    }
    return `${JSON.stringify(key)}: ${text}`;
  });
  return `{${parts.join(", ")}}`;
}

type LogEntry = {
  ts: number;
  request_id: string;
  route: string;
  client: string;
  status: number;
  code: string | null;
  input_chars: number;
  latency_ms: number;
};

class PrivacyLog {
  salt: Buffer;
  keep: number;
  records: LogEntry[] = [];
  sink: ((line: string) => void) | null;

  constructor(salt: Buffer | null = null, keep: number = 1000, sink: ((line: string) => void) | null = null) {
    this.salt = salt && salt.length ? salt : randomBytes(16);
    this.keep = keep;
    this.sink = sink;
  }

  pseudonym(clientId: string): string {
    return createHmac("sha256", this.salt).update(clientId, "utf8").digest("hex").slice(0, 12);
  }

  record(requestId: string, route: string, clientId: string, status: number,
    inputChars: number, latencyMs: number, code: string | null = null): LogEntry {
    const entry: LogEntry = {
      ts: round(Date.now() / 1000, 3),
      request_id: requestId,
      route,
      client: this.pseudonym(clientId),
      status,
      code,
      input_chars: inputChars,
      latency_ms: round(latencyMs, 1),
    };
    this.records.push(entry);
    while (this.records.length > this.keep) {
      this.records.shift();
    }
    if (this.sink) {
      this.sink(pyLogLine(entry));
    }
    return entry;
  }
}

type DemoConfig = {
  max_chars: number;
  max_body_bytes: number;
  bucket_capacity: number;
  refill_per_second: number;
  daily_call_cap: number;
  token_delay: number;
  access_token: string | null;
};

function demoConfig(overrides: Partial<DemoConfig> = {}): DemoConfig {
  return {
    max_chars: MAX_CHARS,
    max_body_bytes: MAX_BODY_BYTES,
    bucket_capacity: BUCKET_CAPACITY,
    refill_per_second: REFILL_PER_SECOND,
    daily_call_cap: DAILY_CALL_CAP,
    token_delay: 0.0,
    access_token: null,
    ...overrides,
  };
}

class DemoApp {
  config: DemoConfig;
  limiter: RateLimiter;
  cap: UsageCap;
  log: PrivacyLog;

  constructor(config: DemoConfig | null = null, clock: Clock = monotonic, wallClock: Clock = wallTime,
    logSink: ((line: string) => void) | null = null) {
    this.config = config ?? demoConfig();
    this.limiter = new RateLimiter(this.config.bucket_capacity, this.config.refill_per_second, clock);
    this.cap = new UsageCap(this.config.daily_call_cap, 86400.0, wallClock);
    this.log = new PrivacyLog(null, 1000, logSink);
  }

  admit(clientId: string, authorization: string | undefined): void {
    checkAuth(authorization, this.config.access_token);
    const wait = this.limiter.check(clientId);
    if (wait > 0) {
      const seconds = Math.max(1, Math.ceil(wait));
      throw new DemoError(429, "rate_limited", "You sent too many requests in a short time.",
        `Wait ${plural(seconds, "second")}, then try again.`, { "Retry-After": String(seconds) });
    }
  }

  readText(contentType: string | undefined, body: Buffer): string {
    return validateText(parseJsonBody(contentType, body), this.config.max_chars);
  }

  charge(): void {
    const wait = this.cap.spend();
    if (wait > 0) {
      const seconds = Math.max(1, Math.ceil(wait));
      const hours = Math.max(1, Math.ceil(seconds / 3600));
      throw new DemoError(503, "usage_cap_reached", "The demo reached its usage limit for today.",
        `Try again in about ${plural(hours, "hour")}.`, { "Retry-After": String(seconds) });
    }
  }
}

const PAGE_STYLE = `
:root{color-scheme:light dark;--ink:#1a1a1a;--mute:#666;--line:#ccc;--accent:#3553ff;--warn:#b8870f;--bg:#fafaf5}
@media (prefers-color-scheme:dark){:root{--ink:#eee;--mute:#aaa;--line:#444;--accent:#8fa2ff;--warn:#e0b44a;--bg:#16161a}}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,sans-serif}
main{max-width:640px;margin:0 auto;padding:24px 16px}
textarea,input[type=password]{width:100%;box-sizing:border-box;font:inherit;padding:8px;border:1px solid var(--line);background:transparent;color:inherit}
.row,.examples{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0;color:var(--mute);font-size:14px}
.row{justify-content:space-between}
button{font:inherit;padding:6px 12px;border:1px solid var(--accent);background:transparent;color:var(--accent);cursor:pointer}
button[type=submit]{background:var(--accent);color:var(--bg)}
button:disabled{opacity:.5;cursor:default}
#status[data-kind=error]{color:var(--warn)}
#output{white-space:pre-wrap;border:1px solid var(--line);padding:12px;min-height:3em}
.note{color:var(--mute);font-size:14px}
`;

const PAGE_SCRIPT = `
const form = document.getElementById("demo-form");
const input = document.getElementById("text");
const counter = document.getElementById("count");
const statusLine = document.getElementById("status");
const output = document.getElementById("output");
const labelLine = document.getElementById("label");
const runButton = document.getElementById("run");
const streamBox = document.getElementById("stream");
const tokenBox = document.getElementById("token");
const maxChars = Number(input.getAttribute("maxlength"));
let timer = null;
let blockedUntil = 0;

function updateCount() { counter.textContent = input.value.length + " / " + maxChars; }

function setStatus(text, kind) { statusLine.textContent = text; statusLine.dataset.kind = kind; }

function startTimer(started) {
  timer = setInterval(function () {
    setStatus("Running the model: " + ((performance.now() - started) / 1000).toFixed(1) + " s", "busy");
  }, 100);
}

function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }

function showError(err) {
  stopTimer();
  setStatus(err.message + " " + err.hint + " (request " + err.request_id + ")", "error");
}

function requestHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (tokenBox && tokenBox.value) { headers["Authorization"] = "Bearer " + tokenBox.value; }
  return headers;
}

async function readError(response) {
  const retry = Number(response.headers.get("Retry-After") || 0);
  if (retry > 0) { blockedUntil = Date.now() + retry * 1000; setTimeout(function () { runButton.disabled = false; }, retry * 1000); }
  try {
    const body = await response.json();
    return body.error;
  } catch (e) {
    return { message: "The server returned status " + response.status + ".", hint: "Try again in a moment.", request_id: response.headers.get("X-Request-Id") || "unknown" };
  }
}

function parseFrame(frame) {
  let event = "message";
  const data = [];
  frame.split("\\n").forEach(function (line) {
    if (line.startsWith("event:")) { event = line.slice(6).trim(); }
    else if (line.startsWith("data:")) { data.push(line.slice(5).replace(/^ /, "")); }
  });
  return { event: event, data: JSON.parse(data.join("\\n")) };
}

async function runPlain(text, started) {
  const response = await fetch("/api/predict", { method: "POST", headers: requestHeaders(), body: JSON.stringify({ text: text }) });
  if (!response.ok) { showError(await readError(response)); return; }
  const body = await response.json();
  stopTimer();
  output.textContent = body.reply;
  labelLine.textContent = "Label: " + body.label + " (score " + body.score + ")";
  setStatus("Done in " + (performance.now() - started).toFixed(0) + " ms.", "done");
}

async function runStream(text, started) {
  const response = await fetch("/api/stream", { method: "POST", headers: requestHeaders(), body: JSON.stringify({ text: text }) });
  if (!response.ok) { showError(await readError(response)); return; }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let first = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) { break; }
    buffer += decoder.decode(chunk.value, { stream: true });
    let cut = buffer.indexOf("\\n\\n");
    while (cut >= 0) {
      const frame = parseFrame(buffer.slice(0, cut));
      buffer = buffer.slice(cut + 2);
      cut = buffer.indexOf("\\n\\n");
      if (frame.event === "token") {
        if (!first) { first = performance.now() - started; stopTimer(); setStatus("First token after " + first.toFixed(0) + " ms. Receiving tokens.", "busy"); }
        output.textContent += frame.data.text;
      } else if (frame.event === "done") {
        labelLine.textContent = "Label: " + frame.data.label + " (score " + frame.data.score + ")";
        setStatus("Done. First token " + first.toFixed(0) + " ms. Total " + (performance.now() - started).toFixed(0) + " ms.", "done");
      } else if (frame.event === "error") {
        showError(Object.assign({ request_id: response.headers.get("X-Request-Id") || "unknown" }, frame.data));
      }
    }
  }
}

input.addEventListener("input", updateCount);
document.querySelectorAll("[data-example]").forEach(function (button) {
  button.addEventListener("click", function () { input.value = button.dataset.example; updateCount(); input.focus(); });
});

form.addEventListener("submit", async function (event) {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) { showError({ message: "The text is empty.", hint: "Type a sentence or pick an example.", request_id: "none" }); return; }
  runButton.disabled = true;
  output.textContent = "";
  labelLine.textContent = "";
  const started = performance.now();
  startTimer(started);
  try {
    if (streamBox.checked) { await runStream(text, started); } else { await runPlain(text, started); }
  } catch (e) {
    showError({ message: "The request did not reach the server.", hint: "Check the connection, then try again.", request_id: "none" });
  } finally {
    stopTimer();
    runButton.disabled = Date.now() < blockedUntil;
  }
});

updateCount();
`;

const PAGE_TEMPLATE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Toy sentiment demo</title>
<style>__STYLE__</style>
</head>
<body>
<main>
<h1>Toy sentiment demo</h1>
<p class="note">A small keyword model labels your text. Do not paste private data. The server keeps only the length of your text, never the text.</p>
<form id="demo-form">
<label for="text">Text to label</label>
<textarea id="text" name="text" rows="5" maxlength="__MAX__" required placeholder="Type a sentence, or pick an example."></textarea>
<div class="row"><span id="count">0 / __MAX__</span><label><input type="checkbox" id="stream" checked> Show tokens as they arrive</label></div>
__TOKEN_FIELD__
<div class="examples"><span>Examples:</span>__EXAMPLES__</div>
<button id="run" type="submit">Run model</button>
</form>
<h2>Result</h2>
<p id="status" role="status" aria-live="polite">Ready.</p>
<p id="label"></p>
<pre id="output"></pre>
</main>
<script>__SCRIPT__</script>
</body>
</html>
`;

const TOKEN_FIELD = '<label for="token">Access token</label><input id="token" type="password" autocomplete="off">';

function cspHash(source: string): string {
  const digest = createHash("sha256").update(source, "utf8").digest();
  return "'sha256-" + digest.toString("base64") + "'";
}

const CONTENT_SECURITY_POLICY =
  `default-src 'none'; script-src ${cspHash(PAGE_SCRIPT)}; style-src ${cspHash(PAGE_STYLE)}; ` +
  "connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function renderPage(config: DemoConfig): string {
  const buttons = EXAMPLES.map(
    (text, i) => `<button type="button" data-example="${escapeHtml(text)}">Example ${i + 1}</button>`,
  ).join("");
  return PAGE_TEMPLATE
    .replace("__STYLE__", () => PAGE_STYLE)
    .replace("__SCRIPT__", () => PAGE_SCRIPT)
    .replaceAll("__MAX__", String(config.max_chars))
    .replace("__TOKEN_FIELD__", config.access_token ? TOKEN_FIELD : "")
    .replace("__EXAMPLES__", () => buttons);
}

const SERVER_VERSION = "ModelDemo/1.0";
const ROUTES: readonly string[] = ["/api/predict", "/api/stream"];
const REQUEST_TIMEOUT_SECONDS = 10;

function sendBytes(res: ServerResponse, status: number, body: Buffer, contentType: string, requestId: string,
  extra: Headers | null = null): void {
  res.statusCode = status;
  res.setHeader("Server", SERVER_VERSION);
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Length", String(body.length));
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Request-Id", requestId);
  for (const [name, value] of Object.entries(extra ?? {})) {
    res.setHeader(name, value);
  }
  res.end(body);
}

function sendJson(res: ServerResponse, status: number, payload: object, requestId: string,
  extra: Headers | null = null): void {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  sendBytes(res, status, body, "application/json; charset=utf-8", requestId, extra);
}

function sendErrorJson(res: ServerResponse, err: DemoError, requestId: string): void {
  sendJson(res, err.status, errorBody(err, requestId), requestId, err.headers);
}

function newRequestId(): string {
  return randomUUID().replace(/-/g, "").slice(0, 12);
}

function doGet(app: DemoApp, req: IncomingMessage, res: ServerResponse): void {
  const requestId = newRequestId();
  if (req.url === "/") {
    const page = Buffer.from(renderPage(app.config), "utf8");
    sendBytes(res, 200, page, "text/html; charset=utf-8", requestId,
      { "Content-Security-Policy": CONTENT_SECURITY_POLICY });
  } else if (req.url === "/healthz") {
    sendJson(res, 200, { ok: true }, requestId);
  } else {
    sendErrorJson(res, new DemoError(404, "not_found", "This page does not exist.", "Open / to use the demo."),
      requestId);
  }
}

function drain(req: IncomingMessage, res: ServerResponse, declared: number): void {
  let remaining = Math.min(Math.max(declared, 0), DRAIN_LIMIT_BYTES);
  if (declared > DRAIN_LIMIT_BYTES) {
    res.setHeader("Connection", "close");
  }
  req.on("data", (chunk: Buffer) => {
    remaining -= chunk.length;
    if (remaining <= 0 && declared > DRAIN_LIMIT_BYTES) {
      req.pause();
    }
  });
  req.resume();
}

function readBody(req: IncomingMessage, size: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let received = 0;
    const timer = setTimeout(() => {
      const err = new Error("timed out");
      err.name = "TimeoutError";
      reject(err);
    }, REQUEST_TIMEOUT_SECONDS * 1000);
    req.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
      received += chunk.length;
    });
    req.on("end", () => {
      clearTimeout(timer);
      resolve(Buffer.concat(chunks).subarray(0, Math.min(size, received)));
    });
    req.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function isTimeout(err: unknown): boolean {
  return err instanceof Error && err.name === "TimeoutError";
}

async function sendStream(app: DemoApp, res: ServerResponse, text: string, requestId: string): Promise<string | null> {
  res.statusCode = 200;
  res.setHeader("Server", SERVER_VERSION);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Request-Id", requestId);
  let closed = false;
  res.on("close", () => {
    closed = true;
  });
  res.flushHeaders();
  const events = streamEvents(text, generate, app.config.token_delay);
  for await (const frame of events) {
    if (closed || res.destroyed) {
      await events.return(undefined);
      return "client_closed";
    }
    res.write(frame);
  }
  res.end();
  return null;
}

async function doPost(app: DemoApp, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const requestId = newRequestId();
  const clientId = req.socket.remoteAddress ?? "unknown";
  const started = performance.now();
  const route = ROUTES.includes(req.url ?? "") ? (req.url as string) : "other";
  let status = 200;
  let code: string | null = null;
  let chars = 0;
  try {
    const declared = req.headers["content-length"];
    let size: number;
    try {
      if (route === "other") {
        throw new DemoError(404, "not_found", "This endpoint does not exist.",
          "Send requests to /api/predict or /api/stream.");
      }
      size = checkBodySize(declared, app.config.max_body_bytes);
    } catch (err) {
      if (err instanceof DemoError) {
        drain(req, res, declared && /^\d+$/.test(declared) ? Number(declared) : 0);
      }
      throw err;
    }
    let body: Buffer;
    try {
      body = await readBody(req, size);
    } catch (err) {
      if (isTimeout(err)) {
        res.setHeader("Connection", "close");
        throw new DemoError(408, "request_timeout", "The request body did not arrive in time.",
          "Send the request again with the full body.");
      }
      throw err;
    }
    app.admit(clientId, req.headers["authorization"]);
    const text = app.readText(req.headers["content-type"], body);
    chars = charCount(text);
    app.charge();
    if (route === "/api/predict") {
      sendJson(res, 200, predict(text), requestId);
    } else {
      code = await sendStream(app, res, text, requestId);
    }
  } catch (err) {
    if (err instanceof DemoError) {
      status = err.status;
      code = err.code;
      sendErrorJson(res, err, requestId);
    } else if (isTimeout(err)) {
      status = 408;
      code = "request_timeout";
      res.destroy();
    } else {
      status = 500;
      code = "internal_error";
      sendErrorJson(res, new DemoError(500, "internal_error", "The server failed on this request.",
        "Try again. Quote the request id if you report the problem."), requestId);
    }
  } finally {
    const latencyMs = performance.now() - started;
    app.log.record(requestId, route, clientId, status, chars, latencyMs, code);
  }
}

function createDemoServer(app: DemoApp): Server {
  const server = createServer((req, res) => {
    res.on("error", () => {});
    if (req.method === "GET") {
      doGet(app, req, res);
    } else if (req.method === "POST") {
      void doPost(app, req, res);
    } else {
      res.statusCode = 501;
      res.setHeader("Server", SERVER_VERSION);
      res.end();
    }
  });
  server.requestTimeout = REQUEST_TIMEOUT_SECONDS * 1000;
  return server;
}

function startBackgroundServer(app: DemoApp, host: string = "127.0.0.1", port: number = 0): Promise<Server> {
  const server = createDemoServer(app);
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve(server));
  });
}

function stopServer(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve());
    server.closeAllConnections();
  });
}

function httpRequest(url: string, method: string = "GET", payload: object | null = null,
  headers: Headers | null = null, timeout: number = 5.0): Promise<[number, Headers, Buffer]> {
  let data: Buffer | null = null;
  const merged: Headers = { ...(headers ?? {}) };
  if (payload !== null) {
    data = Buffer.from(JSON.stringify(payload), "utf8");
    if (!("Content-Type" in merged)) {
      merged["Content-Type"] = "application/json";
    }
    merged["Content-Length"] = String(data.length);
  }
  return new Promise((resolve, reject) => {
    const req = httpRequestRaw(url, { method, headers: merged, agent: false, timeout: timeout * 1000 }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        const flat: Headers = {};
        for (let i = 0; i < res.rawHeaders.length; i += 2) {
          flat[res.rawHeaders[i]] = res.rawHeaders[i + 1];
        }
        resolve([res.statusCode ?? 0, flat, Buffer.concat(chunks)]);
      });
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new Error("timed out")));
    req.on("error", reject);
    if (data !== null) {
      req.write(data);
    }
    req.end();
  });
}

async function runSelftest(): Promise<number> {
  const results: boolean[] = [];

  const check = (name: string, ok: boolean): void => {
    results.push(ok);
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  };

  const errorCode = (fn: () => unknown): string | null => {
    try {
      fn();
    } catch (err) {
      if (err instanceof DemoError) {
        return err.code;
      }
      throw err;
    }
    return null;
  };

  check("validator strips and accepts normal text", validateText({ text: "  works well  " }) === "works well");
  check("validator rejects empty text", errorCode(() => validateText({ text: "   " })) === "empty_text");
  check("validator rejects text over the limit", errorCode(() => validateText({ text: "a".repeat(501) })) === "text_too_long");
  check("body check rejects a large body", errorCode(() => checkBodySize("9000")) === "body_too_large");

  const clock = new FakeClock();
  const limiter = new RateLimiter(2, 1.0, () => clock.call());
  const waits = [0, 1, 2].map(() => limiter.check("client-a"));
  clock.advance(1.0);
  check("token bucket allows a burst of 2, then rejects", waits[0] === 0.0 && waits[1] === 0.0 && waits[2] > 0);
  check("token bucket refills after one second", limiter.check("client-a") === 0.0);

  const frames: Buffer[] = [];
  for await (const frame of streamEvents(EXAMPLES[0])) {
    frames.push(frame);
  }
  const events = parseSse(Buffer.concat(frames));
  const reply = events.filter(([name]) => name === "token").map(([, data]) => String(data["text"])).join("");
  check("stream ends with a done event", events[events.length - 1][0] === "done");
  check("streamed tokens equal the full reply", reply === predict(EXAMPLES[0]).reply);

  const body = errorBody(new DemoError(429, "rate_limited", "Too many.", "Wait."), "abc123");
  const keys = Object.keys(body.error).sort().join(",");
  check("error body has code, message, hint, request_id", keys === "code,hint,message,request_id");

  const server = await startBackgroundServer(new DemoApp(demoConfig({ bucket_capacity: 2 })));
  try {
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    let [status, headers, raw] = await httpRequest(base + "/api/predict", "POST", { text: EXAMPLES[1] });
    check("HTTP predict returns 200 and a label", status === 200 && JSON.parse(raw.toString("utf8"))["label"] === "negative");
    [status, headers, raw] = await httpRequest(base + "/api/stream", "POST", { text: EXAMPLES[2] });
    check("HTTP stream returns text/event-stream", status === 200 && (headers["Content-Type"] ?? "").startsWith("text/event-stream"));
    [status, headers, raw] = await httpRequest(base + "/api/predict", "POST", { text: "x" });
    check("third request in a burst of 2 gets 429 and Retry-After", status === 429 && "Retry-After" in headers);
  } finally {
    await stopServer(server);
  }
  check("server thread stopped", !server.listening);

  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  console.log("Start the demo with: npx tsx code/main.ts --serve");
  return passed === results.length ? 0 : 1;
}

function serve(host: string, port: number): Promise<number> {
  const config = demoConfig({ token_delay: SERVE_TOKEN_DELAY, access_token: process.env["DEMO_ACCESS_TOKEN"] || null });
  const app = new DemoApp(config, monotonic, wallTime, (line) => console.error(line));
  const server = createDemoServer(app);
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      console.log(`Serving the demo on http://${host}:${(server.address() as AddressInfo).port}  (Ctrl+C to stop)`);
      if (config.access_token) {
        console.log("Access token required: DEMO_ACCESS_TOKEN is set.");
      }
    });
    process.once("SIGINT", () => {
      console.log("\nStopping.");
      server.close(() => resolve(0));
      server.closeAllConnections();
    });
  });
}

const USAGE = "usage: main.ts [-h] [--serve] [--selftest] [--host HOST] [--port PORT]";

function usageError(message: string): never {
  console.error(USAGE);
  console.error(`main.ts: error: ${message}`);
  process.exit(2);
}

async function main(argv: string[]): Promise<number> {
  let serveFlag = false;
  let host = "127.0.0.1";
  let port = 8000;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const [name, inline] = arg.startsWith("--") && arg.includes("=") ? [arg.slice(0, arg.indexOf("=")), arg.slice(arg.indexOf("=") + 1)] : [arg, undefined];
    const value = (): string => {
      if (inline !== undefined) {
        return inline;
      }
      i += 1;
      if (i >= argv.length) {
        usageError(`argument ${name}: expected one argument`);
      }
      return argv[i];
    };
    if (name === "-h" || name === "--help") {
      console.log(USAGE);
      console.log("\nModel demo interface with the standard library.\n");
      console.log("options:");
      console.log("  -h, --help   show this help message and exit");
      console.log("  --serve      start the HTTP server and block until Ctrl+C");
      console.log("  --selftest   run the quick self-test and exit (default)");
      console.log("  --host HOST");
      console.log("  --port PORT");
      return 0;
    } else if (name === "--serve") {
      serveFlag = true;
    } else if (name === "--selftest") {
      continue;
    } else if (name === "--host") {
      host = value();
    } else if (name === "--port") {
      const raw = value();
      if (!/^[+-]?\d+$/.test(raw.trim())) {
        usageError(`argument --port: invalid int value: '${raw}'`);
      }
      port = Number(raw.trim());
    } else {
      usageError(`unrecognized arguments: ${arg}`);
    }
  }
  if (serveFlag) {
    return serve(host, port);
  }
  return runSelftest();
}

main(process.argv.slice(2)).then((code) => process.exit(code));
