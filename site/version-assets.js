const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function versionHtml(html, siteRoot, versions = new Map()) {
  function versionTag(tag, attribute) {
    const pattern = new RegExp(`(\\s${attribute}\\s*=\\s*)(["'])(.*?)\\2`, 'i');
    return tag.replace(pattern, (match, prefix, quote, value) => {
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value)) return match;
      const url = value.replace(/&amp;/g, '&');
      const [location, fragment = ''] = url.split('#', 2);
      const [pathname, query = ''] = location.split('?', 2);
      if (!/\.(?:js|css)$/i.test(pathname)) return match;
      const filename = path.resolve(siteRoot, decodeURIComponent(pathname).replace(/^\//, ''));
      if (!filename.startsWith(path.resolve(siteRoot) + path.sep)) {
        throw new Error(`Asset is outside the site: ${pathname}`);
      }
      if (!versions.has(filename)) {
        versions.set(filename, crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex').slice(0, 16));
      }
      const params = new URLSearchParams(query);
      params.set('v', versions.get(filename));
      const versioned = `${pathname}?${params}${fragment ? '#' + fragment : ''}`.replace(/&/g, '&amp;');
      return `${prefix}${quote}${versioned}${quote}`;
    });
  }

  return html.replace(/<!--[\s\S]*?-->|(<script\b[^>]*>)([\s\S]*?)(<\/script\s*>)|<link\b[^>]*>/gi,
    (match, script, body, closing) => {
      if (match.startsWith('<!--')) return match;
      if (script) return versionTag(script, 'src') + body + closing;
      return versionTag(match, 'href');
    });
}

function versionSite(siteRoot = __dirname) {
  const versions = new Map();
  const pages = fs.readdirSync(siteRoot).filter(name => name.endsWith('.html'));
  const outputs = pages.map(name => {
    const filename = path.join(siteRoot, name);
    const source = fs.readFileSync(filename, 'utf8');
    return { filename, source, output: versionHtml(source, siteRoot, versions) };
  });
  for (const { filename, source, output } of outputs) {
    if (source !== output) fs.writeFileSync(filename, output, 'utf8');
  }
  return { pages: pages.length, assets: versions.size };
}

if (require.main === module) {
  const result = versionSite(process.argv[2] || __dirname);
  console.log(`Versioned ${result.assets} assets across ${result.pages} HTML pages.`);
}

module.exports = { versionHtml, versionSite };
