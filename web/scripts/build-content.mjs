#!/usr/bin/env node
/**
 * Content pipeline: phases/ -> public/content/
 *
 * Reads every lesson's docs/en.md, quiz.json, code/ and outputs/ and writes a
 * micro-lesson shaped JSON file. No dependencies, no network.
 *
 *   node scripts/build-content.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { plainMath } from "../src/lib/math-text.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(HERE, "..");
const REPO_ROOT = path.resolve(WEB_ROOT, "..");
const OUT = path.join(WEB_ROOT, "public", "content");
const LESSON_OUT = path.join(OUT, "lessons");

const phaseDirs = fs
  .readdirSync(path.join(REPO_ROOT, "phases"), { withFileTypes: true })
  .filter((d) => d.isDirectory() && /^\d{2}-/.test(d.name))
  .map((d) => d.name)
  .sort();

/* ------------------------------------------------------------------ helpers */

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

function stripInline(s) {
  return plainMath(
    s
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/\$([^$]+)\$/g, "$1")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

/* ------------------------------------------------------------- block parser */

function parseBlocks(lines) {
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const raw = line;
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    // fenced code / math / figure
    const fence = trimmed.match(/^```([a-zA-Z0-9_-]*)\s*$/);
    if (fence) {
      const lang = fence[1] || "text";
      const body = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1;
      const source = body.join("\n");
      if (lang === "math") blocks.push({ kind: "math", source: plainMath(source) });
      else if (lang === "figure") blocks.push({ kind: "figure", name: source.trim() });
      else blocks.push({ kind: "code", lang, source });
      continue;
    }

    // headings
    const heading = trimmed.match(/^(#{2,6})\s+(.+)$/);
    if (heading) {
      blocks.push({
        kind: "heading",
        level: heading[1].length,
        text: heading[2].trim(),
      });
      i += 1;
      continue;
    }

    // table
    if (trimmed.startsWith("|") && (lines[i + 1] || "").includes("---")) {
      const head = splitRow(trimmed);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(splitRow(lines[i].trim()));
        i += 1;
      }
      blocks.push({ kind: "table", head, rows });
      continue;
    }

    // blockquote
    if (trimmed.startsWith(">")) {
      const quote = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quote.push(lines[i].trim().replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push({ kind: "quote", text: quote.join(" ").trim() });
      continue;
    }

    // horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ kind: "hr" });
      i += 1;
      continue;
    }

    // ordered list
    if (/^\d+[.)]\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        let text = lines[i].trim().replace(/^\d+[.)]\s+/, "");
        i += 1;
        // continuation lines
        while (
          i < lines.length &&
          lines[i].trim() &&
          !/^\s*(\d+[.)]|[-*+]|#|\||>|```)/.test(lines[i])
        ) {
          text += " " + lines[i].trim();
          i += 1;
        }
        items.push(text.trim());
      }
      blocks.push({ kind: "ol", items });
      continue;
    }

    // unordered list
    if (/^[-*+]\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        let text = lines[i].trim().replace(/^[-*+]\s+/, "");
        i += 1;
        while (
          i < lines.length &&
          lines[i].trim() &&
          /^\s{2,}/.test(lines[i]) &&
          !/^\s*(\d+[.)]|[-*+]|#|\||>|```)/.test(lines[i])
        ) {
          text += " " + lines[i].trim();
          i += 1;
        }
        items.push(text.trim());
      }
      blocks.push({ kind: "ul", items });
      continue;
    }

    // paragraph
    const para = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{2,6}\s|```|\||>|[-*+]\s|\d+[.)]\s|-{3,}$)/.test(lines[i].trim())
    ) {
      para.push(lines[i].trim());
      i += 1;
    }
    if (para.length) blocks.push({ kind: "p", text: para.join(" ") });
    else i += 1;
  }

  return blocks;
}

function splitRow(line) {
  return line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

/* ----------------------------------------------------------- doc splitting */

function splitSections(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const sections = [];
  let current = { title: "Introduction", lines: [] };

  for (const line of lines) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m) {
      if (current.lines.some((l) => l.trim())) sections.push(current);
      current = { title: m[1].trim(), lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  if (current.lines.some((l) => l.trim())) sections.push(current);
  return sections;
}

function readFrontmatter(md) {
  const head = md.split(/\n##\s/)[0];
  const get = (re) => {
    const m = head.match(re);
    return m ? m[1].trim() : null;
  };
  const title = (head.match(/^#\s+(.+)$/m) || [])[1]?.trim() ?? "Untitled";
  const hook = (head.match(/^>\s*(.+)$/m) || [])[1]?.trim() ?? "";
  const type = get(/\*\*Type:\*\*\s*(.+)/i) ?? "Learn";
  const languages = (get(/\*\*Languages:\*\*\s*(.+)/i) ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const prerequisites = (get(/\*\*Prerequisites:\*\*\s*(.+)/i) ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const timeRaw = get(/\*\*Time:\*\*\s*(.+)/i) ?? "";
  const minutes = Number((timeRaw.match(/(\d+)/) || [])[1] ?? 30);
  return { title, hook, type, languages, prerequisites, minutes };
}

const SECTION_MATCHERS = [
  ["objectives", /^learning objectives$/i],
  ["problem", /^(the problem|problem)$/i],
  ["concept", /^(the concept|concept)$/i],
  ["interactive", /^(interactive lab|practice lab|graded lab)$/i],
  ["build", /^build it$/i],
  ["use", /^use it$/i],
  ["ship", /^(ship it|shipped artifact|lesson artifact)$/i],
  ["verify", /^verify it$/i],
  ["pitfalls", /^pitfalls/i],
  ["exercises", /^exercises?$/i],
  ["keyTerms", /^key terms$/i],
  ["further", /^(further reading|going further)$/i],
];

function classify(title) {
  for (const [key, re] of SECTION_MATCHERS) if (re.test(title)) return key;
  return "other";
}

/* --------------------------------------------------------------- sub-chunks */

function chunkBlocks(blocks, budget = 1300) {
  const chunks = [];
  let current = [];
  let size = 0;

  const weight = (b) => {
    if (b.kind === "p") return b.text.length;
    if (b.kind === "ul" || b.kind === "ol") return b.items.join(" ").length;
    if (b.kind === "code") return b.source.length * 0.35;
    if (b.kind === "table") return b.rows.length * 120;
    return 160;
  };

  for (const block of blocks) {
    const w = weight(block);
    const standalone = ["table", "code", "figure", "math"].includes(block.kind) && w > 900;
    if (current.length && (size + w > budget || standalone)) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(block);
    size += w;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

/* --------------------------------------------------------------------- code */

const CODE_EXT = new Set([
  ".py", ".ts", ".tsx", ".js", ".mjs", ".rs", ".jl", ".go", ".c", ".h",
  ".cpp", ".sh", ".json", ".toml", ".sql", ".css", ".html",
]);

const RUNNERS = {
  ".py": (f) => `python3 code/${f}`,
  ".js": (f) => `node code/${f}`,
  ".mjs": (f) => `node code/${f}`,
  ".ts": (f) => `npx tsx code/${f}`,
  ".rs": (f) => `rustc --edition 2021 code/${f} -o code/main && ./code/main`,
  ".jl": (f) => `julia code/${f}`,
  ".go": (f) => `go run code/${f}`,
};

function readCode(lessonDir) {
  const dir = path.join(lessonDir, "code");
  if (!fs.existsSync(dir)) return { files: [], run: null };

  const walk = (d, base = "") =>
    fs
      .readdirSync(d, { withFileTypes: true })
      .flatMap((e) => {
        const rel = base ? `${base}/${e.name}` : e.name;
        if (e.isDirectory()) return walk(path.join(d, e.name), rel);
        return [{ rel, full: path.join(d, e.name), name: e.name }];
      });

  const all = walk(dir).filter((f) => CODE_EXT.has(path.extname(f.name).toLowerCase()));
  const main = all.filter((f) => /^main\.[a-z0-9]+$/i.test(f.name));
  const tests = all.filter((f) => /(^|\/)test/i.test(f.rel));
  const rest = all.filter((f) => !main.includes(f) && !tests.includes(f));

  const chosen = [...main, ...rest, ...tests].slice(0, 5);
  const files = chosen
    .map((f) => {
      const stat = fs.statSync(f.full);
      if (stat.size > 60_000) return null;
      return {
        name: f.rel,
        lang: path.extname(f.name).slice(1).toLowerCase(),
        source: fs.readFileSync(f.full, "utf8").replace(/\r\n/g, "\n"),
      };
    })
    .filter(Boolean);

  const entry = main[0] ?? files[0] ? chosen.find((f) => main.includes(f)) ?? chosen[0] : null;
  const run = entry && RUNNERS[path.extname(entry.name).toLowerCase()]
    ? RUNNERS[path.extname(entry.name).toLowerCase()](entry.rel)
    : null;

  return { files, run, hasTests: tests.length > 0 };
}

function readOutputs(lessonDir) {
  const dir = path.join(lessonDir, "outputs");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile())
    .slice(0, 4)
    .map((e) => ({
      name: e.name,
      title: stripInline(
        fs
          .readFileSync(path.join(dir, e.name), "utf8")
          .split("\n")
          .find((l) => l.startsWith("#")) ?? e.name,
      ).replace(/^#+\s*/, ""),
    }));
}

/* -------------------------------------------------------------------- quiz */

function readQuiz(lessonDir) {
  const file = path.join(lessonDir, "quiz.json");
  if (!fs.existsSync(file)) return [];
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return [];
  }
  const list = Array.isArray(data) ? data : Array.isArray(data.questions) ? data.questions : [];
  return list
    .filter((q) => q && q.question && Array.isArray(q.options) && typeof q.correct === "number")
    .map((q, index) => ({
      id: `q${index + 1}`,
      stage: ["pre", "check", "post"].includes(q.stage) ? q.stage : "check",
      question: q.question,
      options: q.options,
      correct: q.correct,
      explanation: q.explanation ?? "",
    }));
}

/* --------------------------------------------------------------- key terms */

function parseKeyTerms(blocks) {
  const terms = [];
  for (const block of blocks) {
    if (block.kind === "table" && block.rows.length) {
      const head = block.head.map((h) => h.toLowerCase());
      const termCol = 0;
      const meaningCol = head.findIndex((h) => /actually means|meaning|definition/.test(h));
      const saidCol = head.findIndex((h) => /people say|myth|misconception/.test(h));
      for (const row of block.rows) {
        const term = stripInline(row[termCol] ?? "");
        const means = stripInline(row[meaningCol >= 0 ? meaningCol : row.length - 1] ?? "");
        if (!term || !means) continue;
        terms.push({
          term,
          said: saidCol >= 0 ? stripInline(row[saidCol] ?? "") : "",
          means,
        });
      }
    }
    if (block.kind === "ul" || block.kind === "ol") {
      for (const item of block.items) {
        const m = item.match(/^\*\*(.+?)\*\*\s*[—:-]+\s*(.+)$/);
        if (m) terms.push({ term: stripInline(m[1]), said: "", means: stripInline(m[2]) });
      }
    }
  }
  return terms.slice(0, 20);
}

/* ------------------------------------------------------------ phase parsing */

function readRoadmap() {
  const file = path.join(REPO_ROOT, "ROADMAP.md");
  const map = new Map();
  if (!fs.existsSync(file)) return map;
  const md = fs.readFileSync(file, "utf8");
  let phase = null;

  for (const line of md.split("\n")) {
    const h = line.match(/^## Phase (\d+):\s*(.+?)\s*—\s*([✅🚧⬚])\s*\(~?([\d.]+)\s*hours?\)/);
    if (h) {
      phase = { number: Number(h[1]), title: h[2].trim(), status: h[3], hours: Number(h[4]) };
      map.set(phase.number, { ...phase, lessons: new Map() });
      continue;
    }
    const row = line.match(/^\|\s*(\d+)\s*\|\s*(.+?)\s*\|\s*([✅🚧⬚])\s*\|\s*~?([\d.]+)\s*min\s*\|/);
    if (row && phase) {
      const entry = map.get(phase.number);
      entry.lessons.set(Number(row[1]), {
        title: row[2].trim(),
        status: row[3],
        minutes: Number(row[4]),
      });
    }
  }
  return map;
}

function readPhaseMeta(dirName, roadmap) {
  const number = Number(dirName.slice(0, 2));
  const fromRoadmap = roadmap.get(number);
  const readme = path.join(REPO_ROOT, "phases", dirName, "README.md");
  let title = fromRoadmap?.title ?? dirName.slice(3).replace(/-/g, " ");
  let summary = "";

  if (fs.existsSync(readme)) {
    const md = fs.readFileSync(readme, "utf8");
    title = (md.match(/^#\s+Phase\s+\d+:\s*(.+)$/m) || [])[1]?.trim() ?? title;
    const quote = md.match(/^>\s*(.+)$/m);
    if (quote) summary = stripInline(quote[1]);
    if (!summary) {
      const para = md
        .split("\n")
        .slice(1)
        .find((l) => l.trim() && !l.startsWith("#") && !l.startsWith(">") && !l.startsWith("**"));
      summary = para ? stripInline(para) : "";
    }
  }

  return {
    number,
    id: dirName,
    title,
    summary,
    hours: fromRoadmap?.hours ?? null,
    status: fromRoadmap?.status ?? "⬚",
  };
}

/* --------------------------------------------------------------------- main */

function main() {
  const roadmap = readRoadmap();
  const catalog = {
    generatedAt: new Date().toISOString(),
    phases: [],
    totals: { lessons: 0, minutes: 0 },
  };

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(LESSON_OUT, { recursive: true });

  for (const phaseDir of phaseDirs) {
    const phaseNumber = Number(phaseDir.slice(0, 2));
    const meta = readPhaseMeta(phaseDir, roadmap);
    const phasePath = path.join(REPO_ROOT, "phases", phaseDir);

    const lessonDirs = fs
      .readdirSync(phasePath, { withFileTypes: true })
      .filter((d) => d.isDirectory() && /^\d{2}-/.test(d.name))
      .map((d) => d.name)
      .sort();

    const phase = {
      ...meta,
      lessonCount: 0,
      minutes: 0,
      lessons: [],
    };

    fs.mkdirSync(path.join(LESSON_OUT, phaseDir), { recursive: true });

    for (const lessonDir of lessonDirs) {
      const dir = path.join(phasePath, lessonDir);
      const doc = path.join(dir, "docs", "en.md");
      if (!fs.existsSync(doc)) continue;

      const md = fs.readFileSync(doc, "utf8").replace(/\r\n/g, "\n");
      const front = readFrontmatter(md);
      const sections = splitSections(md);
      const lessonNumber = Number(lessonDir.slice(0, 2));
      const roadmapLesson = meta.status ? roadmap.get(phaseNumber)?.lessons.get(lessonNumber) : null;

      const conceptSteps = [];
      const extra = {};
      const narrativeSections = [];
      let objectives = [];
      let keyTermBlocks = [];
      let exerciseBlocks = [];
      let problemBlocks = [];

      for (const section of sections) {
        const kind = classify(section.title);
        const blocks = parseBlocks(section.lines);

        if (kind === "objectives") {
          objectives = blocks
            .filter((b) => b.kind === "ul" || b.kind === "ol")
            .flatMap((b) => b.items.map(stripInline));
          continue;
        }
        if (kind === "keyTerms") { keyTermBlocks = blocks; continue; }
        if (kind === "exercises") { exerciseBlocks = blocks; continue; }
        if (kind === "problem") { problemBlocks = blocks; continue; }
        if (kind === "concept") {
          let current = { title: "Overview", blocks: [] };
          for (const block of blocks) {
            if (block.kind === "heading" && block.level === 3) {
              if (current.blocks.length) conceptSteps.push(current);
              current = { title: block.text, blocks: [] };
            } else {
              current.blocks.push(block);
            }
          }
          if (current.blocks.length) conceptSteps.push(current);
          continue;
        }
        if (kind === "other" || kind === "further" || kind === "pitfalls") {
          // keep short context sections, drop reading lists
          if (kind !== "further" && blocks.length) {
            extra[slugify(section.title)] = { title: section.title, blocks };
            if (kind === "other" && !/^capstone connection$/i.test(section.title)) {
              narrativeSections.push({ title: section.title, blocks });
            }
          }
          continue;
        }
        if (["build", "use", "ship", "verify", "interactive"].includes(kind)) {
          extra[kind] = { title: section.title, blocks };
        }
      }

      // reading steps: problem + concept chunks
      const reading = [];
      if (problemBlocks.length) {
        const title =
          (problemBlocks.find((b) => b.kind === "heading" && b.level === 3) || {}).text ??
          "The problem";
        reading.push({
          id: "problem",
          label: "The problem",
          title,
          blocks: problemBlocks.filter((b) => !(b.kind === "heading" && b.level === 3)),
        });
      }
      for (const step of conceptSteps) {
        const chunks = chunkBlocks(step.blocks);
        const base = step.title === "Overview" ? "Concept" : step.title;
        chunks.forEach((blocks, index) => {
          if (!blocks.length) return;
          reading.push({
            id: `concept-${reading.length + 1}`,
            label: "Concept",
            title:
              chunks.length > 1 ? `${base} · ${index + 1} of ${chunks.length}` : base,
            blocks,
          });
        });
      }

      // Fallback for lessons without a Problem/Concept structure (certification
      // parity and capstone lessons): their narrative sections become reading
      // steps so the player never runs prose-free.
      if (!reading.length) {
        for (const section of narrativeSections) {
          const chunks = chunkBlocks(section.blocks);
          chunks.forEach((blocks, index) => {
            if (!blocks.length) return;
            reading.push({
              id: `section-${reading.length + 1}`,
              label: section.title,
              title:
                chunks.length > 1
                  ? `${section.title} · ${index + 1} of ${chunks.length}`
                  : section.title,
              blocks,
            });
          });
        }
      }

      const exercises = exerciseBlocks
        .filter((b) => b.kind === "ol" || b.kind === "ul")
        .flatMap((b) => b.items.map(stripInline))
        .filter(Boolean);

      const keyTerms = parseKeyTerms(keyTermBlocks);
      const quiz = readQuiz(dir);
      const code = readCode(dir);
      const outputs = readOutputs(dir);

      const id = `${phaseDir}/${lessonDir}`;
      const lesson = {
        id,
        phaseId: phaseDir,
        phaseNumber,
        phaseTitle: meta.title,
        slug: lessonDir,
        number: lessonNumber,
        title: front.title,
        hook: front.hook,
        type: front.type,
        languages: front.languages,
        prerequisites: front.prerequisites,
        minutes: roadmapLesson?.minutes ?? front.minutes,
        status: roadmapLesson?.status ?? "⬚",
        objectives,
        reading,
        build: extra.build ?? null,
        use: extra.use ?? null,
        ship: extra.ship ?? null,
        verify: extra.verify ?? null,
        extra: Object.entries(extra)
          .filter(([k]) => !["build", "use", "ship", "verify"].includes(k))
          .map(([, v]) => v),
        exercises,
        keyTerms,
        quiz,
        code,
        outputs,
        search: stripInline(
          [front.title, front.hook, ...objectives, ...keyTerms.map((t) => t.term)].join(" "),
        ).slice(0, 600),
      };

      fs.writeFileSync(path.join(LESSON_OUT, phaseDir, `${lessonDir}.json`), JSON.stringify(lesson));
      catalog.totals.lessons += 1;
      catalog.totals.minutes += lesson.minutes;

      phase.lessons.push({
        id,
        slug: lessonDir,
        number: lessonNumber,
        title: lesson.title,
        hook: lesson.hook,
        type: lesson.type,
        minutes: lesson.minutes,
        languages: lesson.languages,
        status: lesson.status,
        steps: 1 + reading.length + (lesson.build ? 1 : 0) + (exercises.length ? 1 : 0) + (quiz.length ? 1 : 0),
      });
      phase.lessonCount += 1;
      phase.minutes += lesson.minutes;
    }

    catalog.phases.push(phase);
  }

  fs.writeFileSync(path.join(OUT, "catalog.json"), JSON.stringify(catalog));

  const bytes = (p) =>
    fs.statSync(p).isDirectory()
      ? fs.readdirSync(p).reduce((n, f) => n + bytes(path.join(p, f)), 0)
      : fs.statSync(p).size;

  const mb = (bytes(OUT) / 1024 / 1024).toFixed(1);
  console.log(
    `content: ${catalog.totals.lessons} lessons across ${catalog.phases.length} phases, ${mb} MB`,
  );
}

main();
