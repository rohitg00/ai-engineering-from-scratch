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
        (lesson / "docs/tr.md").write_text(
            "# Türkçe\n\n```mermaid\nflowchart LR\n  A --> B\n```\n"
        )
        (lesson / "code").mkdir()
        (lesson / "code/main.py").write_text("print('ok')\n")
        (lesson / "quiz.json").write_text("{}\n")
        (self.source / "phases/00-test/README.tr.md").write_text("# Aşama 00\n")
        (self.source / "docs").mkdir()
        (self.source / "docs/turkish-export-sync.md").write_text("# Sync\n")
        site = self.source / "site"
        site.mkdir()
        source_site = MODULE_PATH.parents[1] / "site"
        for name in export_tr.SITE_FILES:
            (site / name).write_text(
                (source_site / name).read_text(encoding="utf-8"), encoding="utf-8"
            )
        for name in ("index.html", "lesson.html"):
            (site / name).write_text(
                (source_site / name).read_text(encoding="utf-8"), encoding="utf-8"
            )
        (self.source / "LICENSE").write_text(
            "MIT License\n\nCopyright (c) 2026 Rohit Ghumare\n"
        )

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
        self.assertIn("## Bu müfredat kimin için?", readme)
        self.assertIn("## Hızlı başlangıç", readme)
        self.assertIn("### 2. Depo klasörüne girin", readme)
        self.assertIn("cd ai-engineering-from-scratch-tr", readme)
        self.assertIn("### 3. Yerel siteyi başlatın", readme)
        self.assertIn("python3 -m http.server 8000", readme)
        self.assertIn("### 4. Tarayıcıda açın", readme)
        self.assertIn("http://localhost:8000", readme)
        self.assertIn("## Size uygun rota", readme)
        self.assertIn("## Öğrenme rotası", readme)
        self.assertIn("## Bir ders nasıl çalışılır?", readme)
        self.assertIn("## Dağıtım güvenceleri", readme)
        self.assertIn("## Kaynak ve atıf", readme)
        self.assertIn("## Sık sorulan sorular", readme)
        self.assertIn(
            "https://github.com/rohitg00/ai-engineering-from-scratch", readme
        )
        self.assertIn("Copyright (c) 2026 Rohit Ghumare", readme)
        self.assertIn("`abc123`", readme)
        self.assertIn("assets/turkce-mufredat-v2.svg", readme)
        self.assertEqual(
            (target / "LICENSE").read_text(),
            (self.source / "LICENSE").read_text(),
        )

        banner = (target / "assets/turkce-mufredat-v2.svg").read_text()
        self.assertIn("TÜRKÇE", banner)
        self.assertIn("20 AŞAMA", banner)
        self.assertIn("503 DERS", banner)
        self.assertNotIn("435 DERS", banner)
        self.assertNotIn("<animate", banner)

        local_site = (target / "index.html").read_text()
        self.assertIn('<html lang="tr"', local_site)
        self.assertIn("Müfredatın tamamı", local_site)
        self.assertIn("ai-engineering-from-scratch-tr.git", local_site)
        self.assertIn('href="https://github.com/ademiru"', local_site)
        self.assertIn("@ademiru GitHub", local_site)
        self.assertLess(
            local_site.index("GitHub'da yıldızla"),
            local_site.index("@ademiru GitHub"),
        )
        self.assertNotIn("va.vercel-scripts.com", local_site)

        lesson_site = (target / "lesson.html").read_text()
        self.assertIn("lesson-sidebar", lesson_site)
        self.assertIn("lesson-nav-bottom", lesson_site)
        self.assertIn("renderQuiz", lesson_site)
        self.assertIn("mermaid-modal-overlay", lesson_site)
        self.assertIn("path + '/docs/tr.md'", lesson_site)
        self.assertNotIn("path + '/docs/en.md'", lesson_site)

        data = (target / "data.js").read_text()
        self.assertIn('"name":"Türkçe"', data)
        self.assertIn('"lang":"Türkçe"', data)
        self.assertIn('"url":"phases/00-test/01-lesson/"', data)
        self.assertTrue((target / ".nojekyll").is_file())
        self.assertTrue((target / "style.css").is_file())
        self.assertTrue((target / "progress.js").is_file())

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
