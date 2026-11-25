(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LandscapeRules = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var REPO = 'rohitg00/ai-engineering-from-scratch';
  var BRANCH = 'main';
  var ENTRY_DIR = 'landscape/entries';
  var MAX_NAME = 60;
  var MAX_DESCRIPTION = 200;
  var MAX_LOGO_BYTES = 100 * 1024;
  var TOO_LARGE = 'logo is larger than ' + (MAX_LOGO_BYTES / 1024) + ' KB';
  var MIN_PNG_SIDE = 48;
  var FIELDS = ['name', 'url', 'category', 'also', 'description', 'open_source', 'repo', 'x', 'logo', 'logo_url'];
  var MAX_ALSO = 3;
  var LOGO_TYPES = ['svg', 'png'];
  var X_HANDLE = /^[A-Za-z0-9_]{1,15}$/;
  var SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  var REPO_URL = /^https:\/\/(github\.com|gitlab\.com|codeberg\.org)\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
  var PROMOTIONAL = /\b(best|leading|world[- ]class|revolutionary|cutting[- ]edge|number one|blazing\w*|game[- ]chang\w*|next[- ]gen\w*|unmatched|ultimate|state[- ]of[- ]the[- ]art)\b|#1/i;
  var CRYPTO = /\b(crypto\w*|blockchain\w*|stablecoin\w*|web3|nfts?|on-?chain|defi|memecoin\w*|airdrop\w*|tokenomics|dao)\b/i;
  var TEMPORARY_HOST = /(^|\.)(vercel\.app|netlify\.app|github\.io|pages\.dev|herokuapp\.com|ngrok\.io|ngrok-free\.app|trycloudflare\.com|bit\.ly|t\.co|tinyurl\.com)$/i;
  var IP_HOST = /^(\d{1,3}\.){3}\d{1,3}$|^\[|^localhost$/i;
  var SVG_BLOCKLIST = [
    [/<script/i, 'contains a <script> element'],
    [/<foreignObject/i, 'contains a <foreignObject> element'],
    [/<(iframe|embed|object|image|audio|video)\b/i, 'embeds an external element'],
    [/\son[a-z]+\s*=/i, 'contains an event handler attribute'],
    [/javascript:/i, 'contains a javascript: URL'],
    [/<!ENTITY|<!DOCTYPE[^>]*\[/i, 'declares an XML entity'],
    [/(?:xlink:)?href\s*=\s*["'](?!#)/i, 'links to an external resource'],
    [/@import|url\(\s*["']?(?!#)/i, 'loads an external style resource']
  ];

  function slugify(name) {
    return String(name || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function parseHttps(value) {
    if (typeof value !== 'string') return null;
    var parsed;
    try { parsed = new URL(value); } catch (_) { return null; }
    if (parsed.protocol !== 'https:') return null;
    if (parsed.username || parsed.password) return null;
    if (IP_HOST.test(parsed.hostname)) return null;
    if (parsed.hostname.indexOf('.') === -1) return null;
    return parsed;
  }

  function validateEntry(slug, entry, categoryIds) {
    var errors = [];
    if (!SLUG.test(String(slug))) errors.push('file name must be lowercase letters, digits and hyphens, for example "my-tool.json"');
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return errors.concat('entry must be a JSON object');

    Object.keys(entry).forEach(function (key) {
      if (FIELDS.indexOf(key) === -1) errors.push('unknown field "' + key + '". Allowed fields: ' + FIELDS.join(', '));
    });

    if (typeof entry.name !== 'string' || !entry.name.trim()) errors.push('"name" is required');
    else if (entry.name.length > MAX_NAME) errors.push('"name" must be ' + MAX_NAME + ' characters or fewer');

    var site = parseHttps(entry.url);
    if (!site) errors.push('"url" must be a public https:// address');

    if (categoryIds.indexOf(entry.category) === -1) errors.push('"category" must be one of: ' + categoryIds.join(', '));

    if (entry.also !== undefined) {
      var extra = Array.isArray(entry.also) ? entry.also : null;
      if (!extra || !extra.length || extra.length > MAX_ALSO) errors.push('"also" must list 1 to ' + MAX_ALSO + ' more categories');
      else extra.forEach(function (id, index) {
        if (categoryIds.indexOf(id) === -1 || id === entry.category || extra.indexOf(id) !== index) errors.push('"also" has a category that is unknown or repeated ("' + id + '")');
      });
    }

    if (typeof entry.description !== 'string' || !entry.description.trim()) errors.push('"description" is required');
    else {
      if (entry.description.length > MAX_DESCRIPTION) errors.push('"description" must be ' + MAX_DESCRIPTION + ' characters or fewer (now ' + entry.description.length + ')');
      if (/\n/.test(entry.description)) errors.push('"description" must be one line');
      if (!/[.]$/.test(entry.description.trim())) errors.push('"description" must end with a period');
      if (CRYPTO.test(entry.description + ' ' + (entry.name || ''))) errors.push('this tool is outside the scope of the landscape');
      var promo = entry.description.match(PROMOTIONAL);
      if (promo) errors.push('"description" must say what the tool does, without promotional words ("' + promo[0] + '")');
    }

    if (typeof entry.open_source !== 'boolean') errors.push('"open_source" must be true or false');
    if (entry.open_source === true) {
      if (typeof entry.repo !== 'string' || !REPO_URL.test(entry.repo)) errors.push('"repo" is required for open source tools, for example "https://github.com/owner/name"');
    } else if (entry.open_source === false) {
      if (entry.repo !== undefined) errors.push('"repo" is only for open source tools');
      if (site && TEMPORARY_HOST.test(site.hostname)) errors.push('"url" must be the product\'s own domain, not a preview or shared host (' + site.hostname + ')');
    }

    var hasLogo = entry.logo !== undefined;
    var hasLogoUrl = entry.logo_url !== undefined;
    if (hasLogo && hasLogoUrl) errors.push('give "logo" or "logo_url", not both');
    if (!hasLogo && !hasLogoUrl) errors.push('give "logo_url" (a link to your SVG or PNG logo) or "logo" (a file you add to site/logos/landscape/)');
    if (hasLogo && entry.logo !== slug + '.svg' && entry.logo !== slug + '.png') errors.push('"logo" must be "' + slug + '.svg" or "' + slug + '.png"');
    if (hasLogoUrl) {
      var logo = parseHttps(entry.logo_url);
      if (!logo) errors.push('"logo_url" must be a public https:// address');
      else if (!/\.(svg|png)$/i.test(logo.pathname)) errors.push('"logo_url" must point to an .svg or .png file');
    }

    if (entry.x !== undefined && (typeof entry.x !== 'string' || !X_HANDLE.test(entry.x))) errors.push('"x" must be an X handle without the @, for example "acme"');

    return errors;
  }

  function svgErrors(text) {
    var errors = [];
    if (typeof text !== 'string' || !/^\s*(<\?xml[^>]*\?>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(text)) return ['logo is not an SVG file'];
    if (text.length > MAX_LOGO_BYTES) errors.push(TOO_LARGE);
    var body = text.replace(/\sxmlns(:[a-z]+)?\s*=\s*["'][^"']*["']/gi, '');
    SVG_BLOCKLIST.forEach(function (rule) {
      if (rule[0].test(body)) errors.push('logo ' + rule[1]);
    });
    return errors;
  }

  function pngErrors(bytes) {
    var signature = [137, 80, 78, 71, 13, 10, 26, 10];
    if (!bytes || bytes.length < 24) return ['logo is not a PNG file'];
    for (var i = 0; i < signature.length; i++) {
      if (bytes[i] !== signature[i]) return ['logo is not a PNG file'];
    }
    var errors = [];
    if (bytes.length > MAX_LOGO_BYTES) errors.push(TOO_LARGE);
    var width = ((bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19]) >>> 0;
    var height = ((bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23]) >>> 0;
    if (width < MIN_PNG_SIDE || height < MIN_PNG_SIDE) errors.push('PNG logo must be at least ' + MIN_PNG_SIDE + ' pixels on each side (now ' + width + ' by ' + height + ')');
    return errors;
  }

  function buildEntry(form) {
    var entry = {
      name: String(form.name || '').trim(),
      url: String(form.url || '').trim(),
      category: String(form.category || ''),
      description: String(form.description || '').trim(),
      open_source: Boolean(form.open_source)
    };
    if (entry.open_source) entry.repo = String(form.repo || '').trim().replace(/\/+$/, '').replace(/\.git$/, '');
    var handle = String(form.x || '').trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, '').replace(/\/+$/, '');
    if (handle) entry.x = handle;
    entry.logo_url = String(form.logo_url || '').trim();
    return entry;
  }

  function entryJson(entry) {
    var ordered = {};
    FIELDS.forEach(function (key) {
      if (entry[key] !== undefined) ordered[key] = entry[key];
    });
    return JSON.stringify(ordered, null, 2) + '\n';
  }

  function entryPath(slug) {
    return ENTRY_DIR + '/' + slug + '.json';
  }

  function pullRequestUrl(slug, entry) {
    return 'https://github.com/' + REPO + '/new/' + BRANCH +
      '?filename=' + encodeURIComponent(entryPath(slug)) +
      '&value=' + encodeURIComponent(entryJson(entry));
  }

  return {
    REPO: REPO,
    ENTRY_DIR: ENTRY_DIR,
    FIELDS: FIELDS,
    MAX_DESCRIPTION: MAX_DESCRIPTION,
    MAX_LOGO_BYTES: MAX_LOGO_BYTES,
    LOGO_TYPES: LOGO_TYPES,
    slugify: slugify,
    parseHttps: parseHttps,
    validateEntry: validateEntry,
    svgErrors: svgErrors,
    pngErrors: pngErrors,
    buildEntry: buildEntry,
    entryJson: entryJson,
    entryPath: entryPath,
    pullRequestUrl: pullRequestUrl
  };
});
