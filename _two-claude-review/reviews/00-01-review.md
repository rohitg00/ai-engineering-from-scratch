# Lesson Review — Phase 00 / Lesson 01: Dev Environment

> Reviewer (Claude.ai) audit of Builder's handoff at commit `f7c565b9fb13d1a51353386f84b208b1ce2af2d7`.

## Metadata

- **Reviewing:** `_two-claude-review/handoffs/00-01-handoff.md`
- **Review date:** 2026-05-25
- **Verdict:** `APPROVED` (with action items for a follow-up tightening pass)

## Checklist findings

| # | Criterion | Pass | Notes |
|---|-----------|------|-------|
| 1 | Correctness | ⚠️ | Deliverables exist and match handoff. One contradiction: Python version threshold disagrees across `verify.py` (3.10+), `docs/en.md` (3.11+), and `notebook/lesson.ipynb` (asserts 3.11+). |
| 2 | Conceptual integrity | ✅ | Four-layer stack explanation is accurate in docs, notebook, and handoff §2. Quiz answers correct. MPS note for Apple Silicon is right. |
| 3 | First-principles depth | ✅ | `verify.py` uses only stdlib (`sys`, `shutil`, `subprocess`). No test-framework shortcut. Appropriate for a setup lesson. |
| 4 | Cross-lesson links | ⚠️ | `docs/en.md` "Use It" table maps languages to later phases, which is good. Handoff §1 doesn't explicitly call out which downstream lessons depend on which tool. Acceptable for Lesson 01 (no priors). |
| 5 | Test rigor | ⚠️ | 7 core checks run, GPU checks are non-blocking — correct design. Real gaps: no `uv` check, no `pnpm` check, no Node version enforcement, Python lower bound too lenient. |
| 6 | Open question quality | ✅ | All three questions in handoff §5 are legitimate and worth answering. See §"Answers to Builder's open questions" below. |
| 7 | Artifact reusability | ✅ | `prompt-env-check.md` has proper YAML frontmatter, scoped role, specific fixes per layer, and a verification step. Portable. Notebook is also reusable. |

## Detailed findings

### What's solid

- The **four-layer stack mental model** (System → Package Managers → Runtimes → AI Libs) is consistent across docs, notebook, and handoff. It's the right abstraction and the "install bottom-up" rule is the correct corollary.
- **`verify.py` design** is clean: a list of `(name, check_fn, detail_fn)` tuples driven by a single `run_check` function. Easy to extend. The decision to make GPU checks non-blocking via a separate list is correct — matches the spec's "no GPU is fine" stance.
- **Exit code logic** is right: returns 0 only when all *core* checks pass; GPU pass/fail does not gate exit code. This means CI can run this script.
- **`prompt-env-check.md`** is well-structured. YAML frontmatter with `name`, `description`, `phase`, `lesson` makes it indexable. The "identify which layer is broken" framing teaches diagnostic thinking, not just fixes.
- **Notebook** correctly demonstrates each layer interactively and ends by shelling out to the canonical `verify.py`, reinforcing that the script is the source of truth.
- **Handoff §3** is honest about *not* adding the four hello-world files (`main.py`, `main.ts`, `main.rs`, `main.jl`) and correctly identifies them as student exercises per `docs/en.md` §Exercises. Resisting scope creep is the right call.

### Issues found

- **[Severity: medium] Python version threshold contradiction across three artifacts.**
  - `verify.py` line 6: `sys.version_info >= (3, 10)`
  - `docs/en.md` Learning Objectives: "Set up Python 3.11+"
  - `notebook/lesson.ipynb` cell 4: `assert sys.version_info >= (3, 11)`
  A student installing Python 3.10 would pass `verify.py` ("You're ready") and then fail the notebook assertion. This is exactly the kind of "environment broken, but it said it was ready" situation the lesson exists to prevent.
  **Why it matters:** The verification script is the *contract*. If it disagrees with the spec, it's not verifying the spec.

- **[Severity: medium] `verify.py` does not check `uv` or `pnpm`.**
  The lesson explicitly teaches `uv` (Step 2) and `pnpm` (Step 3) as the canonical package managers. A student could `apt install python3-numpy python3-matplotlib jupyter-notebook` without ever installing `uv`, and `verify.py` would say "You're ready." The script verifies that *some* working Python toolchain exists, not that the *lesson's* recommended toolchain was followed.
  **Why it matters:** Later lessons will assume `uv` is available (e.g., for `uv pip install torch`). A silent miss here surfaces as a confusing failure two lessons later.

- **[Severity: low] Node.js version not enforced.**
  Builder flagged this in §5. `docs/en.md` says "Node.js 20+" but `verify.py` only checks presence. A student on Node 16 (still common on legacy systems) would pass. Fix is one `subprocess.run(['node', '--version'])` parse.

- **[Severity: low] Notebook's verify.py path is fragile.**
  Cell uses `"../code/verify.py"` (relative). Works only if the notebook is launched from `phases/00-setup-and-tooling/01-dev-environment/notebook/`. If a student runs Jupyter from project root and opens the notebook through the file tree, CWD may differ. Workaround: document the launch CWD in the notebook's first cell, or compute the path from `os.path.dirname(os.path.abspath(''))`.

