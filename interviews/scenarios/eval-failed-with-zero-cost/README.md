---
id: eval-failed-with-zero-cost
title: Two of two evals failed, and none of them ran
card: scenarios
kind: incident
level: 3
roles: [ai-evaluation-reliability-engineer, agentic-ai-engineer]
rounds: [debugging, design-review]
tags: [agents, evals, judge-model, containers, model-runner]
minutes: 25
lessons: []
manuals: [docker-sandboxes-101#s-session-db-sessions-diff-and-eval, docker-sandboxes-101#s-dmr-compose-models-and-the-mcp-gateway-service]
practice: []
cheatsheet: []
related: [scenarios/first-divergence-at-turn-zero]
updated: 2026-11-03
system:
  version: docker-agent v1.149.0 and sbx v0.47.0
  model: ai/qwen3:4b through the local model runner, as the subject and as the judge
  hardware: one Mac, no GPU
source:
  - manuals/docker-sandboxes-101/capture/out/22-eval.txt
  - manuals/docker-sandboxes-101/capture/out/22-eval-run.json
  - manuals/docker-sandboxes-101/capture/out/22-eval-gateway.txt
  - manuals/docker-sandboxes-101/capture/out/22-eval-container-env.txt
  - manuals/docker-sandboxes-101/capture/out/22-eval-run-container-env.json
  - manuals/docker-sandboxes-101/capture/fixtures/evals/list-files.json
  - manuals/docker-sandboxes-101/sections/5-6-session-db-sessions-diff-and-eval.md
  - manuals/docker-sandboxes-101/sections/6-5-dmr-compose-models-and-the-mcp-gateway-service.md
---

## Situation

A nightly job scores the files agent against two saved eval sessions, with a local model as the judge. Last night the job printed `Errors: 2/2 evaluations failed` and a total cost of zero, and it blocked a pull request. The author of the pull request was told that the agent regressed. The author replied that the change was one word in the instruction and asked for the sessions, and there were none.

The on-call engineer tried again with the models gateway flag on the command, pointed at the address that containers use for the model runner. That attempt exited 1 before it ran anything, with an HTTP 403 in the last line. A third attempt, with the same address set in the environment of the eval containers, ran both evals. You review the three runs and the two scores that came out of the third one.

## Evidence

- [the eval run that blocked the pull request](evidence/the-first-run.txt)
- [the summary block of the first run](evidence/the-first-run-summary.txt)
- [the second attempt, with the models gateway on the command](evidence/the-gateway-flag.txt)
- [the third attempt, with the gateway passed to the containers](evidence/the-container-variable.txt)
- [the expected tool calls of the list-files eval](evidence/the-expected-tool-calls.txt)
- [the second tool call the agent made in the list-files eval](evidence/the-extra-call.txt)
- [the base URL of the model runner for each caller](evidence/five-base-urls.txt)

## Questions

1. The first run says that two evaluations failed. What in its output tells you whether any evaluation ran?
2. Why did the second attempt stop before the first eval, and what does the 403 name?
3. The third attempt turned a flag into an environment variable. Who reads the variable, and who does not?
4. Which number in the third run is a finding about the agent, and what did the agent do to earn it?
5. Rewrite the gate so that an eval that did not run cannot block a pull request as a regression.

## Walkthrough

1. **Read the line under each verdict.** Both evals carry the same reason: the agent container failed with exit status 1, and its stderr says that it could not get models because the `docker` executable was not found in the path. The agent inside the eval image looks for the model runner through the docker command line, and the pinned release image has no docker command line. The agent never answered a prompt. Nothing was scored.
2. **Read the summary block.** `failed_evals` is 2, and every other count is 0: `total_cost`, `sizes_total`, `tools_count`, `relevance_total`. `sessions` is null. A failed verdict with zero totals and no sessions is an eval that never started, not an agent that did badly.
3. **Read the gateway attempt.** The flag moved the model address for the whole command. The judge is validated first, and the judge runs on the host, not in a container. The host cannot reach the container-only name, so the judge check failed with HTTP 403, and the command exited 1 before it built a container. The 403 names the judge request, not the agent.
4. **Read the container-variable attempt.** `-e DOCKER_AGENT_MODELS_GATEWAY=...` sets the variable inside the eval containers only. The judge kept its host address. Both evals ran. Sizes passed 2 of 2, relevance passed 2 of 2, and tool calls averaged an F1 of 83.3 percent. One eval still failed, on `tool calls score 0.67`.
5. **Read the expected calls and the extra call.** The list-files eval expects one assistant turn with one `list_directory` call. The agent made that call, and then a second call to `shell` with `wc -l README.md`. One expected call, two actual calls, F1 of 0.67. This is the only number in the three runs that says something about the agent: it did one step more than the saved session.
6. **Read the base URL table.** One model runner, and a different base URL for each caller: a host process uses `localhost:12434`, a container uses `model-runner.docker.internal`, and a sandboxed agent goes through the sandbox proxy. The judge and the subject ran in two places, so they needed two addresses.

## Resolution

The blocked pull request was an infrastructure failure. The eval containers had no way to find the model runner, and the first run scored nothing. The fix is the third command: pass the gateway to the containers with `-e`, and leave the judge on the host with its own address. The proof is in that run: two evals ran, sizes 2 of 2, relevance 2 of 2, tool calls at an F1 of 83.3 percent, with cost still zero because a local model has no price. On a local runner the cost cannot tell a run from a non-run, so read the totals and the sessions.

The gate changes in two ways. It fails the job as broken when the error count is above 0, and it reports a regression only from evals that ran. And the remaining 0.67 becomes a decision for a person: the agent added a line count with `shell` after the directory listing. If that extra call is wanted, the saved session gains a second expected call. If it is not, the instruction changes. Either way the eval did its job, which is to catch a call that the saved session did not ask for.

## Wrong turns

- "The agent regressed, revert the pull request." No eval ran. Both failures are container errors, every total in the summary is 0, and `sessions` is null.
- "Put the gateway flag on the command so the containers find the runner." The flag also moves the judge, which runs on the host and cannot reach a container-only name. The run fails with 403 before any eval starts.
- "Rebuild the eval image with the docker command line inside." The release image is pinned, and the containers lacked an address, not a binary. The eval command has `-e` to hand them that address.
- "Add the `shell` call to the expected list and move on." First decide whether the extra call is wanted. The eval exists to catch a call the saved session did not ask for.

## Generalize

An eval result has two layers: whether the eval ran, and what it scored. Zero totals and no sessions say the first layer failed, so read the error under the verdict before the verdict. Separate errors from failures in the gate. And remember that a judge and a subject can run in different places, with different addresses for the same service.

## Taught in

[The eval section](../../../manuals/docker-sandboxes-101/sections/5-6-session-db-sessions-diff-and-eval.md#eval) records the three attempts, and [the model runner section](../../../manuals/docker-sandboxes-101/sections/6-5-dmr-compose-models-and-the-mcp-gateway-service.md#docker-model-runner-on-port-12434) maps the base URL of each caller.
