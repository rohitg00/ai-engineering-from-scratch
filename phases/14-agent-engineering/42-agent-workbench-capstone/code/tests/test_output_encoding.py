# Generator output follows the agent-workbench capstone's pack contract.
# Source: phases/14-agent-engineering/42-agent-workbench-capstone/docs/en.md.
# UTF-8 is required so generated artifacts remain readable across locales.
# These tests exercise generated files using only Python's standard library.
from __future__ import annotations

import contextlib
import importlib.util
import io
import json
import tempfile
import unittest
from pathlib import Path


LESSON = Path(__file__).resolve().parents[2]


def load_generator():
    source = LESSON / "code" / "main.py"
    spec = importlib.util.spec_from_file_location("workbench_generator", source)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"could not load generator from {source}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def generate_pack(directory: Path):
    generator = load_generator()
    generator.PACK = directory / "agent-workbench-pack"
    with contextlib.redirect_stdout(io.StringIO()):
        generator.main()
    return generator


class GeneratorEncodingTests(unittest.TestCase):
    def test_generated_unicode_files_are_utf8(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            generator = generate_pack(Path(temporary))

            rubric = generator.PACK / "docs" / "reviewer-rubric.md"
            handoff = generator.PACK / "scripts" / "generate_handoff.py"
            expected_rubric = generator.REVIEWER_RUBRIC_MD
            expected_handoff = generator.GENERATE_HANDOFF_PY

            self.assertEqual(rubric.read_text(encoding="utf-8"), expected_rubric)
            self.assertEqual(handoff.read_text(encoding="utf-8"), expected_handoff)

    def test_every_generated_file_decodes_as_utf8(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            generator = generate_pack(Path(temporary))
            files = [path for path in generator.PACK.rglob("*") if path.is_file()]

            self.assertTrue(files)
            for path in files:
                with self.subTest(path=path.relative_to(generator.PACK)):
                    path.read_bytes().decode("utf-8")

    def test_generated_documents_match_their_source_constants(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            generator = generate_pack(Path(temporary))
            expected = {
                "AGENTS.md": generator.AGENTS_MD.format(version=generator.PACK_VERSION),
                "README.md": generator.PACK_README,
                "docs/agent-rules.md": generator.AGENT_RULES_MD,
                "docs/reliability-policy.md": generator.RELIABILITY_POLICY_MD,
                "docs/handoff-protocol.md": generator.HANDOFF_PROTOCOL_MD,
                "docs/reviewer-rubric.md": generator.REVIEWER_RUBRIC_MD,
            }

            for relative, contents in expected.items():
                with self.subTest(path=relative):
                    generated = (generator.PACK / relative).read_text(encoding="utf-8")
                    self.assertEqual(generated, contents)

    def test_generated_schemas_are_valid_json(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            generator = generate_pack(Path(temporary))
            schemas = sorted((generator.PACK / "schemas").glob("*.schema.json"))

            self.assertEqual(len(schemas), 3)
            for path in schemas:
                with self.subTest(path=path.name):
                    self.assertIsInstance(
                        json.loads(path.read_text(encoding="utf-8")), dict
                    )

    def test_generator_is_idempotent(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            generator = generate_pack(Path(temporary))

            def snapshot() -> dict[str, bytes]:
                return {
                    path.relative_to(generator.PACK).as_posix(): path.read_bytes()
                    for path in generator.PACK.rglob("*")
                    if path.is_file()
                }

            first = snapshot()
            with contextlib.redirect_stdout(io.StringIO()):
                generator.main()

            self.assertEqual(snapshot(), first)


if __name__ == "__main__":
    unittest.main()
