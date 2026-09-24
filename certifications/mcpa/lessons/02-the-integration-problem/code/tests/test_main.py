import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class IntegrationProblemTests(unittest.TestCase):
    def setUp(self) -> None:
        self.weather = main.Client(main.build_weather_server())
        self.tickets = main.Client(main.build_ticket_server())

    def test_one_protocol_turns_n_times_m_into_n_plus_m(self) -> None:
        self.assertEqual(main.integrations_without_protocol(4, 6), 24)
        self.assertEqual(main.integrations_with_protocol(4, 6), 10)

    def test_one_client_discovers_two_unrelated_servers(self) -> None:
        self.assertEqual([tool["name"] for tool in self.weather.list_tools()], ["get_forecast"])
        self.assertEqual([tool["name"] for tool in self.tickets.list_tools()], ["count_open_tickets", "open_ticket"])

    def test_every_request_carries_version_and_capabilities(self) -> None:
        self.weather.discover()
        self.weather.call("get_forecast", {"city": "Pune"})
        requests = [message for message in self.weather.log if "method" in message]
        for request in requests:
            meta = request["params"]["_meta"]
            self.assertEqual(meta[main.PV_KEY], main.PROTOCOL_VERSION)
            self.assertIsInstance(meta[main.CAPS_KEY], dict)

    def test_discover_result_carries_cache_hints_and_server_identity(self) -> None:
        result = self.weather.discover()
        self.assertEqual(result["resultType"], "complete")
        self.assertEqual(result["supportedVersions"], [main.PROTOCOL_VERSION])
        self.assertEqual(result["cacheScope"], "public")
        self.assertGreaterEqual(result["ttlMs"], 0)
        self.assertEqual(result["_meta"][main.SERVER_INFO_KEY]["name"], "weather")

    def test_unknown_tool_is_a_protocol_error_with_invalid_params(self) -> None:
        response = self.tickets.call("delete_all_tickets", {})
        self.assertNotIn("result", response)
        self.assertEqual(response["error"]["code"], main.INVALID_PARAMS)

    def test_missing_argument_is_a_tool_execution_error_the_model_can_fix(self) -> None:
        response = self.weather.call("get_forecast", {})
        self.assertNotIn("error", response)
        self.assertTrue(response["result"]["isError"])
        self.assertIn("city", response["result"]["content"][0]["text"])

    def test_request_without_meta_is_rejected_with_invalid_params(self) -> None:
        server = main.build_weather_server()
        response = server.handle({"jsonrpc": "2.0", "id": 9, "method": "tools/list", "params": {}})
        self.assertEqual(response["error"]["code"], main.INVALID_PARAMS)

    def test_unsupported_version_names_the_supported_versions(self) -> None:
        response = self.tickets.send("tools/list", version="1999-01-01")
        error = response["error"]
        self.assertEqual(error["code"], main.UNSUPPORTED_PROTOCOL_VERSION)
        self.assertEqual(error["data"]["supported"], [main.PROTOCOL_VERSION])
        self.assertEqual(error["data"]["requested"], "1999-01-01")

    def test_tool_list_order_is_deterministic(self) -> None:
        first = [tool["name"] for tool in self.tickets.list_tools()]
        second = [tool["name"] for tool in self.tickets.list_tools()]
        self.assertEqual(first, second)
        self.assertEqual(first, sorted(first))

    def test_every_result_carries_a_result_type(self) -> None:
        for message in main.transcript():
            if "result" in message:
                self.assertIn(message["result"]["resultType"], {"complete", "input_required"})


if __name__ == "__main__":
    unittest.main()
