const EXPORT = { busy: false, cancel: false };
const exportStatus = $("[data-am-export-status]");

function configLabel(config) {
  const broken = [];
  if (!config.retrieval) broken.push("retrieval off");
  if (!config.tools) broken.push("tool access off");
  if (!config.verification) broken.push("verification off");
  if (config.fault === "timeout-once") broken.push("tool times out once");
  if (config.fault === "timeout-always") broken.push("tool always times out");
  if (config.fault === "malformed") broken.push("malformed tool call");
  return broken.length ? "Broken: " + broken.join(" · ") : "Healthy run";
}

function svgStyle() {
  const host = svg.closest(".am-figure");
  const computed = getComputedStyle(host);
  const vars = [];
  for (let i = 0; i < computed.length; i++) {
    const name = computed[i];
    if (name.startsWith("--anatomy-")) vars.push(`${name}:${computed.getPropertyValue(name)}`);
  }
  return `svg{${vars.join(";")}}${D.CSS}`;
}

function rasterize(style, scale = 2) {
  const markup = svg.outerHTML.replace(/^<svg /, `<svg width="${Math.round(D.W * scale)}" height="${Math.round(D.H * scale)}" `).replace(/(<svg[^>]*>)/, `$1<style>${style}</style>`);
  const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml" }));
  const image = new Image();
  image.src = url;
  return image.decode().then(() => {
    URL.revokeObjectURL(url);
    return image;
  });
}

function compose(ctx, image, { width, height, caption, note }) {
  const css = getComputedStyle(document.documentElement);
  const bg = css.getPropertyValue("--bg").trim() || "#fafaf5";
  const ink = css.getPropertyValue("--ink").trim() || "#1a1a1a";
  const soft = css.getPropertyValue("--ink-soft").trim() || "#4a4a4a";
  const accent = css.getPropertyValue("--blueprint").trim() || "#3553ff";
  const u = width / 1280;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  const top = 96 * u;
  const bottom = 64 * u;
  const room = height - top - bottom;
  const w = Math.min(width - 40 * u, (room * D.W) / D.H);
  const h = (w * D.H) / D.W;
  ctx.drawImage(image, (width - w) / 2, top + (room - h) / 2, w, h);
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = accent;
  ctx.font = `${13 * u}px "JetBrains Mono", ui-monospace, monospace`;
  ctx.fillText("FIG_AGT · AN INTERACTIVE SIMULATION", 40 * u, 34 * u);
  ctx.fillStyle = ink;
  ctx.font = `${44 * u}px VT323, ui-monospace, monospace`;
  ctx.fillText("INSIDE AN AI AGENT", 40 * u, 74 * u);
  ctx.fillStyle = soft;
  ctx.font = `${17 * u}px "Source Serif 4", Georgia, serif`;
  wrapText(ctx, caption, 420 * u, 52 * u, width - 460 * u, 22 * u, 2);
  const ev = state.shown >= 0 ? state.sim.events[state.shown] : null;
  ctx.fillStyle = ink;
  ctx.font = `600 ${18 * u}px "Source Serif 4", Georgia, serif`;
  ctx.fillText(ev ? STAGE_NAMES[ev.type] : "Ready", 40 * u, height - 26 * u);
  ctx.fillStyle = soft;
  ctx.font = `${13 * u}px "JetBrains Mono", ui-monospace, monospace`;
  const right = note || (ev ? `step ${ev.index + 1} of ${state.sim.events.length} · ${(ev.clock / 1000).toFixed(2)} s simulated` : "");
  ctx.textAlign = "right";
  ctx.fillText(right, width - 40 * u, height - 40 * u);
  ctx.fillStyle = accent;
  ctx.fillText("aiengineeringfromscratch.com/inside-an-ai-agent", width - 40 * u, height - 20 * u);
  ctx.textAlign = "left";
}

