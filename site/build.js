#!/usr/bin/env node
/**
 * Build script for AI Engineering from Scratch website.
 * Parses README.md, ROADMAP.md, and glossary/terms.md from the repo root
 * and generates data.js with all phase/lesson/glossary data.
 *
 * Run: node site/build.js
 * Called automatically by GitHub Actions on every push.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO_ROOT = path.resolve(__dirname, '..');
const README_PATH = path.join(REPO_ROOT, 'README.md');
const ROADMAP_PATH = path.join(REPO_ROOT, 'ROADMAP.md');
const GLOSSARY_PATH = path.join(REPO_ROOT, 'glossary', 'terms.md');
const OUTPUT_PATH = path.join(__dirname, 'data.js');
const CERTIFICATIONS_PATH = path.join(REPO_ROOT, 'certifications');
const CERTIFICATION_OUTPUT_PATH = path.join(__dirname, 'certification-data.js');
const FIGURE_MANIFEST_OUTPUT_PATH = path.join(__dirname, 'figure-manifest.js');

// Registration order is public behavior. Later providers intentionally replace
// selected legacy figures, including figures-tools3.js -> figures-mcp.js.
const FIGURE_PROVIDER_ORDER = [
  'figures.js',
  'figures-math.js',
  'figures-ml.js',
  'figures-dl.js',
  'figures-vision-speech.js',
  'figures-transformers.js',
  'figures-genai-rl.js',
  'figures-llms-systems.js',
  'figures-agents-alignment.js',
  'figures-math2.js',
  'figures-nlp2.js',
  'figures-llms2.js',
  'figures-infra.js',
  'figures-frontier.js',
  'figures-llmeng.js',
  'figures-multimodal.js',
  'figures-agents2.js',
  'figures-alignment2.js',
  'figures-foundations2.js',
  'figures-capstone-a.js',
  'figures-capstone-b.js',
  'figures-agents3.js',
  'figures-nlp3.js',
  'figures-cv2.js',
  'figures-llms3.js',
  'figures-autonomous2.js',
  'figures-swarms2.js',
  'figures-infra2.js',
  'figures-systems3.js',
  'figures-capstone-c.js',
  'figures-capstone-d.js',
  'figures-cv3.js',
  'figures-speech2.js',
  'figures-multimodal2.js',
  'figures-tools2.js',
  'figures-agents4.js',
  'figures-swarms3.js',
  'figures-genai3.js',
  'figures-misc2.js',
  'figures-history.js',
  'figures-capstone-e.js',
  'figures-capstone-f.js',
  'figures-capstone-g.js',
  'figures-capstone-h.js',
  'figures-capstone-i.js',
  'figures-alignment3.js',
  'figures-alignment4.js',
  'figures-workbench.js',
  'figures-tools3.js',
  'figures-mcp.js',
  'figures-setup.js',
  'figures-foundations3.js',
  'figures-visaudio4.js',
  'figures-nlp5.js',
  'figures-llmstack5.js',
  'figures-autoswarm5.js',
  'figures-infra4.js',
  'figures-claude-certifications.js',
];

const GITHUB_BASE = 'https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/';
const SITE_ORIGIN = 'https://aiengineeringfromscratch.com';

// GITHUB_BASE lesson url -> site path "phases/<phase>/<lesson>"
function lessonPath(url) {
  if (!url) return null;
  const m = url.match(/(phases\/[^/]+\/[^/]+)\/?$/);
  return m ? m[1] : null;
}

// ─── Parse ROADMAP.md for lesson statuses ────────────────────────────
function parseRoadmap(content) {
  const statuses = {}; // { "Phase 0": { phaseStatus, lessons: { "Dev Environment": "complete" } } }
  let currentPhase = null;
  let currentPhaseStatus = null;

  for (const line of content.split(/\r?\n/)) {
    // Match phase headers like: ## Phase 0: Setup & Tooling — ✅
    const phaseMatch = line.match(/^##\s+Phase\s+(\d+).*?—\s*(✅|🚧|⬚)/);
    if (phaseMatch) {
      const phaseId = parseInt(phaseMatch[1]);
      const statusEmoji = phaseMatch[2];
      currentPhaseStatus = statusEmoji === '✅' ? 'complete' : statusEmoji === '🚧' ? 'in-progress' : 'planned';
      currentPhase = `Phase ${phaseId}`;
      statuses[currentPhase] = { phaseStatus: currentPhaseStatus, lessons: {} };
      continue;
    }

    // Match lesson rows like: | 01 | Dev Environment | ✅ |
    if (currentPhase) {
      const lessonMatch = line.match(/^\|\s*\d+\s*\|\s*(.+?)\s*\|\s*(✅|🚧|⬚)\s*\|/);
      if (lessonMatch) {
        const lessonName = lessonMatch[1].trim();
        const statusEmoji = lessonMatch[2];
        const status = statusEmoji === '✅' ? 'complete' : statusEmoji === '🚧' ? 'in-progress' : 'planned';
        statuses[currentPhase].lessons[lessonName] = status;
      }
    }
  }

  return statuses;
}

// ─── Parse README.md for phases and lessons ──────────────────────────
function parseReadme(content, roadmapStatuses) {
  const phases = [];

  // Split into phase blocks
  // Phase 0 is in a <table> block, phases 1-19 are in <details> blocks
  // We'll parse line by line to extract phase headers and lesson tables

  const lines = content.split(/\r?\n/);
  let currentPhase = null;
  let inLessonTable = false;
  let isCapstoneTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match Phase header - multiple formats supported:
    // Old: ### Phase 0: Setup & Tooling `12 lessons`
    // Old: <summary><strong>Phase 1: Math Foundations</strong> <code>22 lessons</code> ... <em>Description</em></summary>
    // New: ### ![](https://img.shields.io/badge/Phase_0-Setup_&_Tooling-95A5A6?style=for-the-badge) `12 lessons`
    // New: <summary><b>🟣 Phase 1 — Math Foundations</b> &nbsp;<code>22 lessons</code>&nbsp; <em>Description</em></summary>
    const phaseHeaderMatch =
      line.match(/###\s+Phase\s+(\d+):\s+(.+?)\s*`(\d+)\s+lessons?`/) ||
      line.match(/###\s+!\[\]\([^)]*?Phase[_\s]+(\d+)[-_]([^?)]+?)-[A-F0-9]{6}[^)]*\)\s*`(\d+)\s+lessons?`/i);
    const detailsHeaderMatch =
      line.match(/<summary><strong>Phase\s+(\d+):\s+(.+?)<\/strong>\s*<code>(\d+)\s+(?:lessons?|projects?)<\/code>.*?<em>(.*?)<\/em>/) ||
      line.match(/<summary>\s*<b>\s*(?:[^\w\s]+\s+)?Phase\s+(\d+)\s*[—\-:]\s*(.+?)<\/b>.*?<code>(\d+)\s+(?:lessons?|projects?)<\/code>.*?<em>(.*?)<\/em>/);

    if (phaseHeaderMatch) {
      const [, idStr, rawName] = phaseHeaderMatch;
      const id = parseInt(idStr);
      const name = rawName.replace(/_/g, ' ').trim();
      // Look for the description on the next line (blockquote)
      let desc = '';
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        if (lines[j].startsWith('>')) {
          desc = lines[j].replace(/^>\s*/, '').trim();
          break;
        }
      }
      const roadmapKey = `Phase ${id}`;
      const phaseStatus = roadmapStatuses[roadmapKey]?.phaseStatus || 'planned';
      currentPhase = { id, name: name.trim(), status: phaseStatus, desc, lessons: [] };
      phases.push(currentPhase);
      inLessonTable = false;
      continue;
    }

    if (detailsHeaderMatch) {
      const [, idStr, name, , desc] = detailsHeaderMatch;
      const id = parseInt(idStr);
      const roadmapKey = `Phase ${id}`;
      const phaseStatus = roadmapStatuses[roadmapKey]?.phaseStatus || 'planned';
      currentPhase = { id, name: name.trim(), status: phaseStatus, desc: desc?.trim() || '', lessons: [] };
      phases.push(currentPhase);
      inLessonTable = false;
      continue;
    }

    // Detect start of lesson table
    if (currentPhase && line.match(/^\|\s*#\s*\|\s*Lesson/)) {
      inLessonTable = true;
      isCapstoneTable = false;
      continue;
    }

    // Skip table separator
    if (inLessonTable && line.match(/^\|[\s:|-]+\|$/)) {
      continue;
    }

    // Parse lesson rows
    if (inLessonTable && currentPhase && line.startsWith('|')) {
      // | 01 | [Dev Environment](phases/00-setup-and-tooling/01-dev-environment/) | Build | Python, Node, Rust |
      // | 02 | Multi-Layer Networks & Forward Pass | Build | Python |
      const cols = line.split('|').map(c => c.trim()).filter(c => c.length > 0);
      if (cols.length >= 4) {
        const lessonCol = cols[1];
        const typeRaw = cols[2];
        const langRaw = cols[3];

        // Type may be plain ("Build") or a shield image: ![Build](https://...)
        const typeBadgeMatch = typeRaw.match(/!\[([^\]]+)\]/);
        const type = typeBadgeMatch ? typeBadgeMatch[1] : typeRaw;

        // Lang may be plain ("Python, Rust") or emoji flags (🐍 🟦 🦀 🟣 ⚛️)
        const EMOJI_LANG = {
          '🐍': 'Python',
          '🟦': 'TypeScript',
          '🦀': 'Rust',
          '🟣': 'Julia',
          '⚛️': 'React',
          '⚛': 'React',
        };
        let lang = langRaw;
        if (/[\uD800-\uDBFF\u2600-\u27BF\u1F300-\u1FAFF]/.test(langRaw) || /[🐍🟦🦀🟣⚛]/u.test(langRaw)) {
          const tokens = Array.from(langRaw)
            .map(ch => EMOJI_LANG[ch])
            .filter(Boolean);
          if (tokens.length) lang = [...new Set(tokens)].join(', ');
          else if (langRaw.trim() === '—' || langRaw.trim() === '-') lang = '';
        }
        if (lang === '—' || lang === '-') lang = '';

        // Check if lesson has a link (meaning it has content)
        const linkMatch = lessonCol.match(/\[(.+?)\]\((.+?)\)/);
        let lessonName, url;
        if (linkMatch) {
          lessonName = linkMatch[1];
          const relativePath = linkMatch[2];
          url = GITHUB_BASE + relativePath.replace(/^\//, '');
        } else {
          lessonName = lessonCol;
          url = null;
        }

        // Get status from roadmap
        const roadmapKey = `Phase ${currentPhase.id}`;
        const roadmapPhase = roadmapStatuses[roadmapKey];
        let status = 'planned';
        if (roadmapPhase) {
          // Try to find matching lesson by fuzzy match
          const lessonNameClean = lessonName.replace(/[-–—:]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
          for (const [rName, rStatus] of Object.entries(roadmapPhase.lessons)) {
            const rNameClean = rName.replace(/[-–—:]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
            if (rNameClean.includes(lessonNameClean) || lessonNameClean.includes(rNameClean) ||
                rNameClean.split(' ').slice(0, 3).join(' ') === lessonNameClean.split(' ').slice(0, 3).join(' ')) {
              status = rStatus;
              break;
            }
          }
        }

        // If it has a link, it's at least complete (override roadmap if needed)
        if (url && status === 'planned') {
          status = 'complete';
        }

        // Capstone tables use the middle column for prerequisite phase tokens
        // (e.g., "P11 P13 P14"), not a Build/Learn enum. Keep `type` on the
        // Build/Learn axis so CSS selectors (data-type="Build"/"Learn") stay
        // valid, and emit the prereq string in a dedicated `combines` field.
        const lessonEntry = {
          name: lessonName.trim(),
          status,
          type: isCapstoneTable ? 'Capstone' : type.trim(),
          lang: lang.trim() || '—',
          ...(isCapstoneTable && { combines: type.trim() }),
          ...(url && { url }),
        };
        currentPhase.lessons.push(lessonEntry);
      }
    }

    // End of table
    if (inLessonTable && (line.match(/<\/td>/) || line.match(/<\/details>/) || (line.trim() === '' && i + 1 < lines.length && !lines[i + 1].startsWith('|')))) {
      inLessonTable = false;
    }

    // Also detect capstone table format (# | Project | Combines | Lang)
    if (currentPhase && line.match(/^\|\s*#\s*\|\s*Project/)) {
      inLessonTable = true;
      isCapstoneTable = true;
      continue;
    }
  }

  return phases;
}

// ─── Parse focused learning paths ────────────────────────────────────
// A learning path is an ordered overlay on the canonical PHASES data. The
// manifest owns intent and pacing; README owns the lesson title and URL.
function parseLearningPaths(repoRoot = REPO_ROOT, phases = []) {
  const learningPathsDir = path.join(repoRoot, 'learning-paths');
  if (!fs.existsSync(learningPathsDir)) return [];

  const lessonsByPath = new Map();
  for (const phase of phases) {
    for (const lesson of phase.lessons || []) {
      const canonicalPath = lessonPath(lesson.url);
      if (!canonicalPath) continue;
      lessonsByPath.set(canonicalPath, {
        title: lesson.name,
        phaseId: phase.id,
        phaseName: phase.name,
        type: lesson.type,
        lang: lesson.lang,
      });
    }
  }

  const manifests = fs.readdirSync(learningPathsDir)
    .filter(file => file.endsWith('.json'))
    .sort();
  const ids = new Set();

  return manifests.map(file => {
    const manifestPath = path.join(learningPathsDir, file);
    const manifest = readJson(manifestPath, `learning path ${file}`);
    const id = String(manifest.id || path.basename(file, '.json')).trim();
    if (!id) throw new Error(`Learning path ${file} needs an id`);
    if (ids.has(id)) throw new Error(`Duplicate learning path id: ${id}`);
    ids.add(id);

    const prerequisiteIds = new Set();
    const prerequisites = (Array.isArray(manifest.prerequisites) ? manifest.prerequisites : [])
      .map((entry, index) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
          throw new Error(`Learning path ${id} prerequisite ${index + 1} must be an object`);
        }
        const normalized = { ...entry };
        if (!Object.prototype.hasOwnProperty.call(normalized, 'id')) return normalized;
        const checkId = String(normalized.id || '').trim();
        if (!checkId) {
          throw new Error(`Learning path ${id} prerequisite ${index + 1} has an empty id`);
        }
        if (prerequisiteIds.has(checkId)) {
          throw new Error(`Learning path ${id} repeats prerequisite id: ${checkId}`);
        }
        prerequisiteIds.add(checkId);
        normalized.id = checkId;
        return normalized;
      });

    function normalizePrerequisiteChecks(value, lessonPath) {
      if (value === undefined) return [];
      if (!Array.isArray(value)) {
        throw new Error(`Learning path ${id} lesson ${lessonPath} prerequisiteChecks must be an array`);
      }
      const seen = new Set();
      return value.map(rawId => {
        if (typeof rawId !== 'string' || !rawId.trim()) {
          throw new Error(`Learning path ${id} lesson ${lessonPath} has an invalid prerequisite check id`);
        }
        const checkId = rawId.trim();
        if (seen.has(checkId)) {
          throw new Error(`Learning path ${id} lesson ${lessonPath} repeats prerequisite check: ${checkId}`);
        }
        if (!prerequisiteIds.has(checkId)) {
          throw new Error(`Learning path ${id} lesson ${lessonPath} references an unknown prerequisite check: ${checkId}`);
        }
        seen.add(checkId);
        return checkId;
      });
    }

    function normalizePrerequisitePaths(value, lessonPath) {
      if (value === undefined) return [];
      if (!Array.isArray(value)) {
        throw new Error(`Learning path ${id} lesson ${lessonPath} prerequisitePaths must be an array`);
      }
      const seen = new Set();
      return value.map(rawPath => {
        if (typeof rawPath !== 'string') {
          throw new Error(`Learning path ${id} lesson ${lessonPath} has an invalid prerequisite path`);
        }
        const prerequisitePath = rawPath.replace(/^\/+|\/+$/g, '');
        if (!prerequisitePath) {
          throw new Error(`Learning path ${id} lesson ${lessonPath} has an invalid prerequisite path`);
        }
        if (seen.has(prerequisitePath)) {
          throw new Error(`Learning path ${id} lesson ${lessonPath} repeats prerequisite path: ${prerequisitePath}`);
        }
        seen.add(prerequisitePath);
        return prerequisitePath;
      });
    }

    function normalizeEntry(entry, index, required) {
      const source = typeof entry === 'string' ? { path: entry } : { ...(entry || {}) };
      const canonicalPath = String(source.path || '').replace(/^\/+|\/+$/g, '');
      if (!canonicalPath) {
        throw new Error(`Learning path ${id} has a lesson without a path`);
      }
      const lesson = lessonsByPath.get(canonicalPath);
      if (!lesson) {
        throw new Error(`Learning path ${id} references an unknown lesson: ${canonicalPath}`);
      }
      return {
        ...source,
        order: Number.isFinite(Number(source.order)) ? Number(source.order) : index + 1,
        path: canonicalPath,
        title: lesson.title,
        phaseId: lesson.phaseId,
        phaseName: lesson.phaseName,
        type: lesson.type,
        lang: lesson.lang,
        required: required ? source.required !== false : false,
        prerequisiteChecks: normalizePrerequisiteChecks(source.prerequisiteChecks, canonicalPath),
        ...(source.prerequisitePaths !== undefined && {
          prerequisitePaths: normalizePrerequisitePaths(source.prerequisitePaths, canonicalPath),
        }),
      };
    }

    const requiredEntries = Array.isArray(manifest.lessons) ? manifest.lessons : [];
    const optionalEntries = Array.isArray(manifest.optionalLessons) ? manifest.optionalLessons : [];
    if (!requiredEntries.length) throw new Error(`Learning path ${id} needs at least one lesson`);

    const byOrder = (a, b) => a.order - b.order;
    const lessons = requiredEntries
      .map((entry, index) => normalizeEntry(entry, index, true))
      .sort(byOrder);
    const optionalLessons = optionalEntries
      .map((entry, index) => normalizeEntry(entry, index, false))
      .sort(byOrder);
    const seenPaths = new Set();
    for (const entry of lessons.concat(optionalLessons)) {
      if (seenPaths.has(entry.path)) {
        throw new Error(`Learning path ${id} repeats lesson: ${entry.path}`);
      }
      seenPaths.add(entry.path);
    }

    const routeEntries = lessons.concat(optionalLessons);
    const routeIndex = new Map(routeEntries.map((entry, index) => [entry.path, index]));
    const prerequisiteGraph = new Map();
    for (const entry of routeEntries) {
      const prerequisitePaths = Array.isArray(entry.prerequisitePaths)
        ? entry.prerequisitePaths
        : [];
      for (const prerequisitePath of prerequisitePaths) {
        if (!lessonsByPath.has(prerequisitePath)) {
          throw new Error(
            `Learning path ${id} lesson ${entry.path} references an unknown prerequisite path: ${prerequisitePath}`
          );
        }
        if (prerequisitePath === entry.path) {
          throw new Error(`Learning path ${id} lesson ${entry.path} cannot depend on itself`);
        }
      }
      prerequisiteGraph.set(
        entry.path,
        prerequisitePaths.filter(prerequisitePath => routeIndex.has(prerequisitePath))
      );
    }

    const visiting = [];
    const visitingSet = new Set();
    const visited = new Set();
    function visitPrerequisites(lessonPath) {
      if (visitingSet.has(lessonPath)) {
        const cycleStart = visiting.indexOf(lessonPath);
        const cycle = visiting.slice(cycleStart).concat(lessonPath);
        throw new Error(`Learning path ${id} contains a prerequisite cycle: ${cycle.join(' -> ')}`);
      }
      if (visited.has(lessonPath)) return;
      visiting.push(lessonPath);
      visitingSet.add(lessonPath);
      for (const prerequisitePath of prerequisiteGraph.get(lessonPath) || []) {
        visitPrerequisites(prerequisitePath);
      }
      visiting.pop();
      visitingSet.delete(lessonPath);
      visited.add(lessonPath);
    }
    for (const entry of routeEntries) visitPrerequisites(entry.path);

    for (const entry of routeEntries) {
      for (const prerequisitePath of prerequisiteGraph.get(entry.path) || []) {
        if (routeIndex.get(prerequisitePath) >= routeIndex.get(entry.path)) {
          throw new Error(
            `Learning path ${id} lesson ${entry.path} has a forward prerequisite: ${prerequisitePath}`
          );
        }
      }
    }

    return {
      ...manifest,
      id,
      title: String(manifest.title || id).trim(),
      summary: String(manifest.summary || '').trim(),
      estimatedMinutes: Number(manifest.estimatedMinutes || 0),
      prerequisites,
      lessons,
      optionalLessons,
    };
  });
}

