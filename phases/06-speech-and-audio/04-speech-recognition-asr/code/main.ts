// Lesson: Speech Recognition (ASR): CTC, RNN-T, Attention (phase 06 / lesson 04)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/06-speech-and-audio/04-speech-recognition-asr/docs/en.md
// Run: npx tsx phases/06-speech-and-audio/04-speech-recognition-asr/code/main.ts

type Random = () => number;

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

let rng: Random = mulberry32(0);

function seed(value: number): void {
  rng = mulberry32(value);
}

function randrange(n: number): number {
  return Math.floor(rng() * n);
}

function pyFixed(x: number, d: number): string {
  if (Number.isNaN(x)) {
    return "nan";
  }
  if (!Number.isFinite(x)) {
    return x > 0 ? "inf" : "-inf";
  }
  const neg = x < 0 || Object.is(x, -0);
  const a = Math.abs(x);
  let s = a.toFixed(d);
  if (a < 1e21) {
    const extra = Math.min(100, d + 30);
    const full = a.toFixed(extra);
    const cut = full.length - (extra - d);
    if (/^50*$/.test(full.slice(cut))) {
      const trunc = full.slice(0, cut).replace(/\.$/, "");
      const last = trunc.charCodeAt(trunc.length - 1) - 48;
      if (last % 2 === 0) {
        s = trunc;
      }
    }
  }
  return (neg ? "-" : "") + s;
}

const BLANK = 0;
const VOCAB = "_abcdefghijklmnopqrstuvwxyz ";

function argmax(xs: number[]): number {
  let best = 0;
  for (let i = 1; i < xs.length; i++) {
    if (xs[i] > xs[best]) {
      best = i;
    }
  }
  return best;
}

function ctcGreedy(frameProbs: number[][]): string {
  const preds = frameProbs.map(argmax);
  const out: number[] = [];
  let prev = -1;
  for (const p of preds) {
    if (p !== prev && p !== BLANK) {
      out.push(p);
    }
    prev = p;
  }
  return out.map((i) => VOCAB[i]).join("");
}

function ctcBeam(frameProbs: number[][], beamWidth = 8): string {
  let beams: [number[], number][] = [[[], 0.0]];
  for (const p of frameProbs) {
    const logP = p.map((pi) => Math.log(Math.max(pi, 1e-10)));
    const newBeams = new Map<string, [number[], number]>();
    for (const [seq, lp] of beams) {
      logP.forEach((lpt, t) => {
        let newSeq: number[];
        if (t === BLANK) {
          newSeq = seq;
        } else if (seq.length > 0 && seq[seq.length - 1] === t) {
          newSeq = seq;
        } else {
          newSeq = [...seq, t];
        }
        const key = newSeq.join(",");
        const existing = newBeams.get(key);
        if (existing !== undefined) {
          existing[1] = Math.log(Math.exp(existing[1]) + Math.exp(lp + lpt));
        } else {
          newBeams.set(key, [newSeq, lp + lpt]);
        }
      });
    }
    beams = [...newBeams.values()].sort((a, b) => -a[1] - -b[1]).slice(0, beamWidth);
  }
  const best = beams[0][0];
  return best.map((i) => VOCAB[i]).join("");
}

