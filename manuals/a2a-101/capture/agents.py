import base64
import threading

from a2a_ref import Agent, data_part, text_part

START = 1791277200
DEPLOY_TOKEN = "dpl_test_7c1e4b"
SIGNING_KEY = b"manual-demo-signing-key-not-for-production"


def interfaces(port):
    return [
        {"url": f"http://localhost:{port}/a2a/jsonrpc", "protocolBinding": "JSONRPC", "protocolVersion": "1.0"},
        {"url": f"http://localhost:{port}/a2a/rest", "protocolBinding": "HTTP+JSON", "protocolVersion": "1.0"},
    ]


TEST_RUNNER_CARD = {
    "name": "test-runner",
    "description": "Checks out a commit, runs its test suite in a clean container, and streams the log.",
    "supportedInterfaces": interfaces(41241),
    "provider": {"url": "https://ci.example.com", "organization": "Platform Team"},
    "version": "2.3.0",
    "capabilities": {"streaming": True, "pushNotifications": True},
    "defaultInputModes": ["text/plain", "application/json"],
    "defaultOutputModes": ["text/plain", "application/json"],
    "skills": [
        {
            "id": "run-tests",
            "name": "Run tests",
            "description": "Run the test suite of a repository at one commit and report each failure with its log.",
            "tags": ["ci", "tests"],
            "examples": ["Run the unit tests for payments-api at commit 9f3c2e1"],
        }
    ],
}

CODE_REVIEWER_CARD = {
    "name": "code-reviewer",
    "description": "Reviews a unified diff against a base branch and returns findings with file and line.",
    "supportedInterfaces": interfaces(41242),
    "provider": {"url": "https://review.example.com", "organization": "Developer Tools"},
    "version": "0.9.4",
    "capabilities": {"streaming": True},
    "defaultInputModes": ["text/plain", "text/x-diff"],
    "defaultOutputModes": ["text/plain", "application/json"],
    "skills": [
        {
            "id": "review-diff",
            "name": "Review a diff",
            "description": "Compare a diff with its base branch and report risky changes.",
            "tags": ["review", "diff"],
            "examples": ["Review this diff of payments-api"],
            "inputModes": ["text/x-diff", "text/plain"],
        },
        {
            "id": "answer-question",
            "name": "Answer a review question",
            "description": "Answer a short question about what this reviewer checks.",
            "tags": ["review", "faq"],
        },
    ],
}

DEPLOYER_CARD = {
    "name": "deployer",
    "description": "Deploys a tagged build to staging after an operator approves it.",
    "supportedInterfaces": interfaces(41243),
    "provider": {"url": "https://deploy.example.com", "organization": "Platform Team"},
    "version": "1.4.1",
    "capabilities": {"streaming": True, "extendedAgentCard": True},
    "securitySchemes": {"bearer": {"httpAuthSecurityScheme": {"description": "A token issued by the platform team.", "scheme": "Bearer"}}},
    "securityRequirements": [{"schemes": {"bearer": {"list": []}}}],
    "defaultInputModes": ["text/plain"],
    "defaultOutputModes": ["text/plain", "application/json"],
    "skills": [
        {
            "id": "deploy",
            "name": "Deploy a build",
            "description": "Deploy one tagged build to staging, with operator approval.",
            "tags": ["deploy", "staging"],
            "examples": ["Deploy build 2026.10.06-1 to staging"],
        }
    ],
}

DEPLOYER_EXTENDED = dict(DEPLOYER_CARD)
DEPLOYER_EXTENDED["skills"] = DEPLOYER_CARD["skills"] + [
    {
        "id": "rollback",
        "name": "Roll back a deploy",
        "description": "Return staging to the previous build. Shown only to authenticated callers.",
        "tags": ["deploy", "rollback"],
    }
]

LOG = [
    "collected 12 items\n",
    "tests/test_charges.py ........  [ 66%]\n",
    "tests/test_refunds.py ..F.  [100%]\n",
    "FAILED tests/test_refunds.py::test_partial_refund - AssertionError: 450 != 500\n",
    "1 failed, 11 passed in 4.21s\n",
]
PASS_LOG = [
    "collected 13 items\n",
    "tests/test_charges.py ........  [ 61%]\n",
    "tests/test_refunds.py .....  [100%]\n",
    "13 passed in 4.38s\n",
]
FULL_LOG = [f"tests/test_suite_{n:02d}.py ........\n" for n in range(1, 9)]


