// Lesson: Attention Mechanism: The Breakthrough (phase 05 / lesson 10)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/05-nlp-foundations-to-advanced/10-attention-mechanism/docs/en.md
// Run: npx tsx phases/05-nlp-foundations-to-advanced/10-attention-mechanism/code/main.ts

function pyFixed(x: number, d: number): string {
  if (Object.is(x, -0)) return "-" + (0).toFixed(d);
  const wide = Math.abs(x).toFixed(Math.min(100, d + 25));
  const dot = wide.indexOf(".");
  const cut = dot + 1 + d;
  if (/^50*$/.test(wide.slice(cut))) {
    const head = wide.slice(0, d === 0 ? dot : cut);
    if (Number(head[head.length - 1]) % 2 === 0) return (x < 0 ? "-" : "") + head;
  }
  return x.toFixed(d);
}

function pyFloat(x: number): string {
  return Number.isInteger(x) ? x.toFixed(1) : String(x);
}

function softmax(scores: number[]): number[] {
  const m = Math.max(...scores);
  const exps = scores.map((s) => Math.exp(s - m));
  let total = 0;
  for (const e of exps) total += e;
  return exps.map((e) => e / total);
}

function dot(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error(`dot: length mismatch ${a.length} vs ${b.length}`);
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function dotAttention(decoderState: number[], encoderStates: number[][]): [number[], number[]] {
  if (encoderStates.length === 0) throw new Error("dot_attention: encoder_states must not be empty");
  const dS = decoderState.length;
  encoderStates.forEach((h, i) => {
    if (h.length !== dS) {
      throw new Error(`dot_attention: encoder_states[${i}] length ${h.length} != decoder_state length ${dS}`);
    }
  });
  const scores = encoderStates.map((h) => dot(decoderState, h));
  const weights = softmax(scores);
  const dim = encoderStates[0].length;
  const context = new Array<number>(dim).fill(0.0);
  weights.forEach((w, k) => {
    const h = encoderStates[k];
    for (let d = 0; d < dim; d++) context[d] += w * h[d];
  });
  return [context, weights];
}

function matvec(M: number[][], v: number[]): number[] {
  M.forEach((row, i) => {
    if (row.length !== v.length) throw new Error(`matvec: row ${i} length ${row.length} != vector length ${v.length}`);
  });
  return M.map((row) => {
    let s = 0;
    for (let j = 0; j < v.length; j++) s += row[j] * v[j];
    return s;
  });
}

function tanhVec(v: number[]): number[] {
  return v.map((x) => Math.tanh(x));
}

function additiveAttention(
  decoderState: number[],
  encoderStates: number[][],
  Wa: number[][],
  Ua: number[][],
  va: number[],
): [number[], number[]] {
  const projectedDec = matvec(Wa, decoderState);
  const scores: number[] = [];
  for (const h of encoderStates) {
    const projectedEnc = matvec(Ua, h);
    const combined = tanhVec(va.map((_, i) => projectedEnc[i] + projectedDec[i]));
    scores.push(dot(va, combined));
  }
  const weights = softmax(scores);
  const dim = encoderStates[0].length;
  const context = new Array<number>(dim).fill(0.0);
  weights.forEach((w, k) => {
    const h = encoderStates[k];
    for (let d = 0; d < dim; d++) context[d] += w * h[d];
  });
  return [context, weights];
}

function main(): void {
  const H = [
    [1.0, 0.0, 0.2],
    [0.5, 0.5, 0.1],
    [0.1, 0.9, 0.3],
  ];
  const positions = ["cat", "sat", "mat"];
  const pretty = (weights: number[]): string =>
    "{" + positions.map((p, i) => `'${p}': ${pyFloat(Number(pyFixed(weights[i], 3)))}`).join(", ") + "}";

  console.log("=== Luong dot attention ===");
  const dotCases: [string, number[]][] = [
    ["close to 'cat'", [0.9, 0.1, 0.2]],
    ["close to 'mat'", [0.1, 0.9, 0.3]],
    ["neutral", [0.4, 0.4, 0.2]],
  ];
  for (const [name, s] of dotCases) {
    const [, weights] = dotAttention(s, H);
    console.log(`  decoder state ${name.padEnd(20)} -> weights ${pretty(weights)}`);
  }

  console.log();
  console.log("=== Bahdanau additive attention (d_attn=2) ===");
  const Wa = [
    [0.6, 0.3, 0.1],
    [0.1, 0.5, 0.4],
  ];
  const Ua = [
    [0.5, 0.2, 0.3],
    [0.2, 0.6, 0.2],
  ];
  const va = [0.8, 0.6];
  for (const [name, s] of dotCases.slice(0, 2)) {
    const [, weights] = additiveAttention(s, H, Wa, Ua, va);
    console.log(`  decoder state ${name.padEnd(20)} -> weights ${pretty(weights)}`);
  }
}

main();

export {};
