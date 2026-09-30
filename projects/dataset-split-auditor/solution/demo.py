import json
from main import *

rows = [
    {"id": str(i), "group": f"incident-{i // 2}", "text": f"Unique finding {i}"}
    for i in range(20)
]
split = split_groups(rows, 0.3)
print(
    json.dumps(
        {
            "assignments": {k: [r["id"] for r in v] for k, v in split.items()},
            "report": summarize(**split),
        },
        indent=2,
    )
)
