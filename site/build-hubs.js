'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { plainMarkdown, truncateText, normalizeWhitespace, wordCount } = require('../lib/lesson-document');
const { phaseSlug, phasePath, phaseLabel, termPath, glossaryLookupKey } = require('../lib/hub-routes');
const { versionHtml } = require('./version-assets');

const ORIGIN = 'https://aiengineeringfromscratch.com';
const REPO_ROOT = path.resolve(__dirname, '..');
const GLOSSARY_SOURCE = 'https://github.com/rohitg00/ai-engineering-from-scratch/blob/main/glossary/terms.md';
const MIN_TERM_WORDS = 35;
const MAX_TITLE_LESSONS = 8;
const CORE_TERMS = 20;
const FONT_LINK = 'https://fonts.googleapis.com/css2?family=VT323&family=Source+Serif+4:ital,opsz,wght@0,8..60,400..700;1,8..60,400..700&family=JetBrains+Mono:wght@400;500;700&display=swap';
const FAVICON = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' fill='%23fafaf5'/><rect x='2' y='2' width='28' height='28' fill='none' stroke='%233553ff' stroke-width='1.2'/><text x='6' y='22' font-size='14' font-family='monospace' fill='%233553ff'>AI</text></svg>";
const THEME_SCRIPT = "(function(){var r=document.documentElement,s='';try{s=localStorage.getItem('theme')||'';}catch(_){}r.setAttribute('data-theme',s||(window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'));function i(){var e=document.getElementById('themeIcon');if(e)e.textContent=r.getAttribute('data-theme')==='light'?'N':'D';}document.addEventListener('DOMContentLoaded',function(){i();var b=document.getElementById('themeToggle');if(b)b.addEventListener('click',function(){var n=r.getAttribute('data-theme')==='light'?'dark':'light';r.setAttribute('data-theme',n);try{localStorage.setItem('theme',n);}catch(_){}i();});});})();";
const GITHUB_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.4 3-.405 1.02.005 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>';
const SITE_HEADER = `<header class="site-header"><div class="header-inner"><a href="/" class="logo"><span class="logo-icon" aria-hidden="true"></span> AI / FROM SCRATCH</a><nav class="header-nav"><a href="/#contents">Contents</a><a href="/catalog">Catalog</a><a href="/prereqs">Roadmap</a><a href="/glossary">Glossary</a><a href="/about">About</a><a href="https://github.com/rohitg00/ai-engineering-from-scratch" target="_blank" rel="noopener" class="header-github">${GITHUB_ICON}<span class="star-count" data-loading="true" aria-label="GitHub stars">…</span></a></nav><button class="theme-toggle" id="themeToggle" aria-label="Toggle theme" type="button"><span class="theme-icon" id="themeIcon">N</span></button></div></header>`;
const HEAD_ASSETS = '<link rel="stylesheet" href="/style.css">\n<link rel="stylesheet" href="/hubs.css">';
const BODY_ASSETS = '<script src="/header.js" defer></script>';
const EXPLORE_LINKS = [
  ['/catalog', 'Course catalog'], ['/prereqs', 'Roadmap'], ['/learning-paths', 'Learning paths'], ['/projects', 'Projects'],
  ['/manuals', 'Manuals'], ['/certifications', 'Certification prep'], ['/glossary', 'Glossary'],
  ['/about', 'About'], ['/developer', 'Developer docs'], ['/sponsors', 'Sponsor us'],
];

const PHASE_HEADLINES = {
  'setup-and-tooling': 'Set Up an AI Development Environment',
  'math-foundations': 'Learn Math for Machine Learning',
  'ml-fundamentals': 'Learn Machine Learning from Scratch',
  'deep-learning-core': 'Learn Deep Learning from Scratch',
  'computer-vision': 'Learn Computer Vision from Scratch',
  'nlp-foundations-to-advanced': 'Learn NLP from Scratch',
  'speech-and-audio': 'Learn Speech and Audio AI from Scratch',
  'transformers-deep-dive': 'Learn Transformers from Scratch',
  'generative-ai': 'Learn Generative AI from Scratch',
  'reinforcement-learning': 'Learn Reinforcement Learning from Scratch',
  'llms-from-scratch': 'Build an LLM from Scratch',
  'llm-engineering': 'Learn LLM Engineering',
  'multimodal-ai': 'Learn Multimodal AI from Scratch',
  'tools-and-protocols': 'Learn Tool Calling and MCP',
  'agent-engineering': 'Build AI Agents from Scratch',
  'autonomous-systems': 'Learn Autonomous AI Systems',
  'multi-agent-and-swarms': 'Learn Multi-Agent Systems',
  'infrastructure-and-production': 'Learn LLM Serving and AI Infrastructure',
  'ethics-safety-alignment': 'Learn AI Ethics, Safety and Alignment',
  'capstone-projects': 'AI Engineering Capstone Projects',
};

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function jsonForHtml(value) {
  return JSON.stringify(value).replace(/&/g, '\\u0026').replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
}

