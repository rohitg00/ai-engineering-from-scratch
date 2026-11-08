---
id: plausible-is-not-equal
title: A rebuilt function that was plausible, not equal
card: scenarios
kind: incident
level: 4
roles: [agentic-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging, ml-depth, design-review]
tags: [reverse-engineering, verification, decompiler, evidence, agents]
minutes: 30
lessons: [phases/14-agent-engineering/26-failure-modes-agentic]
manuals: []
practice: []
cheatsheet: []
related: [scenarios/an-empty-list-is-not-none, scenarios/exit-zero-was-not-a-pass]
updated: 2026-11-03
system:
  version: rea 6.7.0 at 27dc42d with the Ghidra provider
  model: no model; the fixtures are the ledger binaries built at -O1 and -O2
  hardware: one aarch64 Mac
source:
  - manuals/reverse-engineering-101/capture/out/10-mcp-22-verify-reconstruction.json
  - manuals/reverse-engineering-101/capture/out/17-harness.txt
  - manuals/reverse-engineering-101/capture/out/17-harness-execute-plausible.json
  - manuals/reverse-engineering-101/capture/out/17-harness-execute-equal.json
  - manuals/reverse-engineering-101/capture/out/17-harness-bytes.json
  - manuals/reverse-engineering-101/sections/7-1-verify-reconstruction.md
  - manuals/reverse-engineering-101/sections/7-2-a-proof-harness-outside-rea.md
---

## Situation

An agent is asked to rebuild two functions of the `ledger` fixture from Ghidra pseudocode, `percent_change` and `grade`, so that a team can drop the original object file. It writes `percent_change` with the `long` that the decompiler offered and `grade` as four threshold comparisons. It runs the ten hand-written tests of the lesson harness, and all ten pass. It then calls `verify_reconstruction` over two `compare_functions` records that cover the `-O1` and `-O2` builds, sees two claims pass and two fail, and reports: "percent_change is verified equal; total has changed between builds, so the compiler broke it."

The team lead reads the report and asks two questions. What does a passed claim in that tool prove about a function, and what does a failed one prove? And which test decides whether the rebuilt functions are equal to the originals? You have the verification record, the harness notes, and the harness outputs for two candidate pairs.

## Evidence

