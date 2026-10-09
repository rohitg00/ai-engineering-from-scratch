export type Term = {
  id: string;
  term: string;
  aliases: string[];
  definition: string;
};
export type Match = {
  termId: string;
  start: number;
  end: number;
  text: string;
};
export type Coverage = { id: string; term: string; count: number };

export function validateGlossary(value: unknown): Term[] {
  const ids = new Set<string>(),
    phrases = new Set<string>();
  return array(value, "glossary").map((x) => {
    if (!x || typeof x !== "object") throw Error("Term must be an object");
    const id = nonempty(x.id, "id"),
      term = nonempty(x.term, "term"),
      definition = nonempty(x.definition, "definition");
    if (!/^[a-z][a-z0-9-]*$/.test(id) || ids.has(id))
      throw Error("Invalid or duplicate id");
    ids.add(id);
    const aliases =
      x.aliases === undefined
        ? []
        : array(x.aliases, "aliases").map((a) => nonempty(a, "alias"));
    for (const s of [term, ...aliases]) {
      const key = s.toLowerCase();
      if (phrases.has(key)) throw Error("Ambiguous repeated phrase " + s);
      phrases.add(key);
    }
    return { id, term, aliases, definition };
  });
}
export function matchTerms(text: string, terms: Term[]): Match[] {
  const phrases = terms
    .flatMap((t) =>
      [t.term, ...t.aliases].map((phrase) => ({ phrase, termId: t.id })),
    )
    .sort(
      (a, b) =>
        b.phrase.length - a.phrase.length || a.termId.localeCompare(b.termId),
    );
  const word = (s: string) => /[\p{L}\p{N}_]/u.test(s);
  const matches: Match[] = [];
  for (let i = 0; i < text.length; ) {
    const found = phrases.find(
      (p) =>
        text.slice(i, i + p.phrase.length).toLowerCase() ===
          p.phrase.toLowerCase() &&
        (i === 0 || !word(text[i - 1])) &&
        (i + p.phrase.length === text.length ||
          !word(text[i + p.phrase.length])),
    );
    if (found) {
      matches.push({
        termId: found.termId,
        start: i,
        end: i + found.phrase.length,
        text: text.slice(i, i + found.phrase.length),
      });
      i += found.phrase.length;
    } else i++;
  }
  return matches;
}
export function annotateLesson(
  html: string,
  terms: Term[],
): { html: string; coverage: Coverage[] } {
  const allowed = new Set([
    "p",
    "h1",
    "h2",
    "h3",
    "h4",
    "ul",
    "ol",
    "li",
    "em",
    "strong",
    "span",
    "div",
    "section",
    "article",
    "blockquote",
    "code",
    "pre",
    "a",
    "br",
    "hr",
  ]);
  const voids = new Set(["br", "hr"]);
  const stack: string[] = [];
  const counts = new Map(terms.map((t) => [t.id, 0]));
  let output = "";
  const parts = html.match(/<!--[^]*?-->|<[^>]*>|[^<]+|</g) ?? [];
  for (const part of parts) {
    if (part.startsWith("<!--")) continue;
    if (part.startsWith("<")) {
      const tag = part.match(/^<(\/?)([a-z][a-z0-9]*)([^>]*)>$/i);
      if (!tag) throw Error("Malformed HTML tag");
      const name = tag[2].toLowerCase();
      if (!allowed.has(name)) throw Error("Unsupported HTML element " + name);
      if (tag[1]) {
        if (tag[3].trim() || voids.has(name) || stack.pop() !== name)
          throw Error("Unbalanced HTML");
        output += `</${name}>`;
        continue;
      }
      let attrs = tag[3].replace(/\/$/, "");
      const parsed = [
        ...attrs.matchAll(/\s+([a-z][a-z0-9-]*)\s*=\s*("[^"]*"|'[^']*')/gi),
      ];
      if (
        attrs
          .replace(/\s+([a-z][a-z0-9-]*)\s*=\s*("[^"]*"|'[^']*')/gi, "")
          .trim()
      )
        throw Error("Attributes must be quoted");
      let safe = "";
      for (const a of parsed) {
        const key = a[1].toLowerCase(),
          value = a[2].slice(1, -1);
        if (
          !["class", "id", "title", "lang", "href"].includes(key) ||
          (key === "href" && name !== "a")
        )
          throw Error("Unsupported HTML attribute " + key);
        if (key === "href" && !/^(https?:\/\/|#[a-z0-9_-]+$)/i.test(value))
          throw Error("Unsafe link");
        if (value.includes("&") || value.includes("<"))
          throw Error("Attribute entities are outside this subset");
        safe += ` ${key}="${escapeHTML(value)}"`;
      }
      output += `<${name}${safe}>`;
      if (!voids.has(name)) stack.push(name);
      continue;
    }
    if (stack.some((x) => ["pre", "code", "a"].includes(x))) {
      output += part;
      continue;
    }
    // Entities form text boundaries so their encoded characters are never split by matching.
    for (const segment of part.split(/(&[a-zA-Z0-9#]+;)/g)) {
      if (/^&[a-zA-Z0-9#]+;$/.test(segment)) {
        output += segment;
        continue;
      }
      let cursor = 0;
      for (const match of matchTerms(segment, terms)) {
        output += segment.slice(cursor, match.start);
        const t = terms.find((x) => x.id === match.termId)!;
        output += `<span class="term"><button type="button" class="term-trigger" aria-expanded="false">${escapeHTML(match.text)}</button><span class="term-definition" role="note" hidden>${escapeHTML(t.definition)}</span></span>`;
        counts.set(t.id, counts.get(t.id)! + 1);
        cursor = match.end;
      }
      output += segment.slice(cursor);
    }
  }
  if (stack.length) throw Error("Unclosed HTML element");
  return {
    html: output,
    coverage: terms.map((t) => ({
      id: t.id,
      term: t.term,
      count: counts.get(t.id)!,
    })),
  };
}
export function publishGlossary(
  lesson: string,
  terms: Term[],
): { html: string; glossary: Term[]; coverage: Coverage[] } {
  const annotated = annotateLesson(lesson, terms);
  const content = `<p>Focus a term and press Enter or Space to reveal its reviewed definition. Code examples and links stay untouched.</p><style>.term{display:inline}.term-trigger{display:inline;padding:0;border:0;border-radius:0;font:inherit;line-height:inherit;color:inherit;background:transparent;text-decoration:underline dotted;text-underline-offset:4px;cursor:pointer}.term-definition{display:block;padding:12px;border:1px solid #53866c;margin:8px 0}.term-definition[hidden]{display:none}.term-trigger:focus-visible{outline:3px solid #cf9446;outline-offset:3px}</style><article>${annotated.html}</article><h2>Term coverage</h2><table><tr><th>Term</th><th>Matches</th></tr>${annotated.coverage.map((x) => `<tr><td>${escapeHTML(x.term)}</td><td>${x.count}</td></tr>`).join("")}</table><button id="export">Download glossary.json</button>`;
  return {
    html: page(
      "Glossary Hovercard Publisher",
      content,
      `document.querySelectorAll('.term-trigger').forEach(button => {
        button.addEventListener('click', () => {
          const wasExpanded = button.getAttribute('aria-expanded') === 'true';
          button.setAttribute('aria-expanded', String(!wasExpanded));
          button.nextElementSibling.hidden = wasExpanded;
        });
      });
      document.querySelector('#export').onclick=()=>download('glossary.json',${embedded(terms)});`,
    ),
    glossary: structuredClone(terms),
    coverage: annotated.coverage,
  };
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
