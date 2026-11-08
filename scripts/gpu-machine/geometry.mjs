import { frameOf, tools } from "./parts.mjs";

const COLS = 8;
const ROWS = 6;

function rigBase(name, bounds) {
  const { P, V } = frameOf(bounds);
  const T = tools(P, V);
  const items = [];
  const put = (id, asm, ref, svg, bias = 0) => items.push({ id, asm, key: T.depth(ref) + bias, svg });
  return { name, P, V, T, items, put };
}

function cellGrid(T, chip, x0, y0, x1, y1, z) {
  const out = [];
  const gx = (x1 - x0 - 1.2) / COLS;
  const gy = (y1 - y0 - 1.2) / ROWS;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cx = x0 + 0.6 + c * gx;
      const cy = y0 + 0.6 + r * gy;
      out.push(`<path class="cell" data-cell="${chip}:${r * COLS + c}" d="${T.quad(cx + 0.18, cy + 0.18, cx + gx - 0.18, cy + gy - 0.18, z)}"/>`);
    }
  }
  return out.join("");
}

function lampAt(rig, station, asm, [x, y, z], r = 1.6) {
  const { T, put } = rig;
  const svg = T.post(x, y, r + 0.5, z, z + 0.6, { tone: "lo" }, 18) + T.post(x, y, r, z + 0.6, z + 1.8, { material: "lamp", tone: "hi" }, 18);
  put(`lamp-${station}`, asm, [x, y, z + 1], `<g data-live="lamp-${station}">${svg}</g>`, 6);
}

function plateWithFeet(rig, x0, y0, x1, y1, material = "pcb") {
  const { T, put } = rig;
  const out = [T.shadow(x0, y0, -7, x1, y1, 0, -7)];
  const feet = [[x0 + 8, y0 + 8], [x1 - 8, y0 + 8], [x0 + 8, y1 - 8], [x1 - 8, y1 - 8]].sort((a, b) => T.depth([a[0], a[1], 0]) - T.depth([b[0], b[1], 0]));
  for (const [x, y] of feet) out.push(T.post(x, y, 3.2, -7, -1.6, { material: "steel", tone: "lo" }, 20));
  out.push(T.box(x0, y0, -1.6, x1, y1, 0, { material, tone: "mid" }, { r: 3, steps: 4 }));
  out.push(T.sil(x0, y0, -1.6, x1, y1, 0));
  out.push(T.dots([[x0 + 8, y0 + 8, 0], [x1 - 8, y0 + 8, 0], [x0 + 8, y1 - 8, 0], [x1 - 8, y1 - 8, 0]], 1.1, "hi"));
  put("plate", "base", [0, 0, -100], out.join(""), -1000);
}

function portAt(rig, x0, y0, x1, y1) {
  const { T, put } = rig;
  const h = 13;
  const out = [T.box(x0, y0, 0, x1, y1, h, { material: "steel", tone: "lo" }, { r: 0.6 })];
  const w = (x1 - x0 - 3) / 2;
  for (let i = 0; i < 2; i++) {
    const a = x0 + 1 + i * (w + 1);
    out.push(T.box(a, y1, 2, a + w, y1 + 0.3, h - 2.6, { material: "pkg", tone: "lo" }, { r: 0, steps: 1 }));
    out.push(T.box(a + w * 0.3, y1 + 0.3, h - 4.4, a + w * 0.7, y1 + 0.5, h - 2.6, { material: "gold", tone: "hi" }, { r: 0, steps: 1 }));
  }
  out.push(T.sil(x0, y0, 0, x1, y1, h));
  put("port", "ingress", [(x0 + x1) / 2, (y0 + y1) / 2, h / 2], out.join(""), 2);
  return [(x0 + x1) / 2, (y0 + y1) / 2, h + 1.2];
}

