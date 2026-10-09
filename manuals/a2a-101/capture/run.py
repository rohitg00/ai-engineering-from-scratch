import base64
import filecmp
import json
import os
import shutil
import sys
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from a2a_ref import serve, verify_card, sign_card, jcs
from agents import DEPLOY_TOKEN, SIGNING_KEY, build_agents
from planner import Planner
from wire import Client, Transcript

HERE = os.path.dirname(os.path.abspath(__file__))
TR, CR, DP, HOOK = 41241, 41242, 41243, 41250
AUTH = {"Authorization": f"Bearer {DEPLOY_TOKEN}"}
DIFF = (
    "--- a/payments/refunds.py\n"
    "+++ b/payments/refunds.py\n"
    "@@ -40,3 +40,4 @@ def partial_refund(charge, amount):\n"
    "-    net = amount - fee(charge)\n"
    "+    net = int(amount) - fee(charge)\n"
)


CLEAN_DIFF = (
    "--- a/tests/test_refunds.py\n"
    "+++ b/tests/test_refunds.py\n"
    "@@ -15,3 +15,7 @@ def test_full_refund():\n"
    "+def test_partial_refund_keeps_cents():\n"
    "+    assert partial_refund(charge(1000), 450).net == 450\n"
)


class Webhook:
    def __init__(self):
        self.received = []
        hook = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):
                return

            def do_POST(self):
                body = self.rfile.read(int(self.headers.get("Content-Length") or 0))
                hook.received.append({"path": self.path, "headers": {k: self.headers[k] for k in ("Content-Type", "Authorization", "X-A2A-Notification-Token") if self.headers.get(k)}, "body": json.loads(body)})
                self.send_response(204)
                self.send_header("Content-Length", "0")
                self.end_headers()

        self.server = ThreadingHTTPServer(("127.0.0.1", HOOK), Handler)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def write(self, transcript):
        for index, item in enumerate(self.received, 1):
            transcript.lines.append(f"### webhook {index} · received by the client")
            transcript.lines.append(f"POST {item['path']} HTTP/1.1")
            for key, value in item["headers"].items():
                transcript.lines.append(f"{key}: {value}")
            transcript.lines.append("")
            transcript.lines.extend(json.dumps(item["body"], indent=2).split("\n"))
            transcript.lines.append("")


def task_of(result):
    return result["result"]["task"] if "task" in result.get("result", {}) else result["result"]


def scenario_cards(c, agents):
    for name, port in (("test-runner", TR), ("code-reviewer", CR), ("deployer", DP)):
        c.exchange(f"discover {name}", port, "GET", "/.well-known/agent-card.json", {"Accept": "application/json"})


def scenario_message_reply(c, agents):
    c.rpc("SendMessage: a question", CR, "SendMessage", {"message": c.message("What languages can you review?")})


def scenario_blocking(c, agents):
    c.rpc("SendMessage: run the tests", TR, "SendMessage", {"message": c.message("Run the unit tests for payments-api at commit 9f3c2e1")})


def scenario_poll(c, agents):
    agent = agents["test-runner"]
    agent.gate_next = True
    _, result = c.rpc("SendMessage: return immediately", TR, "SendMessage", {"message": c.message("Run the unit tests for payments-api at commit 9f3c2e1"), "configuration": {"returnImmediately": True}})
    task_id = task_of(result)["id"]
    agent.step(task_id, 2)
    agent.wait_applied(task_id, 2)
    c.rpc("GetTask: still working", TR, "GetTask", {"id": task_id, "historyLength": 0})
    agent.release(task_id)
    agent.wait_idle(task_id)
    c.rpc("GetTask: completed", TR, "GetTask", {"id": task_id, "historyLength": 0})


def scenario_stream(c, agents):
    c.rpc("SendStreamingMessage: run the tests", TR, "SendStreamingMessage", {"message": c.message("Run the unit tests for payments-api at commit 9f3c2e1")})


