'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const { buildData, loadProject, bundleContent } = require('./build-projects');
const GRADER = path.resolve(__dirname, '../scripts/project_test.py');

function write(root, file, value) {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, typeof value === 'object' ? JSON.stringify(value, null, 2) + '\n' : value);
}
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aifs-project-contract-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const dir = path.join(root, 'projects', 'sample-project');
  const meta = {
    id: 'sample-project', title: 'Evidence Index', tagline: 'Find cited evidence.', summary: 'Index text with stable offsets.',
    level: 2, hours: 8, languages: ['Python'], status: 'ready', source: 'community',
    author: { name: 'Fixture Author', github: 'fixture-author' },
    demo: { command: ['python3', 'main.py'], cwd: 'solution' },
    demos: [{ gif: 'media/run.gif', poster: 'media/run.png', caption: 'A deterministic run.' }],
    stages: Array.from({ length: 4 }, (_, index) => ({ id: `0${index + 1}-stage`, title: `Stage ${index + 1}`, summary: 'Validate a behavior.', hours: 2, language: 'python', difficulty: 'core' })),
  };
  write(dir, 'project.json', meta);
  write(dir, 'README.md', '# Evidence Index\n');
  write(dir, 'solution/main.py', 'def double(value):\n    return value * 2\n');
  write(dir, 'media/run.gif', 'fixture-media');
  write(dir, 'media/run.png', 'fixture-media');
  for (const [index, stage] of meta.stages.entries()) {
    write(dir, `stages/${stage.id}/docs/en.md`, `# ${stage.title}\n\nA bounded offset index.\n\n\`\`\`figure\npj-sample-${index + 1}\n\`\`\`\n`);
    write(dir, `stages/${stage.id}/starter/main.py`, 'def double(value):\n    raise NotImplementedError("implement double")\n');
    write(dir, `stages/${stage.id}/tests/test_stage.py`, 'import unittest\nfrom main import double\nclass Contract(unittest.TestCase):\n    def test_integer(self):\n        self.assertEqual(double(7),14)\n');
  }
  write(root, 'site/figures/projects/sample-project.js', meta.stages.map((_, index) => `window.AIFSProjectFigures.register('pj-sample-${index + 1}', {});`).join('\n'));
  return { root, dir, meta, save: () => write(dir, 'project.json', meta) };
}
function grade(f, args = []) {
  const boot = 'import importlib.util, pathlib, sys; spec=importlib.util.spec_from_file_location("grader",sys.argv[1]); g=importlib.util.module_from_spec(spec); spec.loader.exec_module(g); g.PROJECTS=pathlib.Path(sys.argv[2]); sys.exit(g.main(sys.argv[3:]))';
  return spawnSync('python3', ['-c', boot, GRADER, path.join(f.root, 'projects'), ...args], { encoding: 'utf8', timeout: 30000 });
}
function report(f, args) {
  const file = path.join(f.root, 'report.json');
  const result = grade(f, [...args, '--report', file]);
  assert.equal(result.error, undefined);
  return { result, report: JSON.parse(fs.readFileSync(file, 'utf8')) };
}

test('ready metadata preserves author, embeds docs and media, and hashes manifest bytes', t => {
  const f = fixture(t);
  const data = buildData({ root: f.root, strict: true });
  assert.equal(data.projects.length, 1);
  assert.equal(data.projects[0].author.github, 'fixture-author');
  assert.match(data.projects[0].manifestHash, /^[a-f0-9]{64}$/);
  assert.deepEqual(data.projects[0].figureScripts, ['figures/projects/sample-project.js']);
  bundleContent(data, f.root, path.join(f.root, 'site'));
  assert.equal(fs.readFileSync(path.join(f.root, 'site', data.projects[0].stages[0].contentUrl), 'utf8'), fs.readFileSync(path.join(f.dir, 'stages/01-stage/docs/en.md'), 'utf8'));
  assert.ok(fs.existsSync(path.join(f.root, 'site/project-content/sample-project/media/run.gif')));
  const oldHash = data.projects[0].manifestHash;
  f.meta.summary = 'A changed contract.'; f.save();
  assert.notEqual(buildData({ root: f.root }).projects[0].manifestHash, oldHash);
});