function boardDisplay(rig, x0, y0, x1, y1) {
  const { T, put } = rig;
  const h = 3;
  const lines = [0, 1, 2].map((i) => `<text class="lcd" data-live="lcd${i}" transform="${T.k.topMatrix([x0 + 2.5, y0 + 4.6 + i * 4.6], h + 0.5, T.P, "x")}" font-size="3.4"></text>`).join("");
  const svg = T.box(x0, y0, 0, x1, y1, h, { material: "pkg", tone: "mid" }, { r: 0.8 }) + T.box(x0 + 1.2, y0 + 1.2, h, x1 - 1.2, y1 - 1.2, h + 0.5, { material: "screen", tone: "lo" }, { r: 0, steps: 1 }) + lines + T.sil(x0, y0, 0, x1, y1, h + 0.5);
  put("display", "base", [(x0 + x1) / 2, (y0 + y1) / 2, h], svg, 2);
}

function flowLayer(rig, count) {
  const { T, put } = rig;
  const parts = [];
  for (let i = 0; i < count; i++) parts.push(`<g data-pk="${i}" style="display:none">${T.box(-0.9, -0.9, -0.5, 0.9, 0.9, 0.5, { material: "ride", tone: "hi" }, { r: 0, steps: 1 })}</g>`);
  put("flow", "flow", [0, 0, 18], `<g data-live="flow">${parts.join("")}</g>`, 400);
}

function launchLayer(rig, count) {
  const { T, put } = rig;
  const parts = [];
  for (let i = 0; i < count; i++) parts.push(`<g data-lp="${i}" style="display:none">${T.box(-0.7, -0.7, -0.3, 0.7, 0.7, 0.5, { material: "ride", tone: "hi" }, { r: 0, steps: 1 })}</g>`);
  put("launch", "flow", [0, 0, 6], `<g data-live="launch">${parts.join("")}</g>`, 380);
}

function requestCard(rig, home, size) {
  const { T, put } = rig;
  const [x, y, z] = home;
  const [w, d, h] = size;
  const svg = T.box(x - w / 2, y - d / 2, z, x + w / 2, y + d / 2, z + h, { material: "ride", tone: "mid" }, { r: 0.5, bevel: 0.2 }) + T.sil(x - w / 2, y - d / 2, z, x + w / 2, y + d / 2, z + h);
  put("req", "req", [x, y, z + h], `<g data-live="req">${svg}</g>`, 420);
}

function queueCards(rig, [x, y, z], slots, size) {
  const { T, put } = rig;
  const [w, d, h] = size;
  const out = [];
  for (let i = 0; i < slots; i++) {
    const cz = z + i * (h + 0.4);
    out.push(`<g data-q="${i}" style="display:none">${T.box(x - w / 2, y - d / 2, cz, x + w / 2, y + d / 2, cz + h, { material: "ride", tone: "hi" }, { r: 0.4 })}</g>`);
  }
  put("queue", "queue", [x, y, z + 2], `<g data-live="queue">${out.join("")}</g>`, 30);
}

const CPU_L4 = [56, -104];

