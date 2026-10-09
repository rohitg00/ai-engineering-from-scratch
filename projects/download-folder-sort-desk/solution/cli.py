import argparse, json
from pathlib import Path
from main import inventory, plan_moves, review_plan
from presentation import page

parser = argparse.ArgumentParser()
parser.add_argument("input")
parser.add_argument("--output", required=True)
parser.add_argument("--decisions")
args = parser.parse_args()
source = Path(args.input).resolve()
data = json.loads(source.read_text())
folder = (source.parent / data["folder"]).resolve()
out = Path(args.output).resolve()
if out == folder or folder in out.parents:
    raise ValueError("output must be outside the input folder")
result = review_plan(
    folder,
    plan_moves(inventory(folder), data.get("occupied")),
    json.loads(Path(args.decisions).read_text()) if args.decisions else None,
)
out.mkdir(parents=True, exist_ok=True)
(out / "moves.json").write_text(json.dumps(result, indent=2))
(out / "duplicates.json").write_text(json.dumps(result["duplicate_groups"], indent=2))
page(
    "Download Folder Sort Desk",
    [
        ("Filing proposals", result["moves"]),
        ("Duplicate content", result["duplicate_groups"]),
    ],
    out / "review.html",
    {"fingerprint": result["fingerprint"], "approved": []},
)
print(
    json.dumps(
        {
            "files": len(result["moves"]),
            "duplicate_groups": len(result["duplicate_groups"]),
            "approved": sum((m["approved"] for m in result["moves"])),
        }
    )
)
