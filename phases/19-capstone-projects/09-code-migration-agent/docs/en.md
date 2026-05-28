# Capstone 09 — Code Migration Agent (Repo-Level Language / Runtime Upgrade)

> Amazon の MigrationBench (Java 8 から17) と Google の App Engine Py2-to-Py3 migrator が2026年の基準を作りました。Moderne の OpenRewrite は deterministic AST rewrite を大規模に行います。Grit も codemod-style DSL で同じ問題を狙います。production pattern は両方を組み合わせます。safe rewrite 用の deterministic substrate と、ambiguous case 用の agent layer、per-branch build 用 sandbox、PR を開く前に green に変える test harness です。この capstone では50個の real repo を migrate し、pass rate と failure taxonomy を公開します。

**種別:** Capstone
**言語:** Python (agent), Java / Python (targets), TypeScript (dashboard)
**前提条件:** Phase 5 (NLP), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 15 (autonomous), Phase 17 (infrastructure)
**Phases exercised:** P5 · P7 · P11 · P13 · P14 · P15 · P17
**所要時間:** 30時間

## 問題

large-scale code migration は、2026年の coding agent にとって最も production に向いた application の1つです。ground truth が明確 (migration 後に test suite が pass するか)、reward が大きい (Java-8 fleet migration は headcount-scale project)、benchmark が public (MigrationBench 50-repo subset) だからです。Moderne の OpenRewrite は deterministic side を処理します。agent layer は recipe だけでは扱えないもの、つまり ambiguous rewrite、build-system drift、long-tail syntax、transitive dependency breakage を処理します。

Java 8 repo (または Python 2 repo) を受け取り、green-CI の migrated branch を生成する agent を作ります。pass rate、test-coverage preservation、cost per repo を測り、failure taxonomy を作ります。deterministic-only baseline との side-by-side により、agent の価値が実際にどこにあるかが分かります。

## コンセプト

pipeline は2層です。**deterministic substrate** (Java は OpenRewrite、Python は libcst) が、imports、method signatures、null-safety edits、try-with-resources、deprecated API replacements など mechanical rewrite の大部分を安全に実行します。これは速く、audit 可能な diff を出します。**agent layer** (Claude Opus 4.7 と GPT-5.4-Codex 上の OpenAI Agents SDK または LangGraph) は recipe が扱えない case を処理します: Maven/Gradle/pyproject の build-file upgrade、transitive dependency conflict、test flakes、custom annotations。

各 repo は target runtime が preinstall された Daytona sandbox を持ちます。agent は iterate します: build を実行し、failure を classify し、fix を適用し、再実行します。hard limit は repo あたり 30分、$8、20 agent turns。すべての test が pass し、coverage delta が negative でなければ branch は PR を開きます。そうでなければ repo は evidence 付きで failure class に分類されます。

deliverable は failure taxonomy です。50 repo 全体で何が壊れたのか。transitive deps、custom annotations、build tool version、migration と無関係な test flake。各 class に count と exemplar diff を付けます。future recipe author は上位3つを狙えます。

## Architecture

```
target repo
      |
      v
OpenRewrite / libcst deterministic recipes
   (safe, fast, auditable, ~70-80% of fixes)
      |
      v
Daytona sandbox per branch
      |
      v
agent loop (Claude Opus 4.7 / GPT-5.4-Codex):
   - run build -> capture failures
   - classify failures (build, test, lint)
   - apply fix (patch or retry recipe)
   - rerun
   - budget: 30 min, $8, 20 turns
      |
      v
test + coverage delta gate
      |
      v (passed)
open PR
      |
      v (failed)
file under failure class + attach repro
```

## Stack

- Deterministic substrate: OpenRewrite (Java) または libcst (Python)
- Agent: Claude Opus 4.7 + GPT-5.4-Codex 上の OpenAI Agents SDK または LangGraph
- Sandbox: branch ごとの Daytona devcontainers、target runtime (Java 17 / Python 3.12) pre-installed
- Build systems: Maven、Gradle、uv (Python)
- Benchmarks: Amazon MigrationBench 50-repo subset (Java 8 to 17)、Google App Engine Py2-to-Py3 repos
- Test harness: parallel runner、coverage は Java が Jacoco、Python が coverage.py
- Observability: repo ごとに every diff chunk を持つ Langfuse + trace bundle
- Dashboard: failure class count と exemplar diff を示す failure-taxonomy dashboard

## 実装

1. **Recipe pass.** OpenRewrite (Java) または libcst (Python) recipe を先に走らせます。mechanical な migration の 70-80% を取ります。"recipe" commit として commit します。

2. **Build trial.** Daytona sandbox に target runtime を install し、build を実行します。green なら test へ進みます。red なら agent に hand off します。

