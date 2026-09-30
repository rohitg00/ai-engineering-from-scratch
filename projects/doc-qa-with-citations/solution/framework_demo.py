import json
from adapter import framework_qa

print("Real LangChain splitter and FakeListLLM, no network calls")
print(
    json.dumps(
        framework_qa(
            "guest kernel",
            {"id": "doc", "text": "Each guest owns a separate kernel."},
            '{"source":"doc:0","quote":"Each guest owns a separate kernel."}',
        ),
        indent=2,
    )
)
