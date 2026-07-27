#!/usr/bin/env python3
"""Build and validate a minimal, Turkish-only curriculum distribution."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import html
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
ENGLISH_QUIZ_COPY = re.compile(
    r"\b(?:what|which|how|why|when|where|given|choose|explain|does|is|are|"
    r"the|this|that|from|with|into|inside|between|following|correct|purpose|"
    r"one|because|they|their|it|its|has|have|can|cannot|only|for)\b",
    re.IGNORECASE,
)
TURKISH_QUIZ_COPY = re.compile(
    r"[çğıöşüÇĞİÖŞÜ]|(?i:\b(?:nedir|nasıl|hangi|neden|doğru|yanlış|aşağıdaki|"
    r"için|ile|olan|olarak|değildir|verildiğinde)\b)"
)
SITE_FILES = {
    "app.js", "cmdpalette.js", "header.js", "progress.js", "style.css",
    "about.html", "catalog.html", "glossary.html", "prereqs.html",
    "figures.js", "lesson-figures.js", "figures-math.js", "figures-ml.js",
    "figures-dl.js", "figures-vision-speech.js", "figures-transformers.js",
    "figures-genai-rl.js", "figures-llms-systems.js",
    "figures-agents-alignment.js", "figures-math2.js", "figures-nlp2.js",
    "figures-llms2.js", "figures-infra.js", "figures-frontier.js",
    "figures-history.js",
}


def build_turkish_curriculum_banner() -> str:
    """Return the repository's self-contained, static SVG banner."""
    return (ROOT / "assets" / "turkce-mufredat-v2.svg").read_text(encoding="utf-8")


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
        '  <img src="assets/turkce-mufredat-v2.svg" '
        'alt="AI Engineering from Scratch — Türkçe Müfredat" width="100%">',
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
        "## Bu müfredat kimin için?",
        "",
        "Yapay zekâ mühendisliğine sağlam bir temel kurarak başlamak, bildiklerini",
        "derinleştirmek veya üretime hazır sistemler geliştirmek isteyen herkes için",
        "tasarlanmıştır. Konular matematik ve programlama temellerinden başlayıp",
        "LLM'ler, agent sistemleri, altyapı, güvenlik ve bitirme projelerine ilerler.",
        "",
        "Başlamadan önce yalnızca temel terminal kullanımı ve öğrenmeye istekli olmanız",
        "yeterlidir. Python deneyimi faydalıdır ancak zorunlu değildir; gerekli araçlar",
        "ve ortam kurulumu ilk aşamada adım adım ele alınır.",
        "",
        "## Hızlı başlangıç",
        "",
        "### 1. Depoyu bilgisayarınıza alın",
        "",
        "Terminali açın ve depoyu klonlayın:",
        "",
        "```bash",
        "git clone https://github.com/ademiru/ai-engineering-from-scratch-tr.git",
        "```",
        "",
        "> **Git kullanmıyor musunuz?** En güncel `.tar.gz` arşivini indirin ve",
        "> `ai-engineering-from-scratch-tr` adlı bir klasöre çıkarın.",
        "",
        "### 2. Depo klasörüne girin",
        "",
        "Klonlama veya arşivi çıkarma işlemi bitince terminalde şu komutu çalıştırın:",
        "",
        "```bash",
        "cd ai-engineering-from-scratch-tr",
        "```",
        "",
        "### 3. Yerel siteyi başlatın",
        "",
        "Artık depo klasöründesiniz. Kurulum yapmadan yerel siteyi çalıştırın:",
        "",
        "```bash",
        "python3 -m http.server 8000",
        "```",
        "",
        "> Sunucu çalışırken bu terminal penceresini açık bırakın. Windows'ta",
        "> `python3` bulunamazsa `python -m http.server 8000` komutunu deneyin.",
        "",
        "### 4. Tarayıcıda açın",
        "",
        "Tarayıcınızda **[http://localhost:8000](http://localhost:8000)** adresine",
        "gidin. Karşınıza aşamaları ve dersleri gezebileceğiniz Türkçe müfredat",
        "vitrini çıkar. Bitirdiğinizde terminale dönüp `Ctrl+C` ile siteyi kapatın.",
        "",
        "### 5. İlk aşamayı açın",
        "",
        f"[{title(source / next(iter(phases)) / 'README.tr.md')}]"
        f"({next(iter(phases)).as_posix()}/README.md) sayfasına gidin ve ilk dersi",
        "seçin.",
        "",
        "### 6. İlk dersi tamamlayın",
        "",
        "Her dersin Türkçe anlatımı `docs/tr.md` dosyasındadır. Uygulamalar ve testler",
        "aynı dersin `code/` dizininde yer alır; çalıştırma komutları ders içinde",
        "belirtilir. Önce anlatımı okuyun, sonra örneği çalıştırın ve quiz ile",
        "öğrendiklerinizi kontrol edin.",
        "",
        "## Size uygun rota",
        "",
        "| Seviyeniz | Önerilen başlangıç | Nasıl ilerlemelisiniz? |",
        "|---|---|---|",
        f"| Yeni başlıyorum | [{title(source / next(iter(phases)) / 'README.tr.md')}]"
        f"({next(iter(phases)).as_posix()}/README.md) | Aşamaları sırayla tamamlayın. |",
        "| Temelleri biliyorum | Aşağıdaki öğrenme rotası | Eksik olduğunuz aşamadan başlayın; önkoşulları kontrol edin. |",
        "| Proje geliştirmek istiyorum | Aşama 19: Bitirme Projeleri | İlgili projenin gerektirdiği önceki aşamalara geri dönün. |",
        "",
        "> **Öneri:** Hız yerine sürekliliği hedefleyin. Her derste kodu çalıştırmak,",
        "> yalnızca metni okumaktan daha kalıcı bir öğrenme sağlar.",
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
        "## Kaynak ve atıf",
        "",
        "Bu Türkçe dağıtım, Rohit Ghumare tarafından yayımlanan",
        "[AI Engineering from Scratch](https://github.com/rohitg00/ai-engineering-from-scratch)",
        "projesinden türetilmiştir. Türkçe çeviri ve dağıtım düzenlemeleri özgün çalışmayı",
        "temel alır; kaynak revizyon yukarıda ve `MANIFEST.json` içinde kayıtlıdır.",
        "",
        "## Katkı ve geri bildirim",
        "",
        "Bir anlatım hatası, kırık bağlantı veya çalışmayan örnek bulursanız kaynak",
        "depoda issue açın. Ders düzeltmeleri önce kaynak Türkçe içeriğe uygulanır,",
        "ardından bu hafif dağıtım yeniden üretilir.",
        "",
        "## Sık sorulan sorular",
        "",
        "### Tüm aşamaları sırayla bitirmem gerekir mi?",
        "",
        "Yeni başlıyorsanız evet. Deneyimliyseniz hedefinize uygun aşamadan başlayabilir,",
        "anlamadığınız bir önkoşul olduğunda önceki aşamalara dönebilirsiniz.",
        "",
        "### Ücretli bir araç veya API gerekiyor mu?",
        "",
        "Müfredatı okumak için hayır. Bazı ileri uygulamalar harici bir servis veya API",
        "anahtarı kullanabilir; ilgili ders gerekli koşulları ve alternatifleri açıklar.",
        "",
        "### İçerik neden yalnızca Türkçe?",
        "",
        "Bu depo hızlı indirme ve odaklı kullanım için hazırlanmış Türkçe dağıtımdır.",
        "İngilizce içerik ve çeviri geliştirme varlıkları bilinçli olarak dışarıda",
        "bırakılmıştır.",
        "",
        "## Lisans",
        "",
        "Bu dağıtım [MIT Lisansı](LICENSE) altındadır. Dağıtıma özgün projenin eksiksiz",
        "lisans metni, `Copyright (c) 2026 Rohit Ghumare` telif bildirimiyle birlikte",
        "dahil edilmiştir. Kullanım ve yeniden dağıtımda bu bildirim ile izin metni",
        "korunmalıdır.",
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