function count(value, singular, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function shortName(term) {
  return term.replace(/\s*\([^)]*\)/g, '').trim();
}

function categoryHref(category) {
  return `/glossary?category=${category.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;
}

function listText(items) {
  if (items.length < 2) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function phaseLinks(phases) {
  return {
    text: listText(phases.map(phase => phase.label)),
    html: listText(phases.map(phase => `<a href="${phase.href}">${escapeHtml(phase.label)}</a>`)),
  };
}

function clipSentences(text, max) {
  const value = normalizeWhitespace(text);
  if (value.length <= max) return value;
  let out = '';
  for (const sentence of value.split(/(?<=[.!?])\s+/)) {
    const next = out ? `${out} ${sentence}` : sentence;
    if (next.length > max) break;
    out = next;
  }
  return out.length >= max * 0.6 ? out : truncateText(value, max);
}

function isPlural(name) {
  const base = shortName(name);
  if (/\s(?:&|and)\s/.test(base)) return true;
  if (/\s(?:of|for)\s/.test(base)) return false;
  return /[a-z]s$/i.test(base) && !/(?:ss|us|is|as)$/i.test(base);
}

function hoursText(minutes) {
  return minutes < 90 ? `about ${minutes} minutes` : `about ${Math.round(minutes / 60)} hours`;
}

function markdownBlocks(markdown) {
  const blocks = [];
  let lines = [];
  let fenced = false;
  const flush = () => {
    if (lines.length) blocks.push(lines.join('\n'));
    lines = [];
  };
  for (const line of String(markdown).split(/\r?\n/)) {
    if (/^\s*```/.test(line)) {
      if (!fenced) flush();
      lines.push(line);
      if (fenced) flush();
      fenced = !fenced;
    } else if (fenced || line.trim()) {
      lines.push(line);
    } else {
      flush();
    }
  }
  flush();
  return blocks;
}

function standaloneText(markdown) {
  return plainMarkdown(markdown).split(/(?<=[.!?])\s+/).filter(sentence => !/\b(?:below|above)\b/i.test(sentence)).join(' ');
}

function phaseGuide(directory, root) {
  const guide = { lede: '', intro: [], prerequisites: '', start: null, command: '', record: '' };
  let markdown;
  try {
    markdown = fs.readFileSync(path.join(root, 'phases', directory, 'README.md'), 'utf8');
  } catch (_) {
    return guide;
  }
  let section = 'intro';
  for (const block of markdownBlocks(markdown)) {
    if (/^#\s/.test(block) || block.startsWith('|')) continue;
    if (/^##\s/.test(block)) {
      section = /start this phase/i.test(block) ? 'start' : 'other';
      continue;
    }
    if (block.startsWith('>')) {
      if (!guide.lede) guide.lede = plainMarkdown(block.replace(/^>\s?/gm, ''));
      continue;
    }
    if (block.startsWith('```')) {
      if (section === 'start' && !guide.command) guide.command = block.replace(/^\s*```[^\n]*\n?/, '').replace(/\n?\s*```\s*$/, '').trim();
      continue;
    }
    const label = /^\*\*([^*]+):\*\*\s*/.exec(block);
    if (section === 'intro') {
      const paragraph = standaloneText(block);
      if (!label && paragraph) guide.intro.push(paragraph);
    } else if (section === 'start' && label && /^prerequisites$/i.test(label[1])) {
      guide.prerequisites = standaloneText(block.slice(label[0].length));
    } else if (section === 'start' && label && !guide.start) {
      const link = /\[([^\]]+)\]\(([^)\s]+)\)/.exec(block);
      if (link && !/^[a-z]+:/i.test(link[2])) {
        guide.start = { label: label[1], path: `phases/${directory}/${link[2].replace(/^\.\//, '').replace(/\/+$/, '')}` };
      }
    } else if (section === 'start' && /^Keep\b/.test(block)) {
      guide.record = plainMarkdown(block);
    }
  }
  return guide;
}