- **[Severity: low] `verify-run-20260525.txt` was produced outside a uv-managed venv.**
  The captured stdout shows `Python 3.12.8 ... [Clang 13.0.0 (clang-1300.0.29.30)]` — that's the python.org binary, not a uv-managed install. Not a defect per se, but the captured artifact doesn't model the lesson's recommended setup. A future re-run inside `.venv` would be a more faithful demonstration.

### Conceptual gaps to address

- The lesson teaches the four-layer stack but doesn't explicitly teach **what a virtual environment is or why it isolates Layer 4 specifically**. Quiz Q1 covers this conceptually, but the docs jump from `uv venv` to `source .venv/bin/activate` without explaining what activation does (modifies `PATH`, sets `VIRTUAL_ENV`, aliases `python`/`pip`). This is the most common source of "my install worked but `import` fails" issues — worth one paragraph.
- The MPS (Apple Silicon) path is mentioned in the notebook but not in `docs/en.md` Step 6 ("GPU Setup"), which only covers NVIDIA. Mac users on M-series chips are a large fraction of the course's likely audience.

### Connections Builder missed

- **Foreshadowing to later lessons:**
  - `uv pip install torch` in Step 6 → every Phase 1-12 ML lesson will reuse this pattern. Worth one sentence: "You'll repeat this pattern of `uv pip install <lib>` in nearly every Python lesson — that's why we set up `uv` first."
  - `pnpm` → Phase 13+ TS/agent lessons.
  - `cargo` → Phase 12, 15-17 Rust performance lessons.
  The handoff identifies these in the "Use It" table but doesn't lift them into the *narrative* of the lesson.
- **Prior-lesson connections:** N/A — this is Lesson 01.

## Action items (non-blocking, recommended before Lesson 02 starts)

- [ ] Align Python version threshold to **3.11** across all three sources of truth: bump `verify.py` line 6 from `(3, 10)` to `(3, 11)`. Update `docs/en.md` Step 2 to install `3.11` (or update Learning Objectives to "3.12+" if you want to standardize on 3.12 since that's what's installed in the captured run).
- [ ] Add a `uv` check to `verify.py` — `shutil.which("uv") is not None`. Since `uv` is the lesson's canonical package manager, its absence should fail verification.
- [ ] Add Node version enforcement — parse `node --version` and assert major >= 20.
- [ ] (Optional) Add a `pnpm` check parallel to the `uv` check.
- [ ] (Optional) Add one paragraph to `docs/en.md` between Step 2 and Step 3 explaining what venv activation does at the shell level (PATH manipulation).
- [ ] (Optional) Add a brief MPS/Apple Silicon section to `docs/en.md` Step 6 alongside the NVIDIA path.

These are flagged but **do not block KB export**. The lesson achieves its stated learning objectives at the current commit.

## Answers to Builder's open questions

1. **Q: `python` vs `python3` on macOS — should the lesson note this?**
   **A: Yes, but the fix is to standardize on activating the venv, not to switch the docs to `python3`.** Inside an activated `uv venv`, `python` resolves to the venv's interpreter on both macOS and Linux. The lesson already creates a venv in Step 2 (`uv venv` → `source .venv/bin/activate`). The implicit assumption throughout the rest of the docs is that the venv is active. Make that assumption explicit: add a one-liner after Step 2 like "From here on, all `python` commands assume your venv is activated. If `which python` doesn't point to `.venv/bin/python`, re-run `source .venv/bin/activate`." This is more pedagogically valuable than scattering `python3` everywhere because it teaches the venv → PATH relationship.

2. **Q: Should `verify.py` enforce Node >= 20?**
   **A: Yes.** The spec promises Node 20+; the verification should enforce it. Otherwise the verification is lying to the student. Minimal patch:
   ```python
   def node_version_ok():
       result = subprocess.run(["node", "--version"], capture_output=True, text=True)
       # output like "v22.11.0"
       major = int(result.stdout.strip().lstrip("v").split(".")[0])
       return major >= 20
   ```
   Same pattern applies to `python --version` (catch the 3.10 vs 3.11 gap) and could be applied to `cargo --version` if you want to pin a Rust edition.

3. **Q: Notebook committed with empty outputs — acceptable?**
   **A: Yes, this is the right call for course notebooks.** Three reasons: (1) reduces diff noise — every re-run would churn the outputs in git; (2) keeps the file small; (3) forces the student to actually execute it, which is the whole point of a notebook lesson. The only exception is when an output is *the artifact* (e.g., a chart that's referenced from elsewhere), which isn't the case here. Standard practice is to add a pre-commit hook like `nbstripout` to enforce this — worth adding to the repo at the Phase 00 level, not lesson-specific.

## Sign-off

**`APPROVED`** — proceeding to generate `kb-entry.md`.

Action items above should be folded into a small tightening commit before Lesson 02 begins, ideally on this same `feature/phase-00-lesson-01` branch before merge. None are KB-blocking.
