export type Message = {
  key: string;
  text: string;
  context: string;
  ambiguous: boolean;
  placeholders: string[];
};
export type Proposal = {
  key: string;
  translation: string | null;
  issues: string[];
  needsContext: boolean;
};

export function placeholders(text: string): string[] {
  const rest = text.replace(/\{[a-zA-Z_][a-zA-Z0-9_]*\}/g, "");
  if (/[{}]/.test(rest))
    throw Error("Only simple {name} placeholders are supported");
  return (text.match(/\{[a-zA-Z_][a-zA-Z0-9_]*\}/g) ?? []).sort();
}
export function readCatalog(value: unknown): Message[] {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Catalog must be a keyed object");
  return Object.entries(value).map(([key, v]: [string, any]) => {
    if (
      !/^[a-zA-Z][a-zA-Z0-9_.-]*$/.test(key) ||
      ["constructor", "prototype", "__proto__"].includes(key)
    )
      throw Error("Invalid message key");
    if (!v || typeof v !== "object" || Array.isArray(v))
      throw Error("Message needs text and context");
    const text = nonempty(v.text, "message text"),
      context = nonempty(v.context, "context");
    if (v.ambiguous !== undefined && typeof v.ambiguous !== "boolean")
      throw Error("ambiguous must be boolean");
    return {
      key,
      text,
      context,
      ambiguous: v.ambiguous ?? false,
      placeholders: placeholders(text),
    };
  });
}
export function proposeTranslations(
  messages: Message[],
  recorded: unknown,
  locale: string,
): Proposal[] {
  try {
    new Intl.Locale(locale);
  } catch {
    throw Error("Invalid locale");
  }
  if (!recorded || typeof recorded !== "object" || Array.isArray(recorded))
    throw Error("Proposals must be a keyed object");
  if (Object.keys(recorded).some((k) => !messages.some((m) => m.key === k)))
    throw Error("Unknown translation key");
  return messages.map((m) => {
    const t = (recorded as any)[m.key];
    if (t === undefined)
      return {
        key: m.key,
        translation: null,
        issues: ["Missing recorded proposal"],
        needsContext: m.ambiguous,
      };
    if (typeof t !== "string" || !t.trim() || t.length > 2000)
      throw Error("Proposal must contain 1..2000 characters");
    const issues: string[] = [];
    try {
      if (JSON.stringify(placeholders(t)) !== JSON.stringify(m.placeholders))
        issues.push("Placeholder multiset changed");
    } catch {
      issues.push("Unsupported placeholder syntax");
    }
    return { key: m.key, translation: t, issues, needsContext: m.ambiguous };
  });
}
export function previewMessage(
  template: string,
  values: Record<string, string | number>,
): string {
  placeholders(template);
  return template.replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, (_, name) =>
    Object.hasOwn(values, name) ? String(values[name]) : "{" + name + "}",
  );
}
export function reviewTranslations(
  messages: Message[],
  proposals: Proposal[],
  value?: unknown,
): {
  catalog: Record<string, string>;
  unresolved: { key: string; reasons: string[] }[];
  review: any;
} {
  const rows = value === undefined ? {} : (value as any)?.decisions;
  if (
    value !== undefined &&
    ((value as any)?.schemaVersion !== 1 ||
      !rows ||
      typeof rows !== "object" ||
      Array.isArray(rows) ||
      Object.keys(rows).some((k) => !messages.some((m) => m.key === k)))
  )
    throw Error("Invalid translation review");
  const catalog: Record<string, string> = {},
    unresolved: { key: string; reasons: string[] }[] = [],
    decisions: Record<string, any> = {};
  for (const msg of messages) {
    const p = proposals.find((p) => p.key === msg.key);
    if (!p) throw Error("Missing proposal record");
    const d = rows[msg.key] ?? {
      decision: "pending",
      translation: p.translation,
      acknowledgeContext: false,
    };
    if (
      !["pending", "approve", "reject"].includes(d.decision) ||
      d.translation !== p.translation ||
      typeof d.acknowledgeContext !== "boolean"
    )
      throw Error("Stale or invalid translation decision");
    const reasons = [...p.issues];
    if (d.decision === "approve") {
      if (
        p.translation === null ||
        p.issues.length ||
        (p.needsContext && !d.acknowledgeContext)
      )
        throw Error(
          "Resolve translation issues or context before approving " + msg.key,
        );
      catalog[msg.key] = p.translation;
    } else {
      reasons.push(
        d.decision === "reject" ? "Proposal rejected" : "Awaiting review",
      );
      if (p.needsContext)
        reasons.push("Ambiguous context requires acknowledgement");
      unresolved.push({ key: msg.key, reasons });
    }
    decisions[msg.key] = structuredClone(d);
  }
  return { catalog, unresolved, review: { schemaVersion: 1, decisions } };
}
export function renderWorkbench(
  messages: Message[],
  proposals: Proposal[],
  state: ReturnType<typeof reviewTranslations>,
  locale: string,
  values: Record<string, string | number> = {},
): string {
  return page(
    "UI String Localization Workbench",
    `<p>Recorded proposals for <strong>${escapeHTML(locale)}</strong>. Every approved key must keep its placeholder multiset. Ambiguous context needs an explicit acknowledgement.</p><label for="variables">Preview variables (JSON object)</label><textarea id="variables">${escapeHTML(JSON.stringify(values, null, 2))}</textarea><p id="error" role="status"></p>${messages
      .map((msg) => {
        const p = proposals.find((p) => p.key === msg.key)!;
        return `<section><h2>${escapeHTML(msg.key)}</h2><p>Source: ${escapeHTML(msg.text)}</p><p>Context: ${escapeHTML(msg.context)}</p><p lang="${escapeHTML(locale)}">Proposal: ${escapeHTML(p.translation ?? "No proposal")}</p><p>Preview: <strong data-preview="${escapeHTML(msg.key)}" lang="${escapeHTML(locale)}"></strong></p><p class="alert">${escapeHTML(p.issues.join("; ") || "Placeholder contract preserved")}</p><label>Decision <select data-key="${escapeHTML(msg.key)}"><option value="pending">Pending</option><option value="approve" ${p.issues.length ? "disabled" : ""}>Approve</option><option value="reject">Reject</option></select></label>${msg.ambiguous ? `<label><input type="checkbox" data-context="${escapeHTML(msg.key)}"> I checked the ambiguous context</label>` : ""}</section>`;
      })
      .join("")}<button id="save">Download locale-review.json</button>`,
    `const messages=${embedded(messages)},proposals=${embedded(proposals)},state=${embedded(state.review)};const placeholders=${placeholders.toString()},previewMessage=${previewMessage.toString()};function update(){try{const values=JSON.parse(document.querySelector('#variables').value);if(!values||typeof values!=='object'||Array.isArray(values))throw Error('Use a JSON object');document.querySelectorAll('[data-preview]').forEach(x=>{x.textContent=previewMessage(proposals.find(p=>p.key===x.dataset.preview).translation||'',values)});document.querySelector('#error').textContent=''}catch(e){document.querySelector('#error').textContent=e.message}}document.querySelector('#variables').oninput=update;document.querySelectorAll('[data-key]').forEach(s=>{s.value=state.decisions[s.dataset.key].decision;s.onchange=()=>{state.decisions[s.dataset.key].decision=s.value}});document.querySelectorAll('[data-context]').forEach(c=>{c.checked=state.decisions[c.dataset.context].acknowledgeContext;c.onchange=()=>{state.decisions[c.dataset.context].acknowledgeContext=c.checked}});document.querySelector('#save').onclick=()=>{for(const p of proposals){const d=state.decisions[p.key];if(d.decision==='approve'&&(p.issues.length||p.needsContext&&!d.acknowledgeContext)){document.querySelector('#error').textContent='Resolve issues and acknowledge context for '+p.key;return}}download('locale-review.json',state)};update();`,
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
