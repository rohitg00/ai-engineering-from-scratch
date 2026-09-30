import tempfile
from pathlib import Path
from main import parse_message, export_desk

with tempfile.TemporaryDirectory() as directory:
    inputs = Path(__file__).parent / "fixtures"
    report = export_desk(
        [parse_message(p.read_bytes()) for p in sorted(inputs.glob("*.eml"))],
        Path(directory),
    )
    print("Three authored emails become a review queue:")
    for row in report["entries"]:
        print(row["decision"]["category"].ljust(12), row["message"]["subject"])
        print(
            "  Evidence:",
            ", ".join(e["quote"] for e in row["decision"]["evidence"])
            or "No phrase matched; inspect manually",
        )
    print(
        "Threads:",
        len(report["threads"]),
        "| Unsent drafts:",
        len(report["entries"]),
        "| Messages sent: 0",
    )
    print(
        "Run python3 main.py --input ./fixtures --out ./inbox-output to keep the HTML, JSON and drafts."
    )
