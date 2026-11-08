export function parsePack(text: string) {
  if (Buffer.byteLength(text) > 1_048_576) throw Error("pack too large");
  const p = JSON.parse(text);
  if (
    p.schemaVersion !== 1 ||
    !Array.isArray(p.rows) ||
    !Array.isArray(p.redactions) ||
    !Number.isFinite(Date.parse(p.observedAt))
  )
    throw Error("invalid context pack");
  for (const r of p.rows) {
    if (
      !r.object?.uid ||
      typeof r.reason !== "string" ||
      typeof r.type !== "string" ||
      !Number.isInteger(r.count) ||
      r.count < 1 ||
      !Array.isArray(r.eventUIDs) ||
      !r.eventUIDs.length ||
      r.eventUIDs.some((x) => typeof x !== "string" || !x) ||
      !Number.isFinite(Date.parse(r.firstOccurrence)) ||
      !Number.isFinite(Date.parse(r.lastOccurrence)) ||
      Date.parse(r.firstOccurrence) > Date.parse(r.lastOccurrence)
    )
      throw Error("invalid timeline row");
  }
  return p;
}
const escape = (s: any) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function timeline(p: any) {
  const rows = p.rows
    .map(
      (r: any) =>
        `<tr data-type="${escape(r.type)}"><td>${escape(r.firstOccurrence)}<small>last ${escape(r.lastOccurrence)}</small></td><td>${escape(r.object.namespace)}/${escape(r.object.name)}<small>UID ${escape(r.object.uid)} / revision ${escape(r.revision ?? "unknown")}</small></td><td>${escape(r.reason)} (${r.count})<small>${escape(r.investigation)}</small></td><td>${r.eventUIDs.map(escape).join(", ")}</td></tr>`,
    )
    .join("");
  const payload = JSON.stringify(p).replaceAll("<", "\\u003c");
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kubernetes event storyboard</title><style>body{font:16px system-ui;background:#f4f7fc;color:#173047;max-width:1100px;margin:40px auto;padding:0 20px}small{display:block;margin-top:8px;color:#597086}td,th{padding:16px;border-bottom:1px solid #b7c7d5;text-align:left;vertical-align:top}table{width:100%;min-width:760px;border-collapse:collapse}.scroll{overflow:auto}button{padding:12px;margin:16px 0} @media(prefers-color-scheme:dark){body{background:#10212f;color:#e7f1fa}small{color:#aabfce}}</style><h1>Kubernetes event storyboard</h1><p>Observed ${escape(p.observedAt)}. Occurrence time is shown separately.</p><label><input id="warnings" type="checkbox"> Show Warning events only</label><div class="scroll"><table><thead><tr><th>Occurrence</th><th>Object identity</th><th>Evidence</th><th>Event UIDs</th></tr></thead><tbody>${rows}</tbody></table></div><button id="download">Download redacted context</button><p>${p.redactions.map(escape).join("; ")}. Event reasons suggest investigations, not proven causes.</p><script>const pack=${payload};document.querySelector('#warnings').onchange=e=>{for(const row of document.querySelectorAll('tbody tr'))row.hidden=e.target.checked&&row.dataset.type!=='Warning'};document.querySelector('#download').onclick=()=>{const a=document.createElement('a'),u=URL.createObjectURL(new Blob([JSON.stringify(pack,null,2)],{type:'application/json'}));a.href=u;a.download='context-pack.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};</script></html>`;
}
