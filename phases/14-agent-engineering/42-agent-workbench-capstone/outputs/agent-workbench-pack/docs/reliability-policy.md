# Reliability Policy

The workbench absorbs the five industry-recurring failure modes:

1. Hallucinated action — caught by the rule set + verification gate.
2. Scope creep — caught by the scope contract diff check.
3. Cascading errors — caught by feedback records + refuse-on-null-exit.
4. Context loss — absorbed by repo memory; chat is not the source of truth.
5. Tool misuse — caught by the reviewer rubric's verification dimension.

The policy is enforced by the verification gate. The override path is signed
and audited; agents cannot self-override.