function wrapText(ctx, text, x, y, width, line, max) {
  const words = String(text).split(" ");
  let row = "";
  let rows = 0;
  for (const word of words) {
    const next = row ? row + " " + word : word;
    if (ctx.measureText(next).width > width && row) {
      ctx.fillText(row, x, y + rows * line);
      rows += 1;
      row = word;
      if (rows === max - 1) {
        const rest = words.slice(words.indexOf(word)).join(" ");
        let cut = rest;
        while (ctx.measureText(cut + "…").width > width && cut.length) cut = cut.slice(0, -1);
        ctx.fillText(cut === rest ? cut : cut + "…", x, y + rows * line);
        return;
      }
    } else row = next;
  }
  if (row) ctx.fillText(row, x, y + rows * line);
}

const STILL_TOUR = (ev) => {
  if (!ev) return D.TOUR[0];
  if (ev.type === "model" && ev.turn === 1) return D.TOUR[1];
  if (["schema", "permit", "execute", "timeout", "backoff", "observe"].includes(ev.type) || (ev.type === "model" && ev.turn > 1) || ev.type === "verify" || ev.type === "exit") return D.TOUR[2];
  return D.TOUR[0];
};

function segmentsFor(kind) {
  if (kind === "tour") {
    return [
      { config: {}, caption: (ev) => STILL_TOUR(ev).title + ". " + STILL_TOUR(ev).text },
      ...D.TOUR.slice(3).map((item) => ({ config: item.config, caption: () => item.title + ". " + item.text })),
    ];
  }
  const label = configLabel(state.config);
  return [{ config: state.config, caption: () => label + ". " + M.REQUEST.text }];
}

async function renderFrames({ kind, fps, speed, width, height, onFrame, scale }) {
  const style = svgStyle();
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const segments = segmentsFor(kind);
  const total = segments.reduce((sum, segment) => sum + estimateSeconds(segment.config), 0) / speed + segments.length * 1.6;
  let done = 0;
  const dt = 1 / fps;
  state.explode.target = 0;
  for (const shares of Object.values(state.explode.shares)) Object.assign(shares, { x: 0, v: 0, goal: 0, wait: 0 });
  for (const segment of segments) {
    load(segment.config);
    state.playing = true;
    const frameAt = async (note) => {
      draw();
      const image = await rasterize(style, scale);
      const ev = state.shown >= 0 ? state.sim.events[state.shown] : null;
      compose(ctx, image, { width, height, caption: segment.caption(ev), note });
      await onFrame(ctx, canvas);
      done += dt;
      exportStatus.textContent = `Rendering frames · ${Math.min(99, Math.round((done / total) * 100))}%`;
      if (EXPORT.cancel) throw new Error("cancelled");
    };
    while (!state.done) {
      advance(dt * speed);
      await frameAt();
    }
    for (let t = 0; t < 1.6; t += dt) await frameAt(state.sim.outcome.status.toUpperCase() + " · " + (state.sim.outcome.correct === false ? "answer is wrong" : state.sim.outcome.correct ? "answer is correct" : "no answer"));
  }
}

function estimateSeconds(config) {
  return beatsFor(M.simulate(config)).reduce((sum, beat) => sum + (beat.d === "travel" ? 2.2 : beat.d), 0);
}

async function exportGif() {
  const width = 720;
  const height = 405;
  const fps = 10;
  const gif = new GifWriter(width, height);
  let previous = null;
  await renderFrames({
    kind: "run",
    fps,
    speed: 2.5,
    width,
    height,
    scale: 0.8,
    onFrame: async (ctx) => {
      const pixels = ctx.getImageData(0, 0, width, height).data;
      gif.frame(pixels, previous, 100 / fps);
      previous = pixels.slice();
      await new Promise((resolve) => setTimeout(resolve, 0));
    },
  });
  return new Blob([gif.end()], { type: "image/gif" });
}