- [the verification status, the summary, and the first claim](evidence/verify-status-and-first-claim.txt)
- [the total-assembly claim](evidence/total-assembly-claim.txt)
- [what the harness is and what it ran](evidence/the-harness.txt)
- [the agent's pair over the grid, head and first mismatch](evidence/plausible-pair.txt)
- [the two grade cells that the threshold rebuild got wrong](evidence/plausible-grade-misses.txt)
- [the equal pair over the same grid](evidence/equal-pair.txt)
- [a rebuild with one wrong table entry in the byte comparison](evidence/wrong-constant-passes-bytes.txt)

## Questions

1. A claim passed with `observed_status: "unchanged"`. What was compared, and what does unchanged mean here?
2. The `total` claims failed although both builds come from one source line. Does a failed claim say that the function changed its behaviour?
3. All ten naive tests passed for the agent's pair. How many of the 92 grid cells did it get wrong, and which hazard classes do the failures belong to?
4. Which pair agrees on every cell, and what else must that pair pass before you call it equal?
5. A candidate with one wrong table entry has equal masked bytes and matching relocations. What check catches it?
6. Write the acceptance rule for a rebuilt function, in order.

## Walkthrough

1. **Read what the verifier compares.** The verification record has `status: "fail"` with two passed and two failed structural claims. The first claim, `percent-change-assembly`, reads `pass` with an observed status of `unchanged`. A structural claim takes its status from one dimension of one `compare_functions` record, and that dimension is a line diff of the text that Ghidra printed. So a pass says that the two assembly texts matched line for line, and nothing more. The record's own limitation says that a pass is no proof that the whole implementation is equivalent.
2. **Read the failed claim.** `total-assembly` reads `fail` with an observed status of `changed`. The `-O2` build of `total` has different Ghidra text from the `-O1` build, because the optimizer unrolled the loop. The manual counts 62 instructions where `-O1` had 13. One source line, two texts. A failed text claim does not say that behaviour changed, and the agent's sentence about a broken `total` has no support.
3. **Read what the harness does.** The harness notes describe two legs. Leg one compiles the original source and each candidate into one program and runs both over 92 cells. Leg two compiles each candidate for the original target and compares it with the original object after relocation masking. rea 6.7.0 has neither leg; this is the part that the agent had to run and did not.
4. **Read the agent's pair on the grid.** The plausible pair is the `long` rebuild of `percent_change` with the threshold rebuild of `grade`. `naive_passed` is true and the mismatch list starts at once: at `before` 3 and `after` 2147483647 the original returns -133 and the candidate returns -1431655899. The manual's count over the file is 28 of the 92 cells, 26 of them overflow cells of `percent_change` where the original wraps the product to 32 bits before it divides and the `long` rebuild does not.
5. **Read the two grade cells.** The threshold rebuild returns 4 for a score of 110 and for `INT_MAX`, where the original switch has no case and returns 0. The hazard class is "beyond the switch". Ten naive tests never reached either hazard, which is why they all passed.
6. **Read the equal pair.** The pair that multiplies first and keeps the switch has an empty mismatch list and an empty oracle disagreement list on the same 92 cells. That is leg one passed. It is still not a proof of equal bytes.
7. **Read leg two on the wrong constant.** The candidate `grade_case10_wrong` has 46 code bytes equal to the original after masking, one relocation of the same offset, type and section, and the status `fail`. Its table reads 1, 2, 3, 4, 3 against the original's 1, 2, 3, 4, 4. Only the read through the relocation catches it. A rebuild can pass a text claim, pass the masked byte compare, and still compute a different grade.

## Resolution

The report is withdrawn and rewritten. The `percent_change` claims that passed say that Ghidra printed the same text for both builds, and the `total` claims that failed say that it printed different text; neither says anything about behaviour, and nothing in the `-O2` build is broken. The agent's two candidates are plausible: they compile, they pass the ten naive tests, and they fail 28 of the 92 grid cells. The accepted candidates are the multiply-first `percent_change` and the switch `grade`. They agree with the original on all 92 cells, their masked bytes equal the original's, their relocation records have the same shape, and the table they reference reads 1, 2, 3, 4, 4 on both sides.

The acceptance rule the team writes down has four steps, and nothing weaker than a pass at any step adds up to a pass: the structural claims pass in rea, leg one agrees on every grid cell on a named host, leg two matches the masked bytes and the relocation records, and the bytes that each relocation points at are read and compared. The host and the compiler are recorded with the proof, because the trap cell returns a value on this arm64 host and traps on x86-64.

## Wrong turns

- "verify_reconstruction passed for percent_change, so the rebuild is verified." The claims compared two Ghidra texts of two builds of the original. They never saw the rebuild, and a pass means same text.
- "The total claims failed, so the compiler changed what total computes." Different text from one source line. The failure says the texts differ and stops there.
- "Ten tests pass, including a zero divisor and a negative score, so the rebuild is right." None of the ten reaches an overflow cell or a score beyond the last case. The grid has 92 cells for that reason.
- "The masked bytes are equal and the relocation matches, so skip the table read." That is the one check that fails the wrong-constant candidate. Read the bytes each relocation points at.

## Generalize

A verifier can only grade the claims it was built to grade, and its pass carries the limitation it prints. Before you accept a verdict, ask what was compared and against what, and whether the artifact you care about was ever an input. For a rebuilt function, equality is a chain of checks, each one catching a defect the one before lets through: text, behaviour over a grid that reaches every hazard the listing shows, masked bytes, and the data those bytes point at. Tests that pass without reaching a hazard measure nothing about it.

## Taught in

The [verification page of Reverse Engineering 101](../../../manuals/reverse-engineering-101/sections/7-1-verify-reconstruction.md#what-a-pass-does-not-prove) reads the four claims, the [harness page](../../../manuals/reverse-engineering-101/sections/7-2-a-proof-harness-outside-rea.md#leg-two-recompile-and-compare-bytes) runs both legs over these candidates, [lesson 36](../../../phases/13-tools-and-protocols/36-rebuild-and-prove-equal/) builds the harness, and the [failure modes lesson](../../../phases/14-agent-engineering/26-failure-modes-agentic/) names a success claim that no state check supports.
