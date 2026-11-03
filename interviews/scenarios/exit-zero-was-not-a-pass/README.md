---
id: exit-zero-was-not-a-pass
title: An exit code of zero that was not a pass
card: scenarios
kind: incident
level: 4
roles: [ai-evaluation-reliability-engineer, agentic-ai-engineer]
rounds: [debugging, design-review, system-design]
tags: [evidence, bundles, ci, reverse-engineering, unknowns]
minutes: 30
lessons: [phases/14-agent-engineering/26-failure-modes-agentic]
manuals: []
practice: []
cheatsheet: []
related: [scenarios/an-empty-list-is-not-none, scenarios/plausible-is-not-equal]
updated: 2026-11-03
system:
  version: rea 6.7.0 at 27dc42d with the Ghidra provider
  model: no model; the fixtures are the ledger binaries built at -O1 and -O2
  hardware: one aarch64 Mac
source:
  - manuals/reverse-engineering-101/capture/out/00-commands.txt
  - manuals/reverse-engineering-101/capture/out/14-compare-bundles.json
  - manuals/reverse-engineering-101/capture/out/12-evidence-export.txt
  - manuals/reverse-engineering-101/capture/out/13-evidence-import.json
  - manuals/reverse-engineering-101/capture/out/13-evidence-import-rea-6.5.0.json
  - manuals/reverse-engineering-101/capture/out/11-bundles.txt
  - manuals/reverse-engineering-101/sections/5-5-compare-and-compare-functions.md
  - manuals/reverse-engineering-101/sections/5-4-evidence-bundles-export-and-import.md
  - manuals/reverse-engineering-101/sections/r-3-errors.md
---

## Situation

A team keeps Evidence bundles of a shipped binary in version control. A nightly job analyses the current build with rea, exports a bundle, runs `rea compare` against the bundle of the night before, and posts "no change" to the team channel when the command exits 0. It has posted "no change" every night for three weeks. Then a release went out with a different optimization level, and the job still posted "no change". A reviewer opened the two bundles by hand and found that not one record was shared between them.

Two more things went wrong in the same week. The job also keeps a digest of each bundle file to detect edits, and a colleague's export of the same records produced a different digest. And after the upgrade from the 6.5.0 release, an archived bundle that nobody had touched was refused at import. You are asked to say what the job measured for three weeks and to redesign it.

## Evidence

- [the import and compare commands with their exit codes](evidence/the-three-commands.txt)
- [the head of the compare result](evidence/compare-status-and-summary.txt)
- [the first of the ten changes](evidence/one-unresolved-record.txt)
- [the limitation at the end of the result](evidence/the-closing-limitation.txt)
- [the MCP export and the CLI export of the same records](evidence/two-exports-one-content.txt)
- [the import counts of the bundle that this release wrote](evidence/import-of-the-current-bundle.txt)
- [the import of the bundle that the old release wrote](evidence/old-bundle-refused.txt)

## Questions

1. The compare command exited 0 on two bundles with no record in common. What did the job read, and what should it have read?
2. Every change is classified `unknown` with the kind `unresolved_branch`, and `records_removed` is 0. Why does rea not call a record that is on one side only a removal?
3. Two exports of the same eight records have different digests and byte counts. Which digest belongs in the archive, and how do you check that two files hold the same evidence?
4. The old bundle was refused with `retryable: false`. Which record failed, why that one, and what does the team do with evidence it saved under the old release?
5. Write the aggregation rule for the nightly job, and say which tool answers the question it was trying to ask.

## Walkthrough