function buildPhaseModels(phases, prerequisites, lessonManifest, minutes, root) {
  const models = [];
  for (const phase of phases) {
    const label = phaseLabel(phase.id, phase.name);
    const lessons = [];
    let directory = '';
    for (const lesson of phase.lessons) {
      const match = /(phases\/([^/]+)\/([^/]+))\/?$/.exec(lesson.url || '');
      const entry = match && lessonManifest.lessons[match[1]];
      if (!entry || !entry.context || entry.context.kind !== 'course') continue;
      directory = match[2];
      lessons.push({
        path: match[1],
        url: entry.canonicalUrl,
        href: entry.canonicalUrl.slice(ORIGIN.length),
        number: (/^(\d+)-/.exec(match[3]) || [])[1] || String(lessons.length + 1).padStart(2, '0'),
        title: entry.title,
        summary: clipSentences(entry.excerpt || lesson.summary || entry.description, 200),
        type: lesson.type || '',
        languages: String(lesson.lang || '').split(',').map(value => value.trim()).filter(value => value && value !== '—'),
        minutes: minutes[match[1]] || 0,
        phaseId: phase.id,
        phaseLabel: label,
      });
    }
    if (!lessons.length) continue;
    const slug = phaseSlug(directory);
    const guide = phaseGuide(directory, root);
    const start = guide.start && lessons.find(lesson => lesson.path === guide.start.path);
    guide.start = start ? { label: guide.start.label, lesson: start } : null;
    const total = lessons.reduce((sum, lesson) => sum + lesson.minutes, 0);
    models.push({
      id: phase.id,
      name: phase.name,
      label,
      number: label.split(':')[0],
      lede: guide.lede || phase.desc || '',
      slug,
      href: phasePath(slug),
      headline: `${PHASE_HEADLINES[slug] || `Learn ${phase.name}`}: ${count(lessons.length, 'Free Lesson')}`,
      lessons,
      minutes: total,
      hours: total ? Math.max(1, Math.round(total / 60)) : 0,
      guide,
      prerequisiteIds: (prerequisites && prerequisites[phase.id]) || [],
      terms: [],
    });
  }
  const byId = new Map(models.map(model => [model.id, model]));
  models.forEach((model, index) => {
    model.before = model.prerequisiteIds.map(id => byId.get(id)).filter(Boolean);
    model.after = models.filter(other => other.prerequisiteIds.includes(model.id));
    model.previous = models[index - 1] || null;
    model.next = models[index + 1] || null;
  });
  return models;
}

function isAcronym(name) {
  return /^[A-Z][A-Za-z0-9]*$/.test(name) && (name.match(/[A-Z]/g) || []).length >= 2;
}

function titlePatterns(term) {
  const names = new Set();
  const inner = (/\(([^)]+)\)/.exec(term.term) || [])[1];
  for (const name of [shortName(term.term), inner, ...term.aliases]) {
    const value = String(name || '').trim();
    if (value && (isAcronym(value) || /\s/.test(value))) names.add(value);
  }
  return [...names].map(name => {
    const source = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    return new RegExp(`(?:^|[^A-Za-z0-9])${source}(?:e?s)?(?![A-Za-z0-9])`, isAcronym(name) ? '' : 'i');
  });
}

function termSkipReason(term) {
  if (!term.whyItMatters && !term.example && !term.confusion) {
    return 'only a definition; no "Why it matters", "In practice" or "Common confusion" field';
  }
  const words = wordCount([term.means, term.whyItMatters, term.example, term.confusion, term.whyCalled].join(' '));
  return words < MIN_TERM_WORDS ? `${words} words of explanation; a page needs at least ${MIN_TERM_WORDS}` : '';
}

function buildTermModels(glossary, phaseModels) {
  const lessons = phaseModels.flatMap(phase => phase.lessons);
  const lessonByPath = new Map(lessons.map(lesson => [lesson.path, lesson]));
  const phaseById = new Map(phaseModels.map(phase => [phase.id, phase]));
  const models = glossary.map(term => {
    const skipReason = termSkipReason(term);
    return {
      term,
      slug: term.slug,
      page: !skipReason,
      skipReason,
      href: skipReason ? `/glossary#${term.slug}` : termPath(term.slug),
      blurb: clipSentences(term.means, 140),
      learn: [],
      titled: [],
      related: [],
      phases: [],
    };
  });
  const byKey = new Map();
  for (const model of models) {
    byKey.set(glossaryLookupKey(model.term.term), model);
    for (const alias of model.term.aliases) byKey.set(glossaryLookupKey(alias), model);
  }
  for (const model of models) {
    for (const link of model.term.lessons) {
      const match = /phases\/[^/?#]+\/[^/?#]+/.exec(link.url);
      const lesson = match && lessonByPath.get(match[0]);
      if (lesson && !model.learn.includes(lesson)) model.learn.push(lesson);
    }
    const patterns = titlePatterns(model.term);
    model.titled = patterns.length
      ? lessons.filter(lesson => !model.learn.includes(lesson) && patterns.some(pattern => pattern.test(lesson.title)))
      : [];
    for (const name of model.term.related) {
      const related = byKey.get(glossaryLookupKey(name));
      if (!related) throw new Error(`Glossary term "${model.term.term}" has an unresolved related term "${name}"`);
      if (related !== model && !model.related.includes(related)) model.related.push(related);
    }
    const phaseIds = [...new Set(model.learn.concat(model.titled).map(lesson => lesson.phaseId))];
    model.phases = phaseIds.map(id => phaseById.get(id)).sort((a, b) => a.id - b.id);
    for (const phase of model.phases) phase.terms.push(model);
  }
  for (const model of models) {
    for (const other of model.related) if (!other.related.includes(model)) other.related.push(model);
  }
  for (const phase of phaseModels) phase.terms.sort((a, b) => a.term.term.localeCompare(b.term.term, 'en'));
  return models;
}

function lessonTermMap(termModels) {
  const map = {};
  for (const model of termModels) {
    for (const lesson of model.learn.concat(model.titled)) {
      (map[lesson.path] = map[lesson.path] || []).push({ term: model.term.term, href: model.href });
    }
  }
  for (const list of Object.values(map)) list.sort((a, b) => a.term.localeCompare(b.term, 'en'));
  return map;
}

function termTitle(term) {
  const suffixes = [];
  if (term.example && term.confusion) suffixes.push('Definition, Examples and Common Confusion');
  if (term.example) suffixes.push('Definition and Examples');
  if (term.confusion) suffixes.push('Definition and Common Confusion');
  suffixes.push('Definition');
  for (const name of [term.term, shortName(term.term)]) {
    for (const suffix of suffixes) {
      const title = `${name}: ${suffix}`;
      if (title.length <= 60) return title;
    }
  }
  return truncateText(`${shortName(term.term)}: Definition`, 60);
}

function termQuestions(term) {
  const plural = isPlural(term.term);
  const questions = [{ id: 'definition', question: `What ${plural ? 'are' : 'is'} ${term.term}?`, answer: term.means }];
  if (term.whyItMatters) questions.push({ id: 'why-it-matters', question: `Why ${plural ? 'do' : 'does'} ${term.term} matter?`, answer: term.whyItMatters });
  if (term.confusion) questions.push({ id: 'common-confusion', question: `What is the common confusion about ${term.term}?`, answer: term.confusion });
  return questions;
}

function faqJsonLd(questions) {
  return {
    '@type': 'FAQPage',
    mainEntity: questions.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

function breadcrumbJsonLd(items) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: ORIGIN + item.href })),
  };
}