test('drafts are not promoted, and ready roadmap entries disappear without dropping other plans', t => {
  const f = fixture(t);
  write(f.root, 'projects/roadmap.json', { planned: [{ id: 'sample-project', title: 'Existing', level: 2 }, { id: 'future-project', title: 'Future', level: 3 }] });
  assert.deepEqual(buildData({ root: f.root }).planned.map(p => p.id), ['future-project']);
  f.meta.status = 'draft'; f.save();
  const data = buildData({ root: f.root });
  assert.equal(data.projects.length, 0);
  assert.equal(data.planned.length, 2);
});

test('duplicate stage and roadmap ids fail, traversal and symlink assets cannot escape', t => {
  const f = fixture(t);
  f.meta.stages[1].id = f.meta.stages[0].id; f.save();
  assert.throws(() => loadProject(f.dir, { root: f.root }), /duplicate stage/);
  f.meta.stages[1].id = '02-stage'; f.meta.demos[0].gif = '../../outside.gif'; f.save();
  assert.throws(() => loadProject(f.dir, { root: f.root }), /escapes/);
  f.meta.demos[0].gif = 'media/escape.gif'; f.save();
  write(f.root, 'outside.gif', 'outside');
  fs.symlinkSync(path.join(f.root, 'outside.gif'), path.join(f.dir, 'media/escape.gif'));
  assert.throws(() => loadProject(f.dir, { root: f.root }), /escapes/);
  f.meta.demos[0].gif = 'media/run.gif'; f.save();
  write(f.root, 'projects/roadmap.json', { planned: [{ id: 'next', title: 'Next', level: 1 }, { id: 'next', title: 'Next again', level: 1 }] });
  assert.throws(() => buildData({ root: f.root }), /duplicate id/);
});

test('readiness requires actual starters, registered mechanisms and recorded demo assets', t => {
  const f = fixture(t);
  fs.rmSync(path.join(f.dir, 'stages/01-stage/starter'), { recursive: true });
  assert.throws(() => buildData({ root: f.root }), /starter/);
  write(f.dir, 'stages/01-stage/starter/main.py', 'pass\n');
  write(f.dir, 'stages/01-stage/docs/en.md', '# Missing mechanism\n```figure\npj-unregistered\n```\n');
  assert.throws(() => buildData({ root: f.root }), /unregistered/);
  write(f.dir, 'stages/01-stage/docs/en.md', '# Stage\n```figure\npj-sample-1\n```\n');
  fs.rmSync(path.join(f.dir, 'media/run.gif'));
  assert.throws(() => buildData({ root: f.root, strict: true }), /missing media/);
});

test('runner schema rejects shell strings, unknown substitutions, and unbounded timeouts', t => {
  const f = fixture(t);
  f.meta.stages[0].runner = 'node test.js'; f.save();
  assert.throws(() => buildData({ root: f.root }), /argv/);
  f.meta.stages[0].runner = ['python3', '{unknown}/test.py']; f.save();
  assert.throws(() => buildData({ root: f.root }), /unknown runner placeholder/);
  delete f.meta.stages[0].runner; f.meta.stages[0].timeout = 0; f.save();
  assert.throws(() => buildData({ root: f.root }), /timeout/);
});

test('reference and partial runs cannot issue learner certificates; complete learner evidence can', t => {
  const f = fixture(t);
  let check = report(f, ['sample-project', '--all', '--solution', '--strict']);
  assert.equal(check.result.status, 0, check.result.stderr);
  assert.equal(check.report.projects[0].allStagesPassed, true);
  assert.equal(check.report.certificateEligible, false);
  const workspace = path.join(f.root, 'learner');
  fs.cpSync(path.join(f.dir, 'solution'), workspace, { recursive: true });
  check = report(f, ['sample-project', '--only', '--stage', '4', '--path', workspace]);
  assert.equal(check.result.status, 0);
  assert.equal(check.report.certificateEligible, false);
  check = report(f, ['sample-project', '--all', '--path', workspace, '--strict']);
  assert.equal(check.result.status, 0);
  assert.equal(check.report.certificateEligible, true);
  assert.equal(check.report.projects[0].manifestHash, buildData({ root: f.root }).projects[0].manifestHash);
});

