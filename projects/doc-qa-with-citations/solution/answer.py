"""Accept only answers grounded in retrieved spans.

Lesson: projects/doc-qa-with-citations/stages/03-answer/docs/en.md
The implementation is original and uses explicit local data contracts.
Run its tests through scripts/project_test.py.
"""

import json


def answer(question, chunks, model):
    if not chunks:
        return {"answer": None, "citations": [], "state": "abstained"}
    prompt = json.dumps(
        {
            "question": question,
            "evidence": [{"id": c["id"], "text": c["text"]} for c in chunks],
        }
    )
    raw = model(prompt)
    payload = json.loads(raw)
    if (
        not isinstance(payload, dict)
        or not isinstance(payload.get("quote"), str)
        or not payload["quote"].strip()
    ):
        raise ValueError("model must return a quote and source id")
    source = next((c for c in chunks if c["id"] == payload.get("source")), None)
    if source is None or payload["quote"] not in source["text"]:
        raise ValueError("unsupported model answer")
    relative = source["text"].index(payload["quote"])
    return {
        "answer": payload["quote"],
        "citations": [
            {
                "source": source["source"],
                "start": source["start"] + relative,
                "end": source["start"] + relative + len(payload["quote"]),
            }
        ],
        "state": "answered",
    }
