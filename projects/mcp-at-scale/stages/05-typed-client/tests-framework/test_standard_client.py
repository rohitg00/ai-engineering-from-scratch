import asyncio
import json, os, sys, unittest
from pathlib import Path
from contextlib import AsyncExitStack
from mcp import ClientSession, StdioServerParameters

W = Path(os.environ["PROJECT_WORKSPACE"])
from mcp.client.stdio import stdio_client


class StandardClientTests(unittest.TestCase):
    async def open_client(self):
        self.stack = AsyncExitStack()
        read, write = await self.stack.enter_async_context(
            stdio_client(
                StdioServerParameters(
                    command=sys.executable,
                    args=[
                        str(W / "cli.py"),
                        str(W / "samples/inventory.json"),
                        "--serve",
                    ],
                )
            )
        )
        self.client = await self.stack.enter_async_context(
            ClientSession(read, write, read_timeout_seconds=5)
        )
        self.initialized = await self.client.initialize()

    async def close_client(self):
        await self.stack.aclose()

    async def case_negotiates_declared_protocol(self):
        self.assertEqual(self.initialized.protocol_version, "2025-11-25")

    async def case_scoped_listing_includes_search(self):
        result = await self.client.list_tools()
        self.assertEqual(len(result.tools), 16)
        self.assertIn("catalog_search", [tool.name for tool in result.tools])

    async def case_search_uses_exact_character_budget(self):
        result = await self.client.call_tool(
            "catalog_search", {"query": "pods count", "max_chars": 500}
        )
        data = json.loads(result.content[0].text)
        self.assertLessEqual(data["characters"], 500)
        self.assertEqual(data["tools"][0]["name"], "pods_count")

    async def case_inventory_read_crosses_real_stdio(self):
        result = await self.client.call_tool("pods_count", {})
        self.assertEqual(json.loads(result.content[0].text), 2)

    async def case_argument_failure_is_tool_error(self):
        result = await self.client.call_tool("pods_count", {"extra": True})
        self.assertTrue(result.is_error)


def synchronous_case(fn):
    def run(self):
        async def scenario():
            await self.open_client()
            try:
                await fn(self)
            finally:
                await self.close_client()

        asyncio.run(scenario())

    return run


for name, fn in list(StandardClientTests.__dict__.items()):
    if name.startswith("case_"):
        setattr(StandardClientTests, "test_" + name[5:], synchronous_case(fn))