// ─── Resolve figure IDs to the provider scripts that register them ─────────
// Lessons are fetched at runtime and translated lessons can retain figure
// fences, so the browser resolves providers from the rendered data-figure IDs.
// The build emits only IDs that are actually used by lesson Markdown.
function collectMarkdownFiles(directory, files = []) {
  if (!fs.existsSync(directory)) return files;
  const entries = fs.readdirSync(directory, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) collectMarkdownFiles(fullPath, files);
    else if (entry.isFile() && entry.name.endsWith('.md')) files.push(fullPath);
  }
  return files;
}

function discoverUsedFigureIds(repoRoot = REPO_ROOT) {
  const ids = new Set();
  const roots = [path.join(repoRoot, 'phases'), path.join(repoRoot, 'certifications')];
  for (const root of roots) {
    for (const file of collectMarkdownFiles(root, [])) {
      const markdown = fs.readFileSync(file, 'utf8');
      for (const match of markdown.matchAll(/```figure\s*\r?\n([\s\S]*?)```/g)) {
        const id = match[1].trim().split(/\s+/)[0];
        if (id) ids.add(id);
      }
    }
  }
  return [...ids].sort();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assetVersion(content) {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 12);
}

function discoverFigureProviderOrder(siteDir = __dirname, baseOrder = FIGURE_PROVIDER_ORDER) {
  const known = new Set(baseOrder);
  const additions = fs.readdirSync(siteDir)
    .filter(file => /^figures(?:-[a-z0-9-]+)?\.js$/i.test(file) && !known.has(file))
    .sort((a, b) => a.localeCompare(b));
  return baseOrder.concat(additions);
}