def scenario_input_required(c, agents):
    diff = {"raw": base64.b64encode(DIFF.encode("utf-8")).decode("ascii"), "filename": "refunds.diff", "mediaType": "text/x-diff"}
    _, result = c.rpc("SendMessage: review a diff", CR, "SendMessage", {"message": c.message(parts=[{"text": "Review this diff of payments-api."}, diff])})
    task = task_of(result)
    c.rpc("SendMessage: answer the question", CR, "SendMessage", {"message": c.message("main", task_id=task["id"], context_id=task["contextId"])})


def scenario_auth_required(c, agents):
    def approve(index, event):
        update = event["result"].get("statusUpdate")
        if update and update["status"]["state"] == "TASK_STATE_AUTH_REQUIRED":
            c.t.note("The stream stays open. An operator opens the approval link, outside A2A.")
            c.exchange("operator approves", DP, "POST", f"/approve/{update['taskId']}", {"Content-Type": "application/json"}, body={})
            c.t.note("The same stream continues.")

    c.rpc("SendStreamingMessage: deploy to staging", DP, "SendStreamingMessage", {"message": c.message("Deploy build 2026.10.06-1 to staging")}, headers=AUTH, on_frame=approve)


def scenario_rejected(c, agents):
    c.rpc("SendMessage: deploy to production", DP, "SendMessage", {"message": c.message("Deploy build 2026.10.06-1 to production")}, headers=AUTH)


def scenario_failed(c, agents):
    c.rpc("SendMessage: a commit that does not exist", TR, "SendMessage", {"message": c.message("Run the unit tests for payments-api at commit deadbee")})


def scenario_cancel(c, agents):
    agent = agents["test-runner"]
    agent.gate_next = True
    _, result = c.rpc("SendMessage: the full suite", TR, "SendMessage", {"message": c.message("Run the full suite for payments-api at commit 9f3c2e1"), "configuration": {"returnImmediately": True}})
    task = task_of(result)
    agent.step(task["id"], 3)
    agent.wait_applied(task["id"], 3)
    c.rpc("CancelTask", TR, "CancelTask", {"id": task["id"]})
    agent.wait_idle(task["id"])
    c.rpc("CancelTask: again", TR, "CancelTask", {"id": task["id"]})
    c.rpc("SendMessage: to the canceled task", TR, "SendMessage", {"message": c.message("Try again", task_id=task["id"], context_id=task["contextId"])})


def scenario_errors(c, agents):
    c.rpc("GetTask: an id that does not exist", TR, "GetTask", {"id": "00000000-0000-4000-8000-000000000000"})
    c.rpc("SendMessage: no A2A-Version header", TR, "SendMessage", {"message": c.message("Run the unit tests")}, version=None)
    c.rpc("SendMessage: a v0.3 method name", TR, "message/send", {"message": c.message("Run the unit tests")})
    c.rpc("SendMessage: no messageId", TR, "SendMessage", {"message": {"role": "ROLE_USER", "parts": [{"text": "Run the unit tests"}]}})
    c.rpc("SendMessage: an image part", CR, "SendMessage", {"message": c.message(parts=[{"url": "https://example.com/screenshot.png", "mediaType": "image/png"}])})
    c.rpc("CreateTaskPushNotificationConfig: not supported", CR, "CreateTaskPushNotificationConfig", {"taskId": "00000000-0000-4000-8000-000000000000", "url": "http://localhost:41250/a2a-events"})
    c.exchange("a malformed body", TR, "POST", "/a2a/jsonrpc", {"Content-Type": "application/json", "A2A-Version": "1.0"}, raw=b'{"jsonrpc": "2.0", "method": ')


def scenario_list(c, agents):
    _, page = c.rpc("ListTasks: first page", TR, "ListTasks", {"pageSize": 2, "historyLength": 0})
    c.rpc("ListTasks: next page", TR, "ListTasks", {"pageSize": 2, "pageToken": page["result"]["nextPageToken"], "historyLength": 0})
    c.rpc("ListTasks: only canceled tasks", TR, "ListTasks", {"status": "TASK_STATE_CANCELED"})


