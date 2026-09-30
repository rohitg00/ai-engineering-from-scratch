"""Load local documents with stable provenance.

Lesson: projects/doc-qa-with-citations/stages/01-documents/docs/en.md
The implementation is original and uses explicit local data contracts.
Run its tests through scripts/project_test.py.
"""

from pathlib import Path

import hashlib


def load_documents(root):
    raise NotImplementedError("Stage 1: implement load_documents")


def chunk_document(doc, size=200, overlap=30):
    raise NotImplementedError("Stage 1: implement chunk_document")