function buildFigureProviderManifest(
  repoRoot = REPO_ROOT,
  siteDir = __dirname,
  providerOrder
) {
  const resolvedProviderOrder = Array.isArray(providerOrder)
    ? providerOrder.slice()
    : discoverFigureProviderOrder(siteDir);
  const providerSources = new Map();
  const providerVersions = {};
  for (const provider of resolvedProviderOrder) {
    const providerPath = path.join(siteDir, provider);
    if (!fs.existsSync(providerPath)) throw new Error(`Missing figure provider: ${provider}`);
    const source = fs.readFileSync(providerPath, 'utf8');
    providerSources.set(provider, source);
    providerVersions[provider] = assetVersion(source);
  }
  const localSource = fs.readFileSync(path.join(siteDir, 'lesson-figures.js'), 'utf8');
  const providersByFigure = {};
  const unresolved = [];
  for (const id of discoverUsedFigureIds(repoRoot)) {
    const quotedId = new RegExp(`['"]${escapeRegExp(id)}['"]`);
    const providers = resolvedProviderOrder.filter(provider => quotedId.test(providerSources.get(provider)));
    if (providers.length) providersByFigure[id] = providers;
    else if (!quotedId.test(localSource)) unresolved.push(id);
  }
  if (unresolved.length) {
    throw new Error(`Figure IDs have no provider: ${unresolved.join(', ')}`);
  }
  return { providerOrder: resolvedProviderOrder, providerVersions, providersByFigure };
}

function syncFigureAssetVersions(siteDir, manifestSource) {
  const lessonPath = path.join(siteDir, 'lesson.html');
  const runtimePath = path.join(siteDir, 'lesson-figures.js');
  if (!fs.existsSync(lessonPath) || !fs.existsSync(runtimePath)) return;

  const versions = {
    'lesson-figures.js': assetVersion(fs.readFileSync(runtimePath, 'utf8')),
    'figure-manifest.js': assetVersion(manifestSource),
  };
  let html = fs.readFileSync(lessonPath, 'utf8');
  for (const [file, version] of Object.entries(versions)) {
    const reference = new RegExp(`(<script src="${escapeRegExp(file)})(?:\\?v=[^"]*)?("></script>)`);
    if (!reference.test(html)) throw new Error(`lesson.html is missing the ${file} script reference`);
    html = html.replace(reference, `$1?v=${version}$2`);
  }
  fs.writeFileSync(lessonPath, html, 'utf8');
}

function serializeFigureProviderManifest(manifest) {
  return '// Auto-generated by build.js from lesson figure fences and provider registrations.\n' +
    '// Provider order is significant: later registrations override earlier ones.\n' +
    `window.AIFS_FIGURE_PROVIDER_ORDER = ${JSON.stringify(manifest.providerOrder, null, 2)};\n` +
    `window.AIFS_FIGURE_PROVIDER_VERSIONS = ${JSON.stringify(manifest.providerVersions, null, 2)};\n` +
    `window.AIFS_FIGURE_PROVIDERS = ${JSON.stringify(manifest.providersByFigure, null, 2)};\n`;
}

function writeFigureManifest(repoRoot = REPO_ROOT, siteDir = __dirname) {
  const manifest = buildFigureProviderManifest(repoRoot, siteDir);
  const output = serializeFigureProviderManifest(manifest);
  const outputPath = siteDir === __dirname
    ? FIGURE_MANIFEST_OUTPUT_PATH
    : path.join(siteDir, 'figure-manifest.js');
  fs.writeFileSync(outputPath, output, 'utf8');
  syncFigureAssetVersions(siteDir, output);
  console.log(`   wrote figure-manifest.js (${Object.keys(manifest.providersByFigure).length} routed figures)`);
  return manifest;
}

