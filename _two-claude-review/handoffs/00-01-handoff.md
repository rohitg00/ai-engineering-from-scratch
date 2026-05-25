# Lesson Handoff — Phase 00 / Lesson 01: Dev Environment

> Builder fills this out at lesson completion. Reviewer reads this in Claude.ai.

## Metadata

- **Phase / Lesson:** `00-setup-and-tooling` / `01-dev-environment`
- **Language(s):** Python
- **Type:** Build
- **Date completed:** 2026-05-25
- **Time spent:** ~1h
- **Status:** `ready-for-re-review` (tightening pass after APPROVED verdict)

## 1. What I built

Added the missing LESSON_TEMPLATE deliverables for a lesson whose core code and prompt already existed.

**Files created/modified** (paths relative to repo root):
- `phases/00-setup-and-tooling/01-dev-environment/notebook/lesson.ipynb` — interactive walkthrough of the four-layer stack with runnable verification cells
- `phases/00-setup-and-tooling/01-dev-environment/outputs/verify-run-20260525.txt` — captured stdout from verify.py run (7/7 core, no GPU)

**Pre-existing files (no changes made):**
- `phases/00-setup-and-tooling/01-dev-environment/code/verify.py` — 7 core checks + 2 optional GPU checks; already complete and passing
- `phases/00-setup-and-tooling/01-dev-environment/docs/en.md` — full lesson spec; already complete
- `phases/00-setup-and-tooling/01-dev-environment/outputs/prompt-env-check.md` — env diagnostician prompt; already well-formed with frontmatter

**Key functions:**
- `run_check(name, check_fn, detail_fn) -> bool` — runs a single named check, prints PASS/FAIL, returns bool
- `main() -> int` — drives 7 core checks + 2 optional GPU checks, prints summary, returns exit code 0 (all pass) or 1

## 2. Concept in my own words

An AI engineering environment is a four-layer dependency stack: the OS and GPU drivers sit at the base, package managers build on top of those, language runtimes depend on the package managers, and the AI/ML libraries sit at the top. You must install bottom-up because each layer depends on the one below it — PyTorch needs Python, Python needs uv or a system Python installation, and uv needs a working OS with curl. A virtual environment is what isolates layer 4 (AI libraries) per project, so version conflicts between projects stay contained rather than accumulating in a single system-wide Python install.

## 3. Implementation decisions

- **No changes to verify.py:** The script already correctly tests all required tools (Python 3.10+, NumPy, Matplotlib, Jupyter, git, node, cargo) and treats GPU checks as optional/non-blocking. The exit code logic correctly returns 0 only when all core checks pass — this is the right design since the lesson explicitly states "no GPU is fine."
- **Notebook scope:** I kept the notebook focused on demonstrating and running the same checks interactively. I did NOT add hello-world code files (`main.py`, `main.rs`, `main.ts`, `main.jl`) because these are framed as student exercises in the lesson spec, not instructor deliverables. Adding them would be scope creep.
- **prompt-env-check.md left untouched:** The existing artifact is already well-formed (YAML frontmatter, clear instructions, specific commands, integration with verify.py). No improvement warranted.

## 4. Validation

Ran verify.py directly from project root using `python3`:

```
$ python3 phases/00-setup-and-tooling/01-dev-environment/code/verify.py

=== AI Engineering from Scratch — Environment Check ===

Core:
  [PASS] Python 3.10+ (Python 3.12.8 ...)
  [PASS] NumPy
  [PASS] Matplotlib
  [PASS] Jupyter
  [PASS] Git
  [PASS] Node.js
  [PASS] Rust (cargo)

GPU (optional):
  [FAIL] PyTorch
  [FAIL] CUDA

Result: 7/7 core checks passed (no GPU — that's fine, most lessons work on CPU)

You're ready. Start with Phase 1.
```

Full output saved at: `phases/00-setup-and-tooling/01-dev-environment/outputs/verify-run-20260525.txt`

