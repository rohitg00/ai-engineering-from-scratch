// Lesson: Bias and Representational Harm in LLMs (phase 18 / lesson 20)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/18-ethics-safety-alignment/20-bias-representational-harm/docs/en.md
// Run: npx tsx phases/18-ethics-safety-alignment/20-bias-representational-harm/code/main.ts

export {};

type Emb = Map<string, number[]>;

let EMB: Emb = new Map([
  ["he", [1.0, 0.0, 0.2, 0.0]],
  ["his", [0.9, 0.0, 0.1, 0.0]],
  ["man", [1.0, 0.0, 0.1, 0.1]],
  ["she", [0.0, 1.0, 0.0, 0.2]],
  ["her", [0.0, 0.9, 0.0, 0.1]],
  ["woman", [0.0, 1.0, 0.1, 0.2]],
  ["engineer", [0.4, 0.0, 1.0, 0.0]],
  ["programmer", [0.4, 0.0, 1.0, 0.0]],
  ["scientist", [0.3, 0.0, 1.0, 0.1]],
  ["nurse", [0.0, 0.4, 0.0, 1.0]],
  ["teacher", [0.0, 0.3, 0.1, 1.0]],
  ["caregiver", [0.0, 0.4, 0.0, 1.0]],
]);

function fmt(x: number, d: number): string {
  const full = Math.abs(x).toFixed(Math.min(100, d + 30));
  const cut = full.indexOf(".") + 1 + d;
  const tail = full.slice(cut);
  let body: string;
  if (/^50*$/.test(tail)) {
    const lo = Number(full.slice(0, cut));
    const last = Number(full[cut - 1]);
    body = (last % 2 === 0 ? lo : lo + Math.pow(10, -d)).toFixed(d);
  } else {
    body = Math.abs(x).toFixed(d);
  }
  return (x < 0 || Object.is(x, -0) ? "-" : "") + body;
}

function fmtSigned(x: number, d: number): string {
  const s = fmt(x, d);
  return s.startsWith("-") ? s : "+" + s;
}

function vec(w: string): number[] {
  const v = EMB.get(w);
  if (v === undefined) {
    throw new Error(`KeyError: ${w}`);
  }
  return v;
}

function cos(u: number[], v: number[]): number {
  const nu = Math.sqrt(u.reduce((s, x) => s + x * x, 0)) + 1e-9;
  const nv = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) + 1e-9;
  let dot = 0;
  for (let i = 0; i < Math.min(u.length, v.length); i++) {
    dot += u[i] * v[i];
  }
  return dot / (nu * nv);
}

function weatScore(identityA: string[], identityB: string[], attrX: string[], attrY: string[]): number {
  const s = (w: string): number => {
    const mx = attrX.reduce((acc, a) => acc + cos(vec(w), vec(a)), 0) / attrX.length;
    const my = attrY.reduce((acc, a) => acc + cos(vec(w), vec(a)), 0) / attrY.length;
    return mx - my;
  };
  const meanA = identityA.reduce((acc, w) => acc + s(w), 0) / identityA.length;
  const meanB = identityB.reduce((acc, w) => acc + s(w), 0) / identityB.length;
  return meanA - meanB;
}

function debias(emb: Emb): Emb {
  const next: Emb = new Map(Array.from(emb, ([k, v]) => [k, [...v]]));
  const genderDir = [1.0, -1.0, 0.0, 0.0];
  const normSq = genderDir.reduce((s, x) => s + x * x, 0);
  for (const w of ["engineer", "programmer", "scientist",
    "nurse", "teacher", "caregiver"]) {
    const v = next.get(w) ?? [];
    let dot = 0;
    for (let i = 0; i < v.length; i++) {
      dot += v[i] * genderDir[i];
    }
    const proj = dot / normSq;
    next.set(w, v.map((a, i) => a - proj * genderDir[i]));
  }
  return next;
}

function main(): void {
  console.log("=".repeat(70));
  console.log("TOY WEAT BIAS PROBE (Phase 18, Lesson 20)");
  console.log("=".repeat(70));

  const A = ["he", "his", "man"];
  const B = ["she", "her", "woman"];
  const X = ["engineer", "programmer", "scientist"];
  const Y = ["nurse", "teacher", "caregiver"];

  const pre = weatScore(A, B, X, Y);
  console.log(`\npre-debias WEAT effect size : ${fmtSigned(pre, 4)}`);
  console.log("(positive means identity A associates more with X than B does.)");

  EMB = debias(EMB);
  const post = weatScore(A, B, X, Y);
  console.log(`post-debias WEAT effect size: ${fmtSigned(post, 4)}`);

  console.log("\n" + "=".repeat(70));
  console.log("TAKEAWAY: embedding-based bias is measurable and partially reducible");
  console.log("by projecting out gender-correlated directions. the metric does not");
  console.log("drop to zero because the toy is 4-d; real debiasing (Bolukbasi 2016)");
  console.log("operates on 300-d embeddings and reduces but does not eliminate");
  console.log("the effect. probability- and generated-text-based metrics are");
  console.log("required to capture the behavioural bias residual.");
  console.log("=".repeat(70));
}

main();
