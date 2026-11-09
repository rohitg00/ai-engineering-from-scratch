// Lesson: Building a Tokenizer (phase 10 / lesson 02)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/10-llms-from-scratch/02-building-a-tokenizer/docs/en.md
// Run: npx tsx phases/10-llms-from-scratch/02-building-a-tokenizer/code/main.ts

const GPT2_PATTERN = /'(?:[sdmt]|ll|ve|re)| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+/gu;

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8");

function preTokenize(text: string): string[] {
  return Array.from(text.matchAll(GPT2_PATTERN), (m) => m[0]);
}

function applyMerge(byteSeq: number[], pair: [number, number], newId: number): number[] {
  const merged: number[] = [];
  let i = 0;
  while (i < byteSeq.length) {
    if (i < byteSeq.length - 1 && byteSeq[i] === pair[0] && byteSeq[i + 1] === pair[1]) {
      merged.push(newId);
      i += 2;
    } else {
      merged.push(byteSeq[i]);
      i += 1;
    }
  }
  return merged;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pyStr(s: string): string {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = "";
  for (const ch of s) {
    if (ch === "\\") out += "\\\\";
    else if (ch === quote) out += "\\" + quote;
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else out += ch;
  }
  return quote + out + quote;
}

function pyBytes(b: Uint8Array): string {
  const hasSingle = b.includes(39);
  const hasDouble = b.includes(34);
  const quote = hasSingle && !hasDouble ? 34 : 39;
  let out = "";
  for (const c of b) {
    if (c === quote || c === 92) out += "\\" + String.fromCharCode(c);
    else if (c === 9) out += "\\t";
    else if (c === 10) out += "\\n";
    else if (c === 13) out += "\\r";
    else if (c < 32 || c >= 127) out += "\\x" + c.toString(16).padStart(2, "0");
    else out += String.fromCharCode(c);
  }
  const q = String.fromCharCode(quote);
  return "b" + q + out + q;
}

function pyList(xs: number[]): string {
  return "[" + xs.join(", ") + "]";
}

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

class SpecialTokenHandler {
  specialTokens = new Map<string, number>();
  pattern: RegExp | null = null;

  addToken(tokenStr: string, tokenId: number): void {
    this.specialTokens.set(tokenStr, tokenId);
    const escaped = [...this.specialTokens.keys()].sort((a, b) => b.length - a.length).map(escapeRegex);
    this.pattern = new RegExp(escaped.join("|"), "gu");
  }

  splitWithSpecials(text: string): [string, boolean][] {
    if (!this.pattern) return [[text, false]];
    const parts: [string, boolean][] = [];
    let lastEnd = 0;
    for (const match of text.matchAll(this.pattern)) {
      const start = match.index ?? 0;
      if (start > lastEnd) parts.push([text.slice(lastEnd, start), false]);
      parts.push([match[0], true]);
      lastEnd = start + match[0].length;
    }
    if (lastEnd < text.length) parts.push([text.slice(lastEnd), false]);
    return parts;
  }
}

class ProductionTokenizer {
  merges = new Map<string, [[number, number], number]>();
  vocab = new Map<number, Uint8Array>();
  specialHandler = new SpecialTokenHandler();
  nextId = 256;

  constructor() {
    for (let i = 0; i < 256; i++) this.vocab.set(i, Uint8Array.of(i));
  }

  normalize(text: string): string {
    return text.normalize("NFKC");
  }

  train(text: string, numMerges: number): void {
    text = this.normalize(text);
    const chunks = preTokenize(text);
    let chunkBytes = chunks.map((chunk) => Array.from(encoder.encode(chunk)));

    for (let i = 0; i < numMerges; i++) {
      const pairs = new Map<string, { pair: [number, number]; count: number }>();
      for (const seq of chunkBytes) {
        for (let j = 0; j < seq.length - 1; j++) {
          const key = `${seq[j]},${seq[j + 1]}`;
          const entry = pairs.get(key);
          if (entry) entry.count += 1;
          else pairs.set(key, { pair: [seq[j], seq[j + 1]], count: 1 });
        }
      }
      if (pairs.size === 0) break;
      let best: { pair: [number, number]; count: number } | null = null;
      for (const entry of pairs.values()) {
        if (best === null || entry.count > best.count) best = entry;
      }
      const pair = best!.pair;
      const newId = this.nextId;
      this.nextId += 1;
      this.merges.set(`${pair[0]},${pair[1]}`, [pair, newId]);
      this.vocab.set(newId, concatBytes(this.vocab.get(pair[0])!, this.vocab.get(pair[1])!));
      chunkBytes = chunkBytes.map((seq) => applyMerge(seq, pair, newId));
      console.log(`Merge ${i + 1}: (${pair[0]}, ${pair[1]}) -> ${newId} = ${pyBytes(this.vocab.get(newId)!)}`);
    }
  }

  addSpecialToken(tokenStr: string): number {
    const tokenId = this.nextId;
    this.nextId += 1;
    this.specialHandler.addToken(tokenStr, tokenId);
    this.vocab.set(tokenId, encoder.encode(tokenStr));
    return tokenId;
  }

  encode(text: string): number[] {
    text = this.normalize(text);
    const parts = this.specialHandler.splitWithSpecials(text);
    const allIds: number[] = [];
    for (const [partText, isSpecial] of parts) {
      if (isSpecial) {
        allIds.push(this.specialHandler.specialTokens.get(partText)!);
      } else {
        for (const chunk of preTokenize(partText)) {
          let byteSeq = Array.from(encoder.encode(chunk));
          for (const [pair, newId] of this.merges.values()) {
            byteSeq = applyMerge(byteSeq, pair, newId);
          }
          allIds.push(...byteSeq);
        }
      }
    }
    return allIds;
  }

  decode(ids: number[]): string {
    const parts: Uint8Array[] = [];
    for (const tokenId of ids) {
      const b = this.vocab.get(tokenId);
      if (b) parts.push(b);
    }
    let total = new Uint8Array(0);
    for (const p of parts) total = concatBytes(total, p);
    return decoder.decode(total);
  }

  vocabSize(): number {
    return this.vocab.size;
  }

  getTokenBytes(tokenId: number): Uint8Array {
    return this.vocab.get(tokenId) ?? encoder.encode("<?>");
  }
}

function demoByteEncoding(): void {
  console.log("=".repeat(60));
  console.log("Byte-Level Encoding");
  console.log("=".repeat(60));

  const texts: [string, string][] = [
    ["English", "hello"],
    ["Chinese", "你好"],
    ["Japanese", "こんにちは"],
    ["Emoji", "🔥🌍"],
    ["Mixed", "hello你好🔥"],
    ["Code", "def f(x):"],
  ];

  for (const [label, text] of texts) {
    const b = Array.from(encoder.encode(text));
    const chars = [...text].length;
    const more = b.length > 16 ? "..." : "";
    console.log(
      `${label.padEnd(10)}: ${String(chars).padStart(2)} chars -> ${String(b.length).padStart(2)} bytes -> ${pyList(b.slice(0, 16))}${more}`,
    );
  }
}

function demoPreTokenization(): void {
  console.log("\n" + "=".repeat(60));
  console.log("Pre-Tokenization (GPT-2 Regex)");
  console.log("=".repeat(60));

  const texts = [
    "Hello, world! Don't stop.",
    "def train(model, data):",
    "The price is $3.14 per unit.",
    "  multiple   spaces   here  ",
  ];

  for (const text of texts) {
    const chunks = preTokenize(text);
    console.log(`\n'${text}'`);
    console.log(`  -> [${chunks.map(pyStr).join(", ")}]`);
  }
}

function demoFullTokenizer(): void {
  console.log("\n" + "=".repeat(60));
  console.log("Training Production Tokenizer");
  console.log("=".repeat(60));

  const corpus =
    "The quick brown fox jumps over the lazy dog. " +
    "The quick brown fox runs through the forest. " +
    "Machine learning models process natural language. " +
    "Machine learning transforms how we build software. " +
    "Deep learning models need large datasets to train. " +
    "def train(model, data): return model.fit(data) " +
    "def predict(model, x): return model(x) " +
    "for i in range(100): print(i) ";

  const tok = new ProductionTokenizer();
  tok.train(corpus, 50);

  const bosId = tok.addSpecialToken("<|begin|>");
  const eosId = tok.addSpecialToken("<|end|>");
  const userId = tok.addSpecialToken("<|user|>");
  const asstId = tok.addSpecialToken("<|assistant|>");

  console.log(`\nVocab size: ${tok.vocabSize()}`);
  console.log(`Special tokens: <|begin|>=${bosId}, <|end|>=${eosId}, <|user|>=${userId}, <|assistant|>=${asstId}`);

  console.log("\n" + "=".repeat(60));
  console.log("Encoding Tests");
  console.log("=".repeat(60));

  const testTexts = [
    "The quick brown fox.",
    "你好世界 Hello World",
    "🔥🌍🚀",
    "def foo(x): return x + 1",
    "<|begin|><|user|>Hello<|end|>",
    "Machine learning is powerful.",
  ];

  for (const text of testTexts) {
    const ids = tok.encode(text);
    const decoded = tok.decode(ids);
    const rawBytes = encoder.encode(text).length;
    console.log(`\nInput:   ${text}`);
    console.log(`IDs:     ${pyList(ids.slice(0, 20))}${ids.length > 20 ? "..." : ""}`);
    console.log(`Tokens:  ${ids.length} (from ${rawBytes} bytes, ratio: ${(ids.length / rawBytes).toFixed(2)})`);
    console.log(`Decoded: ${decoded}`);
    console.log(`Round-trip: ${decoded === text ? "PASS" : "FAIL"}`);
  }
}

function demoTiktokenComparison(): void {
  console.log("\ntiktoken not installed. Run: pip install tiktoken");
}

demoByteEncoding();
demoPreTokenization();
demoFullTokenizer();
demoTiktokenComparison();
