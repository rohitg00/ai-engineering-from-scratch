"""Normalize documents and fingerprint content.

Lesson: projects/rag-freshness-pipeline/stages/01-fingerprint/docs/en.md
The implementation is original and uses explicit local data contracts.
Run its tests through scripts/project_test.py.
"""

import hashlib
import unicodedata


def normalize(doc):
    if not isinstance(doc.get("id"), str) or not doc["id"].strip():
        raise ValueError("document id required")
    if not isinstance(doc.get("text"), str):
        raise ValueError("text must be a string")
    text = unicodedata.normalize("NFC", doc["text"]).replace("\r\n", "\n").strip()
    if not text:
        raise ValueError("empty document")
    return {
        "id": doc["id"],
        "text": text,
        "updated": int(doc.get("updated", 0)),
        "hash": hashlib.sha256(text.encode()).hexdigest(),
    }
