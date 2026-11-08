# The capture kit

Every request, response, and event that a manual shows comes from a run. The capture kit is the program that makes those runs and writes them to files. Listings and figures are cut from those files, and never typed from memory.

## Requirements

- The kit lives in `capture/` and writes its output to `capture/out/`.
- It runs offline. It needs no network and no keys.
- It uses the smallest set of dependencies that you can. The worked example uses the Python standard library only.
- It has two commands, declared in `manual.json` as argv arrays and run from the manual directory:

```json
"capture": {
  "run": ["python3", "capture/run.py"],
  "check": ["python3", "capture/run.py", "--check"],
  "timeoutSeconds": 300
}
```

- `run` writes `capture/out/`.
- `check` writes to a temporary directory, compares with `capture/out/`, and exits with a non-zero status on any difference.
- The audit runs `check` and reports drift as a finding. The default time limit is 300 seconds.

## Make the output deterministic

A check compares bytes, so two runs must write the same files. Remove each source of change:

| Source of change | Fix |
|---|---|
| generated ids | seed the generators, so ids repeat on every run |
| timestamps | use a fixed clock that starts at a set time and moves a set step, such as 250 ms per stamp |
| order of steps | run every scenario in a fixed order, one at a time |
| ports | bind fixed ports on `127.0.0.1` and list them in the front matter |
| values you cannot fix | mask them in both outputs before the comparison |

Aim to fix every value. Then the check is a plain byte comparison with nothing masked.

## Scenarios and files

Write one scenario per behavior that a section explains. Number the output files in reading order, such as `01-discovery.http`, `02-reply.http`, and `03-blocking-job.http`. Write each stream to its own file of pretty-printed frames, such as `05-streaming.events.json`. Write a log of the client's decisions when a section explains a client.

Each file must hold the full record of the exchange: the request line, the headers that matter, and the body. A listing then cuts lines from it, and the reader can open the full file.

## The kit README

Write `capture/README.md` with:

1. What the kit runs and how to run it, in two commands.
2. How the output stays deterministic.
3. A table of the agents, servers, or processes, with their ports and what each one shows.
4. A table of the output files and what each one shows.
5. A list of every place where the kit differs from the reference SDK, with the reason.

## Subjects that cannot run offline

A subject that is a proprietary binary or a hosted service cannot run in a CI job without the network. For such a subject:

- Record the captures on your own machine, with the pinned binaries installed.
- Make `check` compare the stored outputs after masking.
- When the subject is not installed, make `check` print `skipped`, give the reason, and exit 0.
- Name those captures, and the machine you recorded them on, in the front matter.

## Add the first run to the front matter

Give the reader the commands to run the kit and check it, the ports it needs, and the runtime version. The reader then sees the same files that the manual quotes.

Inside the AI Engineering from Scratch repo, see `manuals/a2a-101/capture/`. It runs three agents and a planner through 19 numbered scenarios.
