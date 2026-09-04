import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import main


SIGNER = "release-controller"
SIGNING_KEY = main.hashlib.sha256(b"deterministic non-secret test fixture").digest()


def rollback_evidence() -> dict[str, object]:
    return main.attach_rollback_attestation(
        {
            "version": "1.0.0",
            "healthy": True,
            "registryStatus": "active",
            "admissionEvidenceDigest": main.digest({"version": "1.0.0"}),
            "artifactDigest": main.digest({"artifact": "inventory-1.0.0"}),
            "descriptorDigest": main.digest({"tools": ["inventory_get"]}),
        },
        SIGNER,
        SIGNING_KEY,
    )


def release_gate() -> main.ReleaseGate:
    return main.ReleaseGate({SIGNER: SIGNING_KEY})


class ConformanceHarnessTests(unittest.TestCase):
    def test_golden_and_negative_transcript_suite_passes(self) -> None:
        results = [main.run_transcript(case) for case in main.transcript_suite()]
        self.assertTrue(all(result.passed for result in results), results)
        self.assertEqual(len(results), 15)

    def test_header_mismatch_fixture_requires_valid_protocol_error_response(self) -> None:
        case = next(
            item for item in main.transcript_suite() if item.name == "negative-header-body-mismatch"
        )
        self.assertTrue(main.run_transcript(case).passed)
        self.assertEqual(case.response_status, 400)
        self.assertEqual(case.response_body["error"]["code"], -32020)

    def test_header_mismatch_cannot_pass_without_actual_error_response(self) -> None:
        headers, request = main.modern_request("tools/call", 88, "inventory_get")
        headers["Mcp-Name"] = "inventory_delete"
        case = main.Transcript(
            "adversarial-missing-header-error-evidence",
            "modern",
            headers,
            request,
            500,
            None,
            expected_error_code=-32020,
        )
        result = main.run_transcript(case)
        self.assertFalse(result.passed)
        self.assertIn("expected JSON-RPC error response is missing", result.detail)

    def test_modern_request_uses_only_exact_namespaced_metadata_keys(self) -> None:
        _, request = main.modern_request()
        metadata = request["params"]["_meta"]
        self.assertEqual(metadata[main.PROTOCOL_VERSION_KEY], main.MODERN_VERSION)
        self.assertIn(main.CLIENT_CAPABILITIES_KEY, metadata)
        self.assertIn(main.CLIENT_INFO_KEY, metadata)
        self.assertNotIn("protocolVersion", metadata)
        self.assertNotIn("clientCapabilities", metadata)

    def test_bare_metadata_aliases_are_rejected(self) -> None:
        headers, request = main.modern_request()
        request["params"]["_meta"] = {
            "protocolVersion": main.MODERN_VERSION,
            "clientCapabilities": {},
        }
        with self.assertRaises(main.ProtocolViolation) as context:
            main.validate_request(headers, request, "modern")
        self.assertEqual(context.exception.code, -32602)

    def test_header_body_mismatch_uses_modern_error_code(self) -> None:
        headers, request = main.modern_request("tools/call", 1, "inventory_get")
        headers["Mcp-Name"] = "inventory_delete"
        with self.assertRaises(main.ProtocolViolation) as context:
            main.validate_request(headers, request, "modern")
        self.assertEqual(context.exception.code, -32020)

    def test_http_header_names_are_case_insensitive(self) -> None:
        headers, request = main.modern_request("tools/call", 1, "inventory_get")
        lower_headers = {name.lower(): value for name, value in headers.items()}
        main.validate_request(lower_headers, request, "modern")

    def test_conflicting_duplicate_header_values_are_rejected(self) -> None:
        headers, request = main.modern_request("tools/call", 1, "inventory_get")
        headers["mcp-method"] = "tools/list"
        with self.assertRaises(main.ProtocolViolation) as context:
            main.validate_request(headers, request, "modern")
        self.assertEqual(context.exception.code, -32020)

    def test_mcp_name_base64_sentinel_is_decoded_before_comparison(self) -> None:
        headers, request = main.modern_request("tools/call", 1, "résumé_lookup")
        self.assertTrue(headers["Mcp-Name"].startswith("=?base64?"))
        main.validate_request(headers, request, "modern")
        headers["Mcp-Name"] = "=?base64?not-valid!?="
        with self.assertRaises(main.ProtocolViolation) as context:
            main.validate_request(headers, request, "modern")
        self.assertEqual(context.exception.code, -32020)

    def test_raw_mcp_name_whitespace_requires_base64_sentinel(self) -> None:
        headers, request = main.modern_request("tools/call", 1, " inventory_get ")
        self.assertTrue(headers["Mcp-Name"].startswith("=?base64?"))
        main.validate_request(headers, request, "modern")

        headers["Mcp-Name"] = " inventory_get "
        with self.assertRaises(main.ProtocolViolation) as context:
            main.validate_request(headers, request, "modern")
        self.assertEqual(context.exception.code, -32020)

    def test_modern_result_requires_result_type_but_legacy_can_infer_complete(self) -> None:
        with self.assertRaises(main.ProtocolViolation):
            main.validate_result({"tools": []}, "modern")
        normalized = main.validate_result({"tools": []}, "legacy")
        self.assertEqual(normalized["semanticType"], "complete")
        self.assertTrue(normalized["inferred"])

    def test_unknown_additive_result_fields_are_preserved(self) -> None:
        result = {
            "resultType": "complete",
            "tools": [],
            "futureHint": {"mode": "new"},
        }
        normalized = main.validate_result(result, "modern")
        self.assertEqual(normalized["wire"]["futureHint"], {"mode": "new"})

    def test_unknown_result_type_is_rejected(self) -> None:
        with self.assertRaises(main.ProtocolViolation):
            main.validate_result({"resultType": "surprise"}, "modern")

    def test_extension_result_type_requires_advertised_capability(self) -> None:
        with self.assertRaises(main.ProtocolViolation):
            main.validate_result({"resultType": "task", "taskId": "t-1"}, "modern")
        normalized = main.validate_result(
            {"resultType": "task", "taskId": "t-1"},
            "modern",
            {"io.modelcontextprotocol/tasks"},
        )
        self.assertEqual(normalized["semanticType"], "task")

    def test_task_ttl_literal_missing_is_an_invalid_value_not_an_absent_field(self) -> None:
        result = {
            "resultType": "task",
            "taskId": "t-1",
            "status": "working",
            "createdAt": "2026-08-21T10:00:00Z",
            "lastUpdatedAt": "2026-08-21T10:00:00Z",
            "ttlMs": "missing",
        }
        with self.assertRaisesRegex(
            main.ProtocolViolation,
            "ttlMs must be null or a non-negative integer",
        ):
            main.validate_method_result("tools/call", result)

    def test_completion_complete_validates_its_method_payload(self) -> None:
        main.validate_method_result(
            "completion/complete",
            {
                "resultType": "complete",
                "completion": {
                    "values": ["development", "staging"],
                    "total": 3,
                    "hasMore": True,
                },
            },
        )
        with self.assertRaises(main.ProtocolViolation):
            main.validate_method_result(
                "completion/complete",
                {"resultType": "complete", "completion": {"values": ["ok", 7]}},
            )

    def test_recognized_modern_error_never_triggers_legacy_fallback(self) -> None:
        era = main.select_era({"kind": "jsonrpc_error", "code": -32021}, "fallback")
        self.assertEqual(era, "modern")

    def test_timeout_alone_never_proves_legacy_era(self) -> None:
        with self.assertRaises(main.ProtocolViolation):
            main.select_era({"kind": "timeout"}, "fallback")
        with self.assertRaises(main.ProtocolViolation):
            main.select_era({"kind": "timeout"}, "fallback", legacy_allowed=True)
        with self.assertRaises(main.ProtocolViolation):
            main.select_era({"kind": "timeout"}, "strict")

    def test_legacy_requires_allowlist_and_positive_initialize_evidence(self) -> None:
        evidence = {"kind": "initialize_success", "protocolVersion": main.LEGACY_VERSION}
        self.assertEqual(
            main.select_era(
                {"kind": "timeout"},
                "fallback",
                legacy_allowed=True,
                legacy_evidence=evidence,
            ),
            "legacy",
        )
        with self.assertRaises(main.ProtocolViolation):
            main.select_era(
                {"kind": "timeout"},
                "fallback",
                legacy_allowed=True,
                legacy_evidence={"kind": "initialize_success", "protocolVersion": "unknown"},
            )

    def test_notification_has_empty_http_outcome_and_no_json_rpc_response(self) -> None:
        _, notification = main.modern_request("notifications/course/progress", None)
        self.assertEqual(main.notification_http_outcome(notification), (202, None))
        notification["id"] = 9
        with self.assertRaises(ValueError):
            main.notification_http_outcome(notification)

    def test_sdk_may_hide_bookkeeping_but_dropped_semantic_field_is_reported(self) -> None:
        bookkeeping_only = main.compare_sdk_view(
            {"resultType": "complete", "tools": [], "_meta": {"trace": "t-1"}},
            {"tools": []},
        )
        future_field = main.compare_sdk_view(
            {"resultType": "complete", "tools": [], "futureHint": True},
            {"tools": []},
        )
        self.assertTrue(bookkeeping_only["semanticMatch"])
        self.assertFalse(future_field["semanticMatch"])
        self.assertEqual(future_field["droppedFields"], ["futureHint"])

    def test_sdk_differential_preserves_legacy_complete_inference(self) -> None:
        report = main.compare_sdk_view(
            {"tools": []},
            {"tools": []},
            era="legacy",
        )

        self.assertTrue(report["semanticMatch"])

    def test_sdk_differential_accepts_advertised_task_result(self) -> None:
        report = main.compare_sdk_view(
            {
                "resultType": "task",
                "taskId": "t-2",
                "status": "working",
                "createdAt": "2026-08-21T10:00:00Z",
                "lastUpdatedAt": "2026-08-21T10:00:00Z",
                "ttlMs": 900_000,
                "cacheScope": "private",
            },
            {
                "taskId": "t-2",
                "status": "working",
                "createdAt": "2026-08-21T10:00:00Z",
                "lastUpdatedAt": "2026-08-21T10:00:00Z",
            },
            capabilities={"io.modelcontextprotocol/tasks"},
            method="tools/call",
        )

        self.assertTrue(report["semanticMatch"])
        self.assertNotIn("wireValid", report)

    def test_sdk_differential_rejects_malformed_advertised_task_result(self) -> None:
        with self.assertRaisesRegex(
            main.ProtocolViolation,
            "task result requires non-empty status",
        ):
            main.compare_sdk_view(
                {
                    "resultType": "task",
                    "taskId": "t-2",
                    "ttlMs": 900_000,
                },
                {"taskId": "t-2"},
                capabilities={"io.modelcontextprotocol/tasks"},
                method="tools/call",
            )

    def test_proxy_evidence_detects_error_collapse_and_redacts_credentials(self) -> None:
        headers, request = main.modern_request("tools/call", 1, "inventory_get")
        report = main.inspect_proxy(
            {
                "ingress": {
                    "headers": {**headers, "Authorization": "Bearer private"},
                    "body": request,
                },
                "origin": {
                    "status": 400,
                    "body": {"jsonrpc": "2.0", "id": 1, "error": {"code": -32020}},
                },
                "egress": {"status": 500, "body": {"message": "failed"}},
            }
        )
        self.assertFalse(report["passed"])
        self.assertIn("proxy collapsed a protocol error into HTTP 500", report["issues"])
        self.assertEqual(report["evidence"]["ingress"]["headers"]["Authorization"], "[REDACTED]")

    def test_healthy_transcripts_and_proxy_promote_release(self) -> None:
        cases = [main.run_transcript(case) for case in main.transcript_suite()]
        headers, request = main.modern_request()
        body = {
            "jsonrpc": "2.0",
            "id": 1,
            "result": {"resultType": "complete", "tools": []},
        }
        proxy = main.inspect_proxy(
            {
                "ingress": {"headers": headers, "body": request},
                "origin": {"status": 200, "body": body},
                "egress": {"status": 200, "body": body},
            }
        )
        sdk = main.compare_sdk_view(body["result"], {"tools": []})
        report = release_gate().evaluate(
            cases, [sdk], [proxy], main.healthy_window(), rollback_evidence()
        )
        self.assertEqual(report["action"], "promote")
        self.assertTrue(report["passed"])

    def test_healthy_candidate_holds_without_verified_rollback_target(self) -> None:
        cases = [main.run_transcript(case) for case in main.transcript_suite()]
        report = release_gate().evaluate(cases, [], [], main.healthy_window(), {})
        self.assertEqual(report["action"], "hold")
        self.assertFalse(report["passed"])
        self.assertIn("no verified healthy rollback target", report["reasons"])

    def test_failed_candidate_selects_only_evidenced_healthy_rollback(self) -> None:
        failed = [main.CaseResult("negative", False, "failed", "abc")]
        report = release_gate().evaluate(
            failed, [], [], main.healthy_window(), rollback_evidence()
        )
        self.assertEqual(report["action"], "rollback")
        self.assertTrue(report["rollbackReady"])

    def test_failed_candidate_holds_without_rollback_evidence(self) -> None:
        failed = [main.CaseResult("negative", False, "failed", "abc")]
        report = release_gate().evaluate(failed, [], [], main.healthy_window(), {})
        self.assertEqual(report["action"], "hold")
        self.assertIn("no verified healthy rollback target", report["reasons"])

    def test_empty_conformance_sdk_and_proxy_evidence_never_promotes(self) -> None:
        report = release_gate().evaluate(
            [], [], [], main.healthy_window(), rollback_evidence()
        )
        self.assertEqual(report["action"], "rollback")
        self.assertIn("conformance transcript evidence is empty", report["reasons"])
        self.assertIn("SDK differential evidence is empty", report["reasons"])
        self.assertIn("proxy evidence is empty", report["reasons"])

    def test_truthy_strings_do_not_authenticate_a_rollback_target(self) -> None:
        fake = {
            "version": "1.0.0",
            "healthy": "yes",
            "registryStatus": "active",
            "admissionEvidenceDigest": "truthy",
            "artifactDigest": "truthy",
            "descriptorDigest": "truthy",
            "authenticator": "truthy",
        }
        self.assertFalse(main.rollback_evidence_ready(fake, {SIGNER: SIGNING_KEY}))

    def test_tampered_authenticated_rollback_evidence_is_rejected(self) -> None:
        evidence = rollback_evidence()
        evidence["version"] = "9.9.9"
        self.assertFalse(main.rollback_evidence_ready(evidence, {SIGNER: SIGNING_KEY}))

    def test_nested_sensitive_values_are_redacted_before_hashing(self) -> None:
        value = {
            "headers": {
                "Cookie": "sid=secret",
                "Set-Cookie": "sid=secret; HttpOnly",
                "X-Api-Key": "private",
            },
            "args": {"api_key": "private", "q": "safe"},
        }
        redacted = main.redact(value)
        self.assertEqual(redacted["headers"]["Cookie"], "[REDACTED]")
        self.assertEqual(redacted["headers"]["Set-Cookie"], "[REDACTED]")
        self.assertEqual(redacted["headers"]["X-Api-Key"], "[REDACTED]")
        self.assertEqual(redacted["args"]["api_key"], "[REDACTED]")
        self.assertEqual(redacted["args"]["q"], "safe")

    def test_camel_case_credentials_are_redacted_recursively(self) -> None:
        value = {
            "request": {
                "params": {
                    "accessToken": "access-private",
                    "clientSecret": "client-private",
                    "registrationAccessToken": "registration-private",
                }
            }
        }

        redacted = main.redact(value)

        self.assertEqual(
            redacted["request"]["params"],
            {
                "accessToken": "[REDACTED]",
                "clientSecret": "[REDACTED]",
                "registrationAccessToken": "[REDACTED]",
            },
        )

    def test_secret_key_separator_variants_share_one_redaction_policy(self) -> None:
        variants = (
            "access-token",
            "access_token",
            "access.token",
            "client-secret",
            "client_secret",
            "client.secret",
            "registration-access-token",
            "registration_access_token",
            "registration.access.token",
        )

        redacted = main.redact({key: "private" for key in variants})

        self.assertEqual(redacted, {key: "[REDACTED]" for key in variants})


if __name__ == "__main__":
    unittest.main()
