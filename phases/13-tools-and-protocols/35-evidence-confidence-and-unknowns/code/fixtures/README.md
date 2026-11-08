# Fixtures for lesson 35

Every file here is a program we wrote and compiled ourselves, or a record produced by running a tool on that program.

| File | What it is |
|---|---|
| `ledger.c` | The shared fixture source: `percent_change`, `grade`, `total`, `grade_label`. SHA-256 `4564c3e7e39fe4d10530bb6489722924ad3f34ffd78d8fa203a5e1fe832fdacb`. |
| `ledger-x86_64-O1.o` | x86-64 ELF relocatable object. SHA-256 `9a4a8082ba5e285a732552981a6935e0c5255725664f380e37c44ebfb04d803f`. |
| `harness.c` | A host test program that includes `ledger.c` and prints one function result per run. `main.py` compiles it with the host compiler. |
| `rea-evidence-percent-change.json` | rea 6.5.0 Evidence for `analyze_function` on `percent_change` with the Ghidra 12.1.4 provider. `evidence_id` `ev_e88b10dc0c6400e51bb6f7fdc3eaea8d2c97cc02463f0db3e6afeefc273197cd`. |
| `rea-evidence-grade.json` | rea 6.5.0 Evidence for `analyze_function` on `grade`. `evidence_id` `ev_67b6d3f992eaf49a2e16de084b6ebfdd9884e8c5c7f75e175b7bb20f4f748ce1`. |
| `rea-snapshot.json` | The rea analysis snapshot written by the two runs above. Two `query_` entries and an evidence bundle with the same two records. |
| `run-evidence.json` | Observed run records from the host build of `harness.c`, exported by `python3 code/main.py --record code/fixtures/run-evidence.json` on 2026-10-13 (macOS 26.2, arm64, Apple clang 17.0.0). |

Build command for the object (Apple clang 17.0.0, clang-1700.6.3.2, macOS 26.2, 2026-10-13):

```bash
clang -target x86_64-unknown-linux-gnu -O1 -fno-asynchronous-unwind-tables -c ledger.c -o ledger-x86_64-O1.o
```

rea commands (rea-agents 6.5.0, Ghidra 12.1.4, OpenJDK 21.0.12.1, `GHIDRA_INSTALL_DIR=/opt/homebrew/Cellar/ghidra/12.1.4/libexec`, `JAVA_HOME=/opt/homebrew/opt/openjdk@21`), run from this directory on 2026-10-14:

```bash
npx -y rea-agents@6.5.0 function "$PWD/ledger-x86_64-O1.o" grade --provider ghidra --format json --snapshot "$PWD/rea-snapshot.json" > rea-evidence-grade.json
npx -y rea-agents@6.5.0 function "$PWD/ledger-x86_64-O1.o" percent_change --provider ghidra --format json --snapshot "$PWD/rea-snapshot.json" > rea-evidence-percent-change.json
```

The first command took 8.6 s and the second 8.5 s, each with a fresh Ghidra import. A third run of the `grade` command against the same snapshot took 2.1 s and returned the same record with the same `evidence_id`.
