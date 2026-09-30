import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class CachingAndPaginationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.clock = main.FakeClock()
        self.server = main.NotesServer()
        self.cache = main.ClientCache(self.clock.now)
        self.alice = main.Client(self.server, "alice-token", self.clock, self.cache)
        self.bob = main.Client(self.server, "bob-token", self.clock, self.cache)

    def test_fresh_entry_served_without_a_new_request(self) -> None:
        self.alice.list_resources()
        self.alice.list_resources()
        self.assertEqual(self.server.call_counts["resources/list"], 1)

    def test_entry_is_refetched_after_ttl_expires(self) -> None:
        self.alice.list_resources()
        self.clock.advance(120001)
        self.alice.list_resources()
        self.assertEqual(self.server.call_counts["resources/list"], 2)

    def test_private_entry_is_not_shared_across_tokens(self) -> None:
        alice_journal = self.alice.read_resource("note://private/journal")
        bob_journal = self.bob.read_resource("note://private/journal")
        self.assertEqual(self.server.call_counts["resources/read"], 2)
        self.assertNotEqual(alice_journal["contents"][0]["text"], bob_journal["contents"][0]["text"])

    def test_public_entry_is_shared_across_tokens(self) -> None:
        self.alice.read_resource("note://shared/readme")
        self.bob.read_resource("note://shared/readme")
        self.assertEqual(self.server.call_counts["resources/read"], 1)

    def test_list_changed_notification_invalidates_before_ttl(self) -> None:
        self.alice.list_resources()
        self.alice.listen({"resourcesListChanged": True})
        self.alice.deliver_list_changed()
        self.alice.close_listen()
        self.clock.advance(1000)
        self.alice.list_resources()
        self.assertEqual(self.server.call_counts["resources/list"], 2)

    def test_input_required_result_is_never_cached(self) -> None:
        request = main.make_request(1, "resources/read", {"uri": "note://private/vault"})
        response = self.server.handle(request, self.alice.token)
        self.assertEqual(response["result"]["resultType"], "input_required")
        self.assertIsNone(self.cache.get("resources/read", ("note://private/vault",), self.alice.token))

    def test_accept_without_proceed_does_not_reveal_the_vault(self) -> None:
        request = main.make_request(1, "resources/read", {
            "uri": "note://private/vault",
            "inputResponses": {"confirm": {"action": "accept", "content": {"proceed": False}}},
        })
        response = self.server.handle(request, self.alice.token)
        self.assertEqual(response["result"]["contents"], [])

    def test_mrtr_retried_result_is_not_cached(self) -> None:
        self.alice.read_resource("note://private/vault")
        calls_after_first_round_trip = self.server.call_counts["resources/read"]
        self.alice.read_resource("note://private/vault")
        self.assertGreater(self.server.call_counts["resources/read"], calls_after_first_round_trip)
        self.assertIsNone(self.cache.get("resources/read", ("note://private/vault",), self.alice.token))

    def test_empty_string_cursor_continues_pagination(self) -> None:
        first = self.alice.list_resources()
        self.assertEqual(first["nextCursor"], "")
        second = self.alice.list_resources(cursor="")
        self.assertEqual([resource["name"] for resource in second["resources"]], ["changelog", "faq"])

    def test_invalid_cursor_is_invalid_params(self) -> None:
        response = self.alice.list_resources(cursor="not-a-real-cursor")
        self.assertEqual(response["error"]["code"], main.INVALID_PARAMS)

    def test_resource_listing_is_deterministically_ordered(self) -> None:
        first = [resource["uri"] for resource in self.alice.list_resources()["resources"]]
        self.clock.advance(200000)
        second = [resource["uri"] for resource in self.bob.list_resources()["resources"]]
        self.assertEqual(first, second)
        self.assertEqual(first, sorted(first))

    def test_ttl_defaults_and_negative_values_are_clamped_to_zero(self) -> None:
        self.cache.store("resources/read", ("note://shared/x",), "alice-token", {"cacheScope": "public", "ttlMs": -50})
        self.assertIsNone(self.cache.get("resources/read", ("note://shared/x",), "alice-token"))
        self.cache.store("resources/read", ("note://shared/y",), "alice-token", {"cacheScope": "public"})
        self.assertIsNone(self.cache.get("resources/read", ("note://shared/y",), "alice-token"))


if __name__ == "__main__":
    unittest.main()
