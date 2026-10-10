import argparse, json
from pathlib import Path
from main import load_plan, explain
from presentation import page

parser = argparse.ArgumentParser()
parser.add_argument("input")
parser.add_argument("--output", required=True)
args = parser.parse_args()
data = json.loads(Path(args.input).read_text())
result = explain(load_plan(data))
out = Path(args.output)
out.mkdir(parents=True, exist_ok=True)
(out / "change-brief.md").write_text(result["markdown"])
(out / "resource-impact.json").write_text(json.dumps(result, indent=2))
page(
    "Infrastructure Plan Explainer",
    [
        ("Resource changes", result["resources"]),
        ("Declared dependency edges", result["graph"]["edges"]),
        ("Unresolved references", result["graph"]["unresolved"]),
    ],
    out / "review.html",
)
print(
    json.dumps(
        {"resources": len(result["resources"]), "edges": len(result["graph"]["edges"])}
    )
)
