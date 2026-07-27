import importlib.util
import tempfile
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).parents[1] / "export_turkish_curriculum.py"
SPEC = importlib.util.spec_from_file_location("export_tr", MODULE_PATH)
export_tr = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(export_tr)


class ExportTurkishCurriculumTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.source = Path(self.temp.name) / "source"
        lesson = self.source / "phases/00-test/01-lesson"
        (lesson / "docs").mkdir(parents=True)
        (lesson / "docs/en.md").write_text("# English\n")
        (lesson / "docs/tr.md").write_text("# Türkçe\n")
        (lesson / "code").mkdir()
        (lesson / "code/main.py").write_text("print('ok')\n")
        (lesson / "quiz.json").write_text("{}\n")
        (self.source / "phases/00-test/README.tr.md").write_text("# Aşama 00\n")
        (self.source / "docs").mkdir()
        (self.source / "docs/turkish-export-sync.md").write_text("# Sync\n")
        (self.source / "LICENSE").write_text("MIT\n")

    def tearDown(self):
        self.temp.cleanup()

    def test_export_keeps_required_content_and_excludes_english(self):
        target = Path(self.temp.name) / "target"
        report = export_tr.export(self.source, target, "abc123")
        self.assertEqual(report["coverage_percent"], 100.0)
        self.assertTrue((target / "phases/00-test/01-lesson/code/main.py").is_file())
        self.assertFalse((target / "phases/00-test/01-lesson/docs/en.md").exists())

    def test_generated_readme_is_a_complete_turkish_entry_point(self):
        target = Path(self.temp.name) / "target"
        export_tr.export(self.source, target, "abc123")
        readme = (target / "README.md").read_text()
        self.assertIn("1 aşama", readme)
        self.assertIn("1 Türkçe ders", readme)
        self.assertIn("## Hızlı başlangıç", readme)
        self.assertIn("## Öğrenme rotası", readme)
        self.assertIn("## Bir ders nasıl çalışılır?", readme)
        self.assertIn("## Dağıtım güvenceleri", readme)
        self.assertIn("`abc123`", readme)
        self.assertIn("assets/turkcelestirilmis-rgb.svg", readme)

        banner = (target / "assets/turkcelestirilmis-rgb.svg").read_text()
        self.assertIn("TÜRKÇELEŞTİRİLMİŞ", banner)
        self.assertIn('id="rgb"', banner)
        self.assertIn('repeatCount="indefinite"', banner)

    def test_export_refuses_existing_destination(self):
        target = Path(self.temp.name) / "target"
        target.mkdir()
        with self.assertRaises(ValueError):
            export_tr.export(self.source, target, "abc123")

    def test_validation_rejects_broken_internal_link(self):
        target = Path(self.temp.name) / "target"
        export_tr.export(self.source, target, "abc123")
        (target / "bad.md").write_text("[yok](missing.md)\n")
        with self.assertRaises(ValueError):
            export_tr.validate(target, 1, "abc123")

    def test_archives_are_reproducible(self):
        target = Path(self.temp.name) / "target"
        export_tr.export(self.source, target, "abc123")
        first = Path(self.temp.name) / "first.tar.gz"
        second = Path(self.temp.name) / "second.tar.gz"
        export_tr.archive_tree(target, first)
        export_tr.archive_tree(target, second)
        self.assertEqual(first.read_bytes(), second.read_bytes())


if __name__ == "__main__":
    unittest.main()
