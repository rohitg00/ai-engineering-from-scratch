"""LaTeX paper skeleton generator with figure injection and a mocked prose generator.

Conceptual references:
- ./docs/en.md (this lesson)
- Phase 19 lessons 50-53 (earlier auto-research stages)

Stdlib only. Run: python3 code/main.py
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field
from typing import Callable, Iterable


class PaperValidationError(Exception):
    """Raised when the paper fails a structural gate before render."""


@dataclass
class BibEntry:
    key: str
    entry_type: str
    fields: dict

    def to_bibtex(self) -> str:
        lines = [f"@{self.entry_type}{{{self.key},"]
        for k, v in sorted(self.fields.items()):
            safe = str(v).replace("{", "").replace("}", "")
            lines.append(f"  {k} = {{{safe}}},")
        lines.append("}")
        return "\n".join(lines)


@dataclass
class Figure:
    id: str
    path: str
    caption: str
    width: str = "0.8\\textwidth"

    @property
    def label(self) -> str:
        return f"fig:{self.id}"


@dataclass
class Section:
    id: str
    title: str
    body: str = ""
    cites: list[str] = field(default_factory=list)
    figure_refs: list[str] = field(default_factory=list)

    @property
    def label(self) -> str:
        return f"sec:{self.id}"


@dataclass
class Paper:
    title: str
    authors: list[str]
    abstract: str
    sections: list[Section] = field(default_factory=list)
    figures: list[Figure] = field(default_factory=list)
    bibliography: list[BibEntry] = field(default_factory=list)


ProseGenerator = Callable[[Section, Paper], str]


def _validate(paper: Paper) -> None:
    if not paper.title.strip():
        raise PaperValidationError("title is empty")
    if not paper.abstract.strip():
        raise PaperValidationError("abstract is empty")

    fig_ids: set[str] = set()
    for fig in paper.figures:
        if fig.id in fig_ids:
            raise PaperValidationError(f"duplicate figure id: {fig.id}")
        fig_ids.add(fig.id)

    bib_keys: set[str] = set()
    for b in paper.bibliography:
        if b.key in bib_keys:
            raise PaperValidationError(f"duplicate bibliography key: {b.key}")
        bib_keys.add(b.key)
    for sec in paper.sections:
        for key in sec.cites:
            if key not in bib_keys:
                raise PaperValidationError(
                    f"section {sec.id!r} cites unknown bibliography key {key!r}"
                )
        for fid in sec.figure_refs:
            if fid not in fig_ids:
                raise PaperValidationError(
                    f"section {sec.id!r} references unknown figure id {fid!r}"
                )


def _escape_latex(text: str) -> str:
    repl = {
        "\\": r"\textbackslash{}",
        "&": r"\&",
        "%": r"\%",
        "$": r"\$",
        "#": r"\#",
        "_": r"\_",
        "{": r"\{",
        "}": r"\}",
        "~": r"\textasciitilde{}",
        "^": r"\textasciicircum{}",
    }
    out_chars: list[str] = []
    for ch in text:
        out_chars.append(repl.get(ch, ch))
    return "".join(out_chars)


def render_latex(paper: Paper) -> str:
    """Render a Paper to a full LaTeX document string."""
    _validate(paper)

    lines: list[str] = []
    lines.append("\\documentclass{article}")
    lines.append("\\usepackage{graphicx}")
    lines.append("\\usepackage{hyperref}")
    lines.append("\\title{" + _escape_latex(paper.title) + "}")
    lines.append("\\author{" + " \\and ".join(_escape_latex(a) for a in paper.authors) + "}")
    lines.append("\\begin{document}")
    lines.append("\\maketitle")
    lines.append("\\begin{abstract}")
    lines.append(_escape_latex(paper.abstract))
    lines.append("\\end{abstract}")

    for sec in paper.sections:
        lines.append("\\section{" + _escape_latex(sec.title) + "}")
        lines.append("\\label{" + sec.label + "}")
        lines.append(sec.body if sec.body else "% body pending")
        for fid in sec.figure_refs:
            lines.append("See Figure~\\ref{fig:" + fid + "}.")
        for cite in sec.cites:
            lines.append("See~\\cite{" + cite + "}.")

    for fig in paper.figures:
        lines.append("\\begin{figure}")
        lines.append("\\centering")
        lines.append("\\includegraphics[width=" + fig.width + "]{" + fig.path + "}")
        lines.append("\\caption{" + _escape_latex(fig.caption) + "}")
        lines.append("\\label{" + fig.label + "}")
        lines.append("\\end{figure}")

    if paper.bibliography:
        lines.append("\\bibliographystyle{plain}")
        lines.append("\\bibliography{references}")

    lines.append("\\end{document}")
    return "\n".join(lines) + "\n"


def render_bibtex(paper: Paper) -> str:
    return "\n\n".join(b.to_bibtex() for b in paper.bibliography) + ("\n" if paper.bibliography else "")


class MockProseGenerator:
    """Deterministic prose generator. Substitutes for a model in tests and demos."""

    def __init__(self, outlines: dict[str, str]) -> None:
        self.outlines = outlines

    def __call__(self, section: Section, paper: Paper) -> str:
        seed = self.outlines.get(section.id, section.title)
        first = f"In this section we discuss {section.title.lower()}: {seed}."
        bits: list[str] = []
        for fid in section.figure_refs:
            bits.append(f"Figure~\\ref{{fig:{fid}}} shows the relevant artifact.")
        for c in section.cites:
            bits.append(f"This builds on prior work~\\cite{{{c}}}.")
        second = " ".join(bits) if bits else "We discuss implications below."
        return first + "\n\n" + second


def read_experiment_manifest(manifests: Iterable[dict], paper_dir: str) -> list[Figure]:
    """Convert experiment output manifests into Figure records.

    Each manifest is expected to be a dict of shape:
        {"name": str, "artifacts": [{"path": str, "caption": str}, ...]}
    Paths in artifacts may be absolute or relative to the manifest's cwd; we
    normalise them relative to paper_dir.
    """
    figs: list[Figure] = []
    counter = 0
    for m in manifests:
        name = m.get("name", "exp")
        artifacts = m.get("artifacts", [])
        for art in artifacts:
            path = art.get("path", "")
            caption = art.get("caption", "")
            if not path:
                continue
            counter += 1
            try:
                rel = os.path.relpath(path, paper_dir)
            except ValueError:
                rel = path
            fid = re.sub(r"[^a-zA-Z0-9]+", "-", f"{name}-{counter}").strip("-").lower()
            figs.append(Figure(id=fid, path=rel, caption=caption or name))
    return figs


@dataclass
class PaperWriter:
    prose: ProseGenerator

    def fill_prose(self, paper: Paper) -> Paper:
        for sec in paper.sections:
            if not sec.body:
                sec.body = self.prose(sec, paper)
        return paper

    def write(self, paper: Paper, out_dir: str) -> dict:
        """Validate, fill prose, render, and write three files. Returns the manifest dict."""
        os.makedirs(out_dir, exist_ok=True)
        self.fill_prose(paper)
        tex = render_latex(paper)
        bib = render_bibtex(paper)

        tex_path = os.path.join(out_dir, "paper.tex")
        bib_path = os.path.join(out_dir, "references.bib")
        man_path = os.path.join(out_dir, "manifest.json")

        with open(tex_path, "w", encoding="utf-8") as f:
            f.write(tex)
        with open(bib_path, "w", encoding="utf-8") as f:
            f.write(bib)

        manifest = {
            "title": paper.title,
            "authors": list(paper.authors),
            "sections": [
                {"id": s.id, "title": s.title, "cites": list(s.cites),
                 "figure_refs": list(s.figure_refs), "body_chars": len(s.body)}
                for s in paper.sections
            ],
            "figures": [
                {"id": f.id, "path": f.path, "caption": f.caption, "label": f.label}
                for f in paper.figures
            ],
            "bibliography": [b.key for b in paper.bibliography],
            "tex_path": tex_path,
            "bib_path": bib_path,
        }
        with open(man_path, "w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=2, sort_keys=True)
        return manifest


def demo(out_dir: str | None = None) -> dict:
    """Self-contained demo. Builds a small paper from two mocked experiments.

    Writes into a temp directory by default so the worktree stays clean.
    """
    import tempfile as _tempfile
    if out_dir is None:
        out_dir = _tempfile.mkdtemp(prefix="paper-writer-demo-")
    experiments = [
        {"name": "loss-curve", "artifacts": [
            {"path": "figs/loss.pdf", "caption": "Training loss across epochs"},
        ]},
        {"name": "ablation", "artifacts": [
            {"path": "figs/ablation.pdf", "caption": "Ablation over decoder width"},
        ]},
    ]
    figs = read_experiment_manifest(experiments, out_dir)
    paper = Paper(
        title="Auto-Research Loop: Empirical Notes",
        authors=["Lab Bot"],
        abstract="We describe a small experiment harness that emits LaTeX from structured outputs.",
        sections=[
            Section(id="intro", title="Introduction", cites=["smith2020"],
                    figure_refs=[]),
            Section(id="method", title="Method", cites=["jones2021"],
                    figure_refs=[figs[0].id]),
            Section(id="results", title="Results", cites=[],
                    figure_refs=[figs[1].id]),
        ],
        figures=figs,
        bibliography=[
            BibEntry(key="smith2020", entry_type="article",
                     fields={"title": "On harnesses", "author": "Smith", "year": "2020"}),
            BibEntry(key="jones2021", entry_type="article",
                     fields={"title": "On loops", "author": "Jones", "year": "2021"}),
        ],
    )
    prose = MockProseGenerator(outlines={
        "intro": "we motivate the auto-research loop",
        "method": "we describe the skeleton-first writer",
        "results": "we present two ablations",
    })
    writer = PaperWriter(prose=prose)
    return writer.write(paper, out_dir)


if __name__ == "__main__":
    manifest = demo()
    print(json.dumps({
        "sections": len(manifest["sections"]),
        "figures": len(manifest["figures"]),
        "bib_keys": manifest["bibliography"],
        "tex_path": manifest["tex_path"],
    }, indent=2))
