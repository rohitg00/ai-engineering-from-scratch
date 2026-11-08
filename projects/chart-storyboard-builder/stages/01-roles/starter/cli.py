import argparse, json
from pathlib import Path
from main import parse_table, aggregate, annotate, render_svg
from presentation import page

parser = argparse.ArgumentParser()
parser.add_argument("input")
parser.add_argument("--output", required=True)
args = parser.parse_args()
data = json.loads(Path(args.input).read_text())
table = parse_table(data["csv"], data["roles"])
specs = []
out = Path(args.output)
out.mkdir(parents=True, exist_ok=True)
for i, config in enumerate(
    data.get(
        "charts",
        [{"grammar": "bar", "reducer": "sum"}, {"grammar": "line", "reducer": "mean"}],
    ),
    1,
):
    spec = annotate(
        aggregate(
            table,
            config.get("reducer", "sum"),
            data.get("periods"),
            config.get("grammar", "bar"),
        ),
        config.get("annotations", []),
    )
    specs.append(spec)
    (out / f"chart-{i}.svg").write_text(render_svg(spec))
(out / "chart-specs.json").write_text(
    json.dumps({"schema_version": 1, "roles": data["roles"], "charts": specs}, indent=2)
)
page(
    "Chart Storyboard Builder",
    [(f"Chart {i} data receipt", s["points"]) for i, s in enumerate(specs, 1)],
    out / "storyboard.html",
)
html = (out / "storyboard.html").read_text()
html = html.replace(
    "</header>",
    "</header>"
    + "".join(
        (
            f'<section><div class="scroll" tabindex="0" role="region" aria-label="Chart {i}">'
            + render_svg(s)
            .replace('id="title"', f'id="title-{i}"')
            .replace('id="desc"', f'id="desc-{i}"')
            .replace(
                'aria-labelledby="title desc"', f'aria-labelledby="title-{i} desc-{i}"'
            )
            + "</div></section>"
            for i, s in enumerate(specs, 1)
        )
    ),
)
(out / "storyboard.html").write_text(html)
print(
    json.dumps(
        {
            "charts": len(specs),
            "source_rows": len(table["rows"]),
            "missing_values": table["missing"],
        }
    )
)
