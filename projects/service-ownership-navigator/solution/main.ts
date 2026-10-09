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

function repoPath(value: string): string {
  nonempty(value, "repository path");
  const p = value.replace(/^\//, "");
  if (
    !p ||
    p.includes("\\") ||
    p.split("/").some((x) => !x || x === "." || x === "..") ||
    /[\x00-\x1f]/.test(p)
  )
    throw Error("Invalid repository path");
  return p;
}
function owners(value: unknown): string[] {
  const list = array(value, "owners");
  if (
    !list.length ||
    list.some(
      (x) => typeof x !== "string" || !/^@[a-zA-Z0-9][a-zA-Z0-9_/-]*$/.test(x),
    )
  )
    throw Error("Owners must be @user or @org/team names");
  return [...new Set(list)];
}
export function parseOwnershipRules(
  text: string,
  source = "CODEOWNERS",
): Rule[] {
  const rules: Rule[] = [];
  for (const [i, line] of text.split(/\r?\n/).entries()) {
    const clean = line.replace(/\s+#.*$/, "").trim();
    if (!clean || clean.startsWith("#")) continue;
    const [pattern, ...names] = clean.split(/\s+/);
    if (
      !pattern ||
      /[!\[\]\\]/.test(pattern) ||
      pattern.includes("..") ||
      pattern === "/" ||
      !names.length
    )
      throw Error("Unsupported ownership rule on line " + (i + 1));
    rules.push({ pattern, owners: owners(names), line: i + 1, source });
  }
  return rules;
}
export function loadCatalog(value: unknown): Catalog {
  const v = value as any;
  if (!v || typeof v !== "object") throw Error("Catalog must be an object");
  const ids = new Set<string>(),
    roots = new Set<string>();
  const services = array(v.services, "services").map((s) => {
    const id = nonempty(s.id, "service id"),
      root = repoPath(s.root.replace(/\/$/, ""));
    if (ids.has(id) || roots.has(root))
      throw Error("Duplicate service identity or root");
    ids.add(id);
    roots.add(root);
    return {
      id,
      name: nonempty(s.name, "name"),
      root,
      owners: owners(s.owners),
      runbook: repoPath(s.runbook),
      dependencies: array(s.dependencies ?? [], "dependencies").map((x) =>
        nonempty(x, "dependency id"),
      ),
    };
  });
  if (services.some((s) => s.dependencies.some((d) => !ids.has(d))))
    throw Error("Unknown service dependency");
  if (
    !v.runbooks ||
    typeof v.runbooks !== "object" ||
    Array.isArray(v.runbooks)
  )
    throw Error("runbooks must be a path-to-Markdown object");
  const runbooks: Record<string, string> = Object.create(null);
  for (const [p, text] of Object.entries(v.runbooks))
    runbooks[repoPath(p)] = nonempty(text, "runbook text");
  return {
    services,
    rules: parseOwnershipRules(nonempty(v.codeowners, "codeowners")),
    runbooks,
  };
}
export function matchesRule(pattern: string, path: string): boolean {
  const p = repoPath(path);
  let source = pattern.replace(/^\//, "");
  const anchored = pattern.startsWith("/") || source.includes("/"),
    directory = source.endsWith("/");
  if (directory) source = source.slice(0, -1);
  let expression = "";
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === "*" && source[i + 1] === "*") {
      i++;
      if (source[i + 1] === "/") {
        i++;
        expression += "(?:.*/)?";
      } else expression += ".*";
    } else if (c === "*") expression += "[^/]*";
    else if (c === "?") expression += "[^/]";
    else expression += c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(
    (anchored ? "^" : "(?:^|/)") + expression + (directory ? "(?:/.*)?$" : "$"),
  ).test(p);
}
export function resolveOwnership(catalog: Catalog, path: string): Ownership {
  const p = repoPath(path),
    service =
      catalog.services
        .filter((s) => p === s.root || p.startsWith(s.root + "/"))
        .sort((a, b) => b.root.length - a.root.length)[0] ?? null,
    matchedRules = catalog.rules.filter((r) => matchesRule(r.pattern, p)),
    effective = matchedRules.at(-1),
    resolved = effective?.owners ?? service?.owners ?? [],
    conflicts: string[] = [],
    evidence: Ownership["evidence"] = [];
  if (service)
    evidence.push({
      source: "catalog.json",
      line: 0,
      detail:
        "Service " +
        service.id +
        " root " +
        service.root +
        " declares " +
        service.owners.join(", "),
    });
  for (const r of matchedRules)
    evidence.push({
      source: r.source,
      line: r.line,
      detail: r.pattern + " => " + r.owners.join(", "),
    });
  const key = (o: string[]) => [...o].sort().join("|");
  if (effective && service && key(effective.owners) !== key(service.owners))
    conflicts.push("Effective path owners differ from service catalog owners");
  if (
    effective &&
    matchedRules
      .slice(0, -1)
      .some((r) => key(r.owners) !== key(effective.owners))
  )
    conflicts.push(
      "Earlier matching rules name different owners; last matching rule wins",
    );
  if (!resolved.length) conflicts.push("No ownership evidence for this path");
  return {
    path: p,
    service: service ? structuredClone(service) : null,
    owners: [...resolved],
    matchedRules: structuredClone(matchedRules),
    conflicts,
    evidence,
  };
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
  const text = catalog.runbooks[service.runbook];
  if (text === undefined)
    return {
      path: service.runbook,
      exists: false,
      headings: [],
      links: [],
      issues: ["Missing runbook file"],
    };
  const headings = [...text.matchAll(/^#{1,6}\s+(.+)$/gm)].map((x) => x[1]),
    links: { target: string; exists: boolean }[] = [],
    issues: string[] = [];
  for (const match of text.matchAll(/\[[^\]]*\]\(([^\s)]+)\)/g)) {
    const target = match[1];
    if (/^https?:\/\//.test(target) || target.startsWith("#")) continue;
    let resolved: string;
    try {
      const base = service.runbook.split("/").slice(0, -1),
        parts = [...base, ...target.split("#")[0].split("/")],
        clean: string[] = [];
      for (const part of parts) {
        if (part === "..") {
          if (!clean.length) throw Error();
          clean.pop();
        } else if (part !== "." && part) clean.push(part);
      }
      resolved = repoPath(clean.join("/"));
    } catch {
      issues.push("Unsafe runbook link: " + target);
      continue;
    }
    const exists = Object.hasOwn(catalog.runbooks, resolved);
    links.push({ target: resolved, exists });
    if (!exists) issues.push("Missing local runbook link: " + resolved);
  }
  if (!headings.length) issues.push("Runbook has no Markdown headings");
  return { path: service.runbook, exists: true, headings, links, issues };
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
  const ownership = resolveOwnership(catalog, path);
  return {
    schemaVersion: 1,
    ownership,
    runbook: ownership.service
      ? checkRunbook(catalog, ownership.service)
      : null,
    dependencies: ownership.service
      ? ownership.service.dependencies.map((id) => ({
          id,
          owners: [...catalog.services.find((s) => s.id === id)!.owners],
        }))
      : [],
  };
}
export function renderDirectory(
  catalog: Catalog,
  packet: ReturnType<typeof handoffPacket>,
): string {
  return page(
    "Service Ownership Navigator",
    `<p>Search the local directory, then inspect the handoff packet. Ownership uses the last matching rule; conflicts stay visible. No notifications are sent.</p><label for="search">Filter service name, owner or root</label><input id="search" type="search"><div id="directory">${catalog.services
      .map((s) => {
        const r = checkRunbook(catalog, s);
        return `<section data-search="${escapeHTML([s.name, s.root, ...s.owners].join(" ").toLowerCase())}"><h2>${escapeHTML(s.name)}</h2><p>Root: <code>${escapeHTML(s.root)}</code></p><p>Catalog owners: ${escapeHTML(s.owners.join(", "))}</p><p>Runbook: ${escapeHTML(s.runbook)} · ${r.exists ? "present" : "missing"}</p><details><summary>Runbook content and link checks</summary><pre>${escapeHTML(catalog.runbooks[s.runbook] ?? "No file supplied")}</pre><p>${escapeHTML(r.issues.join("; ") || "Local references resolve. External URLs are not fetched.")}</p></details></section>`;
      })
      .join(
        "",
      )}</div><h2>Handoff: ${escapeHTML(packet.ownership.path)}</h2><p>Effective owners: ${escapeHTML(packet.ownership.owners.join(", ") || "unresolved")}</p><p class="alert">${escapeHTML(packet.ownership.conflicts.join("; ") || "No conflicting ownership evidence")}</p><table><tr><th>Source</th><th>Line</th><th>Evidence</th></tr>${packet.ownership.evidence.map((e) => `<tr><td>${escapeHTML(e.source)}</td><td>${e.line || "catalog entry"}</td><td>${escapeHTML(e.detail)}</td></tr>`).join("")}</table><button id="save">Download handoff.json</button>`,
    `document.querySelector('#search').oninput=e=>{const q=e.target.value.toLowerCase();document.querySelectorAll('[data-search]').forEach(s=>s.hidden=!s.dataset.search.includes(q))};document.querySelector('#save').onclick=()=>download('handoff.json',${embedded(packet)});`,
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
