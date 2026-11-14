import asyncio
import os
import sys
import time
from pathlib import Path

MARK = Path(os.environ.get("T12_MARK_DIR", Path(__file__).resolve().parent.parent / "T12" / "_marks"))
MARK.mkdir(parents=True, exist_ok=True)
(MARK / f"LAUNCHED-{os.getpid()}-{time.time_ns()}").write_text(" ".join(sys.argv) + "\n")

from fastmcp import FastMCP
from fastmcp.exceptions import ToolError

mcp = FastMCP("t12")


@mcp.tool
def add(a: int, b: int) -> int:
    """Add two integers."""
    return a + b


@mcp.tool
def fail(reason: str) -> str:
    """Always fails with the given reason."""
    raise ToolError(f"refused: {reason}")


@mcp.tool
def boom() -> str:
    """Raises an unexpected Python error."""
    raise RuntimeError("unexpected internal failure")


@mcp.tool
async def slow(seconds: float) -> str:
    """Sleep, then answer."""
    await asyncio.sleep(seconds)
    return f"slept {seconds}"


@mcp.tool
def crash() -> str:
    """Kill the server process mid-call."""
    os._exit(3)


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "stdio"
    if mode == "http":
        mcp.run(transport="http", host="127.0.0.1", port=int(sys.argv[2]), show_banner=False, log_level="error")
    else:
        mcp.run(show_banner=False, log_level="error")