function buildL4() {
  const bounds = [[-70, -150, -7], [124, -150, -7], [-82, -46, -7], [90, 40, -7], [-82, 34, 0], [124, -46, 13], [-80, -56, 64], [88, -56, 64], [-70, -150, 30], [124, -150, 30]];
  const rig = rigBase("l4", bounds);
  const { T, put } = rig;
  plateWithFeet(rig, -70, -150, 124, -46);

  const portTop = portAt(rig, 104, -96, 124, -76);

  const [cx, cy] = CPU_L4;
  const cpu = [];
  cpu.push(T.box(cx - 26, cy - 26, 0, cx + 26, cy + 26, 2, { material: "steel", tone: "lo" }, { r: 1.2 }));
  cpu.push(T.box(cx - 20, cy - 20, 2, cx + 20, cy + 20, 3.4, { material: "sub", tone: "mid" }, { r: 0.8 }));
  cpu.push(T.sil(cx - 26, cy - 26, 0, cx + 26, cy + 26, 2));
  put("socket", "cpu", [cx, cy, 1.5], cpu.join(""), 0);
  const die = T.box(cx - 10, cy - 10, 3.4, cx + 10, cy + 10, 4.2, { material: "si", tone: "mid" }, { r: 0.3, steps: 1 })
    + `<path class="core" data-core="tok" d="${T.quad(cx - 9, cy - 9, cx - 1.4, cy - 1, 4.2)}"/><path class="core" data-core="sched" d="${T.quad(cx - 0.4, cy - 9, cx + 9, cy - 1, 4.2)}"/><path class="core" data-core="detok" d="${T.quad(cx - 9, cy, cx + 9, cy + 9, 4.2)}"/>`;
  put("hostdie", "hostdie", [cx, cy, 3.8], die, 1);
  const ihs = T.box(cx - 16, cy - 16, 3.4, cx + 16, cy + 16, 5.2, { material: "steel", tone: "lo" }, { r: 1.4 }) + T.box(cx - 12, cy - 12, 5.2, cx + 12, cy + 12, 7.4, { material: "steel", tone: "mid" }, { r: 1, bevel: 0.3 }) + T.sil(cx - 16, cy - 16, 3.4, cx + 16, cy + 16, 7.4) + T.text(cx, cy + 2, 7.4, "HOST CPU", 2.6);
  put("ihs", "ihs", [cx, cy, 6], ihs, 3);

  const lanes = [];
  for (let i = 0; i < 16; i++) {
    const a = cx - 22 + i * 1.25;
    const b = -40 + i * 2.6;
    lanes.push(T.k.onTop([[a, cy + 26], [a, cy + 34], [b, -58], [b, -50]], 0, T.P));
  }
  put("lanes", "link", [-10, -66, 0.1], T.Ln(lanes.join(""), { tone: "mid", className: "lane" }), -20);
  const riser = T.box(-66, -50, 0, 39, -47, 24, { material: "pcb", tone: "mid" }, { r: 0.4 }) + T.box(-62, -47, 8, 35, -39, 18, { material: "pkg", tone: "mid" }, { r: 0.6 }) + T.sil(-66, -50, 0, 39, -39, 24) + T.text(-14, -43, 18, "PCIe Gen4 x16", 2.4);
  put("riser", "link", [-14, -44, 12], riser, 4);

  const card = [];
  card.push(T.box(-80, -36, 12, 88.5, 32.9, 13.6, { material: "pcb", tone: "mid" }, { r: 1.5, steps: 3 }));
  card.push(T.box(-58, -43, 12, 31, -36, 13.6, { material: "pcb", tone: "mid" }, { r: 0, steps: 1 }));
  card.push(T.box(-57, -42.4, 13.6, 30, -36.4, 13.75, { material: "gold", tone: "hi" }, { r: 0, steps: 1 }));
  const fingers = [];
  for (let i = 1; i < 18; i++) fingers.push(T.k.lineOnTop([-57 + i * 4.9, -42.4], [-57 + i * 4.9, -36.4], 13.75, T.P));
  card.push(T.Ln(fingers.join(""), { tone: "mid" }));
  const traces = [];
  for (const cy of [-20, -4, 12]) {
    for (let j = 0; j < 4; j++) {
      const yy = cy - 3 + j * 2;
      traces.push(T.k.onTop([[-28, yy], [-22, yy], [-17, yy * 0.6 - 1]], 13.6, T.P));
      traces.push(T.k.onTop([[38, yy], [33, yy], [29, yy * 0.6 - 1]], 13.6, T.P));
    }
  }
  card.push(T.Ln(traces.join(""), { tone: "faint" }));
  card.push(T.sil(-80, -43, 12, 88.5, 32.9, 13.6));
  put("card", "card", [0, 0, 12.5], card.join(""), -300);

  const vrm = [];
  for (const cy of [-24, -10, 4, 18]) vrm.push(T.box(-75, cy - 4, 13.6, -66, cy + 4, 18.5, { material: "pkg", tone: "mid" }, { r: 0.8 }));
  for (const cy of [-28, -16, -4, 8, 20]) vrm.push(T.post(-60, cy, 1.6, 13.6, 17, { material: "steel", tone: "lo" }, 14));
  put("vrm", "card", [-68, 0, 15], vrm.join(""), 2);
  put("bracket", "card", [89, 0, 18], T.box(88.5, -40, 4, 89.7, 38, 32, { material: "steel", tone: "lo" }, { r: 0.2, steps: 1 }) + T.sil(88.5, -40, 4, 89.7, 38, 32), 2);

  const balls = [];
  for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) balls.push([-14 + 1.8 + i * 3.4, -22 + 1.8 + j * 3.4, 13.9]);
  put("balls", "balls", [6, -2, 13.9], `<g class="balls">${T.dots(balls, 0.95, "hi")}</g>`, 1);
  const sub = T.box(-16, -24, 14.2, 28, 20, 15.6, { material: "sub", tone: "mid" }, { r: 0.8 }) + T.sil(-16, -24, 14.2, 28, 20, 15.6);
  put("substrate", "gpu", [6, -2, 15], sub, 3);
  const bumps = [];
  for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) bumps.push([-6.5 + i * 3.1, -14.5 + j * 3.1, 15.7]);
  put("bumps", "bumps", [6, -2, 15.7], `<g class="balls">${T.dots(bumps, 0.6, "hi")}</g>`, 4);

  const dieTop = 16.4;
  const dieSvg = [T.box(-8, -16, 15.6, 20, 12, dieTop, { material: "si", tone: "mid" }, { r: 0.2, steps: 1 })];
  const mc = [];
  [[-7.6, -6.6], [18.6, 19.6]].forEach(([a, b], side) => [[-14.6, -7.8], [-6.4, 0.4], [1.8, 10.6]].forEach(([c, d], j) => mc.push(`<path class="mc" data-mc="${side * 3 + j}" d="${T.quad(a, c, b, d, dieTop)}"/>`)));
  dieSvg.push(mc.join(""));
  dieSvg.push(`<path class="l2" d="${T.quad(-5.8, -3.4, 17.8, -0.6, dieTop)}"/>`);
  const gpcs = [[-5.8, -15, 1.6, -4.2], [2.0, -15, 9.4, -4.2], [9.8, -15, 17.2, -4.2], [-5.8, 0.4, 1.6, 11.2], [2.0, 0.4, 9.4, 11.2]];
  const sms = [];
  let sm = 0;
  gpcs.forEach(([x0, y0, x1, y1], g) => {
    const tw = (x1 - x0) / 3;
    const th = (y1 - y0) / 4;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 3; c++) {
        const off = g === 4 && r === 3 && c < 2;
        sms.push(`<path class="sm"${off ? " data-off" : ` data-sm="${sm++}"`} d="${T.quad(x0 + c * tw + 0.15, y0 + r * th + 0.15, x0 + (c + 1) * tw - 0.15, y0 + (r + 1) * th - 0.15, dieTop)}"/>`);
      }
    }
  });
  dieSvg.push(sms.join(""));
  dieSvg.push(`<path class="io" d="${T.quad(9.8, 0.4, 17.8, 11.2, dieTop)}"/>`);
  dieSvg.push(T.text(13.8, 6.6, dieTop, "PCIe", 1.7));
  dieSvg.push(T.sil(-8, -16, 15.6, 20, 12, dieTop));
  put("die", "die", [6, -2, 16], dieSvg.join(""), 6);
  rig.SM_COUNT = sm;

  const chips = [];
  const chipCenters = [];
  for (const [x0, x1] of [[-42, -28], [38, 52]]) for (const cy of [-20, -4, 12]) chipCenters.push([x0, cy - 6, x1, cy + 6]);
  chipCenters.forEach(([x0, y0, x1, y1], i) => {
    const pads = [];
    for (let a = 0; a < 6; a++) for (let b = 0; b < 5; b++) pads.push([x0 + 1.6 + a * 2.15, y0 + 1.6 + b * 2.15, 13.7]);
    put(`chip-balls${i}`, "membase", [(x0 + x1) / 2, (y0 + y1) / 2, 13.7], `<g class="balls">${T.dots(pads, 0.55, "hi")}</g>`, 1);
    const svg = T.box(x0, y0, 13.9, x1, y1, 15.1, { material: "pkg", tone: "mid" }, { r: 0.4 }) + `<g data-chip="${i}">${cellGrid(T, i, x0, y0, x1, y1, 15.1)}</g>` + T.sil(x0, y0, 13.9, x1, y1, 15.1);
    put(`chip${i}`, "mem", [(x0 + x1) / 2, (y0 + y1) / 2, 14.5], svg, 3);
    chips.push([x0, y0, x1, y1]);
  });

  const cooler = T.box(-17, -25, 16.4, 29, 21, 19, { material: "copper", tone: "mid", className: "cu" }, { r: 0.6 }) + T.glass(-79, -35, 13.6, 87.5, 32, 30) + T.sil(-79, -35, 13.6, 87.5, 32, 30);
  put("cooler", "cooler", [4, 0, 30], `<g class="cooler">${cooler}</g>`, 500);

  const shadows = [T.shadow(cx - 26, cy - 26, 0, cx + 26, cy + 26, 7.4), T.shadow(-66, -50, 0, 39, -39, 24), T.shadow(104, -96, 0, 124, -76, 13)];
  put("shadows", "base", [0, 0, -90], shadows.join(""), -900);
  put("card-shadow", "card", [0, -20, 0.2], T.shadow(-80, -43, 12, 88.5, 32.9, 13.6, 0) + T.shadow(88.5, -40, 4, 89.7, 38, 32, 0), -800);

  lampAt(rig, "ingress", "ingress", [107, -79, 13]);
  lampAt(rig, "tokenizer", "cpu", [cx + 23, cy - 12, 2], 1.4);
  lampAt(rig, "scheduler", "cpu", [cx + 23, cy - 6, 2], 1.4);
  lampAt(rig, "detok", "cpu", [cx + 23, cy, 2], 1.4);
  lampAt(rig, "link", "link", [33, -48.5, 24], 1.4);
  lampAt(rig, "sms", "gpu", [25, 17, 15.6], 1.4);
  lampAt(rig, "weights", "mem", [-30, -24, 15.1], 1.1);
  lampAt(rig, "pool", "mem", [50, -24, 15.1], 1.1);

  requestCard(rig, [0, 0, 0], [5, 3.4, 1.6]);
  queueCards(rig, [-46, -100, 0], 8, [7, 4.6, 1.4]);
  boardDisplay(rig, -66, -146, -14, -130);
  flowLayer(rig, 24);
  launchLayer(rig, 10);

  const waypoints = {
    port: portTop,
    tokenizer: [cx - 6, cy - 6, 7.6],
    scheduler: [cx + 6, cy - 6, 7.6],
    detok: [cx, cy + 7, 7.6],
    queue: [-46, -88, 0.2],
    riser: [-14, -43, 18.2],
    fingers: [-14, -38, 13.8],
    io: [13.8, 6, dieTop + 0.2],
    die: [6, -8, dieTop + 0.2],
  };
  const l2 = [6, -2, dieTop + 0.6];
  const flows = chips.map(([x0, y0, x1, y1], i) => {
    const cy = (y0 + y1) / 2;
    const left = i < 3;
    const edge = left ? x1 : x0;
    const subEdge = left ? -16 : 28;
    const mcx = left ? -7.1 : 19.1;
    const mcy = [-11.2, -3, 6.2][i % 3];
    return [[(x0 + x1) / 2, cy, 15.6], [edge, cy, 14.4], [subEdge, cy * 0.6 - 1, 15.9], [mcx, mcy, dieTop + 0.6], l2, [6, mcy < 0 ? -9 : 5, dieTop + 0.6]];
  });
  const launch = [[cx, cy, 7.6], [cx - 12, cy + 26, 0.6], [cx - 12, cy + 34, 0.6], [-20, -58, 0.6], [-20, -50, 0.6], [-14, -43, 18.2], [-14, -38, 13.8], [13.8, 6, dieTop + 0.2]];

  rig.EXPLODE = { base: [0, 0, 0], ingress: [0, 0, 0], cpu: [0, 0, 0], hostdie: [0, 0, 6], ihs: [0, -8, 26], link: [0, 0, 0], card: [0, 0, 0], balls: [0, -6, 10], gpu: [0, -10, 16], bumps: [0, -13, 22], die: [0, -16, 28], membase: [0, 0, 0], mem: [0, -6, 12], cooler: [0, -20, 34], req: [0, 0, 0], queue: [0, 0, 0], flow: [0, 0, 0] };
  rig.WAYPOINTS = waypoints;
  rig.FLOWS = flows;
  rig.LAUNCH = launch;
  rig.CHIPS = chips.length;
  rig.HOT = {
    ingress: ["port"],
    tokenizer: ["ihs", "hostdie"],
    scheduler: ["ihs", "hostdie"],
    detok: ["ihs", "hostdie"],
    link: ["riser", "lanes"],
    sms: ["die"],
    l2: ["die"],
    weights: ["die"],
    pool: [],
  };
  rig.LABELS = [
    { id: "ingress", text: "PROMPT IN", stations: ["ingress"], asm: "ingress", at: [124, -86, 7] },
    { id: "tokenizer", text: "TOKENIZER", stations: ["tokenizer"], asm: "ihs", at: [cx - 6, cy - 6, 7.4] },
    { id: "scheduler", text: "SCHEDULER", stations: ["scheduler"], asm: "ihs", at: [cx + 6, cy - 6, 7.4] },
    { id: "detok", text: "DETOKENIZER", stations: ["detok"], asm: "ihs", at: [cx, cy + 7, 7.4] },
    { id: "link", text: "PCIE GEN4 X16", stations: ["link"], asm: "link", at: [30, -47, 24] },
    { id: "sms", text: "58 SMs · TENSOR CORES", stations: ["sms"], asm: "die", at: [-2, -10, dieTop] },
    { id: "l2", text: "L2 · 48 MB", stations: ["weights"], asm: "die", at: [16, -2, dieTop] },
    { id: "weights", text: "WEIGHTS", stations: ["weights"], asm: "mem", at: [-35, -4, 15.1] },
    { id: "pool", text: "KV POOL", stations: ["pool"], asm: "mem", at: [45, 12, 15.1] },
    { id: "mem", text: "GDDR6 · 300 GB/s", stations: [], asm: "mem", at: [45, -20, 15.1] },
  ];
  return rig;
}

