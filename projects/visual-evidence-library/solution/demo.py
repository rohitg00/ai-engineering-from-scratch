import json
import tempfile
from pathlib import Path
from main import validate_manifest, export_library

fixture = Path(__file__).parent / "fixtures/manifest.json"
assets = validate_manifest(json.loads(fixture.read_text()), fixture.parent)
with tempfile.TemporaryDirectory() as directory:
    report = export_library(assets, "return dry seeds", Path(directory))
    print("Search original signs using explicitly supplied text rectangles:")
    for row in report["matches"]:
        print(
            f"{row['asset_id']}/{row['region_id']}: {row['score']:.0%} query coverage | {row['bbox']}"
        )
        print("  " + row["text"])
    print("No OCR ran. Every result points to provided evidence metadata.")
    print(
        'Run python3 main.py --query "return dry seeds" --out ./visual-output to keep the portable HTML gallery.'
    )
