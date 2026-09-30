import asyncio
import json, os, sys, unittest
from pathlib import Path
from contextlib import AsyncExitStack
from mcp import ClientSession, StdioServerParameters

W = Path(os.environ["PROJECT_WORKSPACE"])
import subprocess, tempfile
import httpx2
from mcp.client.streamable_http import streamable_http_client


class StandardClientTests(unittest.TestCase):
    async def open_client(self):
        self.temp = tempfile.TemporaryDirectory()
        self.stack = AsyncExitStack()
        self.server = subprocess.Popen(
            [
                "node",
                str(W / "cli.ts"),
                "--data-dir",
                self.temp.name,
                "--serve",
                "--port",
                "0",
            ],
            env={**os.environ, "MEMORY_TOKEN": "sdk-local-fixture"},
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        line = self.server.stdout.readline()
        if not line:
            raise RuntimeError(self.server.stderr.read())
        url = json.loads(line)["mcp"]
        http = await self.stack.enter_async_context(
            httpx2.AsyncClient(headers={"Authorization": "Bearer sdk-local-fixture"})
        )
        read, write = await self.stack.enter_async_context(
            streamable_http_client(url, http_client=http)
        )
        self.client = await self.stack.enter_async_context(
            ClientSession(read, write, read_timeout_seconds=5)
        )
        self.initialized = await self.client.initialize()

    async def close_client(self):
        await self.stack.aclose()
        self.server.terminate()
        self.server.wait(timeout=10)
        self.server.stdout.close()
        self.server.stderr.close()
        self.temp.cleanup()

    async def put(self, revision=0):
        return await self.client.call_tool(
            "memory_put",
            {
                "memory": {
                    "id": "sdk",
                    "namespace": "docs",
                    "text": "cache policy is versioned",
                    "source": "sdk-fixture:1",
                },
                "expectedRevision": revision,
            },
        )

    async def case_version_and_complete_schema(self):
        self.assertEqual(self.initialized.protocol_version, "2025-11-25")
        tools = await self.client.list_tools()
        put = next(t for t in tools.tools if t.name == "memory_put")
        self.assertEqual(
            put.input_schema["properties"]["memory"]["required"],
            ["id", "namespace", "text", "source"],
        )

    async def case_write_retains_source(self):
        result = await self.put()
        data = json.loads(result.content[0].text)
        self.assertEqual(data["source"], "sdk-fixture:1")
        self.assertEqual(data["revision"], 1)

    async def case_search_returns_versioned_evidence(self):
        await self.put()
        result = await self.client.call_tool(
            "memory_search", {"namespace": "docs", "query": "cache policy"}
        )
        self.assertEqual(json.loads(result.content[0].text)[0]["revision"], 1)

    async def case_conflict_is_tool_error(self):
        await self.put()
        self.assertTrue((await self.put()).is_error)

    async def case_namespace_isolation(self):
        await self.put()
        result = await self.client.call_tool(
            "memory_search", {"namespace": "private", "query": "cache policy"}
        )
        self.assertEqual(json.loads(result.content[0].text), [])


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
