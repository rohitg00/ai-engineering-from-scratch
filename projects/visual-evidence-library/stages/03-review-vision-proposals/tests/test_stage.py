import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from main import validate_proposal, request_vision


class ProposalTests(unittest.TestCase):
    def proposal(self):
        return {
            "regions": [{"text": "Pump station", "bbox": [1, 2, 10, 5]}],
            "labels": ["sign"],
        }

    def test_text_and_labels_stay_separate(self):
        p = validate_proposal(self.proposal(), 100, 100)
        self.assertEqual(p["classification_labels"], ["sign"])
        self.assertFalse(p["regions"][0]["reviewed"])
        self.assertEqual(p["regions"][0]["origin"], "model-proposed")
        self.assertEqual(p["status"], "review-required")

    def test_outside_and_nonfinite_coordinates_rejected(self):
        for box in (
            [99, 1, 5, 5],
            [1, 1, -1, 5],
            [1, 1, float("inf"), 5],
            [True, 1, 5, 5],
        ):
            p = self.proposal()
            p["regions"][0]["bbox"] = box
            with self.subTest(box=box), self.assertRaises(ValueError):
                validate_proposal(p, 100, 100)

    def test_empty_text_and_nonstring_labels_rejected(self):
        p = self.proposal()
        p["regions"][0]["text"] = ""
        with self.assertRaises(ValueError):
            validate_proposal(p, 100, 100)
        p = self.proposal()
        p["labels"] = [5]
        with self.assertRaises(ValueError):
            validate_proposal(p, 100, 100)

    def test_empty_regions_are_not_invented(self):
        self.assertEqual(validate_proposal({"regions": []}, 50, 50)["regions"], [])

    def test_actual_request_serializes_image_and_model(self):
        with tempfile.TemporaryDirectory() as tmp:
            image = Path(tmp) / "test.png"
            image.write_bytes(b"\x89PNG\r\n\x1a\nfixture-only")
            raw = json.dumps(
                {"choices": [{"message": {"content": json.dumps(self.proposal())}}]}
            ).encode()
            with patch(
                "urllib.request.urlopen", return_value=io.BytesIO(raw)
            ) as opened:
                result = request_vision(
                    image,
                    "http://localhost:1234/v1/chat/completions",
                    "vision-test",
                    100,
                    100,
                )
                request = opened.call_args.args[0]
                payload = json.loads(request.data)
                self.assertEqual(payload["model"], "vision-test")
                self.assertTrue(
                    payload["messages"][0]["content"][1]["image_url"]["url"].startswith(
                        "data:image/png;base64,"
                    )
                )
                self.assertEqual(request.get_method(), "POST")
                self.assertFalse(result["regions"][0]["reviewed"])

    def test_bad_image_and_non_http_endpoint_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            image = Path(tmp) / "test.png"
            image.write_bytes(b"not an image")
            with self.assertRaises(ValueError):
                request_vision(image, "http://localhost:1234/chat", "m", 100, 100)
            with self.assertRaises(ValueError):
                request_vision(image, "file:///data", "m", 100, 100)
