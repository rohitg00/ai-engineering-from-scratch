import type { DocumentFixture } from "./types.js";
import { listFixtures } from "./fixtures.js";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderIndex(): string {
  const items = listFixtures()
    .map(
      (d) =>
        `<li><a href="/document/${escapeHtml(d.id)}">${escapeHtml(d.title)}</a> - <em>${escapeHtml(d.query)}</em></li>`,
    )
    .join("\n");
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><title>Document QA viewer</title>
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:2rem auto;color:#222}</style>
</head><body>
<h1>Capstone 04 viewer</h1>
<p>document を選んでください。cited region は page image 上の canvas overlay として描画されます。</p>
<ul>${items}</ul>
</body></html>`;
}

export function renderDocument(doc: DocumentFixture): string {
  const payload = JSON.stringify({
    id: doc.id,
    pageWidth: doc.pageWidth,
    pageHeight: doc.pageHeight,
    pageImageUrl: doc.pageImageUrl,
    evidence: doc.evidence,
  });
  const evidenceLis = doc.evidence
    .map(
      (e, i) =>
        `<li><strong>#${i + 1}</strong> (score ${e.score.toFixed(2)}): <code>${escapeHtml(e.text)}</code></li>`,
    )
    .join("\n");
  const halfW = doc.pageWidth / 2;
  const halfH = doc.pageHeight / 2;
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><title>${escapeHtml(doc.title)}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 980px; margin: 2rem auto; color: #222; }
  .stage { position: relative; border: 1px solid #ddd; display: inline-block; }
  canvas.overlay { position: absolute; top: 0; left: 0; pointer-events: none; }
  .answer { background: #f6f6f6; padding: 1rem; border-left: 4px solid #444; }
  .evidence li { margin-bottom: .5rem; }
</style></head><body>
<h1>${escapeHtml(doc.title)}</h1>
<p><strong>Q:</strong> ${escapeHtml(doc.query)}</p>
<div class="answer"><strong>A:</strong> ${escapeHtml(doc.answer)}</div>
<h2>Page (page image + overlays)</h2>
<div class="stage" id="stage" style="width:${halfW}px;height:${halfH}px;background:#fafafa">
  <canvas class="overlay" id="overlay" width="${halfW}" height="${halfH}"></canvas>
</div>
<h2>Cited regions</h2>
<ul class="evidence">
${evidenceLis}
</ul>
<script>
  const DATA = ${payload};
  function draw() {
    const c = document.getElementById("overlay");
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const sx = c.width / DATA.pageWidth;
    const sy = c.height / DATA.pageHeight;
    ctx.lineWidth = 2;
    ctx.font = "12px system-ui";
    DATA.evidence.forEach((e, i) => {
      const hue = 200 + i * 40;
      ctx.strokeStyle = "hsl(" + hue + ",70%,45%)";
      ctx.fillStyle = "hsla(" + hue + ",70%,45%,0.18)";
      const x = e.bbox.x * sx;
      const y = e.bbox.y * sy;
      const w = e.bbox.w * sx;
      const h = e.bbox.h * sy;
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = "hsl(" + hue + ",70%,30%)";
      ctx.fillText("#" + (i + 1), x + 4, y + 14);
    });
  }
  if (typeof document !== "undefined") draw();
</script>
</body></html>`;
}
