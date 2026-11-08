---
id: first-divergence-at-turn-zero
title: A flaky agent check that compared the wrong sessions
card: scenarios
kind: incident
level: 3
roles: [ai-evaluation-reliability-engineer, agentic-ai-engineer]
rounds: [debugging, design-review]
tags: [agents, regression-test, sessions, cassettes, determinism]
minutes: 25
lessons: []
manuals: [docker-sandboxes-101#s-session-db-sessions-diff-and-eval]
practice: []
cheatsheet: []
related: [scenarios/eval-failed-with-zero-cost]
updated: 2026-11-03
system:
  version: docker-agent v1.149.0 and sbx v0.47.0
  model: a recorded cassette of ai/qwen3:4b, replayed with no model
  hardware: one Mac, no GPU
source:
  - manuals/docker-sandboxes-101/capture/out/21-two-runs.txt
  - manuals/docker-sandboxes-101/capture/out/18-transcript.txt
  - manuals/docker-sandboxes-101/capture/out/21-sessions-diff.txt
  - manuals/docker-sandboxes-101/capture/out/21-sessions-diff.json
  - manuals/docker-sandboxes-101/capture/out/20-restricted.txt
  - manuals/docker-sandboxes-101/capture/out/21-session-db.txt
  - manuals/docker-sandboxes-101/sections/5-6-session-db-sessions-diff-and-eval.md
---

## Situation

A team keeps a small agent that lists the files of a repository and counts lines. Every change to its agent file goes through a check: run the agent, then compare the newest session with the one before it with `sessions diff`, and fail the job when the two differ. In one week the check gave three different results. Once it printed `Error: unknown shorthand flag: '1' in -1`. Once it passed. Once it failed with `sessions diverged` and a first divergence at turn 0, where one side called `list_directory` and the other side called `shell`.

The team reads the three results as proof that the agent is nondeterministic, and a pull request proposes to delete the check. You have the command lines, the outputs of the three comparisons, and the session store of the machine that ran them.

## Evidence

- [two runs of the files agent from the same cassette](evidence/two-replays-of-one-cassette.txt)
- [the transcript that the cassette replays](evidence/the-five-turns.txt)
- [the first attempt, in the form the help text gives](evidence/the-help-form.txt)
- [the two replays compared](evidence/identical-over-five-turns.txt)
- [the newest session against the third newest, with the CI flag](evidence/the-divergence.txt)
- [the first turn of the restricted run of the guarded agent](evidence/the-third-newest-session.txt)
- [the sessions table and the five newest titles](evidence/the-sessions-table.txt)

## Questions

1. Which of the three results says anything about the agent, and which say something about the command?
2. Two runs from the same recording agreed with each other. What does a cassette fix, and what does it leave free?
3. The divergence names `list_directory` against `shell` at turn 0. What are the two sessions, and how do you know?
4. What does the comparison compare, and why does it stop at the first difference?
5. Rewrite the check so that a divergence can only come from a change to the agent.

## Walkthrough

1. **Read the two runs.** Same flags, same working directory, same cassette, same two messages, and the same final answer both times. A cassette holds the recorded model replies, and `--fake` replays them with no model. The model is out of the loop, so the only free parts are the operands and the measure.
2. **Count the turns.** The transcript the cassette replays has five model replies: a `list_directory` call, an answer, a `shell` call that the user rejected, a `read_file` call, and an answer. Those five replies are the five turns the comparison reports.
3. **Read the failed command.** The help text gives the form with bare negative references, and the parser reads the first one as a flag. The error names the flag parser and nothing else. Put `--` before the references, as the second command does. This result says nothing about the agent.
4. **Read the pass.** The two replays compared identical over all five turns, and the JSON form counts `turns_a` 5, `turns_b` 5, `turns_matched` 5. This is the result the check exists for.
5. **Read the failure.** The comparison is between the newest session, with 5 turns, and the third newest, with 6 turns. The newest called `list_directory` first. The third newest called `shell` with `echo m101-ok` first. That first call matches the restricted run of a different agent file, the guarded agent, which answers a different user message. The reference `-3` did not point at a run of the files agent at all.
6. **Read the session store.** Relative references count every session in one `session.db` by creation time, and the table holds runs of every agent file plus the sub-sessions of the team runs. The five newest rows are all titled `Running agent`, so a title cannot tell runs apart. Whatever ran last on this machine is `-1`.
7. **Read what the comparison measures.** It compares the sequence of tool calls and ignores the prose of the assistant. After the first difference every later turn is downstream, so it reports one divergence and stops.

## Resolution

The agent did not change. The flaky result came from the operands: a relative reference into a shared session store that held runs of other agents, and a command form from the help text that the parser rejects. The one honest comparison, two replays of one cassette, matched on all five turns.

The repaired check fixes three things. It fixes the model, by recording one cassette with `--record=PATH` and `--models-gateway` and replaying both sides with `--fake`, one tool call per message, because a turn with two parallel calls answers 500 on replay. It fixes the operands, by giving the check its own data directory with `--data-dir`, so that its `session.db` holds only its own runs, and by writing `--` before the references. It fixes the measure, by running `sessions diff --fail-on-divergence` and reading only the first divergence. The proof is the pass that already exists: with one cassette on both sides, the report counted 5 matched turns of 5, and the exit code was 0.

## Wrong turns

- "The agent is nondeterministic, so delete the check." Two replays from one cassette matched on all five turns. The comparison that failed compared two different agents.
- "Quote the reference as `'-1'` to fix the flag error." The parser still sees a leading hyphen. `--` ends flag parsing.
- "Compare the assistant text instead of the tool calls." Prose varies between live runs, and the comparison ignores it on purpose. The tool calls are the behaviour.
- "Read the turns after turn 0 to find more bugs." Everything after the first divergence is downstream of it and is not compared.

## Generalize

A regression check on an agent needs three fixed things: the model replies, the operands, and the measure. A cassette fixes the first. A private session store and explicit references fix the second. A comparison of tool calls that stops at the first difference fixes the third. When a check flips between pass and fail, find out what it compared before you blame what it measured.

## Taught in

[The sessions section](../../../manuals/docker-sandboxes-101/sections/5-6-session-db-sessions-diff-and-eval.md#sessions-diff) shows the help form, the working form and this divergence.
