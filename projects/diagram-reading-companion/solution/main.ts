export type Graph = {
  nodes: { id: string; label: string; explanation: string }[];
  edges: { from: string; to: string; label: string }[];
};
export type Analysis = {
  order: string[];
  branches: { id: string; targets: string[] }[];
  cycles: string[][];
  unreachable: string[];
};

export function loadDiagram(
  svg: string,
  value: unknown,
): { svg: string; graph: Graph } {
  if (typeof svg !== "string" || svg.length > 500000)
    throw Error("SVG must be text under 500000 characters");
  const allowed = new Set([
    "svg",
    "g",
    "rect",
    "circle",
    "ellipse",
    "line",
    "polyline",
    "polygon",
    "path",
    "text",
    "tspan",
    "title",
    "desc",
  ]);
  const attrs = new Set([
    "xmlns",
    "viewBox",
    "width",
    "height",
    "id",
    "x",
    "y",
    "x1",
    "x2",
    "y1",
    "y2",
    "cx",
    "cy",
    "r",
    "rx",
    "ry",
    "d",
    "points",
    "fill",
    "stroke",
    "stroke-width",
    "font-size",
    "font-family",
    "text-anchor",
    "transform",
    "role",
    "aria-labelledby",
  ]);
  const ids = new Set<string>(),
    stack: string[] = [];
  let roots = 0;
  for (const match of svg.matchAll(/<[^>]*>|</g)) {
    const raw = match[0],
      tag = raw.match(/^<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>$/);
    if (!tag || !allowed.has(tag[2])) throw Error("Unsupported SVG element");
    const name = tag[2];
    if (tag[1]) {
      if (tag[3].trim() || stack.pop() !== name) throw Error("Unbalanced SVG");
      continue;
    }
    if (stack.length === 0) {
      if (name !== "svg" || roots++) throw Error("SVG needs one root");
    }
    const tail = tag[3].replace(/\/$/, "");
    const pairs = [
      ...tail.matchAll(/\s+([a-zA-Z][a-zA-Z0-9:-]*)\s*=\s*("[^"]*"|'[^']*')/g),
    ];
    if (
      tail
        .replace(/\s+([a-zA-Z][a-zA-Z0-9:-]*)\s*=\s*("[^"]*"|'[^']*')/g, "")
        .trim()
    )
      throw Error("SVG attributes must be quoted");
    for (const a of pairs) {
      const key = a[1],
        v = a[2].slice(1, -1);
      if (!attrs.has(key) || /[<&]/.test(v) || /url\s*\(/i.test(v))
        throw Error("Unsafe SVG attribute");
      if (key === "id") {
        if (!/^[a-z][a-z0-9-]*$/.test(v) || ids.has(v))
          throw Error("Duplicate or invalid SVG id");
        ids.add(v);
      }
    }
    if (!/\/$/.test(tag[3])) stack.push(name);
  }
  if (roots !== 1 || stack.length) throw Error("Incomplete SVG");
  const g = value as Graph;
  if (!g || typeof g !== "object") throw Error("Graph must be an object");
  const nodeIds = new Set<string>();
  const nodes = array(g.nodes, "nodes").map((n) => {
    const id = nonempty(n.id, "node id");
    if (nodeIds.has(id) || !ids.has(id))
      throw Error("Node missing from SVG or duplicated: " + id);
    nodeIds.add(id);
    return {
      id,
      label: nonempty(n.label, "label"),
      explanation: nonempty(n.explanation, "explanation"),
    };
  });
  if (!nodes.length) throw Error("Diagram needs at least one declared node");
  const edgeIds = new Set<string>();
  const edges = array(g.edges, "edges").map((e) => {
    if (!nodeIds.has(e.from) || !nodeIds.has(e.to))
      throw Error("Unknown edge endpoint");
    const k = JSON.stringify([e.from, e.to]);
    if (edgeIds.has(k)) throw Error("Duplicate edge");
    edgeIds.add(k);
    return { from: e.from, to: e.to, label: nonempty(e.label, "edge label") };
  });
  return { svg, graph: { nodes, edges } };
}
export function analyzeGraph(graph: Graph): Analysis {
  const ids = graph.nodes.map((n) => n.id),
    adj = new Map(
      ids.map((id) => [
        id,
        graph.edges.filter((e) => e.from === id).map((e) => e.to),
      ]),
    ),
    roots = ids.filter((id) => !graph.edges.some((e) => e.to === id)),
    order: string[] = [],
    seen = new Set<string>();
  function visit(id: string) {
    if (seen.has(id)) return;
    seen.add(id);
    order.push(id);
    for (const to of adj.get(id)!) visit(to);
  }
  roots.forEach(visit);
  const unreachable = ids.filter((id) => !seen.has(id));
  ids.forEach(visit);
  const colors = new Map<string, number>(),
    path: string[] = [],
    cycles: string[][] = [];
  function cycle(id: string) {
    colors.set(id, 1);
    path.push(id);
    for (const to of adj.get(id)!) {
      if (colors.get(to) === 1)
        cycles.push([...path.slice(path.indexOf(to)), to]);
      else if (!colors.has(to)) cycle(to);
    }
    path.pop();
    colors.set(id, 2);
  }
  ids.forEach((id) => {
    if (!colors.has(id)) cycle(id);
  });
  return {
    order,
    branches: ids
      .filter((id) => adj.get(id)!.length > 1)
      .map((id) => ({ id, targets: adj.get(id)! })),
    cycles,
    unreachable,
  };
}
export function reviewGraph(
  graph: Graph,
  value?: unknown,
): { schemaVersion: 1; graph: Graph; order: string[]; reviewed: boolean } {
  const ids = graph.nodes.map((n) => n.id);
  if (value === undefined)
    return {
      schemaVersion: 1,
      graph: structuredClone(graph),
      order: analyzeGraph(graph).order,
      reviewed: false,
    };
  const r = value as any;
  if (
    !r ||
    r.schemaVersion !== 1 ||
    !Array.isArray(r.order) ||
    r.order.length !== ids.length ||
    new Set(r.order).size !== ids.length ||
    r.order.some((id: string) => !ids.includes(id))
  )
    throw Error("Review order must contain every node exactly once");
  if (typeof r.reviewed !== "boolean")
    throw Error("Review needs boolean reviewed");
  const explanations = r.explanations ?? {};
  if (
    !explanations ||
    typeof explanations !== "object" ||
    Array.isArray(explanations) ||
    Object.keys(explanations).some((id) => !ids.includes(id))
  )
    throw Error("Unknown explanation id");
  const copy = structuredClone(graph);
  copy.nodes.forEach((n) => {
    if (Object.hasOwn(explanations, n.id))
      n.explanation = nonempty(explanations[n.id], "explanation");
  });
  return {
    schemaVersion: 1,
    graph: copy,
    order: [...r.order],
    reviewed: r.reviewed,
  };
}
export function renderWalkthrough(
  svg: string,
  review: ReturnType<typeof reviewGraph>,
): string {
  const analysis = analyzeGraph(review.graph);
  return page(
    "Diagram Reading Companion",
    `<p>Follow the proposed order, inspect branch destinations, then review the explanations. The diagram was authored with explicit relationships.</p><section id="dc-diagram" data-ui="diagram">${svg}</section><nav id="dc-nodes" data-ui="nodes" aria-label="Diagram reading order"></nav><section><h2 id="dc-label" data-ui="label"></h2><p id="dc-edges" data-ui="edges"></p><label for="dc-explanation">Explanation</label><textarea id="dc-explanation" data-ui="explanation"></textarea><div class="toolbar"><button id="dc-previous" data-ui="previous">Previous node</button><button id="dc-next" data-ui="next">Next node</button></div></section><label for="dc-order">Reading order (comma separated IDs)</label><input id="dc-order" data-ui="order" style="width:90%"><label><input type="checkbox" id="dc-reviewed" data-ui="reviewed"> I reviewed this order</label><button id="dc-save" data-ui="save">Download graph-review.json</button><p id="dc-status" data-ui="status" role="status"></p><h2>Graph structure</h2><pre>${escapeHTML(JSON.stringify(analysis, null, 2))}</pre><style>[data-ui=diagram] .active:is(rect,circle,ellipse,path,line,polyline,polygon),[data-ui=diagram] .active :is(rect,circle,ellipse,path,line,polyline,polygon){stroke:#e18b31!important;stroke-width:5!important}[data-ui=diagram] text{stroke:none!important}</style>`,
    `const data=${embedded(review)},state={schemaVersion:1,order:data.order,reviewed:data.reviewed,explanations:Object.fromEntries(data.graph.nodes.map(n=>[n.id,n.explanation]))};let index=0;const order=document.querySelector('[data-ui=order]'),note=document.querySelector('[data-ui=explanation]');order.value=state.order.join(',');document.querySelector('[data-ui=reviewed]').checked=state.reviewed;function show(){const id=state.order[index],node=data.graph.nodes.find(n=>n.id===id);document.querySelector('[data-ui=label]').textContent=node.label;note.value=state.explanations[id];document.querySelector('[data-ui=edges]').textContent='Next relationships: '+(data.graph.edges.filter(e=>e.from===id).map(e=>e.label+' → '+e.to).join('; ')||'end');document.querySelectorAll('[data-ui=diagram] .active').forEach(x=>x.classList.remove('active'));document.querySelector('[data-ui=diagram]').querySelector('[id="'+id+'"]').classList.add('active');document.querySelector('[data-ui=previous]').disabled=index===0;document.querySelector('[data-ui=next]').disabled=index===state.order.length-1;const nav=document.querySelector('[data-ui=nodes]');nav.replaceChildren();state.order.forEach((id,i)=>{const b=document.createElement('button');b.textContent=(i+1)+'. '+data.graph.nodes.find(n=>n.id===id).label;b.setAttribute('aria-current',String(i===index));b.onclick=()=>{index=i;show()};nav.append(b)})}note.oninput=()=>{state.explanations[state.order[index]]=note.value};document.querySelector('[data-ui=previous]').onclick=()=>{index--;show()};document.querySelector('[data-ui=next]').onclick=()=>{index++;show()};document.querySelector('[data-ui=save]').onclick=()=>{const ids=order.value.split(',').map(x=>x.trim());if(ids.length!==data.order.length||new Set(ids).size!==ids.length||ids.some(id=>!data.order.includes(id))||Object.values(state.explanations).some(x=>!x.trim())){document.querySelector('[data-ui=status]').textContent='Fix the order or empty explanation before export.';return}state.order=ids;state.reviewed=document.querySelector('[data-ui=reviewed]').checked;download('graph-review.json',state);index=0;show();document.querySelector('[data-ui=status]').textContent='Review exported.'};show();`,
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
