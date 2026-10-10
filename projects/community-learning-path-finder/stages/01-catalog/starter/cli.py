import argparse, json
from pathlib import Path
from main import catalog, export_path
from presentation import page

parser = argparse.ArgumentParser()
parser.add_argument("input")
parser.add_argument("--output", required=True)
parser.add_argument("--decisions")
args = parser.parse_args()
data = json.loads(Path(args.input).read_text())
result = export_path(
    catalog(data["resources"]),
    data["goals"],
    data["budget"],
    data.get("completed"),
    json.loads(Path(args.decisions).read_text()) if args.decisions else None,
)
out = Path(args.output)
out.mkdir(parents=True, exist_ok=True)
(out / "path.json").write_text(json.dumps(result, indent=2))
(out / "unmet-prerequisites.json").write_text(
    json.dumps(result["unmet_prerequisites"], indent=2)
)
page(
    "Community Learning Path Finder",
    [
        ("Selected prerequisite order", result["path"]),
        ("Budget alternatives", result["alternatives"]),
        ("Missing prerequisites", result["unmet_prerequisites"]),
    ],
    out / "learning-map.html",
    {
        "fingerprint": result["fingerprint"],
        "completed": [parser["id"] for parser in result["path"] if parser["completed"]],
    },
)
print(
    json.dumps(
        {
            "covered": result["covered"],
            "uncovered": result["uncovered"],
            "remaining_minutes": result["remaining_minutes"],
        }
    )
)
