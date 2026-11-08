# A2A 101

The Agent2Agent protocol at v1.0.1, from its purpose to each request and response. The web edition is at [aiengineeringfromscratch.com/manual-a2a-101.html](https://aiengineeringfromscratch.com/manual-a2a-101.html), and each release of the course attaches the PDF as `aiefs-manual-a2a-101.pdf`.

## What is in it

- 28 sections in 7 parts: the protocol on one page, AgentCard, the data model, the operations, the bindings, security and extensions, and implementing A2A. Seven reference sections follow.
- 31 figures, drawn with the figure kit from the capture files. They animate on the web and stay still in print.
- A capture kit in `capture/`: three agents and a planner, in Python with no dependencies. Every listing in the manual comes from a file in `capture/out/`.
- A register of 40 conflicts between the specification, the proto, the docs, and the reference SDK, with the status of each one upstream, plus 20 more discrepancies found while writing.
- A comparison of 14 behaviors across the Python, JavaScript, Java, Go, .NET, and Rust SDKs, and a run of the official test kit against the capture kit.

## Files

| Path | Holds |
|---|---|
| `manual.json` | the manifest: the pin, the parts, the palette, the sources |
| `front.md`, `sections/` | the text, one file per section |
| `figures/src/` | the figure sources, built to `figures/*.svg` |
| `capture/` | the kit, and its recorded output in `capture/out/` |
| `research/sources/` | the vendored specification, proto, and docs pages at v1.0.1, with their license |
| `research/*.md` | the fact briefs and the research notes the sections cite |

## Run the kit

```bash
cd manuals/a2a-101
python3 capture/run.py --check
```

The check starts the three agents on ports 41241 to 41243, replays every recorded exchange, and reports whether each file in `capture/out/` still matches. Run `python3 capture/run.py` to record the files again. `capture/README.md` explains each agent and where the kit differs from the reference SDK.

## Build and check

From the repository root:

```bash
node manuals/_shared/figkit.js build manuals/a2a-101
node site/build-manuals.js
node scripts/audit_manuals.js --manual a2a-101
```

The audit must report `TOTAL 0`. See [manuals/AUTHORING.md](../AUTHORING.md) for the contract.
