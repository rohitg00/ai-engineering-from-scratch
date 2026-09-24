import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class StatelessCoreTests(unittest.TestCase):
    def test_replica_a_and_b_give_identical_answers(self) -> None:
        _, router, _alice, _alice2, _bob = main.build_deployment()
        request = main.make_request(1, "tools/list")
        result_a = router.replicas[0].handle(request, principal="alice")
        result_b = router.replicas[1].handle(request, principal="alice")
        self.assertEqual(result_a["result"]["tools"], result_b["result"]["tools"])
        self.assertEqual(result_a["result"]["cacheScope"], result_b["result"]["cacheScope"])

    def test_handle_created_on_replica_a_works_on_replica_b(self) -> None:
        _, router, _alice, _alice2, _bob = main.build_deployment()
        replica_a, replica_b = router.replicas
        create_request = main.make_request(1, "tools/call", {"name": "create_basket", "arguments": {}})
        created = replica_a.handle(create_request, principal="alice")
        basket_id = created["result"]["structuredContent"]["basket_id"]
        add_request = main.make_request(
            2, "tools/call", {"name": "add_item", "arguments": {"basket_id": basket_id, "sku": "tent"}}
        )
        added = replica_b.handle(add_request, principal="alice")
        self.assertNotIn("error", added)
        self.assertFalse(added["result"]["isError"])
        self.assertEqual(added["result"]["structuredContent"]["items"], ["tent"])

    def test_handle_from_another_principal_is_refused_as_tool_execution_error(self) -> None:
        _, _router, alice, _alice2, bob = main.build_deployment()
        basket_id = alice.call("create_basket", {})["result"]["structuredContent"]["basket_id"]
        response = bob.call("add_item", {"basket_id": basket_id, "sku": "stove"})
        self.assertNotIn("error", response)
        self.assertTrue(response["result"]["isError"])
        self.assertIn("different principal", response["result"]["content"][0]["text"])

    def test_expired_handle_returns_a_tool_execution_error(self) -> None:
        clock, _router, alice, _alice2, _bob = main.build_deployment()
        basket_id = alice.call("create_basket", {})["result"]["structuredContent"]["basket_id"]
        clock.advance(main.BASKET_EXPIRY_TICKS + 1)
        response = alice.call("checkout", {"basket_id": basket_id})
        self.assertNotIn("error", response)
        self.assertTrue(response["result"]["isError"])
        self.assertIn("expired", response["result"]["content"][0]["text"])

    def test_adding_an_item_resets_the_idle_expiry_window(self) -> None:
        clock, _router, alice, _alice2, _bob = main.build_deployment()
        basket_id = alice.call("create_basket", {})["result"]["structuredContent"]["basket_id"]
        clock.advance(main.BASKET_EXPIRY_TICKS)
        alice.call("add_item", {"basket_id": basket_id, "sku": "kettle"})
        clock.advance(main.BASKET_EXPIRY_TICKS)
        response = alice.call("checkout", {"basket_id": basket_id})
        self.assertFalse(response["result"]["isError"])

    def test_list_tools_is_identical_for_two_connections_of_the_same_principal(self) -> None:
        _, _router, alice, alice2, _bob = main.build_deployment()
        first_names = alice.list_tools()
        second_names = alice2.list_tools()
        self.assertEqual(first_names, second_names)
        response = alice.log[-1]
        self.assertGreaterEqual(response["result"]["ttlMs"], 0)
        self.assertEqual(response["result"]["cacheScope"], "public")

    def test_request_without_meta_is_rejected_with_invalid_params(self) -> None:
        _, router, _alice, _alice2, _bob = main.build_deployment()
        replica = router.replicas[0]
        response = replica.handle({"jsonrpc": "2.0", "id": 9, "method": "tools/list", "params": {}}, principal="alice")
        self.assertNotIn("result", response)
        self.assertEqual(response["error"]["code"], main.INVALID_PARAMS)

    def test_interleaved_requests_across_replicas_keep_each_principals_items_separate(self) -> None:
        _, _router, alice, _alice2, bob = main.build_deployment()
        basket_id = alice.call("create_basket", {})["result"]["structuredContent"]["basket_id"]
        alice.call("add_item", {"basket_id": basket_id, "sku": "tent"})
        bob.call("add_item", {"basket_id": basket_id, "sku": "stove"})
        result = alice.call("checkout", {"basket_id": basket_id})
        self.assertEqual(result["result"]["structuredContent"]["items"], ["tent"])

    def test_every_request_in_transcript_carries_protocol_version_and_capabilities(self) -> None:
        requests = [message for message in main.transcript() if "method" in message]
        self.assertGreater(len(requests), 0)
        for request in requests:
            meta = request["params"]["_meta"]
            self.assertEqual(meta[main.PV_KEY], main.PROTOCOL_VERSION)
            self.assertIsInstance(meta[main.CAPS_KEY], dict)


if __name__ == "__main__":
    unittest.main()
