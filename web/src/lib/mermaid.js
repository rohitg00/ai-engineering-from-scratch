let mermaidPromise = null;
let ready = null;
let renderSeq = 0;

function mermaidTheme() {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'default' : 'dark';
}

function initializeMermaid(mermaid) {
  mermaid.initialize({
    startOnLoad: false,
    theme: mermaidTheme(),
    fontFamily: 'JetBrains Mono, ui-monospace, monospace',
    themeVariables: { fontSize: '13px' },
    flowchart: { useMaxWidth: true, htmlLabels: true, nodeSpacing: 40, rankSpacing: 50, padding: 12 },
  });
  window._mermaidReady = mermaid;
  return mermaid;
}

export function loadMermaid() {
  if (ready) return Promise.resolve(ready);
  if (!mermaidPromise) {
    mermaidPromise = import('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs')
      .then((module) => {
        ready = initializeMermaid(module.default || module);
        return ready;
      })
      .catch((error) => {
        mermaidPromise = null;
        throw error;
      });
  }
  return mermaidPromise;
}

function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}

function hslToHex(h, s, l) {
  function hue(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue(p, q, h + 1 / 3);
    g = hue(p, q, h);
    b = hue(p, q, h - 1 / 3);
  }
  function c(x) {
    x = Math.round(Math.max(0, Math.min(1, x)) * 255);
    return ('0' + x.toString(16)).slice(-2);
  }
  return '#' + c(r) + c(g) + c(b);
}

function mermaidPreprocess(def) {
  const dark = mermaidTheme() === 'dark';
  return def.replace(/fill\s*:\s*(#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?)(?![0-9a-fA-F])/g, (m, hex) => {
    const hsl = hexToHsl(hex.toLowerCase());
    if (dark && hsl[2] > 0.65) return 'fill:' + hslToHex(hsl[0], hsl[1], 0.26);
    if (!dark && hsl[2] < 0.30) return 'fill:' + hslToHex(hsl[0], Math.min(hsl[1], 0.5), 0.86);
    return m;
  });
}

export async function renderMermaid(root = document) {
  const scope = root || document;
  const sources = scope.querySelectorAll('pre.mermaid.mermaid-source');
  if (!sources.length) return;
  const mermaid = await loadMermaid();
  try {
    mermaid.initialize({
      startOnLoad: false,
      theme: mermaidTheme(),
      fontFamily: 'JetBrains Mono, ui-monospace, monospace',
      themeVariables: { fontSize: '13px' },
      flowchart: { useMaxWidth: true, htmlLabels: true, nodeSpacing: 40, rankSpacing: 50, padding: 12 },
    });
  } catch (_) {}
  for (const pre of sources) {
    const match = pre.id && pre.id.match(/mermaid-(\d+)/);
    const idx = match ? match[1] : null;
    if (!idx) continue;
    const target = scope.querySelector(`#mermaid-render-${idx}`) || document.getElementById(`mermaid-render-${idx}`);
    if (!target) continue;
    const def = mermaidPreprocess(pre.textContent);
    target.textContent = 'Rendering diagram...';
    const token = ++renderSeq;
    target._mermaidToken = token;
    const renderId = `mermaid-${idx}-${token}-svg`;
    try {
      const result = await mermaid.render(renderId, def);
      if (target._mermaidToken !== token) continue;
      target.innerHTML = result.svg;
    } catch (error) {
      if (target._mermaidToken !== token) continue;
      target.innerHTML = '<p style="color:var(--ink-soft);font-style:italic;">Diagram could not be rendered.</p>';
      console.error('mermaid:', error);
    }
  }
}
