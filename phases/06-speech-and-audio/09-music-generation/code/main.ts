// Lesson: Music Generation: MusicGen, Stable Audio, Suno, and the Licensing Earthquake (phase 06 / lesson 09)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/06-speech-and-audio/09-music-generation/docs/en.md
// Run: npx tsx phases/06-speech-and-audio/09-music-generation/code/main.ts

const MAJOR_KEYS: Record<string, string[]> = {
  C: ["C", "Dm", "Em", "F", "G", "Am", "Bdim"],
  G: ["G", "Am", "Bm", "C", "D", "Em", "F#dim"],
  D: ["D", "Em", "F#m", "G", "A", "Bm", "C#dim"],
  A: ["A", "Bm", "C#m", "D", "E", "F#m", "G#dim"],
};

const COMMON_PROGRESSIONS: Record<string, number[]> = {
  pop: [1, 5, 6, 4],
  ballad: [1, 6, 4, 5],
  jazz: [2, 5, 1, 6],
  rock: [1, 4, 5, 1],
  lofi: [6, 4, 1, 5],
};

const DRUM_PATTERNS: Record<string, string> = {
  pop: "X.o.X.o.X.o.X.o.",
  rock: "X..oX..oX..oX..o",
  lofi: "X...o...X...o.o.",
  jazz: "X.oox.oxX.oox.ox",
  trap: "Xooox.oxXooox.ox",
};

interface Piece {
  key: string;
  genre: string;
  bpm: number;
  bars: number;
  chords: string[];
  drums: string;
}

function chordProgression(key: string, genre: string, bars = 8): string[] {
  const scale = MAJOR_KEYS[key];
  const pat = COMMON_PROGRESSIONS[genre] ?? COMMON_PROGRESSIONS.pop;
  const repeats = Math.floor(bars / pat.length) + 1;
  const seq: number[] = [];
  for (let r = 0; r < repeats; r++) {
    seq.push(...pat);
  }
  return seq.slice(0, bars).map((i) => scale[i - 1]);
}

function drumPattern(genre: string, bars = 8): string {
  const base = DRUM_PATTERNS[genre] ?? DRUM_PATTERNS.pop;
  return base.repeat(bars).slice(0, bars * 16);
}

function fakeGenerate(prompt: string): Piece {
  const promptLower = prompt.toLowerCase();
  let key = "C";
  for (const k of Object.keys(MAJOR_KEYS)) {
    if ((" " + promptLower).includes(` ${k.toLowerCase()}`)) {
      key = k;
      break;
    }
  }
  let genre = "pop";
  for (const g of Object.keys(COMMON_PROGRESSIONS)) {
    if (promptLower.includes(g)) {
      genre = g;
      break;
    }
  }
  const bars = 8;
  let bpm = 120;
  const tokens = promptLower.split(/\s+/).filter((t) => t.length > 0);
  tokens.forEach((token, i) => {
    if (token.endsWith("bpm")) {
      const num = token.slice(0, -3) || (i > 0 ? tokens[i - 1] : "");
      if (/^[+-]?\d+$/.test(num)) {
        bpm = parseInt(num, 10);
      }
    }
  });
  return {
    key,
    genre,
    bpm,
    bars,
    chords: chordProgression(key, genre, bars),
    drums: drumPattern(genre, bars),
  };
}

function visualize(piece: Piece): void {
  console.log(`  key: ${piece.key}  genre: ${piece.genre}  tempo: ${piece.bpm} bpm  bars: ${piece.bars}`);
  console.log(`  chords: ${piece.chords.join(" | ")}`);
  const drum = piece.drums;
  console.log(`  drums (kick=X snare=o): ${drum}`);
}

function main(): void {
  const prompts = [
    "upbeat pop in G major at 128 bpm",
    "slow lofi groove in C",
    "rock anthem in D at 140 bpm",
    "jazz swing in A",
  ];

  console.log("=== Step 1: prompt → symbolic music piece (toy) ===");
  for (const p of prompts) {
    console.log(`prompt: '${p}'`);
    const piece = fakeGenerate(p);
    visualize(piece);
    console.log();
  }

  console.log("=== Step 2: 2026 music-gen model cheatsheet ===");
  const models: [string, number, string, string, string][] = [
    ["MusicGen-large", 3300, "30 s", "no", "MIT"],
    ["Stable Audio Open", 1200, "47 s", "no", "non-commercial"],
    ["ACE-Step XL (Apr 26)", 4000, "2 min+", "yes", "Apache-2.0"],
    ["YuE", 7000, "2 min+", "yes", "Apache-2.0"],
    ["Suno v5 (closed)", 0, "4 min", "yes", "commercial"],
    ["Udio v4 (closed)", 0, "4 min", "yes + stems", "commercial"],
  ];
  console.log("  | model               | params (M) | length | vocals | license        |");
  for (const [name, p, length, v, lic] of models) {
    console.log(`  | ${name.padEnd(20)} | ${String(p).padStart(10)} | ${length.padStart(6)} | ${v.padEnd(12)} | ${lic.padEnd(14)} |`);
  }

  console.log();
  console.log("takeaways:");
  console.log("  - open models: MusicGen (instrumental), ACE-Step / YuE (full song)");
  console.log("  - commercial: Suno v5 = quality leader; Udio v4 = producer tools (stems + inpaint)");
  console.log("  - legal: Warner + UMG settlements (2025-2026) define safe zones");
  console.log("  - always tag AI-generated music with watermark + metadata disclosure");
}

main();