def build_site_data(source: Path, phases: dict[Path, list[Path]]) -> str:
    """Build the original site's catalogue schema from Turkish-only content."""
    records = []
    for index, (phase, lessons) in enumerate(phases.items()):
        phase_title = title(source / phase / "README.tr.md")
        phase_title = re.sub(r"^(?:Aşama|Phase)\s+\d+\s*[:—-]?\s*", "", phase_title)
        lesson_records = []
        for lesson in lessons:
            markdown = (lesson / "docs" / "tr.md").read_text(encoding="utf-8")
            hook = next(
                (
                    line.lstrip("> ").strip()
                    for line in markdown.splitlines()
                    if line.startswith("> ") and line.lstrip("> ").strip()
                ),
                "",
            )
            lesson_records.append({
                "name": title(lesson / "docs" / "tr.md"),
                "status": "complete",
                "type": "Ders",
                "lang": "Türkçe",
                "url": lesson.relative_to(source).as_posix() + "/",
                "summary": hook,
                "keywords": "",
            })
        records.append({
            "id": index,
            "name": phase_title,
            "status": "complete",
            "desc": f"{len(lesson_records)} Türkçe ders",
            "url": phase.as_posix() + "/",
            "lessons": lesson_records,
        })
    return (
        "// Türkçe dışa aktarma betiği tarafından üretildi; elle düzenlemeyin.\n"
        "const PHASES = "
        + json.dumps(records, ensure_ascii=False, separators=(",", ":"))
        + ";\nconst GLOSSARY = [];\n"
    )