1. **Read the exit codes against the results.** The command record shows `rea compare` with exit 0. The import of the current bundle also exits 0. Only the import of the old bundle exits 1. A zero exit from `rea compare` means that the comparison ran, not that it found two equal sets. The job treated the process status as the verdict and never parsed the output.
2. **Read the status and the summary.** The result says `status: "unknown"`. Every `records_` counter is 0, and `unresolved` is 10. So the two bundles share no record, nothing was classified as unchanged, and nothing was classified as changed either. The job's "no change" message described a comparison that compared nothing.
3. **Read one change.** The first change has a right-side id and an empty left side. Its classification is `unknown` and its conclusion kind is `unresolved_branch`. The limitation on the change says that a bundle has no inventory completeness marker, so one-sided membership may reflect incomplete capture. rea cannot tell a record that was removed from a record that was never captured on that side, because the bundle format does not say whether a capture was complete.
4. **Read the closing limitation.** The same sentence closes the whole result: one-sided membership remains unknown. The two bundles were made from two builds. No `evidence_id` can match across them, because the id is a hash of the record's semantic content and the content describes a different file. `rea compare` answers "what changed in this evidence set" for two bundles of one build. For two builds the question goes to `compare_functions`, one function at a time.
5. **Read the two exports.** The MCP export and the CLI export hold the same JSON content and different bytes: 178398 against 178397 bytes. The one byte is the newline that the capture kit added to its copy. The canonical digest is the one from `rea evidence-export`, and the compare result names that digest as its left bundle digest. A job that compares file digests must canonicalize both files first, or compare the JSON content.
6. **Read the two imports.** The import of the current bundle reports 8 imported of 8. The import of the old bundle stops with `evidence_integrity_mismatch` at `records.3.evidence_id` and `retryable: false`. The bytes are the bytes that the old release wrote. The hash rule changed: the current release includes a `null` `relationship_coverage` in the identity of a record, and the old release left it out. Records 0 to 2 are dossiers with a coverage object, so their ids still verify. Record 3 is the first record without coverage, so it is the first id that fails.

## Resolution

For three weeks the job measured whether `rea compare` could start. It never read the status. The redesign reads the JSON and applies one rule: a result with status `unknown`, or with `unresolved` above 0, is not a pass, and the message names the count. A `pass` requires status `unchanged` with every record classified. The job compares bundles of one build only. When the build changes, it opens both builds and calls `compare_functions` for each function of interest, and it reads the eight dimensions of each record, as the manual shows for `_percent_change` and `_total`.

The archive stores the canonical digest from `rea evidence-export` next to each bundle, and the rea version that wrote it. The team does not migrate saved evidence. For the old bundles it keeps the old release available to read them, and it regenerates the evidence it still needs with the current release. The first nightly run after the change posted a result with `unresolved: 10` and a red mark, which is what the two builds deserved.

## Wrong turns

- "Exit 0 means the comparison passed." The exit code says that the command completed. The verdict is in `status`, and here it was `unknown`.
- "Ten unresolved records on the right and none on the left means ten records were added." A bundle carries no completeness marker, so rea cannot say whether the left side was captured completely. It says unknown, and so must you.
- "Fix the old bundle by recomputing the ids and importing it." The refusal is not retryable, and rea does not migrate evidence. An id you compute yourself is no longer evidence that the tool wrote.
- "Compare the file digests to detect a change." Two valid exports of the same records differed by one trailing newline. Compare canonical digests or JSON content.

## Generalize

A tool that can say "I do not know" needs a reader that can hear it. Any pipeline that turns a result into a pass or fail must read the field that carries the verdict and treat every value other than pass as not a pass, including unknown, unresolved and skipped. Record the version of the tool next to every artifact it wrote, because the identity rules of a format can change between releases, and compare canonical forms, never raw files.

## Taught in

The [compare page of Reverse Engineering 101](../../../manuals/reverse-engineering-101/sections/5-5-compare-and-compare-functions.md#rea-compare-on-two-bundles) reads this result, the [bundles page](../../../manuals/reverse-engineering-101/sections/5-4-evidence-bundles-export-and-import.md#a-bundle-from-an-earlier-release) explains the two exports and the refused import, the [errors reference](../../../manuals/reverse-engineering-101/sections/r-3-errors.md#codes-that-are-not-errors) lists the results that refuse a conclusion and exit 0, and the [failure modes lesson](../../../phases/14-agent-engineering/26-failure-modes-agentic/) shows why a pipeline that tags only crashes misses most failures.
