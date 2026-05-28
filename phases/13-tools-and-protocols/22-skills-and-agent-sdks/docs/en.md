# Skills and Agent SDKs — Anthropic Skills、AGENTS.md、OpenAI Apps SDK

> MCPは「どんなtoolsが存在するか」を語る。Skillsは「taskをどう実行するか」を語る。2026年のstackはその両方を重ねる。AnthropicのAgent Skills（open standard、2025年12月）は、progressive disclosureを備えたSKILL.mdとして配布される。OpenAIのApps SDKはMCPにwidget metadataを足したものだ。AGENTS.md（現在60,000以上のrepoで採用）はrepo rootに置かれるproject-level agent contextである。このlessonでは各層が何を担当するかを整理し、複数agent間を移動できる最小のSKILL.md + AGENTS.md bundleを作る。

**種別:** 学習
**言語:** Python (stdlib, SKILL.md parser and loader)
**前提条件:** Phase 13 · 07 (MCP server)
**所要時間:** 約45分

## Learning Objectives

- 3つの層を区別する: AGENTS.md（project context）、SKILL.md（再利用可能なknow-how）、MCP（tools）。
- YAML frontmatterとprogressive disclosureを備えたSKILL.mdを書く。
- filesystem風にskillsをagent runtimeへ読み込む。
- SkillをMCP serverとAGENTS.mdと組み合わせ、Claude Code、Cursor、Codexで動く1つのpackageにする。

## 問題

あるengineerがrelease notes作成workflowをmulti-step promptへ蒸留する。「最新のmerged PRを読む。areaごとに分類する。それぞれを要約する。team styleに沿ったchangelog entryを書く。Slack draftへ投稿する」。最初はteam用のNotion docに置いた。

次に、このworkflowをClaude Code、Cursor、Codex CLIから使いたくなった。各agentはinstructionの読み込み方が異なる。Claude Code slash-command、Cursor rules、Codex `.codex.md`。engineerはworkflowを3回copyし、3つのcopyを保守することになる。

AGENTS.mdとSKILL.mdを組み合わせるとこれを直せる。

- **AGENTS.md** はrepo rootに置く。互換agentはsession start時に読む。「このprojectはどう動くか。conventionは何か。test commandはどれか」。
- **SKILL.md** はportable bundleである。YAML frontmatter（name、description）+ markdown body + optional resources。Skills対応agentは必要時にnameで読み込む。
- **MCP**（Phase 13 · 06-14）はskillが呼び出す必要のあるtoolsを扱う。

3つの層、1つのportable artifact。

## The Concept

### AGENTS.md (agents.md)

2025年後半に公開され、2026年4月までに60,000以上のrepoで採用された。repo rootに1つ置くfile。形式:

```markdown
# Project: my-service

## Conventions
- TypeScript with strict mode.
- Use Pydantic for models on the Python side.
- Tests run with `pnpm test`.

## Build and run
- `pnpm dev` for local dev server.
- `pnpm build` for production bundle.
```

Agentはsession start時にこれを読み、そのproject向けに振る舞いを調整する。2026年のcoding agentはAGENTS.mdをほぼすべてsupportする: Claude Code、Cursor、Codex、Copilot Workspace、opencode、Windsurf、Zed。

### SKILL.md format

AnthropicのAgent Skills（2025年12月にopen standardとしてrelease）:

