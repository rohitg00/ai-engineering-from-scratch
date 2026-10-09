# session.db, sessions diff, and eval

> Every run is rows in one SQLite file, a cassette replays its model calls, `sessions diff` finds the first different tool call, and `eval` scores saved sessions in containers.

You changed one line of an agent's instruction, and you want to know whether it still does the same work. A live model words every answer differently, so you need records that you can replay and compare.

When you finish this section, you can replay a run from a cassette, compare two runs by tool calls, and score an agent with `eval`.

## session.db

**Session:** "the record of a conversation, including every message, tool call, sub-agent run, and cost" {{docs-agent Sessions}}. It lives in `session.db` under the data directory, `~/.cagent` unless `--data-dir` or `-s` points elsewhere {{help-agent docker-agent run}}. `--session -1` resumes the newest session by creation time {{docs-agent Sessions}}.

```listing
title: the session store after the runs of this part
source: capture/out/21-session-db.txt
lang: text
note: Cut to the table list, the columns of sessions, and the five newest titles.
---
$ sqlite3 work/data/session.db .tables  (python sqlite3)
generated_media_blobs generated_media_manifest migrations session_items sessions sqlite_sequence
…
$ sqlite3 work/data/session.db 'pragma table_info(sessions)'  (12 rows)
id created_at tools_approved input_tokens output_tokens title cost send_user_message max_iterations working_dir starred permissions agent_model_overrides custom_models_used thinking parent_id instruction_context safety_policy attributes origin

$ sqlite3 work/data/session.db 'select id, title from sessions order by created_at desc limit 5'
<uuid> | Running agent
…
```

The table held 12 sessions: ten runs, and the two `Transferred task` sub-sessions of the team runs, which carry a parent id (`19-transcript.txt`). Each session stores its `safety_policy`, and `session_items` holds the messages. The five newest, all `--exec` runs, are titled `Running agent`, not a title made from the first message as the docs describe {{docs-agent Sessions}}.

## Cassettes: --record and --fake

**Cassette:** a YAML file of the HTTP exchanges between `docker-agent` and the model. `--record` writes it, and `--fake` replays it with no model at all {{help-agent docker-agent run}}. `18-cassette-head.txt` shows the format: `version: 2`, then `interactions`, each with a request to `localhost:12434` and the streamed reply.

```listing
title: the flags the kit records and replays with
source: capture/run.py
lang: python
note: A method of the Kit class and a module function, cut between them. DMR_URL is http://localhost:12434.
---
    def start_recording(self, name):
        if not self.record_cassettes and os.path.exists(cassette_path(name)):
            return None
        self.recorded.append(name)
        return ["--models-gateway", f"{DMR_URL}/engines", f"--record={CASSETTE_WORK}/{name}"]
…
def replay(name):
    return ["--fake", f"{CASSETTE_WORK}/{name}"]
```

The recording found four rules that the help does not state (`capture/README.md`). `--record` takes its value only as `--record=PATH`, and a separate word is read as the agent reference. The path is relative to `--working-dir`, and `.yaml` is appended. With the `dmr` provider the recording proxy answers 400 unless the run also has `--models-gateway http://localhost:12434/engines`.

Replay matches each request by its body. When one turn issues two tool calls, the runtime runs them in parallel and appends the results in completion order. The next request body then differs, and the replay answers 500, "requested interaction not found". The kit therefore sends one tool call per message.

## sessions diff

"Comparison is over the sequence of tool calls, not over the assistant's prose" {{help-agent docker-agent sessions diff}}, and the report stops at the first divergence.

```listing
title: the help's example form, the working form, and a divergence
source: capture/out/21-sessions-diff.txt
lang: text
note: Nothing is cut.
---
$ docker-agent sessions diff -1 -2
Error: unknown shorthand flag: '1' in -1
[exit 1]

$ docker-agent sessions diff -- -1 -2
Comparing -1 (5 turns) against -2 (5 turns)

✅ Identical behaviour across all 5 turns.
[exit 0]

$ docker-agent sessions diff --fail-on-divergence -- -1 -3
Comparing -1 (5 turns) against -3 (6 turns)

❌ First divergence at turn 0 (after 0 matching turn(s)).
   -1 called:
     list_directory({"path": "."})
   -3 called:
     shell({"cmd": "echo m101-ok"})

Everything after this point is downstream of the divergence and is not compared.
Error: sessions diverged
[exit 1]
```

