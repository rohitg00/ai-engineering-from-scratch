// Lesson: JSON-RPC 2.0 Over Newline-Delimited Stdio (phase 19 / lesson 22)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/19-capstone-projects/22-jsonrpc-stdio-transport/docs/en.md
// Run: npx tsx phases/19-capstone-projects/22-jsonrpc-stdio-transport/code/main.ts

const ERR_PARSE = -32700;
const ERR_INVALID_REQUEST = -32600;
const ERR_METHOD_NOT_FOUND = -32601;
const ERR_INVALID_PARAMS = -32602;
const ERR_INTERNAL = -32603;

type Id = number | string | null;
type Envelope = Record<string, unknown>;

class JsonDecodeError extends Error {}

function pyJsonLoads(doc: string): unknown {
  const ws = (i: number) => {
    while (i < doc.length && " \t\n\r".includes(doc[i])) i++;
    return i;
  };
  const fail = (msg: string, pos: number): never => {
    const lineno = doc.slice(0, pos).split("\n").length;
    const nl = doc.lastIndexOf("\n", pos - 1);
    const colno = nl === -1 || pos === 0 ? pos + 1 : pos - nl;
    throw new JsonDecodeError(`${msg}: line ${lineno} column ${colno} (char ${pos})`);
  };
  const scanString = (start: number): number => {
    let i = start + 1;
    while (i < doc.length) {
      const ch = doc[i];
      if (ch === '"') return i + 1;
      if (ch === "\\") {
        const esc = doc[i + 1];
        if (esc === undefined) break;
        if (!'"\\/bfnrtu'.includes(esc)) fail("Invalid \\escape", i);
        if (esc === "u") {
          if (!/^[0-9a-fA-F]{4}$/.test(doc.slice(i + 2, i + 6))) fail("Invalid \\uXXXX escape", i + 1);
          i += 6;
        } else {
          i += 2;
        }
        continue;
      }
      if (ch.charCodeAt(0) < 0x20) fail("Invalid control character at", i);
      i++;
    }
    return fail("Unterminated string starting at", start);
  };
  const scanValue = (i: number): number => {
    const ch = doc[i];
    if (ch === '"') return scanString(i);
    if (ch === "{") return scanObject(i + 1);
    if (ch === "[") return scanArray(i + 1);
    for (const lit of ["null", "true", "false", "NaN", "Infinity", "-Infinity"]) {
      if (doc.startsWith(lit, i)) return i + lit.length;
    }
    const m = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][-+]?\d+)?/.exec(doc.slice(i));
    if (m) return i + m[0].length;
    return fail("Expecting value", i);
  };
  const scanObject = (i: number): number => {
    i = ws(i);
    if (doc[i] === "}") return i + 1;
    if (doc[i] !== '"') fail("Expecting property name enclosed in double quotes", i);
    while (true) {
      i = scanString(i);
      i = ws(i);
      if (doc[i] !== ":") fail("Expecting ':' delimiter", i);
      i = scanValue(ws(i + 1));
      i = ws(i);
      if (doc[i] === "}") return i + 1;
      if (doc[i] !== ",") fail("Expecting ',' delimiter", i);
      const comma = i;
      i = ws(i + 1);
      if (doc[i] === "}") fail("Illegal trailing comma before end of object", comma);
      if (doc[i] !== '"') fail("Expecting property name enclosed in double quotes", i);
    }
  };
  const scanArray = (i: number): number => {
    i = ws(i);
    if (doc[i] === "]") return i + 1;
    while (true) {
      i = ws(scanValue(i));
      if (doc[i] === "]") return i + 1;
      if (doc[i] !== ",") fail("Expecting ',' delimiter", i);
      const comma = i;
      i = ws(i + 1);
      if (doc[i] === "]") fail("Illegal trailing comma before end of array", comma);
    }
  };
  try {
    return JSON.parse(doc);
  } catch (exc) {
    const end = ws(scanValue(ws(0)));
    if (end !== doc.length) fail("Extra data", end);
    throw new JsonDecodeError((exc as Error).message);
  }
}

class JsonRpcError extends Error {
  code: number = ERR_INTERNAL;

