export type Paragraph = {
  id: string;
  text: string;
  numbers: string[];
  protectedTerms: string[];
};
export type Comparison = {
  id: string;
  original: string;
  candidate: string;
  before: {
    words: number;
    sentences: number;
    averageWords: number;
    longWords: number;
  };
  after: {
    words: number;
    sentences: number;
    averageWords: number;
    longWords: number;
  };
  issues: string[];
};

function numbers(text: string): string[] {
  return (
    text.match(/[-+]?\d+(?:[.,]\d+)*(?:%|\s*(?:km|cm|mm|ms|kg|m|s)\b)?/g) ?? []
  )
    .map((x) => x.replace(/\s+/g, " "))
    .sort();
}
export function segmentProse(
  text: string,
  protectedTerms: string[] = [],
): Paragraph[] {
  if (typeof text !== "string") throw Error("Prose must be text");
  if (
    !Array.isArray(protectedTerms) ||
    protectedTerms.some((t) => typeof t !== "string" || !t.trim())
  )
    throw Error("Protected terms must be nonempty text");
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p, i) => ({
      id: "p" + (i + 1),
      text: p,
      numbers: numbers(p),
      protectedTerms: [...new Set(protectedTerms)].filter((t) => p.includes(t)),
    }));
}
export function proposeParagraphs(
  paragraphs: Paragraph[],
  recorded: Record<string, string> = {},
): { id: string; candidate: string; method: string }[] {
  if (
    !recorded ||
    typeof recorded !== "object" ||
    Array.isArray(recorded) ||
    Object.keys(recorded).some((id) => !paragraphs.some((p) => p.id === id))
  )
    throw Error("Unknown proposal id");
  const replacements: [RegExp, string][] = [
    [/\bin order to\b/gi, "to"],
    [/\butilize\b/gi, "use"],
    [/\bapproximately\b/gi, "about"],
    [/\bprior to\b/gi, "before"],
    [/\bsubsequent to\b/gi, "after"],
    [/\bdue to the fact that\b/gi, "because"],
    [/\bat this point in time\b/gi, "now"],
  ];
  return paragraphs.map((p) => {
    if (Object.hasOwn(recorded, p.id))
      return {
        id: p.id,
        candidate: nonempty(recorded[p.id], "candidate"),
        method: "recorded author proposal",
      };
    let candidate = p.text;
    for (const [pattern, replacement] of replacements)
      candidate = candidate.replace(pattern, replacement);
    return { id: p.id, candidate, method: "visible phrase substitutions" };
  });
}
export function measures(text: string): {
  words: number;
  sentences: number;
  averageWords: number;
  longWords: number;
} {
  const words = text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? [],
    sentences = text.split(/[.!?]+/).filter((x) => x.trim()).length;
  return {
    words: words.length,
    sentences,
    averageWords: sentences ? Number((words.length / sentences).toFixed(2)) : 0,
    longWords: words.filter((x) => x.length > 8).length,
  };
}
export function compareParagraphs(
  paragraphs: Paragraph[],
  proposals: { id: string; candidate: string; method?: string }[],
  definitions: Record<string, string> = {},
): Comparison[] {
  if (
    proposals.length !== paragraphs.length ||
    new Set(proposals.map((p) => p.id)).size !== paragraphs.length ||
    proposals.some((p) => !paragraphs.some((x) => x.id === p.id))
  )
    throw Error("Provide exactly one proposal per paragraph");
  return paragraphs.map((p) => {
    const candidate = nonempty(
        proposals.find((x) => x.id === p.id)!.candidate,
        "candidate",
      ),
      issues: string[] = [];
    if (JSON.stringify(numbers(candidate)) !== JSON.stringify(p.numbers))
      issues.push("Numeric facts changed");
    for (const t of p.protectedTerms) {
      if (!candidate.includes(t)) issues.push("Missing protected term: " + t);
      if (
        Object.hasOwn(definitions, t) &&
        !candidate
          .toLowerCase()
          .includes(nonempty(definitions[t], "definition").toLowerCase())
      )
        issues.push("Missing required definition: " + t);
    }
    return {
      id: p.id,
      original: p.text,
      candidate,
      before: measures(p.text),
      after: measures(candidate),
      issues,
    };
  });
}
export function exportRevisions(
  comparisons: Comparison[],
  value?: unknown,
): {
  markdown: string;
  changeRecord: string;
  decisions: any;
  unresolved: string[];
} {
  const rows =
    value === undefined ? [] : array((value as any)?.decisions, "decisions");
  if (value !== undefined && (value as any).schemaVersion !== 1)
    throw Error("Invalid revision schema");
  if (
    new Set(rows.map((x) => x.id)).size !== rows.length ||
    rows.some((x) => !comparisons.some((c) => c.id === x.id))
  )
    throw Error("Unknown or duplicate paragraph decision");
  const normalized = comparisons.map((c) => {
    const d = rows.find((x) => x.id === c.id);
    if (!d) return { id: c.id, decision: "pending", candidate: c.candidate };
    if (
      !["accept", "reject", "pending"].includes(d.decision) ||
      d.candidate !== c.candidate
    )
      throw Error("Stale or invalid revision decision");
    if (d.decision === "accept" && c.issues.length)
      throw Error("Resolve factual issues before accepting " + c.id);
    return { id: c.id, decision: d.decision, candidate: c.candidate };
  });
  const markdown =
    comparisons
      .map((c) =>
        normalized.find((d) => d.id === c.id)!.decision === "accept"
          ? c.candidate
          : c.original,
      )
      .join("\n\n") + "\n";
  const changeRecord =
    "# Editorial change record\n\n" +
    comparisons
      .map((c) => {
        const d = normalized.find((x) => x.id === c.id)!;
        return `## ${c.id}: ${d.decision}\n\nWords: ${c.before.words} -> ${c.after.words}; average sentence length: ${c.before.averageWords} -> ${c.after.averageWords}.\n\nChecks: ${c.issues.join("; ") || "No recorded fact violations detected"}.`;
      })
      .join("\n\n") +
    "\n";
  return {
    markdown,
    changeRecord,
    decisions: { schemaVersion: 1, decisions: normalized },
    unresolved: normalized
      .filter((x) => x.decision === "pending")
      .map((x) => x.id),
  };
}
export function renderDesk(
  comparisons: Comparison[],
  state: ReturnType<typeof exportRevisions>,
): string {
  return page(
    "Plain Language Rewrite Desk",
    `<p>Inspect every proposed paragraph. The measures describe surface features, not comprehension. Accept is blocked while recorded numeric or protected-term checks fail.</p>${comparisons.map((c) => `<section><h2>${c.id}</h2><h3>Original</h3><p>${escapeHTML(c.original)}</p><h3>Proposal</h3><p>${escapeHTML(c.candidate)}</p><p>Words ${c.before.words} → ${c.after.words}; words/sentence ${c.before.averageWords} → ${c.after.averageWords}; long words ${c.before.longWords} → ${c.after.longWords}</p><p class="alert">${escapeHTML(c.issues.join("; ") || "No recorded fact violations detected. Review meaning before accepting.")}</p><label>Decision <select data-id="${c.id}"><option value="pending">Pending</option><option value="accept" ${c.issues.length ? "disabled" : ""}>Accept proposal</option><option value="reject">Keep original</option></select></label></section>`).join("")}<button id="save">Download revision-decisions.json</button>`,
    `const state=${embedded(state.decisions)};document.querySelectorAll('[data-id]').forEach(s=>{const d=state.decisions.find(x=>x.id===s.dataset.id);s.value=d.decision;s.onchange=()=>{d.decision=s.value}});document.querySelector('#save').onclick=()=>download('revision-decisions.json',state);`,
  );
}