def scenario_history(c, agents):
    reviewer = agents["code-reviewer"]
    task_id = reviewer.order[0]
    c.rpc("GetTask: full history", CR, "GetTask", {"id": task_id})
    c.rpc("GetTask: last message only", CR, "GetTask", {"id": task_id, "historyLength": 1})


def scenario_resubscribe(c, agents):
    agent = agents["test-runner"]
    agent.gate_next = True
    state = {}

    def first(index, event):
        if index == 1:
            state["task"] = event["result"]["task"]["id"]
            agent.step(state["task"], 3)

    c.rpc("SendStreamingMessage: the full suite", TR, "SendStreamingMessage", {"message": c.message("Run the full suite for payments-api at commit 9f3c2e1")}, frames=4, on_frame=first)
    task_id = state["task"]
    agent.wait_applied(task_id, 3)
    agent.step(task_id, 2)
    agent.wait_applied(task_id, 5)

    def resumed(index, event):
        if index == 1:
            agent.release(task_id)

    c.rpc("SubscribeToTask: pick the stream back up", TR, "SubscribeToTask", {"id": task_id}, on_frame=resumed)
    agent.wait_idle(task_id)
    c.rpc("SubscribeToTask: a finished task", TR, "SubscribeToTask", {"id": task_id})


def scenario_push(c, agents, hook):
    agent = agents["test-runner"]
    config = {"url": "http://localhost:41250/a2a-events", "token": "planner-run-0006", "authentication": {"scheme": "Bearer", "credentials": "hook_secret_91d2"}}
    _, result = c.rpc("SendMessage: with a webhook", TR, "SendMessage", {"message": c.message("Run the unit tests for payments-api at commit 9f3c2e1"), "configuration": {"returnImmediately": True, "taskPushNotificationConfig": config}})
    task_id = task_of(result)["id"]
    agent.wait_idle(task_id)
    _, listed = c.rpc("ListTaskPushNotificationConfigs", TR, "ListTaskPushNotificationConfigs", {"taskId": task_id})
    config_id = listed["result"]["configs"][0]["id"]
    c.rpc("GetTaskPushNotificationConfig", TR, "GetTaskPushNotificationConfig", {"taskId": task_id, "id": config_id})
    c.rpc("DeleteTaskPushNotificationConfig", TR, "DeleteTaskPushNotificationConfig", {"taskId": task_id, "id": config_id})
    hook.write(c.t)


def scenario_rest(c, agents):
    _, result = c.rest("POST /message:send", TR, "POST", "/message:send", body={"message": c.message("Run the unit tests for payments-api at commit 9f3c2e1")})
    task_id = result["task"]["id"]
    c.rest("GET /tasks/{id}", TR, "GET", f"/tasks/{task_id}?historyLength=0")
    c.rest("GET /tasks/{id}: not found", TR, "GET", "/tasks/00000000-0000-4000-8000-000000000000")
    c.rest("POST /tasks/{id}:cancel: already completed", TR, "POST", f"/tasks/{task_id}:cancel", body={})


def scenario_extended(c, agents):
    c.rpc("GetExtendedAgentCard: no token", DP, "GetExtendedAgentCard", {})
    c.rpc("GetExtendedAgentCard: with a token", DP, "GetExtendedAgentCard", {}, headers=AUTH)


