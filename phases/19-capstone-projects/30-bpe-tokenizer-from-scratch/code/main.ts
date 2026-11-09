// Lesson: BPE Tokenizer From Scratch (phase 19 / lesson 30)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/19-capstone-projects/30-bpe-tokenizer-from-scratch/docs/en.md
// Run: npx tsx phases/19-capstone-projects/30-bpe-tokenizer-from-scratch/code/main.ts

import { readFileSync, writeFileSync } from "node:fs";

const BYTE_ALPHABET_SIZE = 256;
const DEFAULT_SPECIALS: readonly string[] = ["<|endoftext|>", "<|pad|>"];
const WORD_SPLIT_RE = /\S+|\s+/g;

type Pair = [number, number];

const encoder = new TextEncoder();

function bytesKey(b: Uint8Array): string {
  return Array.from(b).join(",");
}

function pairKey(p: Pair): string {
  return `${p[0]},${p[1]}`;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

class BPETokenizer {
  vocab = new Map<number, Uint8Array>();
  invVocab = new Map<string, number>();
  merges = new Map<string, { pair: Pair; id: number }>();
  specialToId = new Map<string, number>();
  idToSpecial = new Map<number, string>();

  get vocabSize(): number {
    return this.vocab.size;
  }

  addToken(tokenBytes: Uint8Array): number {
    const key = bytesKey(tokenBytes);
    const existing = this.invVocab.get(key);
    if (existing !== undefined) return existing;
    const tokenId = this.vocab.size;
    this.vocab.set(tokenId, tokenBytes);
    this.invVocab.set(key, tokenId);
    return tokenId;
  }

  initialize(specials: Iterable<string> = DEFAULT_SPECIALS): void {
    this.vocab.clear();
    this.invVocab.clear();
    this.merges.clear();
    this.specialToId.clear();
    this.idToSpecial.clear();
    for (let i = 0; i < BYTE_ALPHABET_SIZE; i++) {
      this.addToken(Uint8Array.of(i));
    }
    for (const s of specials) {
      const tokenId = this.vocab.size;
      const b = encoder.encode(s);
      this.vocab.set(tokenId, b);
      this.invVocab.set(bytesKey(b), tokenId);
      this.specialToId.set(s, tokenId);
      this.idToSpecial.set(tokenId, s);
    }
  }
}

function pretokenize(text: string): string[] {
  return text.match(WORD_SPLIT_RE) ?? [];
}

function wordToByteIds(word: string): number[] {
  return Array.from(encoder.encode(word));
}

type Units = Map<string, { symbols: number[]; count: number }>;

function countPairs(corpusUnits: Units): Map<string, { pair: Pair; count: number }> {
  const pairs = new Map<string, { pair: Pair; count: number }>();
  for (const { symbols, count } of corpusUnits.values()) {
    for (let i = 0; i < symbols.length - 1; i++) {
      const pair: Pair = [symbols[i], symbols[i + 1]];
      const key = pairKey(pair);
      const entry = pairs.get(key);
      if (entry) entry.count += count;
      else pairs.set(key, { pair, count });
    }
  }
  return pairs;
}

function applyMerge(symbols: number[], pair: Pair, newId: number): number[] {
  if (symbols.length < 2) return symbols;
  const out: number[] = [];
  let i = 0;
  const [a, b] = pair;
  while (i < symbols.length) {
    if (i < symbols.length - 1 && symbols[i] === a && symbols[i + 1] === b) {
      out.push(newId);
      i += 2;
    } else {
      out.push(symbols[i]);
      i += 1;
    }
  }
  return out;
}

function train(
  tokenizer: BPETokenizer,
  corpus: string,
  targetVocabSize: number,
  specials: Iterable<string> = DEFAULT_SPECIALS,
): void {
  tokenizer.initialize(specials);
  let units = buildInitialUnits(corpus);
  while (tokenizer.vocabSize < targetVocabSize) {
    const pairs = countPairs(units);
    if (pairs.size === 0) break;
    let maxCount = -Infinity;
    for (const { count } of pairs.values()) if (count > maxCount) maxCount = count;
    const candidates = [...pairs.values()]
      .filter((e) => e.count === maxCount)
      .map((e) => e.pair)
      .sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    const best = candidates[0];
    const bestEntry = pairs.get(pairKey(best));
    if (!bestEntry || bestEntry.count < 2) break;
    const left = tokenizer.vocab.get(best[0]);
    const right = tokenizer.vocab.get(best[1]);
    if (!left || !right) break;
    const newId = tokenizer.addToken(concatBytes([left, right]));
    tokenizer.merges.set(pairKey(best), { pair: best, id: newId });
    units = applyMergeToCorpus(units, best, newId);
  }
}

function buildInitialUnits(corpus: string): Units {
  const units: Units = new Map();
  for (const chunk of pretokenize(corpus)) {
    const symbols = wordToByteIds(chunk);
    const key = symbols.join(",");
    const entry = units.get(key);
    if (entry) entry.count += 1;
    else units.set(key, { symbols, count: 1 });
  }
  return units;
}

function applyMergeToCorpus(units: Units, pair: Pair, newId: number): Units {
  const newUnits: Units = new Map();
  for (const { symbols, count } of units.values()) {
    const merged = applyMerge(symbols, pair, newId);
    const key = merged.join(",");
    const entry = newUnits.get(key);
    if (entry) entry.count += count;
    else newUnits.set(key, { symbols: merged, count });
  }
  return newUnits;
}

function encodeChunk(tokenizer: BPETokenizer, chunk: string): number[] {
  let symbols = wordToByteIds(chunk);
  if (symbols.length < 2) return symbols;

  const rankedMerges = new Map<string, number>();
  let r = 0;
  for (const key of tokenizer.merges.keys()) rankedMerges.set(key, r++);

  while (true) {
    let bestRank: number | null = null;
    let bestIndex = -1;
    let bestPair: Pair | null = null;
    for (let i = 0; i < symbols.length - 1; i++) {
      const pair: Pair = [symbols[i], symbols[i + 1]];
      const rank = rankedMerges.get(pairKey(pair));
      if (rank === undefined) continue;
      if (bestRank === null || rank < bestRank) {
        bestRank = rank;
        bestIndex = i;
        bestPair = pair;
      }
    }
    if (bestPair === null) break;
    const merge = tokenizer.merges.get(pairKey(bestPair));
    if (!merge) break;
    symbols = [...symbols.slice(0, bestIndex), merge.id, ...symbols.slice(bestIndex + 2)];
  }
  return symbols;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function encode(tokenizer: BPETokenizer, text: string, allowSpecial = false): number[] {
  if (!allowSpecial) return encodePretokenized(tokenizer, text);
  if (tokenizer.specialToId.size === 0) return encodePretokenized(tokenizer, text);

  const specialsSorted = [...tokenizer.specialToId.keys()].sort((a, b) => b.length - a.length);
  const pattern = new RegExp("(" + specialsSorted.map(escapeRegExp).join("|") + ")");
  const parts = text.split(pattern);

  const out: number[] = [];
  for (const part of parts) {
    if (part === "") continue;
    const sid = tokenizer.specialToId.get(part);
    if (sid !== undefined) out.push(sid);
    else out.push(...encodePretokenized(tokenizer, part));
  }
  return out;
}

function encodePretokenized(tokenizer: BPETokenizer, text: string): number[] {
  const out: number[] = [];
  for (const chunk of pretokenize(text)) out.push(...encodeChunk(tokenizer, chunk));
  return out;
}

function decode(tokenizer: BPETokenizer, ids: number[]): string {
  const pieces: Uint8Array[] = [];
  for (const tokenId of ids) {
    const special = tokenizer.idToSpecial.get(tokenId);
    if (special !== undefined) {
      pieces.push(encoder.encode(special));
      continue;
    }
    const b = tokenizer.vocab.get(tokenId);
    if (b === undefined) throw new Error(`unknown token id: ${tokenId}`);
    pieces.push(b);
  }
  return new TextDecoder("utf-8").decode(concatBytes(pieces));
}

function save(tokenizer: BPETokenizer, path: string): void {
  const vocab: Record<string, number[]> = {};
  for (const [tokenId, tokenBytes] of tokenizer.vocab) vocab[String(tokenId)] = Array.from(tokenBytes);
  const payload = {
    vocab,
    merges: [...tokenizer.merges.values()].map((m) => [[m.pair[0], m.pair[1]], m.id]),
    specials: Object.fromEntries(tokenizer.specialToId),
  };
  writeFileSync(path, JSON.stringify(payload, null, 2), "utf-8");
}

function load(path: string): BPETokenizer {
  const payload = JSON.parse(readFileSync(path, "utf-8")) as {
    vocab: Record<string, number[]>;
    merges: [[number, number], number][];
    specials: Record<string, number>;
  };
  const tokenizer = new BPETokenizer();
  for (const [tokenIdStr, byteList] of Object.entries(payload.vocab)) {
    const tokenId = parseInt(tokenIdStr, 10);
    const tokenBytes = Uint8Array.from(byteList);
    tokenizer.vocab.set(tokenId, tokenBytes);
    tokenizer.invVocab.set(bytesKey(tokenBytes), tokenId);
  }
  for (const [pair, newId] of payload.merges) {
    const p: Pair = [pair[0], pair[1]];
    tokenizer.merges.set(pairKey(p), { pair: p, id: newId });
  }
  for (const [s, tokenId] of Object.entries(payload.specials)) {
    tokenizer.specialToId.set(s, tokenId);
    tokenizer.idToSpecial.set(tokenId, s);
  }
  return tokenizer;
}

const DEMO_CORPUS = `the quick brown fox jumps over the lazy dog
a journey of a thousand miles begins with a single step
the only way to do great work is to love what you do
the best time to plant a tree was twenty years ago
the second best time is now
practice is the bridge between intention and skill
small daily actions compound into large outcomes
read more than you write, write more than you talk
the map is not the territory and the menu is not the meal
what gets measured gets managed if the measurement is honest
the quick brown fox runs across the meadow at dawn
a small step today is better than a perfect plan tomorrow
courage is not the absence of fear it is action despite fear
the lazy dog sleeps under the old oak tree
every expert was once a beginner who refused to quit
focus is saying no to a hundred good ideas
the river that you cannot cross today will be easier tomorrow
practice the basics until the basics become invisible
`.repeat(6);

function pyRepr(s: string): string {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = "";
  for (const ch of s) {
    if (ch === "\\") out += "\\\\";
    else if (ch === quote) out += "\\" + ch;
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else out += ch;
  }
  return quote + out + quote;
}

function pyList(items: (string | number)[]): string {
  return "[" + items.map((x) => (typeof x === "string" ? pyRepr(x) : String(x))).join(", ") + "]";
}

function printSection(title: string): void {
  const bar = "-".repeat(title.length);
  console.log(`\n${title}\n${bar}`);
}

function formatByteToken(tokenBytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true })
      .decode(tokenBytes)
      .replaceAll("\n", "\\n")
      .replaceAll(" ", "·");
  } catch {
    return Buffer.from(tokenBytes).toString("hex");
  }
}