function breadcrumbHtml(items) {
  return `<nav class="hub-breadcrumb" aria-label="Breadcrumb"><ol>${items.map((item, index) => index === items.length - 1
    ? `<li><span aria-current="page">${escapeHtml(item.name)}</span></li>`
    : `<li><a href="${escapeHtml(item.href)}">${escapeHtml(item.name)}</a></li>`).join('')}</ol></nav>`;
}

function coreTerms(termModels) {
  const degree = model => model.related.length * 2 + model.learn.length + model.titled.length;
  return termModels.filter(model => model.page)
    .sort((a, b) => degree(b) - degree(a) || a.term.term.localeCompare(b.term.term, 'en'))
    .slice(0, CORE_TERMS)
    .sort((a, b) => a.term.term.localeCompare(b.term.term, 'en'));
}

function siteFooter(phaseModels, termModels, categories) {
  const column = (title, links) => `<nav class="hub-footer-column" aria-label="${escapeHtml(title)}"><p class="hub-label">${escapeHtml(title)}</p>`
    + `<ul>${links.map(([href, label]) => `<li><a href="${escapeHtml(href)}">${escapeHtml(label)}</a></li>`).join('')}</ul></nav>`;
  return '<footer class="site-footer hub-footer"><div class="container"><div class="hub-footer-grid">'
    + column('Course phases', phaseModels.map(phase => [phase.href, phase.label]))
    + column('Core glossary terms', coreTerms(termModels).map(model => [model.href, model.term.term]))
    + column('Glossary by learning area', categories.map(category => [categoryHref(category), category]))
    + column('Explore', EXPLORE_LINKS)
    + '</div><div class="footer-inner"><p>AI Engineering from Scratch · open source · free forever.</p>'
    + '<div class="footer-links"><a href="https://github.com/rohitg00/ai-engineering-from-scratch" target="_blank" rel="noopener">GitHub</a></div></div></div></footer>';
}

function pagerHtml(label, previous, next) {
  const links = [
    previous && `<a href="${escapeHtml(previous.href)}" rel="prev">← ${escapeHtml(previous.text)}</a>`,
    next && `<a href="${escapeHtml(next.href)}" rel="next">${escapeHtml(next.text)} →</a>`,
  ].filter(Boolean).join('');
  return links ? `<nav class="hub-pager" aria-label="${escapeHtml(label)}">${links}</nav>` : '';
}

function lessonItemHtml(lesson, withPhase) {
  const meta = withPhase
    ? [lesson.phaseLabel]
    : [lesson.type, lesson.languages.join(', '), lesson.minutes ? `~${lesson.minutes} min` : ''].filter(Boolean);
  return `<li>${withPhase ? '' : `<span class="hub-num" aria-hidden="true">${escapeHtml(lesson.number)}</span>`}<div><a href="${lesson.href}">${escapeHtml(lesson.title)}</a>`
    + `${lesson.summary ? `<p>${escapeHtml(lesson.summary)}</p>` : ''}<p class="hub-meta">${escapeHtml(meta.join(' · '))}</p></div></li>`;
}

function termItemHtml(model) {
  return `<li><a href="${escapeHtml(model.href)}">${escapeHtml(model.term.term)}</a><span>${escapeHtml(model.blurb)}</span></li>`;
}

