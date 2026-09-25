const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const sponsorUrl = 'https://serpapi.com/ai-engineering-from-scratch';
const description = 'Web Search API for your AI apps. Available in Markdown and JSON for any integration.';
const tierLabel = /\b(?:Backer|Bronze|Silver|Gold|Platinum|Diamond|Title Partner)\b/i;

function between(text, start, end, file) {
  const section = text.split(start)[1];
  assert.ok(section, `${file} is missing ${start.trim()}`);
  const placement = section.split(end)[0];
  assert.notEqual(placement, section, `${file} is missing ${end.trim()}`);
  return placement;
}

test('sponsor placement uses approved artwork and destination without a tier label', () => {
  const placements = [
    ['README.md', '### Sponsors\n', '### Use every lesson the same way'],
    ['SPONSORS.md', '## Sponsor\n', '## How to sponsor'],
    ['BACKERS.md', '## Sponsors\n', '## Infrastructure support'],
  ];
  for (const [file, start, end] of placements) {
    const text = read(file);
    const placement = between(text, start, end, file);
    assert.ok(placement.includes(description), file);
    assert.doesNotMatch(placement, tierLabel, file);
    assert.doesNotMatch(text, /serpapi\.com\/\?utm_/);
  }
  const sponsors = read('SPONSORS.md');
  assert.ok(sponsors.includes(`href="${sponsorUrl}"`));
  assert.match(sponsors, /media="\(prefers-color-scheme: dark\)" srcset="https:\/\/serpapi\.com\/assets\/media_kit\/logo-with-wordmark-white\.svg"/);
  assert.match(sponsors, /<img src="https:\/\/serpapi\.com\/assets\/media_kit\/logo-with-wordmark\.svg" alt="SerpApi" width="180">/);
  const readme = read('README.md');
  const placement = between(readme, '### Sponsors\n', '### Use every lesson the same way', 'README.md');
  const banner = `<a href="${sponsorUrl}">\n  <img align="left" src="assets/sponsors/serpapi-banner.png" alt="SerpApi. ${description}" width="600">\n</a>`;
  assert.ok(placement.includes(banner));
  assert.ok(placement.includes('Thank you to our sponsors.'));
  assert.ok(placement.includes('href="#supporters"'));
  assert.ok(placement.includes('href="SPONSORS.md"'));
  assert.ok(placement.includes('<br clear="all">'));
  assert.ok(readme.includes('\n## Sponsor the work\n'));
  const image = fs.readFileSync(path.join(root, 'assets/sponsors/serpapi-banner.png'));
  assert.equal(image.subarray(1, 4).toString(), 'PNG');
  assert.equal(image.readUInt32BE(16), 2172);
  assert.equal(image.readUInt32BE(20), 724);
  assert.doesNotMatch(readme, /### Current sponsors|\| Tier \|/);
  assert.match(readme, /<p align="center"><sub><b>[\d,]+<\/b> readers/);
});

test('backer listings are reachable and preserve existing supporters', () => {
  for (const file of ['README.md', 'SPONSORS.md']) {
    assert.match(read(file), /\[[^\]]+\]\(BACKERS\.md\)/, file);
  }
  const backers = read('BACKERS.md');
  assert.match(backers, /^# Backers\n/);
  assert.ok(backers.includes(`[SerpApi](${sponsorUrl})`));
  assert.ok(backers.includes('[SPONSORS.md](SPONSORS.md)'));
  for (const name of ['CodeRabbit', 'iii', 'Vercel Open Source Program']) {
    assert.ok(backers.includes(`[${name}](https://`), name);
  }
  for (const [, destination] of backers.matchAll(/\]\(([^)]+)\)/g)) {
    if (destination.startsWith('https://')) {
      assert.equal(new URL(destination).protocol, 'https:', destination);
    } else {
      assert.ok(fs.statSync(path.join(root, destination)).isFile(), destination);
    }
  }
});

