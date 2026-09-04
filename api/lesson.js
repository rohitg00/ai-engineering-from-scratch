const fs = require('fs');
const path = require('path');

const ORIGIN = 'https://aiengineeringfromscratch.com';
const SEO_START = '<!-- AIFS:LESSON-SEO:START -->';
const SEO_END = '<!-- AIFS:LESSON-SEO:END -->';
const FALLBACK_START = '<!-- AIFS:LESSON-FALLBACK:START -->';
const FALLBACK_END = '<!-- AIFS:LESSON-FALLBACK:END -->';
const LESSON_QUERY_NAMES = new Set(['path', 'track', 'fromTrack', 'learningPath', 'lang', 'ttsTest', 'legacy']);
const LEARNING_PATH_ALIASES = Object.freeze({
  'mcp-engineering': 'model-context-protocol',
});

let productionAssets;

function loadProductionAssets() {
  if (!productionAssets) {
    const languageRegistry = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'languages.json'), 'utf8'));
    const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'site', 'lesson-seo.json'), 'utf8'));
    productionAssets = {
      template: fs.readFileSync(path.join(__dirname, '..', 'site', 'lesson.html'), 'utf8'),
      manifest,
      languageCodes: Array.isArray(languageRegistry.languages)
        ? languageRegistry.languages
          .filter(function (language) { return language.source || language.ci; })
          .map(function (language) { return String(language.code || ''); }).filter(Boolean)
        : [],
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
  return /^(?:phases\/[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*|certifications\/claude\/lessons\/[a-z0-9][a-z0-9-]*)$/.test(value);
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

function canonicalForLesson(lessonPath) {
  return `${ORIGIN}/lesson?path=${encodeURIComponent(lessonPath)}`;
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

function lessonHead(entry, lessonPath, heading) {
  const canonical = canonicalForLesson(lessonPath);
  const title = entry.seoTitle || `${entry.title} - AI Engineering from Scratch`;
  const description = entry.description || entry.excerpt || 'A lesson from the AI Engineering from Scratch curriculum.';
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
        inLanguage: 'en',
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
    `  <meta property="og:title" content="${escapeHtml(title)}">`,
    `  <meta property="og:description" content="${escapeHtml(description)}">`,
    `  <meta property="og:image" content="${ORIGIN}/og-image.png?v=3">`,
    `  <meta property="og:url" content="${escapeHtml(canonical)}">`,
    '  <meta property="og:type" content="article">',
    '  <meta name="twitter:card" content="summary_large_image">',
    `  <meta name="twitter:title" content="${escapeHtml(title)}">`,
    `  <meta name="twitter:description" content="${escapeHtml(description)}">`,
    `  <meta name="twitter:image" content="${ORIGIN}/og-image.png?v=3">`,
    `  <script type="application/ld+json" id="lessonJsonLd">${jsonForHtml(jsonLd)}</script>`,
  ].join('\n');
}

function lessonHref(ref, contextParams) {
  const params = new URLSearchParams();
  params.set('path', ref.path);
  for (const name of ['track', 'fromTrack', 'learningPath', 'lang']) {
    if (contextParams && contextParams[name]) params.set(name, contextParams[name]);
  }
  return `/lesson?${params.toString().replace(/&/g, '&amp;')}`;
}

function lessonFallback(entry, lessonPath, contextParams, heading) {
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

  return [
    '        <article class="lesson-article lesson-seo-fallback" data-server-rendered="true">',
    `          <p class="lesson-meta-tag">${escapeHtml(context)}</p>`,
    `          <h1>${escapeHtml(heading)}</h1>`,
    excerpt ? `          <p class="motto">${escapeHtml(excerpt)}</p>` : '',
    entry.description && entry.description !== excerpt ? `          <p>${escapeHtml(entry.description)}</p>` : '',
    `          <p>This free lesson is part of the AI Engineering from Scratch curriculum. Read the full explanation, run the lesson code, and verify the result in the interactive reader or from the repository source.</p>`,
    '          <p><a href="catalog.html">Browse the complete course catalog</a>' + (sourceUrl ? ` or <a href="${escapeHtml(sourceUrl)}">open this lesson on GitHub</a>` : '') + '.</p>',
    links.length ? `          <nav class="lesson-nav-bottom" aria-label="Lesson navigation">${links.join('')}</nav>` : '',
    '        </article>',
  ].filter(Boolean).join('\n');
}

function errorPage(title, message) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="robots" content="noindex"><title>${escapeHtml(title)} - AI Engineering from Scratch</title></head><body><main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><nav aria-label="Recovery links"><ul><li><a href="/catalog.html">Course catalog</a></li><li><a href="/sitemap.xml">Sitemap</a></li><li><a href="/llms.txt">Agent curriculum index</a></li></ul></nav></main></body></html>`;
}

function send(res, method, status, body, cacheControl) {
  const payload = String(body || '');
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', cacheControl);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Length', String(Buffer.byteLength(payload)));
  res.end(method === 'HEAD' ? '' : payload);
}

function normalizedLessonLocation(req, lessonPath, entry, assets) {
  const params = new URLSearchParams();
  const certificationLesson = lessonPath.startsWith('certifications/claude/lessons/');
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
  send(res, method, 308, '', 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800');
}

function createHandler(options) {
  const loadAssets = options && typeof options.loadAssets === 'function'
    ? options.loadAssets
    : loadProductionAssets;
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
        send(res, method, 308, '', 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800');
        return;
      }
      const contextParams = {};
      for (const name of ['track', 'fromTrack', 'learningPath', 'lang']) {
        if (normalized.params.has(name)) contextParams[name] = normalized.params.get(name);
      }
      const heading = lessonHeading(entry, manifest);
      let html = replaceMarkedRegion(template, SEO_START, SEO_END, lessonHead(entry, lessonPath, heading));
      html = replaceMarkedRegion(html, FALLBACK_START, FALLBACK_END, lessonFallback(entry, lessonPath, contextParams, heading));
      send(res, method, 200, html, 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800');
    } catch (_) {
      send(res, method, 500, errorPage('Lesson page unavailable', 'The lesson page could not be assembled. Continue from the course catalog while this page is restored.'), 'no-store');
    }
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
module.exports.validLessonPath = validLessonPath;
module.exports.validTrackId = validTrackId;
module.exports.lessonHeading = lessonHeading;
