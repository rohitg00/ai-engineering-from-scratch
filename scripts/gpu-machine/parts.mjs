import * as k from "../agent-machine/kit/iso-kit.mjs";
import * as ink from "../agent-machine/kit/ink.mjs";

export const W = 1000;
export const H = 430;
export const AZIMUTH = 60;

export function frameOf(points, { pad = 8, headroom = 0, side = 150 } = {}) {
  const P = k.fitProjection(points, W - side * 2, H, { pad, headroom, azimuth: AZIMUTH });
  P.origin = [P.origin[0] + side, P.origin[1]];
  const V = [k.depthOf([1, 0, 0], P), k.depthOf([0, 1, 0], P), k.depthOf([0, 0, 1], P)];
  return { P, V };
}

export function tools(P, V) {
  const at = (p) => k.iso(p, P);
  const depth = (p) => p[0] * V[0] + p[1] * V[1] + p[2] * V[2];
  const S = (paths, style = {}) => ink.inkSolid(paths, style);
  const Ln = (d, style) => k.lineSvg(d, style);
  const plan = (x0, y0, x1, y1, r = 0.6) => ({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r });
  const box = (x0, y0, z0, x1, y1, z1, style = {}, { r = 0.5, steps = 2, bevel = 0, inner = "" } = {}) =>
    S(k.slabOf(plan(x0, y0, x1, y1, Math.min(r, (x1 - x0) / 2.2, (y1 - y0) / 2.2)), z0, z1 - z0, P, r ? steps : 1, bevel), { tone: "mid", ...style, inner });
  const post = (x, y, r, z0, z1, style = {}, steps = 20) => S(k.cylinder(x, y, r, z0, z1 - z0, P, steps), { tone: "mid", ...style });
  const quad = (x0, y0, x1, y1, z) => k.onTop([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], z, P, true);
  const corners3 = (x0, y0, z0, x1, y1, z1) => [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
  const sil = (x0, y0, z0, x1, y1, z1) => ink.silhouetteSvg(corners3(x0, y0, z0, x1, y1, z1), P);
  const shadow = (x0, y0, z0, x1, y1, z1, floor = 0) => ink.castShadowSvg(corners3(x0, y0, z0, x1, y1, z1), P, floor);
  const glass = (x0, y0, z0, x1, y1, z1) => ink.glassSvg(x0, y0, z0, x1, y1, z1, P);
  const dots = (points, size = 0.5, tone = "mid") => k.dotsSvg(points.map(at), { size, tone });
  const text = (x, y, z, words, size = 2.4, anchor = "middle", tone = "hi") => k.faceTextSvg(k.topMatrix([x, y], z, P, "x"), words, { size, tone, anchor });
  return { P, V, depth, Ln, box, post, quad, sil, shadow, glass, dots, text, k };
}

export const pillSvg = ink.pillSvg;
