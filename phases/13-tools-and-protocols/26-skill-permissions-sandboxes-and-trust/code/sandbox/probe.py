"""Probe observable container boundaries and print one JSON report."""

from __future__ import annotations

import json
import os
import socket
from pathlib import Path
from typing import Callable


def attempt(operation: Callable[[], str]) -> dict[str, object]:
    try:
        return {"ok": True, "result": operation()}
    except Exception as error:
        return {"ok": False, "error": type(error).__name__}


def read_input() -> str:
    return Path("/input/message.txt").read_text(encoding="utf-8").strip()


def write_image() -> str:
    target = Path("/app/escape.txt")
    target.write_text("unexpected\n", encoding="utf-8")
    return str(target)


def write_temporary() -> str:
    target = Path("/tmp/probe.txt")
    target.write_text("bounded\n", encoding="utf-8")
    return target.read_text(encoding="utf-8").strip()


def open_network() -> str:
    with socket.create_connection(("example.com", 443), timeout=1.0) as connection:
        return str(connection.getpeername())


def main() -> None:
    input_result = attempt(read_input)
    image_write = attempt(write_image)
    temporary_write = attempt(write_temporary)
    network = attempt(open_network)
    report = {
        "declaredInput": input_result,
        "imageFilesystemWrite": image_write,
        "temporaryWrite": temporary_write,
        "networkConnection": network,
        "visibleEnvironmentNames": sorted(os.environ),
        "declaredEnvironmentValue": os.environ.get("DEMO_VALUE"),
    }
    report["passed"] = bool(
        input_result["ok"]
        and not image_write["ok"]
        and temporary_write["ok"]
        and not network["ok"]
        and report["declaredEnvironmentValue"] == "bounded"
    )
    print(json.dumps(report, indent=2, sort_keys=True))
    raise SystemExit(0 if report["passed"] else 1)


if __name__ == "__main__":
    main()
