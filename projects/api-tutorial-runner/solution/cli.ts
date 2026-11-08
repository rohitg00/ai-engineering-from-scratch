import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import {
  extractRequests,
  runTutorial,
  exportResults,
  acceptedCorrections,
} from "./main.ts";
async function main() {
  const args = process.argv.slice(2),
    [input, output = "output"] = args;
  if (!input || input === "--help") {
    console.log(
      'node cli.ts INPUT.json [OUTPUT_DIRECTORY] [--allow-network] [--corrections REVIEW.json]\nInput: {tutorial:string,fixture:[{method,path,status,body}]} or {tutorial,endpoint:"https://test.example"}. Network endpoints require --allow-network.',
    );
    return input ? 0 : 2;
  }
  const data = JSON.parse(await readFile(input, "utf8"));
  let server: ReturnType<typeof createServer> | undefined;
  try {
    let base = data.endpoint;
    if (!base) {
      if (!Array.isArray(data.fixture))
        throw Error("Provide fixture routes or an explicit endpoint");
      server = createServer(async (req, res) => {
        let bytes = 0;
        for await (const chunk of req) {
          bytes += chunk.length;
          if (bytes > 65536) {
            res.writeHead(413);
            res.end("{}");
            return;
          }
        }
        const route = data.fixture.find(
          (x: any) => x.method === req.method && x.path === req.url,
        );
        res.writeHead(route?.status ?? 404, {
          "content-type": "application/json",
        });
        res.end(JSON.stringify(route?.body ?? { error: "No authored route" }));
      });
      await new Promise<void>((resolve, reject) => {
        server!.once("error", reject);
        server!.listen(0, "127.0.0.1", resolve);
      });
      const address = server.address() as any;
      base = "http://127.0.0.1:" + address.port;
    }
    const steps = extractRequests(data.tutorial),
      receipts = await runTutorial(steps, base, {
        allowNetwork: args.includes("--allow-network"),
      }),
      result = exportResults(steps, receipts);
    await mkdir(output, { recursive: true });
    const save = async (name: string, value: any) =>
      writeFile(
        path.join(output, name),
        typeof value === "string"
          ? value
          : JSON.stringify(value, null, 2) + "\n",
      );
    await save("requests.json", {
      schemaVersion: 1,
      steps,
      tutorial: data.tutorial,
      ...(data.fixture
        ? { fixture: data.fixture }
        : { endpoint: data.endpoint }),
    });
    await save("results.json", { schemaVersion: 1, receipts });
    await save("junit.xml", result.junit);
    await save("report.html", result.html);
    await save("corrections.json", {
      schemaVersion: 1,
      corrections: result.corrections,
    });
    const i = args.indexOf("--corrections");
    if (i >= 0) {
      if (!args[i + 1]) throw Error("--corrections requires a filename");
      await save(
        "accepted-corrections.json",
        acceptedCorrections(
          receipts,
          JSON.parse(await readFile(args[i + 1], "utf8")),
        ),
      );
    }
    console.log(
      JSON.stringify(
        {
          endpoint: base,
          steps: receipts.map((r) => ({
            id: r.id,
            status: r.status,
            line: r.line,
            message: r.message,
          })),
          output,
        },
        null,
        2,
      ),
    );
    return 0;
  } finally {
    server?.closeAllConnections();
    if (server)
      await new Promise<void>((resolve) => server!.close(() => resolve()));
  }
}
main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 2;
  });
