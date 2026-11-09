// Lesson: Capstone 12, Video Understanding Pipeline (Scene, QA, Search) (phase 19 / lesson 12)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/19-capstone-projects/12-video-understanding-pipeline/docs/en.md
// Run: npx tsx phases/19-capstone-projects/12-video-understanding-pipeline/code/main.ts

import { createHash } from "node:crypto";

const EMB_DIM = 24;

function tokenize(s: string): string[] {
  return s.toLowerCase().match(/\w+/g) ?? [];
}

function stableHash(tok: string): number {
  return createHash("md5").update(tok, "utf8").digest().readUInt32BE(0);
}

function fakeEmbed(text: string): number[] {
  const v: number[] = new Array(EMB_DIM).fill(0);
  for (const tok of tokenize(text)) {
    const h = stableHash(tok);
    v[h % EMB_DIM] += 1.0;
    v[(h >>> 8) % EMB_DIM] += 0.5;
  }
  const n = Math.sqrt(v.reduce((acc, x) => acc + x * x, 0)) || 1.0;
  return v.map((x) => x / n);
}

function cosine(a: number[], b: number[]): number {
  let s = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) s += a[i] * b[i];
  return s;
}

class Scene {
  captionEmb: number[] = [];
  frameEmb: number[] = [];
  transcriptEmb: number[] = [];

  constructor(
    public videoId: string,
    public sceneId: number,
    public startMs: number,
    public endMs: number,
    public caption: string,
    public transcript: string,
    public frameTags: string,
  ) {}

  embed(): void {
    this.captionEmb = fakeEmbed(this.caption);
    this.frameEmb = fakeEmbed(this.frameTags);
    this.transcriptEmb = fakeEmbed(this.transcript);
  }
}

const SAMPLE: Scene[] = [
  new Scene("vid_001", 0, 0, 32_000, "sunrise over skyline, drone footage",
    "we start here in tokyo",
    "skyline buildings dawn orange sky haze"),
  new Scene("vid_001", 1, 32_000, 68_000, "busy intersection with pedestrians",
    "shibuya crossing after sunrise",
    "street people walking cars traffic signal"),
  new Scene("vid_001", 2, 68_000, 132_000, "cars stopped at a red light",
    "let me count the vehicles approaching",
    "cars red light queue crossing lanes"),
  new Scene("vid_001", 3, 132_000, 170_000, "kitchen scene chef pouring then stirring",
    "first we pour then we stir it slowly",
    "chef pan stove pour stir ingredient"),
  new Scene("vid_001", 4, 170_000, 210_000, "chef plating the finished dish",
    "plated presentation of the dish",
    "plate garnish spoon finishing dish"),
  new Scene("vid_002", 0, 0, 40_000, "ocean waves at sunset",
    "beautiful evening at the shore",
    "ocean waves sunset sky shore"),
];

function multiVectorSearch(query: string, scenes: Scene[], k = 5): [Scene, number][] {
  const qv = fakeEmbed(query);
  const byKey = (f: (s: Scene) => number[]) =>
    [...scenes].sort((a, b) => -cosine(qv, f(a)) - -cosine(qv, f(b)));
  const scoredCaption = byKey((s) => s.captionEmb);
  const scoredFrame = byKey((s) => s.frameEmb);
  const scoredTranscript = byKey((s) => s.transcriptEmb);

  const fused = new Map<string, number>();
  const index = new Map<string, Scene>();
  for (const ranks of [scoredCaption, scoredFrame, scoredTranscript]) {
    ranks.forEach((sc, rank) => {
      const key = `${sc.videoId}\u0000${sc.sceneId}`;
      fused.set(key, (fused.get(key) ?? 0) + 1.0 / (60 + rank + 1));
      index.set(key, sc);
    });
  }

  const ranked = [...fused.entries()].sort((a, b) => -a[1] - -b[1]);
  return ranked.slice(0, k).map(([key, s]) => [index.get(key)!, s]);
}

function groundWindow(query: string, scene: Scene): [number, number] {
  const q = new Set(tokenize(query));
  const tTokens = tokenize(scene.transcript);
  if (q.size === 0 || tTokens.length === 0) return [scene.startMs, scene.endMs];
  const positions: number[] = [];
  tTokens.forEach((w, i) => {
    if (q.has(w)) positions.push(i);
  });
  if (positions.length === 0) return [scene.startMs, scene.endMs];
  const span = scene.endMs - scene.startMs;
  const startFrac = Math.min(...positions) / Math.max(1, tTokens.length);
  const endFrac = (Math.max(...positions) + 1) / Math.max(1, tTokens.length);
  const start = Math.trunc(scene.startMs + span * Math.max(0.0, startFrac - 0.05));
  const end = Math.trunc(scene.startMs + span * Math.min(1.0, endFrac + 0.05));
  return [start, end];
}

function fmtMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}

function main(): void {
  const scenes = SAMPLE;
  for (const s of scenes) s.embed();

  const queries: [string, boolean][] = [
    ["how many cars pass through the intersection", false],
    ["what happened first pour or stir", false],
    ["plating of the dish", true],
    ["ocean at sunset", true],
  ];

  for (const [q, descriptive] of queries) {
    console.log(`\nQ: ${q}  (descriptive=${descriptive ? "True" : "False"})`);
    const hits = multiVectorSearch(q, scenes, 3);
    for (const [sc, score] of hits) {
      console.log(`  scene ${sc.videoId}/${sc.sceneId} @ [${fmtMs(sc.startMs)}-${fmtMs(sc.endMs)}] ` +
        `score=${score.toFixed(4)}  cap='${sc.caption.slice(0, 40)}'`);
    }
    const top = hits[0][0];
    const [start, end] = groundWindow(q, top);
    console.log(`  grounded window: [${fmtMs(start)}-${fmtMs(end)}] ` +
      `(narrowed from ${fmtMs(top.startMs)}-${fmtMs(top.endMs)})`);
  }
}

main();

export {};