test('missing runtime and skipped tests stay incomplete, with strict exit failure', t => {
  const f = fixture(t);
  f.meta.stages[0].requires = ['aifs-nonexistent-runtime-97']; f.save();
  let check = report(f, ['sample-project', '--all', '--solution']);
  assert.equal(check.result.status, 0);
  assert.equal(check.report.projects[0].stages[0].status, 'skip');
  assert.equal(check.report.projects[0].allStagesPassed, false);
  check = report(f, ['sample-project', '--all', '--solution', '--strict']);
  assert.equal(check.result.status, 1);
  delete f.meta.stages[0].requires; f.save();
  write(f.dir, 'stages/01-stage/tests/test_stage.py', 'import unittest\nclass Contract(unittest.TestCase):\n    @unittest.skip("pending")\n    def test_pending(self): pass\n');
  check = report(f, ['sample-project', '--all', '--solution', '--strict']);
  assert.equal(check.result.status, 1);
  assert.equal(check.report.projects[0].stages[0].skippedTests, 1);
});

test('zero tests, failing assertions, and timed out argv commands fail with evidence', t => {
  const f = fixture(t);
  write(f.dir, 'stages/01-stage/tests/test_stage.py', 'import unittest\n');
  let check = report(f, ['sample-project', '--solution', '--stage', '1']);
  assert.equal(check.result.status, 1);
  assert.match(check.report.projects[0].stages[0].reason, /no tests ran/);
  f.meta.stages[0].runner = ['python3', '-c', 'import time; time.sleep(5)'];
  f.meta.stages[0].timeout = 0.1; f.save();
  check = report(f, ['sample-project', '--solution', '--stage', '1']);
  assert.equal(check.result.status, 1);
  assert.match(check.report.projects[0].stages[0].reason, /timeout/);
  delete f.meta.stages[0].runner; delete f.meta.stages[0].timeout; f.save();
  write(f.dir, 'stages/01-stage/tests/test_stage.py', 'import unittest\nfrom main import double\nclass Contract(unittest.TestCase):\n    def test_wrong(self): self.assertEqual(double(7),13)\n');
  check = report(f, ['sample-project', '--solution', '--stage', '1']);
  assert.equal(check.result.status, 1);
});

test('initialization copies every file type, preserves learner edits and rejects symlink writes', t => {
  const f = fixture(t);
  write(f.dir, 'stages/01-stage/starter/main.rs', 'fn main() {}\n');
  write(f.dir, 'stages/01-stage/starter/data/input.json', { input: 1 });
  const workspace = path.join(f.root, 'learner');
  assert.equal(grade(f, ['sample-project', '--init', workspace]).status, 0);
  assert.ok(fs.existsSync(path.join(workspace, 'main.rs')));
  assert.ok(fs.existsSync(path.join(workspace, 'data/input.json')));
  write(workspace, 'main.py', 'learner edits');
  assert.equal(grade(f, ['sample-project', '--init', workspace]).status, 0);
  assert.equal(fs.readFileSync(path.join(workspace, 'main.py'), 'utf8'), 'learner edits');
  assert.equal(grade(f, ['sample-project', '--init', workspace, '--force']).status, 0);
  assert.match(fs.readFileSync(path.join(workspace, 'main.py'), 'utf8'), /NotImplementedError/);
  fs.rmSync(path.join(workspace, 'main.rs'));
  write(f.root, 'outside.rs', 'protected');
  fs.symlinkSync(path.join(f.root, 'outside.rs'), path.join(workspace, 'main.rs'));
  assert.equal(grade(f, ['sample-project', '--init', workspace, '--force']).status, 2);
  assert.equal(fs.readFileSync(path.join(f.root, 'outside.rs'), 'utf8'), 'protected');
});

