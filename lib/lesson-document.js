'use strict';

function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function plainMarkdown(value) {
  return normalizeWhitespace(value)
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[*_~]+/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\\([\\`*_[\]{}()#+\-.!])/g, '$1');
}

function truncateText(value, limit) {
  const text = normalizeWhitespace(value);
  if (!limit || text.length <= limit) return text;
  const clipped = text.slice(0, Math.max(0, limit - 1));
  const boundary = clipped.lastIndexOf(' ');
  return (boundary >= Math.floor(limit * 0.65) ? clipped.slice(0, boundary) : clipped).trimEnd() + '…';
}

function wordCount(value) {
  const text = normalizeWhitespace(value);
  return text ? text.split(' ').length : 0;
}

function truncateWords(value, limit) {
  const words = normalizeWhitespace(value).split(' ').filter(Boolean);
  if (!limit || words.length <= limit) return words.join(' ');
  return words.slice(0, limit).join(' ') + '…';
}

function seoTitleFor(title) {
  const brandedTitle = `${title} | AI Engineering from Scratch`;
  return brandedTitle.length <= 60 ? brandedTitle : truncateText(title, 60);
}

function descriptionFromParts(title, parts) {
  const uniqueParts = [];
  for (const value of parts) {
    const text = normalizeWhitespace(value);
    if (text && !uniqueParts.includes(text)) uniqueParts.push(text);
  }
  let body = '';
  for (const part of uniqueParts) {
    body = normalizeWhitespace(`${body} ${part}`);
    const candidate = body.toLowerCase().startsWith(title.toLowerCase()) ? body : `${title}: ${body}`;
    if (candidate.length >= 125) break;
  }
  const source = body
    ? (body.toLowerCase().startsWith(title.toLowerCase()) ? body : `${title}: ${body}`)
    : title;
  return { description: truncateText(source, 160), descriptionSourceLength: source.length };
}

function lessonDocumentSeo(markdown, fallbackTitle) {
  const lines = String(markdown || '').split(/\r?\n/);
  let title = normalizeWhitespace(fallbackTitle);
  let summary = '';
  let inFence = false;
  let paragraph = [];
  const paragraphs = [];

  function flushParagraph() {
    const text = plainMarkdown(paragraph.join(' '));
    if (text) paragraphs.push(text);
    paragraph = [];
  }

  for (const raw of lines) {
    const line = raw.trim();
    if (/^```/.test(line)) {
      flushParagraph();
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (!line) {
      flushParagraph();
      continue;
    }
    if (line.startsWith('# ')) {
      title = plainMarkdown(line.slice(2)) || title;
      flushParagraph();
      continue;
    }
    if (line.startsWith('>')) {
      if (!summary) summary = plainMarkdown(line.replace(/^>\s*/, ''));
      flushParagraph();
      continue;
    }
    const listItem = line.match(/^(?:[-*+]\s|\d+[.)]\s)(.+)$/);
    if (listItem) {
      const item = plainMarkdown(listItem[1]).replace(/^\[[ xX]\]\s*/, '');
      if (item) paragraph.push(/[.!?]$/.test(item) ? item : item + '.');
      continue;
    }
    if (/^#{2,6}\s/.test(line) ||
        /^\*\*(Type|Languages|Prerequisites|Time):\*\*/i.test(line) ||
        /^\|/.test(line) ||
        /^(?:---+|===+)$/.test(line)) {
      flushParagraph();
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();

  const proseParts = [summary].concat(paragraphs).filter(Boolean);
  const excerptSource = proseParts.join(' ') || title;
  const excerpt = truncateWords(excerptSource, 220);
  const { description, descriptionSourceLength } = descriptionFromParts(title, proseParts);
  return {
    title,
    seoTitle: seoTitleFor(title),
    description,
    excerpt,
    sourceWordCount: wordCount(excerptSource),
    descriptionSourceLength,
  };
}

module.exports = {
  normalizeWhitespace,
  plainMarkdown,
  truncateText,
  wordCount,
  truncateWords,
  seoTitleFor,
  descriptionFromParts,
  lessonDocumentSeo,
};
