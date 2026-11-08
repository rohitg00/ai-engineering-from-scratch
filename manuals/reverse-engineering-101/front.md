# How to read this manual

> Every listing in this manual comes from one recorded run of rea 6.7.0 with Ghidra 12.1.4 on programs written for it, and every rule traces to a ranked source.

This manual explains rea, the `rea-agents` package at version 6.7.0, with the Ghidra 12.1.4 provider. It follows one question from a file you compiled to an Evidence record you can check. The question is what a function does, and how the tool knows.

## Who this manual is for

You write C, Python, or JavaScript, and you use a coding agent such as Claude, Cursor, Codex, OpenClaw, Hermes, or any agent that reads SKILL.md. You have never read machine code with a decompiler, and you want to check what an agent tells you about a compiled program.

After the last part, you can:

- Read the file header, sections, symbols, and relocations of a compiled program, and map an address to a file offset.
- Run rea with the Ghidra provider on a program you built, and read its Evidence record: confidence, authority, limitations, and unknowns.
- Find a function, read its assembly and pseudocode, follow its references, and say where the decompiler output is incomplete.
- Prove a rebuilt function equal to the original by running both over an input grid and by comparing bytes after masking relocations.
- Drive rea from an agent over MCP, and keep an evidence ledger that separates what was observed from what was inferred.

Five lessons go deeper than rea does. [The ELF lesson](phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch) builds a file reader. [The disassembly lesson](phases/13-tools-and-protocols/33-disassembly-and-control-flow) builds a decoder and a control-flow graph. [The lifting lesson](phases/13-tools-and-protocols/34-lifting-to-pseudocode) builds a lifter. [The evidence lesson](phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns) builds a ledger, and [the proof lesson](phases/13-tools-and-protocols/36-rebuild-and-prove-equal) proves a rebuild equal. This manual stays with rea and Ghidra.

## How it was made

The manual pins `rea-agents` 6.7.0, published 2026-10-18, at the tag `rea-agents-6.7.0`, which is commit `27dc42d10249f0410904a75c0997842eb03b931c`. It pins Ghidra 12.1.4 PUBLIC, built 2026-Sep-21, and OpenJDK 21.0.12.1. The facts were verified on 2026-10-18. Release 6.7.0 also holds the changes of 6.6.0, which was tagged but not published to npm. The WebAssembly provider, the Go provider, the raw-binary format, and `DISCLAIMER.md` came in 6.5.0. This manual describes 6.7.0 only, and every capture was recorded again for it.

Facts come from seven sources, ranked by authority. When two of them disagree, the higher one wins and the text says so.

| Rank | Source | What the manual takes from it | Source key |
|---|---|---|---|
| 1 | the rea source at the tag, `27dc42d` | every claim about how rea works | the source files of each section, in the manual source |
| 2 | the rea documentation at the tag | documented behaviour, limits, and the use rule | `readme`, `cli`, `mcp`, `ghidra`, `native`, `install`, `readiness`, `ledgers`, `jsgraph`, or `design` and a heading |
| 3 | [the captured runs](manuals/reverse-engineering-101/capture/out) | every listing and every number in a figure | the capture file name |
| 4 | the ELF, Mach-O, x86-64, and AArch64 specifications | formats, encodings, and calling conventions | `spec` and a section |
| 5 | papers on program analysis | disassembly, structuring, type recovery, and decompiler evaluation | `paper` and a title |
| 6 | statutes and court decisions | the law of analysis and interoperability | `law` and a citation |
| 7 | tool release notes | Ghidra and other tool versions | the release and its date |

Quotes from the rea README, `DISCLAIMER.md`, and documentation were checked against the pages at tag `rea-agents-6.7.0`. Quotes from statutes, specifications, and papers come from the official texts. No source file is copied into this repository.

## The capture kit

[The capture kit](manuals/reverse-engineering-101/capture) drives the real `rea` command line and its MCP server with the Ghidra provider. It writes what they return to [its output folder](manuals/reverse-engineering-101/capture/out), and it uses the Python standard library only. `python3 capture/run.py` records everything. `python3 capture/run.py --check` records again into a temporary directory and compares with the recorded set after masking the values that change on every run.

The subject needs Ghidra, a JDK, and Node, so the kit cannot run in the repository CI. Where rea 6.7.0, Ghidra 12.1.4, or JDK 21 is absent, `--check` prints `skipped` with the reason and exits 0. Every captured file was recorded on one machine:

| Item | Value |
|---|---|
| Host | an Apple silicon laptop, macOS 26.2, build 25C56, arm64 |
| rea | `rea-agents` 6.7.0 from the npx cache, Node 22.22.0 |
| Ghidra | 12.1.4 PUBLIC from Homebrew, `GHIDRA_INSTALL_DIR=/opt/homebrew/Cellar/ghidra/12.1.4/libexec` |
| JDK | OpenJDK 21.0.12.1 from Homebrew, `JAVA_HOME=/opt/homebrew/opt/openjdk@21` |
| clang | Apple clang 17.0.0, target `arm64-apple-darwin25.2.0` |
| Recorded on | 2026-10-18 |

