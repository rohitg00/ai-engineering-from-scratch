'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { normalizeWhitespace } = require('./lesson-document');

const ORIGIN = 'https://aiengineeringfromscratch.com';
const BRAND = 'Open source · MIT';
const INDEPENDENT = 'Independent preparation';
const STATIC_TYPES = ['page', 'project', 'manual', 'term', 'phase'];
const CARD_URL = new RegExp(`(${ORIGIN.replace(/\./g, '\\.')}/og/(${STATIC_TYPES.join('|')})/([a-z0-9-]+)\\.png)(?:\\?v=[0-9a-f]+)?`, 'g');
const CARD_TAG = new RegExp(`([ \\t]*)<meta property="og:image" content="${CARD_URL.source}">`, 'g');
const COMPANION_TAG = /[ \t]*<meta (?:property="og:image:(?:width|height|alt)"|name="twitter:(?:card|image|image:alt)") content="[^"]*">\r?\n?/g;
const LEVEL_NAMES = { 1: 'Starter', 2: 'Builder', 3: 'Engineer', 4: 'Systems', 5: 'Frontier' };
const PAGES = {
  about: ['About', 'About this curriculum', 'Why this curriculum exists, who builds it, and how the site is made.', '/about'],
  catalog: ['Catalog · {lessons} lessons', 'Lesson Catalog', 'Search and filter every lesson across {phases} phases.', '/catalog'],
  glossary: ['Glossary · {terms} terms', 'AI Engineering Glossary', 'Precise definitions with examples, distinctions, and course links.', '/glossary'],
  prereqs: ['Roadmap · {phases} phases', 'Roadmap', 'Trace every prerequisite and find your next phase.', '/prereqs'],
  'learning-paths': ['Learning paths', 'AI Engineering Learning Paths', 'Core paths and career routes, each tied to practical lessons.', '/learning-paths'],
  blogs: ['Blogs & guides', 'AI Engineering Blogs & Guides', 'Deep dives and practical guides on agents, inference, and RAG.', '/blogs'],
  sponsors: ['Sponsors', 'Sponsor the curriculum', 'Current sponsors, tiers, and the rules that keep the course independent.', '/sponsors'],
  developer: ['Developers', 'API and MCP documentation', 'Search, Markdown, OpenAPI, and a hosted MCP server for the curriculum.', '/developer'],
  contact: ['Contact', 'Contact', 'Reach the maintainer and contributors through public project channels.', '/contact'],
  privacy: ['Privacy', 'Privacy', 'How the curriculum website handles data and analytics.', '/privacy'],
  certifications: ['Certifications · {tracks} tracks', 'Certification Preparation', 'Study the systems, practice the decisions, and measure your readiness.', '/certifications'],
  assessment: ['Practice assessment', 'Practice Assessment', 'Timed, original practice with feedback for each exam domain.', '/assessment'],
  projects: ['Projects · {projects} ready', 'Projects', 'Build real AI projects from simple to advanced, graded stage by stage.', '/projects'],
  project: ['Project', 'Build a real AI project', 'A real AI project built stage by stage, with tests for every stage.', '/projects'],
  manuals: ['Manuals · {manuals} published', 'Manuals', 'Long manuals that explain one subject at one exact version.', '/manuals'],
};

let renderer;

/** Build a page card specification with whitespace-normalized text and its display path. */
function card(label, meta, title, description, page) {
  return { label: normalizeWhitespace(label), meta: normalizeWhitespace(meta), title: normalizeWhitespace(title), description: normalizeWhitespace(description), path: page };
}

/** Remove a case-insensitive title prefix from the normalized description. */
function summary(title, description) {
  const value = normalizeWhitespace(description);
  const prefix = `${normalizeWhitespace(title)}: `;
  return value.toLowerCase().startsWith(prefix.toLowerCase()) ? value.slice(prefix.length) : value;
}

/** Build the home card or a known static page card using current inventory counts. */
function pageCard(id, stats) {
  if (id === 'home') {
    return {
      kind: 'home',
      label: 'FIG_000 · The curriculum',
      meta: BRAND,
      title: 'AI Engineering from Scratch',
      description: 'Write the backprop, the tokenizer, the attention mechanism, and the agent loop by hand. Once. Then every paper sits on top of code you already shipped.',
      stats: [`${stats.lessons} lessons`, `${stats.phases} phases`, `${stats.skills} skills`, `${stats.prompts} prompts`],
    };
  }
  /** Substitute inventory counts for named placeholders in page copy. */
  const fill = template => template.replace(/\{(\w+)\}/g, (_, key) => String(stats[key]));
  const [label, title, description, page] = PAGES[id];
  return card(fill(label), BRAND, title, fill(description), page);
}

/**
 * Build a card from a lesson SEO entry and optional translation language.
 * Translated cards retain the entry text and add a translation label and URL parameter.
 */
function lessonCard(entry, lang = 'en') {
  const context = entry.context || {};
  const match = /^phases\/(\d+)-[^/]+\/(\d+)-/.exec(entry.path) || /\/lessons\/(\d+)-/.exec(entry.path) || [];
  const translated = lang !== 'en';
  const certification = context.kind === 'certification';
  const label = certification
    ? `${String(context.programName || 'Certification').replace(/\s+curriculum$/i, '')} · Lesson ${match[1] || ''}`
    : `Lesson ${match.slice(1).join('.')} · ${context.phaseName || 'AI Engineering from Scratch'}`;
  const languages = String(context.languages || '').split(',').map(normalizeWhitespace).filter(value => value && value !== '—').join(', ');
  const meta = translated ? `Translation · ${lang}` : certification ? INDEPENDENT : [context.type, languages].filter(Boolean).join(' · ');
  return card(label, meta, entry.title, summary(entry.title, entry.description), `/lesson?path=${entry.path}${translated ? `&lang=${lang}` : ''}`);
}

