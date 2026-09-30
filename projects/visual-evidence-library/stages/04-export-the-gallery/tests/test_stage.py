import copy
import json
import tempfile
import unittest
from pathlib import Path


def fixture(root):
    (root / "notice.svg").write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><text x="10" y="30">Bicycle repairs</text></svg>'
    )
    return {
        "assets": [
            {
                "id": "notice",
                "path": "notice.svg",
                "width": 200,
                "height": 100,
                "regions": [
                    {
                        "id": "text",
                        "text": "Bicycle repairs on Thursday",
                        "bbox": [10, 10, 170, 40],
                        "origin": "provided",
                    }
                ],
            }
        ]
    }


import base64
from main import validate_manifest, export_library, image_data


class GalleryTests(unittest.TestCase):
    def test_html_is_portable_and_overlay_has_scaled_coordinates(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            assets = validate_manifest(fixture(root), root)
            export_library(assets, "bicycle", root / "out")
            page = (root / "out/index.html").read_text()
            self.assertIn("data:image/svg+xml;base64,", page)
            self.assertIn("left:5.0%", page)
            self.assertIn("width:85.0%", page)

    def test_json_keeps_pixels_and_excludes_resolved_paths(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            assets = validate_manifest(fixture(root), root)
            export_library(assets, "bicycle", root / "out")
            r = json.loads((root / "out/evidence.json").read_text())
            self.assertNotIn("resolved_path", r["assets"][0])
            self.assertEqual(r["matches"][0]["bbox"], [10, 10, 170, 40])
            self.assertIn("no built-in OCR", r["method"])

    def test_text_and_query_are_escaped(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            m = fixture(root)
            m["assets"][0]["regions"][0]["text"] = "Bicycle <script>alert(1)</script>"
            export_library(validate_manifest(m, root), "bicycle <img>", root / "out")
            page = (root / "out/index.html").read_text()
            self.assertNotIn("<script>", page)
            self.assertIn("&lt;script&gt;", page)
            self.assertIn("&lt;img&gt;", page)

    def test_unmatched_query_has_explicit_empty_state(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            r = export_library(
                validate_manifest(fixture(root), root), "cooking", root / "out"
            )
            self.assertEqual(r["matches"], [])
            self.assertIn(
                "No matching evidence regions.", (root / "out/index.html").read_text()
            )

    def test_svg_script_element_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            m = fixture(root)
            (root / "notice.svg").write_text(
                '<svg xmlns="http://www.w3.org/2000/svg"><script>bad()</script></svg>'
            )
            a = validate_manifest(m, root)
            with self.assertRaises(ValueError):
                image_data(a[0])

    def test_svg_event_and_external_reference_attributes_removed(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            m = fixture(root)
            (root / "notice.svg").write_text(
                '<svg xmlns="http://www.w3.org/2000/svg" onload="bad()"><text x="1" y="2" onclick="bad()" fill="url(https://example.invalid/a)">Bicycle</text></svg>'
            )
            uri = image_data(validate_manifest(m, root)[0])
            svg = base64.b64decode(uri.split(",")[1]).decode()
            self.assertNotIn("onload", svg)
            self.assertNotIn("onclick", svg)
            self.assertNotIn("url(", svg)
