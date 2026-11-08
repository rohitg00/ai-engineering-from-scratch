import re, hashlib, json


def _seconds(stamp):
    match = re.fullmatch("(?:(\\d{2,}):)?([0-5]\\d):([0-5]\\d)\\.(\\d{3})", stamp)
    if not match:
        raise ValueError("invalid WebVTT timestamp")
    h, m, s, ms = match.groups()
    return int(h or 0) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000


def parse_vtt(text):
    """Parse UTF-8 WebVTT text into cues {id,start,end,settings,text,duration}. Preserve timestamp strings and supplied IDs; assign cue-N to absent IDs. Allow overlapping cues with nondecreasing starts. Ignore NOTE blocks; reject STYLE/REGION blocks and malformed/duplicate/empty cues."""
    text = text.lstrip("\ufeff").replace("\r\n", "\n").replace("\r", "\n")
    blocks = re.split("\\n\\s*\\n", text.strip())
    if not blocks or not re.fullmatch("WEBVTT(?:[ \\t].*)?", blocks[0]):
        raise ValueError("WEBVTT header required on its own block")
    out = []
    seen = set()
    last = -1
    for block in blocks[1:]:
        lines = block.split("\n")
        if lines[0] == "NOTE" or lines[0].startswith(("NOTE ", "NOTE\t")):
            continue
        if lines[0] in ("STYLE", "REGION"):
            raise ValueError("STYLE and REGION are outside the supported subset")
        if "-->" in lines[0]:
            id = "cue-" + str(len(out) + 1)
        else:
            id = lines.pop(0)
        if not lines:
            raise ValueError("missing cue timing")
        timing = re.fullmatch("(\\S+)\\s+-->\\s+(\\S+)(?:[ \\t]+(.*))?", lines.pop(0))
        if (
            not timing
            or not id
            or id in seen
            or (not lines)
            or (not "\n".join(lines).strip())
        ):
            raise ValueError("malformed or duplicate cue")
        start, end, settings = timing.groups()
        a, b = (_seconds(start), _seconds(end))
        if b <= a or a < last:
            raise ValueError("invalid cue interval or order")
        last = a
        seen.add(id)
        out.append(
            {
                "id": id,
                "start": start,
                "end": end,
                "settings": settings or "",
                "text": "\n".join(lines),
                "duration": round(b - a, 3),
            }
        )
    return out


def propose(cues, translations, glossary):
    """Return cue proposals with proposed text, needs_translation and required_terms. translations maps known cue IDs to nonempty target text. glossary maps source phrases to required target phrases; replace residual source terms longest-first in supplied proposals. Missing translations retain source text and remain unapproved."""
    known = {c["id"] for c in cues}
    if not set(translations) <= known or any(
        (
            not isinstance(v, str)
            or not v.strip()
            or re.search(r"\n\s*\n", v)
            or "\r" in v
            or ("-->" in v)
            for v in translations.values()
        )
    ):
        raise ValueError("invalid translation")
    if any(
        (
            not isinstance(k, str) or not k or (not isinstance(v, str)) or (not v)
            for k, v in glossary.items()
        )
    ):
        raise ValueError("invalid glossary")
    out = []
    for c in cues:
        text = translations.get(c["id"], c["text"])
        required = []
        for source, target in sorted(glossary.items(), key=lambda p: -len(p[0])):
            pattern = "(?<!\\w)" + re.escape(source) + "(?!\\w)"
            if re.search(pattern, c["text"], re.I):
                required.append(target)
                if c["id"] in translations:
                    text = re.sub(pattern, lambda _: target, text, flags=re.I)
        out.append(
            {
                **c,
                "proposed": text,
                "needs_translation": c["id"] not in translations,
                "required_terms": required,
            }
        )
    return out


def inspect(proposals, cps=17):
    """Return review rows with characters, cps, budget and flags. Count visible non-whitespace Unicode code points after stripping cue tags; budget=floor(duration*cps). Flags identify missing translations, missing required terms and reading-budget overflow. cps must be positive and finite."""
    import math

    if not isinstance(cps, (int, float)) or not math.isfinite(cps) or cps <= 0:
        raise ValueError("invalid reading budget")
    rows = []
    for p in proposals:
        visible = re.sub("<[^>]*>", "", p["proposed"])
        characters = len(re.sub("\\s", "", visible))
        budget = math.floor(p["duration"] * cps)
        flags = []
        if p["needs_translation"]:
            flags.append("translation_missing")
        if any(
            (t.casefold() not in p["proposed"].casefold() for t in p["required_terms"])
        ):
            flags.append("glossary_missing")
        if characters > budget:
            flags.append("over_budget")
        rows.append(
            {
                **p,
                "characters": characters,
                "cps": round(characters / p["duration"], 2),
                "budget": budget,
                "flags": flags,
            }
        )
    return rows


def export_localized(proposals, decisions=None, cps=17):
    """Return {schema_version,fingerprint,cues,all_reviewed,vtt}. Review {fingerprint,cues:{id:{text,approved,override_budget?}}} is bound to proposals and reading budget. Approved text must satisfy glossary and structural syntax; over-budget approval needs explicit override_budget=true. vtt is None until every cue is approved."""
    fingerprint = hashlib.sha256(
        json.dumps({"proposals": proposals, "cps": cps}, sort_keys=True).encode()
    ).hexdigest()
    edits = (decisions or {}).get("cues", {})
    if decisions is not None and decisions.get("fingerprint") != fingerprint:
        raise ValueError("stale review")
    if not set(edits) <= {p["id"] for p in proposals}:
        raise ValueError("unknown cue decision")
    resolved = []
    for p in proposals:
        d = edits.get(p["id"], {})
        text = d.get("text", p["proposed"])
        approved = d.get("approved", False)
        if (
            not isinstance(text, str)
            or not text.strip()
            or re.search(r"\n\s*\n", text)
            or ("\r" in text)
            or ("-->" in text)
            or (type(approved) is not bool)
        ):
            raise ValueError("invalid reviewed cue")
        row = inspect(
            [
                {
                    **p,
                    "proposed": text,
                    "needs_translation": p["needs_translation"] and (not approved),
                }
            ],
            cps,
        )[0]
        if approved and (
            "glossary_missing" in row["flags"]
            or ("over_budget" in row["flags"] and d.get("override_budget") is not True)
        ):
            raise ValueError("resolve glossary or acknowledge reading-budget overflow")
        resolved.append(
            {
                **row,
                "approved": approved,
                "override_budget": d.get("override_budget", False),
            }
        )
    complete = bool(resolved) and all((r["approved"] for r in resolved))
    vtt = None
    if complete:
        vtt = (
            "WEBVTT\n\n"
            + "\n\n".join(
                (
                    r["id"]
                    + "\n"
                    + r["start"]
                    + " --> "
                    + r["end"]
                    + (" " + r["settings"] if r["settings"] else "")
                    + "\n"
                    + r["proposed"]
                    for r in resolved
                )
            )
            + "\n"
        )
    return {
        "schema_version": 1,
        "fingerprint": fingerprint,
        "cues": resolved,
        "all_reviewed": complete,
        "vtt": vtt,
    }
