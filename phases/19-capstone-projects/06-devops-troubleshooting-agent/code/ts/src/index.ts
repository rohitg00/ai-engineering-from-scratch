// Capstone 06 entrypoint: DevOps troubleshooting agent Slack integration.
// Source: ../../docs/en.md (Slack brief + approval buttons, gated MCP behind approval).
// References:
//   Slack request signing v0 https://api.slack.com/authentication/verifying-requests-from-slack
//   Slack Block Kit          https://api.slack.com/reference/block-kit/blocks
//   HMAC-SHA256 (RFC 2104)   https://datatracker.ietf.org/doc/html/rfc2104

import { createServer, IncomingMessage, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { buildApp } from "./server.js";
import { signForTesting, REPLAY_WINDOW_SECONDS } from "./slack_verify.js";

const SECRET = process.env.SLACK_SIGNING_SECRET ?? "test-signing-secret-DO-NOT-USE-IN-PROD";

async function nodeRequestToWeb(req: IncomingMessage): Promise<Request> {
  const host = req.headers.host ?? "127.0.0.1";
  const url = `http://${host}${req.url ?? "/"}`;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) for (const item of v) headers.append(k, item);
    else headers.set(k, String(v));
  }
  const method = (req.method ?? "GET").toUpperCase();
  let body: Buffer | undefined;
  if (method !== "GET" && method !== "HEAD") {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer));
    }
    body = Buffer.concat(chunks);
  }
  return new Request(url, { method, headers, ...(body ? { body } : {}) });
}

async function writeWebResponse(res: ServerResponse, webRes: Response): Promise<void> {
  res.statusCode = webRes.status;
  webRes.headers.forEach((value, key) => res.setHeader(key, value));
  const buf = Buffer.from(await webRes.arrayBuffer());
  res.end(buf);
}

type SignedOpts = { stale?: boolean; tamper?: boolean };

function signedHeaders(body: string, opts: SignedOpts = {}): Record<string, string> {
  const nowS = Math.floor(Date.now() / 1000);
  const ts = opts.stale ? String(nowS - REPLAY_WINDOW_SECONDS - 1) : String(nowS);
  let signature = signForTesting(SECRET, ts, body);
  if (opts.tamper) signature = signature.slice(0, -1) + "0";
  return {
    "content-type": "application/x-www-form-urlencoded",
    "x-slack-request-timestamp": ts,
    "x-slack-signature": signature,
  };
}

async function runDemo(): Promise<void> {
  const { app, outboundLog } = buildApp({ signingSecret: SECRET });
  console.log("=".repeat(72));
  console.log("CAPSTONE 06 - SLACK INTEGRATION SKELETON (TypeScript)");
  console.log("=".repeat(72));

  const slashBody = new URLSearchParams({
    command: "/oncall",
    text: "OOMKilled payments-api",
    user_id: "U1",
    response_url: "https://hooks.slack.example/redacted",
  }).toString();

  const interactivityBody = new URLSearchParams({
    payload: JSON.stringify({
      actions: [{ action_id: "approve", value: "inc-42" }],
      response_url: "https://hooks.slack.example/redacted",
    }),
  }).toString();

  const doRequest = async (path: string, init?: RequestInit): Promise<Response> => {
    return Promise.resolve(app.request(path, init));
  };

  const checks: Array<{ label: string; expect: number; req: () => Promise<Response> }> = [
    {
      label: "GET /health",
      expect: 200,
      req: () => doRequest("/health"),
    },
    {
      label: "POST /slack/command with valid signature",
      expect: 200,
      req: () =>
        doRequest("/slack/command", {
          method: "POST",
          headers: signedHeaders(slashBody),
          body: slashBody,
        }),
    },
    {
      label: "POST /slack/command with tampered signature",
      expect: 401,
      req: () =>
        doRequest("/slack/command", {
          method: "POST",
          headers: signedHeaders(slashBody, { tamper: true }),
          body: slashBody,
        }),
    },
    {
      label: "POST /slack/command with stale timestamp",
      expect: 401,
      req: () =>
        doRequest("/slack/command", {
          method: "POST",
          headers: signedHeaders(slashBody, { stale: true }),
          body: slashBody,
        }),
    },
    {
      label: "POST /slack/interactivity approve",
      expect: 200,
      req: () =>
        doRequest("/slack/interactivity", {
          method: "POST",
          headers: signedHeaders(interactivityBody),
          body: interactivityBody,
        }),
    },
  ];

  let ok = 0;
  for (const c of checks) {
    const resp = await c.req();
    const body = await resp.text();
    console.log(`\n${c.label}`);
    console.log(`  status=${resp.status} expect=${c.expect}`);
    console.log(`  body=${body.slice(0, 120)}`);
    if (resp.status === c.expect) ok += 1;
  }

  console.log("\n" + "-".repeat(72));
  console.log(`probes ok=${ok}/${checks.length}`);
  console.log(`outbound slack calls logged=${outboundLog.length}`);
}

function startServer(): void {
  const { app } = buildApp({ signingSecret: SECRET });
  const port = Number(process.env.PORT ?? 0);
  const server = createServer((req, res) => {
    nodeRequestToWeb(req)
      .then((webReq) => app.fetch(webReq))
      .then((webRes) => writeWebResponse(res, webRes))
      .catch((err: unknown) => {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: String(err) }));
      });
  });
  server.listen(port, "127.0.0.1", () => {
    const addr = server.address() as AddressInfo;
    console.log(`slack-integration listening on http://127.0.0.1:${addr.port}`);
  });
  process.on("SIGINT", () => server.close(() => process.exit(0)));
  process.on("SIGTERM", () => server.close(() => process.exit(0)));
}

async function main(): Promise<void> {
  if (process.argv.includes("--demo") || !process.stdout.isTTY) {
    await runDemo();
    return;
  }
  startServer();
}

main().catch((err: unknown) => {
  console.error("startup failed:", err);
  process.exit(1);
});
