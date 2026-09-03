# Runnable demonstration for the lesson in ../docs/en.md.
# Few-shot and CoT: Wei et al., 2022, https://arxiv.org/abs/2201.11903
# Self-consistency: Wang et al., 2023, https://arxiv.org/abs/2203.11171
# The default path is deterministic and performs no network requests.
# Live chat-completions access is explicit and uses only Python's stdlib.

import argparse
import json
import math
import os
import sys
from http.client import IncompleteRead
from urllib import error, parse, request

from advanced_prompting import (
    build_cot_prompt,
    few_shot_cot_solve,
    select_examples,
    vote_reasoning_paths,
)


DEMO_EXAMPLES = [
    {
        "question": (
            "A fruit stand has 36 oranges. It sells one third in the morning "
            "and one quarter of the remainder later. How many oranges remain?"
        ),
        "reasoning": (
            "One third of 36 is 12, leaving 24. One quarter of 24 is 6, "
            "so 24 - 6 = 18 oranges remain."
        ),
        "answer": "18",
    },
    {
        "question": (
            "A writer drafts 4 pages on each of 3 days. How many pages are drafted?"
        ),
        "reasoning": "There are 3 groups of 4 pages, so 3 * 4 = 12 pages.",
        "answer": "12",
    },
    {
        "question": (
            "A ticket costs $8 and a snack costs $3. What is the total cost?"
        ),
        "reasoning": "Add the two prices: 8 + 3 = 11 dollars.",
        "answer": "11",
    },
]

DEMO_QUESTION = (
    "A grocer has 48 apples. The grocer sells one third in the morning and "
    "one quarter of the remainder in the afternoon. How many apples remain?"
)

DEMO_REASONING_PATHS = [
    "One third of 48 is 16, leaving 32. One quarter of 32 is 8. "
    "Then 32 - 8 = 24. The answer is 24.",
    "After the first sale, 48 * 2/3 = 32. Keeping three quarters gives "
    "32 * 3/4 = 24. The answer is 24.",
    "The sold fractions are 1/3 + 1/4 = 7/12, so 48 * 5/12 = 20. "
    "The answer is 20.",
    "Sell 16 first and 8 next: 48 - 16 - 8 = 24. The answer is 24.",
    "The remaining fraction is (2/3) * (3/4) = 1/2; 48 / 2 = 24. "
    "The answer is 24.",
]


