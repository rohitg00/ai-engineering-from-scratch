---
id: reverse-engineering
title: Reverse Engineering with rea
code: RE
subtitle: rea 6.7.0 with Ghidra 12.1.4: inspect binaries, read Evidence records and compare bundles.
hue: 200
sources: manuals/reverse-engineering-101, phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch, phases/13-tools-and-protocols/33-disassembly-and-control-flow, phases/13-tools-and-protocols/34-lifting-to-pseudocode, phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns, phases/13-tools-and-protocols/36-rebuild-and-prove-equal, phases/13-tools-and-protocols/37-the-reverse-engineering-landscape, phases/13-tools-and-protocols/38-calling-conventions-and-stack-frames, phases/13-tools-and-protocols/39-compiler-idioms-and-optimization, phases/13-tools-and-protocols/40-linking-loading-and-stripped-binaries, phases/13-tools-and-protocols/41-recovering-data-and-types, phases/13-tools-and-protocols/42-dynamic-analysis-of-your-own-program, phases/13-tools-and-protocols/43-bytecode-and-managed-formats, phases/13-tools-and-protocols/44-binary-diffing-and-symbolic-execution, phases/13-tools-and-protocols/45-ai-assisted-reverse-engineering
source_hash: 65dedcb05fc8fd0b
---

## Where rea stops and Ghidra starts
type: architecture
from: manuals/reverse-engineering-101/sections/1-1-rea-providers-and-evidence.md

```arch
node | cli | 1,1 | rea CLI | one question per call | client
node | mcp | 2,1 | rea MCP server | 207 tools, 6 prompts | client
node | session | 3,1 | BinarySession | one active target | process
node | art | 1,2 | rea-artifact-graph | no Ghidra needed | process
node | prov | 2,2 | GhidraProvider | analyzeHeadless and a socket | process
edge | cli | session | one question
edge | mcp | session | one session
edge | session | prov | bind Ghidra
edge | session | art | inspect
```

## One inspection, step by step
type: flow
from: manuals/reverse-engineering-101/sections/1-1-rea-providers-and-evidence.md, manuals/reverse-engineering-101/sections/3-1-inspect-artifact.md

1. **Caller**: run `rea inspect-artifact fixtures/ledger-arm64-O1 --format json`. No Ghidra starts.
2. **rea-artifact-graph**: hash the file with SHA-256 and detect the format from the magic bytes.
3. **Manifest**: one node and one occurrence, with `integrity_policy` set to `fail`.
4. **Answer**: the Evidence record returns in under a second, without Java.

## One binary, start to finish
type: annotated-code
lang: bash
from: manuals/reverse-engineering-101/sections/r-1-commands-and-tools.md

```bash
rea doctor --provider ghidra                        # is the provider healthy
rea inspect-artifact <path>                         # artifact graph of the file, no Ghidra
rea analyze <path> --provider ghidra                # segments, procedure and string counts
rea function <path> <name> --provider ghidra        # the dossier of one procedure
rea decompile <path> <name> --provider ghidra       # pseudocode of one procedure
```

## Work with Evidence bundles
type: task-table
from: manuals/reverse-engineering-101/sections/r-1-commands-and-tools.md

| Task | Code |
|---|---|
| List the records of a bundle without payloads | `rea inspect-evidence-bundle '{"path":"<bundle>", "detail": "summary"}'` |
| Write a canonical copy with sorted keys | `rea evidence-export <bundle> <out>` |
| Validate every record id and manifest of a bundle | `rea evidence-import <bundle>` |
| Compare two bundles by record membership | `rea compare <left> <right>` |
| Map a virtual address to a file offset | `rea address-to-file-offset <path> <address> --provider ghidra` |

## Ask rea one question
type: task-table
from: manuals/reverse-engineering-101/sections/1-1-rea-providers-and-evidence.md

| Task | Code |
|---|---|
| Check Ghidra and the environment | `rea doctor --provider ghidra --format json --filter-output healthy,environment_healthy,scope,scope_checks` |
| List the capabilities | `rea capabilities --format json` |
| Inspect an artifact | `rea inspect-artifact fixtures/ledger-arm64-O1 --format json` |
| Inspect a Mach-O layout on macOS | `rea inspect-macho` |

## Commands and environment variables
type: command-table
from: manuals/reverse-engineering-101/sections/1-1-rea-providers-and-evidence.md, manuals/reverse-engineering-101/capture/README.md

| Command | What it does |
|---|---|
| `rea function` | Calls `analyze_function` for one dossier per procedure |
| `rea decompile` | Calls `procedure_pseudo_code` for pseudocode |
| `rea analyze` | Calls `binary_overview` for the whole binary |
| `GHIDRA_INSTALL_DIR` | Ghidra install directory, else the Homebrew path |

## Pins and limits
type: defaults
from: manuals/reverse-engineering-101/README.md, manuals/reverse-engineering-101/capture/README.md, manuals/reverse-engineering-101/sections/1-1-rea-providers-and-evidence.md, manuals/reverse-engineering-101/sections/3-1-inspect-artifact.md

| Setting | Default | Note |
|---|---|---|
| rea | 6.7.0 | `rea-agents` package version |
| Ghidra | 12.1.4 | PUBLIC build |
| JDK | OpenJDK 21.0.12.1 | `JAVA_HOME` or the Homebrew path |
| One-shot Ghidra call | 7 to 9 s | Import into a fresh project |
| `integrity_policy` | fail | Parameter of `inspect-artifact` |

## Troubleshooting
type: troubleshooting
from: manuals/reverse-engineering-101/sections/r-1-commands-and-tools.md, manuals/reverse-engineering-101/sections/1-1-rea-providers-and-evidence.md

| Symptom | Cause | Fix |
|---|---|---|
| `rea doctor` fails a check | rea 6.7.0, Ghidra 12.1.4 or JDK 21 is missing | Install the pinned version and run `rea doctor` again |
| First Ghidra call takes 7 to 9 s | Ghidra imports the file into a fresh project | Keep one MCP session open |
| `inspect-binary-layout` returns `capability_unavailable` | It uses the pwntools profile, Linux x64 only | Run it on Linux x64, or use `rea inspect-macho` on macOS |

## Questions and answers
type: qa
from: manuals/reverse-engineering-101/sections/1-1-rea-providers-and-evidence.md, manuals/reverse-engineering-101/sections/3-1-inspect-artifact.md

- **Does `inspect-artifact` need Ghidra?** No. It returns in under a second, without Java.
- **Which command gives pseudocode for one function?** `rea decompile`, which calls `procedure_pseudo_code`.
- **What is the first call on a new file?** Run `rea inspect-artifact`. It needs no engine.

## Tips
type: tips
from: manuals/reverse-engineering-101/sections/1-1-rea-providers-and-evidence.md

- Ask rea for an Evidence record, and read Ghidra's own listing when you doubt it.
- Use the CLI for one question and the MCP server for a session of many.
- Expect 7 to 9 s for the first Ghidra question on a file, and milliseconds after it.
