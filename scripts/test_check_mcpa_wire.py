import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parent))

import check_mcpa_wire as wire


META = {
    "io.modelcontextprotocol/protocolVersion": "2026-07-28",
    "io.modelcontextprotocol/clientCapabilities": {},
}


def request(request_id, method, **params):
    return {"jsonrpc": "2.0", "id": request_id, "method": method, "params": {**params, "_meta": META}}


def result(request_id, **fields):
    return {"jsonrpc": "2.0", "id": request_id, "result": fields}


def error(request_id, code, data=None):
    body = {"code": code, "message": "failure"}
    if data is not None:
        body["data"] = data
    return {"jsonrpc": "2.0", "id": request_id, "error": body}


def findings(entries, extra=frozenset()):
    report = wire.Report()
    wire.check_transcript(report, "fixture", entries, set(extra))
    return [message for _, message in report.findings]


class ModernExchangeTests(unittest.TestCase):
    def test_valid_discover_list_and_call_has_no_findings(self):
        entries = [
            request(1, "server/discover"),
            result(1, resultType="complete", supportedVersions=["2026-07-28"], capabilities={"tools": {}}, ttlMs=0, cacheScope="public"),
            request(2, "tools/list"),
            result(2, resultType="complete", tools=[], ttlMs=60000, cacheScope="public"),
            request(3, "tools/call", name="lookup", arguments={}),
            result(3, resultType="complete", content=[{"type": "text", "text": "ok"}], isError=False),
        ]
        self.assertEqual(findings(entries), [])

    def test_initialize_is_rejected_unless_marked_legacy(self):
        legacy = {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}}
        self.assertTrue(any("does not exist" in item for item in findings([legacy])))
        self.assertEqual(findings([{"legacy": True, "message": legacy}]), [])

    def test_request_without_meta_is_flagged(self):
        entries = [{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}]
        self.assertTrue(any("_meta" in item for item in findings(entries)))

    def test_result_without_result_type_is_flagged(self):
        entries = [request(1, "tools/call", name="x", arguments={}), result(1, content=[])]
        self.assertTrue(any("resultType" in item for item in findings(entries)))

    def test_cacheable_result_needs_ttl_and_scope(self):
        entries = [request(1, "tools/list"), result(1, resultType="complete", tools=[])]
        messages = findings(entries)
        self.assertTrue(any("ttlMs" in item for item in messages))
        self.assertTrue(any("cacheScope" in item for item in messages))


class ErrorCodeTests(unittest.TestCase):
    def test_legacy_and_retired_codes_are_flagged(self):
        for code, fragment in ((-32001, "legacy"), (-32002, "-32602"), (-32042, "2025-11-25"), (-32050, "not defined")):
            with self.subTest(code=code):
                entries = [request(1, "tools/call", name="x", arguments={}), error(1, code)]
                self.assertTrue(any(fragment in item for item in findings(entries)))

    def test_standard_and_application_codes_pass(self):
        for code in (-32602, -32601, -32603, 1001, -31000):
            with self.subTest(code=code):
                entries = [request(1, "tools/call", name="x", arguments={}), error(1, code)]
                self.assertEqual(findings(entries), [])

    def test_unsupported_version_requires_data(self):
        entries = [request(1, "tools/list"), error(1, -32022)]
        self.assertTrue(any("-32022" in item for item in findings(entries)))
        entries = [request(1, "tools/list"), error(1, -32022, {"supported": ["2026-07-28"], "requested": "1900-01-01"})]
        self.assertEqual(findings(entries), [])


class MultiRoundTripTests(unittest.TestCase):
    def input_required(self, request_id, state="opaque"):
        return result(
            request_id,
            resultType="input_required",
            inputRequests={"confirm": {"method": "elicitation/create", "params": {"mode": "form", "message": "ok?", "requestedSchema": {"type": "object", "properties": {}}}}},
            requestState=state,
        )

    def test_valid_retry_has_no_findings(self):
        entries = [
            request(1, "tools/call", name="deploy", arguments={}),
            self.input_required(1),
            request(2, "tools/call", name="deploy", arguments={}, inputResponses={"confirm": {"action": "accept", "content": {}}}, requestState="opaque"),
            result(2, resultType="complete", content=[]),
        ]
        self.assertEqual(findings(entries), [])

    def test_retry_reusing_id_is_flagged(self):
        entries = [
            request(1, "tools/call", name="deploy", arguments={}),
            self.input_required(1),
            request(1, "tools/call", name="deploy", arguments={}, inputResponses={}, requestState="opaque"),
            result(1, resultType="complete", content=[]),
        ]
        self.assertTrue(any("new JSON-RPC id" in item for item in findings(entries)))

    def test_retry_must_echo_request_state(self):
        entries = [
            request(1, "tools/call", name="deploy", arguments={}),
            self.input_required(1),
            request(2, "tools/call", name="deploy", arguments={}, inputResponses={}, requestState="tampered"),
            result(2, resultType="complete", content=[]),
        ]
        self.assertTrue(any("echo requestState" in item for item in findings(entries)))

    def test_input_required_only_on_supported_methods(self):
        entries = [request(1, "tools/list"), self.input_required(1)]
        self.assertTrue(any("may not return input_required" in item for item in findings(entries)))

    def test_extension_result_type_needs_declaration(self):
        entries = [request(1, "tools/call", name="build", arguments={}), result(1, resultType="task", taskId="t-1")]
        self.assertTrue(findings(entries))
        self.assertEqual(findings(entries, {"task"}), [])


class StreamAndHeaderTests(unittest.TestCase):
    def test_listen_notifications_need_subscription_id(self):
        missing = {"jsonrpc": "2.0", "method": "notifications/tools/list_changed", "params": {}}
        tagged = {"jsonrpc": "2.0", "method": "notifications/tools/list_changed", "params": {"_meta": {wire.SUB_KEY: 5}}}
        self.assertTrue(findings([missing]))
        self.assertEqual(findings([tagged]), [])

    def test_http_headers_must_mirror_the_body(self):
        call = request(1, "tools/call", name="get_weather", arguments={})
        good = {"message": call, "http": {"headers": {"MCP-Protocol-Version": "2026-07-28", "Mcp-Method": "tools/call", "Mcp-Name": "get_weather"}}}
        bad = {"message": call, "http": {"headers": {"MCP-Protocol-Version": "2025-11-25", "Mcp-Method": "tools/call", "Mcp-Name": "other"}}}
        self.assertEqual(findings([good, result(1, resultType="complete", content=[])]), [])
        messages = findings([bad, result(1, resultType="complete", content=[])])
        self.assertTrue(any("MCP-Protocol-Version" in item for item in messages))
        self.assertTrue(any("Mcp-Name" in item for item in messages))

    def test_deliberate_violations_are_skipped(self):
        broken = {"jsonrpc": "2.0", "id": 9, "method": "tools/list", "params": {}}
        entries = [{"violation": "shows the -32602 rejection of a request without _meta", "message": broken}, error(9, -32602)]
        self.assertEqual(findings(entries), [])

    def test_wrappers_around_a_non_object_message_are_flagged(self):
        for wrapper in ({"legacy": True, "message": None}, {"violation": "typo", "message": "initialize"}):
            self.assertTrue(any("must wrap a JSON-RPC message object" in item for item in findings([wrapper])))


if __name__ == "__main__":
    unittest.main()