// ─── Parse the canonical phase dependency graph from README.md ───────
// The public Mermaid diagram under "The shape of the curriculum" owns the
// phase-level learning path. Keeping the website graph generated from it
// prevents the interactive roadmap from drifting into a second curriculum.
function parseCurriculumPrereqs(content, phases) {
  const section = content.match(/## The shape of the curriculum[\s\S]*?```mermaid\s*\r?\n([\s\S]*?)```/);
  if (!section) throw new Error('README.md is missing the canonical curriculum Mermaid graph');

  const phaseIds = phases.map(phase => phase.id).sort((a, b) => a - b);
  const validIds = new Set(phaseIds);
  const prerequisites = {};
  const children = {};
  const seenEdges = new Set();
  for (const id of phaseIds) {
    prerequisites[id] = [];
    children[id] = [];
  }

  for (const line of section[1].split(/\r?\n/)) {
    const match = line.match(/^\s*P(\d+)(?:\[[^\]]*\])?\s*-->\s*P(\d+)/);
    if (!match) continue;
    const from = Number(match[1]);
    const to = Number(match[2]);
    if (!validIds.has(from) || !validIds.has(to)) {
      throw new Error(`Curriculum edge P${from} -> P${to} references an unknown phase`);
    }
    if (from === to) throw new Error(`Curriculum phase P${from} cannot depend on itself`);
    const key = `${from}-${to}`;
    if (seenEdges.has(key)) throw new Error(`Duplicate curriculum edge P${from} -> P${to}`);
    seenEdges.add(key);
    prerequisites[to].push(from);
    children[from].push(to);
  }

  if (!seenEdges.size) throw new Error('The canonical curriculum Mermaid graph contains no edges');

  const roots = phaseIds.filter(id => prerequisites[id].length === 0);
  if (roots.length !== 1 || roots[0] !== 0) {
    throw new Error(`Curriculum graph must have Phase 0 as its only root; found ${roots.join(', ') || 'none'}`);
  }

  const reached = new Set([0]);
  const queue = [0];
  while (queue.length) {
    const id = queue.shift();
    for (const child of children[id]) {
      if (reached.has(child)) continue;
      reached.add(child);
      queue.push(child);
    }
  }
  const unreachable = phaseIds.filter(id => !reached.has(id));
  if (unreachable.length) {
    throw new Error(`Curriculum graph has unreachable phases: ${unreachable.join(', ')}`);
  }

  const visiting = new Set();
  const visited = new Set();
  function visit(id) {
    if (visiting.has(id)) throw new Error(`Curriculum graph contains a cycle through Phase ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const child of children[id]) visit(child);
    visiting.delete(id);
    visited.add(id);
  }
  visit(0);

  return prerequisites;
}

// ─── Extract lesson summary + keywords from docs/en.md ───────────────
/**
 * Single-pass read of a lesson's docs/en.md.
 *
 * Returns:
 *   summary  — first `> blockquote` line (the lesson's one-liner motto).
 *   keywords — all `### H3` heading texts joined by ' · '.
 *              H3 headings are the densest vocabulary in a lesson doc
 *              (e.g. "Scaled dot-product · Causal masking · KV cache"),
 *              so they extend search coverage without bloating data.js.
 *
 * Both fields are empty strings when the file is absent or has no
 * matching content — expected for planned lessons with no docs yet.
 */
function extractLessonMeta(relPath) {
  const docPath = path.join(REPO_ROOT, relPath, 'docs', 'en.md');
  const result = { summary: '', keywords: '' };
  try {
    const lines = fs.readFileSync(docPath, 'utf8').split(/\r?\n/);
    const h3s = [];
    for (const raw of lines) {
      const line = raw.trim();
      if (!result.summary && line.startsWith('> ') && line.length > 3) {
        const s = line.slice(2).trim();
        result.summary = s.length > 180 ? s.slice(0, 177) + '…' : s;
      }
      if (line.startsWith('### ')) {
        const heading = line.slice(4).trim();
        if (heading) h3s.push(heading);
      }
    }
    if (h3s.length) result.keywords = h3s.join(' · ');
  } catch (_) {
    // File absent or unreadable — expected for planned lessons.
  }
  return result;
}

// ─── Certification programs, tracks, lessons, and assessments ─────────
// Certifications are a curated overlay, not another curriculum phase. They
// deliberately live in their own generated data file so PHASES, README counts,
// the core catalog, and roadmap behavior cannot change when a track is added.
function readJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    throw new Error(`Could not read ${label || path.relative(REPO_ROOT, filePath)}: ${err.message}`);
  }
}

function safeRepoPath(relPath, baseDir) {
  if (!relPath || typeof relPath !== 'string') return null;
  const candidate = path.resolve(baseDir || REPO_ROOT, relPath);
  const rootWithSep = REPO_ROOT.endsWith(path.sep) ? REPO_ROOT : REPO_ROOT + path.sep;
  if (candidate !== REPO_ROOT && !candidate.startsWith(rootWithSep)) return null;
  return candidate;
}

function certificationDocMeta(markdown, fallbackName) {
  const result = {
    name: fallbackName || '',
    summary: '',
    keywords: '',
    type: 'Learn',
    languages: '',
    prerequisites: '',
    time: '',
  };
  const headings = [];
  for (const raw of String(markdown || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('# ') && !result.name) result.name = line.slice(2).trim();
    if (line.startsWith('# ')) result.name = line.slice(2).trim();
    if (!result.summary && line.startsWith('> ')) result.summary = line.slice(2).trim();
    if (line.startsWith('### ')) headings.push(line.slice(4).trim());
    const field = line.match(/^\*\*(Type|Languages|Prerequisites|Time):\*\*\s*(.+)$/i);
    if (field) {
      const key = field[1].toLowerCase();
      if (key === 'type') result.type = field[2].trim();
      else result[key] = field[2].trim();
    }
  }
  result.keywords = headings.filter(Boolean).join(' · ');
  if (result.summary.length > 180) result.summary = result.summary.slice(0, 177) + '…';
  return result;
}

function normalizeLessonRef(ref) {
  if (typeof ref === 'string') return { path: ref };
  if (!ref || typeof ref !== 'object') return null;
  return { ...ref };
}

function quizContentVersion(quiz) {
  if (!quiz) return null;
  return crypto.createHash('sha256').update(JSON.stringify(quiz)).digest('hex');
}

function trackDeclarationValue(declaration) {
  if (typeof declaration === 'string') return declaration;
  if (!declaration || typeof declaration !== 'object') return '';
  return declaration.id || declaration.slug || declaration.path || declaration.file || '';
}

function trackDeclarationIndex(program, track, file) {
  if (!Array.isArray(program.tracks)) return -1;
  return program.tracks.findIndex(declaration => {
    const value = trackDeclarationValue(declaration);
    if (!value) return false;
    const declaredFile = path.basename(value);
    const declaredSlug = path.basename(value, path.extname(value));
    return value === track.id ||
      value === track.slug ||
      declaredFile === file ||
      declaredSlug === track.slug;
  });
}

function assertCertificationTrackOrder(program, tracks) {
  const declaredTrackIds = Array.isArray(program.tracks) ? program.tracks : [];
  const emittedTrackIds = tracks.map(track => track.id);
  const matches = declaredTrackIds.length === emittedTrackIds.length &&
    declaredTrackIds.every((id, index) => id === emittedTrackIds[index]);
  if (!matches) {
    throw new Error(
      'Certification track order mismatch: program.json declares ' +
      JSON.stringify(declaredTrackIds) + ' but track manifests emit ' +
      JSON.stringify(emittedTrackIds)
    );
  }
}

function resolveAssessmentFile(programDir, assessmentPath) {
  if (!assessmentPath) return null;
  const fromRoot = safeRepoPath(assessmentPath, REPO_ROOT);
  if (fromRoot && fs.existsSync(fromRoot)) return fromRoot;
  const fromProgram = safeRepoPath(assessmentPath, programDir);
  if (fromProgram && fs.existsSync(fromProgram)) return fromProgram;
  return fromRoot || fromProgram;
}

function certificationLessonFiles(lessonDir, lessonRelPath, folderName) {
  const folderPath = path.join(lessonDir, folderName);
  if (!fs.existsSync(folderPath)) return [];

  const files = [];
  function collectFiles(currentDir, relativeDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory() && folderName === 'outputs') {
        collectFiles(fullPath, relativePath);
      } else if (entry.isFile()) {
        files.push({ fullPath, relativePath });
      }
    }
  }
  collectFiles(folderPath, '');

  return files.map(file => {
    const { fullPath, relativePath } = file;
    let description = '';
    if (folderName === 'outputs' && relativePath.endsWith('.md')) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const meta = parseFrontmatter(content) || {};
        description = String(meta.description || '').trim();
        if (!description) {
          description = content.split(/\r?\n/)
            .map(line => line.trim())
            .find(line => line && !line.startsWith('#') && line !== '---') || '';
        }
      } catch (_) {}
    }
    return {
      name: relativePath,
      path: `${lessonRelPath}/${folderName}/${relativePath}`,
      size: fs.statSync(fullPath).size,
      description,
    };
  });
}

