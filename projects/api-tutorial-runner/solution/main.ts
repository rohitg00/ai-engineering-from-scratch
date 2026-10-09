import { isDeepStrictEqual } from "node:util";
export type Capture = { path: string; type: "string" | "number" | "boolean" };
export type RequestStep = {
  id: string;
  method: string;
  path: string;
  body?: unknown;
  status: number;
  assert: Record<string, unknown>;
  capture: Record<string, Capture>;
  line: number;
};
export type Receipt = {
  id: string;
  line: number;
  status: "pass" | "fail" | "skip";
  message: string;
  request?: { method: string; url: string; body?: unknown };
  response?: { status: number; body: unknown; bytes: number };
  variables: Record<string, string | number | boolean>;
};

function field(value: any, path: string): unknown {
  if (path === "") return value;
  return path
    .split(".")
    .reduce(
      (v, key) =>
        v !== null && typeof v === "object" && Object.hasOwn(v, key)
          ? v[key]
          : undefined,
      value,
    );
}
export function extractRequests(markdown: string): RequestStep[] {
  if (typeof markdown !== "string") throw Error("Tutorial must be text");
  const lines = markdown.split(/\r?\n/),
    steps: RequestStep[] = [],
    ids = new Set<string>();
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() !== "```request") continue;
    const start = i + 1,
      body: string[] = [];
    while (++i < lines.length && lines[i].trim() !== "```") body.push(lines[i]);
    if (i === lines.length)
      throw Error("Unclosed request block at line " + start);
    let value;
    try {
      value = JSON.parse(body.join("\n"));
    } catch {
      throw Error("Invalid request JSON at line " + start);
    }
    const id = nonempty(value.id, "request id");
    if (ids.has(id)) throw Error("Duplicate request id");
    ids.add(id);
    const method = nonempty(value.method, "method").toUpperCase();
    if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method))
      throw Error("Unsupported HTTP method");
    const path = nonempty(value.path, "path");
    if (!path.startsWith("/") || path.startsWith("//") || /[\r\n\\]/.test(path))
      throw Error("Request path must stay on the selected origin");
    if (
      !Number.isInteger(value.status) ||
      value.status < 100 ||
      value.status > 599
    )
      throw Error("Expected status must be 100..599");
    const capture = value.capture ?? {},
      assert = value.assert ?? {};
    for (const [name, c] of Object.entries(capture) as [string, any][]) {
      if (
        !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name) ||
        ["constructor", "prototype", "__proto__"].includes(name) ||
        !c ||
        typeof c !== "object" ||
        typeof c.path !== "string" ||
        !["string", "number", "boolean"].includes(c.type)
      )
        throw Error("Invalid capture declaration");
    }
    if (
      !assert ||
      typeof assert !== "object" ||
      Array.isArray(assert) ||
      !capture ||
      typeof capture !== "object" ||
      Array.isArray(capture)
    )
      throw Error("assert/capture must be objects");
    steps.push({
      id,
      method,
      path,
      ...(Object.hasOwn(value, "body") ? { body: value.body } : {}),
      status: value.status,
      assert,
      capture,
      line: start,
    });
  }
  if (!steps.length) throw Error("No explicit request blocks");
  if (steps.length > 20) throw Error("At most 20 request steps");
  return steps;
}
export function resolveValue(
  value: unknown,
  variables: Record<string, string | number | boolean>,
): unknown {
  if (typeof value === "string") {
    const exact = value.match(/^\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}$/);
    const get = (name: string) => {
      if (!Object.hasOwn(variables, name))
        throw Error("Undeclared response variable " + name);
      return variables[name];
    };
    if (exact) return get(exact[1]);
    return value.replace(/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g, (_, key) =>
      String(get(key)),
    );
  }
  if (Array.isArray(value)) return value.map((x) => resolveValue(x, variables));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, resolveValue(v, variables)]),
    );
  return value;
}
export function captureVariables(
  body: unknown,
  declarations: Record<string, Capture>,
  previous: Record<string, string | number | boolean> = {},
): Record<string, string | number | boolean> {
  const next = { ...previous };
  for (const [name, spec] of Object.entries(declarations)) {
    if (Object.hasOwn(next, name))
      throw Error("Capture would overwrite variable " + name);
    const value = field(body, spec.path);
    if (
      typeof value !== spec.type ||
      (typeof value === "number" && !Number.isFinite(value))
    )
      throw Error(
        "Capture " + name + " expected " + spec.type + " at " + spec.path,
      );
    next[name] = value as string | number | boolean;
  }
  return next;
}
export async function runTutorial(
  steps: RequestStep[],
  baseURL: string,
  options: {
    allowNetwork?: boolean;
    timeoutMs?: number;
    maxBytes?: number;
  } = {},
): Promise<Receipt[]> {
  const base = new URL(baseURL);
  if (
    !["http:", "https:"].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.pathname !== "/" ||
    base.search ||
    base.hash
  )
    throw Error("Base URL must be an HTTP(S) origin without credentials");
  if (!options.allowNetwork && !["127.0.0.1", "[::1]"].includes(base.hostname))
    throw Error("Network endpoint requires explicit allowNetwork");
  const timeoutMs = options.timeoutMs ?? 1500,
    maxBytes = options.maxBytes ?? 65536;
  if (
    !Number.isInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > 30000 ||
    !Number.isInteger(maxBytes) ||
    maxBytes < 1 ||
    maxBytes > 1048576 ||
    steps.length > 20
  )
    throw Error("Invalid request bounds");
  const receipts: Receipt[] = [],
    variables: Record<string, string | number | boolean> = {};
  let failed = false;
  for (const step of steps) {
    if (failed) {
      receipts.push({
        id: step.id,
        line: step.line,
        status: "skip",
        message: "Earlier step failed; no request sent",
        variables: { ...variables },
      });
      continue;
    }
    const receipt: Receipt = {
      id: step.id,
      line: step.line,
      status: "fail",
      message: "",
      variables: { ...variables },
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const path = step.path.replace(
          /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g,
          (_, name) => {
            if (!Object.hasOwn(variables, name))
              throw Error("Undeclared response variable " + name);
            return encodeURIComponent(String(variables[name]));
          },
        ),
        url = new URL(path, base);
      if (
        !path.startsWith("/") ||
        path.startsWith("//") ||
        url.origin !== base.origin
      )
        throw Error("Resolved URL escaped selected origin");
      const body = resolveValue(step.body, variables);
      if (step.method === "GET" && body !== undefined)
        throw Error("GET cannot carry a JSON body");
      receipt.request = {
        method: step.method,
        url: url.href,
        ...(body === undefined ? {} : { body }),
      };
      const controller = new AbortController();
      timer = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetch(url, {
        method: step.method,
        headers: {
          accept: "application/json",
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        redirect: "error",
        signal: controller.signal,
      });
      const reader = response.body?.getReader(),
        chunks: Uint8Array[] = [];
      let bytes = 0;
      if (reader)
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.length;
          if (bytes > maxBytes) {
            await reader.cancel();
            throw Error("Response exceeds byte limit");
          }
          chunks.push(value);
        }
      const raw = Buffer.concat(chunks).toString("utf8");
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw Error("Response is not JSON");
      }
      receipt.response = { status: response.status, body: parsed, bytes };
      if (response.status !== step.status)
        throw Error(
          "Expected HTTP " + step.status + ", received " + response.status,
        );
      for (const [key, expected] of Object.entries(step.assert)) {
        const target = resolveValue(expected, variables);
        if (!isDeepStrictEqual(field(parsed, key), target))
          throw Error(
            "Assertion failed at " +
              key +
              ": expected " +
              JSON.stringify(target) +
              ", received " +
              JSON.stringify(field(parsed, key)),
          );
      }
      const next = captureVariables(parsed, step.capture, variables);
      Object.assign(variables, next);
      receipt.variables = { ...variables };
      receipt.status = "pass";
      receipt.message = "Status, assertions and captures passed";
    } catch (error) {
      failed = true;
      receipt.message = (error as Error).message;
    } finally {
      if (timer) clearTimeout(timer);
    }
    receipts.push(receipt);
  }
  return receipts;
}
export function exportResults(
  steps: RequestStep[],
  receipts: Receipt[],
): { junit: string; html: string; corrections: any[] } {
  const failures = receipts.filter((x) => x.status === "fail"),
    skips = receipts.filter((x) => x.status === "skip");
  const junit = `<?xml version="1.0" encoding="UTF-8"?><testsuite name="api-tutorial" tests="${receipts.length}" failures="${failures.length}" skipped="${skips.length}">${receipts.map((r) => `<testcase name="${escapeHTML(r.id)}">${r.status === "fail" ? `<failure message="${escapeHTML(r.message)}">${escapeHTML("Tutorial line " + r.line)}</failure>` : r.status === "skip" ? "<skipped/>" : ""}</testcase>`).join("")}</testsuite>\n`;
  const corrections = failures.map((r) => ({
    id: r.id,
    line: r.line,
    issue: r.message,
    proposal: "",
    approved: false,
  }));
  const html = page(
    "API Tutorial Runner",
    `<p>${receipts.length} steps: ${failures.length} failed, ${skips.length} skipped. Results came from real bounded HTTP requests. A failed step stops subsequent requests.</p>${receipts.map((r) => `<section id="step-${escapeHTML(r.id)}"><h2>${escapeHTML(r.id)} · ${r.status}</h2><p>Tutorial source line ${r.line}</p><p class="alert">${escapeHTML(r.message)}</p><details><summary>Request and response evidence</summary><pre>${escapeHTML(JSON.stringify({ request: r.request, response: r.response, variables: r.variables }, null, 2))}</pre></details>${r.status === "fail" ? `<label>Proposed documentation correction<textarea data-correction="${escapeHTML(r.id)}" placeholder="Write a reviewed correction grounded in the response evidence"></textarea></label><label><input type="checkbox" data-approved="${escapeHTML(r.id)}"> I reviewed this correction</label>` : ""}</section>`).join("")}<button id="save">Download corrections.json</button>`,
    `const corrections=${embedded(corrections)};document.querySelectorAll('[data-correction]').forEach(t=>{t.oninput=()=>{corrections.find(c=>c.id===t.dataset.correction).proposal=t.value}});document.querySelectorAll('[data-approved]').forEach(c=>{c.onchange=()=>{corrections.find(x=>x.id===c.dataset.approved).approved=c.checked}});document.querySelector('#save').onclick=()=>download('corrections.json',{schemaVersion:1,corrections});`,
  );
  return { junit, html, corrections };
}
export function acceptedCorrections(
  receipts: Receipt[],
  value: unknown,
): { id: string; line: number; proposal: string }[] {
  const v = value as any;
  if (v?.schemaVersion !== 1) throw Error("Invalid correction schema");
  const rows = array(v.corrections, "corrections"),
    ids = new Set<string>();
  return rows.flatMap((c) => {
    const r = receipts.find((r) => r.id === c.id && r.status === "fail");
    if (
      ids.has(c.id) ||
      !r ||
      c.line !== r.line ||
      c.issue !== r.message ||
      typeof c.approved !== "boolean"
    )
      throw Error("Stale or invalid correction");
    ids.add(c.id);
    return c.approved
      ? [
          {
            id: c.id,
            line: c.line,
            proposal: nonempty(c.proposal, "approved correction"),
          },
        ]
      : [];
  });
}