def export_original_site(
    source: Path, destination: Path, phases: dict[Path, list[Path]]
) -> None:
    """Export the source repository's UX shell, localized for local Turkish files."""
    (destination / ".nojekyll").touch()
    site = source / "site"
    for name in SITE_FILES:
        shutil.copy2(site / name, destination / name)

    index = (site / "index.html").read_text(encoding="utf-8")
    index = re.sub(
        r'\s*<script defer src="https://va\.vercel-scripts\.com/[^"]+"></script>',
        "",
        index,
    )
    index = index.replace(
        "git clone https://github.com/rohitg00/ai-engineering-from-scratch.git",
        "git clone https://github.com/ademiru/ai-engineering-from-scratch-tr.git",
    )
    maintainer_button = """
        <a class="masthead-btn" href="https://github.com/ademiru" target="_blank" rel="noopener"
          aria-label="Türkçe sürümün geliştiricisi ademiru'nun GitHub profilini aç">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.4 3-.405 1.02.005 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
          <span>@ademiru GitHub</span>
        </a>"""
    index = index.replace(
        '      </div>\n      <div class="ascii-rule" style="margin-top:48px;"></div>',
        maintainer_button
        + '\n      </div>\n      <div class="ascii-rule" style="margin-top:48px;"></div>',
        1,
    )
    (destination / "index.html").write_text(index, encoding="utf-8")

    lesson = (site / "lesson.html").read_text(encoding="utf-8")
    lesson = lesson.replace('<script src="build-meta.js"></script>', "")
    lesson = lesson.replace(
        "var base = 'https://raw.githubusercontent.com/rohitg00/"
        "ai-engineering-from-scratch/' + ref + '/';\n"
        "        var rawUrl = base + path + '/docs/en.md';\n"
        "        var quizUrl = base + path + '/quiz.json';",
        "var rawUrl = path + '/docs/tr.md';\n"
        "        var quizUrl = path + '/quiz.json';",
    )
    lesson = lesson.replace(
        "var REPO_TREE = 'https://github.com/rohitg00/"
        "ai-engineering-from-scratch/tree/main/';",
        "var REPO_TREE = 'https://github.com/ademiru/"
        "ai-engineering-from-scratch-tr/tree/main/';",
    )
    (destination / "lesson.html").write_text(lesson, encoding="utf-8")
    (destination / "data.js").write_text(
        build_site_data(source, phases), encoding="utf-8"
    )


