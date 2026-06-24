#!/usr/bin/env python3
"""
Fix answer-length bias in quiz.json files using Claude API.
Set ANTHROPIC_API_KEY environment variable before running.

Usage:
    export ANTHROPIC_API_KEY=your_key_here
    python3 scripts/fix_quiz_bias.py
"""

import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path

THRESHOLD = 1.5
API_URL = "https://api.anthropic.com/v1/messages"
MODEL = "claude-sonnet-4-6"


def get_api_key() -> str:
    key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not key:
        print("Error: ANTHROPIC_API_KEY environment variable not set.")
        print("Usage: export ANTHROPIC_API_KEY=your_key_here")
        sys.exit(1)
    return key


def is_biased(options: list[str], correct: int) -> bool:
    if not options or correct < 0 or correct >= len(options):
        return False
    correct_len = len(options[correct])
    distractors = [len(options[j]) for j in range(len(options)) if j != correct]
    if not distractors:
        return False
    avg = sum(distractors) / len(distractors)
    return avg > 0 and correct_len / avg > THRESHOLD


def rewrite_question(question: dict, api_key: str) -> dict:
    prompt = f"""You are fixing a quiz question that has answer-length bias.
The correct answer is significantly longer than the wrong answers, which lets test-takers guess by length alone.

Original question:
{json.dumps(question, indent=2)}

Rewrite the options so all answers are roughly similar in length.
Keep the meaning and correctness intact. Keep the same correct index.
Return only valid JSON in exactly this format, nothing else:
{{
  "stage": "{question.get('stage', 'check')}",
  "question": "...",
  "options": ["a", "b", "c", "d"],
  "correct": {question.get('correct', 0)},
  "explanation": "..."
}}"""

    payload = json.dumps({
        "model": MODEL,
        "max_tokens": 1024,
        "messages": [{"role": "user", "content": prompt}]
    }).encode()

    req = urllib.request.Request(
        API_URL,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read())
            text = data["content"][0]["text"].strip()
            # strip markdown fences if present
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
            return json.loads(text.strip())
    except (urllib.error.HTTPError, json.JSONDecodeError) as e:
        print(f"    API error: {e} — keeping original")
        return question


def fix_quiz(path: Path, api_key: str) -> int:
    with open(path) as f:
        data = json.load(f)

    if isinstance(data, list):
        questions = data
    elif isinstance(data, dict):
        questions = data.get("questions", [])
    else:
        return 0

    fixed = 0
    for i, q in enumerate(questions):
        if not isinstance(q, dict):
            continue
        options = q.get("options", [])
        correct = q.get("correct", -1)
        if is_biased(options, correct):
            print(f"  Fixing Q#{i}: {q.get('question', '')[:60]}...")
            questions[i] = rewrite_question(q, api_key)
            fixed += 1

    with open(path, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")

    return fixed


def main():
    api_key = get_api_key()
    root = Path(__file__).parent.parent
    quiz_files = sorted(root.rglob("quiz.json"))

    print(f"Scanning {len(quiz_files)} quiz files...\n")

    total_fixed = 0
    for path in quiz_files:
        issues = [
            q for q in (json.load(open(path)) if isinstance(json.load(open(path)), list)
                        else json.load(open(path)).get("questions", []))
            if isinstance(q, dict) and is_biased(q.get("options", []), q.get("correct", -1))
        ]
        if issues:
            print(f"Fixing {len(issues)} question(s) in {path.relative_to(root)}")
            total_fixed += fix_quiz(path, api_key)

    print(f"\nDone. Fixed {total_fixed} biased questions.")


if __name__ == "__main__":
    main()