Edge cases considered:
- GPU unavailable → handled gracefully (non-blocking FAIL, printed as "optional", exit code still 0)
- `python` command absent (only `python3` available on this macOS) → verify.py runs fine under `python3`; not a defect in verify.py itself

## 5. Open questions

- **`python` vs `python3` on macOS:** The lesson docs use `python` in all bash examples. On modern macOS, `python` is unaliased by default unless you're in a virtualenv. Should the lesson note this and suggest `python3` or activating a venv first? Not a blocker but worth flagging for the spec.
- **Node.js version:** The lesson spec says "Node.js 20+" but verify.py only checks for presence of `node`, not version. Should the check enforce `>=20`? Currently passes even on older Node versions.
- **Notebook not executed:** The `.ipynb` is committed with empty outputs (cells not run). This is standard for course notebooks — students run them locally. But Reviewer should confirm this is acceptable vs. requiring pre-run outputs.

## 6. Artifacts produced

- [x] Prompt → `phases/00-setup-and-tooling/01-dev-environment/outputs/prompt-env-check.md` (pre-existing, no change)
- [ ] Skill
- [ ] Agent
- [ ] MCP server

## 7. Quiz self-check (quiz.json — 5 questions)

| # | Stage | Topic | My answer | Correct? |
|---|-------|-------|-----------|----------|
| 1 | pre | Virtual env purpose | Isolate deps per project | ✓ |
| 2 | pre | CUDA purpose | Parallel computing on NVIDIA GPU for matrix ops | ✓ |
| 3 | post | First layer to install | System Foundation (OS, shell, GPU drivers) | ✓ |
| 4 | post | `uv` purpose | Ultra-fast Python package installer/resolver | ✓ |
| 5 | post | Verify GPU access | `import torch; print(torch.cuda.is_available())` | ✓ |

**Score: 5/5**

---

## Follow-up: Addressing Review Feedback (commit after `84a87c2`)

**Reviewer verdict:** `APPROVED` with three required action items before merge.

### Changes made

| Action item | File | Change |
|-------------|------|--------|
| Align Python threshold to 3.11 | `code/verify.py` | `(3, 10)` → `(3, 11)`; label updated to "Python 3.11+" |
| Add `uv` check | `code/verify.py` | New entry in CHECKS; now 8 core checks |
| Enforce Node 20+ | `code/verify.py` | Added `_node_major()` helper; check label is "Node.js 20+" |
| Align Python in docs | `docs/en.md` | `uv python install 3.12` → `3.11` |
| Fix fragile notebook path | `notebook/lesson.ipynb` cell-10 | Path resolved via candidate list (notebook/ or project root) |
| Add `uv` to notebook Layer 1+2 cell | `notebook/lesson.ipynb` cell-2 | Added `uv` to shutil.which display |

### Updated verify.py output

```
=== AI Engineering from Scratch — Environment Check ===

Core:
  [PASS] Python 3.11+ (Python 3.12.8 ...)
  [PASS] uv
  [PASS] NumPy
  [PASS] Matplotlib
  [PASS] Jupyter
  [PASS] Git
  [PASS] Node.js 20+
  [PASS] Rust (cargo)

GPU (optional):
  [FAIL] PyTorch
  [FAIL] CUDA

Result: 8/8 core checks passed (no GPU — that's fine, most lessons work on CPU)

You're ready. Start with Phase 1.
```

Full output at: `phases/00-setup-and-tooling/01-dev-environment/outputs/verify-run-20260525.txt`

### Deferred from this pass (optional items per reviewer)

- `pnpm` check not added — reviewer marked it optional. `uv` covers the Python-side package manager gap that caused the medium-severity finding.
- No venv-activation paragraph added to `docs/en.md` — reviewer marked optional. The reviewer's answer to Q1 (standardize on venv activation) is the correct pedagogical fix; a separate docs PR is a cleaner scope.
- MPS/Apple Silicon section not added to `docs/en.md` Step 6 — reviewer marked optional; own PR.