function pageShell({ title, description, href, ogType, jsonLd, main }, context) {
  const canonical = ORIGIN + href;
  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<base href="/">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="${ORIGIN}/og-image.png?v=4">
<meta property="og:url" content="${canonical}">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="AI Engineering from Scratch">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${ORIGIN}/og-image.png?v=4">
<link rel="icon" href="${FAVICON}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${FONT_LINK}" rel="stylesheet">
${context.headAssets}
<script>${THEME_SCRIPT}</script>
<script type="application/ld+json">${jsonForHtml({ '@context': 'https://schema.org', '@graph': jsonLd })}</script>
</head>
<body>
<a href="${href}#main" class="skip-link">Skip to content</a>
${SITE_HEADER}
${main}
${context.footer}
${context.bodyAssets}
<script defer src="https://va.vercel-scripts.com/v1/script.js"></script>
</body>
</html>
`;
}

function termPage(model, context) {
  const { term } = model;
  const href = termPath(model.slug);
  const canonical = ORIGIN + href;
  const crumbs = [{ name: 'Home', href: '/' }, { name: 'Glossary', href: '/glossary' }, { name: term.term, href }];
  const questions = termQuestions(term);
  const answer = id => questions.find(item => item.id === id);
  const neighbor = offset => {
    const other = context.alphabetical[context.alphabetical.indexOf(model) + offset];
    return other && { href: other.href, text: other.term.term };
  };
  const sections = [];
  const section = (id, heading, body) => sections.push(`<section class="hub-section" aria-labelledby="${id}"><h2 id="${id}">${escapeHtml(heading)}</h2>${body}</section>`);
  if (answer('why-it-matters')) section('why-it-matters', answer('why-it-matters').question, `<p>${escapeHtml(term.whyItMatters)}</p>`);
  if (term.example) section('in-practice', `${term.term} in practice`, `<p>${escapeHtml(term.example)}</p>`);
  if (answer('common-confusion')) section('common-confusion', answer('common-confusion').question, `<p>${escapeHtml(term.confusion)}</p>`);
  if (term.whyCalled) section('name', `Why is it called ${term.term}?`, `<p>${escapeHtml(term.whyCalled)}</p>`);

  const learn = [];
  if (model.learn.length) learn.push(`<p class="hub-label">Start with</p><ul class="hub-lessons">${model.learn.map(lesson => lessonItemHtml(lesson, true)).join('')}</ul>`);
  if (model.titled.length) {
    learn.push(`<p class="hub-label">Lessons with ${escapeHtml(term.term)} in the title</p><ul class="hub-lessons">${model.titled.slice(0, MAX_TITLE_LESSONS).map(lesson => lessonItemHtml(lesson, true)).join('')}</ul>`);
  }
  if (model.phases.length) {
    learn.push(`<p>Taught in ${phaseLinks(model.phases).html}.</p>`);
  } else {
    learn.push(`<p>No lesson links to this term yet. Search the <a href="/catalog?q=${encodeURIComponent(shortName(term.term))}">course catalog</a> for it.</p>`);
  }
  section('learn', `Learn ${term.term} in the course`, learn.join(''));
  if (model.related.length) section('related', 'Related terms', `<ul class="hub-terms">${model.related.map(termItemHtml).join('')}</ul>`);
  if (term.sources.length) {
    section('sources', 'Sources', `<ul class="hub-sources">${term.sources.map(source => `<li><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener">${escapeHtml(source.label)}</a></li>`).join('')}</ul>`);
  }
  const peers = context.termModels.filter(other => other !== model && other.term.category === term.category);
  if (peers.length) {
    section('category', `More terms in ${term.category}`, `<ul class="hub-columns">${peers.map(peer => `<li><a href="${escapeHtml(peer.href)}">${escapeHtml(peer.term.term)}</a></li>`).join('')}</ul><p><a href="${categoryHref(term.category)}">Open the ${escapeHtml(term.category)} list in the glossary</a></p>`);
  }

  const main = `<main id="main" class="hub-page"><div class="container hub-wrap">${breadcrumbHtml(crumbs)}`
    + `<header class="hub-hero"><p class="hub-kicker"><a href="${categoryHref(term.category)}">${escapeHtml(term.category)}</a> · Glossary term</p>`
    + `<h1>${escapeHtml(questions[0].question)}</h1><p class="hub-lede">${escapeHtml(term.means)}</p>`
    + `${term.aliases.length ? `<p class="hub-aliases">Also called ${escapeHtml(listText(term.aliases))}.</p>` : ''}`
    + `${term.says ? `<figure class="hub-says"><figcaption>What people say</figcaption><blockquote><p>“${escapeHtml(term.says)}”</p></blockquote></figure>` : ''}</header>`
    + sections.join('')
    + pagerHtml('Previous and next glossary term', neighbor(-1), neighbor(1))
    + `<p class="hub-source">This entry comes from <a href="${GLOSSARY_SOURCE}" target="_blank" rel="noopener">glossary/terms.md</a> on GitHub. <a href="/glossary">Browse all ${context.termModels.length} glossary terms</a>.</p>`
    + '</div></main>';

  return pageShell({
    title: termTitle(term),
    description: clipSentences(term.means, 160),
    href,
    ogType: 'article',
    jsonLd: [
      {
        '@type': 'DefinedTerm',
        '@id': `${canonical}#term`,
        name: term.term,
        ...(term.aliases.length ? { alternateName: term.aliases } : {}),
        description: term.means,
        url: canonical,
        inDefinedTermSet: { '@type': 'DefinedTermSet', '@id': `${ORIGIN}/glossary#terms`, name: 'AI Engineering Glossary', url: `${ORIGIN}/glossary` },
      },
      breadcrumbJsonLd(crumbs),
      faqJsonLd(questions),
    ],
    main,
  }, context);
}

