import argparse, json
from pathlib import Path
from main import validate, export_plan, shortages
from presentation import page

parser = argparse.ArgumentParser()
parser.add_argument("input")
parser.add_argument("--output", required=True)
parser.add_argument("--decisions")
args = parser.parse_args()
data = json.loads(Path(args.input).read_text())
if args.decisions:
    data["participants"] = json.loads(Path(args.decisions).read_text())["participants"]
model = validate(data)
result = export_plan(model, data.get("compare", [8, 12]))
out = Path(args.output)
out.mkdir(parents=True, exist_ok=True)
(out / "packing-list.csv").write_text(result["csv"])
(out / "shortages.json").write_text(json.dumps(result, indent=2))
page(
    "Workshop Materials Planner",
    [
        ("Packing list", result["packing"]),
        (
            "Participant comparisons",
            [
                {
                    "participants": s["participants"],
                    "shortages": {x["name"]: x["shortage"] for x in s["packing"]},
                }
                for s in result["scenarios"]
            ],
        ),
    ],
    out / "planner.html",
    {"participants": model["participants"]},
)
scenarios = {str(n): shortages(model, n) for n in range(101)}
payload = json.dumps(scenarios).replace("<", "\\u003c")
extra = (
    '<section><h2>Try a participant count</h2><label for="participants">Participants (0 to 100) </label><input type="range" id="participants" min="0" max="100" value="'
    + str(min(100, model["participants"]))
    + '"><output id="whatif" aria-live="polite"></output></section><script>const scenarios='
    + payload
    + ';const slider=document.querySelector("#participants");function update(){const rows=scenarios[slider.value];document.querySelector("#whatif").textContent=slider.value+" participants: "+rows.map(r=>r.name+" needs "+r.required+" "+r.unit+"; shortage "+(r.shortage===null?"unknown":r.shortage)).join(". ");document.querySelector("#decisions").value=JSON.stringify({participants:Number(slider.value)},null,2);}slider.addEventListener("input",update);update();</script>'
)
html = (out / "planner.html").read_text()
(out / "planner.html").write_text(html.replace("</body>", extra + "</body>"))
print(
    json.dumps(
        {
            "participants": result["participants"],
            "uncertain_items": result["uncertain_items"],
        }
    )
)
