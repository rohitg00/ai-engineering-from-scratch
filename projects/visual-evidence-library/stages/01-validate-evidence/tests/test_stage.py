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


from main import validate_manifest


class ManifestTests(unittest.TestCase):
    def test_valid_supplied_region_keeps_provenance(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            a = validate_manifest(fixture(root), root)
            self.assertEqual(a[0]["regions"][0]["origin"], "provided")
            self.assertEqual(a[0]["regions"][0]["bbox"], [10, 10, 170, 40])

    def test_duplicate_asset_and_region_ids_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            m = fixture(root)
            m["assets"].append(copy.deepcopy(m["assets"][0]))
            with self.assertRaises(ValueError):
                validate_manifest(m, root)
            m = fixture(root)
            m["assets"][0]["regions"] *= 2
            with self.assertRaises(ValueError):
                validate_manifest(m, root)

    def test_negative_and_outside_boxes_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for box in (
                [-1, 0, 4, 4],
                [190, 0, 20, 10],
                [0, 0, 0, 5],
                [0, 0, float("nan"), 5],
                [0, True, 4, 4],
            ):
                m = fixture(root)
                m["assets"][0]["regions"][0]["bbox"] = box
                with self.subTest(box=box), self.assertRaises(ValueError):
                    validate_manifest(m, root)

    def test_escape_path_and_symlink_rejected(self):
        with (
            tempfile.TemporaryDirectory() as tmp,
            tempfile.TemporaryDirectory() as outside,
        ):
            root = Path(tmp)
            external = Path(outside) / "outside.svg"
            external.write_text("<svg/>")
            m = fixture(root)
            m["assets"][0]["path"] = str(external)
            with self.assertRaises(ValueError):
                validate_manifest(m, root)
            (root / "link.svg").symlink_to(external)
            m["assets"][0]["path"] = "link.svg"
            with self.assertRaises(ValueError):
                validate_manifest(m, root)

    def test_model_region_requires_explicit_review(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            m = fixture(root)
            m["assets"][0]["regions"][0]["origin"] = "model-proposed"
            with self.assertRaises(ValueError):
                validate_manifest(m, root)
            m["assets"][0]["regions"][0]["reviewed"] = True
            self.assertEqual(len(validate_manifest(m, root)), 1)

    def test_missing_file_boolean_dimension_and_empty_text(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for field, value in [
                ("path", "absent.png"),
                ("width", True),
                ("height", 0),
            ]:
                m = fixture(root)
                m["assets"][0][field] = value
                with self.subTest(field=field), self.assertRaises(ValueError):
                    validate_manifest(m, root)
            m = fixture(root)
            m["assets"][0]["regions"][0]["text"] = " "
            with self.assertRaises(ValueError):
                validate_manifest(m, root)