def positive_timeout(value):
    """Parse a finite timeout greater than zero for argparse."""
    try:
        timeout = float(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(
            "timeout must be a positive finite number"
        ) from exc
    if not math.isfinite(timeout) or timeout <= 0:
        raise argparse.ArgumentTypeError(
            "timeout must be a positive finite number"
        )
    return timeout


class _RejectRedirectHandler(request.HTTPRedirectHandler):
    """Stop redirects before urllib can copy request headers to a new URL."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise error.HTTPError(
            req.full_url, code, "redirect responses are not allowed", headers, fp
        )


class OpenAICompatibleHTTPClient:
    """Minimal opt-in chat-completions client built from the stdlib."""

    def __init__(self, api_key, base_url, timeout=30.0):
        try:
            parsed_base_url = parse.urlsplit(base_url)
            hostname = parsed_base_url.hostname
            parsed_base_url.port  # Access validates textual and numeric port values.
        except (TypeError, ValueError) as exc:
            raise ValueError("base_url must be an absolute HTTPS URL") from exc
        if parsed_base_url.scheme.lower() != "https" or not hostname:
            raise ValueError("base_url must be an absolute HTTPS URL")
        self.api_key = api_key
        self.endpoint = f"{base_url.rstrip('/')}/chat/completions"
        self.timeout = timeout
        self._opener = request.build_opener(_RejectRedirectHandler())

    def complete(self, model, system, user, temperature, max_tokens):
        payload = json.dumps(
            {
                "model": model,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
        ).encode("utf-8")
        http_request = request.Request(
            self.endpoint,
            data=payload,
            headers={
                "Content-Type": "application/json",
            },
            method="POST",
        )
        # urllib's stock redirect handler copies regular headers to the next URL.
        # Keep the credential non-forwardable even though redirects are rejected.
        http_request.add_unredirected_header(
            "Authorization", f"Bearer {self.api_key}"
        )
        try:
            response = self._opener.open(http_request, timeout=self.timeout)
        except error.HTTPError as exc:
            if 300 <= exc.code < 400:
                raise RuntimeError(
                    f"provider redirect rejected (HTTP {exc.code})"
                ) from exc
            raise RuntimeError(f"provider returned HTTP {exc.code}") from exc
        except error.URLError as exc:
            raise RuntimeError(f"provider request failed: {exc.reason}") from exc
        except OSError as exc:
            raise RuntimeError(f"provider request failed: {exc}") from exc

        try:
            with response:
                body = json.load(response)
        except (OSError, IncompleteRead) as exc:
            raise RuntimeError(f"provider response read failed: {exc}") from exc
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            raise RuntimeError("provider returned invalid JSON") from exc

        try:
            content = body["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise RuntimeError("provider response has no assistant content") from exc
        if not isinstance(content, str) or not content.strip():
            raise RuntimeError("provider response has no assistant content")
        return content


def build_offline_demo():
    selected = select_examples(DEMO_QUESTION, DEMO_EXAMPLES, num_examples=2)
    system, user = build_cot_prompt(DEMO_QUESTION, selected, num_examples=2)
    answer, confidence, votes = vote_reasoning_paths(DEMO_REASONING_PATHS)
    return {
        "question": DEMO_QUESTION,
        "selected_questions": [example["question"] for example in selected],
        "system": system,
        "user": user,
        "answer": answer,
        "confidence": confidence,
        "votes": dict(votes),
    }


def run_offline_demo(stream=None):
    stream = sys.stdout if stream is None else stream
    result = build_offline_demo()
    print("Few-Shot + Chain-of-Thought: offline demonstration", file=stream)
    print(f"Question: {result['question']}", file=stream)
    print("Selected demonstrations:", file=stream)
    for question in result["selected_questions"]:
        print(f"  - {question}", file=stream)
    print("Prompt contract: reasoning followed by 'The answer is [number]'", file=stream)
    print(f"Self-consistency votes: {result['votes']}", file=stream)
    print(
        f"Winning answer: {result['answer']} "
        f"(confidence {result['confidence']:.0%})",
        file=stream,
    )
    print("No network request was made. Use --online to opt in.", file=stream)
    return result


def run_online_demo(args, environ, stream=None, error_stream=None):
    stream = sys.stdout if stream is None else stream
    error_stream = sys.stderr if error_stream is None else error_stream
    api_key = environ.get("OPENAI_API_KEY")
    model = args.model or environ.get("OPENAI_MODEL") or environ.get("LLM_MODEL")
    if not api_key or not model:
        print(
            "Online mode requires OPENAI_API_KEY and --model (or OPENAI_MODEL).",
            file=error_stream,
        )
        return 2

    base_url = environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1")
    try:
        client = OpenAICompatibleHTTPClient(api_key, base_url, timeout=args.timeout)
    except ValueError as exc:
        print(f"Online configuration invalid: {exc}", file=error_stream)
        return 2
    selected = select_examples(DEMO_QUESTION, DEMO_EXAMPLES, num_examples=2)
    try:
        answer, reasoning = few_shot_cot_solve(
            DEMO_QUESTION, selected, client, model, num_examples=2
        )
    except RuntimeError as exc:
        print(f"Online request failed: {exc}", file=error_stream)
        return 1
    if answer is None:
        print(
            "Online response did not contain a parseable numeric answer.",
            file=error_stream,
        )
        return 1
    print(f"Model: {model}", file=stream)
    print(reasoning, file=stream)
    print(f"Parsed answer: {answer}", file=stream)
    return 0


def parse_args(argv=None):
    parser = argparse.ArgumentParser(
        description="Demonstrate few-shot CoT and self-consistency offline."
    )
    parser.add_argument(
        "--online",
        action="store_true",
        help="explicitly call an OpenAI-compatible chat-completions endpoint",
    )
    parser.add_argument("--model", help="provider model ID for --online")
    parser.add_argument(
        "--timeout",
        type=positive_timeout,
        default=30.0,
        help="positive online request timeout in seconds",
    )
    return parser.parse_args(argv)


def main(argv=None, environ=None):
    args = parse_args(argv)
    if not args.online:
        run_offline_demo()
        return 0
    return run_online_demo(args, os.environ if environ is None else environ)


if __name__ == "__main__":
    raise SystemExit(main())