The help's own example, `sessions diff -1 -2`, fails, because the parser reads `-1` as a flag. Put `--` before the references. `-1` and `-2` are two replays of `files.yaml` (`21-two-runs.txt`), with five turns each, one per model reply in `18-transcript.txt`. `-3` is the restricted run of `guarded.yaml`, which called `shell` first. `--json` printed `{"turns_a": 5, "turns_b": 5, "turns_matched": 5}` for the identical pair (`21-sessions-diff.json`).

## eval

**Eval session:** a JSON session with a user message, the expected tool calls, and an `evals` block {{docs-agent Evaluation}}. The block holds `relevance` statements, a `size`, and a `working_dir`. `eval` replays each one in a container and scores tool-call F1, relevance by a judge model, and size.

The capture needed three tries with `--judge-model dmr/ai/qwen3:4b`. Plain, both evals failed with `exec: "docker": executable file not found in $PATH`, because the image `docker/docker-agent:1.149.0` has no `docker` CLI to find Model Runner (`22-eval.txt`). With `--models-gateway http://model-runner.docker.internal/engines`, the judge check failed first with HTTP 403. The docs explain why: "the LLM judge runs on the host, not inside the eval container" {{docs-agent Evaluation}}, and the host cannot reach that name (`22-eval-gateway.txt`). With `-e DOCKER_AGENT_MODELS_GATEWAY=…`, only the containers changed, and both evals ran.

```listing
title: the eval run that worked
source: capture/out/22-eval-container-env.txt
lang: text
note: The loading lines and the output paths are cut.
---
$ docker-agent eval fixtures/agents/files.yaml fixtures/evals --judge-model dmr/ai/qwen3:4b -c 1 -e DOCKER_AGENT_MODELS_GATEWAY=http://model-runner.docker.internal/engines --output work/eval-results-container-env
…
✓ Count the lines of README.md ($0.000000)
  ✓ size S
  ✓ tool calls
  ✓ relevance 1/1
✗ List the files in the working directory ($0.000000)
  ✓ size S
  ✓ relevance 1/1
  ✗ tool calls score 0.67
…
✅          Sizes: 2/2 passed (100.0%)
✅     Tool Calls: 83.3% avg F1 (2 evals)
✅      Relevance: 2/2 passed (100.0%)
…
```

The second eval expected one `list_directory` call, and the model added a `shell` call after it, so F1 fell to 0.67 (`22-eval-run-container-env.json`). Both eval sessions ran with `"safety_policy": "autonomous"`. The help defaults are `-c 10` and the judge `openai/gpt-5.6-terra`, and the docs table says the number of CPUs and `anthropic/claude-opus-5`. This manual follows the help ([conflict C65](#s-ref-sources-and-the-conflicts-register)). The output directory held `<run>.db`, `<run>.json`, and `<run>.log`, without the `-sessions.json` file that the docs list (`22-eval-results-ls-container-env.txt`).

```figure
id: fig-5-6
kind: timeline
title: two runs on one axis of turns, and two eval scores
claim: The two replays of `files.yaml` match on all five turns, the guarded run differs at turn 0, and `eval` scores the same agent per tool call.
caption: Read the top tracks left to right along the turn axis, one cell per model reply. The rose cell is the first divergence, and dashed cells are not compared. The bottom rows are the eval scores. From capture/out/18-transcript.txt, 20-restricted.txt, 21-sessions-diff.txt, and 22-eval-container-env.txt.
```

```takeaways
- Put `--` before relative session references, as in `sessions diff -- -1 -2`.
- Record with `--record=PATH` and `--models-gateway`, and ask for one tool call per message.
- Fail a CI job on `sessions diff --fail-on-divergence`, which compares tool calls and ignores prose.
- Pass the models gateway to eval containers with `-e`, because the judge stays on the host.
```

Sources: docs-agent Sessions, Evaluation (research/sources/docs-docker-agent.md, pages features/sessions, features/evaluation); help-agent docker-agent run, sessions diff, eval (research/sources/help-docker-agent.md); conflict C65 (research/conflicts-register.md); capture/README.md; capture/run.py; capture/fixtures/agents/files.yaml, guarded.yaml; capture/fixtures/evals/count-lines.json, list-files.json; capture/out/18-cassette-head.txt, 18-transcript.txt, 19-transcript.txt, 20-restricted.txt, 21-session-db.txt, 21-sessions-diff.txt, 21-sessions-diff.json, 21-two-runs.txt, 22-eval.txt, 22-eval-gateway.txt, 22-eval-container-env.txt, 22-eval-run.json, 22-eval-run-container-env.json, 22-eval-results-ls-container-env.txt
