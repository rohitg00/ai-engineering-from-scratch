// GitHub Issue-to-PR Agent: TypeScript webhook receiver.
// Python side ships the agent loop; YAML side ships the Actions workflow.
// This project verifies HMAC, routes on event type, dispatches a stub agent.
// Refs: docs/en.md (this lesson),
//   GitHub webhook signature: https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
//   GitHub App docs: https://docs.github.com/en/apps

import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { AuditLog } from "./agent.js";
import { route } from "./router.js";
import { buildApp } from "./server.js";
import { expectedSig, verifySignature } from "./verify.js";

const DEMO_SECRET = "demo-shared-secret";

function demoDelivery(
  audit: AuditLog,
  event: string,
  payload: unknown,
  signingSecret: string,
  receiverSecret: string,
): void {
  const raw = Buffer.from(JSON.stringify(payload), "utf8");
  const sig = expectedSig(raw, signingSecret);
  const ok = verifySignature(raw, sig, receiverSecret);
  process.stdout.write(`\n>>> delivery event=${event} sig_valid=${ok}\n`);
  if (!ok) {
    process.stdout.write("<<< 401 invalid signature\n");
    return;
  }
  const result = route(audit, event, payload);
  process.stdout.write(`<<< ${result.code} ${JSON.stringify(result.body)}\n`);
}

function runDemo(): void {
  const audit = new AuditLog();
  const secret = DEMO_SECRET;

  process.stdout.write("=".repeat(72) + "\n");
  process.stdout.write("PHASE 19 LESSON 16 - GitHub webhook receiver (TypeScript)\n");
  process.stdout.write("=".repeat(72) + "\n");

  demoDelivery(audit, "ping", { zen: "Speak like a human.", hook_id: 12345 }, secret, secret);

  demoDelivery(
    audit,
    "issues",
    {
      action: "opened",
      issue: {
        number: 42,
        title: "Add /healthz endpoint",
        user: { login: "octocat" },
      },
      repository: { full_name: "acme/widgets" },
    },
    secret,
    secret,
  );

  demoDelivery(
    audit,
    "issues",
    {
      action: "opened",
      issue: { number: 99, title: "evil" },
      repository: { full_name: "acme/widgets" },
    },
    "wrong-secret",
    secret,
  );

  demoDelivery(
    audit,
    "issues",
    {
      action: "closed",
      issue: { number: 41, title: "skip me" },
      repository: { full_name: "acme/widgets" },
    },
    secret,
    secret,
  );

  process.stdout.write(`\naudit entries recorded: ${audit.count()}\n`);
}

const MAX_BODY_SIZE = 1024 * 1024;

function nodeAdapter(app: ReturnType<typeof buildApp>) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const host = req.headers.host ?? "localhost";
    const url = new URL(req.url ?? "/", `http://${host}`);
    const body = await new Promise<Buffer | undefined>((resolve, reject) => {
      const chunks: Buffer[] = [];
      let received = 0;
      req.on("data", (chunk: Buffer) => {
        received += chunk.length;
        if (received > MAX_BODY_SIZE) {
          req.destroy();
          reject(new Error(`request body exceeds ${MAX_BODY_SIZE} bytes`));
          return;
        }
        chunks.push(chunk);
      });
      req.on("end", () => resolve(chunks.length > 0 ? Buffer.concat(chunks) : undefined));
      req.on("error", reject);
    });
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === "string") headers.set(key, value);
      else if (Array.isArray(value)) headers.set(key, value.join(", "));
    }
    const init: RequestInit = {
      method: req.method ?? "GET",
      headers,
    };
    if (body && req.method !== "GET" && req.method !== "HEAD") init.body = body;
    const fetchRes = await app.fetch(new Request(url.toString(), init));
    res.writeHead(fetchRes.status, Object.fromEntries(fetchRes.headers));
    res.end(Buffer.from(await fetchRes.arrayBuffer()));
  };
}

function runServer(port: number, secret: string): void {
  const audit = new AuditLog();
  const app = buildApp(audit, secret);
  const handler = nodeAdapter(app);
  const server = createServer((req, res) => {
    handler(req, res).catch((err) => {
      const message = String(err);
      const tooLarge = message.includes("exceeds");
      if (res.headersSent) return;
      res.writeHead(tooLarge ? 413 : 500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: message }));
    });
  });
  server.listen(port, () => {
    process.stdout.write(`webhook receiver on http://localhost:${port}/webhook\n`);
  });
}

const DEFAULT_PORT = 8081;

function parsePort(argv: string[], defaultPort: number): number {
  const portFlag = argv.indexOf("--port");
  if (portFlag < 0) return defaultPort;
  const raw = argv[portFlag + 1];
  if (raw === undefined) {
    process.stderr.write("--port requires a value\n");
    process.exit(2);
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    process.stderr.write(`invalid --port ${raw}: must be integer in 1..65535\n`);
    process.exit(2);
  }
  return n;
}

function main(): void {
  const argv = process.argv.slice(2);
  if (argv.includes("--serve")) {
    const secret = process.env.GH_WEBHOOK_SECRET;
    if (!secret) {
      process.stderr.write(
        "GH_WEBHOOK_SECRET must be set in the environment to run --serve\n",
      );
      process.exit(1);
    }
    const port = parsePort(argv, DEFAULT_PORT);
    runServer(port, secret);
    return;
  }
  runDemo();
}

main();
