// Lesson: Structured Outputs & Constrained Decoding (phase 05 / lesson 20)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/05-nlp-foundations-to-advanced/20-structured-outputs-constrained-decoding/docs/en.md
// Run: npx tsx phases/05-nlp-foundations-to-advanced/20-structured-outputs-constrained-decoding/code/main.ts

type Random = () => number;

const PHONE_REGEX = "^\\d{3}-\\d{3}-\\d{4}$";

function mulberry32(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(rng: Random, mu: number, sigma: number): number {
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  return mu + sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

class PhoneFSM {
  acceptState: number;

  constructor() {
    this.acceptState = 12;
  }

  validNext(state: number): string[] {
    if ([0, 1, 2, 4, 5, 6, 8, 9, 10, 11].includes(state)) return [..."0123456789"];
    if (state === 3 || state === 7) return ["-"];
    if (state === 12) return [];
    throw new Error(`unknown state ${state}`);
  }

  transition(state: number, ch: string): number | null {
    if (!this.validNext(state).includes(ch)) return null;
    return state + 1;
  }

  isAccept(state: number): boolean {
    return state === this.acceptState;
  }
}

function softmax(xs: number[]): number[] {
  const finite = xs.filter((x) => x !== -Infinity);
  if (finite.length === 0) return xs.map(() => 0.0);
  const m = Math.max(...finite);
  const exps = xs.map((x) => (x !== -Infinity ? Math.exp(x - m) : 0.0));
  let z = 0;
  for (const e of exps) z += e;
  return exps.map((e) => e / z);
}

function sample(probs: number[], rng: Random): number {
  const r = rng();
  let acc = 0.0;
  for (let i = 0; i < probs.length; i++) {
    acc += probs[i];
    if (r <= acc) return i;
  }
  return probs.length - 1;
}

function maskLogits(logits: number[], validIndices: Set<number>): number[] {
  return logits.map((l, i) => (validIndices.has(i) ? l : -Infinity));
}

function fakeLlmLogits(alphabet: string[], rng: Random): number[] {
  return alphabet.map(() => gauss(rng, 0.0, 1.5));
}

function generateConstrained(alphabet: string[], fsm: PhoneFSM, seed: number): string {
  const rng = mulberry32(seed);
  const alphabetIdx = new Map(alphabet.map((ch, i): [string, number] => [ch, i]));
  let state: number | null = 0;
  let out = "";
  while (!fsm.isAccept(state)) {
    const logits = fakeLlmLogits(alphabet, rng);
    const validChars = fsm.validNext(state);
    if (validChars.length === 0) break;
    const validIds = new Set(validChars.map((ch) => alphabetIdx.get(ch)!));
    const masked = maskLogits(logits, validIds);
    const probs = softmax(masked);
    const pick = sample(probs, rng);
    const ch = alphabet[pick];
    out += ch;
    state = fsm.transition(state, ch);
    if (state === null) break;
  }
  return out;
}

function generateUnconstrained(alphabet: string[], maxLen: number, seed: number): string {
  const rng = mulberry32(seed);
  let out = "";
  for (let i = 0; i < maxLen; i++) {
    const logits = fakeLlmLogits(alphabet, rng);
    const probs = softmax(logits);
    const pick = sample(probs, rng);
    out += alphabet[pick];
  }
  return out;
}

function main(): void {
  const alphabet = [..."0123456789-"];
  const fsm = new PhoneFSM();
  const phone = new RegExp(PHONE_REGEX);

  console.log("=== phone number generation: 20 samples ===");
  console.log(`target pattern: ${PHONE_REGEX}`);
  console.log();

  console.log("UNCONSTRAINED (random-logit, no masking):");
  let uncValid = 0;
  for (let seed = 0; seed < 20; seed++) {
    const s = generateUnconstrained(alphabet, 12, seed);
    const ok = phone.test(s);
    uncValid += ok ? 1 : 0;
    const tag = ok ? "  OK" : "FAIL";
    console.log(`  [${tag}] ${s}`);
  }
  console.log(`  => valid: ${uncValid} / 20`);

  console.log();
  console.log("CONSTRAINED (FSM-masked logits):");
  let conValid = 0;
  for (let seed = 0; seed < 20; seed++) {
    const s = generateConstrained(alphabet, fsm, seed);
    const ok = phone.test(s);
    conValid += ok ? 1 : 0;
    const tag = ok ? "  OK" : "FAIL";
    console.log(`  [${tag}] ${s}`);
  }
  console.log(`  => valid: ${conValid} / 20`);

  console.log();
  console.log("note: the toy LLM emits uniform-random logits.");
  console.log("masking invalid tokens at each step is the only difference.");
  console.log("real constrained decoding uses the same mask over a 100k+ vocabulary.");
}

main();

export {};