function parseCertifications() {
  const empty = { program: null, tracks: [], lessonsByPath: {}, assessmentsById: {} };
  if (!fs.existsSync(CERTIFICATIONS_PATH)) return empty;

  const programDirs = fs.readdirSync(CERTIFICATIONS_PATH, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(CERTIFICATIONS_PATH, entry.name))
    .filter(dir => fs.existsSync(path.join(dir, 'program.json')))
    .sort();
  if (!programDirs.length) return empty;

  // The site currently presents one certification program. Keep the generated
  // shape program-oriented so another provider can be added without touching
  // PHASES or changing reader behavior.
  const programDir = programDirs[0];
  const program = readJson(path.join(programDir, 'program.json'), 'certification program');
  const programSlug = program.slug || program.id || path.basename(programDir);
  const tracksDir = path.join(programDir, 'tracks');
  const trackFiles = fs.existsSync(tracksDir)
    ? fs.readdirSync(tracksDir).filter(file => file.endsWith('.json')).sort()
    : [];
  const trackEntries = trackFiles.map(file => {
    const track = readJson(path.join(tracksDir, file), `certification track ${file}`);
    track.id = track.id || `${programSlug}-${track.slug || path.basename(file, '.json')}`;
    track.slug = track.slug || path.basename(file, '.json');
    track.lessons = Array.isArray(track.lessons)
      ? track.lessons.map(normalizeLessonRef).filter(Boolean)
      : [];
    track.assessments = Array.isArray(track.assessments) ? track.assessments : [];
    return { file, track };
  });
  trackEntries.sort((a, b) => {
    const aIndex = trackDeclarationIndex(program, a.track, a.file);
    const bIndex = trackDeclarationIndex(program, b.track, b.file);
    if (aIndex !== -1 || bIndex !== -1) {
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      if (aIndex !== bIndex) return aIndex - bIndex;
    }
    return a.file.localeCompare(b.file);
  });
  const tracks = trackEntries.map(entry => entry.track);
  assertCertificationTrackOrder(program, tracks);

  const lessonsByPath = {};
  const lessonsDir = path.join(programDir, 'lessons');
  if (fs.existsSync(lessonsDir)) {
    for (const entry of fs.readdirSync(lessonsDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.isDirectory()) continue;
      const relPath = path.relative(REPO_ROOT, path.join(lessonsDir, entry.name)).split(path.sep).join('/');
      const docPath = path.join(lessonsDir, entry.name, 'docs', 'en.md');
      if (!fs.existsSync(docPath)) continue;
      const markdown = fs.readFileSync(docPath, 'utf8');
      const quizPath = path.join(lessonsDir, entry.name, 'quiz.json');
      const quiz = fs.existsSync(quizPath) ? readJson(quizPath, `${relPath}/quiz.json`) : null;
      const meta = certificationDocMeta(markdown, entry.name.replace(/^\d+-/, '').replace(/-/g, ' '));
      const lessonDir = path.join(lessonsDir, entry.name);
      lessonsByPath[relPath] = {
        path: relPath,
        slug: entry.name,
        name: meta.name,
        summary: meta.summary,
        keywords: meta.keywords,
        type: meta.type,
        languages: meta.languages,
        prerequisites: meta.prerequisites,
        time: meta.time,
        markdown,
        quiz,
        quizVersion: quizContentVersion(quiz),
        files: {
          code: certificationLessonFiles(lessonDir, relPath, 'code'),
          outputs: certificationLessonFiles(lessonDir, relPath, 'outputs'),
        },
        trackIds: [],
        domainsByTrack: {},
        rolesByTrack: {},
      };
    }
  }

  for (const track of tracks) {
    for (const ref of track.lessons) {
      const lesson = lessonsByPath[ref.path];
      if (!lesson) continue;
      if (!lesson.trackIds.includes(track.id)) lesson.trackIds.push(track.id);
      lesson.domainsByTrack[track.id] = Array.isArray(ref.domains) ? ref.domains : [];
      lesson.rolesByTrack[track.id] = ref.role || '';
    }
  }

  const assessmentsById = {};
  for (const track of tracks) {
    track.assessments = track.assessments.map((meta, index) => {
      const normalized = typeof meta === 'string' ? { path: meta } : { ...(meta || {}) };
      const assessmentLabel = normalized.id || normalized.title || `assessment ${index + 1}`;
      if (!normalized.path) {
        throw new Error(`Certification assessment "${assessmentLabel}" in track "${track.id}" must declare a source path`);
      }
      const assessmentFile = resolveAssessmentFile(programDir, normalized.path);
      if (!assessmentFile || !fs.existsSync(assessmentFile)) {
        throw new Error(`Missing certification assessment source for "${assessmentLabel}" in track "${track.id}": ${normalized.path}`);
      }
      const data = readJson(assessmentFile, normalized.path);
      const id = normalized.id || data.id || `${track.id}-${normalized.kind || data.kind || `assessment-${index + 1}`}`;
      const merged = {
        ...data,
        ...normalized,
        id,
        track: normalized.track || data.track || track.id,
        kind: normalized.kind || data.kind || 'practice',
        title: normalized.title || data.title || 'Practice assessment',
        timeLimitMinutes: Number(normalized.timeLimitMinutes || data.timeLimitMinutes || 0),
      };
      assessmentsById[id] = merged;
      return {
        id,
        path: normalized.path || '',
        kind: merged.kind,
        title: merged.title,
        timeLimitMinutes: merged.timeLimitMinutes,
        questionCount: Array.isArray(merged.questions) ? merged.questions.length : 0,
      };
    });
  }

  return { program, tracks, lessonsByPath, assessmentsById };
}

function writeCertificationData(certifications) {
  const output = `// Auto-generated by build.js from certifications/ — do not edit manually.\n` +
    `// Last built: ${new Date().toISOString()}\n\n` +
    `const CERTIFICATIONS = ${JSON.stringify(certifications, null, 2)};\n`;
  fs.writeFileSync(CERTIFICATION_OUTPUT_PATH, output, 'utf8');
  console.log(`   wrote certification-data.js (${certifications.tracks.length} tracks)`);
}

// ─── Parse glossary/terms.md ──────────────────────────────────────────
const GLOSSARY_CATEGORY_ORDER = [
  'Math & training',
  'Models & inference',
  'Data & representations',
  'Retrieval & generation',
  'Prompting & context',
  'Agents & tools',
  'Evaluation & safety',
  'AI-native development',
  'Infrastructure & serving',
  'Reliability & operations',
  'Security & governance',
  'Multimodal systems',
];

const GLOSSARY_CATEGORIES = new Set(GLOSSARY_CATEGORY_ORDER);

const GLOSSARY_FIELD_KEYS = new Map([
  ['Category', 'category'],
  ['What people say', 'says'],
  ['What it actually means', 'means'],
  ['Why it matters', 'whyItMatters'],
  ['In practice', 'example'],
  ['Common confusion', 'confusion'],
  ['Aliases', 'aliases'],
  ['Related terms', 'related'],
  ['Learn it', 'lessons'],
  ['Sources', 'sources'],
  ["Why it's called that", 'whyCalled'],
]);

function glossaryError(lineNumber, term, message) {
  const context = term ? ` (term "${term}")` : '';
  throw new Error(`glossary/terms.md:${lineNumber}${context}: ${message}`);
}

