---
id: which-side-failed-the-engine-or-the-input
title: Which side failed, the engine or the input
card: scenarios
kind: incident
level: 2
roles: [agentic-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging, screen]
tags: [errors, mcp, reverse-engineering, retries, agents]
minutes: 20
lessons: [phases/14-agent-engineering/26-failure-modes-agentic]
manuals: []
practice: []
cheatsheet: []
related: [scenarios/an-empty-list-is-not-none]
updated: 2026-11-03
system:
  version: rea 6.7.0 at 27dc42d with the Ghidra provider
  model: no model; the fixtures are the ledger binaries built at -O1 and -O2
  hardware: one aarch64 Mac
source:
  - manuals/reverse-engineering-101/capture/out/00-commands.txt
  - manuals/reverse-engineering-101/capture/out/04-inspect-binary-layout.json
  - manuals/reverse-engineering-101/capture/out/10-mcp-session.txt
  - manuals/reverse-engineering-101/capture/out/10-mcp-13-analyze-function-missing.json
  - manuals/reverse-engineering-101/capture/out/10-mcp-server.log
  - manuals/reverse-engineering-101/sections/r-3-errors.md
  - manuals/reverse-engineering-101/sections/8-1-the-rea-mcp-server.md
---

## Situation

A team wraps rea in an agent pipeline that analyses binaries overnight. The wrapper has one rule for failures: on any failed call, close the target, stop the Java process, open the target again, and retry. The night log shows the engine restarted eleven times, each restart followed by the same failure, and the import of the target paid for again each time. Two failures appear in the log, and the wrapper treated them the same way.

The first came from the command line on the Mac that runs the pipeline: a layout inspection of an object file exited 1. The second came from the MCP session: `analyze_function` returned an error for a procedure name that the agent had typed. You have the command record, the two error envelopes, the session index and the server log. Say what each failure was, and write the retry rule that the wrapper should have had.

## Evidence

- [the CLI call that exited 1](evidence/layout-call-exit-1.txt)
- [the whole envelope of that call](evidence/capability-unavailable.txt)
- [three consecutive calls of the MCP session](evidence/session-around-the-error.txt)
- [the decoded error of the MCP call](evidence/invalid-request-envelope.txt)
- [the end of the diagnostics object](evidence/diagnostics-tail.txt)
- [the server log around the failed call](evidence/server-log-around-the-error.txt)

## Questions

1. Both envelopes have the same five fields. Which two fields decide what to do next, before you read the message?
2. The first failure says that a profile supports Linux x64 only. What was wrong, the host, the file, or the engine, and what is the right next call?
3. The second failure is `retryable: true`. What would a retry with the same arguments return, and what has to change?
4. How does the diagnostics object tell you that the Ghidra process was healthy when the call failed?
5. Name the codes for which a restart of the engine is the correct response.

## Walkthrough

1. **Read code, category and retryable first.** Every rea error carries `code`, `category`, `message`, `retryable` and `remediation`. The code is the discriminator, one of twenty. The category is one of ten and names the kind of problem. The flag says whether the same call can succeed later. The message is for a person. A wrapper branches on the first two fields and the flag, never on the message text.
2. **Read the CLI failure.** The command record shows `inspect-binary-layout` on the object file, exit 1 after 0.6 s. The envelope has code `capability_unavailable`, category `unsupported_provider`, and `retryable: false`. The details name the provider `pwntools-elf` and the operation. That provider runs on one platform, Linux x64, and the pipeline runs on a Mac. The engine never ran. The right next call is another provider or another host, and the manual uses `inspect-macho` as the layout tool on this machine. No restart can change a provider that does not run here.
3. **Read the MCP failure.** The session index shows the call before and the call after both completed on the same open target, and the failed call took 4 ms. The decoded error has code `invalid_request`, category `invalid_input`, and `retryable: true`. The one issue in the details says that the procedure name is unknown. The flag means that a corrected call can succeed on the same connection. A retry with the same name returns the same error, so the argument has to change, and `list_procedures` gives the names that exist.
4. **Read the diagnostics.** `failure_output` holds the stdout and stderr that Ghidra wrote during the failed request: both empty, with `complete: true`. The remote code is `not_found`. An empty, complete output with a remote code says that the engine answered the question and the answer was no. The server log agrees: two lines at level 40, one for the bridge layer and one for the server layer, with a duration of 2.73 ms, and the next line is `close_binary` with status `ok`. The engine was healthy before, during and after.
5. **Place the restart.** A restart answers a different family of codes: `provider_unavailable`, `provider_timeout`, and an `execution_failure` whose diagnostics show incomplete output. The manual names `provider_timeout` as the code of a first Ghidra-backed call that passes the startup deadline of 330,000 ms, and `target_unavailable` as the code of every provider tool before `open_binary`. Neither appeared in these two failures.

## Resolution

Neither failure was the engine's. The first was a provider that does not run on the host, not retryable, fixed by a different tool. The second was a wrong argument, retryable after the argument changes, and the Ghidra process stayed up and served the next call in the same session. The eleven restarts bought nothing and cost an import each.

The wrapper now reads `category` and `retryable` before anything else. `unsupported_provider` and `unsupported_target` route to a different provider or host and stop. `invalid_input` corrects the argument from a listing and retries once. `unavailable`, `timeout` and an `execution_failure` with incomplete output restart the engine, with a bound on the count. Everything else is reported to a person with the message and the remediation. After the change, the next night ran with no restart, and the two failures became one line each in the report.

## Wrong turns

- "Exit 1 means the engine crashed; restart it." The envelope says `unsupported_provider`, not retryable. The provider never started, and a restart starts nothing new.
- "retryable is true, so retry the same call." The flag says that the call can succeed later, after the input changes. The same unknown name gets the same answer.
- "Match the message text to decide the branch." Messages are written for people and can change between releases. The code, the category and the flag are the contract.
- "Any level 40 line in the server log means the bridge is unhealthy." Both lines record one failed request that completed in 2.73 ms, and the next line records a successful call on the same connection.

## Generalize

An error envelope is a typed answer, and a retry policy that ignores its type turns every failure into the most expensive one. Read the discriminator and the retryable flag, keep a table from category to action, and look at the diagnostics for proof that the engine was alive before you restart it. The cheapest fix for most failures is a changed input, and the most expensive is a cold start, so the policy must tell them apart.

## Taught in

The [errors reference of Reverse Engineering 101](../../../manuals/reverse-engineering-101/sections/r-3-errors.md#the-shape-every-rea-error-has) lists the five fields and the twenty codes, the [dossier page](../../../manuals/reverse-engineering-101/sections/4-6-analyze-function-and-pseudocode.md#a-name-that-does-not-exist) reads the unknown-name error and its log lines, the [MCP server page](../../../manuals/reverse-engineering-101/sections/8-1-the-rea-mcp-server.md#the-startup-deadline-against-the-client-default) gives the startup deadline and the recovery that a timeout deserves, and the [failure modes lesson](../../../phases/14-agent-engineering/26-failure-modes-agentic/) names cascading errors as the mode where one wrong response triggers more calls.
