import { TIMING } from "./timing.mjs";
import { keyOf } from "./model.mjs";

const PARTS = {
  header: { part: "parse", shared: "one parse reads the header and the section table" },
  sections: { part: "parse", shared: "one parse reads the header and the section table" },
  decode: { part: "decode" },
  cfg: { part: "cfg" },
  prune: { part: "cfg", shared: "the graph build also finds the dead blocks" },
  lift: { part: "lift", shared: "one lift call also finds the types, the shape and the code" },
  refuse: { part: "lift", shared: "the time of the lift call that stops" },
  types: { part: "lift", shared: "one lift call also finds the types, the shape and the code" },
  structure: { part: "lift", shared: "one lift call also finds the types, the shape and the code" },
  emit: { part: "lift", shared: "one lift call also finds the types, the shape and the code" },
};

export function realOf(config, type) {
  const spec = PARTS[type];
  if (!spec) return null;
  const timing = TIMING.programs[keyOf(config)];
  const scope = config.symbols ? "named" : "stripped";
  const seconds = spec.part === "decode" || spec.part === "cfg" ? timing[spec.part][scope][config.sweep] : timing[spec.part];
  return { seconds, shared: spec.shared || null };
}

const group = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
function round2(n) {
  const scale = Math.pow(10, Math.max(0, Math.floor(Math.log10(n)) - 1));
  return Math.round(n / scale) * scale;
}
export function micro(seconds) {
  if (seconds >= 1e-3) return `${(seconds * 1e3).toPrecision(2)} ms`;
  return `${(seconds * 1e6).toPrecision(2)} µs`;
}

export function badgeOf(shownSeconds, real) {
  if (!real || !(shownSeconds > 0)) return null;
  const ratio = shownSeconds / real.seconds;
  if (Math.abs(ratio - 1) < 0.05) return null;
  const text = ratio > 1 ? `×1/${group(round2(ratio))}` : `×${group(round2(1 / ratio))}`;
  return { ratio, text, real: `${real.shared ? "≈ " : ""}${micro(real.seconds)} real` };
}

export const SOURCE = { machine: TIMING.machine, method: TIMING.method };