function assert(cond: boolean, msg = ""): void {
  if (!cond) throw new Error(msg);
}

function main(): number {
  const target = 320;
  const tokenizer = new BPETokenizer();
  train(tokenizer, DEMO_CORPUS, target);

  printSection("Vocabulary summary");
  console.log(`target size       : ${target}`);
  console.log(`final vocab size  : ${tokenizer.vocabSize}`);
  console.log(`merges learned    : ${tokenizer.merges.size}`);
  console.log(`special tokens    : ${pyList([...tokenizer.specialToId.keys()])}`);

  const heldOut = "the fox is quick and the dog is lazy";
  const ids = encode(tokenizer, heldOut);
  const roundtrip = decode(tokenizer, ids);

  printSection("Encoding a held-out sentence");
  console.log(`input             : ${pyRepr(heldOut)}`);
  console.log(`encoded ids       : ${pyList(ids)}`);
  console.log(`id count          : ${ids.length} (vs ${encoder.encode(heldOut).length} raw bytes)`);
  console.log(`decoded back      : ${pyRepr(roundtrip)}`);
  assert(roundtrip === heldOut, "round trip must be lossless");

  printSection("Highest-rank learned merges");
  const firstMerges = [...tokenizer.merges.values()].slice(0, 8);
  firstMerges.forEach((m, rank) => {
    const left = formatByteToken(tokenizer.vocab.get(m.pair[0]) ?? new Uint8Array());
    const right = formatByteToken(tokenizer.vocab.get(m.pair[1]) ?? new Uint8Array());
    const merged = formatByteToken(tokenizer.vocab.get(m.id) ?? new Uint8Array());
    console.log(`  rank ${String(rank).padStart(2)}: (${left.padStart(8)}, ${right.padStart(8)}) -> ${merged}`);
  });

  printSection("Special-token handling");
  const withSpecials = "doc one<|endoftext|>doc two";
  const idsSpecial = encode(tokenizer, withSpecials, true);
  assert(idsSpecial.includes(tokenizer.specialToId.get("<|endoftext|>") ?? -1));
  console.log(`input             : ${pyRepr(withSpecials)}`);
  console.log(`encoded ids       : ${pyList(idsSpecial)}`);
  console.log(`decoded back      : ${pyRepr(decode(tokenizer, idsSpecial))}`);

  console.log("\nDemo OK.");
  return 0;
}

export { BPETokenizer, train, encode, decode, save, load };

process.exitCode = main();
