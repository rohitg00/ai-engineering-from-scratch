"""Compare published claims and their exact evidence across local corpus revisions."""

import hashlib


def compare_reports(previous, current):
    if previous.get("schema_version") != 1 or current.get("schema_version") != 1:
        raise ValueError("report schema_version1 required")
    if previous["question"] != current["question"]:
        raise ValueError("compare the same research question")

    def claims(payload):
        result = {}
        for section in payload["sections"]:
            for sentence in section["sentences"]:
                evidence = []
                for key in sentence["cites"]:
                    snippet = payload["snippets"][key]
                    evidence.append(
                        {
                            "doc_id": snippet["doc_id"],
                            "start": snippet["start"],
                            "end": snippet["end"],
                            "text_sha256": hashlib.sha256(
                                snippet["text"].encode()
                            ).hexdigest(),
                        }
                    )
                result.setdefault(sentence["text"], []).extend(evidence)
        return result

    old, new = claims(previous), claims(current)
    return {
        "schema_version": 1,
        "question": current["question"],
        "removed_claims": sorted(old.keys() - new.keys()),
        "added_claims": sorted(new.keys() - old.keys()),
        "changed_evidence": [
            {"claim": text, "before": old[text], "after": new[text]}
            for text in sorted(old.keys() & new.keys())
            if old[text] != new[text]
        ],
        "unchanged_claims": len(
            [text for text in old.keys() & new.keys() if old[text] == new[text]]
        ),
    }
