import argparse, json
from pathlib import Path
from main import parse_vtt, propose, export_localized
from presentation import page

parser = argparse.ArgumentParser()
parser.add_argument("input")
parser.add_argument("--output", required=True)
parser.add_argument("--decisions")
args = parser.parse_args()
data = json.loads(Path(args.input).read_text())
proposals = propose(
    parse_vtt(data["vtt"]), data.get("translations", {}), data.get("glossary", {})
)
result = export_localized(
    proposals,
    json.loads(Path(args.decisions).read_text()) if args.decisions else None,
    data.get("cps", 17),
)
out = Path(args.output)
out.mkdir(parents=True, exist_ok=True)
(out / "translation-decisions.json").write_text(
    json.dumps(result, indent=2, ensure_ascii=False)
)
if result["vtt"]:
    (out / "reviewed.vtt").write_text(result["vtt"])
elif (out / "reviewed.vtt").exists():
    (out / "reviewed.vtt").unlink()
page(
    "Subtitle Localization Desk",
    [
        (
            "Bilingual cue review",
            [
                {
                    k: result[k]
                    for k in (
                        "id",
                        "start",
                        "end",
                        "text",
                        "proposed",
                        "characters",
                        "budget",
                        "flags",
                        "approved",
                    )
                }
                for result in result["cues"]
            ],
        )
    ],
    out / "review.html",
    {
        "fingerprint": result["fingerprint"],
        "cues": {
            c["id"]: {"text": c["proposed"], "approved": False} for c in result["cues"]
        },
    },
)
print(
    json.dumps(
        {
            "cues": len(result["cues"]),
            "all_reviewed": result["all_reviewed"],
            "vtt_written": result["vtt"] is not None,
        }
    )
)
