"""Use a framework splitter without losing offsets.

Lesson: projects/doc-qa-with-citations/stages/04-adapter/docs/en.md
The implementation is original and uses explicit local data contracts.
Run its tests through scripts/project_test.py.
"""

from answer import answer

from retrieval import retrieve


def adapt_splits(doc, parts):
    raise NotImplementedError("Stage 4: implement adapt_splits")


def framework_qa(question, doc, response):
    raise NotImplementedError("Stage 4: implement framework_qa")
