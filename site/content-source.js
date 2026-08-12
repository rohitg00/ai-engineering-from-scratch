/**
 * Resolve repository content for static pages.
 *
 * Local previews are served from the repository root, so ../ reaches lesson
 * and assessment source files directly. Deploys keep the branch-aware raw
 * GitHub behavior through build-meta.js.
 */
(function () {
  'use strict';

  var DEFAULT_REPOSITORY = 'rohitg00/ai-engineering-from-scratch';

  function buildMeta() {
    return window.__AIFS_BUILD_META && typeof window.__AIFS_BUILD_META === 'object'
      ? window.__AIFS_BUILD_META
      : {};
  }

  function repository() {
    var configured = window.__AIFS_REPOSITORY || buildMeta().repository || DEFAULT_REPOSITORY;
    if (configured && typeof configured === 'object') {
      configured = (configured.owner || '') + '/' + (configured.name || configured.repo || '');
    }
    configured = String(configured || '').replace(/^\/+|\/+$/g, '');
    return /^[^/]+\/[^/]+$/.test(configured) ? configured : DEFAULT_REPOSITORY;
  }

  function activeRef() {
    return window.__AIFS_REF || buildMeta().ref || 'main';
  }

  function isLocal() {
    var host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
  }

  function clean(path) {
    return String(path || '').replace(/^\/+/, '').replace(/\.\.(?:\/|\\)/g, '');
  }

  function rawRepoUrl(path) {
    return 'https://raw.githubusercontent.com/' + repository() + '/' + activeRef() + '/' + clean(path);
  }

  function translationUrl(path, lang) {
    var safeLang = String(lang || '');
    if (!/^[A-Za-z][A-Za-z0-9-]*$/.test(safeLang)) throw new Error('Invalid translation language');
    var lessonPath = clean(path).replace(/\/+$/, '');
    var relativePath = 'i18n/' + safeLang + '/' + lessonPath + '/docs/' + safeLang + '.md';
    return isLocal() ? '../' + relativePath : rawRepoUrl(relativePath);
  }

  function generatedTranslationUrl(path, lang) {
    var safeLang = String(lang || '');
    if (!/^[A-Za-z][A-Za-z0-9-]*$/.test(safeLang)) throw new Error('Invalid translation language');
    var lessonPath = clean(path).replace(/\/+$/, '');
    return 'https://raw.githubusercontent.com/' + repository() + '/translations/i18n/'
      + safeLang + '/' + lessonPath + '/docs/' + safeLang + '.md';
  }

  function repoTreeUrl(path) {
    var safe = clean(path);
    return 'https://github.com/' + repository() + '/tree/' + activeRef() + (safe ? '/' + safe : '/');
  }

  function contentsApiUrl(path) {
    return 'https://api.github.com/repos/' + repository() + '/contents/' + clean(path)
      + '?ref=' + encodeURIComponent(activeRef());
  }

  function repoUrl(path) {
    var safe = clean(path);
    if (isLocal()) return '../' + safe;
    return rawRepoUrl(safe);
  }

  function fetchOk(url) {
    return fetch(url).then(function (response) {
      if (!response.ok) throw new Error('fetch-failed');
      return response;
    });
  }

  function canonicalDocument(path) {
    var relativePath = clean(path).replace(/\/+$/, '') + '/docs/en.md';
    var primary = repoUrl(relativePath);
    var fallback = rawRepoUrl(relativePath);
    return fetchOk(primary).catch(function (error) {
      if (fallback === primary) throw error;
      return fetchOk(fallback);
    }).then(function (response) {
      return response.text().then(function (markdown) {
        return { markdown: markdown, lang: 'en' };
      });
    });
  }

  /**
   * Load translated lesson prose, returning the language that actually won.
   * Certification callers pass their canonical embedded markdown so a missing
   * translation remains available without a second network request.
   */
  function loadLessonDocument(path, lang, embeddedEnglish) {
    var requested = String(lang || 'en');
    if (requested === 'en') {
      return typeof embeddedEnglish === 'string'
        ? Promise.resolve({ markdown: embeddedEnglish, lang: 'en' })
        : canonicalDocument(path);
    }

    return Promise.resolve().then(function () {
      return fetchOk(translationUrl(path, requested));
    }).catch(function () {
      return fetchOk(generatedTranslationUrl(path, requested));
    }).then(function (response) {
      return response.text().then(function (markdown) {
        return { markdown: markdown, lang: requested };
      });
    }).catch(function () {
      return typeof embeddedEnglish === 'string'
        ? { markdown: embeddedEnglish, lang: 'en' }
        : canonicalDocument(path);
    });
  }

  function localDirectoryFiles(path) {
    if (!isLocal()) return Promise.reject(new Error('Local directory listing is unavailable'));

    var safe = clean(path).replace(/\/+$/, '');
    if (!safe || /\\/.test(safe)) return Promise.reject(new Error('Invalid local directory path'));

    var expectedUrl = new URL(repoUrl(safe + '/'), window.location.href);
    return fetch(expectedUrl.href, { headers: { 'Accept': 'text/html' } }).then(function (res) {
      if (!res.ok) throw new Error(String(res.status));

      var responseUrl = new URL(res.url);
      if (responseUrl.origin !== expectedUrl.origin || responseUrl.pathname !== expectedUrl.pathname) {
        throw new Error('Unexpected local directory response');
      }

      return res.text().then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var heading = doc.querySelector('h1');
        var indexLabel = (doc.title + ' ' + (heading ? heading.textContent : '')).trim();
        if (!/(?:directory listing for|index of)/i.test(indexLabel)) {
          throw new Error('Local server does not expose directory listings');
        }

        var files = [];
        doc.querySelectorAll('a[href]').forEach(function (link) {
          var href = link.getAttribute('href');
          var fileUrl;
          try {
            fileUrl = new URL(href, responseUrl.href);
          } catch (_) {
            return;
          }

          if (fileUrl.origin !== expectedUrl.origin || fileUrl.search || fileUrl.hash) return;
          if (fileUrl.pathname.indexOf(expectedUrl.pathname) !== 0 || /\/$/.test(fileUrl.pathname)) return;

          var encodedName = fileUrl.pathname.slice(expectedUrl.pathname.length);
          var name;
          try {
            name = decodeURIComponent(encodedName);
          } catch (_) {
            return;
          }
          if (!name || /[\\/]/.test(name)) return;

          files.push({
            name: name,
            path: safe + '/' + name,
            size: 0,
            html_url: fileUrl.href,
            download_url: fileUrl.href,
          });
        });

        return Promise.all(files.map(function (file) {
          return fetch(file.download_url, { method: 'HEAD' }).then(function (head) {
            var size = Number(head.headers.get('content-length'));
            if (head.ok && isFinite(size) && size >= 0) file.size = size;
            return file;
          }).catch(function () {
            return file;
          });
        }));
      });
    });
  }

  window.AIFSContentSource = {
    repository: repository,
    isLocal: isLocal,
    repoUrl: repoUrl,
    rawRepoUrl: rawRepoUrl,
    translationUrl: translationUrl,
    generatedTranslationUrl: generatedTranslationUrl,
    repoTreeUrl: repoTreeUrl,
    contentsApiUrl: contentsApiUrl,
    loadLessonDocument: loadLessonDocument,
    localDirectoryFiles: localDirectoryFiles,
  };
}());
