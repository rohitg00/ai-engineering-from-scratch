"""Render actual command transcripts or browser captures into GIF recordings.

Authoring dependency: Pillow and ffmpeg. Neither is needed by learners.
"""

import argparse
import html
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import textwrap
import time


def execute(command, cwd, expected=0):
    start = time.monotonic()
    result = subprocess.run(
        command, cwd=cwd, capture_output=True, text=True, timeout=180
    )
    output = result.stdout + result.stderr
    if result.returncode != expected:
        raise RuntimeError(
            f"Expected exit {expected}, got {result.returncode}: {command}\n{output}"
        )
    return {
        "command": command,
        "cwd": str(cwd),
        "exitCode": result.returncode,
        "output": output,
        "durationMs": round((time.monotonic() - start) * 1000),
    }


def frame(lines, title):
    from PIL import Image, ImageDraw, ImageFont

    image = Image.new("RGB", (1120, 630), "#111a29")
    draw = ImageDraw.Draw(image)
    candidates = [
        "/System/Library/Fonts/Menlo.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
    ]
    font = next(
        (ImageFont.truetype(p, 18) for p in candidates if Path(p).exists()),
        ImageFont.load_default(),
    )
    draw.text((28, 20), title[:85], font=font, fill="#9fb2d7")
    draw.line((28, 55, 1092, 55), fill="#31415c")
    for n, line in enumerate(lines[-22:]):
        draw.text(
            (28, 78 + n * 23),
            line,
            font=font,
            fill="#89d9af" if line.startswith("$ ") else "#e4eaf5",
        )
    return image


def encode(frames, output, duration=450):
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    frames[-1].save(output.with_suffix(".png"))
    if shutil.which("ffmpeg"):
        with tempfile.TemporaryDirectory(prefix="aifs-gif-") as folder:
            for i, image in enumerate(frames):
                image.save(Path(folder) / f"{i:04d}.png")
            subprocess.run(
                [
                    "ffmpeg",
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-y",
                    "-framerate",
                    str(1000 / duration),
                    "-i",
                    str(Path(folder) / "%04d.png"),
                    "-filter_complex",
                    "[0:v]split[a][b];[a]palettegen[p];[b][p]paletteuse",
                    "-loop",
                    "0",
                    str(output),
                ],
                check=True,
            )
    else:
        frames[0].save(
            output, save_all=True, append_images=frames[1:], duration=duration, loop=0
        )


def terminal(records, output, title):
    frames, lines = [], []
    for record in records:
        lines.extend(
            textwrap.wrap("$ " + " ".join(record["command"]), width=96) or [""]
        )
        frames.append(frame(lines, title))
        chunks = []
        for line in record["output"].splitlines():
            chunks.extend(
                textwrap.wrap(line.expandtabs(2), width=96, replace_whitespace=False)
                or [""]
            )
        for offset in range(0, len(chunks), 4):
            lines.extend(chunks[offset : offset + 4])
            frames.append(frame(lines, title))
        lines.append(f"exit {record['exitCode']}")
        frames.extend([frame(lines, title)] * 3)
    if not frames:
        raise ValueError("Recording needs at least one command")
    encode(frames, output)
    Path(output).with_suffix(".json").write_text(
        json.dumps(
            {
                "title": title,
                "recordedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "records": records,
            },
            indent=2,
        )
        + "\n"
    )


def browser(url, output, title, browse, actions):
    from PIL import Image

    def call(*args):
        return subprocess.run(
            [browse, *args], check=True, capture_output=True, text=True, timeout=45
        )

    call("viewport", "1120x630")
    call("goto", url)
    frames = []
    with tempfile.TemporaryDirectory(prefix="aifs-browser-gif-", dir="/tmp") as folder:
        for i, action in enumerate([[]] + actions):
            if action:
                call(*action)
            path = str(Path(folder) / f"{i}.png")
            call("screenshot", "--viewport", path)
            frames.extend([Image.open(path).convert("RGB").copy()] * 3)
    encode(frames, output, 650)
    Path(output).with_suffix(".json").write_text(
        json.dumps(
            {"title": title, "url": url, "actions": actions, "kind": "browser capture"},
            indent=2,
        )
        + "\n"
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--recipe", type=Path, help="JSON {cwd,title,commands:[{argv,expectExit?}]}"
    )
    parser.add_argument("--browser", help="URL to capture")
    parser.add_argument(
        "--actions", type=Path, help="JSON array of browse command arrays"
    )
    parser.add_argument("--browse", default=os.environ.get("BROWSE_BIN", "browse"))
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--title", default="Recorded project run")
    args = parser.parse_args()
    if args.browser:
        browser(
            args.browser,
            args.output,
            args.title,
            args.browse,
            json.loads(args.actions.read_text()) if args.actions else [],
        )
    elif args.recipe:
        recipe = json.loads(args.recipe.read_text())
        cwd = Path(recipe.get("cwd", ".")).resolve()
        records = [
            execute(command["argv"], cwd, command.get("expectExit", 0))
            for command in recipe["commands"]
        ]
        terminal(records, args.output, recipe.get("title", args.title))
    else:
        parser.error("choose --recipe or --browser")


if __name__ == "__main__":
    main()