function videoType() {
  const options = ["video/mp4;codecs=avc1.42E01F", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  return options.find((type) => window.MediaRecorder && MediaRecorder.isTypeSupported(type)) || null;
}

async function exportVideo(kind) {
  const type = videoType();
  if (!type) throw new Error("This browser cannot record video. Try the GIF.");
  const width = 1280;
  const height = 720;
  const fps = 30;
  const frames = [];
  await renderFrames({
    kind,
    fps,
    speed: 1.5,
    width,
    height,
    scale: 1.2,
    onFrame: (ctx, canvas) => new Promise((resolve) => canvas.toBlob((blob) => (frames.push(blob), resolve()), "image/webp", 0.92)),
  });
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 3_000_000 });
  const chunks = [];
  recorder.ondataavailable = (event) => event.data.size && chunks.push(event.data);
  const stopped = new Promise((resolve) => (recorder.onstop = resolve));
  const first = await createImageBitmap(frames[0]);
  ctx.drawImage(first, 0, 0);
  recorder.start(1000);
  const start = performance.now();
  for (let i = 0; i < frames.length; i++) {
    if (EXPORT.cancel) break;
    const bitmap = await createImageBitmap(frames[i]);
    const due = start + (i * 1000) / fps;
    const wait = due - performance.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    exportStatus.textContent = `Encoding video · ${Math.round((i / frames.length) * 100)}%`;
  }
  await new Promise((resolve) => setTimeout(resolve, 1000 / fps));
  recorder.stop();
  await stopped;
  stream.getTracks().forEach((track) => track.stop());
  if (EXPORT.cancel) throw new Error("cancelled");
  return new Blob(chunks, { type: type.split(";")[0] });
}