export function escapeHTML(value: unknown): string {
  return String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
export function embedded(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
export function page(title: string, content: string, script = ""): string {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHTML(title)}</title><style>:root{color-scheme:light dark;font:17px/1.6 system-ui;background:light-dark(#f6f4ed,#161d21);color:light-dark(#172a32,#e4e9e7)}body{max-width:1000px;margin:auto;padding:28px}h1{line-height:1.15}header{border-bottom:3px solid #53866c;margin-bottom:24px}h2{font-size:1.3rem}button,input,select,textarea{font:inherit;max-width:100%;padding:8px;border:1px solid #738d88;border-radius:5px}button{cursor:pointer}button:focus-visible,input:focus-visible,textarea:focus-visible{outline:3px solid #cf9446}article,section{margin:18px 0;padding:18px;border:1px solid #8a9991;border-radius:8px}label{display:inline-block;margin:8px}textarea{display:block;box-sizing:border-box;width:100%;min-height:110px}table{width:100%;border-collapse:collapse;display:block;overflow:auto}th,td{padding:10px;border-bottom:1px solid #8a9991;text-align:left;vertical-align:top}pre{white-space:pre-wrap;overflow-wrap:anywhere}code{overflow-wrap:anywhere}.muted{opacity:.75}.alert{border-left:4px solid #c47827;padding-left:12px}a{color:light-dark(#145d83,#82cdec)}svg{max-width:100%;height:auto}summary{cursor:pointer}.toolbar{display:flex;gap:8px;flex-wrap:wrap}.hidden{display:none}@media(max-width:600px){body{padding:14px}h1{font-size:1.8rem}td{padding:5px}}</style><header><p class="muted">AI Engineering from Scratch · local project</p><h1>${escapeHTML(title)}</h1></header><main>${content}</main><script>function download(name,value,type='application/json'){const b=new Blob([typeof value==='string'?value:JSON.stringify(value,null,2)+'\\n'],{type});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}${script}</script></html>`;
}
export function array(value: unknown, label: string): any[] {
  if (!Array.isArray(value)) throw new Error(label + " must be an array");
  return value;
}
export function nonempty(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim())
    throw new Error(label + " must be a nonempty string");
  return value;
}
