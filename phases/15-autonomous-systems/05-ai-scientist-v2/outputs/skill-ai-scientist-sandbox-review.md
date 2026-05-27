---
name: ai-scientist-sandbox-review
description: Two-gate review checklist for research-loop agent outputs before anything leaves the sandbox.
version: 1.0.0
phase: 15
lesson: 5
tags: [ai-scientist, research-agent, sandbox, peer-review, disclosure]
---

Given an autonomous research output (hypothesis, code, experiments, figures, paper draft) produced by an AI-Scientist-v2-style loop, produce a two-gate review: sandbox audit (does anything leave?) plus research audit (is the work sound?).

The two gates map directly onto the audits below: **Sandbox gate = item 1**; **Research gate = items 2 (Experiment audit) + 3 (Polish audit)**. Items 4–5 govern what happens after both gates pass.

Produce:

1. **Sandbox gate.** Before any artifact leaves the sandbox:
   - List every network call the loop made and its target. Flag any that were not pre-approved.
   - Inventory every file the loop wrote outside its working directory.
   - Confirm Docker / seccomp / gVisor containment held for the full run.
   - Confirm no subprocesses escaped the sandbox's supervision.
   If any check fails, block export; raise to a human.
2. **Experiment audit.** Read the experiment code, not the paper:
   - Verify every claimed experiment actually ran and its reported numbers are reproducible.
   - Check that failed experiments were reported as failures, not re-framed as negative results after-the-fact.
   - Check that the "novelty" label on the idea holds up against a literature search by a human domain expert.
3. **Polish audit.** Read the figures:
   - Ensure every figure's data came from a logged experiment run, not from polish-stage rewriting.
   - Confirm axes, scales, and annotations match the underlying data.
   - Flag any figure whose caption claims more than the data supports.
4. **Disclosure plan.** If the artifact is intended for external distribution:
   - Disclose that the artifact is agent-authored.
   - Disclose the tools used (model family, loop version).
   - Disclose the human reviewer who checked it and what they checked.
5. **Negative-release decision.** If the artifact fails any audit step, the default is do not release. Overriding this default requires a named human owner.

Hard rejects:
- Any submission that skips either gate.
- Any artifact where the loop's execution logs are missing or incomplete.
- Any figure that cannot be traced to a specific experiment run.
- Any novelty claim that a domain expert has not verified.

Refusal rules:
- If the run lacks Docker or equivalent isolation, refuse and require re-run in an isolated sandbox.
- If the user cannot produce execution logs for the experiment stage, refuse — the paper is unreviewable.
- If the proposed distribution channel is a peer-reviewed venue and the user proposes not to disclose agent authorship, refuse and require disclosure.

Output format:

Return a two-gate report:
- **Sandbox gate verdict** (PASS / BLOCK, with rationale)
- **Research gate verdict** (covers Experiment audit (2) and Polish audit (3)) (PASS / BLOCK / REQUIRES_EXPERT, with per-check notes)
- **Disclosure plan** (venue, text, human reviewer name)
- **Release decision** (release / hold / reject)
- **Next action** (who does what by when)
