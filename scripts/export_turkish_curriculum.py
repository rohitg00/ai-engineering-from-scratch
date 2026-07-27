#!/usr/bin/env python3
"""Build and validate a minimal, Turkish-only curriculum distribution."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import os
import re
import shutil
import tarfile
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LESSONS = "phases/*/*"
EXCLUDED_DIRS = {
    ".git", ".github", ".pytest_cache", "__pycache__", "coverage",
    "htmlcov", "node_modules", "translation-bundles",
}
EXCLUDED_SUFFIXES = {".pyc", ".pyo", ".coverage"}
ALLOWED_LESSON_ENTRIES = {"code", "outputs", "assets", "quiz.json"}
LOCAL_LINK = re.compile(r"!?\[[^\]]*\]\(([^)#?]+)(?:#[^)]*)?\)")


def build_rgb_ascii_banner() -> str:
    """Return the repository's self-contained animated SVG banner."""
    return (ROOT / "assets" / "turkcelestirilmis-rgb.svg").read_text(encoding="utf-8")


def lesson_dirs(root: Path) -> list[Path]:
    return sorted(p for p in root.glob(LESSONS) if (p / "docs" / "en.md").is_file())


def safe_copytree(source: Path, target: Path) -> None:
    def ignored(_directory: str, names: list[str]) -> set[str]:
        return {
            name for name in names
            if name in EXCLUDED_DIRS
            or Path(name).suffix in EXCLUDED_SUFFIXES
            or name.startswith(("coverage.", ".coverage"))
        }

    shutil.copytree(source, target, ignore=ignored)


def title(markdown: Path) -> str:
    for line in markdown.read_text(encoding="utf-8").splitlines():
        if line.startswith("# "):
            return line[2:].strip()
    return markdown.parent.parent.name


