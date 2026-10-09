const fs = require('node:fs');
const path = require('node:path');
const { ORIGIN, PAGES } = require('../lib/agent-content');

const ROOT = path.join(__dirname, '..');
const REPO = 'https://github.com/rohitg00/ai-engineering-from-scratch';

function pageMarkdown(html, filename) {
  const content = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || '';
  const title = html.match(/<title>(.*?)<\/title>/i)?.[1] || filename;
  const text = content.replace(/<(script|style|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, value) => '\n\n' + '#'.repeat(Number(level)) + ' ' + value + '\n\n')
    .replace(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, value) => `[${value.replace(/<[^>]*>/g, '').trim()}](${new URL(href.replace(/&amp;/g, '&'), ORIGIN + '/' + filename).href})`)
    .replace(/<li\b[^>]*>/gi, '\n- ').replace(/<\/(?:p|div|section|ul|ol|pre)>/gi, '\n\n')
    .replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]*>/g, '')
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g, entity => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ' })[entity])
    .replace(/[ \t]+/g, ' ').replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return `# ${title}\n\nCanonical page: ${ORIGIN}/${filename === 'index.html' ? '' : filename}\n\n${text}\n\n[Curriculum index](${ORIGIN}/llms.txt) | [API and MCP docs](${ORIGIN}/docs)\n`;
}

function build() {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'lesson-seo.json'), 'utf8'));
  const entries = Object.values(manifest.lessons).map(entry => ({
    path: entry.path, kind: 'lesson', title: entry.title, description: entry.description,
    url: entry.canonicalUrl, sourceUrl: `${REPO}/blob/main/${entry.path}/docs/en.md`,
    markdown: fs.readFileSync(path.join(ROOT, entry.path, 'docs/en.md'), 'utf8'),
  }));
  for (const directory of fs.readdirSync(path.join(ROOT, 'projects')).sort()) {
    if (directory.startsWith('_') || !fs.existsSync(path.join(ROOT, 'projects', directory, 'project.json'))) continue;
    const project = JSON.parse(fs.readFileSync(path.join(ROOT, 'projects', directory, 'project.json'), 'utf8'));
    const resourcePath = `projects/${directory}`;
    entries.push({ path: resourcePath, kind: 'project', title: project.title,
      description: project.summary, url: `${ORIGIN}/project.html?id=${encodeURIComponent(project.id)}`,
      sourceUrl: `${REPO}/blob/main/${resourcePath}/README.md`,
      markdown: fs.readFileSync(path.join(ROOT, resourcePath, 'README.md'), 'utf8'),
    });
  }
  entries.sort((a, b) => a.path.localeCompare(b.path, 'en'));
  fs.mkdirSync(path.join(ROOT, 'generated'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'generated/agent-content.json'), JSON.stringify(entries));
  fs.mkdirSync(path.join(__dirname, 'agent-pages'), { recursive: true });
  for (const filename of new Set(Object.values(PAGES))) {
    const markdown = filename === 'developer.html'
      ? fs.readFileSync(path.join(__dirname, 'developer.md'), 'utf8')
      : pageMarkdown(fs.readFileSync(path.join(__dirname, filename), 'utf8'), filename);
    fs.writeFileSync(path.join(__dirname, 'agent-pages', filename.replace('.html', '.md')), markdown);
  }
  const llmsPath = path.join(__dirname, 'llms.txt');
  const llms = fs.readFileSync(llmsPath, 'utf8');
  const discovery = `## API and MCP\n\n- [AI Engineering from Scratch API docs](${ORIGIN}/docs): public read-only API, authentication policy, errors, quotas, and versioning.\n- [OpenAPI 3.1](${ORIGIN}/openapi.json): typed REST operations.\n- [MCP manifest](${ORIGIN}/server.json): connect using Streamable HTTP at ${ORIGIN}/mcp.\n\n`;
  if (!llms.includes('## API, MCP, and CLI')) fs.writeFileSync(llmsPath, llms.replace(/\n\n/, '\n\n' + discovery));
  console.log(`Built ${entries.length} agent resources and ${new Set(Object.values(PAGES)).size} Markdown pages.`);
}

if (require.main === module) build();
module.exports = { pageMarkdown, build };
