import json
import tempfile
import unittest
from pathlib import Path
from pcm import encode_wav
from captions import captions, stamp
from pipeline import export_transcript


class CaptionExportTests(unittest.TestCase):
    def test_export_contains_audio_and_portable_captions(self):
        with tempfile.TemporaryDirectory() as tmp:
            r = export_transcript(
                encode_wav([0.1] * 1000, 1000),
                [{"start": 0, "end": 1, "text": "Held-out audio text"}],
                Path(tmp),
                "supplied reference",
            )
            self.assertEqual(r["duration_seconds"], 1)
            self.assertTrue((Path(tmp) / "audio.wav").exists())
            self.assertIn("00:00:01.000", (Path(tmp) / "captions.vtt").read_text())
            self.assertIn(
                "data:audio/wav;base64,", (Path(tmp) / "index.html").read_text()
            )

    def test_cue_text_cannot_inject_html(self):
        with tempfile.TemporaryDirectory() as tmp:
            export_transcript(
                encode_wav([0.1] * 1000, 1000),
                [{"start": 0, "end": 1, "text": "<img src=x onerror=bad()> "}],
                Path(tmp),
                "test",
            )
            page = (Path(tmp) / "index.html").read_text()
            self.assertIn("&lt;img", page)
            self.assertNotIn("<img src=x", page)

    def test_cue_beyond_audio_fails_before_writing(self):
        with tempfile.TemporaryDirectory() as tmp, self.assertRaises(ValueError):
            export_transcript(
                encode_wav([0.1] * 1000, 1000),
                [{"start": 0, "end": 2, "text": "too long"}],
                Path(tmp),
                "test",
            )

    def test_nonfinite_timestamps_and_empty_text_fail(self):
        for seconds in (float("nan"), float("inf"), -1):
            with self.subTest(seconds=seconds), self.assertRaises(ValueError):
                stamp(seconds)
        with self.assertRaises(ValueError):
            captions([{"start": 0, "end": 1, "text": ""}])

    def test_json_preserves_evidence_method(self):
        with tempfile.TemporaryDirectory() as tmp:
            export_transcript(
                encode_wav([0.1] * 1000, 1000),
                [{"start": 0, "end": 1, "text": "Sentence"}],
                Path(tmp),
                "supplied reference, not recognized",
            )
            r = json.loads((Path(tmp) / "transcript.json").read_text())
            self.assertIn("not recognized", r["method"])
            self.assertEqual(len(r["audio_sha256"]), 64)