def build_readme(
    source: Path, phases: dict[Path, list[Path]], source_revision: str
) -> str:
    lesson_count = sum(len(lessons) for lessons in phases.values())
    phase_count = len(phases)
    lines = [
        '<p align="center">',
        '  <img src="assets/turkcelestirilmis-rgb.svg" '
        'alt="TÜRKÇELEŞTİRİLMİŞ — RGB ASCII başlık" width="100%">',
        "</p>",
        "",
        "# AI Engineering from Scratch — Türkçe",
        "",
        "> Yapay zekâ mühendisliğini matematik temellerinden üretim sistemlerine kadar,",
        "> Türkçe anlatımlar ve çalışan uygulamalarla adım adım öğrenin.",
        "",
        "Bu depo, **AI Engineering from Scratch** eğitim programının hafif, yalnızca",
        "Türkçe dağıtımıdır. İngilizce anlatımlar ve çeviri geliştirme dosyaları yerine",
        "öğrenmek ve uygulamak için gereken dersleri, kodu, testleri, quizleri ve",
        "yeniden kullanılabilir çıktıları içerir.",
        "",
        f"**{phase_count} aşama** · **{lesson_count} Türkçe ders** · "
        "**%100 Türkçe anlatım kapsamı**",
        "",
        f"**Kaynak revizyon:** `{source_revision}`",
        "",
        "## Hızlı başlangıç",
        "",
        "Depoyu indirin veya yayımlanan `.tar.gz` arşivini açın. Ardından ilk aşamadan",
        "başlayın:",
        "",
        "```bash",
        "git clone https://github.com/ademiru/ai-engineering-from-scratch-tr.git",
        "cd ai-engineering-from-scratch-tr",
        "```",
        "",
        f"İlk adım: [{title(source / next(iter(phases)) / 'README.tr.md')}]"
        f"({next(iter(phases)).as_posix()}/README.md)",
        "",
        "Her dersin Türkçe anlatımı `docs/tr.md` dosyasındadır. Uygulamalar ve testler",
        "aynı dersin `code/` dizininde yer alır; çalıştırma komutları ders içinde",
        "belirtilir.",
        "",
        "## Öğrenme rotası",
        "",
    ]
    for phase, lessons in phases.items():
        phase_title = title(source / phase / "README.tr.md")
        lines.append(
            f"- **[{phase_title}]({phase.as_posix()}/README.md)** — {len(lessons)} ders"
        )
    lines += [
        "",
        "Aşamaları sırayla izleyebilir veya ihtiyacınız olan konuya doğrudan",
        "geçebilirsiniz. Bir aşama sayfası, o aşamadaki tüm Türkçe derslere bağlantı",
        "verir.",
        "",
        "## Bir ders nasıl çalışılır?",
        "",
        "1. Aşama sayfasından bir ders seçin ve `docs/tr.md` anlatımını okuyun.",
        "2. Kavramı hazır bir çerçeveye bırakmadan önce temel mantığı kendiniz kurun.",
        "3. `code/` altındaki örneği çalıştırın ve testleri inceleyin.",
        "4. `quiz.json` ile bilginizi sınayın.",
        "5. Varsa `outputs/` altındaki çıktıyı kendi projenizde yeniden kullanın.",
        "",
        "## Depoda neler var?",
        "",
        "| Yol | İçerik |",
        "|---|---|",
        "| `phases/` | Aşamalar, Türkçe dersler ve uygulamalar |",
        "| `docs/tr.md` | Dersin Türkçe anlatımı |",
        "| `code/` | Çalıştırılabilir örnekler ve testler |",
        "| `quiz.json` | Ders değerlendirme soruları |",
        "| `outputs/` | Yeniden kullanılabilir beceri, prompt ve araçlar |",
        "| `MANIFEST.json` | Kapsam, kaynak revizyonu ve doğrulama sonucu |",
        "",
        "## Dağıtım güvenceleri",
        "",
        "Her sürüm otomatik olarak üretilir ve yayımlanmadan önce Türkçe ders kapsamı,",
        "yerel Markdown bağlantıları ve hariç tutulması gereken dosyalar doğrulanır.",
        "`MANIFEST.json`, bu kontrollerin sonucunu ve dağıtımın kaynak revizyonunu",
        "makine tarafından okunabilir biçimde kaydeder.",
        "",
        "Bu depo ana eğitim programından türetilir. Güncelleme ve yeniden üretim süreci",
        "[SENKRONIZASYON.md](SENKRONIZASYON.md) belgesinde açıklanır.",
        "",
        "## Katkı ve geri bildirim",
        "",
        "Bir anlatım hatası, kırık bağlantı veya çalışmayan örnek bulursanız kaynak",
        "depoda issue açın. Ders düzeltmeleri önce kaynak Türkçe içeriğe uygulanır,",
        "ardından bu hafif dağıtım yeniden üretilir.",
        "",
        "## Lisans",
        "",
        "Bu dağıtım [MIT Lisansı](LICENSE) altındadır. Özgün eğitim programı ve",
        "Türkçe çeviri katkılarına ait bildirimler lisans koşullarıyla birlikte korunur.",
        "",
    ]
    return "\n".join(lines)


def build_phase_readme(phase: Path, lessons: list[Path]) -> str:
    lines = [f"# {title(phase / 'README.tr.md')}", "", "## Dersler", ""]
    for lesson in lessons:
        name = title(lesson / "docs" / "tr.md")
        lines.append(f"- [{name}]({lesson.name}/docs/tr.md)")
    lines.append("")
    return "\n".join(lines)


