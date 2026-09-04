#!/usr/bin/env python3
"""Validate external HTTP/HTTPS links in every markdown doc.

Requires Python 3.10+ (PEP 604 union types).

Walks every `*.md` file under the repo (excluding `.git/`, `node_modules/`,
`outputs/`), extracts `https?://` URLs from markdown link syntax and bare URLs,
deduplicates, and validates each unique URL by HEAD request (falling back to
GET on 405/501). Results are cached for 7 days at `.link-cache.json` (repo
root, gitignored) so re-runs do not hammer external services.

Stdlib only. No `requests`, no `httpx`.

Usage:
    python3 scripts/link_check.py                       # full check, group by file
    python3 scripts/link_check.py --phase 14            # one phase
    python3 scripts/link_check.py --path README.md      # one file
    python3 scripts/link_check.py --path phases/14-... # one directory
    python3 scripts/link_check.py --strict              # exit 1 on any broken link
    python3 scripts/link_check.py --json                # machine-readable
    python3 scripts/link_check.py --cache 0             # bypass cache for this run
    python3 scripts/link_check.py --timeout 15          # per-request timeout (sec)
    python3 scripts/link_check.py --concurrency 16      # worker threads

Companion to `scripts/audit_lessons.py` (rule L010 validates *internal* links);
this script handles the external HTTP/HTTPS surface.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import socket
import ssl
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable
from urllib import error as urlerror
from urllib import request as urlrequest
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
CACHE_PATH = ROOT / ".link-cache.json"
CACHE_SCHEMA_VERSION = 1
USER_AGENT = (
    "ai-engineering-from-scratch link-check/1.0 "
    "(+https://aiengineeringfromscratch.com)"
)
DEFAULT_TIMEOUT = 10
DEFAULT_CONCURRENCY = 8
DEFAULT_CACHE_DAYS = 7
DEFAULT_SKIP_DOMAINS = (
    "twitter.com",
    "x.com",
    "linkedin.com",
    "instagram.com",
    "medium.com",
)
EXCLUDE_DIRS = {".git", "node_modules", "outputs"}

MD_LINK_RE = re.compile(r"\[[^\]]*\]\((<?)(https?://[^\s)>]+)>?\)")
BARE_URL_RE = re.compile(r"(?<![\w(\[=\"'])(https?://[^\s)\]<>\"'`]+)")
TRAILING_PUNCT = ".,;:!?)\"'>"


@dataclass
class UrlOccurrence:
    file: str
    line: int


@dataclass
class CheckResult:
    url: str
    status: str
    http_status: int | None
    error: str | None
    cached: bool = False

    @property
    def ok(self) -> bool:
        return self.status == "ok"


@dataclass
class Report:
    checked_files: int = 0
    unique_urls: int = 0
    requested: int = 0
    cached_hits: int = 0
    skipped: list[str] = field(default_factory=list)
    failed: list[dict[str, object]] = field(default_factory=list)
    by_file: dict[str, list[dict[str, object]]] = field(default_factory=dict)

    def to_dict(self) -> dict[str, object]:
        return {
            "schema_version": 1,
            "checked_files": self.checked_files,
            "unique_urls": self.unique_urls,
            "requested": self.requested,
            "cached_hits": self.cached_hits,
            "skipped_count": len(self.skipped),
            "failed_count": len(self.failed),
            "skipped": sorted(set(self.skipped)),
            "failed": self.failed,
            "by_file": self.by_file,
        }


def iter_markdown_files(
    root: Path, phase: int | None, path: Path | None
) -> Iterable[Path]:
    if path is not None:
        path = path.resolve()
        if path.is_file():
            if path.suffix == ".md":
                yield path
            return
        roots = [path]
    elif phase is not None:
        phase_prefix = f"{phase:02d}-"
        phases_dir = root / "phases"
        if not phases_dir.is_dir():
            return
        matches = [p for p in phases_dir.iterdir() if p.is_dir() and p.name.startswith(phase_prefix)]
        if not matches:
            return
        roots = matches
    else:
        roots = [root]

    for r in roots:
        if r.is_file():
            if r.suffix == ".md":
                yield r
            continue
        for dirpath, dirnames, filenames in os.walk(r):
            dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
            for name in filenames:
                if name.endswith(".md"):
                    yield Path(dirpath) / name


def strip_trailing_punct(url: str) -> str:
    while url and url[-1] in TRAILING_PUNCT:
        url = url[:-1]
    return url


def extract_urls(text: str) -> list[tuple[str, int]]:
    """Return list of (url, line_number) tuples preserving order."""
    out: list[tuple[str, int]] = []
    seen_per_line: set[tuple[int, str]] = set()
    for lineno, line in enumerate(text.splitlines(), start=1):
        for m in MD_LINK_RE.finditer(line):
            url = strip_trailing_punct(m.group(2))
            key = (lineno, url)
            if key in seen_per_line:
                continue
            seen_per_line.add(key)
            out.append((url, lineno))
        masked = MD_LINK_RE.sub(" ", line)
        for m in BARE_URL_RE.finditer(masked):
            url = strip_trailing_punct(m.group(1))
            key = (lineno, url)
            if key in seen_per_line:
                continue
            seen_per_line.add(key)
            out.append((url, lineno))
    return out


def load_cache() -> dict[str, dict[str, object]]:
    if not CACHE_PATH.is_file():
        return {}
    try:
        raw = json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    if not isinstance(raw, dict):
        return {}
    if raw.get("schema_version") != CACHE_SCHEMA_VERSION:
        return {}
    entries = raw.get("entries")
    return entries if isinstance(entries, dict) else {}


def save_cache(entries: dict[str, dict[str, object]]) -> None:
    payload = {"schema_version": CACHE_SCHEMA_VERSION, "entries": entries}
    try:
        CACHE_PATH.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
    except OSError as exc:
        print(f"warning: could not write {CACHE_PATH.name}: {exc}", file=sys.stderr)


def cache_is_fresh(entry: dict[str, object], cache_days: int) -> bool:
    if cache_days <= 0:
        return False
    checked_at = entry.get("checked_at")
    if not isinstance(checked_at, (int, float)):
        return False
    age = time.time() - float(checked_at)
    return age < cache_days * 86400


def domain_of(url: str) -> str:
    try:
        netloc = urlparse(url).netloc.lower()
    except ValueError:
        return ""
    if netloc.startswith("www."):
        netloc = netloc[4:]
    if ":" in netloc:
        netloc = netloc.split(":", 1)[0]
    return netloc


def should_skip(url: str, skip_domains: set[str]) -> bool:
    domain = domain_of(url)
    if not domain:
        return False
    for sd in skip_domains:
        if domain == sd or domain.endswith("." + sd):
            return True
    return False


def _request(url: str, method: str, timeout: int) -> tuple[int | None, str | None]:
    req = urlrequest.Request(
        url,
        method=method,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "*/*",
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    ctx = ssl.create_default_context()
    try:
        with urlrequest.urlopen(req, timeout=timeout, context=ctx) as resp:
            return resp.status, None
    except urlerror.HTTPError as exc:
        return exc.code, f"http {exc.code}"
    except urlerror.URLError as exc:
        reason = getattr(exc, "reason", exc)
        return None, f"url-error: {reason}"
    except socket.timeout:
        return None, "timeout"
    except (TimeoutError, ConnectionError) as exc:
        return None, f"conn-error: {exc}"
    except ssl.SSLError as exc:
        return None, f"ssl-error: {exc}"
    except Exception as exc:
        return None, f"error: {exc.__class__.__name__}: {exc}"


def check_url(url: str, timeout: int) -> CheckResult:
    status_code, err = _request(url, "HEAD", timeout)
    if status_code in (405, 501) or (status_code is None and err and "http" not in err):
        get_status, get_err = _request(url, "GET", timeout)
        if get_status is not None:
            status_code, err = get_status, get_err
        elif status_code is None:
            status_code, err = get_status, get_err

    if status_code is None:
        return CheckResult(url=url, status="error", http_status=None, error=err or "unknown")
    if 200 <= status_code < 400:
        return CheckResult(url=url, status="ok", http_status=status_code, error=None)
    return CheckResult(url=url, status="broken", http_status=status_code, error=err or f"http {status_code}")


def run(args: argparse.Namespace) -> int:
    if args.path is not None:
        path_arg: Path | None = Path(args.path)
        if not path_arg.is_absolute():
            path_arg = (Path.cwd() / path_arg).resolve()
    else:
        path_arg = None

    skip_env = os.environ.get("LINK_CHECK_SKIP", "")
    if skip_env.strip():
        skip_domains = {d.strip().lower() for d in skip_env.split(",") if d.strip()}
    else:
        skip_domains = set(DEFAULT_SKIP_DOMAINS)

    files = sorted(set(iter_markdown_files(ROOT, args.phase, path_arg)))

    occurrences: dict[str, list[UrlOccurrence]] = {}
    for f in files:
        try:
            text = f.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        try:
            rel = f.relative_to(ROOT).as_posix()
        except ValueError:
            rel = str(f)
        for url, line in extract_urls(text):
            occurrences.setdefault(url, []).append(UrlOccurrence(file=rel, line=line))

    report = Report(checked_files=len(files), unique_urls=len(occurrences))

    cache = load_cache()
    to_check: list[str] = []
    results: dict[str, CheckResult] = {}

    for url in occurrences:
        if should_skip(url, skip_domains):
            report.skipped.append(url)
            continue
        entry = cache.get(url)
        if entry and cache_is_fresh(entry, args.cache):
            status = str(entry.get("status", "error"))
            http_status = entry.get("http_status")
            http_status_int = int(http_status) if isinstance(http_status, (int, float)) else None
            err = entry.get("last_error")
            results[url] = CheckResult(
                url=url,
                status=status,
                http_status=http_status_int,
                error=str(err) if err else None,
                cached=True,
            )
            report.cached_hits += 1
            continue
        to_check.append(url)

    report.requested = len(to_check)

    if to_check:
        with ThreadPoolExecutor(max_workers=max(1, args.concurrency)) as executor:
            futures = {executor.submit(check_url, url, args.timeout): url for url in to_check}
            for fut in as_completed(futures):
                url = futures[fut]
                try:
                    result = fut.result()
                except Exception as exc:
                    result = CheckResult(
                        url=url, status="error", http_status=None, error=f"executor: {exc}"
                    )
                results[url] = result
                cache[url] = {
                    "status": result.status,
                    "http_status": result.http_status,
                    "checked_at": time.time(),
                    "last_error": result.error,
                }
                if not args.json:
                    mark = "OK" if result.ok else "FAIL"
                    code = result.http_status if result.http_status is not None else "-"
                    print(f"  [{mark}] {code} {url}", file=sys.stderr)

    save_cache(cache)

    by_file: dict[str, list[dict[str, object]]] = {}
    for url, occs in occurrences.items():
        result = results.get(url)
        if result is None:
            continue
        if result.ok:
            continue
        for occ in occs:
            entry = {
                "url": url,
                "line": occ.line,
                "status": result.status,
                "http_status": result.http_status,
                "error": result.error,
                "cached": result.cached,
            }
            by_file.setdefault(occ.file, []).append(entry)
            report.failed.append({"file": occ.file, **entry})

    for fname in by_file:
        by_file[fname].sort(key=lambda e: (e["line"], e["url"]))
    report.by_file = dict(sorted(by_file.items()))

    if args.json:
        json.dump(report.to_dict(), sys.stdout, indent=2, sort_keys=True)
        sys.stdout.write("\n")
    else:
        print(f"checked {report.checked_files} markdown files", file=sys.stderr)
        print(f"unique urls: {report.unique_urls}", file=sys.stderr)
        print(f"requested:   {report.requested}", file=sys.stderr)
        print(f"cache hits:  {report.cached_hits}", file=sys.stderr)
        print(f"skipped:     {len(set(report.skipped))} urls in {len(skip_domains)} domains", file=sys.stderr)
        print(f"broken:      {len(report.failed)} occurrences across {len(report.by_file)} files", file=sys.stderr)
        if report.by_file:
            print("", file=sys.stderr)
            for fname, entries in report.by_file.items():
                print(fname, file=sys.stderr)
                for e in entries:
                    code = e["http_status"] if e["http_status"] is not None else e["error"]
                    print(f"  line {e['line']}: [{code}] {e['url']}", file=sys.stderr)

    if args.strict and report.failed:
        return 1
    return 0


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate external HTTP/HTTPS links across markdown docs.",
    )
    parser.add_argument("--phase", type=int, default=None, help="restrict to phase NN")
    parser.add_argument("--path", default=None, help="restrict to one file or directory")
    parser.add_argument("--strict", action="store_true", help="exit 1 if any link is broken")
    parser.add_argument("--json", action="store_true", help="emit machine-readable report")
    parser.add_argument(
        "--timeout",
        type=int,
        default=DEFAULT_TIMEOUT,
        help=f"per-request timeout in seconds (default: {DEFAULT_TIMEOUT})",
    )
    parser.add_argument(
        "--concurrency",
        type=int,
        default=DEFAULT_CONCURRENCY,
        help=f"worker threads (default: {DEFAULT_CONCURRENCY})",
    )
    parser.add_argument(
        "--cache",
        type=int,
        default=DEFAULT_CACHE_DAYS,
        help=f"cache TTL in days; 0 disables (default: {DEFAULT_CACHE_DAYS})",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(sys.argv[1:] if argv is None else argv)
    return run(args)


if __name__ == "__main__":
    sys.exit(main())
