#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const REPOSITORY = 'rohitg00/ai-engineering-from-scratch';
const OUTPUT_PATH = path.join(__dirname, 'releases.json');
const RELEASE_URL = new RegExp(`^https://github\\.com/${REPOSITORY}/releases/tag/[A-Za-z0-9._-]+$`);
const MAX_RELEASES = 6;
const PAGE_SIZE = 30;
const MAX_SUMMARY = 180;
const NON_PROSE_START = /^(?:#|\||>|[-*+] |\d+\. )/;
const MARKDOWN_LINK = /\[([^\]]*)\](?:\([^)]*\)|\[[^\]]*\])/g;
const MARKDOWN_IMAGE = /!\[[^\]]*\](?:\([^)]*\)|\[[^\]]*\])/g;
const FENCED_BLOCK = /^(```|~~~)[\s\S]*?^\1.*$/gm;
const HEADING_LINE = /^#{1,6} .*$/gm;

function plainText(markdown) {
  return String(markdown || '')
    .replace(MARKDOWN_IMAGE, '')
    .replace(MARKDOWN_LINK, '$1')
    .replace(/[`*_]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isProse(paragraph) {
  if (!paragraph || NON_PROSE_START.test(paragraph)) return false;
  return /[\p{L}\p{N}]/u.test(paragraph.replace(MARKDOWN_LINK, ''));
}

function summaryOf(body) {
  const paragraphs = String(body || '').replace(/\r\n/g, '\n').replace(FENCED_BLOCK, '').replace(HEADING_LINE, '').split(/\n\s*\n/);
  const firstProse = paragraphs.map(paragraph => paragraph.trim()).find(isProse);
  const text = plainText(firstProse);
  if (text.length <= MAX_SUMMARY) return text;
  const clipped = text.slice(0, MAX_SUMMARY);
  return `${clipped.slice(0, Math.max(clipped.lastIndexOf(' '), 1)).replace(/[,;:.]$/, '')}...`;
}

function titleOf(release) {
  const name = plainText(release.name) || String(release.tag_name || '');
  const subtitle = /^Edition\s+\S+:\s*(.+)$/.exec(name);
  return subtitle ? subtitle[1] : name;
}

function toEntries(releases) {
  if (!Array.isArray(releases)) return [];
  return releases
    .filter(release => release && !release.draft && !release.prerelease)
    .filter(release => RELEASE_URL.test(String(release.html_url || '')) && /^\d{4}-\d{2}-\d{2}/.test(String(release.published_at || '')))
    .slice(0, MAX_RELEASES)
    .map(release => ({
      tag: String(release.tag_name),
      title: titleOf(release),
      date: String(release.published_at).slice(0, 10),
      summary: summaryOf(release.body),
      url: String(release.html_url),
    }));
}

async function collectReleases({ fetchImpl = globalThis.fetch, token = process.env.GITHUB_TOKEN, timeoutMs = 8000 } = {}) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'aifs-site-build' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetchImpl(`https://api.github.com/repos/${REPOSITORY}/releases?per_page=${PAGE_SIZE}`, {
    headers,
    signal: AbortSignal.timeout(timeoutMs),
    redirect: 'error',
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return toEntries(await response.json());
}

async function main() {
  let releases = [];
  try {
    releases = await collectReleases();
  } catch (error) {
    console.warn(`releases.json: GitHub releases unavailable (${error.message}); the home page hides the release list in this build`);
  }
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify({ releases }, null, 2) + '\n', 'utf8');
  console.log(`releases.json: ${releases.length} release${releases.length === 1 ? '' : 's'}`);
}

if (require.main === module) main();

module.exports = { collectReleases, toEntries, summaryOf, titleOf, OUTPUT_PATH };
