# Tests for the implementation described in ../../docs/en.md.
# Few-shot and CoT: Wei et al., 2022, https://arxiv.org/abs/2201.11903
# Self-consistency: Wang et al., 2023, https://arxiv.org/abs/2203.11171
# These tests use deterministic local data and never call a provider.

import io
import sys
import unittest
from email.message import Message
from http.client import IncompleteRead
from pathlib import Path
from unittest.mock import patch
from urllib import request, response


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from advanced_prompting import (
    build_cot_prompt,
    build_zero_shot_cot_prompt,
    build_zero_shot_prompt,
    extract_answer,
    majority_vote,
    select_examples,
    self_consistency_solve,
    solve_with_escalation,
    vote_reasoning_paths,
)
from main import (
    DEMO_EXAMPLES,
    DEMO_QUESTION,
    OpenAICompatibleHTTPClient,
    _RejectRedirectHandler,
    build_offline_demo,
    main,
    parse_args,
    run_offline_demo,
)


class ScriptedClient:
    def __init__(self, responses):
        self.responses = iter(responses)
        self.calls = []

    def complete(self, **request):
        self.calls.append(request)
        return next(self.responses)


class RedirectAttemptHandler(request.BaseHandler):
    """Deterministic transport that records every attempted URL."""

    handler_order = 100

    def __init__(self, location):
        self.location = location
        self.requests = []

    def http_open(self, http_request):
        return self._respond(http_request)

    def https_open(self, http_request):
        return self._respond(http_request)

    def _respond(self, http_request):
        self.requests.append(http_request)
        headers = Message()
        if len(self.requests) == 1:
            headers["Location"] = self.location
            body = b""
            status = 302
            message = "Found"
        else:
            body = b'{"choices":[{"message":{"content":"forwarded"}}]}'
            status = 200
            message = "OK"
        result = response.addinfourl(
            io.BytesIO(body), headers, http_request.full_url, status
        )
        result.msg = message
        return result


class FailingBodyResponse:
    """Context-managed response whose body read raises a chosen error."""

    def __init__(self, failure):
        self.failure = failure

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        return False

    def read(self):
        raise self.failure


class AnswerExtractionTests(unittest.TestCase):
    def test_extract_answer_prefers_the_last_explicit_final_answer(self):
        text = "First guess: The answer is 10. Check complete. The answer is -12.5."
        self.assertEqual("-12.5", extract_answer(text))

    def test_extract_answer_supports_commas_and_gsm8k_markers(self):
        self.assertEqual("12000", extract_answer("Work shown.\n#### $12,000"))

    def test_extract_answer_uses_last_explicit_marker_in_source_order(self):
        text = "Initial result. The answer is 10. Verification follows. #### 12"
        self.assertEqual("12", extract_answer(text))

    def test_extract_answer_returns_none_without_numbers(self):
        self.assertIsNone(extract_answer("No numerical result is available."))


class ExampleSelectionTests(unittest.TestCase):
    def test_select_examples_prioritizes_semantic_overlap(self):
        selected = select_examples(DEMO_QUESTION, DEMO_EXAMPLES, num_examples=1)
        self.assertIn("oranges", selected[0]["question"])

    def test_select_examples_uses_original_order_for_ties(self):
        examples = [
            {"question": "unrelated alpha", "reasoning": "", "answer": "1"},
            {"question": "unrelated beta", "reasoning": "", "answer": "2"},
        ]
        self.assertEqual(examples, select_examples("target words", examples, 2))

    def test_select_examples_rejects_negative_count(self):
        with self.assertRaisesRegex(ValueError, "non-negative"):
            select_examples(DEMO_QUESTION, DEMO_EXAMPLES, -1)


