import shutil
import subprocess
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path
from unittest.mock import patch

import build_book


ROOT = Path(__file__).resolve().parents[1]
FILTER = ROOT / "book" / "literal-tokens.lua"
MATH_FILTER = ROOT / "book" / "math-blocks.lua"
PDF_SOURCE_FORMAT = "markdown+fenced_divs+autolink_bare_uris"
LONG_LINES = """# Wrapping regression

```python
message = "Every sample in the batch must be pre-padded with the same number of image placeholders before replacing them with projected image embeddings."
identifier = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
```

```text
This plain-text code block must also wrap its long lines without losing the final marker: PLAIN_TEXT_END.
```

Further reading: (http://neuralnetworksanddeeplearning.com/). Keep the URL clickable.

- PaddleOCR is mature, fast, and multilingual. One-line usage: `paddleocr.PaddleOCR(lang="en").ocr(image_path)`.
- A long MCP identifier: `params._meta.io.modelcontextprotocol/protocolVersion`.

| Leaderboard | Tracks | URL |
| --- | --- | --- |
| Open ASR Leaderboard | English and multilingual | `huggingface.co/spaces/hf-audio/open_asr_leaderboard` |
| TTS Arena | English TTS | `huggingface.co/spaces/TTS-AGI/TTS-Arena` |
| Escaping | Literal symbols | `{value}#100%_ok` |
| Unicode | Literal multiplication | `k × sr / N` |

| Mistake | Why it is bad | Fix |
| --- | --- | --- |
| Fitting on full data before splitting | Data leakage | Use Pipeline with cross_val_score |
| Feature engineering outside the pipeline | Different transforms at train vs serve | Put all transforms in the Pipeline |
| Not handling unknown categories | Production crash on new values | OneHotEncoder(handle_unknown="ignore") |
| Hardcoded column names | Breaks when features change | Use column lists from config |
| No data validation | Silently wrong predictions | Add schema checks before prediction |
| Training/serving skew | Model sees different features in prod | One Pipeline object for both |
| A long plain identifier | Must remain readable in a narrow table cell | Abcdefghijklmnopqrstuvwxyz0123456789Abcdefghijklmnopqrstuvwxyz0123456789 |
"""


def render(source, output="html", lua_filter=FILTER):
    return subprocess.run(
        ["pandoc", "--from", "markdown+fenced_divs", "--to", output,
         "--lua-filter", str(lua_filter)],
        input=source, text=True, capture_output=True, check=True,
    ).stdout


