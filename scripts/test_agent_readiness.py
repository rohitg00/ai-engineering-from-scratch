#!/usr/bin/env python3
"""Contract checks for the site's agent-facing discovery surfaces."""

import json
import re
from pathlib import Path
from urllib.parse import unquote


ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"
WEBSITE_ID = "https://aiengineeringfromscratch.com/#website"
COURSE_ID = "https://aiengineeringfromscratch.com/#course"


def load_json_ld(path: Path) -> list[dict]:
    blocks = re.findall(
        r'<script\s+type="application/ld\+json"\s*>(.*?)</script>',
        path.read_text(),
        flags=re.IGNORECASE | re.DOTALL,
    )
    return [json.loads(block) for block in blocks]


def assert_public_html_route(
    paths: dict, route: str, parameter_name: str, operation_suffix: str
) -> None:
    path_item = paths[route]
    parameters = {
        (parameter["in"], parameter["name"]): parameter
        for parameter in path_item["parameters"]
    }
    query_parameter = parameters[("query", parameter_name)]
    assert query_parameter["required"] is True
    assert query_parameter["schema"]["type"] == "string"

    expected_statuses = {"200", "308", "404", "405", "500"}
    for method in ("get", "head"):
        operation = path_item[method]
        assert operation.get("deprecated") is not True
        assert operation["operationId"].lower().endswith(operation_suffix)
        assert expected_statuses <= set(operation["responses"])
        assert operation["responses"]["308"] == {
            "$ref": "#/components/responses/PermanentRedirect"
        }

    get_responses = path_item["get"]["responses"]
    assert "text/html" in get_responses["200"]["content"]
    assert "text/html" in get_responses["404"]["content"]


def assert_legacy_redirect(paths: dict, route: str, parameter_name: str) -> None:
    path_item = paths[route]
    parameter = path_item["parameters"][0]
    assert parameter["name"] == parameter_name
    assert parameter["in"] == "query"
    assert parameter["required"] is True
    for method in ("get", "head"):
        operation = path_item[method]
        assert operation["deprecated"] is True
        assert set(operation["responses"]) == {"308"}
        assert "Location" in operation["responses"]["308"]["headers"]


