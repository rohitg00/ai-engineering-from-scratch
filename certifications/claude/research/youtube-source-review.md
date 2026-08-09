# YouTube Source Review

> Video teaches the motion. Official documentation defines the interface.

**Reviewed:** 2026-08-09

Videos were used for teaching sequences, lab ideas, and explanations. They were
not used as authority for exam weights, fees, policy, eligibility, or current
API fields. The public July 2026 exam guides and current Anthropic documentation
override every video.

## Curriculum Anchors

| Source | Why it matters | Useful sections |
|--------|----------------|-----------------|
| [Prompting 101](https://www.youtube.com/watch?v=ysPbXH0LpIE), Anthropic | Failure-first prompting and minimal interventions | [Delimiters at 10:10](https://www.youtube.com/watch?v=ysPbXH0LpIE&t=610s), [few-shot at 13:11](https://www.youtube.com/watch?v=ysPbXH0LpIE&t=791s), [prompt position at 15:47](https://www.youtube.com/watch?v=ysPbXH0LpIE&t=947s) |
| [Prompting for Agents](https://www.youtube.com/watch?v=XSZP9GhhuAc), Anthropic | Agent boundaries, tool design, budgets, and final-state evaluation | [Budgets at 9:47](https://www.youtube.com/watch?v=XSZP9GhhuAc&t=587s), [bare baseline at 15:42](https://www.youtube.com/watch?v=XSZP9GhhuAc&t=942s), [small eval at 21:38](https://www.youtube.com/watch?v=XSZP9GhhuAc&t=1298s) |
| [The CLAUDE.md file](https://www.youtube.com/watch?v=O0FGCxkHM-U), Claude | Compact project instructions as onboarding | [Onboarding at 0:40](https://www.youtube.com/watch?v=O0FGCxkHM-U&t=40s), [supporting docs at 1:57](https://www.youtube.com/watch?v=O0FGCxkHM-U&t=117s) |
| [Hooks in Claude Code](https://www.youtube.com/watch?v=IkaPHiMDazM), Claude | Deterministic controls around probabilistic behavior | [Determinism at 0:13](https://www.youtube.com/watch?v=IkaPHiMDazM&t=13s), [pre-tool blocking at 1:50](https://www.youtube.com/watch?v=IkaPHiMDazM&t=110s) |
| [Tool, skill, or subagent?](https://www.youtube.com/watch?v=mWvtOHlZM-I), Claude | Decomposing a prompt that has accumulated too many concerns | [Prompt bloat at 1:18](https://www.youtube.com/watch?v=mWvtOHlZM-I&t=78s), [context isolation at 3:54](https://www.youtube.com/watch?v=mWvtOHlZM-I&t=234s), [subagents at 35:19](https://www.youtube.com/watch?v=mWvtOHlZM-I&t=2119s) |
| [Claude Agent SDK full workshop](https://www.youtube.com/watch?v=TqC1qOfiVcQ), AI Engineer with Anthropic | Harnesses, tools, files, sessions, hooks, sandboxing, and subagents | [Filesystem at 4:47](https://www.youtube.com/watch?v=TqC1qOfiVcQ&t=287s), [compaction and hooks at 5:46](https://www.youtube.com/watch?v=TqC1qOfiVcQ&t=346s), [sandboxing at 14:17](https://www.youtube.com/watch?v=TqC1qOfiVcQ&t=857s) |
| [Building Agents with MCP](https://www.youtube.com/watch?v=kQmXtrmQ5Zg), AI Engineer with Anthropic | Clients, servers, tools, resources, prompts, and discovery | [Client role at 4:24](https://www.youtube.com/watch?v=kQmXtrmQ5Zg&t=264s), [tool discovery at 52:14](https://www.youtube.com/watch?v=kQmXtrmQ5Zg&t=3134s) |
| [Building with MCP and the Claude API](https://www.youtube.com/watch?v=aZLr962R6Ag), Anthropic | Claude API integration shape | Full 25-minute build, checked against current MCP docs |
| [Build Agents That Run for Hours](https://www.youtube.com/watch?v=mR-WAvEPRwE), AI Engineer with Anthropic | Checkpoints, evaluators, work contracts, and long-horizon coherence | [Checkpoints at 10:14](https://www.youtube.com/watch?v=mR-WAvEPRwE&t=614s), [evaluator at 19:02](https://www.youtube.com/watch?v=mR-WAvEPRwE&t=1142s) |

## Practical Lab Sources

- [Your First Agent on the Raw Messages API](https://www.youtube.com/watch?v=RheXq2HKJmY)
  supports the raw state-machine lab: inspect `stop_reason`, retain the complete
  message history, match tool-use identifiers, return tool results, and stop on
  explicit terminal conditions.
- [Hooks, Guardrails and Security](https://www.youtube.com/watch?v=GGO4tn4RTvY)
  supports a destructive-command block, output normalization, evidence checks,
  and indirect prompt-injection fixtures.
- [Complete Beginner's Course on AI Evaluations](https://www.youtube.com/watch?v=TL527yTpxlk)
  supplies a useful golden-set and human-label teaching sequence.
- [How to Systematically Set Up LLM Evals](https://www.youtube.com/watch?v=a3SMraZWNNs)
  reinforces unit checks, human review, model judges, A/B comparison, and the
  analyze-measure-improve loop.

## Certification Companions

- [Claude Certified Architect Foundations full course](https://www.youtube.com/watch?v=reDRM0tqhNs),
  freeCodeCamp and ExamPro, is a broad topic inventory. It is not the editorial
  model and does not define exam facts.
- [Claude Certified Architect Foundations exam review](https://www.youtube.com/watch?v=n-Jse3TE3MI),
  Tim Warner, reinforces building projects for each public scenario rather than
  memorizing answers.
- Independent Associate and Professional courses showed that scenario continuity
  and incident-first teaching are effective. This curriculum uses those patterns
  with new scenarios and language.

## User-Supplied Audit Set

These sources were reviewed as community material and checked against current
official exam guides, the certification FAQ, Academy course objectives, and
product documentation.

| Source | Signal kept | Claim not treated as fact |
|--------|-------------|---------------------------|
| [freeCodeCamp and ExamPro CCAR-F course](https://www.youtube.com/watch?v=reDRM0tqhNs) | Build-first sequencing across public CCAR-F scenarios | Demonstration behavior, personal advice, and product details without current documentation |
| [Chance Xie exam experience](https://www.youtube.com/watch?v=kY9z4hiH4nk) | Hands-on use and scenario reasoning matter more than term memorization | Score, preparation time, difficulty, and recalled question patterns |
| [Preporato study guide](https://www.youtube.com/watch?v=akzKBQVyFEI) | A practical study cadence and a wrong-answer taxonomy | Raw-score-to-pass conversions, guaranteed schedules, and predicted exam distribution |
| [Ivan Fediaev exam breakdown](https://www.youtube.com/watch?v=PUnB9b6VIWk) | Inspect exact mechanics and rejected alternatives | Personal exam composition, difficulty ranking, and recollected items |
| [freeCodeCamp Claude Code Essentials](https://www.youtube.com/watch?v=brLhhkUqcn4) | A candidate long-form practice companion | No factual claims imported: public captions were unavailable during this audit |
| [Peace Of Code 22-video playlist](https://www.youtube.com/playlist?list=PLviC8AFqAj5A9MHkRIn2fU5Ac2lEdJxNf) | Agent loops, subagent contracts, tools, recovery, context, and review demonstrations | Legacy MCP transport guidance, prompt-only JSON as a substitute for native structured output, and exam logistics |
| [Tech With Deepanshu Academy ranking](https://www.youtube.com/watch?v=OYyYlH6Un0Y) | Prioritize API lifecycle, Claude Code operations, Skills, MCP, subagents, and capability limits | Fixed course counts, course rankings, study-hour estimates, certificate value, and claims that advanced topics appeared on an exam |

The ranking video calls the catalog an 18-course, five-track collection and
estimates 50 to 60 hours for a complete sweep. The Academy changes too quickly
for those numbers to be curriculum invariants. This repository maps official
course objectives to durable lessons and records a verification date instead.

One direct correction matters for teaching: the video names the fourth AI
Fluency competency as "Dialogue." The official framework is **Delegation,
Description, Discernment, and Diligence**. The curriculum uses the official
terms. The video's narration also says the presenter completed 17 courses while
describing an 18-course catalog, another reason not to preserve catalog counts
as requirements.

## Standard Teaching Pattern

1. Show a plausible failure.
2. Capture a measurable baseline.
3. Add one design intervention.
4. Test both the final state and the trajectory.
5. Record the rejected alternatives.
6. Package the result as an artifact another person can inspect.

Security labs always include red-team fixtures. Architecture labs always include
an independent reviewer. Professional labs always end with a stakeholder-facing
explanation and a named operational owner.

## Drift Warnings

- The March 2025 MCP workshop predates later transport, authentication, registry,
  and SDK changes.
- Older Claude Code videos can preserve good workflow advice while showing stale
  settings keys, permission behavior, or feature names.
- Independent certification courses can lag blueprint revisions.
- Personal exam reports are learner anecdotes, not specification.
- Course-count, duration, ranking, and credential-value claims are catalog
  snapshots or opinions, not durable certification requirements.
- No source justifies answer-pattern tricks, reconstructed questions, dumps, or
  guaranteed-pass claims.