export function escapeHTML(value: unknown): string {
  return String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
export function embedded(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
export function page(title: string, content: string, script = ""): string {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHTML(title)}</title><style>:root{color-scheme:light dark;font:17px/1.6 system-ui;background:light-dark(#f6f4ed,#161d21);color:light-dark(#172a32,#e4e9e7)}body{max-width:1000px;margin:auto;padding:28px}h1{line-height:1.15}header{border-bottom:3px solid #53866c;margin-bottom:24px}h2{font-size:1.3rem}button,input,select,textarea{font:inherit;max-width:100%;padding:8px;border:1px solid #738d88;border-radius:5px}button{cursor:pointer}button:focus-visible,input:focus-visible,textarea:focus-visible{outline:3px solid #cf9446}article,section{margin:18px 0;padding:18px;border:1px solid #8a9991;border-radius:8px}label{display:inline-block;margin:8px}textarea{display:block;box-sizing:border-box;width:100%;min-height:110px}table{width:100%;border-collapse:collapse;display:block;overflow:auto}th,td{padding:10px;border-bottom:1px solid #8a9991;text-align:left;vertical-align:top}pre{white-space:pre-wrap;overflow-wrap:anywhere}code{overflow-wrap:anywhere}.muted{opacity:.75}.alert{border-left:4px solid #c47827;padding-left:12px}a{color:light-dark(#145d83,#82cdec)}svg{max-width:100%;height:auto}summary{cursor:pointer}.toolbar{display:flex;gap:8px;flex-wrap:wrap}.hidden{display:none}@media(max-width:600px){body{padding:14px}h1{font-size:1.8rem}td{padding:5px}}</style><header><p class="muted">AI Engineering from Scratch · local project</p><h1>${escapeHTML(title)}</h1></header><main>${content}</main><script>function download(name,value,type='application/json'){const b=new Blob([typeof value==='string'?value:JSON.stringify(value,null,2)+'\\n'],{type});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}${script}</script></html>`;
}
export function array(value: unknown, label: string): any[] {
  if (!Array.isArray(value)) throw new Error(label + " must be an array");
  return value;
}
export function nonempty(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim())
    throw new Error(label + " must be a nonempty string");
  return value;
}
