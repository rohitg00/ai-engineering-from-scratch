# Log Volume Reduction Lab

Help an engineer build compact log context for an assistant. Learn bounded template grouping, counts and representative examples, then compare uniform and rarity-aware sampling on authored failure fixtures. Export compressed JSONL and a coverage report showing which important events were lost.

Standard libraries only. Four stages, approximately eight hours. Rust, Python implementations are exercised by the grader.

## Build it

1. [Parse and bound log records](stages/01-parse-bounded-logs/docs/en.md)
2. [Group repeated templates with source locators](stages/02-group-templates/docs/en.md)
3. [Compare sampling policies on rare events](stages/03-compare-samplers/docs/en.md)
4. [Export compact context and coverage](stages/04-export-coverage/docs/en.md)

```bash
python3 scripts/project_test.py log-volume-reduction-lab --init /tmp/log-volume-reduction-lab-work
python3 scripts/project_test.py log-volume-reduction-lab --stage 1 --path /tmp/log-volume-reduction-lab-work --strict
python3 scripts/project_test.py log-volume-reduction-lab --all --solution --strict
```

The fresh starter fails until you implement it. Reference-solution runs never grant learner completion certificates.

## Run your own logs

```bash
cd projects/log-volume-reduction-lab/solution
rustc --edition 2021 main.rs -o /tmp/log-context
/tmp/log-context fixtures/burst.log 8 rarity /tmp/context.jsonl
python3 main.py fixtures/burst.log /tmp/context.jsonl --out /tmp/coverage.json
python3 demo.py
```

Input is UTF-8 `LEVEL<TAB>message`, one record per line. The Rust tool replaces maximal ASCII digit runs with `#`, groups by severity plus template and retains representative groups under a sample-record budget. It writes schema-version-1 JSONL containing total source counts and first/last line locators. The Python consumer independently checks group identity and counts against the original source, then reports rare-template coverage (frequency at most 2 by default).

The authored 200-line fixture has one disk-full event at line 138. Uniform sampling with budget 8 misses it; rarity retains it. Normalization can merge unrelated messages, and ranges are not full source identity lists. This tool neither redacts sensitive log text nor proves preservation of every causal clue. Pre-redact inputs before sending context to an assistant. The bounded core accepts one MiB, 10,000 lines and 4096 bytes per line.

The demo compiles and executes the actual Rust implementation and feeds both resulting JSONL files into the Python coverage implementation. [Rust strings](https://doc.rust-lang.org/std/string/struct.String.html) document UTF-8 behavior.

## Completion evidence

```bash
python3 scripts/project_test.py log-volume-reduction-lab --all --path /tmp/log-volume-reduction-lab-work --strict --report /tmp/log-volume-reduction-lab-result.json
```

Local reports are unsigned, self-reported evidence. The editable figures calculate illustrative values; the CLI runs the actual implementation.
