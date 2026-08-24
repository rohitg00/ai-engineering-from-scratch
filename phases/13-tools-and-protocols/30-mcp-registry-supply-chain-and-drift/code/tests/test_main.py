import copy
import importlib.util
import sys
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[1] / "main.py"
SPEC = importlib.util.spec_from_file_location("lesson30_main", MODULE_PATH)
assert SPEC and SPEC.loader
main = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = main
SPEC.loader.exec_module(main)


class RegistryAdmissionTests(unittest.TestCase):
    def setUp(self) -> None:
        self.times = iter(f"2026-08-21T09:00:{second:02d}+00:00" for second in range(40))
        self.controller = main.RegistryAdmissionController(clock=lambda: next(self.times))
        self.meta = {main.OFFICIAL_META_KEY: {"status": "active"}}

    def admit(self, version: str = "1.0.0") -> main.Decision:
        return self.controller.admit(
            main.sample_record(version),
            self.meta,
            "com.example",
            main.evidence_for(version),
            main.sample_live(version),
        )

    def test_domain_namespace_is_reversed_and_boundary_checked(self) -> None:
        self.assertEqual(main.namespace_for_domain("Docs.Example.COM."), "com.example.docs")
        self.assertTrue(main.namespace_matches("com.example/tool", "com.example"))
        self.assertFalse(main.namespace_matches("com.exampleevil/tool", "com.example"))

    def test_active_verified_release_is_admitted_and_pinned(self) -> None:
        decision = self.admit()
        self.assertTrue(decision.allowed)
        self.assertEqual(self.controller.active["com.example/inventory"], "1.0.0")
        self.assertEqual(len(decision.pin["provenanceDigest"]), 64)

    def test_mutating_registry_record_after_admission_cannot_rewrite_pin(self) -> None:
        record = main.sample_record("1.0.0")
        decision = self.controller.admit(
            record,
            self.meta,
            "com.example",
            main.evidence_for("1.0.0"),
            main.sample_live("1.0.0"),
        )

        record["packages"][0]["transport"]["type"] = "attacker-controlled"

        self.assertTrue(decision.allowed)
        self.assertEqual(
            self.controller.pins[("com.example/inventory", "1.0.0")]["source"][
                "transport"
            ]["type"],
            "stdio",
        )

    def test_mutating_admission_decision_cannot_rewrite_stored_pin(self) -> None:
        decision = self.admit()

        decision.pin["source"]["transport"]["type"] = "attacker-controlled"
        decision.pin["reportedServerInfo"]["name"] = "org.attacker/pretend"

        stored = self.controller.pins[("com.example/inventory", "1.0.0")]
        self.assertEqual(stored["source"]["transport"]["type"], "stdio")
        self.assertEqual(stored["reportedServerInfo"]["name"], "com.example/inventory")

    def test_deprecated_release_is_rejected_before_activation(self) -> None:
        meta = {main.OFFICIAL_META_KEY: {"status": "deprecated"}}
        decision = self.controller.admit(
            main.sample_record("1.0.0"),
            meta,
            "com.example",
            main.evidence_for("1.0.0"),
            main.sample_live("1.0.0"),
        )
        self.assertFalse(decision.allowed)
        self.assertIn("registry status is deprecated, not active", decision.reasons)

    def test_registry_status_requires_namespaced_official_metadata(self) -> None:
        decision = self.controller.admit(
            main.sample_record("1.0.0"),
            {"status": "active"},
            "com.example",
            main.evidence_for("1.0.0"),
            main.sample_live("1.0.0"),
        )
        self.assertFalse(decision.allowed)
        self.assertIn("registry status is missing, not active", decision.reasons)

    def test_unverified_package_provenance_is_rejected(self) -> None:
        evidence = main.evidence_for("1.0.0")
        evidence["verified"] = False
        decision = self.controller.admit(
            main.sample_record("1.0.0"), self.meta, "com.example", evidence, main.sample_live("1.0.0")
        )
        self.assertFalse(decision.allowed)
        self.assertIn("package ownership or provenance is not verified", decision.reasons)

    def test_unknown_publication_metadata_key_is_rejected(self) -> None:
        record = main.sample_record("1.0.0")
        record["_meta"]["course.example/private"] = True
        decision = self.controller.admit(
            record,
            self.meta,
            "com.example",
            main.evidence_for("1.0.0"),
            main.sample_live("1.0.0"),
        )
        self.assertFalse(decision.allowed)
        self.assertIn("record._meta contains a non-publisher key", decision.reasons)

    def test_tool_order_does_not_create_false_drift(self) -> None:
        live = main.sample_live("1.0.0", True)
        admitted = self.controller.admit(
            main.sample_record("1.0.0"),
            self.meta,
            "com.example",
            main.evidence_for("1.0.0"),
            live,
        )
        reordered = copy.deepcopy(live)
        reordered["tools"].reverse()
        self.assertTrue(admitted.allowed)
        self.assertTrue(self.controller.check_live("com.example/inventory", "1.0.0", reordered).allowed)

    def test_new_live_tool_is_detected_as_descriptor_drift(self) -> None:
        self.admit()
        decision = self.controller.check_live(
            "com.example/inventory", "1.0.0", main.sample_live("1.0.0", True)
        )
        self.assertFalse(decision.allowed)
        self.assertIn("live tool descriptors differ from the admitted pin", decision.reasons)
        self.assertNotIn("com.example/inventory", self.controller.active)
        self.assertTrue(self.controller.pins[("com.example/inventory", "1.0.0")]["quarantined"])
        rollback = self.controller.rollback("com.example/inventory", "1.0.0", "ignore drift")
        self.assertFalse(rollback.allowed)

    def test_mutating_live_check_decision_cannot_rewrite_stored_pin(self) -> None:
        self.admit()
        decision = self.controller.check_live(
            "com.example/inventory", "1.0.0", main.sample_live("1.0.0")
        )

        decision.pin["source"]["transport"]["type"] = "attacker-controlled"

        stored = self.controller.pins[("com.example/inventory", "1.0.0")]
        self.assertEqual(stored["source"]["transport"]["type"], "stdio")

    def test_server_info_is_diagnostic_and_direct_alias_has_no_authority(self) -> None:
        live = main.sample_live("1.0.0")
        live["serverInfo"] = live["_meta"].pop(main.SERVER_INFO_KEY)
        decision = self.controller.admit(
            main.sample_record("1.0.0"),
            self.meta,
            "com.example",
            main.evidence_for("1.0.0"),
            live,
        )
        self.assertTrue(decision.allowed)
        self.assertIsNone(decision.pin["reportedServerInfo"])

    def test_spoofed_server_info_does_not_change_admission_authority(self) -> None:
        live = main.sample_live("1.0.0")
        live["_meta"][main.SERVER_INFO_KEY] = {
            "name": "org.attacker/pretend",
            "version": "99.0.0",
        }
        decision = self.controller.admit(
            main.sample_record("1.0.0"),
            self.meta,
            "com.example",
            main.evidence_for("1.0.0"),
            live,
        )
        self.assertTrue(decision.allowed)
        self.assertEqual(decision.pin["reportedServerInfo"]["name"], "org.attacker/pretend")

    def test_package_registry_type_and_transport_must_match_evidence(self) -> None:
        evidence = main.evidence_for("1.0.0")
        evidence["registryType"] = "npm"
        evidence["transportType"] = "streamable-http"
        decision = self.controller.admit(
            main.sample_record("1.0.0"),
            self.meta,
            "com.example",
            evidence,
            main.sample_live("1.0.0"),
        )
        self.assertFalse(decision.allowed)
        self.assertIn(
            "verified package registry type does not match the registry record",
            decision.reasons,
        )
        self.assertIn("verified package transport does not match the registry record", decision.reasons)

    def test_verified_remote_only_record_is_admitted_without_package_claims(self) -> None:
        record = {
            "name": "com.example/inventory",
            "version": "1.0.0",
            "description": "Remote inventory server",
            "remotes": [
                {
                    "type": "streamable-http",
                    "url": "https://mcp.example.com/mcp",
                }
            ],
            "_meta": {main.PUBLISHER_META_KEY: {"tier": "internal-approved"}},
        }
        evidence = {
            "kind": "remote",
            "url": "https://mcp.example.com/mcp",
            "transportType": "streamable-http",
            "digest": main.digest({"tlsIdentity": "example.com", "route": "/mcp"}),
            "verified": True,
        }
        decision = self.controller.admit(
            record,
            self.meta,
            "com.example",
            evidence,
            main.sample_live("1.0.0"),
        )
        self.assertTrue(decision.allowed)
        self.assertEqual(decision.pin["source"]["kind"], "remote")

    def test_cleartext_http_remote_is_rejected(self) -> None:
        record = {
            "name": "com.example/inventory",
            "version": "1.0.0",
            "description": "Remote inventory server",
            "remotes": [
                {
                    "type": "streamable-http",
                    "url": "http://mcp.example.com/mcp",
                }
            ],
            "_meta": {main.PUBLISHER_META_KEY: {"tier": "internal-approved"}},
        }
        evidence = {
            "kind": "remote",
            "url": "http://mcp.example.com/mcp",
            "transportType": "streamable-http",
            "digest": main.digest({"tlsIdentity": "example.com", "route": "/mcp"}),
            "verified": True,
        }

        decision = self.controller.admit(
            record,
            self.meta,
            "com.example",
            evidence,
            main.sample_live("1.0.0"),
        )

        self.assertFalse(decision.allowed)
        self.assertIn("record.remotes[0].url must be an HTTPS URL", decision.reasons)

    def test_malformed_or_credentialed_remote_urls_are_rejected_without_crashing(self) -> None:
        invalid_urls = {
            "malformed IPv6": "https://[2001:db8::1/mcp",
            "userinfo": "https://learner:secret@mcp.example.com/mcp",
            "missing host": "https:///mcp",
            "invalid port": "https://mcp.example.com:70000/mcp",
            "fragment": "https://mcp.example.com/mcp#alternate",
            "raw space": "https://mcp.example.com/m cp",
            "raw tab": "https://mcp.example.com/mcp\t",
            "encoded control": "https://mcp.example.com/mcp%0Aadmin",
        }
        for label, url in invalid_urls.items():
            with self.subTest(label=label):
                record = {
                    "name": "com.example/inventory",
                    "version": "1.0.0",
                    "description": "Remote inventory server",
                    "remotes": [{"type": "streamable-http", "url": url}],
                    "_meta": {
                        main.PUBLISHER_META_KEY: {"tier": "internal-approved"}
                    },
                }
                evidence = {
                    "kind": "remote",
                    "url": url,
                    "transportType": "streamable-http",
                    "digest": main.digest({"tlsIdentity": "example.com"}),
                    "verified": True,
                }

                decision = self.controller.admit(
                    record,
                    self.meta,
                    "com.example",
                    evidence,
                    main.sample_live("1.0.0"),
                )

                self.assertFalse(decision.allowed)
                self.assertIn(
                    "record.remotes[0].url must be an HTTPS URL",
                    decision.reasons,
                )

    def test_remote_urls_are_normalized_before_evidence_matching_and_pinning(self) -> None:
        record = {
            "name": "com.example/inventory",
            "version": "1.0.0",
            "description": "Remote inventory server",
            "remotes": [
                {
                    "type": "streamable-http",
                    "url": "https://MCP.Example.COM:443",
                }
            ],
            "_meta": {main.PUBLISHER_META_KEY: {"tier": "internal-approved"}},
        }
        evidence = {
            "kind": "remote",
            "url": "https://mcp.example.com/",
            "transportType": "streamable-http",
            "digest": main.digest({"tlsIdentity": "example.com", "route": "/"}),
            "verified": True,
        }

        decision = self.controller.admit(
            record,
            self.meta,
            "com.example",
            evidence,
            main.sample_live("1.0.0"),
        )

        self.assertTrue(decision.allowed)
        self.assertEqual(
            decision.pin["source"]["url"],
            "https://mcp.example.com/",
        )

    def test_mutating_remote_record_after_admission_cannot_rewrite_pin(self) -> None:
        record = {
            "name": "com.example/inventory",
            "version": "1.0.0",
            "description": "Remote inventory server",
            "remotes": [
                {
                    "type": "streamable-http",
                    "url": "https://mcp.example.com/mcp",
                    "headers": [{"name": "Authorization", "isSecret": True}],
                }
            ],
            "_meta": {main.PUBLISHER_META_KEY: {"tier": "internal-approved"}},
        }
        evidence = {
            "kind": "remote",
            "url": "https://mcp.example.com/mcp",
            "transportType": "streamable-http",
            "digest": main.digest({"tlsIdentity": "example.com", "route": "/mcp"}),
            "verified": True,
        }
        decision = self.controller.admit(
            record,
            self.meta,
            "com.example",
            evidence,
            main.sample_live("1.0.0"),
        )

        record["remotes"][0]["headers"][0]["name"] = "X-Attacker"

        self.assertTrue(decision.allowed)
        stored = self.controller.pins[("com.example/inventory", "1.0.0")]
        self.assertEqual(stored["source"]["headers"][0]["name"], "Authorization")

    def test_malformed_packages_and_tools_refuse_without_crashing(self) -> None:
        malformed_record = main.sample_record("1.0.0")
        malformed_record["packages"] = ["not-an-object"]
        package_decision = self.controller.admit(
            malformed_record,
            self.meta,
            "com.example",
            main.evidence_for("1.0.0"),
            main.sample_live("1.0.0"),
        )
        self.assertFalse(package_decision.allowed)
        self.assertIn("record.packages[0] must be an object", package_decision.reasons)

        self.admit()
        malformed_live = main.sample_live("1.0.0")
        malformed_live["tools"] = [None]
        live_decision = self.controller.check_live(
            "com.example/inventory", "1.0.0", malformed_live
        )
        self.assertFalse(live_decision.allowed)
        self.assertIn("live tools[0] must be an object", live_decision.reasons)
        self.assertTrue(self.controller.pins[("com.example/inventory", "1.0.0")]["quarantined"])

    def test_status_change_quarantines_and_deactivates_release(self) -> None:
        self.admit()
        self.controller.observe_registry_status("com.example/inventory", "1.0.0", "deleted")
        self.assertNotIn("com.example/inventory", self.controller.active)
        self.assertTrue(self.controller.pins[("com.example/inventory", "1.0.0")]["quarantined"])
        self.assertTrue(self.controller.ledger.verify())

    def test_rollback_activates_a_previously_admitted_healthy_version(self) -> None:
        self.admit("1.0.0")
        self.admit("1.1.0")
        self.controller.observe_registry_status("com.example/inventory", "1.1.0", "deprecated")
        decision = self.controller.rollback("com.example/inventory", "1.0.0", "candidate drift")
        self.assertTrue(decision.allowed)
        self.assertEqual(self.controller.active["com.example/inventory"], "1.0.0")

    def test_mutating_rollback_decision_cannot_rewrite_stored_pin(self) -> None:
        self.admit()
        decision = self.controller.rollback(
            "com.example/inventory", "1.0.0", "restore approved release"
        )

        decision.pin["source"]["transport"]["type"] = "attacker-controlled"

        stored = self.controller.pins[("com.example/inventory", "1.0.0")]
        self.assertEqual(stored["source"]["transport"]["type"], "stdio")

    def test_rollback_rejects_quarantined_target(self) -> None:
        self.admit()
        self.controller.observe_registry_status("com.example/inventory", "1.0.0", "deprecated")
        decision = self.controller.rollback("com.example/inventory", "1.0.0", "try unsafe target")
        self.assertFalse(decision.allowed)

    def test_ledger_hash_chain_detects_tampering(self) -> None:
        self.admit()
        self.controller.check_live("com.example/inventory", "1.0.0", main.sample_live("1.0.0"))
        self.assertTrue(self.controller.ledger.verify())
        self.controller.ledger.entries[0]["outcome"] = "rejected"
        self.assertFalse(self.controller.ledger.verify())


if __name__ == "__main__":
    unittest.main()
