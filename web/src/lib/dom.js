/**
 * Tiny DOM helpers. No framework, no virtual DOM: views build real nodes.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

export function h(tag, props, ...children) {
  const el = document.createElement(tag);

  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value === null || value === undefined || value === false) continue;

      if (key === 'class') el.className = value;
      else if (key === 'html') el.innerHTML = value;
      else if (key === 'style') el.setAttribute('style', value);
      else if (key === 'dataset') Object.assign(el.dataset, value);
      else if (key.startsWith('on') && typeof value === 'function') {
        el.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (value === true) el.setAttribute(key, '');
      else el.setAttribute(key, value);
    }
  }

  append(el, children);
  return el;
}

export function append(parent, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) append(parent, child);
    else if (child instanceof Node) parent.appendChild(child);
    else parent.appendChild(document.createTextNode(String(child)));
  }
}

export function frag(...children) {
  const f = document.createDocumentFragment();
  append(f, children);
  return f;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/* ------------------------------------------------------------------ icons */

const PATHS = {
  play: 'M8 5l11 7-11 7V5z',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  arrowLeft: 'M19 12H5M11 18l-6-6 6-6',
  check: 'M4 12l5 5L20 6',
  x: 'M6 6l12 12M18 6L6 18',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4.2-4.2',
  flame: 'M12 3c3 4 6 6 6 10a6 6 0 0 1-12 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 2-9z',
  bolt: 'M13 2L4 14h6l-1 8 9-12h-6l1-8z',
  book: 'M4 5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 1-2-2V5zM8 3v18',
  layers: 'M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17l9 5 9-5',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  sun: 'M12 4V2M12 22v-2M4 12H2M22 12h-2M6 6L4.5 4.5M17.5 17.5L19 19M6 18l-1.5 1.5M17.5 6.5L19 5M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  moon: 'M20 14a8 8 0 0 1-10-10 8 8 0 1 0 10 10z',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  sparkle: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6z',
  code: 'M8 6l-6 6 6 6M16 6l6 6-6 6',
  pen: 'M4 20l4-1 11-11-3-3L5 16l-1 4z',
  shuffle: 'M3 7h4l10 10h4M17 3l4 4-4 4M3 17h4l3-3M14 10l3-3h4M17 21l4-4-4-4',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  target: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2z',
  refresh: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v4h-4',
  copy: 'M9 9h11v11H9zM4 15V4h11',
  flag: 'M5 21V4h12l-2 4 2 4H5',
};

export function icon(name, size = 16) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.7');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');

  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', PATHS[name] ?? PATHS.arrow);
  svg.appendChild(path);
  return svg;
}

/* ------------------------------------------------------------------ toast */

let toastTimer = null;

export function toast(message) {
  let host = document.querySelector('.toast-host');
  if (!host) {
    host = h('div', { class: 'toast-host', 'aria-live': 'polite' });
    document.body.appendChild(host);
  }
  host.replaceChildren(
    h('div', { class: 'toast' }, icon('check', 14), h('span', null, message)),
  );

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => host.replaceChildren(), 2200);
}

/* --------------------------------------------------------------- utilities */

export function pct(part, total) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
}

export function minutesLabel(minutes) {
  if (!minutes) return '';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${hours} h`;
}

export function plural(n, one, many) {
  return n === 1 ? one : many;
}

export function scrollTop() {
  window.scrollTo({ top: 0, behavior: 'instant' });
}

export function focusMain() {
  const main = document.querySelector('main');
  if (main) {
    main.setAttribute('tabindex', '-1');
    main.focus({ preventScroll: true });
  }
}
