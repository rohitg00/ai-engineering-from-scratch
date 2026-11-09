// Lesson: Paper Writer (phase 19 / lesson 54)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/19-capstone-projects/54-paper-writer/docs/en.md
// Run: npx tsx phases/19-capstone-projects/54-paper-writer/code/main.ts

import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

export class PyFloat {
  constructor(readonly v: number) {}
}

export type Json = null | boolean | number | string | PyFloat | Json[] | { [key: string]: Json };
export type Obj = { [key: string]: Json };

function pyFloatRepr(x: number): string {
  if (Number.isNaN(x)) return "NaN";
  if (!Number.isFinite(x)) return x > 0 ? "Infinity" : "-Infinity";
  if (x === 0) return Object.is(x, -0) ? "-0.0" : "0.0";
  const [mant, expStr] = x.toExponential().split("e");
  const exp = Number(expStr);
  const neg = mant.startsWith("-");
  const digits = mant.replace("-", "").replace(".", "");
  let body: string;
  if (exp < -4 || exp >= 16) {
    const frac = digits.length > 1 ? "." + digits.slice(1) : "";
    body = digits[0] + frac + "e" + (exp < 0 ? "-" : "+") + String(Math.abs(exp)).padStart(2, "0");
  } else if (exp < 0) {
    body = "0." + "0".repeat(-exp - 1) + digits;
  } else if (digits.length <= exp + 1) {
    body = digits + "0".repeat(exp + 1 - digits.length) + ".0";
  } else {
    body = digits.slice(0, exp + 1) + "." + digits.slice(exp + 1);
  }
  return (neg ? "-" : "") + body;
}

function jsonStr(s: string): string {
  return (
    '"' +
    s.replace(/[\\"\u0000-\u001f\u007f-￿]/g, (c) => {
      if (c === '"') return '\\"';
      if (c === "\\") return "\\\\";
      if (c === "\n") return "\\n";
      if (c === "\r") return "\\r";
      if (c === "\t") return "\\t";
      if (c === "\b") return "\\b";
      if (c === "\f") return "\\f";
      return "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0");
    }) +
    '"'
  );
}

function pyDumps(v: Json, indent: number | null = null, level = 0): string {
  if (v === null) return "null";
  if (v === true) return "true";
  if (v === false) return "false";
  if (v instanceof PyFloat) return pyFloatRepr(v.v);
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : pyFloatRepr(v);
  if (typeof v === "string") return jsonStr(v);
  let open: string;
  let close: string;
  let items: string[];
  if (Array.isArray(v)) {
    if (v.length === 0) return "[]";
    open = "[";
    close = "]";
    items = v.map((x) => pyDumps(x, indent, level + 1));
  } else {
    const keys = Object.keys(v);
    if (keys.length === 0) return "{}";
    open = "{";
    close = "}";
    items = keys.map((k) => jsonStr(k) + ": " + pyDumps(v[k], indent, level + 1));
  }
  if (indent === null) return open + items.join(", ") + close;
  const pad = "\n" + " ".repeat(indent * (level + 1));
  return open + pad + items.join("," + pad) + "\n" + " ".repeat(indent * level) + close;
}

function pyStrRepr(s: string): string {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  return quote + s.replace(/\\/g, "\\\\").replace(new RegExp(quote, "g"), "\\" + quote) + quote;
}

function sortKeysDeep(v: Json): Json {
  if (Array.isArray(v)) return v.map(sortKeysDeep);
  if (v !== null && typeof v === "object" && !(v instanceof PyFloat)) {
    const out: Obj = {};
    for (const k of Object.keys(v).sort()) out[k] = sortKeysDeep(v[k]);
    return out;
  }
  return v;
}

export class PaperValidationError extends Error {}

export class BibEntry {
  constructor(
    public key: string,
    public entry_type: string,
    public fields: Record<string, string>,
  ) {}

  toBibtex(): string {
    const lines = [`@${this.entry_type}{${this.key},`];
    for (const k of Object.keys(this.fields).sort()) {
      const safe = String(this.fields[k]).replace(/\{/g, "").replace(/\}/g, "");
      lines.push(`  ${k} = {${safe}},`);
    }
    lines.push("}");
    return lines.join("\n");
  }
}

export class Figure {
  constructor(
    public id: string,
    public path: string,
    public caption: string,
    public width = "0.8\\textwidth",
  ) {}

  get label(): string {
    return `fig:${this.id}`;
  }
}