function phaseFacts(phase) {
  const types = new Map();
  const languages = new Map();
  for (const lesson of phase.lessons) {
    if (lesson.type) types.set(lesson.type, (types.get(lesson.type) || 0) + 1);
    for (const language of lesson.languages) languages.set(language, (languages.get(language) || 0) + 1);
  }
  return {
    types: [...types].sort((a, b) => b[1] - a[1]),
    languages: [...languages].sort((a, b) => b[1] - a[1]).map(([language]) => language),
  };
}

function phaseQuestions(phase, facts) {
  const total = phase.lessons.length;
  let typeText = '';
  if (facts.types.length === 1) typeText = `, all ${facts.types[0][0]} lessons`;
  else if (facts.types.length > 1) typeText = `: ${listText(facts.types.map(([type, value]) => count(value, `${type} lesson`)))}`;
  const languageText = facts.languages.length ? ` The lesson code uses ${listText(facts.languages.slice(0, 4))}.` : '';
  const plain = text => ({ answer: text, html: escapeHtml(text) });
  const questions = [{ question: `How many lessons are in ${phase.label}?`, ...plain(`${phase.number} has ${count(total, 'lesson')}${typeText}.${languageText}`) }];
  let prerequisites = plain(phase.guide.prerequisites || 'No earlier phase is required. Start with the first lesson.');
  if (phase.before.length) {
    const lead = phase.guide.prerequisites ? `${phase.guide.prerequisites} ` : '';
    const before = phaseLinks(phase.before);
    prerequisites = {
      answer: `${lead}In the course roadmap, this phase builds on ${before.text}.`,
      html: `${escapeHtml(lead)}In the course roadmap, this phase builds on ${before.html}.`,
    };
  }
  questions.push({ question: `What should I know before I start ${phase.number}?`, ...prerequisites });
  questions.push({ question: `Is ${phase.number} free?`, ...plain(`Yes. All ${count(total, 'lesson')} are free to read on this site, and you do not need an account. The lesson code is open source under the MIT license.`) });
  if (phase.minutes) {
    questions.push({ question: `How long does ${phase.number} take?`, ...plain(`The time estimates of all ${count(total, 'lesson')} add up to ${hoursText(phase.minutes)}.`) });
  }
  if (phase.after.length) {
    const after = phaseLinks(phase.after);
    const verb = phase.after.length === 1 ? 'builds' : 'build';
    questions.push({ question: `What comes after ${phase.number}?`, answer: `${after.text} ${verb} on this phase.`, html: `${after.html} ${verb} on this phase.` });
  }
  return questions;
}

function phaseDescription(phase) {
  const lessons = count(phase.lessons.length, 'free lesson');
  const first = phase.lessons[0].title;
  const last = phase.lessons[phase.lessons.length - 1].title;
  const candidates = [`${phase.lede} ${lessons}, from ${first} to ${last}.`, `${phase.lede} ${lessons}, starting with ${first}.`, `${phase.lede} ${lessons}.`];
  return candidates.find(candidate => candidate.length <= 160) || clipSentences(phase.lede, 160);
}

