"""Tests for the stateless MCP and registry boundary model."""

from __future__ import annotations

import sys
import time
import unittest
from pathlib import Path
from unittest.mock import patch


LESSON_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(LESSON_ROOT / "code"))

import main


class MCPRegistryCapstoneTests(unittest.TestCase):
    def setUp(self) -> None:
        self.readonly = main.build_readonly_server()
        self.destructive = main.build_destructive_server()

    def token(
        self,
        server: main.MCPServer,
        *scopes: str,
        issuer: str | None = None,
        audience: str | None = None,
        expires_at: float | None = None,
    ) -> main.Token:
        return main.Token(
            "learner",
            issuer or server.trusted_issuer,
            audience or server.url,
            frozenset(scopes),
            expires_at if expires_at is not None else time.time() + 3_600,
        )

    def approval(
        self,
        server: main.MCPServer,
        args: dict,
        *,
        actor: str = "learner",
        tool: str = "jira.create",
        target: str | None = None,
        expires_at: float | None = None,
    ) -> main.ApprovalRecord:
        return main.ApprovalRecord.for_action(
            actor,
            tool,
            args,
            target or server.url,
            expires_at if expires_at is not None else time.time() + 900,
        )

    def test_discover_advertises_current_revision_without_session_state(self) -> None:
        result = self.readonly.discover(main.request_meta())

        self.assertEqual(result["supportedVersions"], ["2026-07-28"])
        self.assertEqual(result["ttlMs"], 3_600_000)
        self.assertEqual(result["cacheScope"], "public")
        self.assertEqual(result["resultType"], "complete")
        self.assertNotIn("session", result)
        self.assertEqual(
            result["_meta"]["io.modelcontextprotocol/serverInfo"]["name"],
            self.readonly.name,
        )

    def test_unsupported_version_uses_reserved_error_and_exact_data(self) -> None:
        meta = main.request_meta()
        meta["io.modelcontextprotocol/protocolVersion"] = "2025-11-25"

        result = self.readonly.discover(meta)

        self.assertEqual(result["error"]["code"], -32022)
        self.assertEqual(
            result["error"]["data"],
            {"supported": ["2026-07-28"], "requested": "2025-11-25"},
        )

    def test_missing_or_non_string_version_is_invalid_params(self) -> None:
        for requested in (None, 20260728, ["2026-07-28"]):
            with self.subTest(requested=requested):
                meta = main.request_meta()
                if requested is None:
                    del meta["io.modelcontextprotocol/protocolVersion"]
                else:
                    meta["io.modelcontextprotocol/protocolVersion"] = requested

                result = self.readonly.discover(meta)

                self.assertEqual(result["error"]["code"], -32602)
                self.assertNotIn("data", result["error"])

    def test_tools_list_is_deterministic_cacheable_and_typed(self) -> None:
        result = self.readonly.tools_list(main.request_meta())

        names = [tool["name"] for tool in result["tools"]]
        self.assertEqual(names, sorted(names))
        self.assertEqual(result["ttlMs"], 60_000)
        self.assertEqual(result["cacheScope"], "private")
        self.assertTrue(all("inputSchema" in tool for tool in result["tools"]))

    def test_registry_document_and_runtime_discovery_remain_separate(self) -> None:
        registry = main.Registry()
        registry.register(self.readonly)

        metadata = registry.entries[self.readonly.name]
        runtime = registry.runtime_discovery[self.readonly.name]
        self.assertEqual(metadata["$schema"], main.REGISTRY_SCHEMA)
        self.assertEqual(metadata["remotes"][0]["type"], "streamable-http")
        self.assertNotIn("tools", metadata)
        self.assertIn("capabilities", runtime)

    def test_example_domain_identity_uses_reverse_dns_in_both_layers(self) -> None:
        self.assertEqual(main.reverse_dns_namespace(main.PUBLISHER_DOMAIN), "com.example")

        for server in (self.readonly, self.destructive):
            with self.subTest(server=server.name):
                document = server.registry_document()
                discovery = server.discover(main.request_meta())
                server_info = discovery["_meta"]["io.modelcontextprotocol/serverInfo"]

                self.assertTrue(document["name"].startswith("com.example/"))
                self.assertEqual(server_info["name"], document["name"])
                self.assertEqual(server_info["version"], document["version"])
                self.assertEqual(
                    main.validate_publisher_namespace(document, main.PUBLISHER_DOMAIN),
                    [],
                )

    def test_registry_rejects_name_outside_verified_domain_namespace(self) -> None:
        wrong_namespace = ".".join(("io", "example"))
        self.readonly.name = f"{wrong_namespace}/internal-readonly"

        with self.assertRaisesRegex(ValueError, "name namespace must be com.example"):
            main.Registry().register(self.readonly)

    def test_registry_rejects_publication_runtime_identity_drift(self) -> None:
        mismatches = (
            ("name", "com.example/different-server", "runtime serverInfo.name"),
            ("version", "2.0.0", "runtime serverInfo.version"),
        )
        for field, value, expected in mismatches:
            with self.subTest(field=field):
                discovery = self.readonly.discover(main.request_meta())
                discovery["_meta"]["io.modelcontextprotocol/serverInfo"][field] = value

                with patch.object(self.readonly, "discover", return_value=discovery):
                    with self.assertRaisesRegex(ValueError, expected):
                        main.Registry().register(self.readonly)

    def test_invalid_registry_document_is_rejected(self) -> None:
        issues = main.validate_registry_document({"name": "missing-fields"})

        self.assertIn("missing description", issues)
        self.assertIn("missing version", issues)
        self.assertIn("remote profile requires a non-empty remotes list", issues)
        self.assertIn("name must match namespace/server and be 3-200 characters", issues)

    def test_registry_subset_validates_official_field_shapes(self) -> None:
        mutations = [
            ("name", "missing-slash", "name must match"),
            ("description", "", "description must be"),
            ("title", "x" * 101, "title must be"),
            ("title", None, "title must be"),
            ("version", "^1.2.3", "version must be"),
        ]
        for key, value, expected in mutations:
            with self.subTest(key=key):
                document = self.readonly.registry_document()
                document[key] = value
                self.assertTrue(
                    any(expected in issue for issue in main.validate_registry_document(document))
                )

        for remote, expected in (
            ({"type": "stdio", "url": "https://example.com/mcp"}, ".type must be"),
            ({"type": "streamable-http", "url": "file:///tmp/mcp"}, ".url must be"),
            ({"type": "streamable-http"}, ".url must be"),
        ):
            with self.subTest(remote=remote):
                document = self.readonly.registry_document()
                document["remotes"] = [remote]
                self.assertTrue(
                    any(expected in issue for issue in main.validate_registry_document(document))
                )

    def test_registry_subset_accepts_schema_optional_and_official_sse_remote(self) -> None:
        document = self.readonly.registry_document()
        del document["$schema"]
        document["remotes"] = [
            {"type": "sse", "url": "https://mcp.internal.example.com/events"}
        ]

        self.assertEqual(main.validate_registry_document(document), [])

    def test_dispatch_requires_metadata_on_every_call(self) -> None:
        audit: list[main.AuditEntry] = []
        token = self.token(self.readonly, "postgres:query:readonly")

        result = main.dispatch(
            self.readonly,
            token,
            "postgres.readonly",
            {"sql": "SELECT 1"},
            {},
            audit,
        )

        self.assertEqual(result["error"]["code"], -32602)
        self.assertEqual(audit, [])

    def test_token_audience_is_bound_to_one_server(self) -> None:
        audit: list[main.AuditEntry] = []
        wrong_audience = self.token(
            self.destructive,
            "jira:write",
            audience=self.readonly.url,
        )

        result = main.dispatch(
            self.destructive,
            wrong_audience,
            "jira.create",
            {"title": "bad audience"},
            main.request_meta(),
            audit,
        )

        self.assertIn("audience", result["error"]["message"])
        self.assertEqual(len(audit), 1)

    def test_token_issuer_must_be_trusted(self) -> None:
        audit: list[main.AuditEntry] = []
        token = self.token(
            self.readonly,
            "postgres:query:readonly",
            issuer="https://attacker.example.com",
        )

        result = main.dispatch(
            self.readonly,
            token,
            "postgres.readonly",
            {"sql": "SELECT 1"},
            main.request_meta(),
            audit,
        )

        self.assertIn("issuer", result["error"]["message"])
        self.assertEqual(len(audit), 1)

    def test_expired_token_is_rejected(self) -> None:
        audit: list[main.AuditEntry] = []
        token = self.token(
            self.readonly,
            "postgres:query:readonly",
            expires_at=time.time() - 1,
        )

        result = main.dispatch(
            self.readonly,
            token,
            "postgres.readonly",
            {"sql": "SELECT 1"},
            main.request_meta(),
            audit,
        )

        self.assertIn("expired", result["error"]["message"])

    def test_destructive_tool_requires_an_approval_record(self) -> None:
        audit: list[main.AuditEntry] = []
        token = self.token(self.destructive, "jira:write")

        result = main.dispatch(
            self.destructive,
            token,
            "jira.create",
            {"title": "unsafe"},
            main.request_meta(),
            audit,
        )

        self.assertIn("action-bound approval", result["error"]["message"])

    def test_approval_is_bound_to_actor_tool_target_and_expiry(self) -> None:
        args = {"title": "approved change"}
        token = self.token(self.destructive, "jira:write")
        approvals = (
            (self.approval(self.destructive, args, actor="other"), "actor"),
            (self.approval(self.destructive, args, tool="other.tool"), "tool"),
            (
                self.approval(self.destructive, args, target="https://other.example.com/mcp"),
                "target",
            ),
            (
                self.approval(self.destructive, args, expires_at=time.time() - 1),
                "expired",
            ),
        )

        for approval, expected in approvals:
            with self.subTest(expected=expected):
                result = main.dispatch(
                    self.destructive,
                    token,
                    "jira.create",
                    args,
                    main.request_meta(),
                    [],
                    approval,
                )
                self.assertIn(expected, result["error"]["message"])

    def test_approval_cannot_be_replayed_with_changed_arguments(self) -> None:
        approved_args = {"title": "approved change"}
        token = self.token(self.destructive, "jira:write")
        approval = self.approval(self.destructive, approved_args)

        result = main.dispatch(
            self.destructive,
            token,
            "jira.create",
            {"title": "different change"},
            main.request_meta(),
            [],
            approval,
        )

        self.assertIn("arguments", result["error"]["message"])

    def test_exact_action_approval_allows_destructive_call_without_magic_scope(self) -> None:
        args = {"title": "approved change"}
        token = self.token(self.destructive, "jira:write")

        result = main.dispatch(
            self.destructive,
            token,
            "jira.create",
            args,
            main.request_meta(),
            [],
            self.approval(self.destructive, args),
        )

        self.assertFalse(result["isError"])
        self.assertTrue(result["structuredContent"]["created"])

    def test_allowed_call_returns_complete_result_and_audit_record(self) -> None:
        audit: list[main.AuditEntry] = []
        token = self.token(self.readonly, "postgres:query:readonly")

        result = main.dispatch(
            self.readonly,
            token,
            "postgres.readonly",
            {"sql": "SELECT 1"},
            main.request_meta(),
            audit,
        )

        self.assertEqual(result["resultType"], "complete")
        self.assertFalse(result["isError"])
        self.assertEqual(result["structuredContent"]["rows"], [[1]])
        self.assertEqual(audit[0].outcome, "allowed")

    def test_redaction_happens_before_audit_persistence(self) -> None:
        redacted = main.redact({"email": "learner@example.com", "ssn": "123-45-6789"})

        self.assertEqual(redacted, {"email": "[email]", "ssn": "[ssn]"})


if __name__ == "__main__":
    unittest.main()