class PromptConstructionTests(unittest.TestCase):
    def test_few_shot_prompt_contains_examples_and_target_last(self):
        _, user = build_cot_prompt(DEMO_QUESTION, DEMO_EXAMPLES, num_examples=2)
        self.assertIn("The answer is 18.", user)
        self.assertEqual(3, user.count("Q: "))
        self.assertTrue(user.endswith(f"Q: {DEMO_QUESTION}\nA:"))

    def test_zero_shot_cot_adds_reasoning_trigger_only_to_cot_variant(self):
        _, direct = build_zero_shot_prompt(DEMO_QUESTION)
        _, cot = build_zero_shot_cot_prompt(DEMO_QUESTION)
        self.assertNotIn("step by step", direct)
        self.assertIn("Let's think step by step", cot)


class SelfConsistencyTests(unittest.TestCase):
    def test_majority_vote_normalizes_equivalent_numeric_answers(self):
        answer, confidence, votes = majority_vote(["24", "24.0", "024", "20"])
        self.assertEqual("24", answer)
        self.assertEqual(0.75, confidence)
        self.assertEqual({"24": 3, "20": 1}, dict(votes))

    def test_majority_vote_ignores_missing_answers(self):
        answer, confidence, votes = majority_vote([None, "", "7"])
        self.assertEqual("7", answer)
        self.assertEqual(1.0, confidence)
        self.assertEqual({"7": 1}, dict(votes))

    def test_reasoning_path_vote_extracts_answers_before_voting(self):
        answer, confidence, votes = vote_reasoning_paths(
            [
                "One path. The answer is 9.",
                "A different path. The answer is 9.0.",
                "A mistaken path. The answer is 8.",
            ]
        )
        self.assertEqual(("9", 2 / 3, {"9": 2, "8": 1}), (answer, confidence, dict(votes)))

    def test_self_consistency_uses_injected_client_and_sample_temperature(self):
        client = ScriptedClient(
            [
                "Path A. The answer is 24.",
                "Path B. The answer is 24.0.",
                "Path C. The answer is 20.",
            ]
        )
        answer, confidence, reasonings, votes = self_consistency_solve(
            DEMO_QUESTION, DEMO_EXAMPLES, client, "local-model", n_samples=3
        )
        self.assertEqual("24", answer)
        self.assertEqual(2 / 3, confidence)
        self.assertEqual(3, len(reasonings))
        self.assertEqual({"24": 2, "20": 1}, dict(votes))
        self.assertTrue(all(call["temperature"] == 0.7 for call in client.calls))

    def test_unparseable_samples_lower_self_consistency_confidence(self):
        client = ScriptedClient(
            [
                "The answer is 24.",
                "No numerical conclusion.",
                "Unable to solve this problem.",
                "Insufficient information.",
                "I do not know.",
            ]
        )
        answer, confidence, reasonings, votes = self_consistency_solve(
            DEMO_QUESTION, DEMO_EXAMPLES, client, "local-model", n_samples=5
        )
        self.assertEqual("24", answer)
        self.assertEqual(0.2, confidence)
        self.assertEqual(5, len(reasonings))
        self.assertEqual({"24": 1}, dict(votes))

    def test_low_parse_rate_triggers_tree_of_thought_escalation(self):
        client = ScriptedClient(
            [
                "The answer is 24.",
                "The answer is 24.",
                "No numerical conclusion.",
                "Unable to solve this problem.",
                "Insufficient information.",
                "I do not know.",
            ]
        )
        with patch(
            "advanced_prompting.tree_of_thought_solve",
            return_value=("24", "verified tree path"),
        ) as tree_solver:
            result = solve_with_escalation(
                DEMO_QUESTION, DEMO_EXAMPLES, client, "local-model"
            )
        tree_solver.assert_called_once()
        self.assertEqual("tree_of_thought", result["method"])


