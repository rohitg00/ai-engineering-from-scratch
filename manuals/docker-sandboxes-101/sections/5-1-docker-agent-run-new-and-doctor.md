# docker-agent run, new, and doctor

> `docker-agent run` loads an agent file and drives the loop with or without a terminal, `doctor` says which model `auto` would pick, and `new` needs a terminal.

A colleague sends you an agent file and one command to run it. You have no API key, only Docker Desktop with Model Runner, and you want proof that the file runs before you open a chat window.

When you finish this section, you can run an agent file with no terminal, read its event stream, and ask `doctor` which model `auto` picks.

## What run takes

**Agent reference:** the first argument of `docker-agent run`. It is a `.yaml`, `.yml`, or `.hcl` file, a registry reference, an alias, or nothing {{help-agent docker-agent run}}. With nothing, `run` uses `docker-agent.yaml`, `docker-agent.yml`, or `docker-agent.hcl` from the current directory, or else a built-in default agent {{docs-agent CLI Reference}}. `coder` is a second built-in agent, and `alias add` saves a name for a file or a reference together with run options such as `--safety` {{help-agent docker-agent alias add}}.

A registry reference behaves like a file. `24-run-ref.txt` runs `localhost:15000/m101/agent:v1` and prints the same answer as the local file, as [share push and share pull](#s-share-push-and-share-pull) shows. Each further argument is one user message, and the messages run as turns in order. A `-` reads the message from stdin {{help-agent docker-agent run}}.

## --exec, --json, and --last

**Headless run:** `run --exec`, which writes to stdout and opens no TUI. `--json` writes one JSON event per line, and `--last` prints only the final answer {{help-agent docker-agent run}}. The capture runs `capture/fixtures/agents/files.yaml` with the same two messages in each form.

```listing
title: run --exec --last with two messages
source: capture/out/18-run-last.txt
lang: text
note: Nothing is cut. The --fake flag replays the recorded model answers, as the session section explains.
---
$ docker-agent run --exec --working-dir fixtures/repo --last --fake work/cassettes/18-files fixtures/agents/files.yaml 'List the files in the working directory.' 'How many lines does README.md have? Count them with a shell command.'
README.md has 1 line.
[exit 0]
```

```listing
title: three of the 67 events of the same run with --json
source: capture/out/18-run-json.ndjson
lang: jsonl
note: Lines 5, 13, and 24 of the file. The tool_call event is cut after the call, before its tool_definition.
---
{"message": "List the files in the working directory.", "session_id": "<uuid>", "session_position": 0, "timestamp": "<ts>", "type": "user_message"}
{"agent_name": "root", "timestamp": "<ts>", "tool_call": {"function": {"arguments": "{\"path\": \".\"}", "name": "list_directory"}, "id": "<call-id>", "type": "function"}, "tool_definition": …
{"agent_name": "root", "content": "The working directory contains 1 file: README.md (1 line).", "message_id": "<uuid>", "session_id": "<uuid>", "timestamp": "<ts>", "type": "agent_choice"}
```

The other event types of the file include `team_info`, `toolset_info`, `tool_call_response`, `token_usage`, and `stream_stopped`. The second turn shows the limit of a headless run. The model asked for `shell` with `wc -l README.md`, and the runtime raised `tool_call_confirmation`. With no terminal to answer it, the tool result was "The user rejected the tool call." The model then used `read_file` (`18-transcript.txt`). [Permissions, --safety, and hooks](#s-permissions-safety-and-hooks) explains why that call asked.

## The model in every recording

The docs call `ai/qwen3` "the model Docker Agent reaches for by default" {{docs-agent Set Up a Model}}, and `doctor` resolves `auto` to the 8B tag `ai/qwen3:latest`. On the recording Mac, two pulls of that tag ended with a digest mismatch after the last 5.03 GB blob (`25-model-pull-latest.txt`). Every agent file of the kit therefore names `ai/qwen3:4b`, the 4B tag of the same repository. It is a thinking model, so it streams a few thousand reasoning tokens before each answer. `--exec` prints them, and the kit cuts them to one line such as `[... 299 lines of model reasoning cut by run.py ...]` (`18-run-exec.txt`).

## doctor and models

`doctor` reports provider credentials, whether Docker Model Runner answers, the `auto` pick, and, with a file, the variables that file needs. It exits non-zero on an issue {{help-agent docker-agent doctor}}. The kit ran it once with no Docker daemon and once with Model Runner up.

```listing
title: doctor with no Docker daemon
source: capture/out/16-doctor.txt
lang: text
note: The 20 provider rows, all "not set", and the full error of the runner check are cut.
---
$ docker-agent doctor
…
Docker Model Runner
  Status: unreachable: docker --config=$HOME/.docker --context=m101-no-daemon model status --json: …
…
Model auto-selection
  auto -> dmr/ai/qwen3:latest

Issues
  - no usable model: no provider credential was found and Docker Model Runner is unreachable; …
Error: 1 issue(s) found
[exit 1]
```

```listing
title: doctor with Model Runner up and one model pulled
source: capture/out/25-doctor.txt
lang: text
note: The user configuration line and the 20 provider rows are cut.
---
$ docker-agent doctor
…
Docker Model Runner
  Status: reachable, 1 model(s) pulled:
    - docker.io/ai/qwen3:4b

Model auto-selection
  auto -> dmr/docker.io/ai/qwen3:4b

No issues found.
[exit 0]
```

With no runner, `auto` still names `dmr/ai/qwen3:latest`, and the issue line says why nothing can run. With the runner up, `auto` takes the one pulled model, as the provider page says: auto-selection "prefers a locally-installed model" {{docs-agent Docker Model Runner}}. `models list` printed one row, `dmr ai/qwen3:latest`, even with no daemon (`16-models.txt`). `setup` is the interactive fix. Its four paths are a provider key in `~/.config/cagent/.env`, a Model Runner pull, a custom OpenAI-compatible endpoint, and the Claude Code harness {{help-agent docker-agent setup}}.

## new

`new` asks questions and writes an agent file, and a description argument skips "the initial prompt" {{help-agent docker-agent new}}. Its `--model` takes anthropic, openai, google, dmr, or a custom provider, and `--max-iterations` defaults to 20 for DMR ([conflict C66](#s-ref-sources-and-the-conflicts-register)). In the capture, `new` with a description and no controlling terminal stopped at `/dev/tty` and wrote no file (`17-new-agent.yaml`).

```listing
title: new with a description and no terminal
source: capture/out/17-new.txt
lang: text
note: The welcome banner and the telemetry notice are cut.
---
$ docker-agent new --model dmr/ai/qwen3:4b 'an agent that greets the user and names one fact about Docker sandboxes'  (in work/, without a controlling terminal)
…
Error: bubbletea: error opening TTY: bubbletea: could not open TTY: open /dev/tty: device not configured
[exit 1]
```

[Figure](#fig-5-1) puts the pieces of one run on one page.

```figure
id: fig-5-1
kind: flow
title: one docker-agent run from the file to its outputs
claim: `run` loads the agent file, alternates model calls and tool calls in one loop, and writes the answer, the events, a session, and with `--record` a cassette.
caption: Read from the top left. Solid plum is a model call and dashed olive a tool effect. Dotted indigo is the event stream, and solid teal is a stored record. With `--fake`, the cassette answers in place of Model Runner. From capture/fixtures/agents/files.yaml, capture/out/18-run-json.ndjson, and capture/out/18-cassette-head.txt.
```

```takeaways
- Run `docker-agent doctor` first, and read its `auto` line and its exit code.
- Use `--exec --json` in scripts, and expect each tool call that asks for approval to fail.
- Write agent files by hand for CI, because `docker-agent new` opens `/dev/tty`.
- Name a model tag in the agent file instead of trusting `auto` on a shared machine.
```

Sources: help-agent docker-agent run, setup, doctor, new, alias add (research/sources/help-docker-agent.md); docs-agent CLI Reference, Set Up a Model, Docker Model Runner (research/sources/docs-docker-agent.md, pages features/cli, getting-started/set-up-a-model, providers/dmr); conflict C66 (research/conflicts-register.md); capture/README.md; capture/fixtures/agents/files.yaml; capture/out/16-doctor.txt, 16-models.txt, 17-new.txt, 17-new-agent.yaml, 18-run-exec.txt, 18-run-last.txt, 18-run-json.ndjson, 18-transcript.txt, 18-cassette-head.txt, 24-run-ref.txt, 25-doctor.txt, 25-model-pull-latest.txt
