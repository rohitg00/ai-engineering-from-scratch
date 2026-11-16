import asyncio
import sys

from fastmcp import Context, FastMCP
from fastmcp.tools.base import ToolResult
from mcp import types as mt

mcp = FastMCP("t20")
CALLS = {"ask_name": 0, "ask_legacy": 0}


@mcp.tool
async def ask_name(ctx: Context) -> str:
    """Ask the client for a name (modern guard pattern, SEP-2322), then greet."""
    CALLS["ask_name"] += 1
    responses = ctx.input_responses
    if not responses:
        return mt.InputRequiredResult(input_requests={
            "name": mt.ElicitRequest(params=mt.ElicitRequestFormParams(
                message="What is your name?",
                requested_schema={"type": "object", "properties": {"name": {"type": "string"}}, "required": ["name"]}))})
    r = responses["name"]
    if r.action == "accept":
        return f"hello {r.content.get('name')}"
    return f"no name ({r.action})"


@mcp.tool
async def ask_legacy(ctx: Context) -> str:
    """Ask the client for a name with imperative ctx.elicit, then greet."""
    CALLS["ask_legacy"] += 1
    r = await ctx.elicit("What is your name?", str)
    if r.action == "accept":
        return f"hello {r.data}"
    return f"no name ({r.action})"


@mcp.tool
def fail_structured() -> ToolResult:
    """Fail with isError=true and a structuredContent payload."""
    return ToolResult(content=[mt.TextContent(type="text", text="quota exceeded, retry in 30 s")],
                      structured_content={"code": 429, "retry_after": 30}, is_error=True)


@mcp.tool
def ok_structured() -> ToolResult:
    """Succeed with a structuredContent payload (control)."""
    return ToolResult(content=[mt.TextContent(type="text", text="ok")], structured_content={"code": 200})


@mcp.tool
async def long_task(steps: int, ctx: Context) -> str:
    """Report progress for each step, then finish."""
    for i in range(1, steps + 1):
        await ctx.report_progress(i, steps, f"step {i} of {steps}")
        await asyncio.sleep(0.02)
    return f"done {steps}"


if __name__ == "__main__":
    mcp.run(transport="http", host="127.0.0.1", port=int(sys.argv[1]), show_banner=False, log_level="error")
