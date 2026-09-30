import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


STREAM_NOTIFICATION_METHODS = {
    "notifications/subscriptions/acknowledged",
    "notifications/tools/list_changed",
    "notifications/prompts/list_changed",
    "notifications/resources/list_changed",
    "notifications/resources/updated",
}


class NotificationsAndSubscriptionsTests(unittest.TestCase):
    def test_acknowledgment_is_first_message_and_carries_subscription_id(self) -> None:
        server = main.SubscriptionServer("files")
        client = main.SubscriberClient(server)
        sub_id = client.listen({"resourcesListChanged": True})
        self.assertEqual(client.log[0]["method"], "subscriptions/listen")
        ack = client.log[1]
        self.assertEqual(ack["method"], "notifications/subscriptions/acknowledged")
        self.assertNotIn("id", ack)
        self.assertEqual(ack["params"]["_meta"][main.SUB_KEY], sub_id)

    def test_acknowledgment_reflects_only_the_granted_subset(self) -> None:
        server = main.SubscriptionServer("files")
        client = main.SubscriberClient(server)
        client.listen({"resourcesListChanged": True, "promptsListChanged": True})
        ack = client.log[1]
        self.assertEqual(ack["params"]["notifications"], {"resourcesListChanged": True})

    def test_unrequested_notification_types_are_never_sent(self) -> None:
        server = main.SubscriptionServer("workspace")
        client = main.SubscriberClient(server)
        sub_a = client.listen({"toolsListChanged": True})
        sub_b = client.listen({"resourcesListChanged": True, "promptsListChanged": True})
        self.assertIsNone(server.list_changed(sub_b, "promptsListChanged"))
        self.assertIsNone(server.list_changed(sub_a, "resourcesListChanged"))

    def test_progress_notifications_strictly_increase(self) -> None:
        server = main.SubscriptionServer("workspace")
        client = main.SubscriberClient(server)
        client.call_with_progress("run_build", {"target": "release"}, "job-1")
        progress = [message for message in client.log if message.get("method") == "notifications/progress"]
        values = [entry["params"]["progress"] for entry in progress]
        self.assertEqual(len(values), 3)
        self.assertEqual(values, sorted(values))
        self.assertEqual(len(values), len(set(values)))

    def test_progress_notifications_never_carry_a_subscription_id(self) -> None:
        server = main.SubscriptionServer("workspace")
        client = main.SubscriberClient(server)
        client.listen({"toolsListChanged": True})
        client.call_with_progress("run_build", {"target": "release"}, "job-2")
        progress = [message for message in client.log if message.get("method") == "notifications/progress"]
        self.assertTrue(progress)
        for entry in progress:
            self.assertNotIn("_meta", entry["params"])
        stream_notifications = [message for message in client.log if message.get("method") in STREAM_NOTIFICATION_METHODS]
        self.assertTrue(stream_notifications)
        for entry in stream_notifications:
            self.assertIn(main.SUB_KEY, entry["params"]["_meta"])

    def test_cancellation_stops_further_server_messages(self) -> None:
        server = main.SubscriptionServer("workspace")
        client = main.SubscriberClient(server)
        sub_id = client.listen({"resourceSubscriptions": ["file:///a.txt"]})
        self.assertIsNotNone(server.resource_updated(sub_id, "file:///a.txt"))
        client.cancel(sub_id)
        self.assertIsNone(server.resource_updated(sub_id, "file:///a.txt"))

    def test_late_notification_after_local_cancel_is_dropped(self) -> None:
        server = main.SubscriptionServer("workspace")
        client = main.SubscriberClient(server)
        sub_id = client.listen({"resourceSubscriptions": ["file:///a.txt"]})
        client.cancel(sub_id)
        before = len(client.log)
        late = main.make_notification(
            "notifications/resources/updated", {"_meta": {main.SUB_KEY: sub_id}, "uri": "file:///a.txt"},
        )
        delivered = client.receive_stream(late)
        self.assertFalse(delivered)
        self.assertEqual(len(client.log), before)

    def test_graceful_closure_result_carries_subscription_id(self) -> None:
        server = main.SubscriptionServer("workspace")
        client = main.SubscriberClient(server)
        sub_id = client.listen({"toolsListChanged": True})
        result = client.close_gracefully(sub_id)
        self.assertEqual(result["id"], sub_id)
        self.assertEqual(result["result"]["resultType"], "complete")
        self.assertEqual(result["result"]["_meta"][main.SUB_KEY], sub_id)
        self.assertIsNone(client.close_gracefully(sub_id))

    def test_multiple_subscriptions_are_demultiplexed_by_id(self) -> None:
        server = main.SubscriptionServer("workspace")
        client = main.SubscriberClient(server)
        sub_a = client.listen({"toolsListChanged": True})
        sub_b = client.listen({"resourcesListChanged": True})
        self.assertNotEqual(sub_a, sub_b)
        note_a = server.list_changed(sub_a, "toolsListChanged")
        note_b = server.list_changed(sub_b, "resourcesListChanged")
        self.assertTrue(client.receive_stream(note_a))
        self.assertTrue(client.receive_stream(note_b))
        self.assertEqual(note_a["params"]["_meta"][main.SUB_KEY], sub_a)
        self.assertEqual(note_b["params"]["_meta"][main.SUB_KEY], sub_b)
        self.assertIn(note_a, client.log)
        self.assertIn(note_b, client.log)

    def test_stdio_reconnect_requires_resending_listen(self) -> None:
        server = main.SubscriptionServer("files")
        client = main.SubscriberClient(server)
        old_id = client.listen({"resourcesListChanged": True})
        reconnected_server = main.SubscriptionServer("files")
        reconnected_client = main.SubscriberClient(reconnected_server)
        self.assertIsNone(reconnected_server.list_changed(old_id, "resourcesListChanged"))
        new_id = reconnected_client.listen({"resourcesListChanged": True})
        self.assertIsNotNone(reconnected_server.list_changed(new_id, "resourcesListChanged"))

    def test_transcript_wraps_the_dropped_late_notification_as_a_violation(self) -> None:
        entries = main.transcript()
        wrapped = [entry for entry in entries if isinstance(entry, dict) and "violation" in entry]
        self.assertEqual(len(wrapped), 1)
        self.assertEqual(wrapped[0]["message"]["params"]["uri"], "file:///project/report.csv")

    def test_every_result_in_the_transcript_carries_a_result_type(self) -> None:
        for message in main.transcript():
            if isinstance(message, dict) and "result" in message:
                self.assertIn(message["result"]["resultType"], {"complete", "input_required"})


if __name__ == "__main__":
    unittest.main()
