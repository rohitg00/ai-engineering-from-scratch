import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class PromptsAndCompletionTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = main.Client(main.PromptServer())

    def test_list_paginates_and_carries_cache_hints(self) -> None:
        first = self.client.list_prompts()
        self.assertEqual(first["result"]["resultType"], "complete")
        self.assertEqual([p["name"] for p in first["result"]["prompts"]], ["code_review"])
        self.assertEqual(first["result"]["nextCursor"], "after-code_review")
        self.assertEqual(first["result"]["cacheScope"], "public")
        self.assertGreaterEqual(first["result"]["ttlMs"], 0)
        second = self.client.list_prompts(cursor="after-code_review")
        self.assertEqual([p["name"] for p in second["result"]["prompts"]], ["bug_triage"])
        self.assertNotIn("nextCursor", second["result"])

    def test_invalid_cursor_is_rejected_with_invalid_params(self) -> None:
        response = self.client.list_prompts(cursor="bogus-cursor")
        self.assertNotIn("result", response)
        self.assertEqual(response["error"]["code"], main.INVALID_PARAMS)

    def test_get_renders_messages_with_argument_substituted(self) -> None:
        response = self.client.get_prompt("code_review", {"language": "python", "framework": "flask"})
        messages = response["result"]["messages"]
        self.assertEqual(messages[0]["content"]["type"], "text")
        self.assertIn("python", messages[0]["content"]["text"])
        self.assertIn("flask", messages[0]["content"]["text"])
        self.assertEqual(messages[1]["content"]["type"], "resource_link")
        self.assertEqual(messages[1]["content"]["uri"], "file:///styleguides/python.md")

    def test_missing_required_argument_is_invalid_params(self) -> None:
        response = self.client.get_prompt("code_review", {})
        self.assertNotIn("result", response)
        self.assertEqual(response["error"]["code"], main.INVALID_PARAMS)
        self.assertIn("language", response["error"]["data"]["missingArguments"])

    def test_unknown_prompt_is_invalid_params(self) -> None:
        response = self.client.get_prompt("release_notes", {})
        self.assertNotIn("result", response)
        self.assertEqual(response["error"]["code"], main.INVALID_PARAMS)

    def test_completion_caps_at_100_and_sets_has_more(self) -> None:
        response = self.client.complete({"type": "ref/resource", "uri": "file:///src/{path}"}, {"name": "path", "value": ""})
        completion = response["result"]["completion"]
        self.assertEqual(len(completion["values"]), 100)
        self.assertEqual(completion["total"], len(main.SRC_FILES))
        self.assertGreater(completion["total"], 100)
        self.assertTrue(completion["hasMore"])

    def test_narrow_prefix_drops_below_the_cap(self) -> None:
        response = self.client.complete({"type": "ref/resource", "uri": "file:///src/{path}"}, {"name": "path", "value": "auth/"})
        completion = response["result"]["completion"]
        self.assertFalse(completion["hasMore"])
        self.assertTrue(all(value.startswith("auth/") for value in completion["values"]))
        self.assertEqual(completion["total"], len(completion["values"]))

    def test_context_narrows_completions(self) -> None:
        without_context = self.client.complete({"type": "ref/prompt", "name": "code_review"}, {"name": "framework", "value": "fa"})
        with_context = self.client.complete(
            {"type": "ref/prompt", "name": "code_review"},
            {"name": "framework", "value": "fa"},
            context={"arguments": {"language": "python"}},
        )
        broad = set(without_context["result"]["completion"]["values"])
        narrow = set(with_context["result"]["completion"]["values"])
        self.assertIn("fastify", broad)
        self.assertNotIn("fastify", narrow)
        self.assertTrue(narrow < broad)

    def test_unknown_prompt_reference_in_completion_is_invalid_params(self) -> None:
        response = self.client.complete({"type": "ref/prompt", "name": "release_notes"}, {"name": "language", "value": "p"})
        self.assertNotIn("result", response)
        self.assertEqual(response["error"]["code"], main.INVALID_PARAMS)

    def test_request_without_meta_is_rejected_with_invalid_params(self) -> None:
        server = main.PromptServer()
        response = server.handle({"jsonrpc": "2.0", "id": 9, "method": "prompts/list", "params": {}})
        self.assertNotIn("result", response)
        self.assertEqual(response["error"]["code"], main.INVALID_PARAMS)

    def test_every_request_in_the_scenario_carries_protocol_meta(self) -> None:
        client = main.run_scenario()
        requests = [message for message in client.log if "method" in message]
        self.assertGreater(len(requests), 0)
        for request in requests:
            meta = request["params"]["_meta"]
            self.assertEqual(meta[main.PV_KEY], main.PROTOCOL_VERSION)
            self.assertIsInstance(meta[main.CAPS_KEY], dict)

    def test_every_result_in_the_scenario_carries_a_result_type(self) -> None:
        for message in main.transcript():
            if "result" in message:
                self.assertEqual(message["result"]["resultType"], "complete")


if __name__ == "__main__":
    unittest.main()