def main() -> None:
    config = json.loads((ROOT / "vercel.json").read_text())
    rewrites = config["rewrites"]
    markdown_rewrites = [r for r in rewrites if "has" in r and r["destination"] == "/llms.txt"]
    negotiator_rewrites = [r for r in rewrites if r.get("destination", "").startswith("/api/markdown")]
    assert negotiator_rewrites, "markdown negotiation rewrite is missing"
    assert all("accept" in h["key"].lower() for r in negotiator_rewrites for h in r["has"])

    route_rewrites = {rewrite["source"]: rewrite["destination"] for rewrite in rewrites}
    assert route_rewrites["/lesson"] == "/api/lesson"
    assert route_rewrites["/certification"] == "/api/certification"
    assert "/lesson.html" not in route_rewrites
    assert "/certification.html" not in route_rewrites

    legacy_routes = {route["src"]: route for route in config["routes"]}
    assert legacy_routes[r"/lesson\.html"] == {
        "src": r"/lesson\.html",
        "methods": ["GET", "HEAD"],
        "dest": "/api/lesson?legacy=1",
    }
    assert legacy_routes[r"/certification\.html"] == {
        "src": r"/certification\.html",
        "methods": ["GET", "HEAD"],
        "dest": "/api/certification?legacy=1",
    }

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
    paths = openapi["paths"]
    assert {
        "/llms.txt",
        "/sitemap.xml",
        "/lesson",
        "/certification",
        "/lesson.html",
        "/certification.html",
    } <= set(paths)
    assert_public_html_route(paths, "/lesson", "path", "lesson")
    assert_public_html_route(paths, "/certification", "id", "certification")
    assert_legacy_redirect(paths, "/lesson.html", "path")
    assert_legacy_redirect(paths, "/certification.html", "id")
    redirect_response = openapi["components"]["responses"]["PermanentRedirect"]
    assert redirect_response["headers"]["Location"]["schema"]["type"] == "string"

    lesson_manifest = json.loads((SITE / "lesson-seo.json").read_text())
    lessons = lesson_manifest["lessons"]
    assert len(lessons) >= 500, "lesson SEO manifest regressed to a generic shell"
    assert all(entry["path"] == lesson_path for lesson_path, entry in lessons.items())
    assert all(
        entry["canonicalUrl"].startswith(
            "https://aiengineeringfromscratch.com/lesson?path="
        )
        and "/lesson.html?" not in entry["canonicalUrl"]
        for entry in lessons.values()
    )

    certification_manifest = json.loads((SITE / "certification-seo.json").read_text())
    tracks = certification_manifest["tracks"]
    assert len(tracks) >= 4, "certification SEO manifest regressed to a generic shell"
    assert all(entry["id"] == track_id for track_id, entry in tracks.items())
    assert all(
        entry["canonicalUrl"].startswith(
            "https://aiengineeringfromscratch.com/certification?id="
        )
        and "/certification.html?" not in entry["canonicalUrl"]
        for entry in tracks.values()
    )

    sitemap = (SITE / "sitemap.xml").read_text()
    assert sitemap.count("/lesson?path=") == len(lessons)
    sitemap_lessons = {
        unquote(value)
        for value in re.findall(r"/lesson\?path=([^<&]+)", sitemap)
    }
    assert sitemap_lessons == set(lessons)
    assert sitemap.count("/certification?id=") == len(tracks)
    assert "/lesson.html?" not in sitemap
    assert "/certification.html?" not in sitemap

    templates_and_markers = (
        ("lesson.html", "AIFS:LESSON-SEO:START", "AIFS:LESSON-FALLBACK:START"),
        (
            "certification.html",
            "AIFS:CERTIFICATION-SEO:START",
            "AIFS:CERTIFICATION-FALLBACK:START",
        ),
    )
    for template_name, seo_marker, fallback_marker in templates_and_markers:
        template = (SITE / template_name).read_text()
        assert template.count(seo_marker) == 1
        assert template.count(fallback_marker) == 1

    for name in ("lesson.js", "certification.js"):
        assert (ROOT / "api" / name).is_file(), f"missing api/{name}"
    assert (ROOT / "scripts" / "test_seo_routes.js").is_file()

    home_schema = load_json_ld(SITE / "index.html")[0]
    home_graph = {node["@type"]: node for node in home_schema["@graph"]}
    assert set(home_graph) == {"WebSite", "Course"}
    assert home_graph["WebSite"]["@id"] == WEBSITE_ID
    assert home_graph["Course"]["@id"] == COURSE_ID
    assert home_graph["Course"]["hasCourseInstance"] == {
        "@type": "CourseInstance",
        "courseMode": "online",
    }

    about_schema = load_json_ld(SITE / "about.html")[0]
    assert about_schema["@type"] == "AboutPage"
    assert about_schema["isPartOf"] == {"@id": WEBSITE_ID}
    assert about_schema["about"] == {"@id": COURSE_ID}

    identity_json = json.dumps([home_schema, about_schema])
    for false_field in (
        "Person",
        "Organization",
        "alternateName",
        "contactPoint",
        "founder",
        "publisher",
        "provider",
        "instructor",
        "rohitghumare.com",
    ):
        assert false_field not in identity_json

    not_found = (SITE / "404.html").read_text()
    assert "/llms.txt" in not_found and "/sitemap.xml" in not_found
    assert (ROOT / "api" / "markdown.js").is_file()
    assert "Vary" in (ROOT / "api" / "markdown.js").read_text()
    print("agent readiness contracts: ok")


if __name__ == "__main__":
    main()
