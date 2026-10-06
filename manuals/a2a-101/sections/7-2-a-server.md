# A server

> A server is a card, one handler per binding, three checks before any work, an executor, an owner-scoped task store, and one event queue that feeds streams and webhooks.

The three agents in the kit come from one file, `capture/a2a_ref.py`, 675 lines of the Python standard library. Each agent serves a card, answers both JSON bindings, runs its own logic in a thread, and keeps its tasks in a dictionary. When you finish this section, you can name each part a server must build, and find it in `a2a_ref.py` and in the reference SDK.

[Figure](#fig-server-parts) follows one `SendStreamingMessage` through those parts, from the HTTP request to the stream frames and the webhook POST.

```figure
id: fig-server-parts
kind: structure
title: the parts of a server, in the order a request meets them
claim: A request passes authentication, the version check, and the capability check before Agent.send stores a task, and every event then leaves through one broadcast.
caption: Read the left column top to bottom. Each box is a method in capture/a2a_ref.py. Rose boxes on the right are the errors each check returns, with their JSON-RPC codes from capture/out/11-errors.http. From capture/a2a_ref.py.
```

## The card and one handler per binding

**Card route:** the `GET` on `/.well-known/agent-card.json` that returns the card {{spec §8.2}}. The kit's `Handler.do_GET` answers it from `published_card`. The SDK's `create_agent_card_routes` serves the same path, named by `AGENT_CARD_WELL_KNOWN_PATH` {{sdk src/a2a/server/routes/agent_card_routes.py}} {{sdk src/a2a/utils/constants.py}}.

**Binding handler:** one entry point per binding, which parses the request, runs the checks, and calls the same agent methods. The kit has `Handler.jsonrpc` at `/a2a/jsonrpc` and `Handler.rest` under `/a2a/rest/`, and no gRPC, as [gRPC](#s-grpc) explains. The SDK has `create_jsonrpc_routes`, `create_rest_routes`, and `GrpcHandler` {{sdk src/a2a/server/routes/jsonrpc_routes.py}} {{sdk src/a2a/server/routes/rest_routes.py}} {{sdk src/a2a/server/request_handlers/grpc_handler.py}}. All three call one `DefaultRequestHandler`, which is `DefaultRequestHandlerV2` {{sdk src/a2a/server/request_handlers/__init__.py}}.

```listing
title: the JSON-RPC handler, from the token to the first two methods
source: capture/a2a_ref.py
lang: python
note: The head of the jsonrpc method and its error branch. The other nine method branches are cut.
---
    def jsonrpc(self, raw):
        request_id = None
        if not self.authenticate():
            return None
        try:
            try:
                request = json.loads(raw)
            except ValueError:
                raise A2AError("JSONParseError")
            if not isinstance(request, dict) or request.get("jsonrpc") != "2.0" or "method" not in request:
                raise A2AError("InvalidRequestError")
            request_id = request.get("id")
            self.check_version()
            method = request["method"]
            params = request.get("params") or {}
            agent = self.agent
            if method == "SendMessage":
                return self.write_json(200, {"jsonrpc": "2.0", "id": request_id, "result": agent.send(params)}, "application/json")
            if method == "SendStreamingMessage":
                if not agent.card["capabilities"].get("streaming"):
                    raise A2AError("UnsupportedOperationError")
                stream = queue.Queue()
                agent.send(params, stream)
                self.open_stream()
                return self.pump(stream, lambda event: {"jsonrpc": "2.0", "id": request_id, "result": event})
            …
        except A2AError as error:
            return self.write_json(200, {"jsonrpc": "2.0", "id": request_id, "error": error.jsonrpc()}, "application/json")
```

## Three checks before any work

Authentication runs first. The kit's `authenticate` answers HTTP 401 with a `WWW-Authenticate` challenge before any method, on the deployer only. The SDK checks no credential itself: `ServerCallContext.user` comes from the web framework's middleware {{sdk src/a2a/server/routes/common.py}}. [Security schemes](#s-security-schemes-and-in-task-authorization) says what to check.

The version check runs second. `check_version` accepts exactly `1.0` and raises `VersionNotSupportedError` for anything else, because "Agents MUST interpret empty value as 0.3 version." {{spec §3.6.2}}. The SDK's `validate_version` decorator wraps every JSON-RPC and REST dispatcher method and compares the major version {{sdk src/a2a/utils/version_validator.py}}. It does not wrap the gRPC servicer. [The version header](#s-version-and-extension-headers) gives the rules and each SDK's behavior.

The capability check runs third. Before a stream or a push operation, the kit reads `card["capabilities"]` and raises `UnsupportedOperationError` or `PushNotificationNotSupportedError` {{spec §3.3.4}}. The SDK does the same with a `validate` decorator on `on_message_send_stream` and on the push methods {{sdk src/a2a/server/request_handlers/default_request_handler_v2.py}}.

## The executor and the task store

**Executor:** the code that runs the agent for one request and emits its events. The kit's `Agent.send` validates the message, creates the task in `TASK_STATE_SUBMITTED`, and starts `Agent.work` in a thread. `work` calls `behavior`, the agent's own logic, and applies each event it yields. The SDK's `AgentExecutor.execute` receives a `RequestContext` and an `EventQueue`, and returns when the work is done or the task enters an interrupted state {{sdk src/a2a/server/agent_execution/agent_executor.py}} {{sdk src/a2a/server/agent_execution/context.py}}.

What the executor calls stays hidden from the client. [Figure](#fig-a2a-and-tools) draws that line for the three kit agents.

```figure
id: fig-a2a-and-tools
kind: layers
title: A2A between agents, tools inside each one
claim: The planner sees only each agent's card and endpoint, while each agent calls its own logic and tools below a line that A2A never crosses.
caption: Read top to bottom. Above the dashed line is what the planner sees over A2A. Below it is what each agent runs on its own, which the kit simulates in Python. From capture/agents.py and capture/out/01-agent-cards.http.
```

**Task store:** the record of every task, read by `GetTask`, `ListTasks`, and each follow-up message. The kit's `Agent.tasks` is one dictionary with no owner, and the deployer's bearer token is its only guard. The SDK's `TaskStore` has `save`, `get`, `list`, and `delete`, each given the `ServerCallContext` {{sdk src/a2a/server/tasks/task_store.py}}. `InMemoryTaskStore` keys tasks by owner, and the default `OwnerResolver` returns `context.user.user_name` {{sdk src/a2a/server/owner_resolver.py}} {{sdk src/a2a/server/tasks/inmemory_task_store.py}}. Another caller's task is then `TaskNotFoundError`, but every caller without a user name shares one scope. "Servers MUST implement authorization checks on every A2A Protocol Operations request" {{spec §13.1}}, so the integrator adds the middleware, as [security schemes](#s-security-schemes-and-in-task-authorization) shows for each SDK.

## One event queue for streams and webhooks

The kit's `Agent.apply` updates the task record. `Agent.broadcast` then puts a copy of the event on each subscriber queue and calls `deliver` for each push config. `Handler.pump` reads one subscriber queue and writes each event as a `data:` frame. `broadcast` closes the stream at a terminal state or `TASK_STATE_INPUT_REQUIRED`, and `deliver` POSTs the event to the webhook URL with `X-A2A-Notification-Token`.

The SDK's `ActiveTask` does the same with two queues. The executor writes to `_event_queue_agent`. A consumer reads it, saves the task, forwards each event to `_event_queue_subscribers`, and calls `PushNotificationSender.send_notification` {{sdk src/a2a/server/agent_execution/active_task.py}} {{sdk src/a2a/server/tasks/push_notification_sender.py}}. [Streaming](#s-streaming-and-subscribe-to-task) and [push notification configs](#s-push-notification-configs) show both paths frame by frame.

```takeaways
- Serve the card at `/.well-known/agent-card.json`, and route every binding through the same checks.
- Check the credential, the `A2A-Version` header, and the capability flags before the executor starts.
- Key the task store by owner, and answer `TaskNotFoundError` outside that scope.
- Write every event to one queue that feeds the open streams and the webhook POSTs.
```

Sources: spec §3.3.4, §3.6.2, §8.2, §13.1 (research/sources/specification.md); sdk src/a2a/server/routes/agent_card_routes.py, src/a2a/utils/constants.py, src/a2a/server/routes/jsonrpc_routes.py, src/a2a/server/routes/rest_routes.py, src/a2a/server/routes/common.py, src/a2a/server/request_handlers/grpc_handler.py, src/a2a/server/request_handlers/__init__.py, src/a2a/server/request_handlers/default_request_handler_v2.py, src/a2a/utils/version_validator.py, src/a2a/server/agent_execution/agent_executor.py, src/a2a/server/agent_execution/context.py, src/a2a/server/agent_execution/active_task.py, src/a2a/server/tasks/task_store.py, src/a2a/server/tasks/inmemory_task_store.py, src/a2a/server/owner_resolver.py, src/a2a/server/tasks/push_notification_sender.py at a2a-python 1.2.2; capture/a2a_ref.py, capture/agents.py, capture/README.md; capture/out/01-agent-cards.http, 11-errors.http