The kit records every one-shot command in `00-commands.txt`, each with its exit status and time. It records one MCP session of 25 exchanges in `10-mcp-*.json`, and two Evidence bundles. A full run takes about 125 s, and each one-shot command that needs Ghidra takes 7 to 9 s. Two runs on the recording host produced identical records ([the capture](manuals/reverse-engineering-101/capture/README.md)). Every fixture is a program written for this manual, and `00-fixtures.txt` lists their hashes.

## Conventions

`rea` names the 6.7.0 command line in every command. The kit started it from the npx cache as `node .../node_modules/rea-agents/scripts/rea.mjs`, and `rea mcp` names the MCP server of the same package.

`$CAPTURE` stands for the capture directory, `$OUT` for `capture/out/`, `$WORK` for the kit's work directory, and `$HOME` for the home directory. Values that change on every run appear as tokens such as `<hash>` and `<ts>`. Addresses are lowercase `0x` hexadecimal, as rea prints them. `_percent_change` with a leading `_` is the Mach-O symbol, and `percent_change` is the C name and the ELF symbol.

Each section records its sources in the manual source, where the audit checks every quote and number. The sections do not show them. The sources reference lists them. A listing copies lines from a capture file unchanged, and a `…` marks a cut that the note explains.

Figures animate on the web, where a Replay button runs the steps again, and print and reduced motion show the final frame.

## A first run

You need rea 6.7.0, Ghidra 12.1.4, and a JDK 21 on `PATH` or in `JAVA_HOME`. After the install, nothing in this run uses the network. Export the two paths, then ask the doctor:

```bash
export GHIDRA_INSTALL_DIR=/opt/homebrew/Cellar/ghidra/12.1.4/libexec
export JAVA_HOME=/opt/homebrew/opt/openjdk@21
rea doctor --provider ghidra --format json
```

On the capture Mac the report starts like this:

```listing
title: the doctor verdict for the Ghidra scope
source: capture/out/01-doctor-ghidra.json
lang: json
note: Cut to the two verdicts and the scope. The nine checks are cut, and section 2.2 reads them.
---
{
  "healthy": true,
  "environment_healthy": false,
  "scope": {
    "mode": "explicit",
    "clients": [],
    "providers": [
      "ghidra"
    ],
    "skill": false,
    "target": null
  },
…
```

Then build the fixture. Copy `capture/fixtures/ledger.c` and `ledger-main.c` into a scratch directory and compile them:

```bash
clang -O1 -o ledger-arm64-O1 ledger.c ledger-main.c
rea function ledger-arm64-O1 _percent_change --provider ghidra --format json
```

Another clang gives other bytes, and with them another SHA-256 and another `evidence_id`, so your record will differ from the capture in those fields. The capture recorded its run like this:

```listing
title: the first question
source: capture/out/00-commands.txt
lang: text
note: The time is cut, because it changes with every recording and stays between 7 and 9 s.
---
$ rea function fixtures/ledger-arm64-O1 _percent_change --provider ghidra --format json
[exit 0] (… s) -> 06-function-percent-change.json
```

Open `capture/out/06-function-percent-change.json` next to your own output. [Section 1.2](#s-rea-function-end-to-end) reads it field by field.

## How the parts are ordered

Part 1 puts rea on one page. Part 2 covers the right to analyze and the install. Parts 3 to 5 take one investigation apart: the file itself, the Ghidra provider, and the Evidence record. Part 6 covers JavaScript and WebAssembly. Part 7 proves a rebuild equal outside rea. Part 8 drives rea from an agent, and the Reference holds the lookup tables:

```parts
```

## Colour in figures

Each hue keeps one meaning in every figure:

```palette
```

[Figure](#fig-0-1) teaches the eight arrow styles with exchanges from the recorded MCP session.

```figure
id: fig-0-1
kind: sequence
title: reading a sequence figure in this manual
claim: Each of the eight arrow styles marks one kind of exchange, and every label except the model call is a real name or message from the recorded session.
caption: Read each numbered row from the tail of the arrow to its head, and the note under each label names the style. Rows 1 to 8 come from the MCP session captures and the server log. Row 9 is the model call the kit does not record.
```

The model call in row 9 belongs to the agent, which [Part 8](#p-8) draws with its own lifeline.

Sources: manual.json; rea LICENSE, DISCLAIMER.md; capture/README.md; capture/run.py; capture/fixtures/ledger.c, ledger-main.c; capture/out/00-commands.txt, 00-fixtures.txt, 00-versions.txt, 01-doctor-ghidra.json, 06-function-percent-change.json, 10-mcp-03-open-binary-O1.json, 10-mcp-09-analyze-function-percent-change-O1.json, 10-mcp-13-analyze-function-missing.json, 10-mcp-14-export-evidence-bundle-O1.json, 10-mcp-server.log, 10-mcp-session.txt
