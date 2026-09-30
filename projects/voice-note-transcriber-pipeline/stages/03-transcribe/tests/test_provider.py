import io
import json
import unittest
from unittest.mock import patch
from pcm import encode_wav
from provider import http_recognizer
from transcribe import transcribe


class RecognizerTests(unittest.TestCase):
    def test_multipart_contains_real_wav_and_model(self):
        wav = encode_wav([0.1] * 50)
        with patch(
            "urllib.request.OpenerDirector.open",
            return_value=io.BytesIO(b'{"text":"A held-out sentence."}'),
        ) as opened:
            text = http_recognizer(
                "http://localhost:8080/audio/transcriptions", "local-asr"
            )(wav)
            request = opened.call_args.args[0]
            self.assertEqual(text, "A held-out sentence.")
            self.assertEqual(request.get_method(), "POST")
            self.assertIn(wav, request.data)
            self.assertIn(b"local-asr", request.data)
            self.assertIn("multipart/form-data", request.headers["Content-type"])

    def test_empty_provider_text_is_rejected(self):
        with (
            patch("urllib.request.OpenerDirector.open", return_value=io.BytesIO(b'{"text":" "}')),
            self.assertRaises(ValueError),
        ):
            http_recognizer("http://localhost/asr")(encode_wav([0]))

    def test_non_http_and_bad_audio_fail(self):
        with self.assertRaises(ValueError):
            http_recognizer("file:///tmp/audio")
        with self.assertRaises(ValueError):
            http_recognizer("https://example.invalid/asr")(b"not WAV")

    def test_overlapping_spans_and_fractional_indices_fail(self):
        for spans in ([(0, 8), (5, 10)], [(0.5, 8)]):
            with self.subTest(spans=spans), self.assertRaises(ValueError):
                transcribe([0.1] * 10, 1000, spans, lambda _: "text")

    def test_retry_bounds_are_explicit(self):
        for retries in (-1, 6, True, 1.5):
            with self.subTest(retries=retries), self.assertRaises(ValueError):
                transcribe([0.1], 1000, [(0, 1)], lambda _: "text", retries)
