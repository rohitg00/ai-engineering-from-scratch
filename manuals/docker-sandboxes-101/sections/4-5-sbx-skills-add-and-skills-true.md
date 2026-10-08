# `sbx skills add` and `skills: true`

> One shared skills store serves every sandbox read-only by default, and the same `SKILL.md` directories are what `docker-agent` discovers with `skills: true`.

You keep a `pdf` skill under `~/.claude/skills` on your laptop. Inside a sandbox the agent has its own home directory and never sees it. The shared skills store is the one place you fill, and every sandbox for a supported agent reads it.

When you finish this section, you can fill the store, choose how each sandbox mounts it, and turn the same skills on for `docker-agent`.

## The store

**Skill:** a directory with a `SKILL.md` whose metadata an agent reads into its system prompt, and whose body it loads when a task matches {{docs-agent How Skills Work}}.

**Shared skills store:** the host directory that `sbx` links into every sandbox for a supported agent. On the recording host it was empty:

```listing
title: the store before any skill is added
source: capture/out/15-skills-ls.json
lang: json
---
{
  "store": "$HOME/Library/Application Support/com.docker.sandboxes/sandboxes/agent-skills",
  "skills": []
}
```

On Linux the store is `~/.local/state/sandboxes/sandboxes/agent-skills`, and on Windows `%LOCALAPPDATA%\DockerSandboxes\sandboxes\state\agent-skills` {{docs-sbx Import skills from the host}}. "Running `sbx reset` clears the shared store" {{docs-sbx Shared store behavior}}.

## add, import, ls, rm, and update

`sbx skills add <repository>` installs from a Git URL or a GitHub `owner/repository`, and "The repository must contain one or more valid SKILL.md files" {{help-sbx sbx skills add}}. `--skill NAME` picks skills by name, repeatable or comma-separated, so `sbx skills add anthropics/skills --skill pdf` installs one. The capture kit did not record an `add`, because the step needs GitHub. `sbx skills update` refreshes only skills that `add` installed, and `sbx skills rm` asks before it removes one {{help-sbx sbx skills update}}.

`sbx skills import` copies skills already installed on the host, checking six directories in order, and the first copy of a duplicate name wins {{help-sbx sbx skills import}}:

| Host source | Agent | Mount target in the sandbox |
|---|---|---|
| `~/.agents/skills` | Codex and Devin | `/home/agent/.agents/skills` |
| `~/.claude/skills` | Claude Code | `/home/agent/.claude/skills` |
| `~/.config/opencode/skills` | OpenCode | not listed in the docs table |
| `~/.copilot/skills` | Copilot | `/home/agent/.copilot/skills` |
| `~/.cursor/skills` | Cursor | `/home/agent/.cursor/skills` |
| `~/.factory/skills` | Droid | `/home/agent/.factory/skills` |

The order comes from the help text and the mount targets from the docs {{docs-sbx Import skills from the host}}. "Imported skills are available to Claude, Codex, Copilot, Cursor, Droid, and OpenCode" {{help-sbx sbx skills import}}. `sbx skills import` arrived in v0.37.0, and `add`, `update`, and `rm` in v0.42.0 {{rel-sbx v0.42.0}}.

## How a sandbox sees the store

By default "the store's entries are linked into the agent's skills directory read-only, which stays writable so kits can install skills beside them" {{help-sbx sbx skills}}. "Linking happens at container start" {{help-sbx sbx skills}}, so an edit to an existing skill is live, while "adding a store entry reaches a running sandbox only on its next start" {{help-sbx sbx skills}}. Removing a skill breaks its link at once.

`--skills off|readonly|readwrite` on `sbx run` or `sbx create` chooses the mode per sandbox, and `readwrite` mounts the store over the directory so the sandbox's writes are shared. The default is `readonly`, or the `skills.defaultMode` setting, which the recording host had at its default (`capture/out/02-settings.txt`). The three-way flag replaced `--no-share-skills` in v0.43.0 {{rel-sbx v0.43.0}}. The capture kit did not list that directory from inside a sandbox, so the link form is not shown.

In a v3 kit the agent declares the path itself, with `agent-skills@1`, because "A runtime cannot know where an arbitrary agent reads skills" {{kitcap agent-skills@1}}. A runtime "MUST default an omitted `mode` to `readonly`" {{kitcap agent-skills@1}}. The effective access is the narrower of the host setting and the kit's `mode`. Raising a path to `readwrite` is a widening that stops for approval, as [the capabilities section](#s-com-docker-sandbox-capabilities) explains.

## docker-agent and skills: true

`docker-agent` discovers the same directories on its own. "Docker Agent scans standard directories for `SKILL.md` files" {{docs-agent How Skills Work}}, and "Skill metadata (name, description) is injected into the agent's system prompt" {{docs-agent How Skills Work}}:

| Path | Search |
|---|---|
| `~/.codex/skills/` | recursive |
| `~/.claude/skills/` | immediate children only |
| `~/.agents/skills/` | recursive |
| `.claude/skills/` | the current directory only |
| `.github/skills/` | each directory from the git root to the current one |
| `.agents/skills/` | each directory from the git root to the current one |

In the agent file, `skills: true` loads every discovered skill, a list restricts it, and `false` turns it off {{docs-agent Filtering Skills}}. A list item that is `local` or an `http://` or `https://` URL is a source, and any other string is a skill name. "A name that doesn't match any discovered skill is logged as a warning at startup but is otherwise ignored" {{docs-agent Filtering Skills}}. The agent needs the `filesystem` toolset to read skill files, as [the toolsets section](#s-toolsets-and-mcps) lists. `context: fork` in a skill's front matter "tells the agent to run the skill in an isolated sub-agent instead" {{docs-agent Running a Skill as a Sub-Agent}}.

## In a docker-agent sandbox

With `docker-agent run --sandbox`, the host paths above are invisible from the VM. Docker Agent builds a kit before the sandbox starts, "bind-mounted read-only into the VM at the same path" {{docs-agent Auto-Kit}}. Every `SKILL.md` found on the host "is copied under `<kit>/skills/<skill-name>/`" {{docs-agent What gets staged}}, every text file passes a secret redaction step, and `--no-kit` turns the staging off. [The end-to-end section](#s-docker-agent-run-sandbox-end-to-end) shows the printed summary of what was staged.

```takeaways
- Fill the store once with `sbx skills add` or `sbx skills import`, and recreate sandboxes that must see new entries.
- Leave `readonly` as the default, and choose `readwrite` only for a sandbox that should edit shared skills.
- Set `skills: true` and the `filesystem` toolset together in an agent file.
- Use `--sandbox` without `--no-kit` so the agent file's skills reach the VM.
```

Sources: help-sbx sbx skills, sbx skills add, sbx skills import, sbx skills update (research/sources/help-sbx.md); docs-sbx Share agent skills, skills.defaultMode (research/sources/docs-sandboxes.md); docs-agent Skills, Sandbox Mode Auto-Kit (research/sources/docs-docker-agent.md); kitcap agent-skills@1 (research/sources/kit-capabilities.md); rel-sbx v0.37.0, v0.42.0, v0.43.0 (research/sources/sbx-releases.md); capture/out/02-settings.txt, 15-skills-ls.json, 15-skills-ls.txt
