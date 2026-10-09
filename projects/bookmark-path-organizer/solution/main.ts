export type Bookmark = {
  id: string;
  title: string;
  url: string;
  notes: string;
  folders: string[];
};
export type Group = { url: string; items: Bookmark[]; reason: string };
export type Reading = {
  id: string;
  title: string;
  url: string;
  originals: string[];
  folders: string[][];
  topics: string[];
  score: number;
  evidence: string[];
};
export type Progress = {
  schemaVersion: 1;
  order: string[];
  completed: string[];
};

export function importBookmarks(input: unknown): Bookmark[] {
  const result: Bookmark[] = [];
  const ids = new Set<string>();
  function walk(nodes: unknown, folders: string[], depth: number) {
    if (depth > 32) throw new Error("Folder nesting exceeds 32");
    for (const node of array(nodes, "bookmarks")) {
      if (!node || typeof node !== "object")
        throw new Error("Bookmark must be an object");
      if ("children" in node) {
        walk(
          node.children,
          [...folders, nonempty(node.title, "folder title")],
          depth + 1,
        );
        continue;
      }
      const id = nonempty(node.id, "id"),
        title = nonempty(node.title, "title"),
        url = nonempty(node.url, "url");
      normalizeURL(url);
      if (ids.has(id)) throw new Error("Duplicate id " + id);
      ids.add(id);
      if (node.notes !== undefined && typeof node.notes !== "string")
        throw new Error("notes must be text");
      result.push({
        id,
        title,
        url,
        notes: node.notes ?? "",
        folders: [...folders],
      });
    }
  }
  walk(input, [], 0);
  return result;
}
export function normalizeURL(value: string): string {
  const u = new URL(nonempty(value, "url"));
  if (!["http:", "https:"].includes(u.protocol) || u.username || u.password)
    throw new Error("Only HTTP(S) URLs without credentials are supported");
  u.hash = "";
  return u.href;
}
export function groupDuplicates(items: Bookmark[]): Group[] {
  const groups = new Map<string, Bookmark[]>();
  for (const item of items) {
    const key = normalizeURL(item.url);
    groups.set(key, [...(groups.get(key) ?? []), structuredClone(item)]);
  }
  return [...groups].map(([url, items]) => ({
    url,
    items,
    reason:
      items.length > 1
        ? "Same WHATWG URL after removing the fragment; query parameters remain significant."
        : "Unique normalized document URL.",
  }));
}
export function readingPath(
  groups: Group[],
  topics: Record<string, string[]>,
): Reading[] {
  const entries = Object.entries(topics);
  for (const [name, words] of entries) {
    nonempty(name, "topic");
    if (
      !Array.isArray(words) ||
      !words.length ||
      words.some((w) => typeof w !== "string" || !w.trim())
    )
      throw new Error("Each topic needs nonempty keywords");
  }
  const tokens = (s: string) =>
    new Set(s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
  return groups
    .map((group) => {
      let score = 0;
      const matched: string[] = [],
        evidence: string[] = [];
      for (const [topic, words] of entries) {
        let local = 0;
        for (const word of [...new Set(words.map((w) => w.toLowerCase()))]) {
          const title = group.items.some((x) => tokens(x.title).has(word)),
            notes = group.items.some((x) => tokens(x.notes).has(word));
          local += (title ? 3 : 0) + (notes ? 1 : 0);
          if (title || notes)
            evidence.push(
              `${topic}: ${word} = ${title ? 3 : 0} title + ${notes ? 1 : 0} notes`,
            );
        }
        if (local) matched.push(topic);
        score += local;
      }
      return {
        id: group.items[0].id,
        title: group.items[0].title,
        url: group.url,
        originals: group.items.map((x) => x.url),
        folders: group.items.map((x) => x.folders),
        topics: matched,
        score,
        evidence,
      };
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
export function applyProgress(
  items: Reading[],
  value?: unknown,
): { items: Reading[]; progress: Progress } {
  const ids = items.map((x) => x.id);
  let order = ids,
    completed: string[] = [];
  if (value !== undefined) {
    const p = value as Progress;
    if (
      !p ||
      p.schemaVersion !== 1 ||
      !Array.isArray(p.order) ||
      p.order.length !== ids.length ||
      new Set(p.order).size !== ids.length ||
      p.order.some((x) => !ids.includes(x))
    )
      throw new Error(
        "Progress order must contain every current id exactly once",
      );
    if (
      !Array.isArray(p.completed) ||
      new Set(p.completed).size !== p.completed.length ||
      p.completed.some((x) => !ids.includes(x))
    )
      throw new Error("Unknown or duplicate completed id");
    order = p.order;
    completed = p.completed;
  }
  return {
    items: order.map((id) => structuredClone(items.find((x) => x.id === id)!)),
    progress: {
      schemaVersion: 1,
      order: [...order],
      completed: [...completed],
    },
  };
}
export function renderCollection(items: Reading[], progress: Progress): string {
  return page(
    "Bookmark Path Organizer",
    `<p>A reading path with original links, retained folders and explicit topic evidence. Move items and download your progress for the next run.</p><button id="save">Download progress.json</button><div id="items"></div>`,
    `const items=${embedded(items)},state=${embedded(progress)};const root=document.querySelector('#items');function render(){root.replaceChildren();for(const id of state.order){const item=items.find(x=>x.id===id),row=document.createElement('article'),a=document.createElement('a');a.href=item.url;a.textContent=item.title;a.rel='noopener';row.append(a);const evidence=document.createElement('p');evidence.textContent='Score '+item.score+' · '+(item.evidence.join('; ')||'No topic match');row.append(evidence);const original=document.createElement('p');original.textContent='Originals: '+item.originals.join(' | ')+' · Folders: '+item.folders.map(x=>x.join('/')).join(' | ');row.append(original);const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=state.completed.includes(id);check.onchange=()=>{state.completed=check.checked?[...state.completed,id]:state.completed.filter(x=>x!==id)};label.append(check,' Read');row.append(label);for(const [text,d]of [['Move up',-1],['Move down',1]]){const b=document.createElement('button');b.textContent=text;b.disabled=state.order.indexOf(id)+d<0||state.order.indexOf(id)+d>=state.order.length;b.onclick=()=>{const i=state.order.indexOf(id);[state.order[i],state.order[i+d]]=[state.order[i+d],state.order[i]];render()};row.append(b)}root.append(row)}}document.querySelector('#save').onclick=()=>download('progress.json',state);render();`,
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