def run_tests(turn, resume):
    request = turn.text()
    if "deadbee" in request:
        yield turn.status("TASK_STATE_WORKING", "Checking out deadbee")
        yield turn.status("TASK_STATE_FAILED", "Commit deadbee does not exist in payments-api.")
        return
    commit = "a41d7c3" if "a41d7c3" in request else "9f3c2e1"
    lines = FULL_LOG if "full suite" in request else PASS_LOG if commit == "a41d7c3" else LOG
    yield turn.status("TASK_STATE_WORKING", f"Checking out {commit} and starting the suite")
    for index, line in enumerate(lines):
        yield turn.artifact("test-log", "test-log.txt" if index == 0 else None, [text_part(line)], append=index > 0, last_chunk=index == len(lines) - 1)
    if lines is FULL_LOG:
        yield turn.status("TASK_STATE_COMPLETED", "96 passed")
        return
    if lines is PASS_LOG:
        summary = {"passed": 13, "failed": 0, "failures": []}
        done = "13 passed"
    else:
        summary = {"passed": 11, "failed": 1, "failures": [{"test": "tests/test_refunds.py::test_partial_refund", "error": "AssertionError: 450 != 500"}]}
        done = "1 failed, 11 passed"
    yield turn.artifact("summary", "summary.json", [data_part(summary)], last_chunk=True)
    yield turn.status("TASK_STATE_COMPLETED", done)


def review_quick(message):
    texts = [part.get("text", "") for part in message.get("parts", [])]
    has_diff = any(part.get("mediaType") == "text/x-diff" for part in message.get("parts", []))
    if not has_diff and any(text.rstrip().endswith("?") for text in texts):
        return "I review unified diffs in Python, TypeScript and Go. Send the diff as a text/x-diff part and name the base branch."
    return None


def review_diff(turn, resume):
    if not resume and "base:" not in turn.text():
        yield turn.status("TASK_STATE_INPUT_REQUIRED", "Which base branch should I compare this diff against?")
        return
    yield turn.status("TASK_STATE_WORKING", "Comparing the diff against main")
    diff = ""
    for part in turn.task["history"][0]["parts"]:
        if part.get("mediaType") == "text/x-diff":
            diff = base64.b64decode(part["raw"]).decode("utf-8")
    if "int(amount)" in diff:
        findings = [
            {"file": "payments/refunds.py", "line": 42, "severity": "high", "finding": "Partial refunds round the amount down before the fee is subtracted."},
            {"file": "payments/refunds.py", "line": 57, "severity": "low", "finding": "The new branch has no test."},
        ]
    else:
        findings = [{"file": "tests/test_refunds.py", "line": 18, "severity": "low", "finding": "The test name does not say which rounding rule it checks."}]
    summary = f"{len(findings)} finding{'s' if len(findings) > 1 else ''} in {findings[0]['file']}"
    yield turn.artifact("review", "review.json", [text_part(summary), data_part({"base": "main", "findings": findings})], last_chunk=True)
    yield turn.status("TASK_STATE_COMPLETED", f"{len(findings)} finding{'s' if len(findings) > 1 else ''}")


def deploy(turn, resume):
    request = turn.text()
    if "production" in request:
        yield turn.status("TASK_STATE_REJECTED", "Production deploys are outside this agent's policy. Use the release train.")
        return
    yield turn.status("TASK_STATE_WORKING", "Preparing build 2026.10.06-1 for staging")
    approved = threading.Event()
    turn.agent.approvals[turn.task["id"]] = approved
    yield turn.status("TASK_STATE_AUTH_REQUIRED", f"An operator must approve this deploy at http://localhost:41243/approve/{turn.task['id']}")
    yield approved
    yield turn.status("TASK_STATE_WORKING", "Approved by an operator. Rolling out to staging")
    report = {"environment": "staging", "build": "2026.10.06-1", "url": "https://staging.example.com", "healthChecks": "3 of 3 passing"}
    yield turn.artifact("deploy-report", "deploy-report.json", [data_part(report)], last_chunk=True)
    yield turn.status("TASK_STATE_COMPLETED", "Build 2026.10.06-1 is live on staging")


def build_agents():
    return {
        "test-runner": Agent("test-runner", 41241, TEST_RUNNER_CARD, run_tests, seed=41241, start=START),
        "code-reviewer": Agent("code-reviewer", 41242, CODE_REVIEWER_CARD, review_diff, seed=41242, start=START, quick=review_quick),
        "deployer": Agent("deployer", 41243, DEPLOYER_CARD, deploy, seed=41243, start=START, token=DEPLOY_TOKEN, extended=DEPLOYER_EXTENDED, signing_key=SIGNING_KEY),
    }
