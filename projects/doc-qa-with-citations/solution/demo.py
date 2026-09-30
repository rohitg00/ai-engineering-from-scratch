import json
from documents import chunk_document
from retrieval import retrieve
from answer import answer

doc = {
    "id": "notes",
    "text": "Each guest has its own kernel. Shared containers use a host kernel.",
}
chunks = retrieve(chunk_document(doc), "guest")
print(
    json.dumps(
        answer(
            "guest",
            chunks,
            lambda p: json.dumps(
                {"source": "notes:0", "quote": "Each guest has its own kernel."}
            ),
        ),
        indent=2,
    )
)
