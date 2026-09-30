#!/usr/bin/env node
const { version } = require('../package.json');

const HELP = `AI Engineering from Scratch CLI ${version}

Usage:
  aiefs search [words] [--kind all|lesson|project] [--limit 1..50] [--offset 0..10000]
  aiefs read <path> [--json]
  aiefs schema
  aiefs --version

Options:
  --base-url <url>  API origin (default: https://aiengineeringfromscratch.com)
  --help            Show this help

Search and schema print JSON. Read prints Markdown unless --json is present.
No API key is needed. Errors use stderr and a nonzero exit status.
`;

function parse(argv) {
  const options = {};
  const words = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) { words.push(arg); continue; }
    if (!['--base-url', '--kind', '--limit', '--offset', '--json', '--help', '--version'].includes(arg)) throw new Error(`Unknown option: ${arg}`);
    if (Object.hasOwn(options, arg)) throw new Error(`Duplicate option: ${arg}`);
    if (['--json', '--help', '--version'].includes(arg)) options[arg] = true;
    else {
      if (argv[i + 1] === undefined || argv[i + 1].startsWith('--')) throw new Error(`${arg} requires a value.`);
      options[arg] = argv[++i];
    }
  }
  return { options, words };
}

async function main(argv, { stdout = process.stdout, fetcher = fetch } = {}) {
  const { options, words } = parse(argv);
  if (options['--help'] || !argv.length) { stdout.write(HELP); return; }
  if (options['--version']) { stdout.write(version + '\n'); return; }
  const [command, ...args] = words;
  if (!['search', 'read', 'schema'].includes(command)) throw new Error('Choose search, read, or schema. See --help.');
  const base = new URL(options['--base-url'] || 'https://aiengineeringfromscratch.com');
  if (base.username || base.password || base.search || base.hash || base.pathname !== '/') throw new Error('--base-url must be an origin without credentials, path, query, or fragment.');
  if (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname))) throw new Error('--base-url requires HTTPS, except on loopback.');
  if (command !== 'search' && ['--kind', '--limit', '--offset'].some(key => key in options)) throw new Error('kind, limit, and offset apply only to search.');
  if (command !== 'read' && options['--json']) throw new Error('--json applies only to read; search and schema already return JSON.');
  const endpoints = { schema: '/openapi.json', search: '/api/v1/catalog', read: '/api/v1/resource' };
  const url = new URL(endpoints[command], base);
  if (command === 'search') {
    const query = args.join(' ');
    if (query.length > 200) throw new Error('Search text must be at most 200 characters.');
    url.searchParams.set('q', query);
    for (const [key, min, max] of [['--limit', 1, 50], ['--offset', 0, 10000]]) {
      if (key in options) {
        if (!/^\d+$/.test(options[key]) || Number(options[key]) < min || Number(options[key]) > max) throw new Error(`${key} must be an integer from ${min} to ${max}.`);
        url.searchParams.set(key.slice(2), options[key]);
      }
    }
    if (options['--kind']) {
      if (!['all', 'lesson', 'project'].includes(options['--kind'])) throw new Error('--kind must be all, lesson, or project.');
      url.searchParams.set('kind', options['--kind']);
    }
  } else if (command === 'read') {
    if (args.length !== 1 || args[0].length > 240) throw new Error('read requires one exact resource path returned by search.');
    url.searchParams.set('path', args[0]);
  } else if (args.length) throw new Error('schema takes no positional arguments.');
  const response = await fetcher(url, { headers: { Accept: 'application/json', 'User-Agent': `aiefs-cli/${version}` }, signal: AbortSignal.timeout(15000), redirect: 'error' });
  const type = response.headers.get('content-type') || '';
  if (!/^application\/(?:problem\+)?json\b/.test(type)) throw new Error(`HTTP ${response.status}: expected JSON from ${url.pathname}.`);
  const data = await response.json();
  if (!response.ok) {
    const retry = response.headers.get('retry-after');
    throw new Error(`HTTP ${response.status} ${data.code || ''}: ${data.detail || data.title || 'Request failed'}${data.hint ? ' ' + data.hint : ''}${retry ? ` Retry after ${retry} seconds.` : ''}`);
  }
  if (command === 'read' && !options['--json']) {
    if (typeof data.markdown !== 'string') throw new Error('The API returned no Markdown content.');
    stdout.write(data.markdown.endsWith('\n') ? data.markdown : data.markdown + '\n');
  } else stdout.write(JSON.stringify(data, null, 2) + '\n');
}

if (require.main === module) main(process.argv.slice(2)).catch(error => { process.stderr.write(`aiefs: ${error.message}\n`); process.exitCode = 1; });
module.exports = { main, parse };
