"""Compare provenance-bound recorded prompt runs and return a CI exit status."""

import argparse, hashlib, json
from pathlib import Path
from main import compare, release_gate, validate_cases


def case_digest(cases):
    return hashlib.sha256(
        json.dumps(cases, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def load_run(raw, cases):
    if raw.get("schema_version") != 1 or raw.get("case_sha256") != case_digest(cases):
        raise ValueError("recording does not match cases")
    if (
        not isinstance(raw.get("model"), str)
        or not raw["model"]
        or not isinstance(raw.get("settings"), dict)
        or not isinstance(raw.get("revision"), str)
    ):
        raise ValueError("recording provenance required")
    template = raw.get("prompt_template")
    if (
        not isinstance(template, str)
        or not template
        or raw.get("template_sha256") != hashlib.sha256(template.encode()).hexdigest()
    ):
        raise ValueError("recorded prompt template and matching digest required")
    if not isinstance(raw.get("responses"), dict):
        raise ValueError("recorded response mapping required")
    return raw


def run(cases, baseline, candidate, allow_configuration_change=False):
    validate_cases(cases)
    old = load_run(baseline, cases)
    new = load_run(candidate, cases)
    changed = old["model"] != new["model"] or old["settings"] != new["settings"]
    if changed and not allow_configuration_change:
        raise ValueError("model/settings changed; explicitly allow this experiment")
    comparison = compare(cases, old["responses"], new["responses"])
    return {
        "schema_version": 1,
        "case_sha256": case_digest(cases),
        "revisions": [old["revision"], new["revision"]],
        "configuration_changed": changed,
        "prompt_templates": [
            {
                "revision": item["revision"],
                "text": item["prompt_template"],
                "sha256": item["template_sha256"],
            }
            for item in (old, new)
        ],
        "comparison": comparison,
        "gate": release_gate(comparison),
    }


def main():
    p = argparse.ArgumentParser(description=__doc__)
    for key in ["cases", "baseline", "candidate"]:
        p.add_argument(key)
    p.add_argument("--allow-configuration-change", action="store_true")
    p.add_argument("--out")
    p.add_argument("--markdown")
    a = p.parse_args()
    result = run(
        *(
            json.loads(Path(getattr(a, k)).read_text())
            for k in ["cases", "baseline", "candidate"]
        ),
        a.allow_configuration_change,
    )
    text = json.dumps(result, indent=2)
    if a.out:
        Path(a.out).write_text(text + "\n")
    if a.markdown:
        lines = [
            "# Prompt revision comparison",
            "",
            "| Case | Change |",
            "|---|---|",
        ] + [
            "| " + row["id"].replace("|", "\\|") + " | " + row["state"] + " |"
            for row in result["comparison"]["cases"]
        ]
        Path(a.markdown).write_text("\n".join(lines) + "\n")
    print(text)
    return 0 if result["gate"]["decision"] == "ship" else 1


if __name__ == "__main__":
    raise SystemExit(main())
