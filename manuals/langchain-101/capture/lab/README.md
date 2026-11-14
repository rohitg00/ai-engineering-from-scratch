# Lab recordings

Each folder holds the raw files of one experiment, copied unchanged from the run, except where this file says so. `labsum.py` in the folder above computes one summary for each data set into `summary/`, and `python3 capture/run.py --check` computes them again and compares. No file here was typed by hand.

| Folder | Machine | What it recorded |
|---|---|---|
| `T01-overhead-mac/` | the Mac | a plain `openai` loop against `create_agent` on a local stub (200 runs each) and on Ollama with Qwen3 4B (24 runs each), the request body diff, import times (10 runs each), install sizes |
| `T02-crash-resume-mac/` | the Mac | 450 trials of a SIGKILL at five points, for `sync`, `async`, and `exit` on `SqliteSaver` and `PostgresSaver`, then a resume in a new process |
| `T05-retries-mac/` | the Mac | `ChatOpenAI` and an HTTP tool against a stub that returns 429, 500, 400, or sleeps past the timeout, 3 runs per cell |
| `T17-claims-mac/` | the Mac | the default recursion limits of `StateGraph` and `create_agent`, one run each |
| `T03-checkpoint-cost-x86/` | the x86 server guest | checkpoint write time and thread storage for three savers and two channel types, up to 5,000 steps |
| `T15-agent-server-x86/` | the x86 server guest | `langgraph dev`: the recursion limit, jobs per worker, and the license error of `langgraph up` |

The Mac is an Apple M1 Max with 10 cores and 64 GiB, macOS 26.2, Python 3.13.12, Ollama 0.31.1, and PostgreSQL 14.21. Other work ran on it during every timed run. The x86 server guest has 32 vCPU and 48 GiB, Ubuntu 24.04, Python 3.13.18, PostgreSQL 16.15, and Redis 7.0.15. All of its models are fakes with a fixed delay.

## Changes from the raw runs

- `T15-agent-server-x86/10-up-license-excerpt.txt` is lines 54 to 57 of the container log of `langgraph up`, unchanged. The rest of the log is not kept.
- Rows marked `"warmup": true` in `T01-overhead-mac/` are kept, and the summary leaves them out.
- The timeout rows of `T05-retries-mac/01` and `02` undercount the attempts, because the stub logged after its sleep. The summary takes the timeout cells from `04-timeouts-arrival-count.jsonl`.
- No file holds a key, a token, a host name other than `127.0.0.1`, or a personal name.
