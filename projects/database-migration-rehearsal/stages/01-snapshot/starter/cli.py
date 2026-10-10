import argparse, json, sqlite3
from pathlib import Path
from main import receipt
from presentation import page

parser = argparse.ArgumentParser()
parser.add_argument("input")
parser.add_argument("--output", required=True)
args = parser.parse_args()
source = Path(args.input).resolve()
data = json.loads(source.read_text())
out = Path(args.output).resolve()
out.mkdir(parents=True, exist_ok=True)
if "database" in data:
    database = (source.parent / data["database"]).resolve()
else:
    database = out / "authored-sample.sqlite"
    if not database.exists():
        c = sqlite3.connect(database)
        c.execute("CREATE TABLE attendees(id INTEGER PRIMARY KEY, name TEXT NOT NULL)")
        c.executemany("INSERT INTO attendees VALUES (?,?)", [(1, "Ada"), (2, "Mira")])
        c.commit()
        c.close()
if database in {out / "rehearsal.json", out / "schema-diff.json", out / "review.html"}:
    raise ValueError("output artifacts would overwrite the source database")
result = receipt(
    database, data["migration"], data["rollback"], data.get("invariants", [])
)
(out / "rehearsal.json").write_text(json.dumps(result, indent=2))
(out / "schema-diff.json").write_text(json.dumps(result["schema_diff"], indent=2))
page(
    "Database Migration Rehearsal",
    [
        (
            "Release evidence",
            [
                {
                    "forward_applied": result["applied"],
                    "rollback_reversible": result["reversible"],
                    "release_ready": result["release_ready"],
                    "forward_error": result["error"],
                    "rollback_error": result["rollback_error"],
                }
            ],
        ),
        ("Schema changes", result["schema_diff"]),
        ("Invariants", result["invariant_results"]),
        (
            "Before tables",
            [{"table": k, **v} for k, v in result["before"]["tables"].items()],
        ),
        (
            "After tables",
            [{"table": k, **v} for k, v in result["after"]["tables"].items()],
        ),
    ],
    out / "review.html",
)
print(
    json.dumps(
        {
            "applied": result["applied"],
            "reversible": result["reversible"],
            "release_ready": result["release_ready"],
        }
    )
)
