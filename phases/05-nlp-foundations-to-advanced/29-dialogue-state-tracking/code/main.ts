// Lesson: Dialogue State Tracking (phase 05 / lesson 29)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/05-nlp-foundations-to-advanced/29-dialogue-state-tracking/docs/en.md
// Run: npx tsx phases/05-nlp-foundations-to-advanced/29-dialogue-state-tracking/code/main.ts

type SlotValue = string | number | null;
type State = Record<string, SlotValue>;

const CUISINE_SYNONYMS: Record<string, string[]> = {
  italian: ["italian", "pasta", "pizza"],
  chinese: ["chinese", "chow mein", "dim sum"],
  indian: ["indian", "curry", "tandoori"],
  thai: ["thai", "pad thai"],
};

const AREA_WORDS = ["north", "south", "east", "west", "center", "centre"];
const PRICE_WORDS: Record<string, string[]> = {
  cheap: ["cheap", "inexpensive", "budget"],
  moderate: ["moderate", "mid-range", "mid range", "medium"],
  expensive: ["expensive", "fancy", "high-end", "upscale"],
};
const CORRECTION_CUES = ["actually", "no wait", "on second thought", "change that to", "instead"];
const NEGATION_CUES = ["never mind", "forget about", "don't worry about"];

function extractCuisine(utterance: string): string | null {
  const low = utterance.toLowerCase();
  for (const [canonical, synonyms] of Object.entries(CUISINE_SYNONYMS)) {
    if (synonyms.some((syn) => low.includes(syn))) {
      return canonical;
    }
  }
  if (low.includes("any cuisine") || low.includes("any food")) {
    return "any";
  }
  return null;
}

function extractArea(utterance: string): string | null {
  const low = utterance.toLowerCase();
  for (const w of AREA_WORDS) {
    if (new RegExp(`\\b${w}\\b`).test(low)) {
      return w === "centre" ? "center" : w;
    }
  }
  return null;
}

function extractPrice(utterance: string): string | null {
  const low = utterance.toLowerCase();
  for (const [canonical, synonyms] of Object.entries(PRICE_WORDS)) {
    if (synonyms.some((syn) => low.includes(syn))) {
      return canonical;
    }
  }
  return null;
}

function extractPeople(utterance: string): number | null {
  const m = /\b(\d+|two|three|four|five|six|seven|eight)\s+(?:people|guests|persons|diners)/.exec(utterance.toLowerCase());
  if (!m) {
    return null;
  }
  const wordToNum: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 };
  const raw = m[1];
  return /^\d+$/.test(raw) ? parseInt(raw, 10) : wordToNum[raw] ?? null;
}

const SLOT_EXTRACTORS: [string, (u: string) => SlotValue][] = [
  ["cuisine", extractCuisine],
  ["area", extractArea],
  ["price", extractPrice],
  ["people", extractPeople],
];

export function isCorrection(utterance: string): boolean {
  return CORRECTION_CUES.some((cue) => utterance.toLowerCase().includes(cue));
}

function isNegation(utterance: string, slot: string): boolean {
  const low = utterance.toLowerCase();
  return NEGATION_CUES.some((cue) => low.includes(cue)) && low.includes(slot);
}

function updateState(state: State, utterance: string): State {
  const newState: State = { ...state };
  for (const [slot, extractor] of SLOT_EXTRACTORS) {
    const value = extractor(utterance);
    if (value !== null) {
      newState[slot] = value;
      continue;
    }
    if (isNegation(utterance, slot)) {
      newState[slot] = null;
    }
  }
  return newState;
}

export function renderDialog(turns: string[]): string {
  return turns.map((u) => `  user: ${u}`).join("\n");
}

function pyRepr(state: State): string {
  const parts = Object.entries(state).map(([k, v]) => {
    let r: string;
    if (v === null) {
      r = "None";
    } else if (typeof v === "string") {
      r = `'${v}'`;
    } else {
      r = String(v);
    }
    return `'${k}': ${r}`;
  });
  return `{${parts.join(", ")}}`;
}

function statesEqual(a: State, b: State): boolean {
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => k in b && a[k] === b[k]);
}

function main(): void {
  const dialogues: { turns: string[]; gold: State }[] = [
    {
      turns: [
        "I want a cheap restaurant in the north.",
        "Italian food please.",
        "Actually make it moderate pricing.",
        "For four people.",
      ],
      gold: { cuisine: "italian", area: "north", price: "moderate", people: 4 },
    },
    {
      turns: [
        "Find me an expensive Chinese place.",
        "In the center of town.",
        "Six guests.",
        "Never mind the cuisine, any food is fine.",
      ],
      gold: { cuisine: "any", area: "center", price: "expensive", people: 6 },
    },
    {
      turns: [
        "Thai food in the south.",
        "For two people.",
        "Moderate price.",
      ],
      gold: { cuisine: "thai", area: "south", price: "moderate", people: 2 },
    },
  ];

  console.log("=== rule-based DST ===");
  let jgaCorrect = 0;
  dialogues.forEach((d, i) => {
    let state: State = { cuisine: null, area: null, price: null, people: null };
    console.log(`\ndialogue ${i}:`);
    for (const turn of d.turns) {
      state = updateState(state, turn);
      console.log(`  user: ${turn}`);
      console.log(`  state: ${pyRepr(state)}`);
    }
    const ok = statesEqual(state, d.gold);
    jgaCorrect += ok ? 1 : 0;
    console.log(`  gold:  ${pyRepr(d.gold)}`);
    console.log(`  match: ${ok ? "  OK" : "MISS"}`);
  });

  console.log();
  console.log(`=== Joint Goal Accuracy: ${jgaCorrect}/${dialogues.length} (${((100 * jgaCorrect) / dialogues.length).toFixed(1)}%) ===`);
  console.log();
  console.log("note: rule-based works in narrow domains with canonical vocabulary.");
  console.log("open-vocab slots (restaurant name, reservation time) need LLM-based DST.");
  console.log("production pattern: regenerate-whole-state with Instructor + Pydantic schema.");
}

main();
