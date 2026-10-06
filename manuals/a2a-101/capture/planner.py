import base64

TERMINAL = ("TASK_STATE_COMPLETED", "TASK_STATE_FAILED", "TASK_STATE_CANCELED", "TASK_STATE_REJECTED")


class Planner:
    def __init__(self, client, operator, context):
        self.client = client
        self.operator = operator
        self.context = context
        self.agents = {}
        self.log = []

    def note(self, line):
        self.log.append(line)

    def discover(self, ports):
        for port in ports:
            _, card = self.client.exchange("read the agent card", port, "GET", "/.well-known/agent-card.json", {"Accept": "application/json"})
            interface = next(i for i in card["supportedInterfaces"] if i["protocolBinding"] == "JSONRPC" and i["protocolVersion"] == "1.0")
            for skill in card["skills"]:
                self.agents[skill["id"]] = {"name": card["name"], "port": port, "url": interface["url"], "streaming": card["capabilities"].get("streaming", False), "auth": bool(card.get("securityRequirements"))}
            self.note(f"card {card['name']}: skills {', '.join(s['id'] for s in card['skills'])}; JSONRPC at {interface['url']}")

    def delegate(self, skill, parts):
        agent = self.agents[skill]
        headers = {"Authorization": f"Bearer {self.context['tokens'][agent['name']]}"} if agent["auth"] else {}
        self.note(f"delegate {skill} to {agent['name']}")
        _, reply = self.client.rpc(f"SendMessage to {agent['name']}", agent["port"], "SendMessage", {"message": self.client.message(parts=parts)}, headers=headers)
        while True:
            if "error" in reply:
                self.note(f"  error {reply['error']['code']}: {reply['error']['message']}")
                return None
            result = reply["result"]
            if "message" in result:
                self.note("  direct reply, no task to follow")
                return result["message"]
            task = result["task"] if "task" in result else result
            state = task["status"]["state"]
            self.note(f"  task {task['id'][:8]} is {state}")
            if state in TERMINAL:
                return task
            question = task["status"]["message"]["parts"][0]["text"]
            if state == "TASK_STATE_INPUT_REQUIRED":
                answer = self.answer(question)
                self.note(f"  it asks: {question} The planner answers from its own context: {answer}")
                _, reply = self.client.rpc(f"SendMessage: answer {agent['name']}", agent["port"], "SendMessage", {"message": self.client.message(answer, task_id=task["id"], context_id=task["contextId"])}, headers=headers)
                continue
            if state == "TASK_STATE_AUTH_REQUIRED":
                self.note(f"  it needs approval: {question} The planner cannot approve, so it asks the operator and subscribes.")
                return self.follow(agent, task, headers)

    def follow(self, agent, task, headers):
        def on_frame(index, event):
            if index == 1:
                self.operator(task)

        _, events = self.client.rpc(f"SubscribeToTask on {agent['name']}", agent["port"], "SubscribeToTask", {"id": task["id"]}, headers=headers, on_frame=on_frame)
        final = events[-1]["result"]["statusUpdate"]["status"]["state"]
        self.note(f"  the stream ends at {final}")
        return {"id": task["id"], "status": {"state": final}}

    def answer(self, question):
        if "base branch" in question:
            return self.context["base"]
        return "I cannot answer that."

    def ship(self, commit, diff):
        tests = self.delegate("run-tests", [{"text": f"Run the unit tests for payments-api at commit {commit}"}])
        if tests is None or tests["status"]["state"] != "TASK_STATE_COMPLETED":
            self.note("stop: the test task did not complete")
            return
        summary = next(a for a in tests.get("artifacts", []) if a["artifactId"] == "summary")["parts"][0]["data"]
        if summary["failed"]:
            self.note(f"stop: {summary['failed']} test(s) failed")
            return
        self.note(f"tests: {summary['passed']} passed")
        review = self.delegate("review-diff", [{"text": "Review this diff of payments-api."}, {"raw": base64.b64encode(diff.encode("utf-8")).decode("ascii"), "filename": "refunds.diff", "mediaType": "text/x-diff"}])
        findings = next(a for a in review.get("artifacts", []) if a["artifactId"] == "review")["parts"][1]["data"]["findings"]
        blocking = [f for f in findings if f["severity"] == "high"]
        self.note(f"review: {len(findings)} finding{'' if len(findings) == 1 else 's'}, {len(blocking)} blocking")
        if blocking:
            self.note("stop: a high-severity finding blocks the deploy")
            return
        deploy = self.delegate("deploy", [{"text": "Deploy build 2026.10.06-1 to staging"}])
        self.note(f"deploy: {deploy['status']['state']}")
