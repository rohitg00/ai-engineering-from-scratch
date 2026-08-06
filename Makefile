# AI Engineering from Scratch — common commands
#
# All targets are designed for Ubuntu (CI) and macOS. Windows users can run
# the equivalent commands directly via PowerShell or WSL.
#
# Usage:
#   make audit          — run invariant checks on every lesson
#   make lint           — lint Python (ruff) and JS/CSS (prettier)
#   make typecheck      — run mypy on scripts
#   make test           — run pytest on all lessons that have tests
#   make lesson-run     — syntax-check every .py file in the curriculum
#   make lesson-exec    — execute stdlib-only lessons (10 s timeout each)
#   make build-site     — rebuild site/data.js from catalog + README
#   make install-skills — install all skills into ./out/skills
#   make scaffold       — scaffold a new lesson (usage: make scaffold PHASE=NN SLUG=name)
#   make clean          — remove __pycache__, .mypy_cache, .ruff_cache, .pytest_cache

.PHONY: help audit lint typecheck test lesson-run lesson-exec build-site install-skills scaffold clean all

PYTHON := python3
NODE := node

# ── Quality ────────────────────────────────────────────────────────────────

audit:
	$(PYTHON) scripts/audit_lessons.py

lint:
	@echo "→ ruff lint …"
	$(PYTHON) -m ruff check scripts/ phases/
	@echo "→ ruff format check …"
	$(PYTHON) -m ruff format --check scripts/ phases/

lint-fix:
	$(PYTHON) -m ruff check --fix scripts/ phases/
	$(PYTHON) -m ruff format scripts/ phases/

typecheck:
	$(PYTHON) -m mypy --config-file pyproject.toml scripts/

test:
	$(PYTHON) -m pytest --timeout=30 -x

# ── Curriculum checks ─────────────────────────────────────────────────────

lesson-run:
	$(PYTHON) scripts/lesson_run.py

lesson-exec:
	$(PYTHON) scripts/lesson_run.py --execute --strict

phase-run:
	$(PYTHON) scripts/lesson_run.py --phase $(PHASE)

phase-exec:
	$(PYTHON) scripts/lesson_run.py --execute --strict --phase $(PHASE)

# ── Site ───────────────────────────────────────────────────────────────────

build-site:
	$(NODE) site/build.js

# ── Skills ─────────────────────────────────────────────────────────────────

install-skills:
	$(PYTHON) scripts/install_skills.py

# ── Scaffolding ────────────────────────────────────────────────────────────

scaffold:
	test -n "$(PHASE)" -a -n "$(SLUG)" || (echo "Usage: make scaffold PHASE=NN SLUG=lesson-name"; exit 1)
	bash scripts/scaffold-lesson.sh $(PHASE) $(SLUG)

# ── Link checking ─────────────────────────────────────────────────────────

link-check:
	$(PYTHON) scripts/link_check.py

# ── Catalog ────────────────────────────────────────────────────────────────

build-catalog:
	$(PYTHON) scripts/build_catalog.py

# ── All-in-one ─────────────────────────────────────────────────────────────

all: audit build-catalog lesson-run test build-site

# ── Cleanup ────────────────────────────────────────────────────────────────

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null; true
	find . -type d -name .mypy_cache -exec rm -rf {} + 2>/dev/null; true
	find . -type d -name .ruff_cache -exec rm -rf {} + 2>/dev/null; true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null; true
	find . -type f -name .link-cache.json -delete 2>/dev/null; true
	find . -type f -name catalog.json -delete 2>/dev/null; true