/** Build a certification track card with its lesson count and independent preparation label. */
function trackCard(entry) {
  const lessons = Array.isArray(entry.lessons) ? entry.lessons.length : 0;
  return card(`Certification track · ${lessons} lessons`, INDEPENDENT, entry.title, summary(entry.title, entry.description), `/certification?id=${entry.id}`);
}

/** Build a project card from its level, stages, duration, and tagline. */
function projectCard(project) {
  const stages = Array.isArray(project.stages) ? project.stages.length : 0;
  return card(`Project · Level ${project.level} ${LEVEL_NAMES[project.level] || ''}`, `${stages} stages · ${project.hours} hours`, project.title, project.tagline, `/project?id=${project.id}`);
}

/** Build a manual card with its edition and optional pinned version. */
function manualCard(manual) {
  const pin = manual.pin || {};
  return card(`Manual · Edition ${manual.edition}`, pin.version ? `Pinned · ${pin.version}` : '', manual.title, manual.subtitle || manual.summary, `/manual-${manual.id}`);
}

/** Build a glossary card from a term, definition, category, and slug. */
function termCard(term) {
  return card(`Glossary term · ${term.category || 'AI engineering'}`, BRAND, term.term, term.means, `/glossary/${term.slug}`);
}

/** Build a phase card with its number, lesson count, description, and slug. */
function phaseCard(phase) {
  return card(`Phase ${String(phase.id).padStart(2, '0')} · ${phase.lessons} lessons`, BRAND, phase.name, phase.description, `/phase/${phase.slug}`);
}

/**
 * Build the static card lookup keyed by type/id from site inventory models.
 * Optional term and phase collections add their own cards to the lookup.
 */
function socialCards({ stats, projects, manuals, terms = [], phases = [] }) {
  const counts = { ...stats, projects: projects.length, manuals: manuals.length };
  const cards = {};
  for (const id of ['home'].concat(Object.keys(PAGES))) cards[`page/${id}`] = pageCard(id, counts);
  for (const project of projects) cards[`project/${project.id}`] = projectCard(project);
  for (const manual of manuals) cards[`manual/${manual.id}`] = manualCard(manual);
  for (const term of terms) cards[`term/${term.slug}`] = termCard(term);
  for (const phase of phases) cards[`phase/${phase.slug}`] = phaseCard(phase);
  return cards;
}

/** Return a cached SHA-256 digest of the renderer source and sorted font atlases. */
function rendererVersion() {
  if (!renderer) {
    const fonts = path.join(__dirname, 'og-fonts');
    const files = fs.readdirSync(fonts).filter(name => name.endsWith('.json')).sort().map(name => path.join(fonts, name));
    const hash = crypto.createHash('sha256');
    for (const file of [path.join(__dirname, 'og-render.js')].concat(files)) hash.update(fs.readFileSync(file));
    renderer = hash.digest('hex');
  }
  return renderer;
}

/** Hash the renderer and serialized card specification into a 12-character cache version. */
function cardVersion(spec) {
  return crypto.createHash('sha256').update(rendererVersion()).update(JSON.stringify(spec)).digest('hex').slice(0, 12);
}

/** Return a versioned card path, including lang only for non-English cards. */
function cardPath(type, id, spec, lang = 'en') {
  return `/og/${type}/${id}.png?${lang === 'en' ? '' : `lang=${lang}&`}v=${cardVersion(spec)}`;
}

/** Return the absolute production URL for a versioned card. */
function cardUrl(type, id, spec, lang) {
  return ORIGIN + cardPath(type, id, spec, lang);
}

/** Escape ampersands, double quotes, and angle brackets for HTML attributes. */
function escapeAttribute(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Return escaped Open Graph and Twitter image tags for a 1200x630 card. */
function cardTags(url, spec) {
  const image = escapeAttribute(url);
  const alt = escapeAttribute(spec.kind === 'home' ? spec.title : `${spec.title} - AI Engineering from Scratch`);
  return [
    `<meta property="og:image" content="${image}">`,
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    `<meta property="og:image:alt" content="${alt}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:image" content="${image}">`,
    `<meta name="twitter:image:alt" content="${alt}">`,
  ];
}

/**
 * Replace static card image metadata and stamp URLs with current content versions.
 * @throws {Error} If a referenced card is missing from the supplied lookup.
 * @returns {string} HTML containing the complete image tag set and versioned URLs.
 */
function stampCards(html, cards) {
  /** Find a static card by type/id, throwing when the build manifest lacks it. */
  const spec = (type, id) => {
    const found = cards && Object.prototype.hasOwnProperty.call(cards, `${type}/${id}`) ? cards[`${type}/${id}`] : null;
    if (!found) throw new Error(`No social card for ${type}/${id}; run site/build.js first`);
    return found;
  };
  const tagged = html.match(CARD_TAG)
    ? html.replace(COMPANION_TAG, '').replace(CARD_TAG, (match, indent, url, type, id) => cardTags(url, spec(type, id)).map(tag => indent + tag).join('\n'))
    : html;
  return tagged.replace(CARD_URL, (match, url, type, id) => `${url}?v=${cardVersion(spec(type, id))}`);
}

module.exports = {
  ORIGIN,
  PAGES,
  STATIC_TYPES,
  cardPath,
  cardTags,
  cardUrl,
  cardVersion,
  lessonCard,
  pageCard,
  socialCards,
  stampCards,
  trackCard,
};
