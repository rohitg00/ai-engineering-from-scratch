export type Observation = {
  id: string;
  longitude: number;
  latitude: number;
  timestamp: string;
  note: string;
  photo?: string;
};
export type Groups = {
  radiusMeters: number;
  groups: { id: string; members: string[] }[];
  edges: { from: string; to: string; meters: number }[];
};

export function importObservations(value: unknown): Observation[] {
  const ids = new Set<string>();
  return array(value, "observations").map((x) => {
    if (!x || typeof x !== "object")
      throw Error("Observation must be an object");
    const id = nonempty(x.id, "id");
    if (ids.has(id)) throw Error("Duplicate observation id");
    ids.add(id);
    if (
      typeof x.longitude !== "number" ||
      !Number.isFinite(x.longitude) ||
      x.longitude < -180 ||
      x.longitude > 180 ||
      typeof x.latitude !== "number" ||
      !Number.isFinite(x.latitude) ||
      x.latitude < -90 ||
      x.latitude > 90
    )
      throw Error("Coordinates outside WGS84 bounds");
    const timestamp = nonempty(x.timestamp, "timestamp");
    if (
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(timestamp) ||
      !Number.isFinite(Date.parse(timestamp)) ||
      new Date(timestamp).toISOString().replace(".000Z", "Z") !==
        timestamp.replace(".000Z", "Z")
    )
      throw Error("Use a valid ISO UTC timestamp");
    const note = nonempty(x.note, "note");
    if (
      x.photo !== undefined &&
      (typeof x.photo !== "string" || !/^https?:\/\//.test(x.photo))
    )
      throw Error("Photo must be an HTTP(S) evidence link");
    return {
      id,
      longitude: x.longitude,
      latitude: x.latitude,
      timestamp,
      note,
      ...(x.photo ? { photo: x.photo } : {}),
    };
  });
}
export function distanceMeters(
  a: Pick<Observation, "latitude" | "longitude">,
  b: Pick<Observation, "latitude" | "longitude">,
): number {
  const rad = Math.PI / 180,
    p1 = a.latitude * rad,
    p2 = b.latitude * rad,
    dp = (b.latitude - a.latitude) * rad,
    dl = (b.longitude - a.longitude) * rad,
    h =
      Math.sin(dp / 2) ** 2 +
      Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return (
    6371008.8 *
    2 *
    Math.atan2(Math.sqrt(Math.min(1, h)), Math.sqrt(Math.max(0, 1 - h)))
  );
}
export function groupNearby(
  items: Observation[],
  radiusMeters: number,
): Groups {
  if (
    !Number.isFinite(radiusMeters) ||
    radiusMeters < 0 ||
    radiusMeters > 1000000
  )
    throw Error("Radius must be 0..1000000 meters");
  const parent = items.map((_, i) => i),
    root = (i: number): number =>
      parent[i] === i ? i : (parent[i] = root(parent[i]));
  const edges: Groups["edges"] = [];
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++) {
      const meters = distanceMeters(items[i], items[j]);
      if (meters <= radiusMeters) {
        parent[root(j)] = root(i);
        edges.push({ from: items[i].id, to: items[j].id, meters });
      }
    }
  const clusters = new Map<number, string[]>();
  items.forEach((x, i) => {
    const r = root(i);
    clusters.set(r, [...(clusters.get(r) ?? []), x.id]);
  });
  return {
    radiusMeters,
    groups: [...clusters.values()].map((members) => ({
      id: members[0],
      members,
    })),
    edges,
  };
}
export function reviewGroups(
  groups: Groups,
  value?: unknown,
): {
  schemaVersion: 1;
  groups: Groups["groups"];
  decisions: Record<string, string>;
} {
  const decisions: Record<string, string> = Object.create(null);
  if (value !== undefined) {
    const v = value as any;
    if (
      v?.schemaVersion !== 1 ||
      !v.decisions ||
      typeof v.decisions !== "object" ||
      Array.isArray(v.decisions) ||
      Object.keys(v.decisions).some(
        (id) => !groups.groups.some((g) => g.id === id),
      )
    )
      throw Error("Invalid group review");
    for (const [id, d] of Object.entries(v.decisions)) {
      if (!["pending", "keep-group", "keep-separate"].includes(d as string))
        throw Error("Invalid group decision");
      decisions[id] = d as string;
    }
  }
  for (const g of groups.groups) decisions[g.id] ??= "pending";
  const result = groups.groups.flatMap((g) =>
    decisions[g.id] === "keep-separate"
      ? g.members.map((id) => ({ id, members: [id] }))
      : [structuredClone(g)],
  );
  return { schemaVersion: 1, groups: result, decisions };
}
export function exportGeoJSON(
  items: Observation[],
  review: ReturnType<typeof reviewGroups>,
): { type: string; features: any[] } {
  return {
    type: "FeatureCollection",
    features: items.map((x) => ({
      type: "Feature",
      id: x.id,
      geometry: { type: "Point", coordinates: [x.longitude, x.latitude] },
      properties: {
        timestamp: x.timestamp,
        note: x.note,
        ...(x.photo ? { photo: x.photo } : {}),
        group: review.groups.find((g) => g.members.includes(x.id))?.id ?? x.id,
      },
    })),
  };
}
export function renderMap(
  items: Observation[],
  groups: Groups,
  review: ReturnType<typeof reviewGroups>,
): string {
  const origin = items[0]?.longitude ?? 0,
    unwrap = (lon: number) => origin + ((lon - origin + 540) % 360) - 180,
    lon = items.map((x) => unwrap(x.longitude)),
    lat = items.map((x) => x.latitude),
    minX = Math.min(...lon, origin),
    maxX = Math.max(...lon, origin),
    minY = Math.min(...lat, 0 === items.length ? 0 : lat[0]),
    maxY = Math.max(...lat, 0 === items.length ? 0 : lat[0]);
  const dot = items
    .map((x, i) => {
      const px = 30 + ((lon[i] - minX) / Math.max(maxX - minX, 0.0001)) * 740,
        py = 330 - ((x.latitude - minY) / Math.max(maxY - minY, 0.0001)) * 300;
      const nearRightEdge = px > 600;
      const labelX = nearRightEdge ? px - 10 : px + 10;
      const anchor = nearRightEdge ? "end" : "start";
      return `<g><circle cx="${px}" cy="${py}" r="7" fill="#cf812c"/><text x="${labelX}" y="${py - 10}" text-anchor="${anchor}" fill="currentColor">${escapeHTML(x.id)}</text></g>`;
    })
    .join("");
  return page(
    "Field Notes Map Builder",
    `<p>Local coordinate plot using WGS84 observations. Nearby groups use a ${groups.radiusMeters} m threshold and transitive connectivity. Grouping never deletes evidence.</p><svg role="img" aria-label="Observation coordinate map, longitude left to right and latitude bottom to top" viewBox="0 0 800 370"><rect width="800" height="370" fill="none" stroke="#81918a"/>${dot}</svg><p class="muted">Schematic coordinate map, no basemap or navigation precision. Longitudes unwrap around the first observation to show dateline neighbors together.</p><h2>Review nearby groups</h2>${groups.groups.map((g) => `<section><strong>${escapeHTML(g.id)}</strong><p>Members: ${escapeHTML(g.members.join(", "))}</p><label>Decision <select data-group="${escapeHTML(g.id)}"><option value="pending">Pending</option><option value="keep-group">Keep group</option><option value="keep-separate">Keep separate</option></select></label></section>`).join("")}<button id="review">Download group-review.json</button><h2>Original observations</h2><table><tr><th>ID</th><th>Coordinates (lon, lat)</th><th>Note</th><th>Observed at</th></tr>${items.map((x) => `<tr><td>${escapeHTML(x.id)}</td><td>${x.longitude}, ${x.latitude}</td><td>${escapeHTML(x.note)}${x.photo ? ` <a href="${escapeHTML(x.photo)}">Photo evidence</a>` : ""}</td><td>${escapeHTML(x.timestamp)}</td></tr>`).join("")}</table><h2>Distance evidence</h2><pre>${escapeHTML(
      JSON.stringify(
        groups.edges.map((x) => ({
          ...x,
          meters: Number(x.meters.toFixed(2)),
        })),
        null,
        2,
      ),
    )}</pre>`,
    `const decisions=${embedded(review.decisions)};document.querySelectorAll('[data-group]').forEach(s=>{s.value=decisions[s.dataset.group];s.onchange=()=>{decisions[s.dataset.group]=s.value}});document.querySelector('#review').onclick=()=>download('group-review.json',{schemaVersion:1,decisions});`,
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
