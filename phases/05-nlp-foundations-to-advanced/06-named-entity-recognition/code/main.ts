// Lesson: Named Entity Recognition (phase 05 / lesson 06)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/05-nlp-foundations-to-advanced/06-named-entity-recognition/docs/en.md
// Run: npx tsx phases/05-nlp-foundations-to-advanced/06-named-entity-recognition/code/main.ts

type Span = [number, number, string];

const ORG_GAZETTEER = new Set(["Apple", "Google", "Microsoft", "OpenAI", "Meta", "Amazon", "Netflix", "Anthropic"]);
const GPE_GAZETTEER = new Set(["US", "USA", "UK", "India", "Germany", "France", "Japan"]);
const PRODUCT_GAZETTEER = new Set(["iPhone", "Android", "Windows", "ChatGPT", "Claude", "Gemini"]);

function pyStr(s: string): string {
  const q = s.includes("'") && !s.includes('"') ? '"' : "'";
  return q + s.replaceAll("\\", "\\\\").replaceAll(q, "\\" + q) + q;
}

function pyStrList(items: string[]): string {
  return "[" + items.map(pyStr).join(", ") + "]";
}

function pySpans(spans: Span[]): string {
  return "[" + spans.map(([s, e, l]) => `(${s}, ${e}, ${pyStr(l)})`).join(", ") + "]";
}

function isUpperChar(c: string): boolean {
  return c !== c.toLowerCase() && c === c.toUpperCase();
}

function isLowerChar(c: string): boolean {
  return c !== c.toUpperCase() && c === c.toLowerCase();
}

function isDigitChar(c: string): boolean {
  return /^\p{Nd}$/u.test(c);
}

function isUpper(s: string): boolean {
  let cased = false;
  for (const c of s) {
    if (isLowerChar(c)) return false;
    if (isUpperChar(c)) cased = true;
  }
  return cased;
}

function isTitle(s: string): boolean {
  let cased = false;
  let prevCased = false;
  for (const c of s) {
    if (isUpperChar(c)) {
      if (prevCased) return false;
      prevCased = true;
      cased = true;
    } else if (isLowerChar(c)) {
      if (!prevCased) return false;
      prevCased = true;
      cased = true;
    } else {
      prevCased = false;
    }
  }
  return cased;
}

function wordShape(word: string): string {
  const out: string[] = [];
  for (const c of word) {
    if (isUpperChar(c)) out.push("X");
    else if (isLowerChar(c)) out.push("x");
    else if (isDigitChar(c)) out.push("d");
    else out.push(c);
  }
  return out.join("");
}

function ruleBasedNer(tokens: string[]): string[] {
  const labels: string[] = [];
  for (const token of tokens) {
    if (ORG_GAZETTEER.has(token)) labels.push("B-ORG");
    else if (GPE_GAZETTEER.has(token)) labels.push("B-GPE");
    else if (PRODUCT_GAZETTEER.has(token)) labels.push("B-PRODUCT");
    else labels.push("O");
  }
  return labels;
}

function spansToBio(tokens: string[], spans: Span[]): string[] {
  const labels = new Array<string>(tokens.length).fill("O");
  for (const [start, end, label] of spans) {
    labels[start] = `B-${label}`;
    for (let i = start + 1; i < end; i++) labels[i] = `I-${label}`;
  }
  return labels;
}

function bioToSpans(tokens: string[], labels: string[]): Span[] {
  const spans: Span[] = [];
  let current: Span | null = null;
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    if (label.startsWith("B-")) {
      if (current) spans.push(current);
      current = [i, i + 1, label.slice(2)];
    } else if (label.startsWith("I-") && current && current[2] === label.slice(2)) {
      current = [current[0], i + 1, current[2]];
    } else if (current) {
      spans.push(current);
      current = null;
    }
  }
  if (current) spans.push(current);
  return spans;
}

function tokenFeatures(token: string, prevToken: string | null, nextToken: string | null): Record<string, string | boolean> {
  return {
    lower: token.toLowerCase(),
    is_upper: isUpper(token),
    is_title: isTitle(token),
    has_digit: [...token].some(isDigitChar),
    suffix_3: token.slice(-3).toLowerCase(),
    shape: wordShape(token),
    prev_lower: prevToken ? prevToken.toLowerCase() : "<BOS>",
    next_lower: nextToken ? nextToken.toLowerCase() : "<EOS>",
  };
}

function main(): void {
  const sentence = "Apple sued Google over iPhone sales in the US .".split(/\s+/);
  const labels = ruleBasedNer(sentence);
  const spans = bioToSpans(sentence, labels);

  console.log("tokens  :", pyStrList(sentence));
  console.log("labels  :", pyStrList(labels));
  console.log("spans   :");
  for (const [start, end, kind] of spans) {
    const entity = sentence.slice(start, end).join(" ");
    console.log(`  [${start}:${end}] ${kind.padEnd(8)} ${pyStr(entity)}`);
  }

  console.log();
  console.log("word shapes (useful CRF features):");
  for (const tok of ["Apple", "iPhone", "IBM", "USA-2024", "apple"]) {
    console.log(`  ${tok.padEnd(12)} -> shape ${wordShape(tok)}`);
  }

  console.log();
  console.log("round-trip (spans -> BIO -> spans):");
  const tokens = "The New York City mayor visited OpenAI .".split(/\s+/);
  const goldSpans: Span[] = [
    [1, 4, "GPE"],
    [6, 7, "ORG"],
  ];
  const bio = spansToBio(tokens, goldSpans);
  const recovered = bioToSpans(tokens, bio);
  const match = pySpans(goldSpans) === pySpans(recovered);
  console.log(`  tokens   : ${pyStrList(tokens)}`);
  console.log(`  bio      : ${pyStrList(bio)}`);
  console.log(`  gold     : ${pySpans(goldSpans)}`);
  console.log(`  recovered: ${pySpans(recovered)}`);
  console.log(`  match    : ${match ? "True" : "False"}`);
}

main();

export {};