test('all-project dispatch and default TypeScript, Rust, and Go runners execute real learner code', t => {
  const f = fixture(t);
  const declarations = [
    { language: 'typescript', runtime: 'node', source: ['main.ts', 'export function double(value: number): number { return value * 2; }\n'], test: ['stage.test.mjs', "import test from 'node:test'; import assert from 'node:assert/strict'; import {pathToFileURL} from 'node:url'; const {double}=await import(pathToFileURL(process.env.PROJECT_WORKSPACE+'/main.ts')); test('doubles negative',()=>assert.equal(double(-3),-6));"] },
    { language: 'rust', runtime: 'rustc', source: ['main.rs', 'pub fn double(value: i32) -> i32 { value * 2 }\n'], test: ['stage.rs', 'mod learner { include!(concat!(env!("PROJECT_WORKSPACE"), "/main.rs")); }\n#[test] fn negative() { assert_eq!(learner::double(-3), -6); }\n'] },
    { language: 'go', runtime: 'go', source: ['main.go', 'package main\nfunc Double(value int) int { return value * 2 }\n'], test: ['stage_test.go', 'package main\nimport "testing"\nfunc TestNegative(t *testing.T) { if Double(-3) != -6 { t.Fatal("wrong negative") } }\n'] },
  ];
  for (const [index, declaration] of declarations.entries()) {
    const stage = f.meta.stages[index + 1];
    stage.language = declaration.language;
    fs.rmSync(path.join(f.dir, `stages/${stage.id}/tests/test_stage.py`));
    write(f.dir, `solution/${declaration.source[0]}`, declaration.source[1]);
    write(f.dir, `stages/${stage.id}/tests/${declaration.test[0]}`, declaration.test[1]);
  }
  f.save();
  const check = report(f, ['--all', '--solution']);
  assert.equal(check.result.status, 0, check.result.stdout + check.result.stderr);
  const results = check.report.projects[0].stages;
  assert.equal(results[0].status, 'pass');
  for (const [index, declaration] of declarations.entries()) {
    const available = spawnSync(declaration.runtime, ['--version'], { encoding: 'utf8' });
    const nodeVersion = available.stdout?.match(/^v(\d+)\.(\d+)\.\d+/);
    const supportedNode = nodeVersion && (Number(nodeVersion[1]) > 22 || Number(nodeVersion[1]) === 22 && Number(nodeVersion[2]) >= 18);
    if (!available.error && (declaration.language !== 'typescript' || supportedNode)) {
      assert.equal(results[index + 1].status, 'pass', JSON.stringify(results[index + 1]));
      assert.ok(results[index + 1].tests > 0);
    } else assert.equal(results[index + 1].status, 'skip');
  }
});

test('Node versions below 22.18 and malformed versions skip before executing tests', t => {
  const f = fixture(t);
  const versions = ['v20.99.0', 'v22.0.0', 'v22.17.9', 'v22.18.0', 'v22.19.0', 'v23.0.0', 'v24.0.0', 'v22x18.0'];
  const probe = spawnSync('python3', ['-c', [
    'import json, pathlib, sys, project_test as grader',
    'root = pathlib.Path(sys.argv[1])',
    'grader.shutil.which = lambda name: name',
    'results = []',
    'for version in json.loads(sys.argv[2]):',
    ' calls = []',
    ' def execute(argv, *args):',
    '  calls.append(argv)',
    '  return (0, version + "\\n" if argv == ["node", "--version"] else "# tests 1\\n# skipped 0\\n", False)',
    ' grader.execute = execute',
    ' runner = {"language": "typescript", "requires": [], "timeout": 10, "argv": ["node", "--test", "fixture.test.mjs"]}',
    ' result = grader.runner_result(runner, root, root / "stages/01-stage", root / "solution", False)',
    ' results.append({"status": result["status"], "reason": result["reason"], "calls": len(calls)})',
    'print(json.dumps(results))',
  ].join('\n'), f.dir, JSON.stringify(versions)], { cwd: path.dirname(GRADER), encoding: 'utf8' });
  assert.equal(probe.status, 0, probe.stderr);
  const results = JSON.parse(probe.stdout);
  assert.deepEqual(results.map(result => result.status), ['skip', 'skip', 'skip', 'pass', 'pass', 'pass', 'pass', 'skip']);
  assert.deepEqual(results.map(result => result.calls), [1, 1, 1, 2, 2, 2, 2, 1]);
  for (const result of results.filter(result => result.status === 'skip')) {
    assert.equal(result.reason, 'Node.js 22.18 or later is required');
  }
});

