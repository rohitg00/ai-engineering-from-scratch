const fs = require('fs');
const path = require('path');
const { parseMd } = require('../site/lesson-markdown');
const { representation } = require('../lib/agent-http');
const { lessonDocumentSeo, seoTitleFor } = require('../lib/lesson-document');
const { readTranslation: readTranslationFromSource, TRANSLATION_LANGUAGES, isIndexedLanguage, translationsOf, lessonUrl, NATIVE_NAMES, RTL_LANGUAGES, OG_LOCALES } = require('../lib/lesson-translations');

const REPO_ROOT = path.join(__dirname, '..');
const ORIGIN = 'https://aiengineeringfromscratch.com';
const SEO_START = '<!-- AIFS:LESSON-SEO:START -->';
const SEO_END = '<!-- AIFS:LESSON-SEO:END -->';
const FALLBACK_START = '<!-- AIFS:LESSON-FALLBACK:START -->';
const FALLBACK_END = '<!-- AIFS:LESSON-FALLBACK:END -->';
const LESSON_QUERY_NAMES = new Set(['path', 'track', 'fromTrack', 'learningPath', 'lang', 'ttsTest', 'legacy']);
const LEARNING_PATH_ALIASES = Object.freeze({
  'mcp-engineering': 'model-context-protocol',
});
const PAGE_CACHE = 'public, max-age=0, s-maxage=86400, must-revalidate';
const TRANSLATED_CACHE = 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800';
const RETRY_CACHE = 'public, max-age=0, s-maxage=300, must-revalidate';

let productionAssets;

function loadProductionAssets() {
  if (!productionAssets) {
    const manifest = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'site', 'lesson-seo.json'), 'utf8'));
    productionAssets = {
      template: fs.readFileSync(path.join(REPO_ROOT, 'site', 'lesson.html'), 'utf8'),
      manifest,
      readMarkdown: function (lessonPath) {
        return fs.readFileSync(path.join(REPO_ROOT, lessonPath, 'docs', 'en.md'), 'utf8');
      },
      languageCodes: ['en'].concat(TRANSLATION_LANGUAGES),
    };
  }
  return productionAssets;
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function jsonForHtml(value) {
  return JSON.stringify(value)
    .replace(/&/g, '\\u0026')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e');
}

function queryValue(req, name) {
  const direct = req.query && req.query[name];
  if (Array.isArray(direct)) return '';
  if (typeof direct === 'string') return direct;
  try {
    return new URL(req.url || '/', 'http://localhost').searchParams.get(name) || '';
  } catch (_) {
    return '';
  }
}

function queryNames(req) {
  const names = new Set();
  if (req.query && typeof req.query === 'object') {
    Object.keys(req.query).forEach(function (name) { names.add(name); });
  }
  try {
    new URL(req.url || '/', 'http://localhost').searchParams.forEach(function (_, name) {
      names.add(name);
    });
  } catch (_) {}
  return names;
}

function rawUrlQuery(req) {
  const requestUrl = typeof req.url === 'string' ? req.url : '';
  const queryIndex = requestUrl.indexOf('?');
  if (queryIndex < 0) return null;
  const fragmentIndex = requestUrl.indexOf('#', queryIndex);
  return requestUrl.slice(queryIndex + 1, fragmentIndex < 0 ? undefined : fragmentIndex);
}

