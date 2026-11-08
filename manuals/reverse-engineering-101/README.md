# Reverse Engineering 101

rea, the `rea-agents` package at 6.7.0, with the Ghidra 12.1.4 provider, from the first `rea doctor` to an agent that keeps an evidence ledger over MCP. The web edition is at [aiengineeringfromscratch.com/manual-reverse-engineering-101.html](https://aiengineeringfromscratch.com/manual-reverse-engineering-101.html), and each release of the course attaches the PDF as `aiefs-manual-reverse-engineering-101.pdf`.

## What is in it

- 26 sections in 8 parts, then six reference sections. Part 1 puts rea on one page, Part 2 covers the right to analyze and the install, Parts 3 to 5 cover the artifact, the Ghidra provider, and the Evidence record, Part 6 covers JavaScript and WASM, Part 7 proves a rebuild equal, and Part 8 drives rea from an agent.
- A cover plate and the figures that the figure index lists, drawn with the figure kit from the capture files. They animate on the web and show the final frame in print.
- A capture kit in `capture/`, in Python with the standard library only. It runs the real `rea` command line and its MCP server with Ghidra and writes what they return to `capture/out/`.
- Listings cut from `capture/out/`, and quotes checked against the rea README and documentation at the tag.
- Four fixture programs written for this manual: `ledger.c` with four functions, `ledger-main.c`, a six-file JavaScript application, and a WebAssembly text module. The fixtures also hold an Evidence bundle that rea 6.5.0 wrote and two small Claude Code configuration files for `rea setup`.

## Files

| Path | Holds |
|---|---|
| `manual.json` | the manifest: the pin, the parts, the palette, the sources, the cover plate |
| `front.md`, `sections/` | the text, one file per section |
| `figures/src/` | the figure sources, built to `figures/*.svg` |
| `capture/` | the kit, its fixtures, and its recorded output in `capture/out/` |
| `examples/` | `mcp-registration.json`, the MCP registration that section 8.1 lists |

## The pin

| Item | Value |
|---|---|
| rea | `rea-agents` 6.7.0, published 2026-10-18, tag `rea-agents-6.7.0`, commit `27dc42d10249f0410904a75c0997842eb03b931c` |
| Ghidra | 12.1.4 PUBLIC, built 2026-Sep-21 |
| JDK | OpenJDK 21.0.12.1 |
| Verified | 2026-10-18 |

Release 6.7.0 holds the changes of 6.6.0, which was tagged but not published to npm. The WebAssembly and Go providers, the raw-binary format, and `DISCLAIMER.md` came in 6.5.0. Every claim in this manual describes 6.7.0, and every capture was recorded again with it.

## The recording host

The kit was recorded on one Mac with macOS 26.2 on Apple silicon, with these versions:

| Item | Version |
|---|---|
| rea | `rea-agents` 6.7.0 from the npx cache, Node 22.22.0 |
| Ghidra | 12.1.4 from Homebrew, `GHIDRA_INSTALL_DIR=/opt/homebrew/Cellar/ghidra/12.1.4/libexec` |
| JDK | OpenJDK 21.0.12.1 from Homebrew, `JAVA_HOME=/opt/homebrew/opt/openjdk@21` |
| clang | Apple clang 17.0.0 |
| WABT | 1.0.42 from Homebrew. `inspect-wasm-artifact` runs its tools through `REA_WABT_BIN_DIRECTORY`. |

## Run the kit

```bash
cd manuals/reverse-engineering-101
python3 capture/run.py --check
```

The check captures again into a temporary directory. Then it compares each file with `capture/out/` after it masks timestamps, durations, run ids, temporary paths, and process ids. If rea 6.7.0, Ghidra 12.1.4, or JDK 21 is absent, the check prints `skipped` with the reason and exits 0. A full run takes about 125 s on the recording host, and `capture/README.md` lists every file it writes and every cut it makes.

Run `python3 capture/run.py` to record the files again, and `python3 capture/run.py --build-fixtures` to rebuild the fixture binaries. Another clang changes the executables and the objects, and with them every SHA-256, `evidence_id`, and bundle digest in `capture/out/`, so a rebuild needs a new recording.

## Build and check

From the repository root:

```bash
node manuals/_shared/figkit.js build manuals/reverse-engineering-101
node site/build-manuals.js
node scripts/audit_manuals.js --manual reverse-engineering-101
```

On a host with rea, Ghidra, and the JDK, the audit runs the full capture check, which takes about two minutes. Set `AIEFS_CAPTURE_SKIP=1` to skip that check. The audit must report `TOTAL 0`. See [manuals/AUTHORING.md](../AUTHORING.md) for the contract.
