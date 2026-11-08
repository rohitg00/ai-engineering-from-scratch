# Fixtures for lesson 36

Every file here is ours. `ledger.c` is a copy of `manuals/reverse-engineering-101/capture/fixtures/ledger.c`.

Build command for every x86-64 object in this folder and in `candidates/`:

```
clang -target x86_64-unknown-linux-gnu -O1 -fno-asynchronous-unwind-tables -c <source>.c
```

| File | Content |
|---|---|
| `ledger.c` | the original source: `percent_change`, `grade`, `total`, `grade_label` |
| `ledger-x86_64-O1.o` | the original object, SHA-256 `9a4a8082ba5e285a732552981a6935e0c5255725664f380e37c44ebfb04d803f` |
| `candidates/*.c` | eight rebuilds of `percent_change` and `grade`, one function per file |
| `candidates/*.o` | each rebuild compiled with the command above |
| `runs/agent-run.json` | one run of the agent loop over rea 6.5.0 and Ghidra 12.1.4, recorded by `main.py --live` |
| `runs/leg-one-*.json` | the rows of one execute-and-compare run, recorded by `main.py --save-runs` |

The tests read the committed objects and runs, so they pass on a host without clang, rea, or Ghidra.