```markdown
---
name: release-notes-writer
description: Write a changelog entry for the latest merged PRs following this project's style.
---

# Release notes writer

When invoked, run these steps:

1. List PRs merged since the last tag. Use `gh pr list --base main --state merged`.
2. Group by label: feature, fix, chore, docs.
3. For each PR in each group, write one line: `- <title> (#<num>)`.
4. Draft the release notes and stage them in CHANGELOG.md.

If the user says "ship", run `git tag vX.Y.Z` and `gh release create`.

## Notes

- Never include commits without a PR.
- Skip "chore" entries from the public changelog.
```

Frontmatterはskillのidentityを宣言する。bodyはskillがloadされたときにmodelへ渡されるpromptである。

### Progressive disclosure

Skillsは、agentが必要時だけ取得するsub-resourceを参照できる。例:

```
skills/
  release-notes-writer/
    SKILL.md
    style-guide.md
    template.md
    scripts/
      generate.sh
```

SKILL.mdは「style rulesはstyle-guide.mdを参照」と書く。Agentはskillが実行中のときだけstyle-guide.mdをpullする。これにより、modelが必要としない詳細でpromptを膨らませずに済む。

### Filesystem discovery

Agent runtimesは既知のdirectoryからSKILL.md filesをscanする:

- `~/.anthropic/skills/*/SKILL.md`
- Project `./skills/*/SKILL.md`
- `~/.claude/skills/*/SKILL.md`

Loadingはfolder nameとfrontmatter `name`で行う。Claude Code、Anthropic Claude Agent SDK、SkillKit（cross-agent）はこのpatternに従う。

### Anthropic Claude Agent SDK

`@anthropic-ai/claude-agent-sdk`（TypeScript）と`claude-agent-sdk`（Python）はsession start時にskillsをloadし、runtime内でcallableな「agents」として公開する。Agent loopはuserがskillを呼んだとき、そのskillへdispatchする。

### OpenAI Apps SDK

2025年10月に公開。MCP上に直接構築されている。OpenAIの従来のConnectorsとCustom GPT Actionsを、単一のdeveloper surfaceへ統合する。Apps SDK appは次のものから成る。

- MCP server（tools、resources、prompts）。
- ChatGPT UI向けのwidget metadata。
- Interactive surface用のoptional MCP Apps `ui://` resource。

同じprotocolで、よりrichなUXを提供する。

### Cross-agent portability via SkillKit

SkillKitのようなcross-agent distribution layerは、単一のSKILL.mdを32以上のAI agent（Claude Code、Cursor、Codex、Gemini CLI、OpenCodeなど）のnative formatへ変換する。Single source of truth、many consumers。

### The three-layer stack

| Layer | File | Loaded when | Purpose |
|-------|------|-------------|---------|
| AGENTS.md | repo root | session start | project-level conventions |
| SKILL.md | skills directory | skill invoked | reusable workflow |
| MCP server | external process | tools needed | callable actions |

3層は合成できる。Agentはsession start時にAGENTS.mdを読み、userがskillを呼び、skill instructionがMCP tool callsを含み、agentがMCP client経由でdispatchする。

## Use It

`code/main.py`にはstdlibだけで動くSKILL.md parserとloaderが入っている。`./skills/`以下を探索し、YAML frontmatterとmarkdown bodyをparseし、skill nameをkeyにしたdictを作る。その後、`release-notes-writer`をnameで呼び出すagent loopをsimulateする。

見るべき点:

- 最小stdlib parserでYAML frontmatterをparseする（`pyyaml` dependencyなし）。
- Skill bodyはverbatimに保存し、呼び出し時にagentがsystem promptへprependする。
- `read_subresource` functionで参照fileを必要時にpullし、progressive disclosureをdemoする。

## Ship It

このlessonは`outputs/skill-agent-bundle.md`を生成する。Workflowを与えると、このskillはcombined SKILL.md + AGENTS.md + MCP-server-blueprint bundleを作り、複数agentへportableにする。

## Exercises

1. `code/main.py`を実行する。`skills/`以下にsecond skillを追加し、loaderが拾うことを確認する。

2. このcourse repo向けのAGENTS.mdを書く。Testing commands、style conventions、Phase 13 mental modelを含める。

3. Teamのinternal docsにあるmulti-step workflowをSKILL.mdへ移植する。Claude Codeでloadされることを確認する。

4. そのskillをCursorとCodexのnative rule formatへ手作業で翻訳する。format間diffを数える。このtranslation surfaceをSkillKitが自動化する。

5. Anthropic Agent Skills blog postを読む。このlessonのloaderがcoverしていないClaude Agent SDKのfeatureを1つ特定する。（Hint: agent sub-invocation）

## Key Terms

| Term | よく言われること | 実際の意味 |
|------|----------------|------------|
| SKILL.md | 「skill file」 | YAML frontmatterとmarkdown body。Agent runtimeがloadする |
| AGENTS.md | 「repo-rootのagent context」 | Session start時に読まれるproject-level conventions file |
| Progressive disclosure | 「sub-resourcesをlazy-loadする」 | Skill bodyが、必要時だけpullするfileを参照する |
| Frontmatter | 「先頭のYAML block」 | `---` delimiter内のmetadata（name、description） |
| Claude Agent SDK | 「Anthropicのskill runtime」 | `@anthropic-ai/claude-agent-sdk`。Skillsをloadしてrouteする |
| OpenAI Apps SDK | 「MCP + widget meta」 | MCPとChatGPT UI hooks上に作られたOpenAIのdeveloper surface |
| Skill discovery | 「filesystem scan」 | 既知directoryを辿ってSKILL.mdを探し、nameでkey化する |
| Cross-agent portability | 「1つのskillを多くのagentへ」 | SkillKit風toolで1つのSKILL.mdを32+ agentsへ変換する |
| Agent Skill | 「portable know-how」 | MCPのtool概念の外にある再利用可能なtask template |
| Apps SDK | 「MCP plus ChatGPT UI」 | ConnectorsとCustom GPTsをMCP上に統合したもの |

## 参考文献

- [Anthropic — Agent Skills announcement](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills) — 2025年12月のlaunch
- [Anthropic — Agent Skills docs](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview) — SKILL.md format reference
- [OpenAI — Apps SDK](https://developers.openai.com/apps-sdk) — ChatGPT向けMCP-based developer platform
- [agents.md](https://agents.md/) — AGENTS.md format and adoption list
- [Anthropic — anthropics/skills GitHub](https://github.com/anthropics/skills) — official skill examples