test('optional framework probes resolve dependencies without importing them and require explicit selection', t => {
  const f = fixture(t);
  f.meta.stages[0].runners = [
    { language: 'python' },
    { language: 'python', optional: true, requires: ['python:aifs_absent_framework_97'], argv: ['{python}', '-m', 'unittest', 'discover', '-s', '{tests}'] },
  ];
  f.save();
  let check = report(f, ['sample-project', '--solution', '--stage', '1', '--strict']);
  assert.equal(check.result.status, 0);
  assert.equal(check.report.projects[0].stages[0].runners.length, 1);
  check = report(f, ['sample-project', '--solution', '--stage', '1', '--optional']);
  assert.equal(check.result.status, 0);
  assert.equal(check.report.projects[0].stages[0].status, 'skip');
  assert.match(check.report.projects[0].stages[0].reason, /pip install aifs-absent-framework-97/);
  check = report(f, ['sample-project', '--solution', '--stage', '1', '--optional', '--strict']);
  assert.equal(check.result.status, 1);
  const hintProbe = spawnSync('python3', ['-c', [
    'import json, pathlib, sys, project_test as grader',
    'root = pathlib.Path(sys.argv[1])',
    'grader.execute = lambda *args: (1, "", False)',
    'runner = {"language": "python", "requires": ["python:strands"], "timeout": 10}',
    'print(json.dumps(grader.runner_result(runner, root, root / "stages/01-stage", root / "solution", False)))',
  ].join('\n'), f.dir], { cwd: path.dirname(GRADER), encoding: 'utf8' });
  assert.equal(hintProbe.status, 0, hintProbe.stderr);
  assert.equal(JSON.parse(hintProbe.stdout).reason, 'missing dependency python:strands; install with: python3 -m pip install strands-agents');
  f.meta.stages[0].runners[1].requires = ['python:aifs_present.child'];
  write(f.dir, 'solution/aifs_present/__init__.py', 'raise RuntimeError("dependency probes must not import me")\n');
  write(f.dir, 'solution/aifs_present/child.py', 'raise RuntimeError("dependency probes must not import me either")\n');
  f.save();
  check = report(f, ['sample-project', '--solution', '--stage', '1', '--optional', '--strict']);
  assert.equal(check.result.status, 0, check.result.stdout + check.result.stderr);
  assert.equal(check.report.projects[0].stages[0].tests, 2);
});

test('missing Node packages produce an npm hint and fail strict grading', t => {
  const f = fixture(t);
  f.meta.stages[0].requires = ['node:@aifs-fixture/absent-package-97'];
  f.save();
  const check = report(f, ['sample-project', '--solution', '--stage', '1', '--strict']);
  assert.equal(check.result.status, 1);
  assert.equal(check.report.projects[0].stages[0].status, 'skip');
  assert.match(check.report.projects[0].stages[0].reason, /npm install @aifs-fixture\/absent-package-97/);
});

test('direct and symlinked reference paths never masquerade as learner evidence', t => {
  const f = fixture(t);
  const reference = path.join(f.dir, 'solution');
  for (const workspace of [reference, path.join(f.root, 'solution-alias')]) {
    if (workspace !== reference) fs.symlinkSync(reference, workspace, 'dir');
    const check = report(f, ['sample-project', '--all', '--path', workspace, '--strict']);
    assert.equal(check.result.status, 0);
    assert.equal(check.report.projects[0].mode, 'solution');
    assert.equal(check.report.projects[0].certificateEligible, false);
    assert.equal(check.report.certificateEligible, false);
  }
});