function phasePage(phase, context) {
  const canonical = ORIGIN + phase.href;
  const crumbs = [{ name: 'Home', href: '/' }, { name: 'Course catalog', href: '/catalog' }, { name: phase.label, href: phase.href }];
  const facts = phaseFacts(phase);
  const questions = phaseQuestions(phase, facts);
  const description = phaseDescription(phase);
  const stats = [`<li><strong>${phase.lessons.length}</strong> lessons</li>`]
    .concat(facts.types.length > 1 ? facts.types.map(([type, total]) => `<li><strong>${total}</strong> ${escapeHtml(type.toLowerCase())}</li>`) : [])
    .concat(phase.hours ? [`<li><strong>~${phase.hours}</strong> hours</li>`] : [])
    .concat(facts.languages.length ? [`<li>${escapeHtml(facts.languages.slice(0, 4).join(', '))}</li>`] : []);
  const { start, command, record, intro } = phase.guide;
  const startHtml = start
    ? `<section class="hub-section" aria-labelledby="start"><h2 id="start">Start ${phase.number}</h2><p><span class="hub-label">${escapeHtml(start.label)}</span> <a href="${start.lesson.href}">${escapeHtml(start.lesson.title)}</a></p>`
      + `${command ? `<p>Run this command from the repository root:</p><pre class="hub-code"><code>${escapeHtml(command)}</code></pre>` : ''}`
      + `${record ? `<p>${escapeHtml(record)}</p>` : ''}</section>`
    : '';
  const termsHtml = phase.terms.length
    ? `<section class="hub-section" aria-labelledby="terms"><h2 id="terms">Glossary terms in this phase</h2><ul class="hub-terms">${phase.terms.map(termItemHtml).join('')}</ul></section>`
    : '';
  const neighbor = other => other && { href: other.href, text: other.label };

  const main = `<main id="main" class="hub-page"><div class="container hub-wrap">${breadcrumbHtml(crumbs)}`
    + `<header class="hub-hero"><p class="hub-kicker">${escapeHtml(phase.number)} · ${escapeHtml(phase.name)}</p><h1>${escapeHtml(phase.headline)}</h1>`
    + `<p class="hub-lede">${escapeHtml(phase.lede)}</p><ul class="hub-stats">${stats.join('')}</ul>`
    + `${intro.map(paragraph => `<p>${escapeHtml(paragraph)}</p>`).join('')}</header>`
    + startHtml
    + `<section class="hub-section" aria-labelledby="lessons"><h2 id="lessons">All ${count(phase.lessons.length, 'lesson')} in ${escapeHtml(phase.number)}</h2><ol class="hub-lessons">${phase.lessons.map(lesson => lessonItemHtml(lesson, false)).join('')}</ol></section>`
    + termsHtml
    + `<section class="hub-section hub-faq" aria-labelledby="faq"><h2 id="faq">Frequently asked questions</h2>${questions.map(item => `<h3>${escapeHtml(item.question)}</h3><p>${item.html}</p>`).join('')}</section>`
    + pagerHtml('Previous and next phase', neighbor(phase.previous), neighbor(phase.next))
    + '</div></main>';

  return pageShell({
    title: phase.headline,
    description,
    href: phase.href,
    ogType: 'website',
    jsonLd: [
      {
        '@type': 'Course',
        '@id': `${canonical}#course`,
        name: phase.label,
        description,
        url: canonical,
        inLanguage: 'en',
        isAccessibleForFree: true,
        ...(phase.hours ? { timeRequired: `PT${phase.hours}H` } : {}),
        ...(phase.before.length ? { coursePrerequisites: phase.before.map(other => ({ '@type': 'Course', name: other.label, url: ORIGIN + other.href })) } : {}),
        isPartOf: { '@type': 'Course', name: 'AI Engineering from Scratch', url: ORIGIN },
        hasPart: phase.lessons.map(lesson => ({ '@type': 'LearningResource', name: lesson.title, url: lesson.url })),
      },
      breadcrumbJsonLd(crumbs),
      faqJsonLd(questions),
    ],
    main,
  }, context);
}

function termMarkdown(model) {
  const { term } = model;
  const questions = termQuestions(term);
  const lines = [`# ${questions[0].question}`, '', `Canonical page: ${ORIGIN}${termPath(model.slug)}`, `Category: ${term.category}`];
  if (term.aliases.length) lines.push(`Also called: ${term.aliases.join(', ')}`);
  lines.push('', term.means);
  if (term.says) lines.push('', `What people say: "${term.says}"`);
  for (const item of questions.slice(1)) lines.push('', `## ${item.question}`, '', item.answer);
  if (term.example) lines.push('', `## ${term.term} in practice`, '', term.example);
  if (term.whyCalled) lines.push('', `## Why is it called ${term.term}?`, '', term.whyCalled);
  const lessons = model.learn.concat(model.titled.slice(0, MAX_TITLE_LESSONS));
  if (lessons.length) {
    lines.push('', '## Lessons', '');
    for (const lesson of lessons) lines.push(`- [${lesson.title}](${lesson.url}) (${lesson.phaseLabel})`);
  }
  if (model.related.length) {
    lines.push('', '## Related terms', '');
    for (const related of model.related) lines.push(`- [${related.term.term}](${ORIGIN}${related.href})`);
  }
  if (term.sources.length) {
    lines.push('', '## Sources', '');
    for (const source of term.sources) lines.push(`- [${source.label}](${source.url})`);
  }
  lines.push('', `[Glossary](${ORIGIN}/glossary) | [Curriculum index](${ORIGIN}/llms.txt)`, '');
  return lines.join('\n');
}

function phaseMarkdown(phase) {
  const lines = [`# ${phase.headline}`, '', `Canonical page: ${ORIGIN}${phase.href}`, '', phase.lede];
  for (const paragraph of phase.guide.intro) lines.push('', paragraph);
  lines.push('', `## Lessons in ${phase.label}`, '');
  for (const lesson of phase.lessons) {
    const meta = [lesson.type, lesson.languages.join(', '), lesson.minutes ? `~${lesson.minutes} min` : ''].filter(Boolean).join(', ');
    lines.push(`${lesson.number}. [${lesson.title}](${lesson.url})${lesson.summary ? `: ${lesson.summary}` : ''}${meta ? ` (${meta})` : ''}`);
  }
  if (phase.guide.command) lines.push('', '## Start', '', 'Run this command from the repository root:', '', '```bash', phase.guide.command, '```');
  if (phase.terms.length) {
    lines.push('', '## Glossary terms in this phase', '');
    for (const model of phase.terms) lines.push(`- [${model.term.term}](${ORIGIN}${model.href})`);
  }
  lines.push('', '## Frequently asked questions');
  for (const item of phaseQuestions(phase, phaseFacts(phase))) lines.push('', `### ${item.question}`, '', item.answer);
  lines.push('', `[Course catalog](${ORIGIN}/catalog) | [Curriculum index](${ORIGIN}/llms.txt)`, '');
  return lines.join('\n');
}

