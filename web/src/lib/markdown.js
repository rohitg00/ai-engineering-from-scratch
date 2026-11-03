/**
 * Markdown subset -> DOM.
 *
 * The build script already turned each lesson into typed blocks. This module
 * handles the inline layer (code, bold, links, math) and paints the blocks.
 */

import { h } from './dom.js';
import { plainMath } from './math-text.js';
import { renderMermaid } from './mermaid.js';

const INLINE = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\)|\$[^$]+\$)/g;

let mermaidCounter = 0;

export function inline(text) {
  const frag = document.createDocumentFragment();
  let last = 0;
  let match;

  INLINE.lastIndex = 0;
  while ((match = INLINE.exec(text))) {
    if (match.index > last) frag.appendChild(document.createTextNode(text.slice(last, match.index)));
    const token = match[0];

    if (token.startsWith('`')) {
      frag.appendChild(h('code', null, token.slice(1, -1)));
    } else if (token.startsWith('**')) {
      frag.appendChild(h('strong', null, token.slice(2, -2)));
    } else if (token.startsWith('[')) {
      const link = token.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
      const a = h('a', { href: link[2], target: '_blank', rel: 'noreferrer noopener' }, link[1]);
      frag.appendChild(a);
    } else if (token.startsWith('$')) {
      frag.appendChild(h('span', { class: 'math-inline' }, plainMath(token.slice(1, -1))));
    }

    last = match.index + token.length;
  }

  if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
  return frag;
}

function copyButton(source) {
  const button = h('button', { class: 'code-copy', type: 'button' }, 'copy');
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(source);
      button.textContent = 'copied';
    } catch {
      button.textContent = 'select';
    }
    setTimeout(() => {
      button.textContent = 'copy';
    }, 1400);
  });
  return button;
}

function mermaidBlock(block) {
  const idx = ++mermaidCounter;
  const sourceId = `mermaid-${idx}`;
  const renderId = `mermaid-render-${idx}`;
  const container = h(
    'div',
    { class: 'mermaid-container' },
    h(
      'div',
      { class: 'mermaid-block', dataset: { mermaidIndex: idx } },
      h('pre', { class: 'mermaid mermaid-source', id: sourceId }, block.source),
      h('div', { class: 'mermaid-render', id: renderId }, 'Rendering diagram...'),
    ),
  );
  setTimeout(() => {
    renderMermaid(container).catch(() => {});
  }, 0);
  return container;
}

export function codeBlock(block) {
  if (block.lang === 'mermaid') return mermaidBlock(block);
  const source = block.source.replace(/\n$/, '');
  return h(
    'div',
    { class: 'code-block' },
    h(
      'div',
      { class: 'code-head' },
      h('span', { class: 'code-lang' }, block.lang || 'text'),
      copyButton(source),
    ),
    h('pre', null, h('code', null, source)),
  );
}

export function renderBlocks(blocks, options = {}) {
  const frag = document.createDocumentFragment();

  for (const block of blocks) {
    switch (block.kind) {
      case 'p':
        frag.appendChild(h('p', null, inline(block.text)));
        break;

      case 'heading':
        frag.appendChild(
          h(block.level <= 3 ? 'h4' : 'h5', null, block.text),
        );
        break;

      case 'ul':
        frag.appendChild(
          h('ul', null, block.items.map((item) => h('li', null, inline(item)))),
        );
        break;

      case 'ol':
        frag.appendChild(
          h('ol', null, block.items.map((item) => h('li', null, inline(item)))),
        );
        break;

      case 'quote':
        frag.appendChild(h('blockquote', null, inline(block.text)));
        break;

      case 'code':
        frag.appendChild(codeBlock(block));
        break;

      case 'math':
        frag.appendChild(h('div', { class: 'math-block' }, block.source));
        break;

      case 'table': {
        const table = h(
          'table',
          null,
          h('thead', null, h('tr', null, block.head.map((cell) => h('th', null, inline(cell))))),
          h(
            'tbody',
            null,
            block.rows.map((row) =>
              h('tr', null, row.map((cell) => h('td', null, inline(cell)))),
            ),
          ),
        );
        frag.appendChild(table);
        break;
      }

      case 'figure':
        frag.appendChild(
          h(
            'div',
            { class: 'figure-card' },
            h('div', { class: 'eyebrow' }, 'figure'),
            h('div', { class: 'figure-name' }, block.name.replace(/-/g, ' ')),
            options.lessonUrl
              ? h(
                  'a',
                  {
                    class: 'meta',
                    href: options.lessonUrl,
                    target: '_blank',
                    rel: 'noreferrer noopener',
                    style: 'display:inline-block;margin-top:6px',
                  },
                  'Open the interactive version →',
                )
              : h(
                  'p',
                  { class: 'meta', style: 'margin-top:6px' },
                  'Interactive version opens on the published lesson.',
                ),
          ),
        );
        break;

      case 'hr':
        frag.appendChild(h('hr', { class: 'rule', style: 'margin:1.4em 0' }));
        break;

      default:
        break;
    }
  }

  return frag;
}

/** A block of prose with the shared reading styles. */
export function prose(blocks, options = {}) {
  return h('div', { class: 'prose' }, renderBlocks(blocks, options));
}
