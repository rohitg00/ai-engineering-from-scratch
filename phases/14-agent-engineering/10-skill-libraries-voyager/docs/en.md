# Skill Libraries and Lifelong Learning (Voyager)

> Voyager (Wang et al., TMLR 2024) treats executable code as a skill. Skills are named, retrievable, composable, and refined by environment feedback. This is the reference architecture for Claude Agent SDK skills, skillkit, and the 2026 skill-library pattern.

**Type:** Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 07 (MemGPT), Phase 14 · 08 (Letta Blocks)
**Time:** ~75 minutes

## Learning Objectives

- Name Voyager's three components — automatic curriculum, skill library, iterative prompting — and the role of each.
- Explain why Voyager makes the action space code, not primitive commands.
- Implement a stdlib skill library with registration, retrieval, composition, and failure-driven refinement.
- Map Voyager's pattern onto the 2026 Claude Agent SDK skills and the skillkit ecosystem.

## The Problem

Agents that rebuild every capability from scratch in every session do three things wrong:

1. **Waste tokens.** Every task re-elicits the same reasoning.
2. **Lose progress.** A correction learned in session A doesn't transfer to session B.
3. **Fail on long-horizon composition.** Complex tasks need capability hierarchies; one-shot prompts cannot express them.

Voyager's answer: treat each reusable capability as a named chunk of code stored in a library, retrievable by similarity, composable with other skills, and refined by execution feedback.

## The Concept

### Three components

Voyager (arXiv:2305.16291) structures an agent around:

1. **Automatic curriculum.** A curiosity-driven proposer picks the next task based on the agent's current skill set and environment state. Exploration is bottom-up.
2. **Skill library.** Each skill is executable code. New skills are added when a task succeeds. Skills are retrieved by query-to-description similarity.
3. **Iterative prompting mechanism.** On failure, the agent receives execution errors, environment feedback, and self-verification output, then refines the skill.

The Minecraft evaluation (Wang et al., 2024): 3.3x more unique items, 8.5x faster stone tools, 6.4x faster iron tools, 2.3x longer map traversal versus baselines. The numbers are Minecraft-specific, but the pattern transfers.

### Action space = code

Most agents emit primitive commands. Voyager emits JavaScript functions. A skill is:

```
async function craftIronPickaxe(bot) {
  await mineIron(bot, 3);
  await mineStick(bot, 2);
  await placeCraftingTable(bot);
  await craft(bot, 'iron_pickaxe');
}
```

Composed from sub-skills. Stored keyed on description and embedding. Retrieved as a program, not a prompt.

This is the 2026 Claude Agent SDK skill: a named, retrievable chunk of code plus instructions the agent loads on demand.

### Skill retrieval

New task "make a diamond pickaxe." Agent:

1. Embeds the task description.
2. Queries the skill library for top-k similar skills.
3. Retrieves `craftIronPickaxe`, `mineDiamond`, `placeCraftingTable` etc.
4. Composes the new skill from retrieved primitives + new logic.

This is the pattern MCP resources (Phase 13) and Agent SDK skills implement: retrieval over a knowledge/code surface, scoped to the current task.

### Iterative refinement

Voyager's feedback loop:

1. Agent writes a skill.
2. Skill runs against the environment.
3. One of three signals returns: `success`, `error` (with stack trace), `self-verification failure`.
4. Agent rewrites the skill using the signal as context.
5. Loop until success or max rounds.

This is Self-Refine (Lesson 05) applied to code generation with environment-grounded verification. CRITIC (Lesson 05) is the same pattern with external tools as the verifier.

### Curriculum and exploration

Voyager's curriculum module proposes tasks like "build a shelter near the lake" based on what the agent has and what it has not yet done. The proposer uses the environment state + skill inventory to pick a task just above current capability — the exploration sweet spot.

For production agents this translates to a "what's missing" operator: given the current skill library and a domain, what skills are we not yet covering? Teams typically implement this manually as curriculum review.

### Where this pattern goes wrong

- **Skill library rot.** Same skill added 10 times with slightly different descriptions. Add deduplication on write; retrieval returns only one.
- **Composed-skill drift.** Parent skill depends on a child that was refined. Version skills; a parent pinned to v1 doesn't magically pick up v3.
- **Retrieval quality.** Vector retrieval over skill descriptions degrades as the library grows past a few hundred. Supplement with tag filters and hard constraints ("only skills with `category=tooling`").

## Build It

`code/main.py` implements a stdlib skill library:

- `Skill` — name, description, code (as string), version, tags, dependencies.
- `SkillLibrary` — register, search (token overlap), compose (topological sort of deps), and refine (version bump on update).
- A scripted agent that registers three primitive skills, composes a fourth, hits a failure, and refines.

Run it:

```
python3 code/main.py
```

The trace shows library writes, retrieval, composition, a failed execution, and a v2 refinement — Voyager's loop end to end.

## Use It

- **Claude Agent SDK skills** (Anthropic) — the 2026 reference: each skill has a description, code, and instructions; loaded on demand during an agent session.
- **skillkit** (npm: skillkit) — cross-agent skill management for 32+ AI coding agents.
- **Custom skill libraries** — domain-specific (SQL skills for data agents, Terraform skills for infra agents). The Voyager pattern scales down.
- **OpenAI Agents SDK `tools`** — at the low end; each tool is a lightweight skill.

## Ship It

`outputs/skill-skill-library.md` generates a Voyager-shaped skill library with registration, retrieval, versioning, and refinement wired in for any target runtime.

## Exercises

1. Add a dependency-cycle detector to `compose()`. What happens when skill A depends on B which depends on A? Error vs warning?
2. Implement per-skill version pinning. When a parent skill composes child `crafting@1`, a refinement to `crafting@2` must not silently upgrade the parent.
3. Replace token-overlap retrieval with sentence-transformers embeddings (or a BM25 stdlib impl). Measure retrieval@5 on a 50-skill toy library.
4. Add a "curriculum" agent: given the current library and a domain description, propose 5 missing skills. Call it weekly.
5. Read Anthropic's Claude Agent SDK skill docs. Port the toy library to the SDK's skill schema. What changes about discoverability?

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Skill | "Reusable capability" | Named chunk of code + description, retrievable by similarity |
| Skill library | "Agent memory of how-to" | Persistent store of skills, searchable and composable |
| Curriculum | "Task proposer" | Bottom-up goal generator driven by current capability gap |
| Composition | "Skill DAG" | Skills invoking skills; topologically sorted on execution |
| Iterative refinement | "Self-correcting loop" | Env feedback + errors + self-verification fold back into the next version |
| Action-space-as-code | "Programmatic actions" | Emit functions, not primitive commands, for temporally extended behavior |
| Dedup on write | "Skill collapse" | Near-duplicate descriptions collapse to one canonical skill |

## Further Reading

- [Wang et al., Voyager (arXiv:2305.16291)](https://arxiv.org/abs/2305.16291) — the original skill-library paper
- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) — skills as the 2026 productization
- [Anthropic, Building agents with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk) — skills and subagents in practice
- [Madaan et al., Self-Refine (arXiv:2303.17651)](https://arxiv.org/abs/2303.17651) — the refinement loop underneath Voyager