function glossaryJsonLd(termModels) {
  return {
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    '@id': `${ORIGIN}/glossary#terms`,
    name: 'AI Engineering Glossary',
    url: `${ORIGIN}/glossary`,
    inLanguage: 'en',
    hasDefinedTerm: termModels.map(model => ({ '@type': 'DefinedTerm', name: model.term.term, url: ORIGIN + model.href })),
  };
}

function glossaryIndexHtml(termModels, categories) {
  const groups = categories.map(category => {
    const members = termModels.filter(model => model.term.category === category)
      .sort((a, b) => a.term.term.localeCompare(b.term.term, 'en'));
    if (!members.length) return '';
    const links = members.map(model => (model.page
      ? `<li><a href="glossary/${model.slug}" data-term-page="${model.slug}">${escapeHtml(model.term.term)}</a></li>`
      : `<li><a href="#${model.slug}">${escapeHtml(model.term.term)}</a></li>`)).join('');
    return `            <section aria-label="${escapeHtml(category)}"><h3>${escapeHtml(category)}</h3><ul>${links}</ul></section>`;
  }).filter(Boolean);
  const pages = termModels.filter(model => model.page).length;
  return `          <section class="glossary-index" aria-labelledby="glossaryIndexTitle" data-generated-discovery="glossary">\n`
    + `            <h2 id="glossaryIndexTitle">All ${termModels.length} terms by learning area</h2>\n`
    + `            <p>${pages} terms have their own page with the definition, why it matters, common confusion and course links.</p>\n`
    + `            <div class="glossary-index-groups">\n${groups.join('\n')}\n            </div>\n`
    + '          </section>';
}

function writeFiles(directory, files, extension) {
  fs.mkdirSync(directory, { recursive: true });
  const keep = new Set(files.map(file => file.name + extension));
  for (const name of fs.readdirSync(directory)) {
    if (name.endsWith(extension) && !keep.has(name)) fs.unlinkSync(path.join(directory, name));
  }
  for (const file of files) fs.writeFileSync(path.join(directory, file.name + extension), file.body, 'utf8');
}

function buildHubs({ phases, prerequisites, glossary, categories, lessonManifest, minutes = {}, root = REPO_ROOT, siteDir = __dirname }) {
  const phaseModels = buildPhaseModels(phases, prerequisites, lessonManifest, minutes, root);
  const termModels = buildTermModels(glossary, phaseModels);
  const context = {
    phaseModels,
    termModels,
    alphabetical: termModels.slice().sort((a, b) => a.term.term.localeCompare(b.term.term, 'en')),
    footer: siteFooter(phaseModels, termModels, categories),
    headAssets: versionHtml(HEAD_ASSETS, siteDir),
    bodyAssets: versionHtml(BODY_ASSETS, siteDir),
  };
  const pages = termModels.filter(model => model.page);
  return {
    phaseModels,
    termModels,
    termPages: pages.map(model => ({ name: model.slug, href: model.href, html: termPage(model, context), markdown: termMarkdown(model) })),
    phasePages: phaseModels.map(phase => ({ name: phase.slug, href: phase.href, html: phasePage(phase, context), markdown: phaseMarkdown(phase) })),
    lessonTerms: lessonTermMap(termModels),
    glossaryJsonLd: `  <script type="application/ld+json">${jsonForHtml(glossaryJsonLd(termModels))}</script>`,
    glossaryIndex: glossaryIndexHtml(termModels, categories),
    skipped: termModels.filter(model => !model.page).map(model => ({ term: model.term.term, reason: model.skipReason })),
  };
}

function writeHubs(options, siteDir = __dirname) {
  const hubs = buildHubs({ ...options, siteDir });
  for (const [kind, list] of [['glossary', hubs.termPages], ['phase', hubs.phasePages]]) {
    writeFiles(path.join(siteDir, 'hubs', kind), list.map(page => ({ name: page.name, body: page.html })), '.html');
    writeFiles(path.join(siteDir, 'agent-pages', kind), list.map(page => ({ name: page.name, body: page.markdown })), '.md');
  }
  fs.writeFileSync(path.join(siteDir, 'lesson-terms.json'), JSON.stringify({ lessons: hubs.lessonTerms }) + '\n', 'utf8');
  console.log(`   wrote ${hubs.termPages.length} glossary term pages (${hubs.skipped.length} short entries stay on /glossary) and ${hubs.phasePages.length} phase hubs`);
  return hubs;
}

module.exports = { buildHubs, writeHubs };