function wer(ref: string, hyp: string): number {
  const r = ref.split(/\s+/).filter((w) => w.length > 0);
  const h = hyp.split(/\s+/).filter((w) => w.length > 0);
  const nr = r.length;
  if (nr === 0) {
    return h.length === 0 ? 0.0 : 1.0;
  }
  const dp: number[][] = [];
  for (let i = 0; i <= nr; i++) {
    dp.push(new Array<number>(h.length + 1).fill(0));
  }
  for (let i = 0; i <= nr; i++) {
    dp[i][0] = i;
  }
  for (let j = 0; j <= h.length; j++) {
    dp[0][j] = j;
  }
  for (let i = 1; i <= nr; i++) {
    for (let j = 1; j <= h.length; j++) {
      const cost = r[i - 1] === h[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[nr][h.length] / nr;
}

function oneHotLike(char: string, noise = 0.02, vocabSize = VOCAB.length): number[] {
  const base = new Array<number>(vocabSize).fill(noise);
  const idx = VOCAB.indexOf(char);
  base[idx] = 1.0 - noise * (vocabSize - 1);
  return base;
}

function buildFrameProbs(target: string, durationPerChar = 3, blankRuns = 1): number[][] {
  seed(0);
  const frames: number[][] = [];
  for (const c of target) {
    for (let r = 0; r < durationPerChar; r++) {
      frames.push(oneHotLike(c));
    }
    for (let r = 0; r < blankRuns; r++) {
      frames.push(oneHotLike("_"));
    }
  }
  return frames;
}

function corrupt(probs: number[][], nSwaps = 3, swapStrength = 0.4): number[][] {
  seed(1);
  const out = probs.map((p) => [...p]);
  for (let r = 0; r < nSwaps; r++) {
    const i = randrange(out.length);
    const j1 = randrange(out[i].length);
    const j2 = randrange(out[i].length);
    const swap = swapStrength;
    out[i][j1] -= swap;
    out[i][j2] += swap;
  }
  return out;
}

function main(): void {
  const target = "hello world";
  console.log("=== Step 1: build per-frame CTC outputs for target ===");
  console.log(`  target: '${target}'`);
  const probs = buildFrameProbs(target, 3, 1);
  console.log(`  frames: ${probs.length}  vocab: ${VOCAB.length}  (index 0 = blank)`);

  console.log();
  console.log("=== Step 2: greedy decode (collapse repeats, drop blank) ===");
  const greedy = ctcGreedy(probs);
  console.log(`  greedy decode: '${greedy}'`);

  console.log();
  console.log("=== Step 3: beam search decode (width 8, simplified) ===");
  const beam = ctcBeam(probs, 8);
  console.log(`  beam decode:   '${beam}'`);
  console.log("  note: this beam merges consecutive repeats without a blank-intervene state;");
  console.log("  a proper prefix-tree beam (e.g. ctcdecode) tracks P_blank / P_nonblank and");
  console.log("  preserves double letters like the two l's in 'hello'.");

  console.log();
  console.log("=== Step 4: corrupt logits; beam should beat greedy ===");
  const corrupted = corrupt(probs, 6, 0.6);
  const g2 = ctcGreedy(corrupted);
  const b2 = ctcBeam(corrupted, 16);
  console.log(`  greedy: '${g2}'`);
  console.log(`  beam:   '${b2}'`);

  console.log();
  console.log("=== Step 5: WER ===");
  const ref = "hello world this is a test";
  const hyps: [string, string][] = [
    ["perfect", "hello world this is a test"],
    ["one substit", "hello world this is the test"],
    ["one deletion", "hello world this a test"],
    ["one insert", "hello world this is a big test"],
    ["garbage", "bye everyone nothing here"],
  ];
  for (const [label, hyp] of hyps) {
    console.log(`  ${label.padEnd(14)} WER = ${pyFixed(wer(ref, hyp), 3)}  hyp='${hyp}'`);
  }

  console.log();
  console.log("=== Step 6: best model on LibriSpeech test-clean (2026) ===");
  const table: [string, number, string][] = [
    ["Parakeet-TDT-1.1B", 1.4, "1.1B"],
    ["Canary-1B Flash", 1.48, "1B"],
    ["Whisper-L-v3-turbo", 1.58, "809M"],
    ["Seamless M4T v2", 1.7, "2.3B"],
    ["wav2vec 2.0 Large", 1.92, "317M"],
  ];
  console.log("  | Model                 | WER  | Params |");
  for (const [name, w, p] of table) {
    console.log(`  | ${name.padEnd(21)} | ${pyFixed(w, 2)} | ${p.padEnd(6)} |`);
  }
}

main();
