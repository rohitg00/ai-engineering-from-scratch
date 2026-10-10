const fs = require('node:fs');
const path = require('node:path');

const ORIGIN = 'https://aiengineeringfromscratch.com';
const UNROUTED_PAGES = /^(?:404|manuals|manual-[a-z0-9-]+)\.html$/;

function cleanHref(value, pages) {
  const match = value.match(/^(https:\/\/aiengineeringfromscratch\.com\/|\/|\.\/)?([a-z0-9-]+)\.html([?#].*)?$/);
  if (!match || !pages.has(match[2])) return value;
  const [, prefix = '', page, suffix = ''] = match;
  if (page === 'index') return (prefix || './') + suffix;
  return prefix + page + suffix;
}

function cleanPublicUrls(text, pages) {
  return text.replace(/https:\/\/aiengineeringfromscratch\.com\/[a-z0-9-]+\.html(?=[?#\s"'<>)}\]]|$)/g,
    value => cleanHref(value, pages));
}

function cleanHtml(html, pages) {
  return cleanPublicUrls(html, pages).replace(/<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script\s*>|<[^>]+>/gi, tag => {
    if (/^<!--|^<script\b/i.test(tag)) return tag;
    return tag.replace(/(\shref\s*=\s*)(["'])(.*?)\2/gi,
      (_, before, quote, value) => before + quote + cleanHref(value, pages) + quote);
  });
}

function cleanSite(siteRoot = __dirname) {
  const files = fs.readdirSync(siteRoot);
  const pages = new Set(files.filter(name => name.endsWith('.html') && !UNROUTED_PAGES.test(name))
    .map(name => name.slice(0, -5)));
  for (const name of files.filter(name => /\.(html|xml|txt|json|md)$/.test(name))) {
    const filename = path.join(siteRoot, name);
    const source = fs.readFileSync(filename, 'utf8');
    let output = name.endsWith('.html') ? cleanHtml(source, pages) : cleanPublicUrls(source, pages);
    if (name === 'sitemap.xml' && pages.has('projects') && !output.includes(`<loc>${ORIGIN}/projects</loc>`)) {
      output = output.replace('</urlset>', `  <url><loc>${ORIGIN}/projects</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>\n</urlset>`);
    }
    if (source !== output) fs.writeFileSync(filename, output);
  }
  const markdownRoot = path.join(siteRoot, 'agent-pages');
  if (fs.existsSync(markdownRoot)) {
    for (const name of fs.readdirSync(markdownRoot).filter(name => name.endsWith('.md'))) {
      const filename = path.join(markdownRoot, name);
      const source = fs.readFileSync(filename, 'utf8');
      const output = cleanPublicUrls(source, pages);
      if (source !== output) fs.writeFileSync(filename, output);
    }
  }
  const resourcesPath = path.join(siteRoot, '../generated/agent-content.json');
  if (fs.existsSync(resourcesPath)) {
    const resources = JSON.parse(fs.readFileSync(resourcesPath, 'utf8'));
    for (const entry of resources) entry.url = cleanHref(entry.url, pages);
    fs.writeFileSync(resourcesPath, JSON.stringify(resources));
  }
  return pages.size;
}

if (require.main === module) console.log(`Published clean URLs for ${cleanSite(process.argv[2] || __dirname)} pages.`);
module.exports = { cleanHref, cleanPublicUrls, cleanHtml, cleanSite };
