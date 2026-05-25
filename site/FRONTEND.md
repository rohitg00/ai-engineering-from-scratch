# Frontend (Local Student Dashboard)

This repo ships a local-first student UI (Scaler-style):

- `dashboard.html` → phase cards + global progress
- `phase.html` → per-phase lesson tiles + sidebar + progress
- `lesson.html` → lesson reader + sticky progress bar + Code Lab (run/test locally)

All course content is read directly from this repo via a local server (no GitHub/raw content fetch).

## Quick start

From the repo root:

```bash
cd ai-engineering-from-scratch
node site/local-server.mjs
```

Open:

- Dashboard: `http://127.0.0.1:5174/dashboard.html`
- About/home: `http://127.0.0.1:5174/index.html`

## How it works

The server lives at:

- `site/local-server.mjs`

It provides:

- Static files: `GET /` serves files from `site/`
- Local content: `GET /content/<repo-path>` serves files from the course repo (e.g. lesson markdown at `/content/phases/.../docs/en.md`)
- Directory listing: `GET /api/list?path=<repo-path>` returns local directory entries (used by lesson panels)
- Lesson meta: `GET /api/lesson-meta?path=phases/.../...` returns metadata and resolved runnable files
- Runner APIs:
  - `POST /api/run` executes `python3` for a selected file
  - `POST /api/test` runs `pytest` if installed, else `unittest` discovery
- Rubrics/AI hooks:
  - `GET /api/rubric?path=...` returns `rubric.json` if present, else a generated rubric
  - `POST /api/review` currently returns `501` (stub) until an LLM provider is wired up

## Code Lab

In `lesson.html`, the **Code Lab** panel:

- auto-detects runnable artifacts via `/api/lesson-meta` (uses `catalog.json` + filesystem fallback)
- fetches the runnable file content from `/content/...`
- runs code via `/api/run`
- runs tests via `/api/test`

Notes:

- `Run` currently runs Python (`python3 -I ...`). Other languages are listed (Julia/TS/etc.) but not executed yet.
- Tests only run if the lesson directory includes a `tests/` folder or `test_*.py` files.

## Progress tracking (local only)

Progress is stored in browser `localStorage` by:

- `site/progress.js`

Resetting progress clears local completion + quiz answers for this browser only.

## Next steps (planned)

- Add non-Python runners (Node/TS, Julia, Rust) behind the same API.
- Implement `/api/review` with a configurable LLM provider and per-lesson rubrics.

