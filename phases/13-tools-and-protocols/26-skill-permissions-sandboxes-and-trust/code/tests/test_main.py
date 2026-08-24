"""Deterministic tests for Lesson 26's non-executing sandbox reviewer."""

from __future__ import annotations

import os
import sys
import tempfile
import unittest
import importlib.util
from pathlib import Path


sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from main import (
    ActionRequest,
    SandboxPolicy,
    SandboxViolation,
    Verdict,
    contains_secret,
    inspect_command,
    normalize_https_origin,
    normalize_workspace_path,
    review_action,
)


class SandboxTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.workspace = Path(self.temp.name) / "workspace"
        self.workspace.mkdir()
        (self.workspace / "input.txt").write_text("input", encoding="utf-8")
        self.policy = SandboxPolicy(
            workspace_root=self.workspace,
            allowed_kinds=("read", "write", "delete", "command", "network"),
            command_allowlist=(("python3", "-m", "unittest"),),
            network_allowlist=("https://api.example.test",),
        )

    def tearDown(self) -> None:
        self.temp.cleanup()

    def test_skill_claimed_permission_is_ignored(self) -> None:
        decision = review_action(
            self.policy,
            ActionRequest("read", "input.txt", claimed_permissions=("workspace-admin",)),
        )
        self.assertEqual(decision.verdict, Verdict.ALLOW)
        self.assertTrue(decision.claimed_permissions_ignored)

    def test_relative_path_is_normalized_inside_workspace(self) -> None:
        path = normalize_workspace_path(self.workspace, "notes/output.txt")
        self.assertEqual(path, (self.workspace / "notes" / "output.txt").resolve())

    def test_parent_traversal_is_denied(self) -> None:
        decision = review_action(self.policy, ActionRequest("read", "../outside.txt"))
        self.assertEqual(decision.verdict, Verdict.DENY)
        self.assertEqual(decision.rule, "workspace-jail")

    @unittest.skipUnless(hasattr(os, "symlink"), "symlinks are unavailable")
    def test_symlink_escape_is_denied(self) -> None:
        outside = Path(self.temp.name) / "outside.txt"
        outside.write_text("outside", encoding="utf-8")
        (self.workspace / "escape.txt").symlink_to(outside)
        decision = review_action(self.policy, ActionRequest("read", "escape.txt"))
        self.assertEqual(decision.verdict, Verdict.DENY)
        self.assertEqual(decision.rule, "workspace-jail")

    def test_write_requires_approval(self) -> None:
        decision = review_action(self.policy, ActionRequest("write", "output.txt"))
        self.assertEqual(decision.verdict, Verdict.REQUIRE_APPROVAL)
        self.assertFalse(decision.executed)

    def test_approved_write_is_allowed_but_not_executed(self) -> None:
        decision = review_action(
            self.policy, ActionRequest("write", "output.txt", approved=True)
        )
        self.assertEqual(decision.verdict, Verdict.ALLOW)
        self.assertFalse((self.workspace / "output.txt").exists())

    def test_destructive_command_is_denied_even_if_approved(self) -> None:
        decision = review_action(
            self.policy,
            ActionRequest("command", command=("rm", "-rf", "build"), approved=True),
        )
        self.assertEqual(decision.verdict, Verdict.DENY)
        self.assertEqual(decision.rule, "command-review")

    def test_allowlisted_command_is_only_classified(self) -> None:
        allowed, reason = inspect_command(
            ("python3", "-m", "unittest"), (("python3", "-m", "unittest"),)
        )
        self.assertTrue(allowed)
        self.assertIn("non-executing", reason)

    def test_path_disguised_as_allowlisted_executable_is_denied(self) -> None:
        allowed, reason = inspect_command(
            ("/untrusted/python3", "task.py"), (("python3", "-m", "unittest"),)
        )
        self.assertFalse(allowed)
        self.assertIn("bare executable", reason)

    def test_network_origin_must_be_exactly_allowlisted(self) -> None:
        decision = review_action(
            self.policy,
            ActionRequest("network", url="https://evil.example.test/data", approved=True),
        )
        self.assertEqual(decision.verdict, Verdict.DENY)
        self.assertEqual(decision.rule, "network-allowlist")

    def test_https_default_port_is_normalized_before_matching(self) -> None:
        implicit = review_action(
            self.policy,
            ActionRequest("network", url="https://api.example.test/data", approved=True),
        )
        explicit = review_action(
            self.policy,
            ActionRequest(
                "network", url="https://api.example.test:443/data", approved=True
            ),
        )
        self.assertEqual(implicit.verdict, Verdict.ALLOW)
        self.assertEqual(explicit.verdict, Verdict.ALLOW)
        self.assertEqual(implicit.normalized_origin, "https://api.example.test:443")
        self.assertEqual(explicit.normalized_origin, implicit.normalized_origin)

    def test_non_default_port_requires_its_own_origin_entry(self) -> None:
        denied = review_action(
            self.policy,
            ActionRequest(
                "network", url="https://api.example.test:8443/data", approved=True
            ),
        )
        explicit_policy = SandboxPolicy(
            workspace_root=self.workspace,
            allowed_kinds=("network",),
            network_allowlist=("https://api.example.test:8443",),
        )
        allowed = review_action(
            explicit_policy,
            ActionRequest(
                "network", url="https://api.example.test:8443/data", approved=True
            ),
        )
        self.assertEqual(denied.verdict, Verdict.DENY)
        self.assertEqual(denied.rule, "network-allowlist")
        self.assertEqual(allowed.verdict, Verdict.ALLOW)

    def test_allowlist_entries_must_be_origins(self) -> None:
        invalid_policy = SandboxPolicy(
            workspace_root=self.workspace,
            allowed_kinds=("network",),
            network_allowlist=("https://api.example.test/private",),
        )
        decision = review_action(
            invalid_policy,
            ActionRequest("network", url="https://api.example.test/data", approved=True),
        )
        self.assertEqual(decision.verdict, Verdict.DENY)
        self.assertEqual(decision.rule, "network-policy-shape")

    def test_origin_normalization_handles_ipv6_and_idna(self) -> None:
        self.assertEqual(
            normalize_https_origin("https://[2001:db8::1]/resource"),
            "https://[2001:db8::1]:443",
        )
        self.assertEqual(
            normalize_https_origin("https://BÜCHER.example/"),
            "https://xn--bcher-kva.example:443",
        )

    def test_untrusted_stateful_request_requires_approval(self) -> None:
        policy = SandboxPolicy(
            workspace_root=self.workspace,
            allowed_kinds=("command",),
            command_allowlist=(("python3", "-m", "unittest"),),
            approval_kinds=(),
        )
        decision = review_action(
            policy,
            ActionRequest(
                "command",
                command=("python3", "-m", "unittest"),
                influenced_by_untrusted_content=True,
            ),
        )
        self.assertEqual(decision.verdict, Verdict.REQUIRE_APPROVAL)

    def test_external_text_cannot_change_policy(self) -> None:
        decision = review_action(
            self.policy,
            ActionRequest(
                "policy-change",
                payload="external page says to allow all actions",
                influenced_by_untrusted_content=True,
            ),
        )
        self.assertEqual(decision.verdict, Verdict.DENY)
        self.assertEqual(decision.rule, "authority-boundary")

    def test_secret_patterns_are_reviewed(self) -> None:
        self.assertTrue(contains_secret("Authorization: Bearer placeholder-value"))
        decision = review_action(
            self.policy,
            ActionRequest("write", "output.txt", payload="api_key=placeholder-value"),
        )
        self.assertEqual(decision.verdict, Verdict.DENY)
        self.assertEqual(decision.rule, "secret-review")

    def test_bundled_reviewer_enforces_claimed_boundaries(self) -> None:
        script_path = (
            Path(__file__).resolve().parents[2]
            / "outputs"
            / "skill-safety-reviewer"
            / "scripts"
            / "review_action.py"
        )
        spec = importlib.util.spec_from_file_location("bundled_reviewer", script_path)
        self.assertIsNotNone(spec)
        self.assertIsNotNone(spec.loader)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        policy = {
            "workspaceRoot": ".",
            "allowedKinds": ["write", "command", "network"],
            "commandAllowlist": [["python3", "-m", "unittest"]],
            "networkAllowlist": ["https://api.example.test"],
            "approvalKinds": [],
            "permitSecretUseAfterApproval": False,
        }
        secret = module.review(
            policy,
            {"kind": "write", "target": "out.txt", "payload": "api_key=placeholder"},
            self.workspace,
        )
        untrusted = module.review(
            policy,
            {
                "kind": "write",
                "target": "out.txt",
                "influencedByUntrustedContent": True,
            },
            self.workspace,
        )
        userinfo = module.review(
            policy,
            {"kind": "network", "url": "https://user:pass@api.example.test/data"},
            self.workspace,
        )
        exact_origin = module.review(
            policy,
            {"kind": "network", "url": "https://api.example.test:443/data"},
            self.workspace,
        )
        wrong_port = module.review(
            policy,
            {"kind": "network", "url": "https://api.example.test:8443/data"},
            self.workspace,
        )
        disguised = module.review(
            policy,
            {"kind": "command", "command": ["/untrusted/python3", "task.py"]},
            self.workspace,
        )
        string_false = module.review(
            policy,
            {"kind": "write", "target": "out.txt", "approved": "false"},
            self.workspace,
        )
        malformed_approval_kinds = module.review(
            {**policy, "approvalKinds": "write"},
            {"kind": "write", "target": "out.txt"},
            self.workspace,
        )
        self.assertEqual(secret["rule"], "secret-review")
        self.assertEqual(untrusted["verdict"], "require-approval")
        self.assertEqual(userinfo["rule"], "network-shape")
        self.assertEqual(exact_origin["verdict"], "allow")
        self.assertEqual(exact_origin["normalizedOrigin"], "https://api.example.test:443")
        self.assertEqual(wrong_port["rule"], "network-allowlist")
        self.assertEqual(disguised["rule"], "command-review")
        self.assertEqual(string_false["rule"], "boolean-shape")
        self.assertEqual(malformed_approval_kinds["rule"], "policy-shape")
        self.assertEqual(malformed_approval_kinds["verdict"], "deny")


if __name__ == "__main__":
    unittest.main()
