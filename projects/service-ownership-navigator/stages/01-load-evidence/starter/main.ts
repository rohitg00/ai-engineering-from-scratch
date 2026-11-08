export type Service = {
  id: string;
  name: string;
  root: string;
  owners: string[];
  runbook: string;
  dependencies: string[];
};
export type Rule = {
  pattern: string;
  owners: string[];
  line: number;
  source: string;
};
export type Catalog = {
  services: Service[];
  rules: Rule[];
  runbooks: Record<string, string>;
};
export type Ownership = {
  path: string;
  service: Service | null;
  owners: string[];
  matchedRules: Rule[];
  conflicts: string[];
  evidence: { source: string; line: number; detail: string }[];
};
export function parseOwnershipRules(
  text: string,
  source = "CODEOWNERS",
): Rule[] {
  throw Error("Implement parseOwnershipRules in stage 1");
}
export function loadCatalog(value: unknown): Catalog {
  throw Error("Implement loadCatalog in stage 1");
}
export function matchesRule(pattern: string, path: string): boolean {
  throw Error("Implement matchesRule in stage 2");
}
export function resolveOwnership(catalog: Catalog, path: string): Ownership {
  throw Error("Implement resolveOwnership in stage 2");
}
export function checkRunbook(
  catalog: Catalog,
  service: Service,
): {
  path: string;
  exists: boolean;
  headings: string[];
  links: { target: string; exists: boolean }[];
  issues: string[];
} {
  throw Error("Implement checkRunbook in stage 3");
}
export function handoffPacket(
  catalog: Catalog,
  path: string,
): {
  schemaVersion: 1;
  ownership: Ownership;
  runbook: ReturnType<typeof checkRunbook> | null;
  dependencies: { id: string; owners: string[] }[];
} {
  throw Error("Implement handoffPacket in stage 4");
}
export function renderDirectory(
  catalog: Catalog,
  packet: ReturnType<typeof handoffPacket>,
): string {
  throw Error("Implement renderDirectory in stage 4");
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
