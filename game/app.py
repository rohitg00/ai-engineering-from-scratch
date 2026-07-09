"""Knowledge Game — FastAPI dashboard + MCQ quiz game over the curriculum.

Run:
    uvicorn game.app:app --reload --port 8010
"""
from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import FastAPI, Form, Request
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from game import db
from game.catalog import build_catalog, get_lesson, get_phase
from game.quiz_loader import load_quiz

APP_DIR = Path(__file__).resolve().parent

app = FastAPI(title="AI Engineering Knowledge Game")
app.mount("/static", StaticFiles(directory=APP_DIR / "static"), name="static")
templates = Jinja2Templates(directory=APP_DIR / "templates")

# In-memory quiz-in-progress state, keyed by (session_id, lesson_path). Ephemeral by
# design: durable progress lives in SQLite (lesson_progress / player_stats).
_sessions: dict[tuple[str, str], dict] = {}

SESSION_COOKIE = "kg_session"


@app.on_event("startup")
def on_startup() -> None:
    db.init_db()


def _get_session_id(request: Request) -> str:
    return request.cookies.get(SESSION_COOKIE) or str(uuid.uuid4())


def _ensure_session_cookie(request: Request, response) -> str:
    sid = request.cookies.get(SESSION_COOKIE)
    if not sid:
        sid = str(uuid.uuid4())
        response.set_cookie(SESSION_COOKIE, sid, max_age=60 * 60 * 24 * 365)
    return sid


@app.get("/")
def dashboard(request: Request):
    catalog = build_catalog()
    progress = db.get_all_progress()
    stats = db.get_player_stats()

    total_lessons = sum(len(p.lessons) for p in catalog)
    quizzes_played = len(progress)
    phases_mastered = 0
    phase_rows = []
    for phase in catalog:
        phase_lesson_paths = [l.path for l in phase.lessons]
        mastered_count = sum(1 for lp in phase_lesson_paths if progress.get(lp, {}).get("mastered"))
        played_count = sum(1 for lp in phase_lesson_paths if lp in progress)
        pct = round(100 * mastered_count / len(phase.lessons)) if phase.lessons else 0
        if mastered_count == len(phase.lessons) and phase.lessons:
            phases_mastered += 1
        phase_rows.append(
            {
                "phase": phase,
                "mastered_count": mastered_count,
                "played_count": played_count,
                "pct": pct,
            }
        )

    response = templates.TemplateResponse(
        request,
        "dashboard.html",
        {
            "stats": stats,
            "total_lessons": total_lessons,
            "quizzes_played": quizzes_played,
            "phases_mastered": phases_mastered,
            "total_phases": len(catalog),
            "phase_rows": phase_rows,
        },
    )
    _ensure_session_cookie(request, response)
    return response


@app.get("/phases/{phase_dir}")
def phase_view(request: Request, phase_dir: str):
    phase = get_phase(phase_dir)
    if not phase:
        return RedirectResponse("/")
    progress = db.get_all_progress()
    lesson_rows = [
        {"lesson": l, "progress": progress.get(l.path)}
        for l in sorted(phase.lessons, key=lambda l: l.order)
    ]
    return templates.TemplateResponse(
        request, "phase.html", {"phase": phase, "lesson_rows": lesson_rows}
    )


def _quiz_key(session_id: str, lesson_path: str) -> tuple[str, str]:
    return (session_id, lesson_path)


@app.get("/play/{phase_dir}/{lesson_dir}")
def play(request: Request, phase_dir: str, lesson_dir: str):
    phase = get_phase(phase_dir)
    lesson = get_lesson(phase_dir, lesson_dir)
    if not phase or not lesson:
        return RedirectResponse("/")

    questions = load_quiz(lesson)
    if not questions:
        return RedirectResponse(f"/phases/{phase_dir}")

    session_id = _get_session_id(request)
    key = _quiz_key(session_id, lesson.path)
    state = _sessions.get(key)
    if state is None or "restart" in request.query_params:
        state = {"index": 0, "score": 0, "answered": None, "last_correct": None, "finished": False}
        _sessions[key] = state

    if state["index"] >= len(questions):
        return RedirectResponse(f"/results/{phase_dir}/{lesson_dir}")

    question = questions[state["index"]]
    response = templates.TemplateResponse(
        request,
        "play.html",
        {
            "phase": phase,
            "lesson": lesson,
            "question": question,
            "question_number": state["index"] + 1,
            "total_questions": len(questions),
            "score": state["score"],
            "answered": state["answered"],
            "last_correct": state["last_correct"],
            "stats": db.get_player_stats(),
        },
    )
    response.set_cookie(SESSION_COOKIE, session_id, max_age=60 * 60 * 24 * 365)
    return response


@app.post("/play/{phase_dir}/{lesson_dir}/answer")
def answer(request: Request, phase_dir: str, lesson_dir: str, selected: int = Form(...)):
    phase = get_phase(phase_dir)
    lesson = get_lesson(phase_dir, lesson_dir)
    if not phase or not lesson:
        return RedirectResponse("/")

    questions = load_quiz(lesson)
    session_id = _get_session_id(request)
    key = _quiz_key(session_id, lesson.path)
    state = _sessions.get(key)
    if state is None or state["index"] >= len(questions):
        return RedirectResponse(f"/play/{phase_dir}/{lesson_dir}")

    question = questions[state["index"]]
    is_correct = selected == question["correct"]

    if state["answered"] is None:
        db.record_answer(session_id, lesson.path, phase.id, state["index"], selected, is_correct)
        if is_correct:
            state["score"] += 1
        state["answered"] = selected
        state["last_correct"] = is_correct
    else:
        state["index"] += 1
        state["answered"] = None
        state["last_correct"] = None
        if state["index"] >= len(questions):
            db.finish_lesson(session_id, lesson.path, phase.id, state["score"], len(questions))
            state["finished"] = True

    response = RedirectResponse(f"/play/{phase_dir}/{lesson_dir}", status_code=303)
    response.set_cookie(SESSION_COOKIE, session_id, max_age=60 * 60 * 24 * 365)
    return response


@app.post("/reset")
def reset_progress():
    db.reset_all()
    _sessions.clear()
    return RedirectResponse("/", status_code=303)


@app.get("/results/{phase_dir}/{lesson_dir}")
def results(request: Request, phase_dir: str, lesson_dir: str):
    phase = get_phase(phase_dir)
    lesson = get_lesson(phase_dir, lesson_dir)
    if not phase or not lesson:
        return RedirectResponse("/")

    session_id = _get_session_id(request)
    key = _quiz_key(session_id, lesson.path)
    state = _sessions.pop(key, None)
    questions = load_quiz(lesson)

    if state is None:
        progress = db.get_lesson_progress(lesson.path)
        score = progress["best_score"] if progress else 0
    else:
        score = state["score"]
        if not state.get("finished"):
            db.finish_lesson(session_id, lesson.path, phase.id, score, len(questions))

    return templates.TemplateResponse(
        request,
        "results.html",
        {
            "phase": phase,
            "lesson": lesson,
            "score": score,
            "total_questions": len(questions),
            "stats": db.get_player_stats(),
            "progress": db.get_lesson_progress(lesson.path),
        },
    )