function isLocalRequest(req) {
  const headers = req && req.headers && typeof req.headers === 'object' ? req.headers : {};
  const forwardedHost = String(headers['x-forwarded-host'] || '').split(',')[0].trim();
  const host = forwardedHost || String(headers.host || '').trim();
  try {
    const hostname = new URL(`http://${host || 'invalid'}`).hostname;
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch (_) {
    return false;
  }
}

function hasQuery(req, name) {
  return queryNames(req).has(name);
}

function validLessonPath(value) {
  if (!value || value.includes('..') || value.includes('\\') || value.includes('\0')) return false;
  return /^(?:phases\/[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*|certifications\/[a-z0-9][a-z0-9-]*\/lessons\/[a-z0-9][a-z0-9-]*)$/.test(value);
}

function validTrackId(value) {
  return /^[a-z0-9][a-z0-9-]*$/.test(value || '');
}

function validLanguageCode(value) {
  return /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(value || '');
}

function listedValue(values, value) {
  return Array.isArray(values) && values.includes(value);
}

function replaceMarkedRegion(template, start, end, content) {
  const startIndex = template.indexOf(start);
  const endIndex = template.indexOf(end);
  if (
    startIndex < 0 ||
    endIndex < startIndex ||
    template.indexOf(start, startIndex + start.length) >= 0 ||
    template.indexOf(end, endIndex + end.length) >= 0
  ) {
    throw new Error('template-markers');
  }
  const bodyStart = startIndex + start.length;
  return `${template.slice(0, bodyStart)}\n${content}\n  ${template.slice(endIndex)}`;
}

function contextLabel(context) {
  if (!context || typeof context !== 'object') return 'AI Engineering from Scratch';
  if (context.kind === 'course' && context.phaseName) {
    const phase = context.phaseId == null ? '' : `Phase ${String(context.phaseId).padStart(2, '0')}: `;
    return `${phase}${context.phaseName}`;
  }
  if (context.kind === 'certification') return context.programName || 'Independent certification preparation';
  return 'AI Engineering from Scratch';
}

function lessonHeading(entry, manifest) {
  const lessons = manifest && manifest.lessons && typeof manifest.lessons === 'object'
    ? Object.values(manifest.lessons)
    : [];
  const matchingTitles = lessons.filter(function (candidate) {
    return candidate && candidate.title === entry.title;
  });
  if (matchingTitles.length < 2) return entry.title;

  const label = contextLabel(entry.context).replace(/^Phase \d+: /, '');
  const sameLabelCount = matchingTitles.filter(function (candidate) {
    return contextLabel(candidate.context).replace(/^Phase \d+: /, '') === label;
  }).length;
  if (sameLabelCount === 1) return `${entry.title} - ${label}`;

  const seoHeading = String(entry.seoTitle || '').replace(/ - AI Engineering from Scratch$/, '');
  if (seoHeading && seoHeading !== entry.title) return seoHeading;
  return `${entry.title} - ${entry.path}`;
}

function lessonReference(ref) {
  if (!ref || typeof ref !== 'object' || !validLessonPath(ref.path)) return null;
  return {
    path: ref.path,
    title: String(ref.title || ref.path.split('/').pop().replace(/^\d+-/, '').replace(/-/g, ' ')),
  };
}

function lessonAlternates(entry, lessonPath) {
  if (!entry.context || entry.context.kind !== 'course') return [];
  const english = lessonUrl(lessonPath);
  return [{ lang: 'en', href: english }, { lang: 'x-default', href: english }]
    .concat(translationsOf(entry).filter(isIndexedLanguage).map(lang => ({ lang, href: lessonUrl(lessonPath, lang) })));
}

function pageInfo(entry, lessonPath, heading, lang, markdown) {
  const alternates = lessonAlternates(entry, lessonPath);
  if (lang === 'en') {
    return {
      lang,
      heading,
      title: entry.seoTitle || `${entry.title} - AI Engineering from Scratch`,
      description: entry.description || entry.excerpt || 'A lesson from the AI Engineering from Scratch curriculum.',
      canonical: lessonUrl(lessonPath),
      alternates,
    };
  }
  const document = lessonDocumentSeo(markdown, entry.title);
  const translatedHeading = document.title + (heading.startsWith(entry.title) ? heading.slice(entry.title.length) : '');
  return {
    lang,
    heading: translatedHeading,
    title: seoTitleFor(translatedHeading),
    description: document.description,
    canonical: lessonUrl(lessonPath, lang),
    original: lessonUrl(lessonPath),
    alternates,
  };
}

function lessonHead(entry, page) {
  const { canonical, title, description, heading } = page;
  const courseName = contextLabel(entry.context);
  const breadcrumbParent = entry.context && entry.context.kind === 'certification'
    ? { name: 'Certifications', url: `${ORIGIN}/certifications.html` }
    : { name: 'Course catalog', url: `${ORIGIN}/catalog.html` };
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'LearningResource',
        name: heading,
        headline: heading,
        description,
        url: canonical,
        mainEntityOfPage: canonical,
        inLanguage: page.lang,
        ...(page.original ? { translationOfWork: { '@type': 'LearningResource', url: page.original } } : {}),
        isAccessibleForFree: true,
        isPartOf: {
          '@type': 'Course',
          name: courseName,
          url: entry.context && entry.context.kind === 'certification'
            ? `${ORIGIN}/certifications.html`
            : ORIGIN,
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: ORIGIN },
          { '@type': 'ListItem', position: 2, name: breadcrumbParent.name, item: breadcrumbParent.url },
          { '@type': 'ListItem', position: 3, name: heading, item: canonical },
        ],
      },
    ],
  };

  return [
    `  <title>${escapeHtml(title)}</title>`,
    `  <meta name="description" content="${escapeHtml(description)}">`,
    `  <link rel="canonical" href="${escapeHtml(canonical)}">`,
    page.lang !== 'en' && !isIndexedLanguage(page.lang) ? '  <meta name="robots" content="noindex">' : '',
    `  <meta property="og:title" content="${escapeHtml(title)}">`,
    `  <meta property="og:description" content="${escapeHtml(description)}">`,
    `  <meta property="og:image" content="${ORIGIN}/og-image.png?v=4">`,
    `  <meta property="og:url" content="${escapeHtml(canonical)}">`,
    OG_LOCALES[page.lang] ? `  <meta property="og:locale" content="${escapeHtml(OG_LOCALES[page.lang])}">` : '',
    '  <meta property="og:type" content="article">',
    '  <meta name="twitter:card" content="summary_large_image">',
    `  <meta name="twitter:title" content="${escapeHtml(title)}">`,
    `  <meta name="twitter:description" content="${escapeHtml(description)}">`,
    `  <meta name="twitter:image" content="${ORIGIN}/og-image.png?v=4">`,
    `  <script type="application/ld+json" id="lessonJsonLd">${jsonForHtml(jsonLd)}</script>`,
  ].concat(page.alternates.map(alternate => `  <link rel="alternate" hreflang="${escapeHtml(alternate.lang)}" href="${escapeHtml(alternate.href)}">`)).filter(Boolean).join('\n');
}