class OfflineDemoTests(unittest.TestCase):
    def test_timeout_argument_requires_a_positive_finite_number(self):
        for value in ("0", "-0.1", "nan", "inf", "-inf"):
            with self.subTest(value=value):
                with patch("sys.stderr", new=io.StringIO()):
                    with self.assertRaises(SystemExit) as raised:
                        parse_args(["--timeout", value])
                self.assertEqual(2, raised.exception.code)
        self.assertEqual(0.25, parse_args(["--timeout", "0.25"]).timeout)

    def test_offline_demo_reports_expected_vote(self):
        result = build_offline_demo()
        self.assertEqual("24", result["answer"])
        self.assertEqual(0.8, result["confidence"])
        self.assertEqual({"24": 4, "20": 1}, result["votes"])

    def test_default_demo_does_not_open_a_network_connection(self):
        output = io.StringIO()
        with patch("urllib.request.urlopen") as urlopen:
            result = run_offline_demo(stream=output)
        urlopen.assert_not_called()
        self.assertEqual("24", result["answer"])
        self.assertIn("No network request was made", output.getvalue())

    def test_online_mode_without_credentials_fails_before_network_access(self):
        with patch("urllib.request.urlopen") as urlopen:
            with patch("sys.stderr", new=io.StringIO()) as error_output:
                exit_code = main(["--online"], environ={})
        urlopen.assert_not_called()
        self.assertEqual(2, exit_code)
        self.assertIn("OPENAI_API_KEY", error_output.getvalue())

    def test_online_provider_error_exits_cleanly(self):
        with patch(
            "main.OpenAICompatibleHTTPClient.complete",
            side_effect=RuntimeError("provider returned HTTP 401"),
        ):
            with patch("sys.stderr", new=io.StringIO()) as error_output:
                exit_code = main(
                    ["--online", "--model", "demo-model"],
                    environ={"OPENAI_API_KEY": "test-only-key"},
                )
        self.assertEqual(1, exit_code)
        self.assertIn("HTTP 401", error_output.getvalue())

    def test_http_client_requires_an_absolute_https_base_url(self):
        for base_url in (
            "http://example.test/v1",
            "//example.test/v1",
            "ftp://example.test/v1",
            "example.test/v1",
            "https://example.test:invalid/v1",
        ):
            with self.subTest(base_url=base_url):
                with self.assertRaisesRegex(ValueError, "absolute HTTPS URL"):
                    OpenAICompatibleHTTPClient("test-key", base_url)

    def test_online_insecure_base_url_is_a_controlled_failure(self):
        with patch(
            "main.OpenAICompatibleHTTPClient.complete"
        ) as complete, patch("sys.stderr", new=io.StringIO()) as error_output:
            exit_code = main(
                ["--online", "--model", "demo-model"],
                environ={
                    "OPENAI_API_KEY": "test-only-key",
                    "OPENAI_BASE_URL": "http://example.test/v1",
                },
            )
        complete.assert_not_called()
        self.assertEqual(2, exit_code)
        self.assertIn("absolute HTTPS URL", error_output.getvalue())

    def test_online_invalid_textual_port_is_a_controlled_failure(self):
        with patch(
            "main.OpenAICompatibleHTTPClient.complete"
        ) as complete, patch("sys.stderr", new=io.StringIO()) as error_output:
            exit_code = main(
                ["--online", "--model", "demo-model"],
                environ={
                    "OPENAI_API_KEY": "test-only-key",
                    "OPENAI_BASE_URL": "https://example.test:invalid/v1",
                },
            )
        complete.assert_not_called()
        self.assertEqual(2, exit_code)
        self.assertIn("absolute HTTPS URL", error_output.getvalue())

    def test_http_client_rejects_redirect_before_forwarding_bearer_token(self):
        for location in (
            "http://attacker.test/collect",
            "https://other-authority.test/collect",
        ):
            with self.subTest(location=location):
                client = OpenAICompatibleHTTPClient(
                    "secret-test-key", "https://example.test/v1"
                )
                transport = RedirectAttemptHandler(location)
                client._opener = request.build_opener(
                    _RejectRedirectHandler(), transport
                )

                with self.assertRaisesRegex(RuntimeError, "redirect rejected"):
                    client.complete("model", "system", "user", 0.0, 10)

                self.assertEqual(1, len(transport.requests))
                initial_request = transport.requests[0]
                self.assertEqual(
                    "https://example.test/v1/chat/completions",
                    initial_request.full_url,
                )
                self.assertEqual(
                    "Bearer secret-test-key",
                    initial_request.get_header("Authorization"),
                )
                self.assertNotIn("Authorization", initial_request.headers)
                self.assertIn("Authorization", initial_request.unredirected_hdrs)

    def test_http_client_rejects_malformed_or_invalid_success_payload(self):
        client = OpenAICompatibleHTTPClient("test-key", "https://example.test/v1")
        payloads = [b"not-json", b'{"choices": []}', b'{"choices": [{"message": {"content": null}}]}']
        for payload in payloads:
            with self.subTest(payload=payload):
                with patch.object(
                    client._opener, "open", return_value=io.BytesIO(payload)
                ):
                    with self.assertRaisesRegex(RuntimeError, "invalid JSON|assistant content"):
                        client.complete("model", "system", "user", 0.0, 10)

    def test_http_client_normalizes_response_body_network_errors(self):
        client = OpenAICompatibleHTTPClient("test-key", "https://example.test/v1")
        failures = (
            TimeoutError("response body timed out"),
            ConnectionResetError("connection reset during body read"),
            IncompleteRead(b'{\"choices\":', 20),
        )
        for failure in failures:
            with self.subTest(failure=type(failure).__name__):
                with patch.object(
                    client._opener,
                    "open",
                    return_value=FailingBodyResponse(failure),
                ):
                    with self.assertRaisesRegex(
                        RuntimeError, "provider response read failed"
                    ) as raised:
                        client.complete("model", "system", "user", 0.0, 10)
                self.assertIs(failure, raised.exception.__cause__)

    def test_online_response_body_timeout_is_a_controlled_failure(self):
        with patch("main.request.build_opener") as build_opener:
            build_opener.return_value.open.return_value = FailingBodyResponse(
                TimeoutError("response body timed out")
            )
            with patch("sys.stderr", new=io.StringIO()) as error_output:
                exit_code = main(
                    ["--online", "--model", "demo-model"],
                    environ={"OPENAI_API_KEY": "test-only-key"},
                )
        self.assertEqual(1, exit_code)
        self.assertIn("provider response read failed", error_output.getvalue())
        self.assertNotIn("Traceback", error_output.getvalue())

    def test_online_truncated_response_is_a_controlled_failure(self):
        with patch("main.request.build_opener") as build_opener:
            build_opener.return_value.open.return_value = FailingBodyResponse(
                IncompleteRead(b'{\"choices\":', 20)
            )
            with patch("sys.stderr", new=io.StringIO()) as error_output:
                exit_code = main(
                    ["--online", "--model", "demo-model"],
                    environ={"OPENAI_API_KEY": "test-only-key"},
                )
        self.assertEqual(1, exit_code)
        self.assertIn("provider response read failed", error_output.getvalue())
        self.assertNotIn("Traceback", error_output.getvalue())

    def test_http_client_does_not_hide_programming_errors_during_body_read(self):
        client = OpenAICompatibleHTTPClient("test-key", "https://example.test/v1")
        with patch.object(
            client._opener,
            "open",
            return_value=FailingBodyResponse(TypeError("test programming error")),
        ):
            with self.assertRaisesRegex(TypeError, "test programming error"):
                client.complete("model", "system", "user", 0.0, 10)

    def test_online_unparseable_answer_is_a_controlled_failure(self):
        with patch(
            "main.OpenAICompatibleHTTPClient.complete",
            return_value="I cannot determine a numerical result.",
        ):
            with patch("sys.stdout", new=io.StringIO()) as output:
                with patch("sys.stderr", new=io.StringIO()) as error_output:
                    exit_code = main(
                        ["--online", "--model", "demo-model"],
                        environ={"OPENAI_API_KEY": "test-only-key"},
                    )
        self.assertEqual(1, exit_code)
        self.assertNotIn("Parsed answer: None", output.getvalue())
        self.assertIn("parseable numeric answer", error_output.getvalue())


if __name__ == "__main__":
    unittest.main()