def build_local_site_index(
    source: Path, phases: dict[Path, list[Path]], source_revision: str
) -> str:
    """Build a polished, dependency-free curriculum catalogue."""
    lesson_count = sum(len(lessons) for lessons in phases.values())
    cards = []
    for number, (phase, lessons) in enumerate(phases.items(), 1):
        phase_title = html.escape(title(source / phase / "README.tr.md"))
        lesson_links = "".join(
            f'<li data-lesson="{html.escape(title(lesson / "docs/tr.md").lower())}">'
            f'<a href="{lesson.relative_to(source).as_posix()}/docs/tr.md">'
            f'<span>{html.escape(title(lesson / "docs/tr.md"))}</span>'
            '<span aria-hidden="true">↗</span></a></li>'
            for lesson in lessons
        )
        cards.append(
            f'<details class="phase" data-phase="{phase_title.lower()}">'
            f'<summary><span class="phase-no">{number:02d}</span>'
            f'<span class="phase-title">{phase_title}</span>'
            f'<span class="phase-count">{len(lessons):02d} DERS</span>'
            '<span class="phase-toggle" aria-hidden="true">+</span></summary>'
            f'<ol>{lesson_links}</ol></details>'
        )
    return f"""<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>AI Engineering from Scratch — Türkçe</title>
  <meta name="description" content="{len(phases)} aşama ve {lesson_count} Türkçe ders ile yapay zekâ mühendisliğini temelden öğrenin.">
  <style>
    :root {{ --paper:#f5f3eb; --ink:#151515; --muted:#6b6a65; --rule:#cbc8bd;
      --soft:#e7e4da; --blue:#244bff; --mono:ui-monospace,SFMono-Regular,Menlo,monospace;
      --serif:Georgia,"Times New Roman",serif }}
    :root[data-theme="dark"] {{ --paper:#17171c; --ink:#f4f1e8; --muted:#aaa89f;
      --rule:#45454c; --soft:#303037; --blue:#8da2ff }}
    @media(prefers-color-scheme:dark) {{
      :root:not([data-theme="light"]) {{ --paper:#17171c; --ink:#f4f1e8; --muted:#aaa89f;
        --rule:#45454c; --soft:#303037; --blue:#8da2ff }}
    }}
    * {{ box-sizing:border-box }}
    html {{ scroll-behavior:smooth }}
    body {{ margin:0; color:var(--ink); background:var(--paper); font:16px/1.55 var(--serif) }}
    a {{ color:inherit }}
    .shell {{ width:min(1180px,calc(100% - 40px)); margin:auto }}
    .topbar {{ border-bottom:1px solid var(--ink); font:700 .7rem/1 var(--mono);
      letter-spacing:.12em; text-transform:uppercase }}
    .topbar .shell {{ min-height:48px; display:flex; align-items:center; justify-content:space-between; gap:20px }}
    .brand {{ color:var(--blue); text-decoration:none }}
    .topnav {{ display:flex; align-items:center; gap:24px }}
    .topnav a {{ text-decoration:none }}
    .topnav a:hover {{ color:var(--blue) }}
    .theme-toggle {{ width:36px; height:36px; padding:0; border:1px solid var(--ink);
      border-radius:50%; color:var(--ink); background:transparent; cursor:pointer;
      font:700 1rem/1 var(--mono) }}
    .theme-toggle:hover {{ color:var(--paper); background:var(--ink) }}
    .hero {{ padding:82px 0 48px; border-bottom:1px solid var(--ink) }}
    .eyebrow {{ margin:0 0 24px; color:var(--blue); font:700 .72rem/1 var(--mono);
      letter-spacing:.16em; text-transform:uppercase }}
    h1 {{ margin:0; max-width:1050px; color:var(--blue); font:700 clamp(3.6rem,10vw,8.7rem)/.78 var(--mono);
      letter-spacing:-.075em; text-transform:uppercase }}
    .hero-bottom {{ margin-top:44px; display:grid; grid-template-columns:1.4fr 1fr; gap:70px; align-items:end }}
    .lead {{ margin:0; max-width:680px; font-size:clamp(1.15rem,2vw,1.45rem); line-height:1.5 }}
    .hero-note {{ margin:0; padding-left:18px; border-left:3px solid var(--blue);
      color:var(--muted); font:500 .78rem/1.7 var(--mono) }}
    .stats {{ display:grid; grid-template-columns:repeat(3,1fr); border-bottom:1px solid var(--ink) }}
    .stat {{ padding:28px 0; border-right:1px solid var(--rule) }}
    .stat + .stat {{ padding-left:32px }}
    .stat:last-child {{ border-right:0 }}
    .stat strong {{ display:block; color:var(--blue); font:700 clamp(2rem,5vw,3.7rem)/1 var(--mono) }}
    .stat span {{ display:block; margin-top:8px; color:var(--muted); font:700 .68rem/1 var(--mono);
      letter-spacing:.13em; text-transform:uppercase }}
    .catalogue {{ padding:58px 0 80px }}
    .catalogue-head {{ display:grid; grid-template-columns:1fr minmax(280px,420px); gap:40px;
      align-items:end; margin-bottom:24px }}
    h2 {{ margin:0; font:700 clamp(2rem,5vw,4rem)/1 var(--mono); letter-spacing:-.05em; text-transform:uppercase }}
    label {{ display:block; color:var(--muted); font:700 .66rem/1 var(--mono);
      letter-spacing:.13em; text-transform:uppercase }}
    input {{ width:100%; margin-top:10px; padding:13px 14px; border:1px solid var(--ink);
      border-radius:0; outline:0; background:transparent; color:var(--ink); font:500 .88rem var(--mono) }}
    input:focus {{ border-color:var(--blue); box-shadow:inset 0 0 0 1px var(--blue) }}
    .phase {{ border-top:1px solid var(--ink) }}
    .phase:last-of-type {{ border-bottom:1px solid var(--ink) }}
    summary {{ display:grid; grid-template-columns:64px 1fr auto 28px; align-items:center; gap:18px;
      padding:22px 8px; cursor:pointer; list-style:none }}
    summary::-webkit-details-marker {{ display:none }}
    summary:hover .phase-title {{ color:var(--blue) }}
    .phase-no,.phase-count,.phase-toggle {{ font:700 .72rem/1 var(--mono) }}
    .phase-no {{ color:var(--blue) }}
    .phase-title {{ font:700 clamp(1.05rem,2.2vw,1.55rem)/1.2 var(--mono); text-transform:uppercase }}
    .phase-count {{ color:var(--muted); letter-spacing:.08em }}
    .phase-toggle {{ color:var(--blue); font-size:1.3rem; text-align:center; transition:transform .2s }}
    details[open] .phase-toggle {{ transform:rotate(45deg) }}
    ol {{ margin:0 0 26px 82px; padding:0; display:grid; grid-template-columns:1fr 1fr;
      gap:0 34px; list-style:none; counter-reset:lesson }}
    li {{ counter-increment:lesson; border-top:1px solid var(--soft) }}
    li a {{ display:flex; justify-content:space-between; gap:15px; padding:11px 4px;
      text-decoration:none; font-size:.94rem }}
    li a:before {{ content:counter(lesson,decimal-leading-zero); color:var(--muted);
      font:500 .66rem/1.8 var(--mono); margin-right:8px }}
    li a span:first-child {{ flex:1 }}
    li a span:last-child {{ color:var(--blue); opacity:0 }}
    li a:hover {{ color:var(--blue) }}
    li a:hover span:last-child {{ opacity:1 }}
    .empty {{ display:none; padding:32px 0; color:var(--muted); font-style:italic }}
    .reader[hidden] {{ display:none }}
    .reader {{ position:fixed; inset:0; z-index:20; overflow:auto; background:var(--paper) }}
    .reader-bar {{ position:sticky; top:0; z-index:1; padding:12px 0; border-bottom:1px solid var(--rule);
      background:var(--paper) }}
    .reader-bar .shell {{ display:flex; align-items:center; justify-content:space-between; gap:20px }}
    .reader-back {{ padding:9px 12px; border:1px solid var(--ink); color:var(--ink);
      background:transparent; cursor:pointer; font:700 .72rem/1 var(--mono); text-transform:uppercase }}
    .reader-back:hover {{ color:var(--paper); background:var(--ink) }}
    .reader-path {{ overflow:hidden; color:var(--muted); font:500 .68rem/1 var(--mono);
      text-overflow:ellipsis; white-space:nowrap }}
    .lesson {{ width:min(820px,calc(100% - 40px)); margin:64px auto 100px; font-size:1.05rem }}
    .lesson h1,.lesson h2,.lesson h3 {{ margin:2em 0 .7em; color:var(--ink); font-family:var(--mono);
      line-height:1.15; letter-spacing:-.035em; text-transform:none }}
    .lesson h1 {{ margin-top:0; color:var(--blue); font-size:clamp(2.2rem,6vw,4.5rem) }}
    .lesson h2 {{ padding-bottom:.3em; border-bottom:1px solid var(--rule); font-size:1.8rem }}
    .lesson h3 {{ font-size:1.25rem }}
    .lesson p,.lesson ul,.lesson ol {{ margin:1em 0 }}
    .lesson ul,.lesson ol {{ display:block; margin-left:1.5em; padding:0; list-style:revert; counter-reset:none }}
    .lesson li {{ border:0; counter-increment:none }}
    .lesson blockquote {{ margin:1.5em 0; padding:.2em 1.2em; border-left:3px solid var(--blue); color:var(--muted) }}
    .lesson pre {{ overflow:auto; padding:18px; border:1px solid var(--rule); background:var(--soft);
      font:500 .82rem/1.6 var(--mono) }}
    .lesson code {{ padding:.12em .3em; background:var(--soft); font:500 .85em var(--mono) }}
    .lesson pre code {{ padding:0; background:transparent }}
    .lesson a {{ color:var(--blue) }}
    .lesson .mermaid {{ margin:1.75em 0; overflow:auto; padding:20px;
      border:1px solid var(--rule); background:var(--soft); text-align:center }}
    .lesson .mermaid svg {{ max-width:100%; height:auto }}
    .lesson .mermaid-error {{ text-align:left; white-space:pre-wrap }}
    .lesson-error {{ padding:28px; border:1px solid #c33 }}
    body.reader-open {{ overflow:hidden }}
    footer {{ padding:28px 0 44px; border-top:1px solid var(--ink); color:var(--muted);
      font:500 .7rem/1.7 var(--mono); text-transform:uppercase; letter-spacing:.06em }}
    footer .shell {{ display:flex; justify-content:space-between; gap:24px; flex-wrap:wrap }}
    footer a {{ color:var(--blue) }}
    @media(max-width:760px) {{
      .shell {{ width:min(100% - 24px,1180px) }} .topnav a:first-child {{ display:none }}
      .hero {{ padding:54px 0 34px }} h1 {{ font-size:clamp(3rem,16vw,5.4rem) }}
      .hero-bottom,.catalogue-head {{ grid-template-columns:1fr; gap:26px }}
      .stats {{ grid-template-columns:1fr }} .stat,.stat + .stat {{ padding:18px 0; border-right:0;
        border-bottom:1px solid var(--rule) }} .stat:last-child {{ border-bottom:0 }}
      summary {{ grid-template-columns:38px 1fr 22px; gap:10px; padding:18px 2px }}
      .phase-count {{ display:none }} ol {{ margin-left:48px; grid-template-columns:1fr }}
    }}
  </style>
</head>
<body>
  <nav class="topbar"><div class="shell">
    <a class="brand" href="#">AI ENGINEERING / TR</a>
    <div class="topnav"><a href="#mufredat">Müfredat</a><a href="README.md">Kullanım rehberi ↗</a>
      <button class="theme-toggle" id="theme-toggle" type="button" aria-label="Koyu temaya geç" title="Temayı değiştir">◐</button></div>
  </div></nav>
  <header class="hero"><div class="shell">
    <p class="eyebrow">Açık kaynak · Uygulamalı · Türkçe</p>
    <h1>AI Engineering<br>From Scratch</h1>
    <div class="hero-bottom">
      <p class="lead">Yapay zekâ sistemlerini yalnızca kullanmayın. Matematik temellerinden
      agent mimarilerine kadar her katmanı elle kurun, test edin ve gerçekten anlayın.</p>
      <p class="hero-note">Framework'ten önce temel mekanizma.<br>Teoriden sonra çalışan kod.<br>
      Her derste yeniden kullanılabilir çıktı.</p>
    </div>
  </div></header>
  <main>
    <section class="stats shell" aria-label="Müfredat özeti">
      <div class="stat"><strong>{len(phases):02d}</strong><span>Aşama</span></div>
      <div class="stat"><strong>{lesson_count}</strong><span>Türkçe ders</span></div>
      <div class="stat"><strong>%100</strong><span>Türkçe kapsam</span></div>
    </section>
    <section class="catalogue shell" id="mufredat">
      <div class="catalogue-head">
        <div><p class="eyebrow">İçindekiler</p><h2>Öğrenme Rotası</h2></div>
        <label for="search">Ders veya aşama ara
          <input id="search" type="search" placeholder="Örn. attention, agent, Python…" autocomplete="off">
        </label>
      </div>
      <div id="phases" aria-live="polite">{''.join(cards)}</div>
      <p class="empty" id="empty">Aramanızla eşleşen bir ders bulunamadı.</p>
    </section>
  </main>
  <footer><div class="shell"><span>Kaynak revizyon · {html.escape(source_revision)}</span>
    <span>AI Engineering from Scratch · <a href="README.md">Başlangıç rehberi</a></span></div></footer>
  <section class="reader" id="reader" hidden aria-label="Ders okuyucu">
    <div class="reader-bar"><div class="shell">
      <button class="reader-back" id="reader-back" type="button">← Müfredata dön</button>
      <span class="reader-path" id="reader-path"></span>
    </div></div>
    <article class="lesson" id="lesson" tabindex="-1"></article>
  </section>
  <script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
    mermaid.initialize({{startOnLoad:false,securityLevel:'strict',theme:'base'}});
    window.renderLessonDiagrams=async container=>{{
      const diagrams=container.querySelectorAll('.mermaid:not([data-processed])');
      if(!diagrams.length) return;
      try {{ await mermaid.run({{nodes:diagrams}}); }}
      catch(error) {{
        diagrams.forEach(node=>{{
          if(!node.dataset.processed) node.classList.add('mermaid-error');
        }});
        console.error('Mermaid diyagramı oluşturulamadı',error);
      }}
    }};
    window.renderLessonDiagrams(document.querySelector('#lesson'));
  </script>
  <script>
    const input=document.querySelector('#search'), phases=[...document.querySelectorAll('.phase')];
    const root=document.documentElement, themeButton=document.querySelector('#theme-toggle');
    const savedTheme=localStorage.getItem('curriculum-theme');
    if(savedTheme) root.dataset.theme=savedTheme;
    const currentTheme=()=>root.dataset.theme||
      (matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
    const updateThemeLabel=()=>{{
      const next=currentTheme()==='dark'?'açık':'koyu';
      themeButton.setAttribute('aria-label',`${{next[0].toLocaleUpperCase('tr-TR')+next.slice(1)}} temaya geç`);
    }};
    updateThemeLabel();
    themeButton.addEventListener('click',()=>{{
      const theme=currentTheme()==='dark'?'light':'dark';
      root.dataset.theme=theme; localStorage.setItem('curriculum-theme',theme); updateThemeLabel();
    }});
    const normalize=s=>s.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'');
    input.addEventListener('input',()=>{{
      const query=normalize(input.value.trim()); let visible=0;
      phases.forEach(phase=>{{
        const phaseMatch=normalize(phase.dataset.phase).includes(query);
        let matches=0;
        phase.querySelectorAll('li').forEach(lesson=>{{
          const match=!query||phaseMatch||normalize(lesson.dataset.lesson).includes(query);
          lesson.hidden=!match; if(match) matches++;
        }});
        phase.hidden=matches===0; phase.open=Boolean(query&&matches); if(matches) visible++;
      }});
      document.querySelector('#empty').style.display=visible?'none':'block';
    }});
    const reader=document.querySelector('#reader'), lesson=document.querySelector('#lesson');
    const escapeHtml=s=>s.replace(/[&<>"]/g,c=>({{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}}[c]));
    const inline=s=>escapeHtml(s)
      .replace(/`([^`]+)`/g,'<code>$1</code>')
      .replace(/\\*\\*([^*]+)\\*\\*/g,'<strong>$1</strong>')
      .replace(/\\*([^*]+)\\*/g,'<em>$1</em>')
      .replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g,'<a href="$2">$1</a>');
    const renderMarkdown=source=>{{
      const code=[]; source=source.replace(/```([^\\n]*)\\n([\\s\\S]*?)```/g,(_,lang,body)=>{{
        const language=lang.trim().toLocaleLowerCase('en-US');
        code.push(language==='mermaid'
          ? `<div class="mermaid">${{escapeHtml(body)}}</div>`
          : `<pre><code class="language-${{escapeHtml(lang.trim())}}">${{escapeHtml(body)}}</code></pre>`);
        return `\\n@@CODE${{code.length-1}}@@\\n`;
      }});
      const lines=source.replace(/\\r/g,'').split('\\n'), out=[]; let list=null, paragraph=[];
      const flush=()=>{{ if(paragraph.length) out.push(`<p>${{inline(paragraph.join(' '))}}</p>`); paragraph=[]; }};
      const closeList=()=>{{ if(list) out.push(`</${{list}}>`); list=null; }};
      lines.forEach(line=>{{
        const heading=line.match(/^(#{{1,6}})\\s+(.+)$/), bullet=line.match(/^\\s*[-*]\\s+(.+)$/);
        const numbered=line.match(/^\\s*\\d+[.)]\\s+(.+)$/), quote=line.match(/^>\\s?(.*)$/);
        const token=line.match(/^@@CODE(\\d+)@@$/);
        if(token) {{ flush(); closeList(); out.push(code[Number(token[1])]); }}
        else if(heading) {{ flush(); closeList(); const level=heading[1].length;
          out.push(`<h${{level}}>${{inline(heading[2])}}</h${{level}}>`); }}
        else if(bullet||numbered) {{ flush(); const type=bullet?'ul':'ol';
          if(list!==type) {{ closeList(); out.push(`<${{type}}>`); list=type; }}
          out.push(`<li>${{inline((bullet||numbered)[1])}}</li>`); }}
        else if(quote) {{ flush(); closeList(); out.push(`<blockquote>${{inline(quote[1])}}</blockquote>`); }}
        else if(!line.trim()) {{ flush(); closeList(); }}
        else paragraph.push(line.trim());
      }});
      flush(); closeList(); return out.join('\\n');
    }};
    const closeReader=()=>{{ reader.hidden=true; document.body.classList.remove('reader-open');
      if(location.hash.startsWith('#ders=')) history.pushState(null,'',location.pathname+location.search+'#mufredat'); }};
    const openLesson=async(path,push=true)=>{{
      reader.hidden=false; document.body.classList.add('reader-open');
      document.querySelector('#reader-path').textContent=path; lesson.innerHTML='<p>Ders yükleniyor…</p>';
      try {{
        const response=await fetch(path); if(!response.ok) throw new Error(`HTTP ${{response.status}}`);
        const markdown=new TextDecoder('utf-8').decode(await response.arrayBuffer());
        lesson.innerHTML=renderMarkdown(markdown);
        if(window.renderLessonDiagrams) await window.renderLessonDiagrams(lesson);
        lesson.querySelectorAll('a').forEach(a=>{{
          if(!/^(?:https?:|#|mailto:)/.test(a.getAttribute('href')||''))
            a.href=new URL(a.getAttribute('href'),new URL(path,location.href)).href;
        }});
        lesson.focus(); window.scrollTo(0,0);
        if(push) history.pushState({{lesson:path}},'',`#ders=${{encodeURIComponent(path)}}`);
      }} catch(error) {{
        lesson.innerHTML=`<div class="lesson-error"><h1>Ders açılamadı</h1><p>${{escapeHtml(error.message)}}</p>
          <p>Bu sayfayı bir yerel web sunucusu üzerinden açtığınızdan emin olun.</p></div>`;
      }}
    }};
    document.querySelector('#phases').addEventListener('click',event=>{{
      const link=event.target.closest('a[href$="/docs/tr.md"]'); if(!link) return;
      event.preventDefault(); openLesson(link.getAttribute('href'));
    }});
    document.querySelector('#reader-back').addEventListener('click',closeReader);
    addEventListener('popstate',event=>{{
      const path=location.hash.startsWith('#ders=')?decodeURIComponent(location.hash.slice(6)):null;
      if(path) openLesson(path,false); else {{ reader.hidden=true; document.body.classList.remove('reader-open'); }}
    }});
    if(location.hash.startsWith('#ders=')) openLesson(decodeURIComponent(location.hash.slice(6)),false);
  </script>
</body>
</html>
"""


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
    (destination / "assets" / "turkce-mufredat-v2.svg").write_text(
        build_turkish_curriculum_banner(), encoding="utf-8"
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
    export_original_site(source, destination, phases)
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
    quiz_strings = 0
    english_quiz_copy: list[str] = []
    for quiz in sorted(root.glob("phases/*/*/quiz.json")):
        payload = json.loads(quiz.read_text(encoding="utf-8"))

        def inspect(value: object, key: str | None = None) -> None:
            nonlocal quiz_strings
            if isinstance(value, dict):
                for child_key, child in value.items():
                    inspect(child, child_key)
            elif isinstance(value, list):
                for child in value:
                    inspect(child, key)
            elif (
                isinstance(value, str)
                and key in {"title", "question", "q", "options", "choices", "explanation", "explain"}
                and value.strip()
            ):
                quiz_strings += 1
                if (
                    re.search(r"\s", value.strip())
                    and ENGLISH_QUIZ_COPY.search(value)
                    and not TURKISH_QUIZ_COPY.search(value)
                ):
                    english_quiz_copy.append(
                        f"{quiz.relative_to(root)} [{key}]: {value[:80]}"
                    )

        inspect(payload)
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
    if english_quiz_copy:
        raise ValueError(
            "İngilizce quiz metni kaldı: " + "; ".join(english_quiz_copy[:10])
        )
    files = [p for p in root.rglob("*") if p.is_file()]
    return {
        "schema_version": 1,
        "locale": "tr",
        "source_revision": revision,
        "lessons": len(tr_docs),
        "coverage_percent": 100.0,
        "markdown_files_checked": len(markdown),
        "broken_local_links": 0,
        "quiz_strings_checked": quiz_strings,
        "english_quiz_strings": 0,
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
