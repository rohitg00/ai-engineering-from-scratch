# Mission - The Workbench on a Real Repo

## Goal
Run the same `/signup` validation task through a prompt-only pipeline and a workbench-guided pipeline against the same sample app, then emit a before/after comparison report a skeptic can read.

## Inputs
- `sample_app/` with `app.py` (no validation), `test_app.py` (one happy-path test), `README.md`, `scripts/release.sh` as forbidden-zone bait
- Both pipelines fully scripted, no real LLM calls

## Deliverables
- `code/main.py` orchestrating both pipelines against the same fixture
- `before-after-report.md` with the five outcomes table
- `comparison.json` for downstream charting

## Acceptance
- `python3 code/main.py` exits zero
- The report measures all five outcomes: tests actually ran, acceptance met, files outside scope, handoff quality, reviewer total
- The workbench pipeline beats the prompt-only pipeline on at least four of the five

## Out of scope
- Plugging in a real LLM. The pipelines are scripted for reproducibility.
- Tuning the model. The comparison holds the model constant by construction.

## References
- `docs/en.md` - full lesson
- `code/main.py` - reference implementation
- `outputs/skill-workbench-benchmark.md` - extracted skill