async function exportPng() {
  const canvas = document.createElement("canvas");
  canvas.width = 2560;
  canvas.height = 1440;
  const image = await rasterize(svgStyle(), 3);
  compose(canvas.getContext("2d"), image, { width: 2560, height: 1440, caption: configLabel(state.config) + ". " + M.REQUEST.text });
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

function save(blob, name) {
  if (window.__agentMachine.onSave) return window.__agentMachine.onSave(blob, name);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function slug() {
  const query = M.encode(state.config);
  return "inside-an-ai-agent" + (query ? "-" + query.replace(/[=&]/g, "-") : "");
}

async function runExport(kind) {
  if (EXPORT.busy) return;
  EXPORT.busy = true;
  EXPORT.cancel = false;
  const config = state.config;
  document.body.dataset.amExporting = "";
  $$("[data-am-export]").forEach((button) => (button.disabled = true));
  $("[data-am-export-cancel]").hidden = kind === "png";
  state.recording = true;
  try {
    let blob;
    let name;
    if (kind === "png") [blob, name] = [await exportPng(), slug() + ".png"];
    if (kind === "gif") [blob, name] = [await exportGif(), slug() + ".gif"];
    if (kind === "video" || kind === "tour") {
      blob = await exportVideo(kind === "tour" ? "tour" : "run");
      name = (kind === "tour" ? "inside-an-ai-agent-tour" : slug()) + (blob.type.includes("mp4") ? ".mp4" : ".webm");
    }
    save(blob, name);
    exportStatus.textContent = `Saved ${name} · ${(blob.size / 1048576).toFixed(1)} MB`;
  } catch (error) {
    exportStatus.textContent = error.message === "cancelled" ? "Export cancelled." : error.message;
  } finally {
    state.recording = false;
    EXPORT.busy = false;
    delete document.body.dataset.amExporting;
    $$("[data-am-export]").forEach((button) => (button.disabled = false));
    $("[data-am-export-cancel]").hidden = true;
    if (kind !== "png") load(config);
    draw();
  }
}

window.__agentMachine.exportAs = runExport;
$$("[data-am-export]").forEach((button) => button.addEventListener("click", () => runExport(button.dataset.amExport)));
$("[data-am-export-cancel]").addEventListener("click", () => (EXPORT.cancel = true));
if (!videoType()) $$('[data-am-export="video"], [data-am-export="tour"]').forEach((button) => (button.title = "Video recording is not supported in this browser"));

class GifWriter {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.bytes = [];
    this.push(...[71, 73, 70, 56, 57, 97]);
    this.short(width);
    this.short(height);
    this.push(0x70, 0, 0);
    this.push(0x21, 0xff, 11, ...[..."NETSCAPE2.0"].map((c) => c.charCodeAt(0)), 3, 1, 0, 0, 0);
  }
  push(...values) {
    for (const value of values) this.bytes.push(value);
  }
  short(value) {
    this.push(value & 0xff, (value >> 8) & 0xff);
  }
  frame(pixels, previous, delay) {
    const count = this.width * this.height;
    const counts = new Map();
    const keyOf = (i) => ((pixels[i] >> 3) << 10) | ((pixels[i + 1] >> 3) << 5) | (pixels[i + 2] >> 3);
    const same = (i) => previous && pixels[i] === previous[i] && pixels[i + 1] === previous[i + 1] && pixels[i + 2] === previous[i + 2];
    for (let p = 0; p < count; p++) {
      const i = p * 4;
      if (same(i)) continue;
      const key = keyOf(i);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const palette = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 255).map(([key]) => key);
    const rgb = palette.map((key) => [((key >> 10) & 31) * 8 + 4, ((key >> 5) & 31) * 8 + 4, (key & 31) * 8 + 4]);
    const lookup = new Map(palette.map((key, index) => [key, index]));
    const nearest = (key) => {
      let index = lookup.get(key);
      if (index !== undefined) return index;
      const r = ((key >> 10) & 31) * 8 + 4;
      const g = ((key >> 5) & 31) * 8 + 4;
      const b = (key & 31) * 8 + 4;
      let best = 0;
      let distance = Infinity;
      rgb.forEach(([pr, pg, pb], k) => {
        const d = (pr - r) ** 2 + (pg - g) ** 2 + (pb - b) ** 2;
        if (d < distance) [distance, best] = [d, k];
      });
      lookup.set(key, best);
      return best;
    };
    const indexed = new Uint8Array(count);
    for (let p = 0; p < count; p++) {
      const i = p * 4;
      indexed[p] = same(i) ? 255 : nearest(keyOf(i));
    }
    this.push(0x21, 0xf9, 4, previous ? 0x05 : 0x04);
    this.short(Math.round(delay));
    this.push(255, 0);
    this.push(0x2c);
    this.short(0);
    this.short(0);
    this.short(this.width);
    this.short(this.height);
    this.push(0x87);
    for (let k = 0; k < 256; k++) {
      const color = rgb[k] || [0, 0, 0];
      this.push(color[0], color[1], color[2]);
    }
    this.lzw(indexed);
  }
  lzw(indexed) {
    const min = 8;
    this.push(min);
    const clear = 1 << min;
    const stop = clear + 1;
    let size = min + 1;
    let next = stop + 1;
    let table = new Map();
    const out = [];
    let bits = 0;
    let buffer = 0;
    const write = (code) => {
      buffer |= code << bits;
      bits += size;
      while (bits >= 8) {
        out.push(buffer & 0xff);
        buffer >>= 8;
        bits -= 8;
      }
    };
    write(clear);
    let prefix = indexed[0];
    for (let p = 1; p < indexed.length; p++) {
      const k = indexed[p];
      const key = prefix * 256 + k;
      const found = table.get(key);
      if (found !== undefined) {
        prefix = found;
        continue;
      }
      write(prefix);
      if (next < 4096) {
        table.set(key, next++);
        if (next > 1 << size && size < 12) size += 1;
      } else {
        write(clear);
        table = new Map();
        size = min + 1;
        next = stop + 1;
      }
      prefix = k;
    }
    write(prefix);
    write(stop);
    if (bits > 0) out.push(buffer & 0xff);
    for (let i = 0; i < out.length; i += 255) {
      const block = out.slice(i, i + 255);
      this.push(block.length, ...block);
    }
    this.push(0);
  }
  end() {
    this.push(0x3b);
    return new Uint8Array(this.bytes);
  }
}
