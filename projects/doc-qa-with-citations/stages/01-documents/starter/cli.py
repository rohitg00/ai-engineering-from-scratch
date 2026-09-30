"""Search local text documents and retain exact source evidence."""

import argparse
import hashlib
import html
import json
import re
from pathlib import Path
from documents import load_documents, chunk_document
from retrieval import retrieve
from answer import answer

STOP = {
    "the",
    "a",
    "an",
    "is",
    "are",
    "what",
    "which",
    "does",
    "do",
    "how",
    "to",
    "of",
    "in",
    "for",
}


def terms(text):
    return set(re.findall(r"\w+", text.casefold())) - STOP


def extract(prompt):
    data = json.loads(prompt)
    candidates = [
        (len(terms(data["question"]) & terms(sentence)), chunk["id"], sentence)
        for chunk in data["evidence"]
        for sentence in re.split(r"(?<=[.!?])\s+", chunk["text"])
        if sentence.strip()
    ]
    _, source, quote = sorted(candidates, key=lambda row: (-row[0], row[1], row[2]))[0]
    return json.dumps({"source": source, "quote": quote})


def query(root, question, model=extract):
    docs = load_documents(root)
    chunks = [chunk for doc in docs for chunk in chunk_document(doc)]
    selected = retrieve(chunks, " ".join(sorted(terms(question))))
    result = answer(question, selected, model)
    result.update(
        schema_version=1,
        question=question,
        candidates=[{k: c[k] for k in ("id", "score")} for c in selected],
        relevance="lexical overlap; human judgment still required",
    )
    if result["answer"] and not terms(question) & terms(result["answer"]):
        result.update(state="needs_review", reason="quote has no meaningful query term")
    for citation in result["citations"]:
        doc = next(d for d in docs if d["id"] == citation["source"])
        citation["sha256"] = doc["sha256"]
        citation["start_line"] = doc["text"][: citation["start"]].count("\n") + 1
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("documents", type=Path)
    parser.add_argument("question")
    parser.add_argument(
        "--response",
        type=Path,
        help="recorded model JSON, checked against retrieved sources",
    )
    parser.add_argument("--output", type=Path, default=Path("answer.json"))
    parser.add_argument("--html", type=Path, default=Path("answer.html"))
    args = parser.parse_args()
    result = query(
        args.documents,
        args.question,
        (lambda _: args.response.read_text()) if args.response else extract,
    )
    result["mode"] = "recorded-model" if args.response else "local-extractive"
    text = json.dumps(result, indent=2)
    args.output.write_text(text + "\n")
    args.html.write_text(
        '<!doctype html><meta charset="utf-8"><title>Citation receipt</title><h1>Citation receipt</h1><pre>'
        + html.escape(text)
        + "</pre>"
    )
    print(text)


if __name__ == "__main__":
    main()