function glossarySlug(term) {
  return term
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function glossaryLookupKey(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US')
    .trim()
    .replace(/\s+/g, ' ');
}

function glossaryList(value) {
  return value.split(/[,;]/).map(item => item.trim()).filter(Boolean);
}

function glossaryLinks(value, fieldLabel, lineNumber, term) {
  const links = [];
  let cursor = 0;

  while (cursor < value.length) {
    while (cursor < value.length && /[\s,;]/.test(value[cursor])) cursor++;
    if (cursor >= value.length) break;

    if (value[cursor] === '[') {
      const closeLabel = value.indexOf(']', cursor + 1);
      if (closeLabel === -1 || value[closeLabel + 1] !== '(') {
        glossaryError(lineNumber, term, `${fieldLabel} contains a malformed Markdown link`);
      }
      const label = value.slice(cursor + 1, closeLabel).trim();
      let depth = 1;
      let closeUrl = closeLabel + 2;
      for (; closeUrl < value.length && depth > 0; closeUrl++) {
        if (value[closeUrl] === '\\') {
          closeUrl++;
          continue;
        }
        if (value[closeUrl] === '(') depth++;
        if (value[closeUrl] === ')') depth--;
      }
      if (depth !== 0) {
        glossaryError(lineNumber, term, `${fieldLabel} contains a malformed Markdown link`);
      }
      const url = value.slice(closeLabel + 2, closeUrl - 1).trim();
      if (!label || !url) {
        glossaryError(lineNumber, term, `${fieldLabel} links need both a label and a URL`);
      }
      links.push({ label, url });
      cursor = closeUrl;
    } else {
      const nextSeparator = value.slice(cursor).search(/[,;]/);
      const end = nextSeparator === -1 ? value.length : cursor + nextSeparator;
      const item = value.slice(cursor, end).trim();
      if (/[\[\]]/.test(item)) {
        glossaryError(lineNumber, term, `${fieldLabel} contains a malformed Markdown link`);
      }
      if (item) {
        const isUrl = /^(?:https?:\/\/|\/|\.\.?\/)/.test(item);
        links.push({ label: item, url: isUrl ? item : '' });
      }
      cursor = end;
    }

    while (cursor < value.length && /\s/.test(value[cursor])) cursor++;
    if (cursor < value.length && value[cursor] !== ',' && value[cursor] !== ';') {
      glossaryError(lineNumber, term, `${fieldLabel} items must be separated by a comma or semicolon`);
    }
  }

  return links;
}

function parseGlossary(content) {
  const terms = [];
  let currentTerm = null;
  const seenTerms = new Map();
  const seenSlugs = new Map();
  const lines = content.split(/\r?\n/);

  function finishEntry() {
    if (!currentTerm) return;
    if (!currentTerm.category) {
      glossaryError(currentTerm.headerLine, currentTerm.term, 'missing required field "Category"');
    }
    if (!currentTerm.means) {
      glossaryError(currentTerm.headerLine, currentTerm.term, 'missing required field "What it actually means"');
    }
    const { headerLine, fields, ...entry } = currentTerm;
    terms.push(entry);
    currentTerm = null;
  }

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const lineNumber = index + 1;
    if (/^###\s*$/.test(line)) glossaryError(lineNumber, '', 'term heading cannot be empty');
    const termMatch = line.match(/^###\s+(.+?)\s*$/);
    if (termMatch) {
      finishEntry();
      const term = termMatch[1].trim();
      const normalizedTerm = term.toLocaleLowerCase('en-US');
      if (seenTerms.has(normalizedTerm)) {
        glossaryError(lineNumber, term, `duplicate term; first declared on line ${seenTerms.get(normalizedTerm)}`);
      }
      const slug = glossarySlug(term);
      if (!slug) glossaryError(lineNumber, term, 'term must contain at least one letter or number');
      if (seenSlugs.has(slug)) {
        const first = seenSlugs.get(slug);
        glossaryError(lineNumber, term, `duplicate slug "${slug}"; first used by "${first.term}" on line ${first.line}`);
      }
      seenTerms.set(normalizedTerm, lineNumber);
      seenSlugs.set(slug, { term, line: lineNumber });
      const firstCharacter = term.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').match(/[a-z0-9]/i);
      currentTerm = {
        term,
        slug,
        letter: firstCharacter ? firstCharacter[0].toUpperCase() : '#',
        category: '',
        says: '',
        means: '',
        whyItMatters: '',
        example: '',
        confusion: '',
        aliases: [],
        related: [],
        lessons: [],
        sources: [],
        whyCalled: '',
        headerLine: lineNumber,
        fields: new Set(),
      };
      continue;
    }

    // Alphabet headings end the previous entry but are not glossary terms.
    if (/^#{1,2}\s+/.test(line)) {
      finishEntry();
      continue;
    }

    const fieldMatch = line.match(/^\s*-\s+\*\*([^*]+):\*\*\s*(.*?)\s*$/);
    if (!currentTerm) {
      if (fieldMatch) glossaryError(lineNumber, '', `field "${fieldMatch[1].trim()}" appears before a term heading`);
      continue;
    }

    if (fieldMatch) {
      const label = fieldMatch[1].trim();
      const value = fieldMatch[2].trim();
      const key = GLOSSARY_FIELD_KEYS.get(label);
      if (!key) glossaryError(lineNumber, currentTerm.term, `unknown field "${label}"`);
      if (currentTerm.fields.has(label)) glossaryError(lineNumber, currentTerm.term, `duplicate field "${label}"`);
      if (!value) glossaryError(lineNumber, currentTerm.term, `field "${label}" cannot be empty`);
      currentTerm.fields.add(label);

      if (key === 'category') {
        if (!GLOSSARY_CATEGORIES.has(value)) {
          glossaryError(lineNumber, currentTerm.term, `unknown category "${value}"`);
        }
        currentTerm.category = value;
      } else if (key === 'aliases' || key === 'related') {
        const items = glossaryList(value);
        if (!items.length) glossaryError(lineNumber, currentTerm.term, `field "${label}" needs at least one item`);
        currentTerm[key] = items;
      } else if (key === 'lessons' || key === 'sources') {
        const links = glossaryLinks(value, label, lineNumber, currentTerm.term);
        if (!links.length) glossaryError(lineNumber, currentTerm.term, `field "${label}" needs at least one item`);
        if (links.some(link => !link.url)) {
          glossaryError(lineNumber, currentTerm.term, `field "${label}" requires a URL for every item`);
        }
        currentTerm[key] = links;
      } else if (key === 'says') {
        currentTerm.says = value.replace(/^"/, '').replace(/"$/, '').trim();
      } else {
        currentTerm[key] = value;
      }
      continue;
    }

    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('<!--')) {
      glossaryError(lineNumber, currentTerm.term, 'expected a canonical bullet field or the next term heading');
    }
  }

  finishEntry();

  const lookupOwners = new Map();
  for (const entry of terms) {
    const key = glossaryLookupKey(entry.term);
    const existing = lookupOwners.get(key);
    if (existing) {
      const entryLine = seenTerms.get(entry.term.toLocaleLowerCase('en-US')) || 1;
      glossaryError(
        entryLine,
        entry.term,
        `normalized term collides with canonical term "${existing.label}" on term "${existing.entry.term}"`
      );
    }
    lookupOwners.set(key, { entry, label: entry.term, kind: 'term' });
  }
  for (const entry of terms) {
    const entryLine = seenTerms.get(entry.term.toLocaleLowerCase('en-US')) || 1;
    for (const alias of entry.aliases) {
      const key = glossaryLookupKey(alias);
      const existing = lookupOwners.get(key);
      if (existing) {
        const ownership = existing.entry === entry
          ? `duplicates its ${existing.kind} "${existing.label}"`
          : `collides with ${existing.kind} "${existing.label}" on term "${existing.entry.term}"`;
        glossaryError(entryLine, entry.term, `alias "${alias}" ${ownership}`);
      }
      lookupOwners.set(key, { entry, label: alias, kind: 'alias' });
    }
  }
  for (const entry of terms) {
    const entryLine = seenTerms.get(entry.term.toLocaleLowerCase('en-US')) || 1;
    for (const related of entry.related) {
      if (!lookupOwners.has(glossaryLookupKey(related))) {
        glossaryError(entryLine, entry.term, `related term "${related}" does not resolve to a glossary entry or alias`);
      }
    }
    for (const lesson of entry.lessons) {
      if (/^https?:\/\//i.test(lesson.url)) continue;
      const localPath = path.resolve(path.dirname(GLOSSARY_PATH), lesson.url.split(/[?#]/)[0]);
      const rootWithSep = REPO_ROOT.endsWith(path.sep) ? REPO_ROOT : REPO_ROOT + path.sep;
      if (!localPath.startsWith(rootWithSep) || !fs.existsSync(localPath)) {
        glossaryError(entryLine, entry.term, `Learn it target "${lesson.url}" does not exist in the repository`);
      }
      const stats = fs.statSync(localPath);
      if (stats.isDirectory() && !fs.existsSync(path.join(localPath, 'docs', 'en.md'))) {
        glossaryError(entryLine, entry.term, `Learn it target "${lesson.url}" is not a lesson with docs/en.md`);
      }
    }
  }

  return terms;
}

// ─── Discover outputs/ artifacts (skills / prompts / agents) ──────────
function parseFrontmatter(text) {
  if (!text.startsWith('---')) return null;
  const end = text.indexOf('\n---', 4);
  if (end === -1) return null;
  const block = text.slice(4, end);
  const result = {};
  for (const raw of block.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line || line.startsWith('#') || !line.includes(':')) continue;
    const idx = line.indexOf(':');
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (value.startsWith('[') && value.endsWith(']')) {
      const inner = value.slice(1, -1).trim();
      result[key] = inner
        ? inner.split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
        : [];
    } else if ((value.startsWith('"') && value.endsWith('"')) ||
               (value.startsWith("'") && value.endsWith("'"))) {
      result[key] = value.slice(1, -1);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function assertRepositoryContainment(targetDir, repoRoot, label) {
  const resolvedRepoRoot = fs.realpathSync(repoRoot);
  const resolvedTarget = fs.realpathSync(targetDir);
  const rootPrefix = resolvedRepoRoot.endsWith(path.sep)
    ? resolvedRepoRoot
    : resolvedRepoRoot + path.sep;
  if (resolvedTarget !== resolvedRepoRoot && !resolvedTarget.startsWith(rootPrefix)) {
    throw new Error(`${label} escapes the repository: ${targetDir}`);
  }
  const targetStat = fs.lstatSync(targetDir);
  if (targetStat.isSymbolicLink() || !targetStat.isDirectory()) {
    throw new Error(`${label} must be a regular directory: ${targetDir}`);
  }
}

function listSkillBundleFiles(bundleDir, repoRoot) {
  const rootStat = fs.lstatSync(bundleDir);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    throw new Error(`Skill bundle must be a regular directory: ${bundleDir}`);
  }
  assertRepositoryContainment(bundleDir, repoRoot, 'Skill bundle');
  const files = [];
  function visit(currentDir, relativeDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true })
      .sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) {
        throw new Error(`Skill bundle contains a symlink: ${fullPath}`);
      }
      if (entry.isDirectory()) {
        visit(fullPath, relativePath);
      } else if (entry.isFile()) {
        files.push(relativePath);
      } else {
        throw new Error(`Skill bundle contains a non-regular file: ${fullPath}`);
      }
    }
  }
  visit(bundleDir, '');
  return files.sort();
}

function discoverArtifacts(repoRoot = REPO_ROOT) {
  const artifacts = [];
  const phasesDir = path.join(repoRoot, 'phases');
  if (!fs.existsSync(phasesDir)) return artifacts;
  const VALID_TYPES = ['skill', 'prompt', 'agent'];
  for (const phaseDirName of fs.readdirSync(phasesDir).sort()) {
    const phaseMatch = phaseDirName.match(/^([0-9]{2})-([a-z0-9-]+)$/);
    if (!phaseMatch) continue;
    const phaseId = parseInt(phaseMatch[1], 10);
    const phaseDir = path.join(phasesDir, phaseDirName);
    for (const lessonDirName of fs.readdirSync(phaseDir).sort()) {
      const lessonMatch = lessonDirName.match(/^([0-9]{2})-([a-z0-9-]+)$/);
      if (!lessonMatch) continue;
      const lessonId = parseInt(lessonMatch[1], 10);
      const lessonRel = `phases/${phaseDirName}/${lessonDirName}`;
      const outputsDir = path.join(phaseDir, lessonDirName, 'outputs');
      if (fs.existsSync(outputsDir)) {
        assertRepositoryContainment(outputsDir, repoRoot, 'Lesson outputs');
        const entries = fs.readdirSync(outputsDir, { withFileTypes: true })
          .sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
        for (const entry of entries) {
          if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
          const file = entry.name;
          const stem = file.replace(/\.md$/, '');
          const type = VALID_TYPES.find(t => stem.startsWith(`${t}-`));
          if (!type) continue;
          let meta = {};
          try {
            meta = parseFrontmatter(fs.readFileSync(path.join(outputsDir, file), 'utf8')) || {};
          } catch (_) {}
          artifacts.push({
            kind: type,
            name: (meta.name || stem).trim(),
            description: (meta.description || '').trim(),
            tags: Array.isArray(meta.tags) ? meta.tags : [],
            phase: phaseId,
            lesson: lessonId,
            lessonPath: lessonRel,
            file: `${lessonRel}/outputs/${file}`,
          });
        }
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const bundleDir = path.join(outputsDir, entry.name);
          const skillPath = path.join(bundleDir, 'SKILL.md');
          if (!fs.existsSync(skillPath)) continue;
          const files = listSkillBundleFiles(bundleDir, repoRoot);
          if (!files.includes('SKILL.md')) continue;
          let meta = {};
          try {
            meta = parseFrontmatter(fs.readFileSync(skillPath, 'utf8')) || {};
          } catch (_) {}
          artifacts.push({
            kind: 'skill',
            name: (meta.name || entry.name).trim(),
            description: (meta.description || '').trim(),
            tags: Array.isArray(meta.tags) ? meta.tags : [],
            version: (meta.version || '').trim(),
            ...(meta.license && { license: String(meta.license).trim() }),
            ...(meta.compatibility && { compatibility: String(meta.compatibility).trim() }),
            ...(meta['allowed-tools'] && { allowedTools: String(meta['allowed-tools']).trim() }),
            phase: phaseId,
            lesson: lessonId,
            lessonPath: lessonRel,
            file: `${lessonRel}/outputs/${entry.name}/SKILL.md`,
            bundle: true,
            bundlePath: `${lessonRel}/outputs/${entry.name}`,
            files,
          });
        }
      }
      const missionPath = path.join(phaseDir, lessonDirName, 'mission.md');
      if (fs.existsSync(missionPath)) {
        let firstLine = '';
        try {
          firstLine = fs.readFileSync(missionPath, 'utf8').split(/\r?\n/)[0].replace(/^#\s+/, '').trim();
        } catch (_) {}
        artifacts.push({
          kind: 'mission',
          name: firstLine || `${lessonDirName} mission`,
          description: '',
          tags: [],
          phase: phaseId,
          lesson: lessonId,
          lessonPath: lessonRel,
          file: `${lessonRel}/mission.md`,
        });
      }
    }
  }
  return artifacts;
}

// ─── Main build ──────────────────────────────────────────────────────
// Write the git ref this deploy was built from, so lesson.html fetches docs
// from the right branch (PR previews render their own edits, not main).
function resolveRef() {
  let ref = process.env.VERCEL_GIT_COMMIT_REF || '';
  if (!ref) {
    try {
      ref = require('child_process')
        .execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' })
        .trim();
    } catch (e) { ref = ''; }
  }
  if (!ref || ref === 'HEAD') ref = 'main';
  return ref;
}

function writeBuildMeta() {
  const ref = resolveRef();
  const js = '// Auto-generated by build.js on each deploy — do not edit.\n'
    + 'window.__AIFS_REF = ' + JSON.stringify(ref) + ';\n';
  fs.writeFileSync(path.join(__dirname, 'build-meta.js'), js, 'utf8');
  console.log('   wrote build-meta.js (ref: ' + ref + ')');
}

// ─── langs.js: language switcher options, from the canonical registry ────
function writeLangs() {
  const regPath = path.join(REPO_ROOT, 'languages.json');
  let langs = [{ code: 'en', native: 'English' }];
  if (fs.existsSync(regPath)) {
    const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
    // Only offer languages the site can actually serve: English (source) plus
    // the ci:true set the translate workflow builds lessons for. The full
    // registry is 40 languages, but picking an untranslated one just 404s to
    // English, so it must not appear in the switcher.
    langs = reg.languages
      .filter(l => l.source || l.ci)
      .map(l => ({ code: l.code, native: l.native }));
  }
  const js = '// Auto-generated by build.js from languages.json — do not edit.\n'
    + 'window.AIFS_LANGS = ' + JSON.stringify(langs) + ';\n';
  fs.writeFileSync(path.join(__dirname, 'langs.js'), js, 'utf8');
  console.log('   wrote langs.js (' + langs.length + ' languages)');
}

function build() {
  console.log('📖 Reading source files...');
  writeBuildMeta();
  writeLangs();
  writeFigureManifest();

  const readme = fs.readFileSync(README_PATH, 'utf8');
  const roadmap = fs.readFileSync(ROADMAP_PATH, 'utf8');
  const glossary = fs.readFileSync(GLOSSARY_PATH, 'utf8');

  console.log('🔍 Parsing ROADMAP.md...');
  const roadmapStatuses = parseRoadmap(roadmap);

  console.log('🔍 Parsing README.md...');
  const phases = parseReadme(readme, roadmapStatuses);
  const roadmapPrereqs = parseCurriculumPrereqs(readme, phases);

  console.log('Parsing focused learning paths...');
  const learningPaths = parseLearningPaths(REPO_ROOT, phases);

  console.log('🔍 Parsing glossary/terms.md...');
  const glossaryTerms = parseGlossary(glossary);

  console.log('🔍 Discovering outputs + Phase 14 missions...');
  const artifacts = discoverArtifacts();

  console.log('🎓 Parsing certification programs...');
  const certifications = parseCertifications();
  writeCertificationData(certifications);

  console.log('📚 Extracting lesson summaries + keywords from docs/en.md...');
  let summarized = 0, withKeywords = 0;
  for (const phase of phases) {
    for (const lesson of phase.lessons) {
      if (lesson.url) {
        const relPath = lesson.url.replace(GITHUB_BASE, '').replace(/\/+$/, '');
        const meta = extractLessonMeta(relPath);
        if (meta.summary)  { lesson.summary  = meta.summary;  summarized++;   }
        if (meta.keywords) { lesson.keywords = meta.keywords; withKeywords++; }
      }
    }
  }

  // Stats
  let totalLessons = 0;
  let completeLessons = 0;
  phases.forEach(p => {
    totalLessons += p.lessons.length;
    completeLessons += p.lessons.filter(l => l.status === 'complete').length;
  });

  console.log(`\n📊 Stats:`);
  console.log(`   Phases: ${phases.length}`);
  console.log(`   Lessons: ${totalLessons}`);
  console.log(`   Complete: ${completeLessons}`);
  console.log(`   Summaries: ${summarized}, Keywords: ${withKeywords}`);
  console.log(`   Glossary terms: ${glossaryTerms.length}`);
  console.log(`   Artifacts: ${artifacts.length}`);
  console.log(`   Curriculum edges: ${Object.values(roadmapPrereqs).reduce((sum, ids) => sum + ids.length, 0)}`);
  console.log(`   Focused learning paths: ${learningPaths.length}`);
  console.log(`   Certification tracks: ${certifications.tracks.length}`);
  console.log(`   Certification lessons: ${Object.keys(certifications.lessonsByPath).length}`);
  console.log(`   Practice assessments: ${Object.keys(certifications.assessmentsById).length}`);

  // Generate data.js
const output = `// Auto-generated by build.js — do not edit manually.
// Last built: ${new Date().toISOString()}

const ROADMAP_PREREQS = ${JSON.stringify(roadmapPrereqs, null, 2)};

const PHASES = ${JSON.stringify(phases, null, 2)};

const LEARNING_PATHS = ${JSON.stringify(learningPaths, null, 2)};

const GLOSSARY_CATEGORY_ORDER = ${JSON.stringify(GLOSSARY_CATEGORY_ORDER, null, 2)};

const GLOSSARY = ${JSON.stringify(glossaryTerms, null, 2)};

const ARTIFACTS = ${JSON.stringify(artifacts, null, 2)};
`;

  fs.writeFileSync(OUTPUT_PATH, output, 'utf8');
  console.log(`\n✅ Generated ${OUTPUT_PATH}`);

  syncCounts(totalLessons, phases.length, artifacts.length);
  syncReadme(totalLessons);
  writeSitemap(phases, glossaryTerms.length, certifications);
  writeLlms(phases, glossaryTerms.length, artifacts.length, certifications);
}

// ─── sitemap.xml from the same PHASES the site renders ───────────────────
function writeSitemap(phases, glossaryCount, certifications) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: '/', priority: '1.0', freq: 'weekly' },
    { loc: '/catalog.html', priority: '0.8', freq: 'weekly' },
    { loc: '/prereqs.html', priority: '0.7', freq: 'monthly' },
    { loc: '/about.html', priority: '0.5', freq: 'yearly' },
    { loc: '/developer.html', priority: '0.6', freq: 'monthly' },
    { loc: '/contact.html', priority: '0.3', freq: 'yearly' },
    { loc: '/privacy.html', priority: '0.3', freq: 'yearly' },
  ];
  if (glossaryCount > 0) urls.push({ loc: '/glossary.html', priority: '0.6', freq: 'monthly' });
  if (certifications && certifications.program) {
    urls.push({ loc: '/certifications.html', priority: '0.9', freq: 'weekly' });
    for (const track of certifications.tracks) {
      urls.push({ loc: '/certification.html?id=' + encodeURIComponent(track.id), priority: '0.8', freq: 'monthly' });
    }
    for (const lesson of Object.values(certifications.lessonsByPath)) {
      const track = lesson.trackIds && lesson.trackIds[0];
      let loc = '/lesson.html?path=' + encodeURIComponent(lesson.path);
      if (track) loc += '&track=' + encodeURIComponent(track);
      urls.push({ loc, priority: '0.7', freq: 'monthly' });
    }
  }
  for (const phase of phases) {
    for (const l of phase.lessons) {
      const p = lessonPath(l.url);
      if (p) urls.push({ loc: '/lesson.html?path=' + p, priority: '0.6', freq: 'monthly' });
    }
  }
  const body = urls.map(u =>
    `  <url>\n    <loc>${SITE_ORIGIN}${u.loc.replace(/&/g, '&amp;')}</loc>\n` +
    `    <lastmod>${today}</lastmod>\n    <changefreq>${u.freq}</changefreq>\n` +
    `    <priority>${u.priority}</priority>\n  </url>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
  fs.writeFileSync(path.join(__dirname, 'sitemap.xml'), xml, 'utf8');
  console.log(`   wrote sitemap.xml (${urls.length} URLs)`);
}

// ─── llms.txt: a link-rich map of the curriculum for AI agents ───────────
function writeLlms(phases, glossaryCount, artifactCount, certifications) {
  const rawOrigin = 'https://raw.githubusercontent.com/rohitg00/ai-engineering-from-scratch/' + resolveRef();
  let total = 0;
  phases.forEach(p => { total += p.lessons.filter(l => lessonPath(l.url)).length; });
  let out = `# AI Engineering from Scratch\n\n`;
  out += `> A free, open-source curriculum that builds every core AI algorithm by hand — ${total} lessons across ${phases.length} phases, from linear algebra to autonomous agents. Python, TypeScript, Rust, Julia.\n\n`;
  out += `Canonical site: ${SITE_ORIGIN}\n`;
  out += `Source: https://github.com/rohitg00/ai-engineering-from-scratch\n`;
  out += `Glossary terms: ${glossaryCount} · Reusable outputs (prompts/skills/agents): ${artifactCount}\n\n`;
  out += `## Developer resources\n`;
  out += `- [Developer documentation](${SITE_ORIGIN}/developer.html) — machine-readable site contracts and integration notes\n`;
  out += `- [OpenAPI description](${SITE_ORIGIN}/openapi.json) — read-only public resource inventory\n`;
  out += `- [Sitemap](${SITE_ORIGIN}/sitemap.xml) — canonical URL inventory\n`;
  out += `- [Contact](${SITE_ORIGIN}/contact.html) — maintainer and project contact route\n`;
  out += `- [Privacy](${SITE_ORIGIN}/privacy.html) — data and analytics policy\n\n`;
  out += `Lesson pages render client-side. Agents: fetch each lesson's raw markdown link; it is the full text. Lesson directories may also include code/ (runnable implementation) and quiz.json.\n\n`;
  for (const phase of phases) {
    out += `## Phase ${phase.id}: ${phase.name}\n`;
    if (phase.desc) out += `${phase.desc}\n`;
    out += `\n`;
    for (const l of phase.lessons) {
      const p = lessonPath(l.url);
      if (!p) continue;
      const note = l.summary ? ` — ${l.summary}` : '';
      out += `- [${l.name}](${SITE_ORIGIN}/lesson.html?path=${p}) · [raw](${rawOrigin}/${p}/docs/en.md)${note}\n`;
    }
    out += `\n`;
  }
  out += `## Optional\n`;
  out += `- [Catalog](${SITE_ORIGIN}/catalog.html) — full searchable lesson index\n`;
  out += `- [Roadmap](${SITE_ORIGIN}/prereqs.html) — prerequisite ordering across phases\n`;
  if (glossaryCount > 0) out += `- [Glossary](${SITE_ORIGIN}/glossary.html) — plain-language definitions of ${glossaryCount} terms\n`;
  if (certifications && certifications.program) {
    out += `\n## Certification preparation\n`;
    out += `Independent, open-source practice material. Practice scores are not official exam scores and completion does not guarantee certification.\n\n`;
    out += `- [Claude certification learner guide](${rawOrigin}/certifications/claude/GETTING_STARTED.md)\n`;
    out += `- [Claude certification tutor contract](${rawOrigin}/skills/claude-certification/SKILL.md)\n`;
    out += `- [Certification catalog](${SITE_ORIGIN}/certifications.html)\n`;
    for (const track of certifications.tracks) {
      out += `- [${track.credential || track.shortName || track.id}](${SITE_ORIGIN}/certification.html?id=${encodeURIComponent(track.id)})`;
      if (track.summary) out += ` — ${track.summary}`;
      out += `\n`;
    }
    const certRawOrigin = 'https://raw.githubusercontent.com/rohitg00/ai-engineering-from-scratch/' + resolveRef();
    for (const lesson of Object.values(certifications.lessonsByPath)) {
      out += `- [${lesson.name}](${SITE_ORIGIN}/lesson.html?path=${encodeURIComponent(lesson.path)}) · [raw](${certRawOrigin}/${lesson.path}/docs/en.md)`;
      if (lesson.summary) out += ` — ${lesson.summary}`;
      out += `\n`;
    }
  }
  fs.writeFileSync(path.join(__dirname, 'llms.txt'), out, 'utf8');
  console.log(`   wrote llms.txt`);
}

