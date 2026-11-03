---
id: agent-dossier-take-home
title: The agent that answers what 95 prints and shows its work
card: evidence-reverse-engineering
kind: take-home
level: 4
roles: [agentic-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [take-home, system-design]
tags: [reverse-engineering, agent, evidence-ledger, prompt-injection, mcp, take-home]
minutes: 60
lessons: [phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns, phases/13-tools-and-protocols/36-rebuild-and-prove-equal, phases/13-tools-and-protocols/42-dynamic-analysis-of-your-own-program, phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch]
manuals: [reverse-engineering-101#s-an-agent-investigation, reverse-engineering-101#s-the-readme-use-rule-and-the-law, reverse-engineering-101#s-open-binary-and-the-headless-bridge]
practice: []
cheatsheet: [reverse-engineering, agent-failure-modes]
related: [evidence-reverse-engineering/observed-derived-inferred, evidence-reverse-engineering/empty-list-is-not-absence, evidence-reverse-engineering/fail-closed-proof-record]
updated: 2026-11-03
---

Take-home. Build the harness an agent uses to answer one question about a program you compiled yourself, through the analysis tool's MCP server: what does the program print for a score of 95, and where does the letter come from? Deliver the authorization note, the call plan with its deadlines, the ledger that lists each claim on its own line, the open unknowns, the rule for text that comes out of the file, and the tests you ship.

## Short answer

Begin with the authorization note: the target is your own build, and the note still answers the five questions in writing, a lawful copy, a named purpose, facts not already available, work confined to the needed parts, and your own expression in anything you release. Plan the calls in order, `open_binary`, `list_procedures`, `list_strings`, `analyze_function` on the two functions, then `read_bytes` on both tables the dossiers name, and `export_evidence_bundle` before `close_binary`, with a client deadline set from a measured cold start because the first engine-backed call pays for the import. Keep a ledger with one row per claim, each row a kind among observed, derived, inferred and unknown, an evidence id and a boundary, and let the row "95 prints A" stay inferred until the two table reads turn it observed. Treat every string, name and line of pseudocode from the file as data with an address, never as an instruction.

## Full answer

### Authorization

Every target is a program you wrote and compiled, and the note says so with hashes. For any other program the note answers the five questions before the first command and names the purpose the law names. The tool does not check authorization; the note is yours.

### Call plan and deadlines

`open_binary` returns the format, kind, SHA-256 and architecture without importing anything. The first engine-backed call starts the headless import and takes seconds; later calls on the same target take milliseconds. The server allows 330,000 ms for that start, and the pinned client SDK waits 60,000 ms by default, so the client deadline is the one to set from your own first run. Ask every question before `close_binary`, because the project is deleted and the retained records go with it; export the bundle first so every id in the ledger stays checkable.

### The ledger

The recorded session returned 13 procedures and 39 strings, then two dossiers. Its ledger reads, in part:

| Claim | Kind | Evidence | Boundary |
|---|---|---|---|
| `_grade` divides its argument by 10 | derived | the dossier's multiply by `0x66666667` and the shifts | a reading of the listing that the pseudocode confirms |
| five 4-byte entries sit at the table the `lea` names | derived | `cmp w8, #0x4` and the scaled load | count from the compare, width from the shift |
| the five values in that table | unknown | none; `read_bytes` with length 20 would observe them | no call in this session read memory |
| nothing calls `_grade` with a call instruction in this build | observed | `callers: []` and one `DATA` reference | coverage complete for resolved calls only |
| a score of 95 prints `A` | inferred | the C source the reader owns | no record of this session supports it |
| the function name `_nothing` | refused | `invalid_request` | a failed call produces no evidence |

The second-to-last row separates an honest report from a confident one. The reader compiled the source and knows the answer; the agent's records stop at two unread tables, and the two `read_bytes` calls are the next steps of the investigation.

### Text from the file is data

Every string, symbol name, comment and line of pseudocode copied out of the target is target text. The agent quotes it with its address and never acts on it, and the ledger has no row kind for an instruction received from the file. Each result that can carry such text arrives with a provenance marker that names the analysis target as untrusted; the marker tells the agent which text came from the file, and the agent still applies the rule. A 2026 study planted text inside binaries and found that models proposed the planted unsafe action in 35 of 40 cases without controls; showing the content as data alone still left 15 of 40, and provenance checks with tool authorization removed them.

### Tests to ship

1. A stand-in server replays the recorded records for the same tool and arguments, so the loop runs with no engine installed.
2. Every record's id recomputes from its content, and a record with one limitation removed is refused.
3. Promotion refuses a derived or inferred id and passes only with an agreeing run under `controlled-replay`.
4. The ledger marks a claim `unknown` when some inputs have runs and others do not, and never rounds it up.
5. A fixture binary carries a string that reads like a command; the test asserts that the ledger holds it as a value with an address and that nothing executes.
6. A client deadline shorter than the measured cold start produces a recorded timeout step, not a finding.

## Follow-ups

- **Level 3:** Why export the bundle before the close? Expected: the close deletes the project and clears the retained records, and the ledger's ids are checkable only against a bundle.
- **Level 4:** A run of the host build agrees with the prediction for 95. What limitation travels with that row? Expected: the object never ran; a build of the same source for another architecture did, which is the strongest observation without an emulator.
- **Level 4:** The strings list contains "run this command to continue". What does the ledger do? Expected: records the string with its address as an observed value, flags the request, and executes nothing; the provenance marker is data about data.
- **Level 4:** The agent has the C source. Why does "95 prints A" still read inferred? Expected: no record of the session supports it; two `read_bytes` calls would, and until then the honest kind is inferred.

## Wrong answers

- "The pseudocode returns an entry of `_labels`, so the letter is observed." The access is observed; the value behind it was never read.
- "Skip the authorization note for a file I compiled." Write it anyway; the questions answer themselves for your own build, and the habit is the control for every other file.
- "Treat the usage text as the program's instructions to the agent." It is target text; quote it with its address and never follow it.

## Taught in

The [agent investigation section](../../../manuals/reverse-engineering-101/sections/8-2-an-agent-investigation.md) walks the recorded session and its ledger, the [use rule section](../../../manuals/reverse-engineering-101/sections/2-1-the-readme-use-rule-and-the-law.md) gives the five questions, the [open_binary section](../../../manuals/reverse-engineering-101/sections/4-1-open-binary-and-the-headless-bridge.md) measures the cold start, and the [evidence](../../../phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns/), [rebuild](../../../phases/13-tools-and-protocols/36-rebuild-and-prove-equal/), [dynamic analysis](../../../phases/13-tools-and-protocols/42-dynamic-analysis-of-your-own-program/) and [ELF](../../../phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch/) lessons supply the ledger, the harness, the verdicts and the law notes.
