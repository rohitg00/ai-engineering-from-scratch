"""Tests for the paper writer: skeleton render, figure injection, validation gates, manifest contract."""

from __future__ import annotations

import json
import os
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from main import (  # noqa: E402
    BibEntry,
    Figure,
    MockProseGenerator,
    Paper,
    PaperValidationError,
    PaperWriter,
    Section,
    read_experiment_manifest,
    render_latex,
)


def _paper_min() -> Paper:
    return Paper(
        title="T",
        authors=["A"],
        abstract="abs",
        sections=[],
        figures=[],
        bibliography=[],
    )


class TestRender(unittest.TestCase):
    def test_skeleton_no_sections_compiles_string(self) -> None:
        tex = render_latex(_paper_min())
        self.assertIn("\\documentclass{article}", tex)
        self.assertIn("\\begin{document}", tex)
        self.assertIn("\\end{document}", tex)
        self.assertIn("\\title{T}", tex)
        self.assertIn("\\begin{abstract}", tex)

    def test_section_emits_section_and_label(self) -> None:
        p = _paper_min()
        p.sections.append(Section(id="intro", title="Introduction", body="hello"))
        tex = render_latex(p)
        self.assertIn("\\section{Introduction}", tex)
        self.assertIn("\\label{sec:intro}", tex)
        self.assertIn("hello", tex)

    def test_figure_emits_figure_block_and_label(self) -> None:
        p = _paper_min()
        p.figures.append(Figure(id="f1", path="figs/a.pdf", caption="cap1"))
        tex = render_latex(p)
        self.assertIn("\\begin{figure}", tex)
        self.assertIn("\\includegraphics", tex)
        self.assertIn("\\caption{cap1}", tex)
        self.assertIn("\\label{fig:f1}", tex)

    def test_latex_escape_on_title(self) -> None:
        p = Paper(title="A & B", authors=["X"], abstract="x")
        tex = render_latex(p)
        self.assertIn("A \\& B", tex)


class TestValidation(unittest.TestCase):
    def test_empty_title_rejected(self) -> None:
        p = Paper(title="", authors=["A"], abstract="abs")
        with self.assertRaises(PaperValidationError):
            render_latex(p)

    def test_empty_abstract_rejected(self) -> None:
        p = Paper(title="T", authors=["A"], abstract="")
        with self.assertRaises(PaperValidationError):
            render_latex(p)

    def test_duplicate_figure_id_rejected(self) -> None:
        p = _paper_min()
        p.figures.append(Figure(id="f1", path="a.pdf", caption="c"))
        p.figures.append(Figure(id="f1", path="b.pdf", caption="c2"))
        with self.assertRaisesRegex(PaperValidationError, "duplicate figure id"):
            render_latex(p)

    def test_unknown_citation_rejected(self) -> None:
        p = _paper_min()
        p.sections.append(Section(id="s1", title="S1", cites=["ghost"]))
        with self.assertRaisesRegex(PaperValidationError, "unknown bibliography key"):
            render_latex(p)

    def test_unknown_figure_ref_rejected(self) -> None:
        p = _paper_min()
        p.sections.append(Section(id="s1", title="S1", figure_refs=["nope"]))
        with self.assertRaisesRegex(PaperValidationError, "unknown figure id"):
            render_latex(p)


class TestFigureInjection(unittest.TestCase):
    def test_read_experiment_manifest_emits_unique_ids(self) -> None:
        manifests = [
            {"name": "exp-a", "artifacts": [
                {"path": "/abs/figs/x.pdf", "caption": "cap-x"},
                {"path": "/abs/figs/y.pdf", "caption": "cap-y"},
            ]},
            {"name": "exp-b", "artifacts": [
                {"path": "/abs/figs/z.pdf", "caption": "cap-z"},
            ]},
        ]
        figs = read_experiment_manifest(manifests, "/abs")
        self.assertEqual(len(figs), 3)
        self.assertEqual(len({f.id for f in figs}), 3)
        for f in figs:
            self.assertTrue(f.caption)

    def test_read_experiment_manifest_skips_empty_path(self) -> None:
        manifests = [{"name": "x", "artifacts": [{"path": "", "caption": "c"}]}]
        self.assertEqual(read_experiment_manifest(manifests, "/abs"), [])


class TestWrite(unittest.TestCase):
    def _paper_full(self) -> Paper:
        return Paper(
            title="Demo",
            authors=["A"],
            abstract="ABS",
            sections=[
                Section(id="intro", title="Intro", cites=["k1"], figure_refs=[]),
                Section(id="res", title="Results", cites=[], figure_refs=["f1"]),
            ],
            figures=[Figure(id="f1", path="f.pdf", caption="c1")],
            bibliography=[BibEntry(key="k1", entry_type="article",
                                   fields={"title": "T", "author": "X", "year": "2020"})],
        )

    def test_write_emits_three_files_and_manifest_shape(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            prose = MockProseGenerator(outlines={"intro": "x", "res": "y"})
            writer = PaperWriter(prose=prose)
            manifest = writer.write(self._paper_full(), td)

            self.assertTrue(os.path.exists(os.path.join(td, "paper.tex")))
            self.assertTrue(os.path.exists(os.path.join(td, "references.bib")))
            self.assertTrue(os.path.exists(os.path.join(td, "manifest.json")))

            self.assertEqual(len(manifest["sections"]), 2)
            self.assertEqual(len(manifest["figures"]), 1)
            self.assertIn("k1", manifest["bibliography"])

            with open(os.path.join(td, "manifest.json"), encoding="utf-8") as f:
                disk = json.load(f)
            self.assertEqual(disk["title"], "Demo")
            self.assertEqual(disk["sections"][0]["id"], "intro")

    def test_prose_filled_when_body_empty(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            prose = MockProseGenerator(outlines={"intro": "seed-intro", "res": "seed-res"})
            writer = PaperWriter(prose=prose)
            p = self._paper_full()
            writer.write(p, td)
            with open(os.path.join(td, "paper.tex"), encoding="utf-8") as f:
                tex = f.read()
            self.assertIn("seed-intro", tex)
            self.assertIn("seed-res", tex)

    def test_bibtex_written_correctly(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            prose = MockProseGenerator(outlines={})
            writer = PaperWriter(prose=prose)
            writer.write(self._paper_full(), td)
            with open(os.path.join(td, "references.bib"), encoding="utf-8") as f:
                bib = f.read()
            self.assertIn("@article{k1,", bib)
            self.assertIn("author = {X}", bib)


class TestDemo(unittest.TestCase):
    def test_demo_runs(self) -> None:
        from main import demo
        manifest = demo()
        self.assertGreaterEqual(len(manifest["sections"]), 1)
        self.assertGreaterEqual(len(manifest["figures"]), 1)


if __name__ == "__main__":
    unittest.main()