3. **Agent loop.** tools `run_build`, `read_file`, `edit_file`, `run_test`, `git_diff` を持つ LangGraph。agent は failure (dep, syntax, test, build-tool) を classify し、targeted fix を適用して rerun します。

4. **Budget caps.** repo あたり wall-clock 30分、cost $8、agent turns 20。どれかを超えたら halt し、current diff とともに "budget_exhausted" へ file します。

5. **Test + coverage gate.** build が green になった後、test suite を実行します。base repo と coverage を比較します。2% を超えて下がったら "coverage_regression" に分類します。

6. **PR open.** 成功したら branch を push し、適用された recipe と agent が作成した commit の summary を含む PR を開きます。

7. **Failure taxonomy.** failed repo ごとに class を tag します: `dep_upgrade_required`, `build_tool_drift`, `custom_annotation`, `test_flake`, `syntax_edge_case`, `budget_exhausted`。dashboard を作ります。

8. **50-repo run.** MigrationBench subset 全体で実行します。per-class pass rate、cost-per-repo、coverage-preservation、deterministic-only baseline との比較を報告します。

## Use It

```
$ migrate legacy-java-service --target java17
[recipe]   27 rewrites applied (JUnit 4->5, HashMap initializer, try-with-resources)
[build]    FAIL: cannot find symbol sun.misc.BASE64Encoder
[agent]    turn 1 classify: removed_jdk_api
[agent]    turn 2 apply: sun.misc.BASE64Encoder -> java.util.Base64
[build]    OK
[tests]    412/412 passing; coverage 84.1% -> 84.3%
[pr]       opened #1841  cost=$3.20  turns=4
```

## Ship It

`outputs/skill-migration-agent.md` が deliverable です。repo を受け取り、deterministic recipe の後に agent loop を実行し、green migrated branch を生成するか、taxonomy class に分類します。

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | MigrationBench pass rate | 50-repo subset pass@1 |
| 20 | Test-coverage preservation | base に対する mean coverage delta |
| 20 | Cost per migrated repo | passing run の $/repo |
| 20 | Agent / deterministic-tool integration | OpenRewrite が処理した fix と agent が書いた fix の割合 |
| 15 | Failure analysis write-up | exemplar 付き taxonomy completeness |
| **100** | | |

## Exercises

1. OpenRewrite only (agent なし) で migrate pipeline を走らせます。full pipeline と pass rate を比較し、agent だけが差分になる case を特定します。

2. "lint-clean" check を実装します。migration 後に style linter (Java は spotless、Python は ruff) を走らせ、新しい lint error があれば PR を fail させます。coverage-preserved-but-style-regressed rate を測ります。

3. "minimal-diff" optimizer を追加します。agent branch が test pass した後、second pass で不要な変更を trim します。diff-size reduction を報告します。

4. third migration として Node 18 から Node 22 へ拡張します。sandbox wrapping は再利用し、recipe layer を custom codemod に差し替えます。

5. UX metric として time-to-first-green-build (TTFGB) を測ります。target は p50 10分未満です。

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Deterministic substrate | 「Recipe engine」 | safety guarantee を持つ declarative AST rewrite。OpenRewrite / libcst |
| Codemod | 「Code-modifying program」 | source code を機械的に変える rewrite rule |
| Build drift | 「Tool version skew」 | major version 間の Maven / Gradle / uv の微妙な behavior change |
| Failure class | 「Taxonomy bucket」 | repo が migrate しなかった理由の label: dep、syntax、test、build-tool、budget |
| Coverage delta | 「Coverage preservation」 | base から migrated branch への test coverage % の変化 |
| Agent turn | 「Tool-call round」 | agent loop の plan -> act -> observe 1 cycle |
| Budget exhaustion | 「Hit the ceiling」 | repo が 30-min / $8 / 20-turn limit を使い切っても pass しないこと |

## 参考文献

- [Amazon MigrationBench](https://aws.amazon.com/blogs/devops/amazon-introduces-two-benchmark-datasets-for-evaluating-ai-agents-ability-on-code-migration/) — canonical 2026 benchmark
- [Moderne.io OpenRewrite platform](https://www.moderne.io) — deterministic substrate reference
- [OpenRewrite documentation](https://docs.openrewrite.org) — recipe authoring
- [Grit.io](https://www.grit.io) — alternate codemod DSL
- [OpenAI sandboxed migration cookbook](https://developers.openai.com/cookbook/examples/agents_sdk/sandboxed-code-migration/sandboxed_code_migration_agent) — Agents SDK reference
- [Google App Engine Py2 to Py3 migrator](https://cloud.google.com/appengine) — alternate migration benchmark
- [libcst](https://github.com/Instagram/LibCST) — Python deterministic substrate
- [Daytona sandboxes](https://daytona.io) — per-branch sandbox reference
