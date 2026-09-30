import json
import tempfile
from pathlib import Path
from support import support_ticket, export_support

raw = json.loads((Path(__file__).parent / "fixtures/ticket.json").read_text())
with tempfile.TemporaryDirectory() as tmp:
    result = export_support(support_ticket(raw), Path(tmp))
    print(json.dumps(result, indent=2))
print(
    "Use python3 main.py --ticket fixtures/ticket.json --out support-output to keep the HTML and JSON review."
)
