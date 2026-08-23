#!/usr/bin/env python3
"""Contract checks for the site's agent-facing discovery surfaces."""

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"


def main() -> None:
    config = json.loads((ROOT / "vercel.json").read_text())
    rewrites = config["rewrites"]
    markdown_rewrites = [r for r in rewrites if "has" in r and r["destination"] == "/llms.txt"]
    negotiator_rewrites = [r for r in rewrites if r.get("destination", "").startswith("/api/markdown")]
    assert negotiator_rewrites, "markdown negotiation rewrite is missing"
    assert all("accept" in h["key"].lower() for r in negotiator_rewrites for h in r["has"])

    headers = config["headers"]
    llms_header = next(h for h in headers if h["source"] == "/llms.txt")
    values = {h["key"].lower(): h["value"] for h in llms_header["headers"]}
    assert values["content-type"].startswith("text/markdown")
    assert values["vary"] == "Accept, Accept-Encoding"

    for name in ("404.html", "developer.html", "contact.html", "privacy.html", "openapi.json"):
        assert (SITE / name).is_file(), f"missing {name}"

    for name in ("developer.html", "contact.html", "privacy.html"):
        text = (SITE / name).read_text()
        assert "AI Engineering from Scratch" in text
        assert len(" ".join(text.split())) > 500, f"{name} is too thin to be a trust page"

    openapi = json.loads((SITE / "openapi.json").read_text())
    assert openapi["openapi"].startswith("3.")
    assert "https://aiengineeringfromscratch.com" in openapi["servers"][0]["url"]
    assert {"/llms.txt", "/sitemap.xml", "/lesson.html"} <= set(openapi["paths"])

    home = (SITE / "index.html").read_text()
    assert '"@type": "Organization"' in home
    assert '"url": "https://aiengineeringfromscratch.com"' in home
    assert '"sameAs"' in home
    assert '"contactPoint"' in home

    not_found = (SITE / "404.html").read_text()
    assert "/llms.txt" in not_found and "/sitemap.xml" in not_found
    assert (ROOT / "api" / "markdown.js").is_file()
    assert "Vary" in (ROOT / "api" / "markdown.js").read_text()
    print("agent readiness contracts: ok")


if __name__ == "__main__":
    main()
