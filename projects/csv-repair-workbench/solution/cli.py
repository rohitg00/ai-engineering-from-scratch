import argparse, json
from pathlib import Path
from main import profile, propose, preview, repair
from presentation import page

parser = argparse.ArgumentParser()
parser.add_argument("input")
parser.add_argument("--output", required=True)
parser.add_argument("--decisions")
parser.add_argument("--recipe")
args = parser.parse_args()
data = json.loads(Path(args.input).read_text())
table = profile(data["csv"])
recipe = (
    json.loads(Path(args.recipe).read_text())
    if args.recipe
    else propose(table, data.get("aliases"), data.get("date_columns"))
)
result = repair(
    table,
    recipe,
    json.loads(Path(args.decisions).read_text()) if args.decisions else None,
)
out = Path(args.output)
out.mkdir(parents=True, exist_ok=True)
(out / "cleaned.csv").write_text(result["csv"])
(out / "recipe.json").write_text(json.dumps(recipe, indent=2))
(out / "receipt.json").write_text(json.dumps(result, indent=2))
review = {"fingerprint": result["fingerprint"], "cells": []}
page(
    "CSV Repair Workbench",
    [
        ("Column profile", [{"column": c, **v} for c, v in table["profile"].items()]),
        ("Changed cells", result["changes"]),
        ("Needs review", result["pending"]),
        ("Cleaned table", result["rows"]),
    ],
    out / "review.html",
    review,
)
print(
    json.dumps(
        {
            "changed_cells": len(result["changes"]),
            "pending": len(result["pending"]),
            "output": str(out),
        }
    )
)
