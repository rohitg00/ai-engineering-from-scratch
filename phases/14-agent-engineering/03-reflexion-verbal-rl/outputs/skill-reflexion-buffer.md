---
name: reflexion-buffer
description: Maintain an episodic-memory buffer of reflections for verbal RL with TTL, dedup, and scoped scope.
version: 1.0.0
phase: 14
lesson: 03
tags: [reflexion, episodic-memory, self-healing, verbal-rl, sleep-time]
---

Given a task class (repeating kind of agent run — e.g. "refactor a function," "close a support ticket"), maintain an episodic-memory buffer of reflections. Each reflection records a failure mode and the corrective insight in natural language. The buffer is prepended to the next trial of the same task class.

Produce:

1. Reflection capture. After a trial ends with an evaluator score below threshold, emit a one-line reflection in the shape "I failed to do X because Y; next time, Z." Discard reflections on external failures (network, upstream 500s) unless they are reproducible.
2. TTL and dedup. Reflections expire after N trials by default (10 suggested). Exact duplicates collapse. Near-duplicates (>0.9 cosine on a small embedding model, or shared substring >= 80%) keep only the most recent.
3. Scope policy. Three scopes: task-class (per task name), user (across tasks for same user), agent (across all users). Default is task-class. Escalate to user scope only if the reflection refers to user-specific preferences; never escalate to agent scope automatically.
4. Compaction. When the buffer exceeds the budget, run sleep-time compaction: cluster near-duplicates, summarize, merge. Compaction runs off the hot path — do not delay the primary agent's response.
5. Prompt integration. Emit a single block titled "What I learned from prior trials" with a bulleted list. Cap at 6 items in the prompt; overflow goes to a separate summary item ("... and 4 older reflections about timeouts").

Hard rejects:

- Writing reflections as "be more careful next time." That is not actionable. Re-run the reflector with a prompt that forces a concrete next-time instruction.
- Expiring reflections based on wall-clock time rather than trial count. TTL should be trial-scoped, not time-scoped, for offline-replayable runs.
- Storing reflections that reference secrets (API keys, tokens, PII). Reject with a specific "contains secret"-class error before committing to the buffer.

Refusal rules:

- If no evaluator is attached, refuse and recommend Lesson 05 (Self-Refine/CRITIC) — reflection requires a signal, not a gut feeling.
- If the task class is one-shot (never recurs), refuse; episodic memory does nothing for a task that never repeats.

Output: a structured buffer file (JSON with reflection objects: trial id, task class, scope, text, created_at, ttl_remaining), a prompt block for the next trial, and a "stale reflections" report listing entries that will expire soon.

End with a "what to read next" note pointing to Lesson 06 (context compression) if the buffer keeps hitting its cap, or Lesson 08 (Letta sleep-time compute) to move compaction off the hot path.
