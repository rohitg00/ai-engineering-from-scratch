import argparse, json
from pathlib import Path
from main import import_catalog, candidates, export_catalog
from presentation import page

parser = argparse.ArgumentParser()
parser.add_argument("input")
parser.add_argument("--output", required=True)
parser.add_argument("--decisions")
args = parser.parse_args()
data = json.loads(Path(args.input).read_text())
left = import_catalog(data["left_csv"], "left")
right = import_catalog(data["right_csv"], "right")
pairs = candidates(left, right, data.get("threshold", 0.25))
result = export_catalog(
    left,
    right,
    json.loads(Path(args.decisions).read_text()) if args.decisions else None,
)
out = Path(args.output)
out.mkdir(parents=True, exist_ok=True)
(out / "crosswalk.csv").write_text(result["crosswalk"])
(out / "merged-catalog.json").write_text(json.dumps(result, indent=2))
page(
    "Catalog Record Linker",
    [
        ("Candidate pairs", pairs),
        ("Original records", left + right),
        ("Merged entities", result["entities"]),
    ],
    out / "review.html",
    {"fingerprint": result["fingerprint"], "pairs": []},
)
print(
    json.dumps(
        {
            "candidates": len(pairs),
            "entities": len(result["entities"]),
            "conflicts_resolved": result["ready"],
        }
    )
)