  constructor(message: string, public data: unknown = null) {
    super(message);
  }
}

class MethodNotFound extends JsonRpcError {
  code = ERR_METHOD_NOT_FOUND;
}

class InvalidParams extends JsonRpcError {
  code = ERR_INVALID_PARAMS;
}

class RuntimeError extends Error {}

class Request {
  constructor(
    public method: string,
    public params: unknown,
    public id: Id,
    public isNotification: boolean,
  ) {}
}

function isDict(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isValidEnvelope(msg: unknown): msg is Record<string, unknown> {
  if (!isDict(msg)) return false;
  if (msg.jsonrpc !== "2.0") return false;
  if (typeof msg.method !== "string") return false;
  if ("params" in msg && !(isDict(msg.params) || Array.isArray(msg.params))) return false;
  if ("id" in msg) {
    const rid = msg.id;
    if (typeof rid === "boolean") return false;
    if (!((typeof rid === "number" && Number.isInteger(rid)) || typeof rid === "string" || rid === null)) return false;
  }
  return true;
}

function getId(msg: Record<string, unknown>): Id {
  return (msg.id ?? null) as Id;
}

function parseRequest(raw: string): [Request | null, Envelope | null] {
  let msg: unknown;
  try {
    msg = pyJsonLoads(raw);
  } catch (exc) {
    if (!(exc instanceof JsonDecodeError)) throw exc;
    return [null, errEnvelope(null, ERR_PARSE, `parse error: ${exc.message}`)];
  }
  if (!isValidEnvelope(msg)) {
    const rid = isDict(msg) ? getId(msg) : null;
    return [null, errEnvelope(rid, ERR_INVALID_REQUEST, "invalid request envelope")];
  }
  const isNotif = !("id" in msg);
  return [new Request(msg.method as string, msg.params ?? null, getId(msg), isNotif), null];
}

function errEnvelope(rid: Id, code: number, message: string, data: unknown = null): Envelope {
  const err: Envelope = { code, message };
  if (data !== null && data !== undefined) err.data = data;
  return { jsonrpc: "2.0", id: rid, error: err };
}

function okEnvelope(rid: Id, result: unknown): Envelope {
  return { jsonrpc: "2.0", id: rid, result };
}

function notificationEnvelope(method: string, params: unknown): Envelope {
  const env: Envelope = { jsonrpc: "2.0", method };
  if (params !== null && params !== undefined) env.params = params;
  return env;
}

class BytesIO {
  private buf: Buffer = Buffer.alloc(0);
  private pos = 0;

  write(data: Buffer): void {
    this.buf = Buffer.concat([this.buf.subarray(0, this.pos), data, this.buf.subarray(this.pos + data.length)]);
    this.pos += data.length;
  }

  seek(pos: number): void {
    this.pos = pos;
  }

  readline(): Buffer {
    const nl = this.buf.indexOf(0x0a, this.pos);
    const end = nl === -1 ? this.buf.length : nl + 1;
    const line = this.buf.subarray(this.pos, end);
    this.pos = end;
    return line;
  }

  read(): Buffer {
    const out = this.buf.subarray(this.pos);
    this.pos = this.buf.length;
    return out;
  }

  flush(): void {}
}

class StdioTransport {
  constructor(readonly input: BytesIO, readonly output: BytesIO) {}

  readLine(): Buffer | null {
    const line = this.input.readline();
    if (line.length === 0) return null;
    return line;
  }

  writeResponse(rid: Id, result: unknown): void {
    this.write(okEnvelope(rid, result));
  }

  writeError(rid: Id, code: number, message: string, data: unknown = null): void {
    this.write(errEnvelope(rid, code, message, data));
  }

  writeNotification(method: string, params: unknown = null): void {
    this.write(notificationEnvelope(method, params));
  }

  private write(obj: Envelope): void {
    writeRaw(this, obj);
  }
}

type Handler = (method: string, params: unknown) => unknown;

function handleOne(handler: Handler, _transport: StdioTransport, req: Request): Envelope | null {
  let result: unknown;
  try {
    result = handler(req.method, req.params);
  } catch (exc) {
    if (req.isNotification) return null;
    if (exc instanceof JsonRpcError) return errEnvelope(req.id, exc.code, exc.message, exc.data);
    const e = exc as Error;
    return errEnvelope(req.id, ERR_INTERNAL, "internal error",
      { exception: e.constructor.name, detail: e.message });
  }
  if (req.isNotification) return null;
  return okEnvelope(req.id, result);
}

function processBatch(handler: Handler, transport: StdioTransport, items: unknown[]): Envelope[] | null {
  const out: Envelope[] = [];
  for (const raw of items) {
    if (!isDict(raw) || !isValidEnvelope(raw)) {
      const rid = isDict(raw) ? getId(raw) : null;
      out.push(errEnvelope(rid, ERR_INVALID_REQUEST, "invalid request envelope"));
      continue;
    }
    const isNotif = !("id" in raw);
    const req = new Request(raw.method as string, raw.params ?? null, getId(raw), isNotif);
    const resp = handleOne(handler, transport, req);
    if (resp !== null) out.push(resp);
  }
  if (out.length === 0) return null;
  return out;
}

function writeRaw(transport: StdioTransport, obj: unknown): void {
  const encoded = JSON.stringify(obj);
  transport.output.write(Buffer.from(encoded + "\n", "utf8"));
  transport.output.flush();
}

function serve(handler: Handler, transport: StdioTransport): void {
  while (true) {
    const line = transport.readLine();
    if (line === null) return;
    const text = line.toString("utf8").replace(/\n+$/, "").trim();
    if (!text) continue;
    let parsed: unknown;
    try {
      parsed = pyJsonLoads(text);
    } catch (exc) {
      if (!(exc instanceof JsonDecodeError)) throw exc;
      transport.writeError(null, ERR_PARSE, `parse error: ${exc.message}`);
      continue;
    }
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) {
        transport.writeError(null, ERR_INVALID_REQUEST, "empty batch");
        continue;
      }
      const batchOut = processBatch(handler, transport, parsed);
      if (batchOut !== null) writeRaw(transport, batchOut);
      continue;
    }
    const [req, err] = parseRequest(text);
    if (err !== null) {
      writeRaw(transport, err);
      continue;
    }
    const resp = handleOne(handler, transport, req!);
    if (resp !== null) writeRaw(transport, resp);
  }
}

