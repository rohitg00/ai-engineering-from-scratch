# Agent Substrate 101

Agent Substrate v1.0.0 on Kubernetes, from the first actor to a cluster that you can size, upgrade, and debug. Each decision has a measured answer. The documentation tells you what each object and flag does. This manual tells you what happened when we ran it, broke it, and recovered it. The web edition is at [aiengineeringfromscratch.com/manual-agent-substrate-101.html](https://aiengineeringfromscratch.com/manual-agent-substrate-101.html), and each release of the course attaches the PDF as `aiefs-manual-agent-substrate-101.pdf`.

## What is in it

- 40 sections in 9 parts, then ten reference sections. Part 1 puts the whole system on one page. Parts 2 to 6 cover the install, actors, workers and capacity, identity and access, and the network. Part 7 connects kagent 1.0, agentgateway v1.7.0, and Agent Executor. Part 8 covers operation, failure, and upgrade. Part 9 builds four agents that you can run.
- Each measured number names its machine and the number of runs. Pages that we could not measure say so, and section 8.5 lists what stays untested.
- 75 figures and a cover plate, drawn with the figure kit. The charts read the summary files, and most show each run, not only a median.
- 177 listings. Each one is cut from a recorded file or from the source at the pinned tag, and the audit checks it line for line.
- Section 1.1 sets each headline claim of the project site beside the result that we measured.

## Files

| Path | Holds |
|---|---|
| `manual.json` | the manifest: the pin, the parts, the palette, the sources, the cover plate |
| `front.md`, `sections/` | the text, one file per section |
| `figures/src/` | the figure sources, built to `figures/*.svg` |
| `capture/lab/` | 24 recorded experiments, `A-quickstart` to `Z-bursts`. Each holds its scripts, its raw output, and a README that names the rows not to use |
| `capture/lab/summary/` | 38 summary files that the tables and charts read |
| `capture/lab/REDACTIONS.txt` | each file that was cut, shortened, or scrubbed before it was committed, and why |
| `capture/run.py` | rebuilds the summaries from the recordings and checks them, with no network |
| `capture/demos/` | four demos with their recorded runs: an idle suspender, a stateful agent, a tool sandbox, and a failure drill |
| `research/brief.md` | the research brief that the manual was written from |

## The pin

| Item | Value |
|---|---|
| Agent Substrate | v1.0.0, commit `b34fbee742906494b5eb4f1f36987176bf8770a4`, released 2026-11-05 |
| kagent | v1.0.0 |
| agentgateway | v1.7.0 |
| Agent Executor | commit `a72b8ca4`, and release v0.3.1 for one comparison |
| Verified | 2026-11-12 to 2026-11-13 |

## The recording hosts

| Name in the manual | Machine |
|---|---|
| the x86 server guest | a KVM guest with 24 vCPU and 47 GB, with nested KVM |
| a second x86 server guest | a KVM guest with 16 vCPU and 23 GB, or one with 16 vCPU and 31 GB. The manual names each by its memory |
| the Mac | an Apple silicon laptop under Docker Desktop, with the arm64 release images |

The clusters are kind clusters with one to three nodes. The kagent and Agent Executor runs used a small open model on CPU, 1 to 2 GB, at 7 to 14 tokens per second. No GPU was used. `capture/README.md` maps each experiment to its machine. Do not compare a number from one machine with a number from another.

## How to read it

Start with the front matter, "How to read this manual". It installs Agent Substrate from the release images and wakes one actor. Read Part 1 once and completely. After that, go to the page that answers your question. When something breaks, start at the symptom table in section 8.3.

## Run the recordings again

The recordings need a Kubernetes cluster, so they cannot run in CI. The scripts of each experiment are in its folder under `capture/lab/`, and `capture/README.md` lists the machines, the versions, and the method. The four demos in `capture/demos/` each have a README and a `run.sh`.

The summaries rebuild offline:

```bash
cd manuals/agent-substrate-101
python3 capture/run.py --check
```

The check rebuilds every summary in a temporary folder and compares it with the committed file. It prints one `skipped:` line for the recordings, because it does not start a cluster.

## Build and check

From the repository root:

```bash
node manuals/_shared/figkit.js build manuals/agent-substrate-101
node site/build-manuals.js
node scripts/audit_manuals.js --manual agent-substrate-101
```

The audit must report `TOTAL 0`. See [manuals/AUTHORING.md](../AUTHORING.md) for the contract.