export class Section {
  constructor(
    public id: string,
    public title: string,
    public body = "",
    public cites: string[] = [],
    public figure_refs: string[] = [],
  ) {}

  get label(): string {
    return `sec:${this.id}`;
  }
}

export class Paper {
  constructor(
    public title: string,
    public authors: string[],
    public abstract: string,
    public sections: Section[] = [],
    public figures: Figure[] = [],
    public bibliography: BibEntry[] = [],
  ) {}
}

type ProseGenerator = (section: Section, paper: Paper) => string;

function validate(paper: Paper): void {
  if (!paper.title.trim()) throw new PaperValidationError("title is empty");
  if (!paper.abstract.trim()) throw new PaperValidationError("abstract is empty");

  const figIds = new Set<string>();
  for (const fig of paper.figures) {
    if (figIds.has(fig.id)) throw new PaperValidationError(`duplicate figure id: ${fig.id}`);
    figIds.add(fig.id);
  }

  const bibKeys = new Set<string>();
  for (const b of paper.bibliography) {
    if (bibKeys.has(b.key)) throw new PaperValidationError(`duplicate bibliography key: ${b.key}`);
    bibKeys.add(b.key);
  }
  for (const sec of paper.sections) {
    for (const key of sec.cites) {
      if (!bibKeys.has(key)) {
        throw new PaperValidationError(`section ${pyStrRepr(sec.id)} cites unknown bibliography key ${pyStrRepr(key)}`);
      }
    }
    for (const fid of sec.figure_refs) {
      if (!figIds.has(fid)) {
        throw new PaperValidationError(`section ${pyStrRepr(sec.id)} references unknown figure id ${pyStrRepr(fid)}`);
      }
    }
  }
}

const LATEX_REPL: Record<string, string> = {
  "\\": "\\textbackslash{}",
  "&": "\\&",
  "%": "\\%",
  $: "\\$",
  "#": "\\#",
  _: "\\_",
  "{": "\\{",
  "}": "\\}",
  "~": "\\textasciitilde{}",
  "^": "\\textasciicircum{}",
};

function escapeLatex(text: string): string {
  const outChars: string[] = [];
  for (const ch of text) outChars.push(LATEX_REPL[ch] ?? ch);
  return outChars.join("");
}

function renderLatex(paper: Paper): string {
  validate(paper);

  const lines: string[] = [];
  lines.push("\\documentclass{article}");
  lines.push("\\usepackage{graphicx}");
  lines.push("\\usepackage{hyperref}");
  lines.push("\\title{" + escapeLatex(paper.title) + "}");
  lines.push("\\author{" + paper.authors.map(escapeLatex).join(" \\and ") + "}");
  lines.push("\\begin{document}");
  lines.push("\\maketitle");
  lines.push("\\begin{abstract}");
  lines.push(escapeLatex(paper.abstract));
  lines.push("\\end{abstract}");

  for (const sec of paper.sections) {
    lines.push("\\section{" + escapeLatex(sec.title) + "}");
    lines.push("\\label{" + sec.label + "}");
    lines.push(sec.body ? sec.body : "% body pending");
    for (const fid of sec.figure_refs) lines.push("See Figure~\\ref{fig:" + fid + "}.");
    for (const cite of sec.cites) lines.push("See~\\cite{" + cite + "}.");
  }

  for (const fig of paper.figures) {
    lines.push("\\begin{figure}");
    lines.push("\\centering");
    lines.push("\\includegraphics[width=" + fig.width + "]{" + fig.path + "}");
    lines.push("\\caption{" + escapeLatex(fig.caption) + "}");
    lines.push("\\label{" + fig.label + "}");
    lines.push("\\end{figure}");
  }

  if (paper.bibliography.length) {
    lines.push("\\bibliographystyle{plain}");
    lines.push("\\bibliography{references}");
  }

  lines.push("\\end{document}");
  return lines.join("\n") + "\n";
}

function renderBibtex(paper: Paper): string {
  return paper.bibliography.map((b) => b.toBibtex()).join("\n\n") + (paper.bibliography.length ? "\n" : "");
}

export class MockProseGenerator {
  constructor(public outlines: Record<string, string>) {}