// ─── Regenerate README stats block + lessons badge from source ───────────
function syncReadme(lessons) {
  const readmePath = path.join(REPO_ROOT, 'README.md');
  if (!fs.existsSync(readmePath)) return;
  let md = fs.readFileSync(readmePath, 'utf8');
  const before = md;

  // Keep the lessons badge in sync with the live count (URL value + alt text)
  md = md.replace(/badge\/lessons-\d+-/g, `badge/lessons-${lessons}-`);
  md = md.replace(/alt="\d+ lessons"/g, `alt="${lessons} lessons"`);

  // Regenerate the traffic proof block from site/stats.json
  const statsPath = path.join(__dirname, 'stats.json');
  if (fs.existsSync(statsPath)) {
    try {
      const s = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
      const fmt = n => Number(n).toLocaleString('en-US');
      const block =
        '<!-- STATS:START (generated from site/stats.json by build.js — do not edit by hand) -->\n' +
        `<p align="center"><sub><b>${fmt(s.visitors30d)}</b> readers &nbsp;·&nbsp; ` +
        `<b>${fmt(s.pageViews30d)}</b> page views in the last ${s.period} &nbsp;·&nbsp; ` +
        `as of ${s.updated}</sub></p>\n` +
        '<!-- STATS:END -->';
      const statsRe = /<!-- STATS:START[\s\S]*?<!-- STATS:END -->/;
      if (statsRe.test(md)) {
        md = md.replace(statsRe, block);
      } else {
        // Self-heal: re-insert the block if the markers were removed/mangled
        md = md.replace(/\n## How this works/, `\n${block}\n\n## How this works`);
      }
    } catch (err) {
      console.warn(`⚠️  README stats sync skipped: ${err.message}`);
    }
  }

  if (md !== before) {
    fs.writeFileSync(readmePath, md, 'utf8');
    console.log('   synced README stats + lessons badge');
  }
}

// ─── Keep marketing counts in sync (single source of truth = this build) ──
function syncCounts(lessons, phaseCount, outputs) {
  const targets = ['index.html', 'catalog.html', 'lesson.html', 'prereqs.html', 'cmdpalette.js'];
  for (const f of targets) {
    const p = path.join(__dirname, f);
    if (!fs.existsSync(p)) continue;
    const before = fs.readFileSync(p, 'utf8');
    const after = before
      .replace(/\b\d+( AI engineering)? lessons\b/g, `${lessons}$1 lessons`)
      .replace(/\b\d+ phases\b/g, `${phaseCount} phases`)
      .replace(/\b\d+ outputs\b/g, `${outputs} outputs`);
    if (after !== before) {
      fs.writeFileSync(p, after, 'utf8');
      console.log(`   synced counts in ${f}`);
    }
  }
}

if (require.main === module) {
  build();
}

module.exports = {
  FIGURE_PROVIDER_ORDER,
  buildFigureProviderManifest,
  discoverFigureProviderOrder,
  discoverArtifacts,
  discoverUsedFigureIds,
  parseReadme,
  parseRoadmap,
  parseLearningPaths,
  parseFrontmatter,
  serializeFigureProviderManifest,
  writeFigureManifest,
};
