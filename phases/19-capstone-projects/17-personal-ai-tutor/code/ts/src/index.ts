// Personal AI Tutor: capstone stack の TypeScript web-app 側。
// Python 側は learner model と tutor policy を提供し、この project は
// /lesson/next (curriculum DAG の topo-walk) と /lesson/:id/submit を expose する。
// Refs: docs/en.md (この lesson),
//   Bayesian Knowledge Tracing: https://en.wikipedia.org/wiki/Bayesian_knowledge_tracing
//   FSRS spaced-repetition: https://github.com/open-spaced-repetition/fsrs4anki

import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { buildIndex, CURRICULUM, pickNextLesson, topoOrder } from "./curriculum.js";
import { MasteryStore } from "./mastery.js";
import { buildApp } from "./server.js";

function runDemo(): void {
  const store = new MasteryStore();
  const index = buildIndex(CURRICULUM);
  const topo = topoOrder(CURRICULUM);

  process.stdout.write("=".repeat(72) + "\n");
  process.stdout.write("PHASE 19 LESSON 17 - personal tutor (TypeScript)\n");
  process.stdout.write("=".repeat(72) + "\n");

  process.stdout.write(`\ntopological order: ${topo.join(", ")}\n`);

  let now = Date.now();
  const learnerCorrectRate = 0.75;
  let seed = 1;
  const rng = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  for (let step = 0; step < 14; step += 1) {
    const pick = pickNextLesson(topo, index, store.all(), now);
    if (!pick) {
      process.stdout.write(`\nstep ${step}: curriculum complete\n`);
      break;
    }
    const correct = rng() < learnerCorrectRate;
    const updated = store.record(pick.lesson.id, correct, now);
    process.stdout.write(
      `\nstep ${step}: ${pick.lesson.id} (${pick.lesson.title}) ${pick.reason}, ` +
        `learner ${correct ? "correct" : "wrong"}, ` +
        `score=${updated.score.toFixed(2)}, next_due=+${Math.floor(updated.interval_ms / 1000)}s\n`,
    );
    now = updated.next_due_at + 1;
  }

  process.stdout.write("\nfinal mastery snapshot:\n");
  for (const id of topo) {
    const m = store.peek(id);
    if (!m) continue;
    process.stdout.write(
      `  ${id}: score=${m.score.toFixed(2)} attempts=${m.attempts} successes=${m.successes}\n`,
    );
  }
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

function runServer(port: number): void {
  const store = new MasteryStore();
  const app = buildApp(store);
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
    process.stdout.write(`tutor api on http://localhost:${port}\n`);
  });
}

const DEFAULT_PORT = 8090;

function parsePort(argv: string[], defaultPort: number): number {
  const portFlag = argv.indexOf("--port");
  if (portFlag < 0) return defaultPort;
  const raw = argv[portFlag + 1];
  if (raw === undefined) {
    process.stderr.write("--port には値が必要です\n");
    process.exit(2);
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    process.stderr.write(`invalid --port ${raw}: 1..65535 の integer が必要です\n`);
    process.exit(2);
  }
  return n;
}

function main(): void {
  const argv = process.argv.slice(2);
  if (argv.includes("--serve")) {
    const port = parsePort(argv, DEFAULT_PORT);
    runServer(port);
    return;
  }
  runDemo();
}

main();