test('supporter navigation survives translated README headings', () => {
  const translations = fs.readdirSync(path.join(root, 'i18n'), { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => path.join('i18n', entry.name, 'README.md'));
  assert.ok(translations.length > 0);
  for (const file of ['README.md', ...translations]) {
    const text = read(file);
    assert.ok(text.includes('href="#supporters"'), file);
    assert.ok(text.includes('<a id="supporters"></a>'), file);
    const sponsorLink = text.match(/href="([^"]*SPONSORS\.md)">Become a sponsor/);
    assert.ok(sponsorLink, file);
    assert.equal(path.resolve(root, path.dirname(file), sponsorLink[1]), path.join(root, 'SPONSORS.md'), file);
    assert.equal((text.match(/>Become a sponsor<\/a>/g) || []).length, 1, file);
    if (file !== 'README.md') {
      assert.doesNotMatch(
        text,
        /### Sponsors|Thank you to our sponsors\.|Your support keeps every lesson free and open source\.|See all supporters|SerpApi\. Web Search API|## Sponsor the work|Free, MIT-licensed, 523 lessons\.|See all sponsors and backers|Want to support the work\?/
      );
    }
  }
});

test('sponsors page is rendered from SPONSORS.md at build time', () => {
  const { renderSponsorsMarkdown } = require('./build.js');
  const page = read('site/sponsors.html');
  const generated = between(page, '<!-- GENERATED:SPONSORS:START -->\n', '\n          <!-- GENERATED:SPONSORS:END -->', 'site/sponsors.html');
  assert.equal(generated, renderSponsorsMarkdown(read('SPONSORS.md')));
  assert.ok(generated.startsWith('<h1 id="sponsorship">Sponsorship</h1>'));
  for (const anchor of ['hardware-lab-partner', 'hard-rules', 'pricing-anchors']) {
    assert.ok(generated.includes(`id="${anchor}"`), anchor);
    assert.ok(generated.includes(`href="#${anchor}"`), anchor);
  }
  assert.ok(generated.includes(`<a href="${sponsorUrl}" target="_blank" rel="noopener"><picture><source media="(prefers-color-scheme: dark)" srcset="https://serpapi.com/assets/media_kit/logo-with-wordmark-white.svg">`));
  assert.ok(generated.includes('href="https://github.com/rohitg00/ai-engineering-from-scratch/blob/main/BACKERS.md" target="_blank" rel="noopener"'));
  assert.ok(generated.includes('<td class="align-right">114,584 (+4%)</td>'));
  assert.ok(generated.includes('<li><strong>Open-source baseline</strong>'));
  assert.doesNotMatch(generated, /\n\s*\[Babel\]/);
});

test('sponsor markdown keeps only allowlisted HTML and safe links', () => {
  const { renderSponsorsMarkdown } = require('./build.js');
  const html = renderSponsorsMarkdown([
    '<img src="https://example.com/logo.svg" onerror="alert(1)" alt="Logo" width="120">',
    '<script>alert(1)</script> <a href="javascript:alert(1)">bad</a>',
    '[plain](javascript:alert) [parent](../secret.md) [anchor](#tiers)',
  ].join('\n'));
  assert.ok(html.includes('<img src="https://example.com/logo.svg" alt="Logo" width="120">'));
  assert.doesNotMatch(html, /<script|<a href="javascript|onerror|href="[^"]*\.\./);
  assert.equal((html.match(/<a /g) || []).length, (html.match(/<\/a>/g) || []).length);
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('bad&lt;/a&gt;'));
  assert.ok(html.includes('plain parent <a href="#tiers">anchor</a>'));
});

test('the hamburger menu and every page footer link to the sponsors page', () => {
  const pages = fs.readdirSync(path.join(root, 'site')).filter(name => name.endsWith('.html'));
  let footers = 0;
  for (const page of pages) {
    const text = read(path.join('site', page));
    if (!text.includes('<div class="footer-links">')) continue;
    footers++;
    const links = between(text, '<div class="footer-links">', '</div>', page);
    assert.ok(links.includes('<a href="sponsors.html">Sponsor us</a>'), page);
  }
  assert.ok(footers >= 13);
  assert.ok(read('site/header.js').includes("ensureNavigationLink(nav, 'sponsors.html', 'Sponsor us', 'header-mobile-only');"));
  assert.ok(JSON.parse(read('site/ui-strings.json')).keys.includes('Sponsor us'));
  const vercel = JSON.parse(read('vercel.json'));
  assert.ok(vercel.rewrites.some(rule => rule.source === '/sponsors' && rule.destination === '/sponsors.html'));
});

test('sponsor changes are reserved for maintainers', () => {
  for (const file of ['CONTRIBUTING.md', 'SPONSORS.md']) {
    const text = read(file).replace(/\s+/g, ' ');
    assert.ok(text.includes('Sponsorship changes are not accepted through contributor pull requests.'), file);
    assert.ok(text.includes('names, logos, links, and tier assignments are managed by the maintainer.'), file);
  }
});
