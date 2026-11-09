// Lesson: Experiment Runner (phase 19 / lesson 52)
// TypeScript port of code/experiments/crashing_experiment.py. Node standard library only.
// Source: phases/19-capstone-projects/52-experiment-runner/docs/en.md
// Run: npx tsx phases/19-capstone-projects/52-experiment-runner/code/main.ts

class PyFloat {
  constructor(readonly v: number) {}
}

type Json = null | boolean | number | string | PyFloat | Json[] | { [key: string]: Json };
type Obj = { [key: string]: Json };

function pyFloatRepr(x: number): string {
  if (Number.isNaN(x)) return "NaN";
  if (!Number.isFinite(x)) return x > 0 ? "Infinity" : "-Infinity";
  if (x === 0) return Object.is(x, -0) ? "-0.0" : "0.0";
  const [mant, expStr] = x.toExponential().split("e");
  const exp = Number(expStr);
  const neg = mant.startsWith("-");
  const digits = mant.replace("-", "").replace(".", "");
  let body: string;
  if (exp < -4 || exp >= 16) {
    const frac = digits.length > 1 ? "." + digits.slice(1) : "";
    body = digits[0] + frac + "e" + (exp < 0 ? "-" : "+") + String(Math.abs(exp)).padStart(2, "0");
  } else if (exp < 0) {
    body = "0." + "0".repeat(-exp - 1) + digits;
  } else if (digits.length <= exp + 1) {
    body = digits + "0".repeat(exp + 1 - digits.length) + ".0";
  } else {
    body = digits.slice(0, exp + 1) + "." + digits.slice(exp + 1);
  }
  return (neg ? "-" : "") + body;
}

function jsonStr(s: string): string {
  return (
    '"' +
    s.replace(/[\\"\u0000-\u001f\u007f-￿]/g, (c) => {
      if (c === '"') return '\\"';
      if (c === "\\") return "\\\\";
      if (c === "\n") return "\\n";
      if (c === "\r") return "\\r";
      if (c === "\t") return "\\t";
      if (c === "\b") return "\\b";
      if (c === "\f") return "\\f";
      return "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0");
    }) +
    '"'
  );
}

function pyDumps(v: Json, indent: number | null = null, level = 0): string {
  if (v === null) return "null";
  if (v === true) return "true";
  if (v === false) return "false";
  if (v instanceof PyFloat) return pyFloatRepr(v.v);
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : pyFloatRepr(v);
  if (typeof v === "string") return jsonStr(v);
  let open: string;
  let close: string;
  let items: string[];
  if (Array.isArray(v)) {
    if (v.length === 0) return "[]";
    open = "[";
    close = "]";
    items = v.map((x) => pyDumps(x, indent, level + 1));
  } else {
    const keys = Object.keys(v);
    if (keys.length === 0) return "{}";
    open = "{";
    close = "}";
    items = keys.map((k) => jsonStr(k) + ": " + pyDumps(v[k], indent, level + 1));
  }
  if (indent === null) return open + items.join(", ") + close;
  const pad = "\n" + " ".repeat(indent * (level + 1));
  return open + pad + items.join("," + pad) + "\n" + " ".repeat(indent * level) + close;
}

function main(): number {
  console.log(pyDumps({ step: 0, note: "about to fail" }));
  console.error("trace: simulated failure");
  return 3;
}

process.exitCode = main();

export {};