function pyStr(s: string): string {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  return quote + s.replace(/\\/g, "\\\\").split(quote).join("\\" + quote) + quote;
}

function demo(): void {
  const handler: Handler = (method, params) => {
    if (method === "math.add") {
      if (!isDict(params) || !("a" in params) || !("b" in params)) {
        throw new InvalidParams("a and b required");
      }
      return (params.a as number) + (params.b as number);
    }
    if (method === "echo") return params;
    if (method === "boom") throw new RuntimeError("intentional");
    throw new MethodNotFound(`method ${pyStr(method)}`);
  };

  const requests: unknown[] = [
    { jsonrpc: "2.0", id: 1, method: "math.add", params: { a: 2, b: 3 } },
    { jsonrpc: "2.0", id: 2, method: "math.add", params: { a: 5 } },
    { jsonrpc: "2.0", id: 3, method: "missing" },
    { jsonrpc: "2.0", id: 4, method: "boom" },
    { jsonrpc: "2.0", method: "log", params: { level: "info" } },
    [
      { jsonrpc: "2.0", id: 10, method: "echo", params: { text: "hi" } },
      { jsonrpc: "2.0", method: "log", params: { msg: "skip-me" } },
      { jsonrpc: "2.0", id: 11, method: "math.add", params: { a: 1, b: 1 } },
    ],
  ];

  const stdin = new BytesIO();
  for (const r of requests) stdin.write(Buffer.from(JSON.stringify(r) + "\n", "utf8"));
  stdin.write(Buffer.from("{not json\n", "utf8"));
  stdin.seek(0);
  const stdout = new BytesIO();
  const transport = new StdioTransport(stdin, stdout);
  serve(handler, transport);
  stdout.seek(0);
  const lines = stdout.read().toString("utf8").split(/\r\n|\r|\n/).filter((line) => line).map((line) => JSON.parse(line));
  console.log(JSON.stringify({ server_responses: lines }, null, 2));
}

demo();

export {};