def scenario_signature(out_dir, agents):
    card = agents["deployer"].card
    signed, steps = sign_card(card, SIGNING_KEY, "deployer-key-1")
    protected = json.loads(base64.urlsafe_b64decode(signed["signatures"][0]["protected"] + "=="))
    tampered = dict(signed, description="Deploys a tagged build to production.")
    lines = [
        "# 1. canonical payload (RFC 8785): the card without signatures, keys sorted, no spaces",
        steps["canonical"],
        "",
        "# 2. protected header, decoded",
        json.dumps(protected),
        "",
        "# 3. JWS signing input: BASE64URL(header) '.' BASE64URL(payload)",
        steps["signingInput"],
        "",
        "# 4. the signature entry published in the card",
        json.dumps(signed["signatures"][0], indent=2),
        "",
        f"# 5. verify the published card: {verify_card(signed, SIGNING_KEY)}",
        f"# 6. verify after changing the description to name production: {verify_card(tampered, SIGNING_KEY)}",
    ]
    write(out_dir, "17-signed-card.txt", "\n".join(lines) + "\n")


def scenario_planner(c, agents):
    def operator(task):
        c.t.note("The operator approves the deploy, outside A2A.")
        c.exchange("operator approves", DP, "POST", f"/approve/{task['id']}", {"Content-Type": "application/json"}, body={})

    planner = Planner(c, operator, {"base": "main", "tokens": {"deployer": DEPLOY_TOKEN}})
    planner.discover([TR, CR, DP])
    planner.ship("a41d7c3", CLEAN_DIFF)
    return planner.log


SCENARIOS = [
    ("01-agent-cards", scenario_cards),
    ("02-message-reply", scenario_message_reply),
    ("03-blocking-task", scenario_blocking),
    ("04-polling", scenario_poll),
    ("05-streaming", scenario_stream),
    ("06-input-required", scenario_input_required),
    ("07-auth-required", scenario_auth_required),
    ("08-rejected", scenario_rejected),
    ("09-failed", scenario_failed),
    ("10-cancel", scenario_cancel),
    ("11-errors", scenario_errors),
    ("12-list-tasks", scenario_list),
    ("13-history", scenario_history),
    ("14-resubscribe", scenario_resubscribe),
    ("15-push", scenario_push),
    ("16-rest-binding", scenario_rest),
    ("18-extended-card", scenario_extended),
    ("19-planner", scenario_planner),
]


def write(out_dir, name, text):
    with open(os.path.join(out_dir, name), "w", encoding="utf-8") as handle:
        handle.write(text)


def capture(out_dir):
    os.makedirs(out_dir, exist_ok=True)
    agents = build_agents()
    servers = [serve(agent) for agent in agents.values()]
    hook = Webhook()
    try:
        for name, run in SCENARIOS:
            transcript = Transcript()
            client = Client(transcript, seed=int(name[:2]))
            if run is scenario_push:
                run(client, agents, hook)
            elif run is scenario_planner:
                write(out_dir, f"{name}.log", "\n".join(run(client, agents)) + "\n")
            else:
                run(client, agents)
            write(out_dir, f"{name}.http", transcript.text())
            if transcript.streams:
                write(out_dir, f"{name}.events.json", json.dumps(transcript.streams, indent=2, ensure_ascii=False) + "\n")
        scenario_signature(out_dir, agents)
    finally:
        for server in servers:
            server.shutdown()
        hook.server.shutdown()


def check():
    expected = os.path.join(HERE, "out")
    with tempfile.TemporaryDirectory() as fresh:
        capture(fresh)
        names = sorted(name for name in set(os.listdir(expected)) | set(os.listdir(fresh)) if not name.startswith("."))
        drift = [name for name in names if not (os.path.exists(os.path.join(expected, name)) and os.path.exists(os.path.join(fresh, name)) and filecmp.cmp(os.path.join(expected, name), os.path.join(fresh, name), shallow=False))]
        if drift:
            print("capture drift in: " + ", ".join(drift))
            return 1
        print(f"capture check: {len(names)} files match")
        return 0


if __name__ == "__main__":
    if "--check" in sys.argv:
        sys.exit(check())
    target = os.path.join(HERE, "out")
    shutil.rmtree(target, ignore_errors=True)
    capture(target)
    print(f"wrote {len([name for name in os.listdir(target) if not name.startswith('.')])} files to {target}")
