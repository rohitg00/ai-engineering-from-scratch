# Role Specialization — Planner, Critic, Executor, Verifier

> The most common multi-agent decomposition in 2026: one agent plans, one executes, one critiques or verifies. MetaGPT (arXiv:2308.00352) formalizes this as SOPs encoded into role prompts — Product Manager, Architect, Project Manager, Engineer, QA Engineer — following `Code = SOP(Team)`. ChatDev (arXiv:2307.07924) chains designer, programmer, reviewer, tester through a "chat chain" with "communicative dehallucination" (agents explicitly request missing details). The verifier is load-bearing: Cemri et al. (MAST, arXiv:2503.13657) show every multi-agent failure can be traced to missing or broken verification. PwC reported 7× accuracy gain (10% → 70%) from structured validation loops in CrewAI.

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 16 · 04 (Primitive Model), Phase 16 · 05 (Supervisor)
**Time:** ~60 minutes

## Problem

Generic multi-agent systems produce generic output. Three coders in a group chat write three flavors of the same mediocre code. You can add more agents, add more rounds, and still not cross the quality threshold.

The fix is not more agents — it is *different* agents. Assign distinct roles. Give the critic tools the planner does not have. Give the verifier an objective test suite. Now the system has internal disagreement with grounded correction, not just parallel guessing.

## Concept

### The four canonical roles

**Planner.** Reads the goal, produces a step list or a spec. Tools: knowledge retrieval, docs. Output: structured plan.

**Executor.** Reads one plan step at a time, produces the artifact. Tools: the actual work tools (code compiler, shell, API client). Output: the artifact.

**Critic.** Reads the executor's output against the planner's intent. Tools: read-only access to the artifact, static analysis. Output: accept/reject with reasons.

**Verifier.** Reads the artifact and runs a deterministic check. Tools: test runner, type checker, schema validator. Output: pass/fail with evidence.

Critic is subjective, opinionated, often LLM-based. Verifier is objective, deterministic, often code-based. They are not the same role.

### MetaGPT's SOP pattern

MetaGPT (arXiv:2308.00352) encodes software engineering SOPs as role prompts:

- **Product Manager** writes the PRD.
- **Architect** produces the system design.
- **Project Manager** splits tasks.
- **Engineer** implements.
- **QA Engineer** runs tests.

Each role has a strict input/output schema. The role prompt says what the role *is* and what it *must produce*. The `Code = SOP(Team)` formulation — deterministic SOPs turn a team of LLMs into a predictable pipeline.

### ChatDev's communicative dehallucination

ChatDev adds a key move: when an executor needs a specific detail that was not in the plan, it explicitly asks the designer before continuing. This prevents the classic LLM failure of plausibly inventing the detail.

Implementation: the role prompt includes "when you need specific information you were not given, ask the relevant role by name before producing output."

### Why verifier matters most

Cemri et al. (MAST) traced 1642 multi-agent execution failures. 21.3% were verification gaps — the system shipped an answer no one had checked. The remaining 79% often trace back to "there was a check that failed silently or was never run." Verification is the load-bearing role.

PwC reported (CrewAI deployments, 2025) that adding a structured validation loop moved accuracy from 10% to 70%. 7× gain from one role.

### Critic vs verifier

- A critic is an LLM reviewing an artifact for quality. Subjective. Can be fooled by plausible prose.
- A verifier is a deterministic program running on the artifact. Objective. Gives pass/fail with evidence.

Use both. Critic catches taste issues the verifier cannot articulate. Verifier catches bugs the critic cannot see because they show up only at runtime.

### The anti-pattern

Every role in your system is an LLM and every role's output is "looks good to me." Classic MAST failure mode. Add at least one verifier whose pass/fail is decided by code, not by an LLM.

### Framework mappings

- **CrewAI** — `Agent(role, goal, backstory)` is the textbook specialization surface.
- **LangGraph** — nodes can have specialized prompts; edges enforce the pipeline.
- **AutoGen** — role-specific ConversableAgents with one-word names in a GroupChat.
- **OpenAI Agents SDK** — handoff tools between role-specialized Agents.

## Build It

`code/main.py` implements a 4-role pipeline building a simple Python function:

- **Planner** produces a spec.
- **Executor** generates a code string.
- **Critic** (LLM-simulated) flags obvious issues.
- **Verifier** runs the generated code in a sandbox (`exec`) against a test case.

Demo runs twice: once where the executor produces correct code (critic + verifier both pass), once where the executor produces off-spec code (critic misses the bug because it looks plausible, verifier catches it because the test fails).

Run:

```
python3 code/main.py
```

## Use It

`outputs/skill-role-designer.md` takes a task and produces the role roster (3-5 roles), the input/output schema per role, and the verifier check. Use this before wiring agents into a framework.

## Ship It

Checklist:

- **At least one deterministic verifier.** Never all-LLM.
- **Explicit I/O schema per role.** The planner returns a spec, not prose; the executor reads that schema.
- **Communicative dehallucination.** Executor must ask the planner when info is missing; never invent it.
- **Critic/verifier ordering.** Run critic first (cheap, catches design issues), verifier second (slow, catches bugs).
- **Loop budget.** Max 2 critic-executor revision rounds before escalating to human.

## Exercises

1. Run `code/main.py` and observe how the verifier catches the bug the critic missed. Add a static-analysis check (count occurrences of `return`) as an additional verifier. What does it catch that the runtime test misses?
2. Add a 5th role: "requirements analyst" that translates user wish into planner-ready spec. What communicative dehallucination requests should flow up to it?
3. Read MetaGPT Section 3 ("Agents"). List the input/output schema of each of MetaGPT's 5 roles.
4. Read ChatDev's chat-chain diagram (arXiv:2307.07924 Figure 3). Identify where communicative dehallucination breaks a loop that would otherwise be infinite.
5. PwC's 7× accuracy gain came from verification loops. Hypothesize three tasks where adding a verifier would not help — where deterministic checking of correctness is impossible or prohibitively expensive.

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Role specialization | "Different agents, different jobs" | Distinct system prompts tuned for planner/executor/critic/verifier roles. |
| SOP pattern | "Encoded standard operating procedure" | MetaGPT's framing: strict I/O schemas per role turn a team into a pipeline. |
| Communicative dehallucination | "Ask before inventing" | ChatDev pattern: executor asks planner when a detail is missing rather than making one up. |
| Critic | "LLM reviewer" | Subjective, opinionated reviewer. Catches taste issues. Can be fooled by plausible prose. |
| Verifier | "Deterministic check" | Code-based pass/fail. Test runner, type checker, schema validator. Cannot be fooled. |
| Verification gap | "No one checked" | 21.3% of MAST failures. Answer shipped without a check that would have caught the bug. |
| Revision loop | "Critic sends it back" | Critic rejection triggers executor re-run with feedback. Needs a budget. |
| All-LLM anti-pattern | "Looks good to me" | Every role is an LLM, no deterministic check. Classic MAST failure. |

## Further Reading

- [Hong et al. — MetaGPT: Meta Programming for Multi-Agent Collaboration](https://arxiv.org/abs/2308.00352) — the SOP-as-role-prompt reference paper
- [Qian et al. — Communicative Agents for Software Development (ChatDev)](https://arxiv.org/abs/2307.07924) — chat chain + communicative dehallucination
- [Cemri et al. — Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/abs/2503.13657) — MAST taxonomy; verification gaps are 21.3% of failures
- [CrewAI docs — Agent roles](https://docs.crewai.com/en/introduction) — production role specification surface
