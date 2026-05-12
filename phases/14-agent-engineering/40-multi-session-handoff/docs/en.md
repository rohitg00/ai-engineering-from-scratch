# Multi-Session Handoff

> The session is going to end. The work is not. The handoff packet is the artifact that turns "the agent worked for an hour" into "the next session is productive in the first minute." Build it on purpose, not as an afterthought.

**Type:** Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 34 (Repo Memory), Phase 14 · 38 (Verification), Phase 14 · 39 (Reviewer)
**Time:** ~50 minutes

## Learning Objectives

- Identify the seven fields every handoff packet needs.
- Generate a handoff from the workbench artifacts without hand-writing prose.
- Trim large feedback logs into a handoff-sized summary.
- Make the next session's first action deterministic.

## The Problem

The session ends. The agent says "great, we made progress." The next session opens. The next agent asks "where did we leave off?" The first agent's answer is gone. The next agent rediscovers, re-runs the same commands, re-asks the human the same questions, and burns thirty minutes recovering the last thirty seconds of the previous session.

The cost of a bad handoff is paid every session for the life of the task. The fix is a packet generated automatically at session end: what changed, why, what was tried, what failed, what is left, what to do first next time.

## The Concept

```mermaid
flowchart LR
  State[agent_state.json] --> Generator[generate_handoff.py]
  Verdict[verification_report.json] --> Generator
  Review[review_report.json] --> Generator
  Feedback[feedback_record.jsonl] --> Generator
  Generator --> Handoff[handoff.md + handoff.json]
  Handoff --> Next[Next Session]
```

### Seven fields every handoff carries

| Field | Question it answers |
|-------|---------------------|
| `summary` | One paragraph of what was done |
| `changed_files` | The diff at a glance |
| `commands_run` | What was actually executed |
| `failed_attempts` | What was tried and why it did not work |
| `open_risks` | What could bite next session, with severity |
| `next_action` | The first concrete step next session takes |
| `verdict_pointer` | Path to the verification + review reports |

The `next_action` field is the load-bearing one. A handoff with everything except `next_action` is a status report, not a handoff.

### Handoffs are generated, not written

A hand-written handoff is a handoff that gets skipped on a hard day. The generator reads the workbench artifacts and emits the packet. The agent's job is to leave the workbench in a state the generator can summarize, not to write the summary.

### Two forms: human-readable and machine-readable

`handoff.md` is what the human reads. `handoff.json` is what the next agent loads. Both come from the same source artifacts. If they diverge, the JSON wins.

### Feedback log trimming

The full `feedback_record.jsonl` may be hundreds of entries. The handoff carries only the last K plus every entry with a non-zero exit. The next session loads the full log if it needs to, but the packet stays small.

## Build It

`code/main.py` implements:

- A loader that gathers state, verdict, review, and feedback into a single `WorkbenchSnapshot`.
- A `generate_handoff(snapshot) -> (markdown, payload)` function.
- A filter that picks the last K feedback entries plus all non-zero exits.
- A demo run that writes `handoff.md` and `handoff.json` next to the script.

Run it:

```
python3 code/main.py
```

Output: a printed handoff body, plus both files on disk.

## Use It

Production patterns:

- **Session-end hook.** The runtime fires the generator when the user closes the chat. The packet goes into `outputs/handoff/<session_id>/`.
- **PR template.** The generator's markdown is also a PR body. Reviewers read it without opening five other files.
- **Cross-agent handoff.** Build with one product (Claude Code), continue with another (Codex). The packet is the lingua franca.

The packet is small, regular, and cheap to produce. The cost saving compounds with every session.

## Ship It

`outputs/skill-handoff-generator.md` produces a generator tuned to a project's artifact paths, an end-of-session hook that runs it, and a `handoff.json` schema the next agent reads on startup.

## Exercises

1. Add an `assumptions_to_validate` field that surfaces every assumption the builder logged but the reviewer did not score above 1.
2. Trim the feedback summary differently for failing runs versus passing ones. Defend the asymmetry.
3. Include a "questions for the human" list. What is the threshold for a question to make it into the packet versus into a chat message?
4. Make the generator idempotent: running it twice produces the same packet. What needs to be stable for that to hold?
5. Add a "next session prereqs" section listing exactly the artifacts the next session must load before acting.

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Handoff packet | "Session summary" | Generated artifact carrying the seven fields, both markdown and JSON |
| Next action | "What to do first" | The one concrete step that starts the next session |
| Feedback trim | "Log summary" | Last K records plus every non-zero exit |
| Status report | "What we did" | A document missing `next_action`; useful, but not a handoff |
| Verdict pointer | "Receipt" | Path to the verification + review reports for traceability |

## Further Reading

- [Anthropic, Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [OpenAI Agents SDK handoffs](https://platform.openai.com/docs/guides/agents-sdk/handoffs)
- Phase 14 · 34 — the state file the generator reads
- Phase 14 · 38 — the verification verdict the packet points at
- Phase 14 · 39 — the reviewer report bundled into the packet
