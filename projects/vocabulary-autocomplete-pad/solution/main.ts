export type Model = {
  schemaVersion: 1;
  words: Record<string, number>;
  histories: Record<string, Record<string, number>>;
  sources: Record<string, string[]>;
};
export type Suggestion = {
  word: string;
  score: number;
  order: number;
  count: number;
  sources: string[];
};

export function tokenize(text: string): string[] {
  return (
    text
      .normalize("NFC")
      .toLowerCase()
      .match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? []
  );
}
export function train(corpus: unknown): Model {
  const rows = array(corpus, "corpus"),
    words: Record<string, number> = Object.create(null),
    histories: Record<string, Record<string, number>> = Object.create(null),
    sources: Record<string, string[]> = Object.create(null),
    ids = new Set<string>();
  for (const row of rows) {
    const id = nonempty(row.id, "source id"),
      text = nonempty(row.text, "source text");
    if (ids.has(id)) throw Error("Duplicate source id");
    ids.add(id);
    for (const sentence of text.split(/[.!?\n]+/)) {
      const tokens = tokenize(sentence);
      tokens.forEach((word, i) => {
        words[word] = (words[word] ?? 0) + 1;
        sources[word] = [...new Set([...(sources[word] ?? []), id])];
        for (let n = 1; n <= Math.min(2, i); n++) {
          const key = JSON.stringify(tokens.slice(i - n, i));
          histories[key] ??= Object.create(null);
          histories[key][word] = (histories[key][word] ?? 0) + 1;
        }
      });
    }
  }
  return { schemaVersion: 1, words, histories, sources };
}
export function suggest(
  model: Model,
  prefix: string,
  history: string[] = [],
  limit = 5,
): Suggestion[] {
  if (!Number.isInteger(limit) || limit < 0 || limit > 50)
    throw Error("limit must be 0..50");
  const p = prefix.normalize("NFC").toLowerCase(),
    h = history.flatMap(tokenize).slice(-2);
  return Object.keys(model.words)
    .filter((w) => w.startsWith(p))
    .map((word) => {
      let order = 0,
        count = model.words[word];
      for (let n = Math.min(2, h.length); n >= 1; n--) {
        const c = model.histories[JSON.stringify(h.slice(-n))]?.[word];
        if (c) {
          order = n;
          count = c;
          break;
        }
      }
      return {
        word,
        score: order * 1000000 + count,
        order,
        count,
        sources: [...(model.sources[word] ?? [])],
      };
    })
    .sort(
      (a, b) =>
        b.order - a.order ||
        b.count - a.count ||
        b.score - a.score ||
        a.word.localeCompare(b.word),
    )
    .slice(0, limit);
}
export function completeText(
  model: Model,
  text: string,
  limit = 5,
): { prefix: string; history: string[]; suggestions: Suggestion[] } {
  const boundary = text.search(/[^.!?\n]*$/),
    tail = text.slice(boundary),
    tokens = tokenize(tail),
    partial = /[\p{L}\p{N}'’]$/u.test(tail),
    prefix = partial ? tokens.pop() ?? "" : "";
  return {
    prefix,
    history: tokens.slice(-2),
    suggestions: suggest(model, prefix, tokens.slice(-2), limit),
  };
}
export function acceptSuggestion(
  text: string,
  prefix: string,
  word: string,
): string {
  if (
    !tokenize(word).length ||
    tokenize(word).length !== 1 ||
    tokenize(word)[0] !== word
  )
    throw Error("Suggestion must be one normalized token");
  if (prefix && !text.toLowerCase().endsWith(prefix.toLowerCase()))
    throw Error("Prefix does not match text");
  return text.slice(0, text.length - prefix.length) + word + " ";
}
export function importModel(value: unknown): Model {
  const m = value as Model;
  if (!m || m.schemaVersion !== 1) throw Error("Unsupported model schema");
  for (const field of ["words", "histories", "sources"])
    if (
      !(m as any)[field] ||
      typeof (m as any)[field] !== "object" ||
      Array.isArray((m as any)[field])
    )
      throw Error("Invalid model " + field);
  for (const [w, n] of Object.entries(m.words)) {
    if (
      tokenize(w).length !== 1 ||
      tokenize(w)[0] !== w ||
      !Number.isSafeInteger(n) ||
      n <= 0
    )
      throw Error("Invalid word count");
    if (
      !Array.isArray(m.sources[w]) ||
      m.sources[w].some((s) => typeof s !== "string" || !s)
    )
      throw Error("Missing sources");
  }
  for (const [key, counts] of Object.entries(m.histories)) {
    let h;
    try {
      h = JSON.parse(key);
    } catch {
      throw Error("Invalid history key");
    }
    if (
      !Array.isArray(h) ||
      h.length < 1 ||
      h.length > 2 ||
      h.some((w) => typeof w !== "string" || !Object.hasOwn(m.words, w))
    )
      throw Error("Invalid history");
    if (!counts || typeof counts !== "object" || Array.isArray(counts))
      throw Error("Invalid history counts");
    for (const [w, n] of Object.entries(counts))
      if (
        !Object.hasOwn(m.words, w) ||
        !Number.isSafeInteger(n) ||
        n <= 0 ||
        n > m.words[w]
      )
        throw Error("Invalid conditional count");
  }
  return structuredClone(m);
}
export function renderPad(model: Model, initial = ""): string {
  return page(
    "Vocabulary Autocomplete Pad",
    '<p>Suggestions use your corpus only. A two-word history outranks a one-word history; unigram counts break the remaining ties.</p><label for="pad">Write here</label><textarea id="pad"></textarea><section><h2>Suggestions and evidence</h2><div id="suggestions" aria-live="polite"></div></section><div class="toolbar"><button id="model">Download vocabulary-model.json</button><button id="text">Download writing.txt</button></div>',
    `const model=${embedded(model)};const tokenize=${tokenize.toString()};const suggest=${suggest.toString()};const completeText=${completeText.toString()};const acceptSuggestion=${acceptSuggestion.toString()};const pad=document.querySelector('#pad');pad.value=${embedded(initial)};function update(){const result=completeText(model,pad.value),host=document.querySelector('#suggestions');host.replaceChildren();for(const item of result.suggestions){const b=document.createElement('button');b.textContent=item.word+' · history '+item.order+' · count '+item.count+' · '+item.sources.join(', ');b.onclick=()=>{pad.value=acceptSuggestion(pad.value,result.prefix,item.word);pad.focus();update()};host.append(b)}}pad.addEventListener('input',update);document.querySelector('#model').onclick=()=>download('vocabulary-model.json',model);document.querySelector('#text').onclick=()=>download('writing.txt',pad.value,'text/plain');update();`,
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
