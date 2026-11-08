from __future__ import annotations

import ast
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

CODE = Path(__file__).resolve().parents[1]
LESSON = CODE.parent
COMMITTED = LESSON / "outputs" / "agent-workbench-pack"
TEXT_CALLS = {"open", "read_text", "write_text"}


def generate(target: Path) -> subprocess.CompletedProcess[str]:
    program = (
        "import sys; from pathlib import Path; "
        f"sys.path.insert(0, {str(CODE)!r}); "
        "import main; main.main(Path(sys.argv[1]))"
    )
    return subprocess.run(
        [sys.executable, "-X", "warn_default_encoding", "-W", "error::EncodingWarning", "-c", program, str(target)],
        capture_output=True,
        text=True,
        encoding="utf-8",
    )


def calls_without_encoding(source: str) -> list[str]:
    missing = []
    for node in ast.walk(ast.parse(source)):
        if not isinstance(node, ast.Call):
            continue
        func = node.func
        name = func.attr if isinstance(func, ast.Attribute) else getattr(func, "id", "")
        keywords = {keyword.arg for keyword in node.keywords}
        text_mode = name == "run" and "text" in keywords
        if (name in TEXT_CALLS or text_mode) and "encoding" not in keywords:
            if name == "open" and any(isinstance(arg, ast.Constant) and "b" in str(arg.value) for arg in node.args):
                continue
            missing.append(f"line {node.lineno}: {name}")
    return missing


class GeneratedPackEncodingTest(unittest.TestCase):
    def test_generator_writes_utf8_without_locale_default(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            pack = Path(tmp) / "outputs" / "agent-workbench-pack"
            result = generate(pack)
            self.assertEqual(result.returncode, 0, result.stderr)
            generated = sorted(path.relative_to(pack) for path in pack.rglob("*") if path.is_file())
            committed = sorted(path.relative_to(COMMITTED) for path in COMMITTED.rglob("*") if path.is_file())
            self.assertEqual(generated, committed)
            unicode_files = 0
            for relative in generated:
                data = (pack / relative).read_bytes()
                text = data.decode("utf-8")
                unicode_files += any(ord(char) > 127 for char in text)
                self.assertEqual(data, (COMMITTED / relative).read_bytes(), str(relative))
            self.assertGreater(unicode_files, 0)

    def test_generator_and_generated_scripts_name_their_encoding(self) -> None:
        sources = [CODE / "main.py", *sorted((COMMITTED / "scripts").glob("*.py"))]
        for source in sources:
            with self.subTest(source=source.name):
                self.assertEqual(calls_without_encoding(source.read_text(encoding="utf-8")), [])

    def test_checker_flags_text_io_without_encoding(self) -> None:
        source = "from pathlib import Path\nPath('a').write_text('x')\nPath('a').read_text()\nopen('a', 'w')\n"
        self.assertEqual(calls_without_encoding(source), ["line 2: write_text", "line 3: read_text", "line 4: open"])

    def test_checker_flags_text_mode_subprocess_without_encoding(self) -> None:
        source = "import subprocess\nsubprocess.run(['ls'], text=True)\nsubprocess.run(['ls'])\n"
        self.assertEqual(calls_without_encoding(source), ["line 2: run"])

    def test_checker_accepts_binary_and_explicit_encodings(self) -> None:
        source = (
            "from pathlib import Path\n"
            "open('a', 'rb')\n"
            "Path('a').write_text('x', encoding='utf-8')\n"
            "open('a', 'a', encoding='utf-8')\n"
        )
        self.assertEqual(calls_without_encoding(source), [])


if __name__ == "__main__":
    unittest.main()
