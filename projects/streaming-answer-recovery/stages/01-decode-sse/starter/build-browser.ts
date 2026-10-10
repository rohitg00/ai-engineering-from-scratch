import { readFile, writeFile, mkdir } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
const out = process.argv[2] ?? "/tmp/aiefs-stream-browser";
await mkdir(out, { recursive: true });
await writeFile(
  path.join(out, "answer.js"),
  stripTypeScriptTypes(await readFile("main.ts", "utf8")),
);
await writeFile(
  path.join(out, "index.html"),
  '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Streaming answer recovery</title><style>body{font:18px system-ui;max-width:800px;margin:50px auto;padding:20px;background:#f5f7fb;color:#123}button{padding:12px;margin-right:8px}input{width:90%;padding:12px}@media(prefers-color-scheme:dark){body{background:#14232e;color:#edf5ff}a{color:#9dcfff}}</style><h1>Streaming answer recovery</h1><label>SSE URL <input id="url" value="/events?interrupt=1"></label><button id="load">Load component</button><main id="answer"></main><script type="module">import {mount} from "./answer.js";let dispose;document.querySelector("#load").onclick=()=>{dispose?.();dispose=mount(document.querySelector("#answer"),document.querySelector("#url").value)};document.querySelector("#load").click();</script></html>',
);
console.log(out);
