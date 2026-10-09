export type Criterion = {
  id: string;
  label: string;
  weight: number;
  direction: "benefit" | "cost";
  min: number;
  max: number;
  limit?: number;
};
export type Option = {
  id: string;
  label: string;
  values: Record<string, number | null>;
  notes: Record<string, string>;
};
export type Decision = { criteria: Criterion[]; options: Option[] };
export function parse(text: string): Decision {
  if (Buffer.byteLength(text) > 1_048_576) throw Error("input exceeds one MiB");
  const x = JSON.parse(text);
  if (
    !x ||
    !Array.isArray(x.criteria) ||
    !Array.isArray(x.options) ||
    !x.criteria.length ||
    !x.options.length ||
    x.criteria.length > 30 ||
    x.options.length > 200
  )
    throw Error("bounded criteria and options required");
  const ids = new Set<string>();
  let total = 0;
  for (const c of x.criteria) {
    if (
      !c ||
      typeof c.id !== "string" ||
      !c.id.trim() ||
      ids.has(c.id) ||
      typeof c.label !== "string" ||
      !c.label.trim() ||
      !["benefit", "cost"].includes(c.direction) ||
      ![c.weight, c.min, c.max].every(Number.isFinite) ||
      c.weight < 0 ||
      c.min >= c.max ||
      !Number.isFinite(c.max - c.min) ||
      (c.limit !== undefined && !Number.isFinite(c.limit))
    )
      throw Error("invalid criterion");
    ids.add(c.id);
    total += c.weight;
  }
  if (!Number.isFinite(total) || total <= 0)
    throw Error("positive finite total weight required");
  const seen = new Set<string>();
  for (const o of x.options) {
    if (
      !o ||
      typeof o.id !== "string" ||
      !o.id.trim() ||
      seen.has(o.id) ||
      typeof o.label !== "string" ||
      !o.label.trim() ||
      !o.values ||
      !o.notes ||
      Array.isArray(o.values) ||
      Array.isArray(o.notes)
    )
      throw Error("invalid option");
    seen.add(o.id);
    if (
      Object.keys(o.values).some((k) => !ids.has(k)) ||
      Object.keys(o.notes).some((k) => !ids.has(k))
    )
      throw Error("unknown criterion");
    for (const c of x.criteria) {
      const v = o.values[c.id];
      if (v !== null && (!Number.isFinite(v) || v < c.min || v > c.max))
        throw Error("value outside declared range");
      if (typeof o.notes[c.id] !== "string" || !o.notes[c.id].trim())
        throw Error("source note required");
    }
  }
  return x;
}
export function normalize(c: Criterion, v: number): number {
  return c.direction === "benefit"
    ? (v - c.min) / (c.max - c.min)
    : (c.max - v) / (c.max - c.min);
}
export function score(
  data: Decision,
  weights: Record<string, number> = {},
): Array<{
  id: string;
  label: string;
  score: number | null;
  missing: string[];
  violations: string[];
  normalized: Record<string, number | null>;
}> {
  const ws = data.criteria.map((c) =>
    Object.hasOwn(weights, c.id) ? weights[c.id] : c.weight,
  );
  const total = ws.reduce((a, b) => a + b, 0);
  if (
    ws.some((w) => !Number.isFinite(w) || w < 0) ||
    !Number.isFinite(total) ||
    total <= 0
  )
    throw Error("invalid weights");
  return data.options
    .map((o) => {
      const missing: string[] = [],
        violations: string[] = [],
        normalized: Record<string, number | null> = Object.create(null);
      let sum = 0;
      data.criteria.forEach((c, i) => {
        const v = o.values[c.id];
        if (v === null) {
          missing.push(c.id);
          normalized[c.id] = null;
          return;
        }
        normalized[c.id] = normalize(c, v);
        sum += (normalized[c.id]! * ws[i]) / total;
        if (
          c.limit !== undefined &&
          (c.direction === "cost" ? v > c.limit : v < c.limit)
        )
          violations.push(c.id);
      });
      return {
        id: o.id,
        label: o.label,
        score: missing.length || violations.length ? null : sum,
        missing,
        violations,
        normalized,
      };
    })
    .sort(
      (a, b) => (b.score ?? -1) - (a.score ?? -1) || a.id.localeCompare(b.id),
    );
}
export function dominated(data: Decision): string[] {
  const rows = score(data).filter((r) => r.score !== null);
  return rows
    .filter((a) =>
      rows.some(
        (b) =>
          a.id !== b.id &&
          data.criteria.every(
            (c) => b.normalized[c.id]! >= a.normalized[c.id]!,
          ) &&
          data.criteria.some((c) => b.normalized[c.id]! > a.normalized[c.id]!),
      ),
    )
    .map((r) => r.id)
    .sort();
}
export function sensitivity(data: Decision, id: string, steps = 10) {
  if (
    !data.criteria.some((c) => c.id === id) ||
    !Number.isInteger(steps) ||
    steps < 1 ||
    steps > 100
  )
    throw Error("invalid sensitivity sweep");
  const others = data.criteria.filter((c) => c.id !== id),
    total = others.reduce((s, c) => s + c.weight, 0);
  if (!others.length || total <= 0)
    throw Error("sweep requires another positive weight");
  return Array.from({ length: steps + 1 }, (_, i) => {
    const weight = i / steps,
      weights: Record<string, number> = Object.create(null);
    weights[id] = weight;
    for (const c of others) weights[c.id] = ((1 - weight) * c.weight) / total;
    const rows = score(data, weights);
    return {
      weight,
      weights,
      winner: rows.find((r) => r.score !== null)?.id ?? null,
      scores: rows,
    };
  });
}
export function record(
  data: Decision,
  weights: Record<string, number> = {},
  chosen?: string,
) {
  const rows = score(data, weights),
    winner = rows.find((r) => r.score !== null)?.id ?? null;
  const selected = chosen ?? winner;
  if (
    selected !== null &&
    !rows.some((r) => r.id === selected && r.score !== null)
  )
    throw Error("chosen option must be eligible");
  return {
    schemaVersion: 1,
    chosen: selected,
    winner,
    weights: Object.fromEntries(
      data.criteria.map((c) => [
        c.id,
        Object.hasOwn(weights, c.id) ? weights[c.id] : c.weight,
      ]),
    ),
    criteria: data.criteria,
    options: data.options,
    scores: rows,
    dominated: dominated(data),
    assumptions: [
      "Fixed declared ranges; unknowns are ineligible.",
      "Weights express preferences, not probabilities.",
    ],
  };
}
function cell(v: unknown) {
  let x = String(v ?? "");
  if (/^[=+@\-\t\r]/.test(x)) x = "'" + x;
  return '"' + x.replaceAll('"', '""') + '"';
}
export function csv(data: Decision): string {
  return (
    [
      ["option", "criterion", "value", "source_note"],
      ...data.options.flatMap((o) =>
        data.criteria.map((c) => [o.id, c.id, o.values[c.id], o.notes[c.id]]),
      ),
    ]
      .map((row) => row.map(cell).join(","))
      .join("\r\n") + "\r\n"
  );
}
export function html(data: Decision): string {
  const payload = JSON.stringify(data)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Decision tradeoff board</title><style>body{font:16px system-ui;max-width:1000px;margin:40px auto;padding:0 20px;color:#17332e;background:#f6f9f5}label{display:block;margin:16px 0}input{width:200px}table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:12px;border-bottom:1px solid #bbc9bd}button,select{padding:10px;margin:12px 8px 12px 0}#table{overflow-x:auto}small{display:block} @media(prefers-color-scheme:dark){body{background:#13241e;color:#ecf5ef}}</style><h1>Decision tradeoff board</h1><p>Change priorities, inspect unknowns and download the chosen scenario.</p><div id="controls"></div><p id="summary" role="status"></p><div id="table"></div><label>Chosen eligible option <select id="chosen"></select></label><button id="download">Download decision record</button><p>Declared ranges stay fixed. Missing values and constraint failures remain ineligible.</p><script>const data=${payload};const normalize=${normalize.toString()};const score=${score.toString()};const dominated=${dominated.toString()};const record=${record.toString()};const weights=Object.create(null);let current;const chosen=document.querySelector('#chosen');for(const c of data.criteria){weights[c.id]=c.weight;const label=document.createElement('label'),input=document.createElement('input'),value=document.createElement('output');label.append(document.createTextNode(c.label+' '));input.type='range';input.min='0';input.max=String(Math.max(1,...data.criteria.map(x=>x.weight)));input.step='0.01';input.value=String(c.weight);input.setAttribute('aria-label',c.label+' weight');value.textContent=String(c.weight);input.oninput=()=>{weights[c.id]=Number(input.value);value.textContent=input.value;draw()};label.append(input,value);document.querySelector('#controls').append(label)}function draw(){try{current=record(data,weights);document.querySelector('#summary').textContent='Highest score: '+(current.winner??'no eligible option');const table=document.createElement('table');for(const cells of [['Option','Score','Missing','Constraints'],...current.scores.map(r=>[r.label,r.score===null?'ineligible':r.score.toFixed(3),r.missing.join(', '),r.violations.join(', ')])]){const tr=document.createElement('tr');for(const text of cells){const td=document.createElement('td');td.textContent=text;tr.append(td)}table.append(tr)}document.querySelector('#table').replaceChildren(table);const previous=chosen.value;chosen.replaceChildren();for(const r of current.scores.filter(r=>r.score!==null)){const o=document.createElement('option');o.value=r.id;o.textContent=r.label;chosen.append(o)}if([...chosen.options].some(o=>o.value===previous))chosen.value=previous;document.querySelector('#download').disabled=!chosen.value;}catch(e){current=null;document.querySelector('#summary').textContent=e.message;document.querySelector('#download').disabled=true;}}document.querySelector('#download').onclick=()=>{const result=record(data,weights,chosen.value);const a=document.createElement('a');const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}));a.href=url;a.download='decision-record.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};draw();</script></html>`;
}