function buildGB10() {
  const bounds = [[-125, -100, -7], [115, -100, -7], [-125, 82, -7], [115, 82, -7], [-66, -76, 64], [66, -76, 64], [-125, -100, 30], [115, -100, 30]];
  const rig = rigBase("gb10", bounds);
  const { T, put } = rig;
  plateWithFeet(rig, -125, -100, 115, 82);
  const portTop = portAt(rig, -118, 52, -96, 68);

  const balls = [];
  for (let i = 0; i < 22; i++) for (let j = 0; j < 15; j++) balls.push([-56 + 2.5 + i * 5.1, -44 + 2.5 + j * 5.1, 0.4]);
  put("balls", "balls", [0, -6, 0.4], `<g class="balls">${T.dots(balls, 1.1, "hi")}</g>`, 1);
  put("substrate", "gpu", [0, -6, 2], T.box(-58, -44, 0.8, 58, 32, 3.0, { material: "sub", tone: "mid" }, { r: 1.2 }) + T.sil(-58, -44, 0.8, 58, 32, 3.0), 3);

  const top = 3.9;
  const sdie = [T.box(-52, -38, 3.0, -6, 26, top, { material: "si", tone: "mid" }, { r: 0.3, steps: 1 })];
  const mcs = [];
  for (let i = 0; i < 8; i++) mcs.push(`<path class="mc" data-mc="${i}" d="${T.quad(-51.4, -36.5 + i * 7.6, -49.6, -36.5 + i * 7.6 + 6.6, top)}"/>`);
  sdie.push(mcs.join(""));
  const cores = [];
  for (const [cluster, y0] of [["a", -36], ["b", 10]]) {
    for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) {
      const x0 = -47.5 + c * 5;
      const yy = y0 + r * 7;
      cores.push(`<path class="core" data-core="${cluster}${r * 5 + c}" d="${T.quad(x0, yy, x0 + 4.4, yy + 6.2, top)}"/>`);
    }
  }
  sdie.push(cores.join(""));
  sdie.push(`<path class="l2" d="${T.quad(-47.5, -21.4, -23.1, -18.6, top)}"/><path class="l2" d="${T.quad(-47.5, 24.4 - 30.4, -23.1, 24.4 - 27.6, top)}"/>`);
  sdie.push(`<path class="l2" data-slc d="${T.quad(-21.4, -36, -8.6, 24, top)}"/>`);
  sdie.push(T.text(-15, -6, top, "SLC 16 MB", 2.2));
  sdie.push(T.sil(-52, -38, 3.0, -6, 26, top));
  put("sdie", "die", [-29, -6, 3.5], sdie.join(""), 6);

  const c2c = [];
  for (let i = 0; i < 10; i++) c2c.push(T.k.lineOnTop([-6.2, -22 + i * 3.4], [6.2, -22 + i * 3.4], 3.05, T.P));
  put("c2c", "link", [0, -6, 3.1], `<path class="c2cpad" d="${T.quad(-8.6, -24, -6.4, 12, top)}"/><path class="c2cpad" d="${T.quad(6.4, -24, 8.6, 12, top)}"/>` + T.Ln(c2c.join(""), { tone: "hi", className: "lane" }), 7);

  const gdie = [T.box(6, -38, 3.0, 52, 26, top, { material: "si", tone: "mid" }, { r: 0.3, steps: 1 })];
  gdie.push(`<path class="l2" d="${T.quad(10, -8.6, 50, -3.4, top)}"/>`);
  const sms = [];
  let sm = 0;
  for (const [y0, y1] of [[-36, -10.4], [-1.6, 24]]) {
    const rows = 3;
    const cols = 6;
    const tw = 40 / cols;
    const th = (y1 - y0) / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) sms.push(`<path class="sm" data-sm="${sm++}" d="${T.quad(10 + c * tw + 0.3, y0 + r * th + 0.3, 10 + (c + 1) * tw - 0.3, y0 + (r + 1) * th - 0.3, top)}"/>`);
  }
  gdie.push(sms.join(""));
  gdie.push(T.sil(6, -38, 3.0, 52, 26, top));
  put("gdie", "die", [29, -6, 3.5], gdie.join(""), 6);
  rig.SM_COUNT = sm;

  const chips = [];
  const xs = [-80, -27, 27, 80];
  for (const [y0, y1] of [[-90, -70], [40, 60]]) for (const cx of xs) chips.push([cx - 12, y0, cx + 12, y1]);
  const traces = [];
  chips.forEach(([x0, y0, x1, y1], i) => {
    const back = y1 < 0;
    const cx = (x0 + x1) / 2;
    for (let j = 0; j < 4; j++) {
      const xx = cx - 6 + j * 4;
      const tx = -52 + (i % 4) * 4 + j;
      traces.push(T.k.onTop(back ? [[xx, y1], [xx, -60], [tx, -50], [tx, -44]] : [[xx, y0], [xx, 40], [tx, 36], [tx, 32]], 0, T.P));
    }
    const pads = [];
    for (let a = 0; a < 7; a++) for (let b = 0; b < 6; b++) pads.push([x0 + 2 + a * 3.3, y0 + 1.8 + b * 3.3, 0.1]);
    put(`chip-balls${i}`, "membase", [cx, (y0 + y1) / 2, 0.1], `<g class="balls">${T.dots(pads, 0.65, "hi")}</g>`, 1);
    put(`chip${i}`, "mem", [cx, (y0 + y1) / 2, 0.7], T.box(x0, y0, 0.2, x1, y1, 1.6, { material: "pkg", tone: "mid" }, { r: 0.5 }) + `<g data-chip="${i}">${cellGrid(T, i, x0, y0, x1, y1, 1.6)}</g>` + T.sil(x0, y0, 0.2, x1, y1, 1.6), 3);
  });
  put("traces", "base", [0, 0, 0.05], T.Ln(traces.join(""), { tone: "faint" }), -400);

  const cooler = T.box(-60, -46, top, 60, 34, 7, { material: "copper", tone: "mid", className: "cu" }, { r: 1 }) + T.glass(-66, -52, 7, 66, 40, 28) + T.sil(-66, -52, top, 66, 40, 28);
  put("cooler", "cooler", [0, -6, 28], `<g class="cooler">${cooler}</g>`, 500);
  put("shadows", "base", [0, 0, -90], [T.shadow(-58, -44, 0, 58, 32, 3), T.shadow(-118, 52, 0, -96, 68, 13)].join(""), -900);

  lampAt(rig, "ingress", "ingress", [-99, 55, 13]);
  lampAt(rig, "tokenizer", "gpu", [-55, -41, 3.0], 1.3);
  lampAt(rig, "scheduler", "gpu", [-55, 29, 3.0], 1.3);
  lampAt(rig, "detok", "gpu", [-49, 29, 3.0], 1.3);
  lampAt(rig, "link", "gpu", [0, 29, 3.0], 1.3);
  lampAt(rig, "sms", "gpu", [55, 29, 3.0], 1.3);
  lampAt(rig, "weights", "mem", [-70, -87, 1.6], 1.2);
  lampAt(rig, "pool", "mem", [90, 57, 1.6], 1.2);

  requestCard(rig, [0, 0, 0], [6.4, 4.4, 2]);
  queueCards(rig, [-106, -80, 0], 8, [10, 6.4, 1.8]);
  boardDisplay(rig, 30, 64, 100, 80);
  flowLayer(rig, 32);
  launchLayer(rig, 10);

  const waypoints = {
    port: portTop,
    tokenizer: [-45, -33, top + 0.2],
    scheduler: [-40, 13, top + 0.2],
    detok: [-30, -26, top + 0.2],
    queue: [-106, -68, 0.2],
    riser: [-4, -6, top + 0.2],
    fingers: [4, -6, top + 0.2],
    io: [14, -6, top + 0.2],
    die: [30, -6, top + 0.2],
  };
  const flows = chips.map(([x0, y0, x1, y1], i) => {
    const back = y1 < 0;
    const cx = (x0 + x1) / 2;
    const tx = -50 + (i % 4) * 4;
    const mcy = -33 + (i % 4) * 7.6 + (back ? 0 : 30.4);
    return [[cx, (y0 + y1) / 2, 2.4], [cx, back ? -60 : 40, 0.8], [tx, back ? -44 : 32, 3.4], [-50.5, mcy, top + 0.6], [-15, -6, top + 0.6], [0, -6, top + 0.6], [30, -6, top + 0.6], [30, mcy < -6 ? -22 : 10, top + 0.6]];
  });
  const launch = [[-40, 13, top + 0.2], [-15, -6, top + 0.6], [0, -6, top + 0.6], [30, -6, top + 0.6]];

  rig.EXPLODE = { base: [0, 0, 0], ingress: [0, 0, 0], balls: [0, -8, 10], gpu: [0, -14, 20], die: [0, -22, 32], link: [0, -22, 32], membase: [0, 0, 0], mem: [0, -6, 10], cooler: [0, -24, 36], req: [0, 0, 0], queue: [0, 0, 0], flow: [0, 0, 0] };
  rig.WAYPOINTS = waypoints;
  rig.FLOWS = flows;
  rig.LAUNCH = launch;
  rig.CHIPS = chips.length;
  rig.HOT = {
    ingress: ["port"],
    tokenizer: ["sdie"],
    scheduler: ["sdie"],
    detok: ["sdie"],
    link: ["c2c"],
    sms: ["gdie"],
    l2: ["gdie"],
    weights: ["gdie", "c2c"],
    pool: [],
  };
  rig.LABELS = [
    { id: "ingress", text: "PROMPT IN", stations: ["ingress"], asm: "ingress", at: [-107, 68, 7] },
    { id: "tokenizer", text: "TOKENIZER", stations: ["tokenizer"], asm: "die", at: [-45, -33, top] },
    { id: "scheduler", text: "SCHEDULER", stations: ["scheduler"], asm: "die", at: [-40, 13, top] },
    { id: "detok", text: "DETOKENIZER", stations: ["detok"], asm: "die", at: [-30, -26, top] },
    { id: "link", text: "NVLINK-C2C", stations: ["link"], asm: "link", at: [0, -14, 3.1] },
    { id: "sms", text: "SM FIELD · TENSOR CORES", stations: ["sms"], asm: "die", at: [40, -30, top] },
    { id: "l2", text: "L2 · 24 MB", stations: ["weights"], asm: "die", at: [44, -6, top] },
    { id: "weights", text: "WEIGHTS", stations: ["weights"], asm: "mem", at: [-27, -80, 1.6] },
    { id: "pool", text: "KV POOL", stations: ["pool"], asm: "mem", at: [80, 50, 1.6] },
    { id: "mem", text: "LPDDR5X · 273 GB/s", stations: [], asm: "mem", at: [80, -80, 1.6] },
  ];
  return rig;
}

export function build() {
  const rigs = { l4: buildL4(), gb10: buildGB10() };
  for (const rig of Object.values(rigs)) rig.ASSEMBLIES = Object.keys(rig.EXPLODE);
  return rigs;
}
