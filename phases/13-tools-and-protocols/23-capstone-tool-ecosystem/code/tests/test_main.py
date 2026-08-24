"""Deterministic tests for the Lesson 23 in-process integration harness."""

from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch


LESSON_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = Path(__file__).resolve().parents[5]

sys.path.insert(0, str(LESSON_ROOT / "code"))

import main

sys.path.insert(0, str(REPO_ROOT / "scripts"))

from build_catalog import parse_artifact as parse_catalog_artifact
from install_skills import artifact_from_markdown


class ToolEcosystemTests(unittest.TestCase):
    def setUp(self) -> None:
        main.SPANS.clear()
        main.AUDIT.clear()
        main.TASKS.clear()

    def test_pinned_description_detects_mutation(self) -> None:
        description = next(
            tool["description"] for tool in main.TOOLS if tool["name"] == "arxiv_search"
        )
        self.assertTrue(main.pin_ok("arxiv_search", description))
        self.assertFalse(main.pin_ok("arxiv_search", description + " changed"))

    def test_finish_guarantees_positive_duration_at_clock_resolution_boundary(self) -> None:
        with patch.object(main.time, "time_ns", side_effect=[123, 123]):
            current = main.span("test", "INTERNAL", "a" * 32, None, {})
            main.finish(current)

        self.assertEqual(current["end"] - current["start"], 1)

    def test_search_uses_local_fixtures(self) -> None:
        result = main.research_arxiv_search({"query": "agent"})
        papers = json.loads(result["content"][0]["text"])
        self.assertGreaterEqual(len(papers), 1)
        self.assertFalse(result["isError"])
        self.assertEqual(result["resultType"], "complete")

    def test_server_discovery_advertises_stateless_revision_and_task_extension(self) -> None:
        result = main.server_discover(main.request_meta())

        self.assertEqual(result["supportedVersions"], ["2026-07-28"])
        self.assertEqual(result["ttlMs"], 3_600_000)
        self.assertEqual(result["cacheScope"], "public")
        self.assertIn(main.TASK_EXTENSION, result["capabilities"]["extensions"])
        self.assertEqual(result["resultType"], "complete")

    def test_unsupported_protocol_version_uses_reserved_error(self) -> None:
        meta = main.request_meta()
        meta["io.modelcontextprotocol/protocolVersion"] = "2025-11-25"

        result = main.server_discover(meta)

        self.assertEqual(result["error"]["code"], -32022)
        self.assertEqual(
            result["error"]["data"],
            {"supported": ["2026-07-28"], "requested": "2025-11-25"},
        )

    def test_missing_protocol_version_is_invalid_params(self) -> None:
        meta = main.request_meta()
        del meta["io.modelcontextprotocol/protocolVersion"]

        result = main.server_discover(meta)

        self.assertEqual(result["error"]["code"], -32602)

    def test_unknown_token_is_rejected(self) -> None:
        result = main.gateway_call(
            "unknown",
            "arxiv_search",
            {"query": "agent"},
            "a" * 32,
            "b" * 16,
            main.request_meta(),
        )
        self.assertEqual(result, {"error": "unauthenticated"})
        self.assertEqual(main.SPANS, [])

    def test_read_only_actor_cannot_generate_report(self) -> None:
        result = main.gateway_call(
            "tok_bob",
            "generate_report",
            {},
            "a" * 32,
            "b" * 16,
            main.request_meta(tasks=True),
        )
        self.assertEqual(result["error"], "insufficient_scope")
        self.assertEqual(main.AUDIT[-1]["decision"], "403")

    def test_report_uses_task_extension_and_tasks_get_returns_final_result(self) -> None:
        handle = main.gateway_call(
            "tok_alice",
            "generate_report",
            {},
            "a" * 32,
            "b" * 16,
            main.request_meta(tasks=True),
        )
        task = main.tasks_get(handle["taskId"], main.request_meta(tasks=True))

        self.assertEqual(handle["resultType"], "task")
        self.assertEqual(handle["status"], "working")
        self.assertEqual(task["resultType"], "complete")
        self.assertEqual(task["status"], "completed")
        self.assertEqual(task["result"]["content"][1]["uri"], "ui://report/current")
        self.assertIn("<!doctype html>", task["result"]["html"])

    def test_task_handle_requires_per_request_extension_capability(self) -> None:
        result = main.gateway_call(
            "tok_alice",
            "generate_report",
            {},
            "a" * 32,
            "b" * 16,
            main.request_meta(),
        )

        self.assertEqual(result["error"]["code"], -32021)
        self.assertEqual(
            result["error"]["data"]["requiredCapabilities"],
            {"extensions": {main.TASK_EXTENSION: {}}},
        )

    def test_tasks_get_rejects_non_string_ids_without_hashing_them(self) -> None:
        for task_id in ([], {}):
            with self.subTest(task_id=task_id):
                result = main.tasks_get(task_id, main.request_meta(tasks=True))
                self.assertEqual(result["error"]["code"], -32602)
                self.assertEqual(result["error"]["message"], "Unknown taskId")

    def test_delegation_span_uses_current_a2a_operation_name(self) -> None:
        main.gateway_call(
            "tok_alice",
            "generate_report",
            {},
            "a" * 32,
            "b" * 16,
            main.request_meta(tasks=True),
        )
        self.assertIn("a2a.SendMessage", {span["name"] for span in main.SPANS})

    def test_one_orchestrator_run_preserves_trace_parentage(self) -> None:
        result = main.orchestrator("tok_alice", "research agent protocols")
        run_spans = [span for span in main.SPANS if span["traceId"] == result["trace_id"]]
        roots = [span for span in run_spans if span["parentSpanId"] is None]
        self.assertEqual([span["name"] for span in roots], ["agent.invoke_agent"])
        self.assertTrue(all(span["end"] > span["start"] for span in run_spans))

    def test_shipped_blueprint_metadata_matches_course_parsers(self) -> None:
        artifact_path = LESSON_ROOT / "outputs" / "skill-ecosystem-blueprint.md"

        catalog_record = parse_catalog_artifact(artifact_path)
        self.assertIsNotNone(catalog_record)
        self.assertEqual(catalog_record["version"], "1.0.0")
        self.assertEqual(
            catalog_record["tags"],
            ["mcp", "capstone", "ecosystem", "architecture", "a2a", "otel"],
        )

        install_record = artifact_from_markdown(
            artifact_path, "skill", "skill-ecosystem-blueprint"
        )
        self.assertIsNotNone(install_record)
        self.assertEqual(install_record.phase, 13)
        self.assertEqual(install_record.lesson, 23)
        self.assertEqual(install_record.version, "1.0.0")
        self.assertIn("capstone", install_record.tags)


if __name__ == "__main__":
    unittest.main()
