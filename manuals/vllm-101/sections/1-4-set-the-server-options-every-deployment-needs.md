# Set the server options every deployment needs

> A handful of server options decide who can reach the server, what name clients send, and what the log keeps.

Your first server works, and now other programs must call it. When you finish this section, you can set the address, the model name, the API key, the chat template, and the logging.

We did not measure the speed of these options. We checked the address, the model name, the API key, the YAML file, and the removed log flag on an L4 with the small Qwen3-0.6B. The rest comes from the vLLM documentation and the source at 0.31.0.

## Pick the address and the port

| Option | Default at 0.31.0 | Set it when |
|---|---|---|
| `--host` | not set, so the server listens on every network interface | the server must answer only one interface, such as `127.0.0.1` for a local test |
| `--port` | 8000 | another program holds port 8000, or you run two servers on one machine |

The default listens on every interface, so other machines on the network can reach the server. For a test on your own machine, set `--host 127.0.0.1`.

## Give the model a stable name

By default, the model name in the API is the name you passed to `vllm serve`, such as `Qwen/Qwen3-8B`. Clients must send that exact name. `--served-model-name` sets the name that clients use instead:

```bash
vllm serve Qwen/Qwen3-8B --served-model-name chat
```

Clients now send `"model": "chat"`. You can then move to a new checkpoint without a change in the clients. The name also labels the metrics as `model_name`. If you give more than one name, the server answers to each of them.

## Require an API key

`--api-key` makes the server require the key in the `Authorization` header. You can also set it with the `VLLM_API_KEY` environment variable, which keeps the key out of the process list.

Stop any server that already runs on port 8000. Then start the server with a key in the first terminal:

```bash
VLLM_API_KEY=change-me vllm serve Qwen/Qwen3-8B --host 127.0.0.1 2>&1 | tee server.log
```

When the server is ready, send a request with the key from a second terminal:

```bash
curl http://localhost:8000/v1/models -H "Authorization: Bearer change-me"
```

The key protects only the routes under `/v1`, `/v2`, `/inference`, and `/cohere`. Other routes on the same port, such as `/invocations`, `/metrics`, and `/health`, stay open. We checked this on an L4. Without the key, `/v1/models` returned 401. `/health` and `/metrics` returned 200, and so did a chat request to `/invocations`.

So the key does not make the server safe on a public network. Put a gateway in front of it, as [the production page](#s-run-vllm-in-production) says.

## Fix the chat template

vLLM formats chat messages with the chat template from the model repository. Some repositories have no template or a wrong one. Then the model sees a badly formatted prompt and answers poorly.

`--chat-template` takes a file path or the template text. `--default-chat-template-kwargs` sets template values for every request, such as `'{"enable_thinking": false}'` for Qwen3. A request can still set its own `chat_template_kwargs`. [The reasoning models page](#s-serve-reasoning-models) uses this for Qwen3.

## Control what the log keeps

| Option | Default | What it does |
|---|---|---|
| `--enable-log-requests` | off | writes one line for each request, with its ID and parameters |
| `--max-log-len` | no limit | cuts the prompt text in those lines to this many characters |
| `VLLM_LOGGING_LEVEL` | `INFO` | sets the vLLM log level, such as `DEBUG` for a hard problem |
| `--uvicorn-log-level` | `info` | sets the log level of the HTTP server |
| `--disable-uvicorn-access-log` | off | removes the line for each HTTP request, such as each `/health` probe |

With `--enable-log-requests` at the `DEBUG` level, the request lines include the prompt. Do not use that setting on a server that handles private data.

Older releases had a `--disable-log-requests` flag. At 0.31.0 that flag does not exist, and the request lines are off unless you turn them on.

## Turn off usage statistics

vLLM sends anonymous usage data about the hardware and the model configuration by default. To turn it off, set `VLLM_NO_USAGE_STATS=1` or `DO_NOT_TRACK=1` in the environment of the server.

## Keep the options in a file

`vllm serve --config config.yaml` reads the options from a YAML file. Each key is the long name of a flag without the two dashes, such as `served-model-name: chat`. An option on the command line wins over the same option in the file.

## Check the options

Read the `non-default args` line near the top of the log. It lists every option that you changed from its default:

```bash
grep "non-default args" server.log
```

Then call `/v1/models` with and without the key. Without it, the server returns HTTP 401.

```takeaways
- Set --host to 127.0.0.1 for a local test, because the default listens on every interface.
- Set --served-model-name, so clients keep one name across checkpoints.
- Use an API key and a gateway, because the key protects only some routes.
```

Sources: vLLM documentation at v0.31.0 (docs/configuration/serve_args.md, docs/usage/usage_stats.md, docs/usage/security.md, docs/usage/troubleshooting.md), the vLLM source at v0.31.0 (vllm/entrypoints/launchers/cli_args.py, vllm/entrypoints/launchers/launcher.py, vllm/engine/arg_utils.py, vllm/config/model.py, vllm/envs.py), capture/gpu/out-gb10/server-load-vllm.log, capture/gpu/out-l4/livecheck-2026-10-22.txt.