  call(section: Section, _paper: Paper): string {
    const seed = Object.hasOwn(this.outlines, section.id) ? this.outlines[section.id] : section.title;
    const first = `In this section we discuss ${section.title.toLowerCase()}: ${seed}.`;
    const bits: string[] = [];
    for (const fid of section.figure_refs) bits.push(`Figure~\\ref{fig:${fid}} shows the relevant artifact.`);
    for (const c of section.cites) bits.push(`This builds on prior work~\\cite{${c}}.`);
    const second = bits.length ? bits.join(" ") : "We discuss implications below.";
    return first + "\n\n" + second;
  }

  asGenerator(): ProseGenerator {
    return (section, paper) => this.call(section, paper);
  }
}

interface Artifact {
  path?: string;
  caption?: string;
}

interface Manifest {
  name?: string;
  artifacts?: Artifact[];
}

function readExperimentManifest(manifests: Manifest[], paperDir: string): Figure[] {
  const figs: Figure[] = [];
  let counter = 0;
  for (const m of manifests) {
    const name = m.name ?? "exp";
    const artifacts = m.artifacts ?? [];
    for (const art of artifacts) {
      const path = art.path ?? "";
      const caption = art.caption ?? "";
      if (!path) continue;
      counter += 1;
      const rel = relative(paperDir, path) || ".";
      const fid = `${name}-${counter}`
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase();
      figs.push(new Figure(fid, rel, caption || name));
    }
  }
  return figs;
}

export class PaperWriter {
  constructor(public prose: ProseGenerator) {}

  fillProse(paper: Paper): Paper {
    for (const sec of paper.sections) {
      if (!sec.body) sec.body = this.prose(sec, paper);
    }
    return paper;
  }

  write(paper: Paper, outDir: string): Obj {
    mkdirSync(outDir, { recursive: true });
    this.fillProse(paper);
    const tex = renderLatex(paper);
    const bib = renderBibtex(paper);

    const texPath = join(outDir, "paper.tex");
    const bibPath = join(outDir, "references.bib");
    const manPath = join(outDir, "manifest.json");

    writeFileSync(texPath, tex, "utf-8");
    writeFileSync(bibPath, bib, "utf-8");

    const manifest: Obj = {
      title: paper.title,
      authors: [...paper.authors],
      sections: paper.sections.map((s) => ({
        id: s.id,
        title: s.title,
        cites: [...s.cites],
        figure_refs: [...s.figure_refs],
        body_chars: [...s.body].length,
      })),
      figures: paper.figures.map((f) => ({ id: f.id, path: f.path, caption: f.caption, label: f.label })),
      bibliography: paper.bibliography.map((b) => b.key),
      tex_path: texPath,
      bib_path: bibPath,
    };
    writeFileSync(manPath, pyDumps(sortKeysDeep(manifest), 2), "utf-8");
    return manifest;
  }
}

function demo(outDir: string | null = null): Obj {
  const dir = outDir ?? mkdtempSync(join(tmpdir(), "paper-writer-demo-"));
  const experiments: Manifest[] = [
    { name: "loss-curve", artifacts: [{ path: "figs/loss.pdf", caption: "Training loss across epochs" }] },
    { name: "ablation", artifacts: [{ path: "figs/ablation.pdf", caption: "Ablation over decoder width" }] },
  ];
  const figs = readExperimentManifest(experiments, dir);
  const paper = new Paper(
    "Auto-Research Loop: Empirical Notes",
    ["Lab Bot"],
    "We describe a small experiment harness that emits LaTeX from structured outputs.",
    [
      new Section("intro", "Introduction", "", ["smith2020"], []),
      new Section("method", "Method", "", ["jones2021"], [figs[0].id]),
      new Section("results", "Results", "", [], [figs[1].id]),
    ],
    figs,
    [
      new BibEntry("smith2020", "article", { title: "On harnesses", author: "Smith", year: "2020" }),
      new BibEntry("jones2021", "article", { title: "On loops", author: "Jones", year: "2021" }),
    ],
  );
  const prose = new MockProseGenerator({
    intro: "we motivate the auto-research loop",
    method: "we describe the skeleton-first writer",
    results: "we present two ablations",
  });
  const writer = new PaperWriter(prose.asGenerator());
  return writer.write(paper, dir);
}

if (require.main === module) {
  const manifest = demo();
  console.log(
    pyDumps(
      {
        sections: (manifest["sections"] as Json[]).length,
        figures: (manifest["figures"] as Json[]).length,
        bib_keys: manifest["bibliography"],
        tex_path: manifest["tex_path"],
      },
      2,
    ),
  );
}