def export(source: Path, destination: Path, revision: str) -> dict[str, object]:
    if destination.exists():
        raise ValueError(f"hedef zaten var: {destination}")
    lessons = lesson_dirs(source)
    missing = [p for p in lessons if not (p / "docs" / "tr.md").is_file()]
    if missing:
        raise ValueError(f"{len(missing)} derste docs/tr.md eksik")

    phases: dict[Path, list[Path]] = {}
    destination.mkdir(parents=True)
    shutil.copy2(source / "LICENSE", destination / "LICENSE")
    (destination / "assets").mkdir()
    (destination / "assets" / "turkcelestirilmis-rgb.svg").write_text(
        build_rgb_ascii_banner(), encoding="utf-8"
    )
    for lesson in lessons:
        relative = lesson.relative_to(source)
        target = destination / relative
        (target / "docs").mkdir(parents=True)
        shutil.copy2(lesson / "docs" / "tr.md", target / "docs" / "tr.md")
        for entry in ALLOWED_LESSON_ENTRIES:
            item = lesson / entry
            if item.is_dir():
                safe_copytree(item, target / entry)
            elif item.is_file():
                shutil.copy2(item, target / entry)
        phase = relative.parent
        phases.setdefault(phase, []).append(lesson)

    for phase, phase_lessons in phases.items():
        target = destination / phase
        target.mkdir(parents=True, exist_ok=True)
        (target / "README.md").write_text(
            build_phase_readme(source / phase, phase_lessons), encoding="utf-8"
        )
    (destination / "README.md").write_text(
        build_readme(source, phases, revision), encoding="utf-8"
    )
    shutil.copy2(source / "docs" / "turkish-export-sync.md", destination / "SENKRONIZASYON.md")
    manifest = validate(destination, len(lessons), revision)
    (destination / "MANIFEST.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return manifest


def validate(root: Path, expected_lessons: int, revision: str) -> dict[str, object]:
    tr_docs = sorted(root.glob("phases/*/*/docs/tr.md"))
    forbidden = [
        p for p in root.rglob("*")
        if p.name in EXCLUDED_DIRS
        or p.name == "en.md"
        or p.suffix in EXCLUDED_SUFFIXES
        or p.name.startswith(("coverage.", ".coverage"))
    ]
    broken: list[str] = []
    markdown = list(root.rglob("*.md"))
    for doc in markdown:
        text = doc.read_text(encoding="utf-8")
        for match in LOCAL_LINK.finditer(text):
            raw = match.group(1)
            if "://" in raw or raw.startswith(("mailto:", "/")):
                continue
            linked = (doc.parent / raw).resolve()
            if root.resolve() not in (linked, *linked.parents) or not linked.exists():
                broken.append(f"{doc.relative_to(root)} -> {raw}")
    if len(tr_docs) != expected_lessons:
        raise ValueError(f"Türkçe kapsamı {len(tr_docs)}/{expected_lessons}")
    if forbidden:
        raise ValueError(f"yasaklı dosyalar: {', '.join(str(p) for p in forbidden[:5])}")
    if broken:
        raise ValueError(f"kırık yerel bağlantılar: {', '.join(broken[:10])}")
    files = [p for p in root.rglob("*") if p.is_file()]
    return {
        "schema_version": 1,
        "locale": "tr",
        "source_revision": revision,
        "lessons": len(tr_docs),
        "coverage_percent": 100.0,
        "markdown_files_checked": len(markdown),
        "broken_local_links": 0,
        "files": len(files) + 1,
        "content_bytes": sum(p.stat().st_size for p in files),
    }


def archive_tree(source: Path, archive: Path) -> None:
    archive.parent.mkdir(parents=True, exist_ok=True)
    with archive.open("wb") as raw:
        with gzip.GzipFile(filename="", mode="wb", fileobj=raw, mtime=0) as compressed:
            with tarfile.open(fileobj=compressed, mode="w", format=tarfile.PAX_FORMAT) as bundle:
                for path in sorted(source.rglob("*")):
                    info = bundle.gettarinfo(
                        str(path),
                        arcname=f"ai-engineering-from-scratch-tr/{path.relative_to(source)}",
                    )
                    info.uid = info.gid = 0
                    info.uname = info.gname = ""
                    info.mtime = 0
                    if path.is_file():
                        with path.open("rb") as handle:
                            bundle.addfile(info, handle)
                    else:
                        bundle.addfile(info)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, help="kalıcı çıktı dizini")
    parser.add_argument("--archive", type=Path, help="yeniden üretilebilir .tar.gz çıktısı")
    parser.add_argument("--source-revision", default=os.environ.get("SOURCE_REVISION", "unknown"))
    args = parser.parse_args()
    if not args.output and not args.archive:
        parser.error("--output veya --archive gerekli")
    try:
        if args.output:
            destination = args.output.resolve()
            manifest = export(ROOT, destination, args.source_revision)
            if args.archive:
                archive_tree(destination, args.archive.resolve())
        else:
            with tempfile.TemporaryDirectory(prefix="curriculum-tr-") as temp:
                destination = Path(temp) / "export"
                manifest = export(ROOT, destination, args.source_revision)
                archive_tree(destination, args.archive.resolve())
        if args.archive:
            data = args.archive.resolve().read_bytes()
            manifest["archive_bytes"] = len(data)
            manifest["archive_sha256"] = hashlib.sha256(data).hexdigest()
        print(json.dumps(manifest, ensure_ascii=False, indent=2))
    except (OSError, ValueError) as exc:
        parser.exit(1, f"error: {exc}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