class BookRenderingTest(unittest.TestCase):
    def test_math_fences_and_dollar_math_render_as_math_and_money_stays_text(self):
        source = ("Costs \\$5 or $21-$50 per hour. The slope is $f'(x) = 2x$.\n\n"
                  "```math\n\\frac{a}{b} \\\\ c\n```\n\n```text\nx = $1$\n```\n")
        result = render(source, "latex", MATH_FILTER)
        self.assertIn(r"\(f'(x) = 2x\)", result)
        self.assertIn(r"\[\frac{a}{b} \\ c\]", result)
        self.assertIn(r"\$5 or \$21-\$50 per hour", result)
        self.assertIn(r"\NormalTok{x = $1$}", result)

    def test_literal_tokens_remain_text_in_valid_xhtml(self):
        source = 'Prompt: "<image A> caption <image B>". Replace a name with "<PERSON>".\n\n'
        source += '| Token | Meaning |\n| --- | --- |\n| <image> | Image |\n| <doc A> | Context |\n'
        root = ET.fromstring("<div>" + render(source) + "</div>")
        text = "".join(root.itertext())
        for token in ("<image>", "<image A>", "<image B>", "<PERSON>", "<doc A>"):
            self.assertIn(token, text)

    def test_code_and_real_html_are_unchanged(self):
        source = 'Keep `<image>` and <em>emphasis</em>.\n\n```text\n<PERSON> <doc A>\n```\n'
        result = render(source)
        root = ET.fromstring("<div>" + result + "</div>")
        self.assertEqual(root.find("p/code").text, "<image>")
        self.assertEqual(root.find("p/em").text, "emphasis")
        self.assertEqual(root.find("pre/code").text.strip(), "<PERSON> <doc A>")

    def test_pdf_input_retains_literal_tokens(self):
        result = render('"<image A>" "<PERSON>" "<doc A>"', "latex")
        for token in ("image A", "PERSON", "doc A"):
            self.assertIn(token, result)
        self.assertEqual(result.count(r"\textless"), 3)
        self.assertEqual(result.count(r"\textgreater"), 3)

    def test_table_breaks_only_long_ascii_tokens(self):
        layout = ROOT / "book" / "pdf-layout.lua"
        for token in ("Abcdefghijklmnopqrstuvwxyz0123456789", "package.module.LongIdentifier123"):
            with self.subTest(token=token):
                source = f"| Value |\n| --- |\n| {token} |\n"
                result = render(source, "latex", layout)
                self.assertIn(r"\allowbreak{}", result)
                self.assertIn(token, result.replace(r"\allowbreak{}", ""))
                self.assertEqual(render(source, "html", layout), render(source, "html"))
        for token in ("short/path", "prefix_" + "e\u0301" * 12,
                      "prefix_" + "👩\u200d💻" * 4, "prefix_" + "x\ufe0f" * 12):
            with self.subTest(token=token):
                source = f"| Value |\n| --- |\n| {token} |\n"
                self.assertEqual(render(source, "latex", layout), render(source, "latex"))

    def test_requested_pdf_failure_fails_the_build(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.multiple(build_book, BUILD=Path(directory), DIST=Path(directory)), \
                 patch.object(build_book, "git_date", return_value="2026-09-07"), \
                 patch.object(build_book, "git_edition", return_value="2026.09"), \
                 patch.object(build_book, "pick_font", return_value=None), \
                 patch.object(build_book.subprocess, "run", side_effect=[
                     None, subprocess.CalledProcessError(43, "pandoc"),
                 ]):
                with self.assertRaises(subprocess.CalledProcessError):
                    build_book.render(build_book.CONFIG["volumes"][0], Path("fixture.md"), 1, pdf=True)

    @unittest.skipUnless(shutil.which("xelatex") and shutil.which("pdftotext"),
                         "PDF layout check requires xelatex and pdftotext")
    def test_pdf_long_code_and_urls_stay_inside_margins(self):
        with tempfile.TemporaryDirectory() as directory:
            pdf = Path(directory) / "wrapping.pdf"
            result = subprocess.run(
                ["pandoc", "--from", PDF_SOURCE_FORMAT, "--pdf-engine=xelatex",
                 "--lua-filter", str(ROOT / "book" / "pdf-layout.lua"),
                 "--include-in-header", str(ROOT / "book" / "theme.tex"),
                 "-V", "documentclass=book", "-V", "geometry=margin=1in",
                 "-o", str(pdf)],
                input=LONG_LINES, text=True, capture_output=True,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            bbox = subprocess.check_output(["pdftotext", "-bbox", str(pdf), "-"], text=True)
        root = ET.fromstring(bbox)
        ns = {"x": "http://www.w3.org/1999/xhtml"}
        for page in root.findall(".//x:page", ns):
            right = float(page.attrib["width"]) - 72
            for word in page.findall(".//x:word", ns):
                self.assertGreaterEqual(float(word.attrib["xMin"]), 71, word.text)
                self.assertLessEqual(float(word.attrib["xMax"]), right + 1, word.text)
        text = "".join(word.text or "" for word in root.findall(".//x:word", ns))
        for marker in ("embeddings.", "PLAIN_TEXT_END.", "neuralnetworksanddeeplearning.com",
                       "open_asr_leaderboard", "TTS-Arena", "{value}#100%_ok", "k×sr/N",
                       'paddleocr.PaddleOCR(lang="en").ocr(image_path)', "protocolVersion"):
            self.assertIn(marker, text)
        self.assertIn("OneHotEncoder(handle_unknown=", text)
        self.assertIn("Abcdefghijklmnopqrstuvwxyz0123456789" * 2, text)


if __name__ == "__main__":
    unittest.main()
