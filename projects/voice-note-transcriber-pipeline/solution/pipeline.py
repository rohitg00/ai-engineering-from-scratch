import argparse
import base64
import hashlib
import html
import json
import os
from pathlib import Path
from pcm import decode_wav
from activity import activity
from transcribe import transcribe
from captions import captions
from provider import http_recognizer


def export_transcript(wav, rows, out, method):
    decoded = decode_wav(wav)
    duration = len(decoded["samples"]) / decoded["rate"]
    if any(row["end"] > duration for row in rows):
        raise ValueError("Caption ends beyond the input audio")
    vtt = captions(rows)
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    report = {
        "schema_version": 1,
        "method": method,
        "audio_sha256": hashlib.sha256(wav).hexdigest(),
        "duration_seconds": duration,
        "rows": rows,
    }
    (out / "transcript.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    (out / "captions.vtt").write_text(vtt, encoding="utf-8")
    (out / "audio.wav").write_bytes(wav)
    audio_uri = "data:audio/wav;base64," + base64.b64encode(wav).decode()
    cues = "".join(
        '<li><button type="button" data-seek="'
        + str(row["start"])
        + '">'
        + f"{row['start']:.2f} to {row['end']:.2f}s"
        + "</button> "
        + html.escape(row["text"])
        + "</li>"
        for row in rows
    )
    page = (
        '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Voice note review</title><style>body{font:18px system-ui;max-width:850px;margin:3rem auto;padding:0 1rem}audio{width:100%}li{margin:1rem 0}button{font:inherit;cursor:pointer}</style><h1>Voice note review</h1><p>'
        + html.escape(method)
        + '</p><audio id="audio" controls src="'
        + audio_uri
        + '"></audio><ol>'
        + cues
        + '</ol><p>Review the words against playback. Edit transcript.json and rerender to apply corrections. Timestamps mark segment boundaries, not word alignments.</p><a href="captions.vtt" download>Download WebVTT</a><script>document.querySelectorAll("[data-seek]").forEach(button=>button.addEventListener("click",()=>{const audio=document.getElementById("audio");audio.currentTime=Number(button.dataset.seek);audio.play();}));</script></html>'
    )
    (out / "index.html").write_text(page, encoding="utf-8")
    return report


def main():
    p = argparse.ArgumentParser(
        description="Transcribe a selected WAV through an explicit HTTP recognizer or review supplied transcript evidence."
    )
    p.add_argument("--input", type=Path, required=True)
    p.add_argument("--out", type=Path, default=Path("voice-output"))
    mode = p.add_mutually_exclusive_group(required=True)
    mode.add_argument(
        "--endpoint",
        help="Explicit multipart audio/transcriptions endpoint; uploads the selected audio",
    )
    mode.add_argument(
        "--transcript-file",
        type=Path,
        help="Supplied reference transcript bound to an audio SHA256; no recognition occurs",
    )
    mode.add_argument(
        "--review-file",
        type=Path,
        help="Edited transcript.json from an earlier run, bound to the original audio hash",
    )
    p.add_argument("--model", default="whisper-1")
    p.add_argument(
        "--segment",
        action="store_true",
        help="Split by acoustic energy before real recognition; may cut quiet speech",
    )
    p.add_argument("--threshold", type=float, default=0.02)
    args = p.parse_args()
    if args.input.stat().st_size > 20_000_000:
        p.error("WAV input exceeds 20 MB")
    wav = args.input.read_bytes()
    audio = decode_wav(wav)
    if not audio["samples"]:
        p.error("Audio contains no samples")
    digest = hashlib.sha256(wav).hexdigest()
    if args.review_file:
        prior = json.loads(args.review_file.read_text())
        if prior.get("audio_sha256") != digest:
            p.error("Review file does not belong to this audio")
        rows = prior["rows"]
        method = "Human-edited transcript review; no recognition in this run"
    elif args.transcript_file:
        if args.segment:
            p.error(
                "Supplied reference text is bound to the entire clip; omit --segment"
            )
        reference = json.loads(args.transcript_file.read_text())
        if reference.get("audio_sha256") != digest:
            p.error("Supplied transcript does not belong to this audio")
        rows = transcribe(
            audio["samples"],
            audio["rate"],
            [(0, len(audio["samples"]))],
            lambda _: reference["text"],
        )
        method = "Supplied reference transcript for an authored speech fixture; no speech recognition ran"
    else:
        spans = (
            activity(audio["samples"], audio["rate"], threshold=args.threshold)
            if args.segment
            else [(0, len(audio["samples"]))]
        )
        rows = transcribe(
            audio["samples"],
            audio["rate"],
            spans,
            http_recognizer(
                args.endpoint, args.model, os.environ.get("TRANSCRIPTION_API_KEY", "")
            ),
        )
        method = (
            "HTTP speech recognizer: " + args.model + "; review text and segment timing"
        )
    result = export_transcript(wav, rows, args.out, method)
    print(
        json.dumps(
            {
                "method": method,
                "duration": result["duration_seconds"],
                "segments": len(rows),
                "rows": rows,
                "output": str(args.out / "index.html"),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
