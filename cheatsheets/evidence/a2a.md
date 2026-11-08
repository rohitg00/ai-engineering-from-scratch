# Evidence: cheatsheets/a2a.md

Abbreviations: A = manuals/a2a-101/sections, C = manuals/a2a-101/capture/out.

## Protocol architecture (architecture, 6 nodes)
- planner, client that reads cards: A/1-1-what-a2a-standardizes.md:9
- AgentCard at /.well-known/agent-card.json: A/2-2-discovery-and-supported-interfaces.md:20
- JSON-RPC at /a2a/jsonrpc: A/2-1-agentcard-fields.md:40-44
- handler, checks then executor: A/7-2-a-server.md:14
- HTTP+JSON at /a2a/rest: A/5-2-http-json.md:12
- task store, record of each task: A/3-4-task-and-task-state.md:10

## Send and read a task (task-table, 5 rows)
- read the card with GET: A/2-2-discovery-and-supported-interfaces.md:22-26
- SendMessage method: A/5-1-json-rpc.md:38
- A2A-Version header: A/5-4-version-and-extension-headers.md:24
- returnImmediately in configuration: A/4-1-send-message.md:24
- SendStreamingMessage method: A/4-5-streaming-and-subscribe-to-task.md:12

## Commands over HTTP+JSON (command-table, 4 rows)
- POST /a2a/rest/message:send: A/5-2-http-json.md:14, C/16-rest-binding.http:1
- POST /a2a/rest/tasks/<task id>:cancel: A/4-4-cancel-task-and-terminal-states.md:30, C/16-rest-binding.http:20
- GET /.well-known/agent-card.json: A/2-2-discovery-and-supported-interfaces.md:22
- cancel of a terminal task returns a task error: A/5-5-errors.md:70-74

## Settings and defaults (defaults, 5 rows)
- returnImmediately default false: A/4-1-send-message.md:24
- historyLength unset lets the server decide, 0 means none: A/4-3-get-task-and-list-tasks.md:17-21
- pageSize 50, maximum 100: A/4-3-get-task-and-list-tasks.md:60-62
- includeArtifacts false: A/4-3-get-task-and-list-tasks.md:64
- A2A-Version 1.0 on every request: A/5-4-version-and-extension-headers.md:20

## Compare the bindings (comparison, 5 rows)
- operation named by method, route or rpc: A/5-1-json-rpc.md:20, A/5-2-http-json.md:10, A/5-3-grpc.md:14
- where it is sent: A/5-1-json-rpc.md:30, A/5-3-grpc.md:12
- stream frame shape in each binding: A/5-1-json-rpc.md:60, A/5-2-http-json.md:50, A/5-3-grpc.md:40
- TaskNotFoundError codes: A/5-5-errors.md:20-26
- version metadata key for gRPC: A/5-4-version-and-extension-headers.md:14

## Task states (concepts, 4 bullets)
- active states: A/3-4-task-and-task-state.md:40-46
- interrupted states: A/4-2-input-required-and-auth-required.md:12
- terminal states: A/4-4-cancel-task-and-terminal-states.md:10
- TASK_STATE_UNSPECIFIED never sent: A/3-4-task-and-task-state.md:52

## One task, step by step (flow, 6 steps)
- a send blocks, and the client mints only the messageId: A/4-1-send-message.md:18, A/1-1-what-a2a-standardizes.md:37
- server mints taskId and contextId: A/3-1-message.md:31
- the blocking call returns the task at TASK_STATE_INPUT_REQUIRED with its question: A/4-2-input-required-and-auth-required.md:13, 17
- client answers with a new SendMessage with the same ids: A/4-2-input-required-and-auth-required.md:44
- second reply returns the same task completed with its artifact: A/4-2-input-required-and-auth-required.md:44
- GetTask takes the task id and returns the stored task: A/4-3-get-task-and-list-tasks.md:11

## JSON-RPC request (annotated-code, 10 lines)
- POST to the one URL: C/02-message-reply.http:2, A/5-1-json-rpc.md:5
- JSON body: C/02-message-reply.http:4
- A2A-Version on every request: C/02-message-reply.http:5, A/5-4-version-and-extension-headers.md:17
- jsonrpc is always 2.0 and the reply repeats the id: C/02-message-reply.http:8-9, A/5-1-json-rpc.md:13-15
- method holds the operation name: C/02-message-reply.http:10, A/5-1-json-rpc.md:13
- messageId, role and parts are required: C/02-message-reply.http:13-19, A/3-1-message.md:11

## Troubleshooting (troubleshooting, 6 rows)
- -32009 with no version header: A/5-4-version-and-extension-headers.md:50-62
- -32601 with message/send: C/11-errors.http:60-70, A/7-4-from-0-3-to-1-0.md:22
- -32004 on a finished task, use referenceTaskIds: A/4-4-cancel-task-and-terminal-states.md:70, A/3-5-context-id.md:40
- -32003 push config not supported: A/2-2-discovery-and-supported-interfaces.md:60-66
- -32602 BadRequest for messageId: A/5-5-errors.md:40-56
- -32001 or 404 for an unknown task: A/5-5-errors.md:14, A/5-5-errors.md:72

## Questions and answers (qa, 3 bullets)
- the default returnImmediately is false: A/4-1-send-message.md:24
- results go in artifacts: A/3-3-artifact-and-chunks.md:10
- another caller's task gets TaskNotFoundError: A/6-1-security-schemes-and-in-task-authorization.md:40

## Tips (tips, 4 bullets)
- mint a new messageId for each message: A/3-1-message.md:12, A/3-1-message.md:40
- ROLE_USER from the client and ROLE_AGENT from the server: A/3-1-message.md:20
- historyLength 0 for a status check: A/4-3-get-task-and-list-tasks.md:14-18
- read the card and check capability flags before an optional call: A/2-2-discovery-and-supported-interfaces.md:60