function lessonHref(ref, contextParams) {
  const params = new URLSearchParams();
  params.set('path', ref.path);
  for (const name of ['track', 'fromTrack', 'learningPath', 'lang']) {
    if (contextParams && contextParams[name]) params.set(name, contextParams[name]);
  }
  return `/lesson?${params.toString().replace(/&/g, '&amp;')}`;
}

function readEnglishMarkdown(assets, lessonPath) {
  if (typeof assets.readMarkdown !== 'function') return null;
  try {
    const markdown = assets.readMarkdown(lessonPath);
    return markdown.trim() ? markdown : null;
  } catch (_) {
    return null;
  }
}

function renderBody(markdown, heading) {
  if (!markdown) return null;
  return { markdown, html: `<h1>${escapeHtml(heading)}</h1>` + parseMd(markdown).replace(/<h1 id="[^"]*">[\s\S]*?<\/h1>/, '') };
}

function languageLinks(page, lessonPath, contextParams) {
  const languages = page.alternates.map(alternate => alternate.lang).filter(lang => lang !== 'x-default');
  if (languages.length < 2) return '';
  return `          <nav class="lesson-languages" aria-label="Read this lesson in another language">${languages.map(lang => {
    const href = lessonHref({ path: lessonPath }, Object.assign({}, contextParams, { lang: lang === 'en' ? '' : lang }));
    const current = lang === page.lang ? ' aria-current="page"' : '';
    return `<a href="${href}" hreflang="${escapeHtml(lang)}" lang="${escapeHtml(lang)}"${current}>${escapeHtml(NATIVE_NAMES[lang] || lang)}</a>`;
  }).join(' ')}</nav>`;
}

function lessonFallback(entry, lessonPath, contextParams, page, body) {
  const heading = page.heading;
  const trackId = contextParams && contextParams.track;
  const trackNavigation = trackId && entry.navigationByTrack && entry.navigationByTrack[trackId];
  const navigation = trackNavigation || entry;
  const previous = lessonReference(navigation.previous);
  const next = lessonReference(navigation.next);
  const context = contextLabel(entry.context);
  const sourceUrl = typeof entry.sourceUrl === 'string' && /^https:\/\/github\.com\/[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+\/(?:tree|blob)\/[^/?#]+\//.test(entry.sourceUrl)
    ? entry.sourceUrl
    : '';
  const links = [];
  if (previous) links.push(`<a class="lesson-nav-btn prev" href="${lessonHref(previous, contextParams)}"><span class="nav-label">&larr; Previous</span><span class="nav-title">${escapeHtml(previous.title)}</span></a>`);
  if (next) links.push(`<a class="lesson-nav-btn next" href="${lessonHref(next, contextParams)}"><span class="nav-label">Next &rarr;</span><span class="nav-title">${escapeHtml(next.title)}</span></a>`);
  const excerpt = entry.excerpt || entry.description;
  const certification = entry.context && entry.context.kind === 'certification';
  const disclaimer = certification ? entry.context.disclaimer : '';
  const summary = body ? [body.html] : [
    `          <h1>${escapeHtml(heading)}</h1>`,
    excerpt ? `          <p class="motto">${escapeHtml(excerpt)}</p>` : '',
    entry.description && entry.description !== excerpt ? `          <p>${escapeHtml(entry.description)}</p>` : '',
  ];
  const embedded = body && !certification
    ? `        <script type="application/json" id="lessonMarkdown">${jsonForHtml({ path: lessonPath, lang: page.lang, markdown: body.markdown })}</script>`
    : '';

  return [
    '        <article class="lesson-article lesson-seo-fallback" data-server-rendered="true">',
    `          <p class="lesson-meta-tag">${escapeHtml(context)}</p>`,
    disclaimer ? `          <aside class="cert-notice lesson-cert-notice" aria-label="Independent certification preparation"><strong>Independent preparation</strong><p>${escapeHtml(disclaimer)}</p></aside>` : '',
    ...summary,
    `          <p>This free lesson is part of the AI Engineering from Scratch curriculum. Read the full explanation, run the lesson code, and verify the result in the interactive reader or from the repository source.</p>`,
    '          <p><a href="catalog.html">Browse the complete course catalog</a>' + (sourceUrl ? ` or <a href="${escapeHtml(sourceUrl)}">open this lesson on GitHub</a>` : '') + '.</p>',
    languageLinks(page, lessonPath, contextParams),
    links.length ? `          <nav class="lesson-nav-bottom" aria-label="Lesson navigation">${links.join('')}</nav>` : '',
    '        </article>',
    embedded,
  ].filter(Boolean).join('\n');
}

function errorPage(title, message) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="robots" content="noindex"><title>${escapeHtml(title)} - AI Engineering from Scratch</title></head><body><main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><nav aria-label="Recovery links"><ul><li><a href="/catalog.html">Course catalog</a></li><li><a href="/sitemap.xml">Sitemap</a></li><li><a href="/llms.txt">Agent curriculum index</a></li></ul></nav></main></body></html>`;
}

function send(res, method, status, body, cacheControl, type = 'text/html') {
  const payload = String(body || '');
  res.statusCode = status;
  res.setHeader('Content-Type', `${type}; charset=utf-8`);
  res.setHeader('Cache-Control', cacheControl);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Length', String(Buffer.byteLength(payload)));
  res.end(method === 'HEAD' ? '' : payload);
}

function normalizedLessonLocation(req, lessonPath, entry, assets) {
  const params = new URLSearchParams();
  const certificationLesson = /^certifications\/[a-z0-9][a-z0-9-]*\/lessons\//.test(lessonPath);
  const navigationByTrack = entry.navigationByTrack && typeof entry.navigationByTrack === 'object'
    ? entry.navigationByTrack
    : {};
  let needsRedirect = hasQuery(req, 'legacy') || Array.from(queryNames(req)).some(function (name) {
    return !LESSON_QUERY_NAMES.has(name);
  });
  params.set('path', lessonPath);

  if (certificationLesson && hasQuery(req, 'track')) {
    const track = queryValue(req, 'track');
    if (validTrackId(track) && Object.prototype.hasOwnProperty.call(navigationByTrack, track)) {
      params.set('track', track);
    } else {
      needsRedirect = true;
    }
  } else if (hasQuery(req, 'track')) {
    needsRedirect = true;
  }

  let hasNavigationContext = params.has('track');
  if (!certificationLesson && hasQuery(req, 'learningPath')) {
    const requestedLearningPath = queryValue(req, 'learningPath');
    const learningPath = LEARNING_PATH_ALIASES[requestedLearningPath] || requestedLearningPath;
    if (validTrackId(learningPath) && listedValue(entry.learningPathIds, learningPath)) {
      params.set('learningPath', learningPath);
      hasNavigationContext = true;
      if (learningPath !== requestedLearningPath) needsRedirect = true;
    } else {
      needsRedirect = true;
    }
  } else if (certificationLesson && hasQuery(req, 'learningPath')) {
    needsRedirect = true;
  }

  if (!certificationLesson && hasQuery(req, 'fromTrack')) {
    const fromTrack = queryValue(req, 'fromTrack');
    if (!hasNavigationContext && validTrackId(fromTrack) && listedValue(entry.fromTrackIds, fromTrack)) {
      params.set('fromTrack', fromTrack);
      hasNavigationContext = true;
    } else {
      needsRedirect = true;
    }
  } else if (certificationLesson && hasQuery(req, 'fromTrack')) {
    needsRedirect = true;
  }

  if (hasQuery(req, 'lang')) {
    const lang = queryValue(req, 'lang');
    if (!certificationLesson && validLanguageCode(lang) && listedValue(assets.languageCodes, lang)) {
      params.set('lang', lang);
    } else {
      needsRedirect = true;
    }
  }

  if (hasQuery(req, 'ttsTest')) {
    if (isLocalRequest(req) && queryValue(req, 'ttsTest') === 'silent') {
      params.set('ttsTest', 'silent');
    } else {
      needsRedirect = true;
    }
  }

  const requestQuery = rawUrlQuery(req);
  if (requestQuery !== null && requestQuery !== params.toString()) {
    needsRedirect = true;
  }

  return {
    location: `/lesson?${params.toString()}`,
    needsRedirect,
    params,
  };
}

function sendRedirect(res, method, location) {
  res.setHeader('Location', location);
  send(res, method, 308, '', PAGE_CACHE);
}

function localizedTemplate(template, lang) {
  if (lang === 'en') return template;
  if ((template.match(/<html lang="en"/g) || []).length !== 1) throw new Error('template-html-lang');
  return template.replace('<html lang="en"', `<html lang="${escapeHtml(lang)}" dir="${RTL_LANGUAGES.has(lang) ? 'rtl' : 'ltr'}"`);
}

function sendUnavailable(res, method) {
  send(res, method, 500, errorPage('Lesson page unavailable', 'The lesson page could not be assembled. Continue from the course catalog while this page is restored.'), 'no-store');
}

function createHandler(options) {
  const loadAssets = options && typeof options.loadAssets === 'function'
    ? options.loadAssets
    : loadProductionAssets;
  const readTranslation = options && typeof options.readTranslation === 'function'
    ? options.readTranslation
    : readTranslationFromSource;
  return function lessonHandler(req, res) {
    const method = String(req.method || 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD');
      send(res, method, 405, errorPage('Method not allowed', 'Use GET or HEAD for lesson pages.'), 'no-store');
      return;
    }

    const lessonPath = queryValue(req, 'path');
    if (!validLessonPath(lessonPath)) {
      send(res, method, 404, errorPage('Lesson not found', 'This lesson path does not exist. Use the catalog, sitemap, or agent curriculum index to continue.'), 'no-store');
      return;
    }
    try {
      const assets = loadAssets();
      const template = assets && assets.template;
      const manifest = assets && assets.manifest;
      if (typeof template !== 'string') throw new Error('template-shape');
      if (!manifest || !manifest.lessons || typeof manifest.lessons !== 'object') throw new Error('manifest-shape');
      const entry = Object.prototype.hasOwnProperty.call(manifest.lessons, lessonPath)
        ? manifest.lessons[lessonPath]
        : null;
      if (!entry || entry.path !== lessonPath || !entry.title) {
        send(res, method, 404, errorPage('Lesson not found', 'This lesson path is not part of the current curriculum. Use the catalog, sitemap, or agent curriculum index to continue.'), 'no-store');
        return;
      }
      const normalized = normalizedLessonLocation(req, lessonPath, entry, assets);
      if (normalized.needsRedirect) {
        res.setHeader('Location', normalized.location);
        send(res, method, 308, '', PAGE_CACHE);
        return;
      }
      const contextParams = {};
      for (const name of ['track', 'fromTrack', 'learningPath', 'lang']) {
        if (normalized.params.has(name)) contextParams[name] = normalized.params.get(name);
      }
      const heading = lessonHeading(entry, manifest);
      const english = readEnglishMarkdown(assets, lessonPath);
      const markdownRequested = representation(req.headers && req.headers.accept) === 'text/markdown';
      const respond = function (markdown, servedLang, cacheControl) {
        res.setHeader('Vary', 'Accept, Accept-Encoding');
        res.setHeader('Content-Language', servedLang);
        if (markdownRequested && markdown) {
          send(res, method, 200, markdown, cacheControl, 'text/markdown');
          return;
        }
        const page = pageInfo(entry, lessonPath, heading, servedLang, markdown);
        const body = renderBody(markdown, page.heading);
        const html = replaceMarkedRegion(localizedTemplate(template, servedLang), SEO_START, SEO_END, lessonHead(entry, page));
        send(res, method, 200, replaceMarkedRegion(html, FALLBACK_START, FALLBACK_END, lessonFallback(entry, lessonPath, contextParams, page, body)), cacheControl);
      };
      const lang = contextParams.lang;
      if (!translationsOf(entry).includes(lang)) {
        respond(english, 'en', PAGE_CACHE);
        return;
      }
      return Promise.resolve()
        .then(function () { return readTranslation(lang, lessonPath); })
        .catch(function () { return null; })
        .then(function (markdown) {
          if (typeof markdown === 'string' && markdown.trim() && markdown !== english) respond(markdown, lang, TRANSLATED_CACHE);
          else respond(english, 'en', RETRY_CACHE);
        })
        .catch(function () { sendUnavailable(res, method); });
    } catch (_) {
      sendUnavailable(res, method);
    }
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
module.exports.validLessonPath = validLessonPath;
module.exports.validTrackId = validTrackId;
module.exports.lessonHeading = lessonHeading;
module.exports.loadProductionAssets = loadProductionAssets;
