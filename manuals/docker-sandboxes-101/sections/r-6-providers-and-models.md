# Providers and models

> Every provider id docker-agent 1.149.0 knows, the credential it reads, the `provider/model` reference form, the DMR endpoint order, the `auto` rule, and the keys that tune a model.

`docker-agent doctor` printed 20 providers with their credential variables on the capture machine, every one `not set` (research/sources/probes/docker-agent-doctor.txt). The docs name 31 ids, and the schema description of `provider` lists the built-in aliases {{schema ProviderConfig}}. The table below is the union, in the order of the doctor output and then of the docs. The doctor prints canonical ids such as `fireworks-ai`, and the legacy ids stay accepted as aliases ([conflict C58](#s-ref-sources-and-the-conflicts-register)).

## The provider ids

| Provider id | Legacy id | Credential | Source |
|---|---|---|---|
| `anthropic` | none | `ANTHROPIC_API_KEY`, or `auth.type: workload_identity_federation` | doctor, {{docs-agent Models}} |
| `openai` | none | `OPENAI_API_KEY` | doctor |
| `chatgpt` | none | none. A browser sign-in through `docker agent setup`, shown as `CHATGPT_OAUTH_TOKEN` | doctor, {{docs-agent Model Providers}} |
| `github-copilot` | none | `GITHUB_TOKEN` or `GH_TOKEN`, a PAT with the `copilot` scope | doctor, {{docs-agent Model Providers}} |
| `google` | none | `GOOGLE_API_KEY` or `GEMINI_API_KEY`. Vertex AI uses `GOOGLE_GENAI_USE_VERTEXAI`, `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION` | doctor, {{docs-agent Models}} |
| `mistral` | none | `MISTRAL_API_KEY` | doctor |
| `openrouter` | none | `OPENROUTER_API_KEY` | doctor |
| `baseten` | none | `BASETEN_API_KEY` | doctor |
| `ovhcloud` | none | `OVH_AI_ENDPOINTS_ACCESS_TOKEN` | doctor |
| `groq` | none | `GROQ_API_KEY` | doctor |
| `fireworks-ai` | `fireworks` | `FIREWORKS_API_KEY` | doctor, {{docs-agent Models}} |
| `deepseek` | none | `DEEPSEEK_API_KEY` | doctor |
| `cerebras` | none | `CEREBRAS_API_KEY` | doctor |
| `togetherai` | `together` | `TOGETHER_API_KEY` | doctor, {{docs-agent Models}} |
| `huggingface` | none | `HF_TOKEN` | doctor |
| `moonshotai` | `moonshot` | `MOONSHOT_API_KEY` | doctor, {{docs-agent Models}} |
| `vercel` | none | `AI_GATEWAY_API_KEY` | doctor |
| `amazon-bedrock` | none | `AWS_BEARER_TOKEN_BEDROCK`, or the AWS credential chain, which the doctor counts as three more variables | doctor, {{docs-agent Models}} |
| `opencode` | `opencode-zen` | `OPENCODE_API_KEY` | doctor, {{docs-agent Model Providers}} |
| `opencode-go` | none | `OPENCODE_API_KEY` | doctor |
| `dmr` | none | none. A local Docker Model Runner | {{docs-agent Models}} |
| `ollama` | none | none. An optional `base_url` | {{docs-agent Models}} |
| `xai` | none | `XAI_API_KEY` | {{docs-agent Models}} |
| `nebius` | none | `NEBIUS_API_KEY` | {{docs-agent Models}} |
| `nvidia` | none | `NVIDIA_API_KEY` | {{docs-agent Models}} |
| `minimax` | none | `MINIMAX_API_KEY` | {{docs-agent Models}} |
| `cloudflare-workers-ai` | none | `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` | {{docs-agent Models}} |
| `cloudflare-ai-gateway` | none | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and `CLOUDFLARE_GATEWAY_ID` | {{docs-agent Models}} |
| `requesty` | none | `REQUESTY_API_KEY` | {{docs-agent Models}} |
| `azure` | none | `AZURE_API_KEY` and a `base_url` | {{docs-agent Models}} |
| a name under `providers` | none | the variable in `token_key` | {{schema ProviderConfig}} |

The doctor lists eleven ids that the docs tables do not count as providers, and the docs list ten that the doctor did not print. A credential can also come from `~/.config/cagent/.env`, from a `credential_helper` command in the user config, from Docker Desktop, or from a 1Password `op://` reference {{docs-agent Secrets}}.

## The model reference

| Form | Example | Meaning | Source |
|---|---|---|---|
| `provider/model` | `dmr/ai/qwen3`, `anthropic/claude-sonnet-4-5` | An inline model on a known provider | {{docs-agent Models}} |
| a name from `models` | `model: local` | A named model with its own keys | {{docs-agent Models}} |
| `name/model` | `my_gateway/gpt-4o` | A model on a provider defined under `providers` | {{docs-agent Provider Definitions}} |
| `a,b` | `anthropic/claude-sonnet-4-5,openai/gpt-5` | An alloy. The runtime alternates between the models in one conversation | {{docs-agent Models}} |
| `auto` | `model: auto` | The first cloud provider with a credential, else a pulled DMR model | {{docs-agent Set up a model}} |
| `first_available: [...]` | a list of references | The first candidate whose credentials are configured, resolved at load time | {{docs-agent Models}} |
| `--model [agent=]provider/model` | `--model root=dmr/ai/qwen3` | A CLI override, repeatable per agent | {{help-agent docker-agent run}} |

## The auto rule

`auto` picks the first cloud provider with a configured credential and then a locally pulled Docker Model Runner model {{docs-agent Set up a model}}. On the DMR side it prefers the model named in `model:` when that model is already pulled. Otherwise it takes the first available non-embedding model, instead of asking to pull `ai/qwen3:latest` {{docs-agent Docker Model Runner}}. It never picks a provider defined under `providers` {{docs-agent Provider Definitions}}. `DOCKER_AGENT_DEFAULT_MODEL` sets the model used when none is given {{docs-agent User settings}}. On the capture machine, with no credential and the runner unreachable, the doctor still printed `auto -> dmr/ai/qwen3:latest` and reported one issue (research/sources/probes/docker-agent-doctor.txt).

## The DMR endpoint

| Step | Endpoint | Source |
|---|---|---|
| 1 | `base_url` on the model or the provider, when set | {{docs-agent Docker Model Runner}} |
| 2 | the endpoint the `docker model` plugin reports. The doctor runs `docker model status --json` through the Desktop context | research/sources/probes/docker-agent-doctor.txt |
| 3 | the default `http://127.0.0.1:12434/engines/llama.cpp/v1` when the plugin is not found | {{docs-agent Docker Model Runner}}, 03-stack.md note 14 |
| in a container | `http://model-runner.docker.internal/engines/v1`, with `unload_api: /engines/_unload` on the provider | {{docs-agent Docker Model Runner}} |
| unload | the `base_url` with the trailing `/v1` replaced by `_unload`, called by the `unload` builtin on `on_agent_switch` | {{docs-agent Docker Model Runner}} |

The runner needs no API key, and the API is not authenticated ([conflict C84](#s-ref-sources-and-the-conflicts-register)). The docs state only that the default URL is used when the plugin is not found. The order above puts that default third, after `base_url` and the plugin, as the research file reads it.

## The models gateway

`--models-gateway` and `DOCKER_AGENT_MODELS_GATEWAY` route model traffic through one address, and `bypass_models_gateway: true` or a custom `base_url` sends a model directly to its provider {{docs-agent Model Configuration}}. `docker agent models` asks the gateway `/v1/models` first and uses the providers with credentials when the gateway answers nothing usable {{docs-agent features/cli}}. The Docker gateway needs a Docker token. Desktop hands out one that lasts 15 minutes. When Desktop has none, docker-agent exchanges the `docker login` access token for a fresh one over HTTPS {{docs-agent Secrets}}. The exchange is cached under the cache directory, `DOCKER_AGENT_NO_TOKEN_EXCHANGE=1` turns it off, and `docker agent debug auth` shows the token in use.

## Keys that tune a model

| Key | Applies to | Values | Source |
|---|---|---|---|
| `temperature`, `top_p`, `frequency_penalty`, `presence_penalty` | every provider | sampling parameters, sent per request | {{schema ModelConfig}} |
| `max_tokens` | every provider | output tokens per response, not the context window | {{schema ModelConfig}} |
| `thinking_budget` | OpenAI | `none`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`. `xhigh` needs gpt-5.2 or later, `none` and `max` need gpt-5.6 or later | {{schema ModelConfig}} |
| `thinking_budget` | Anthropic | an integer from 1024 to 32768, `adaptive`, `adaptive/<effort>`, or an effort level | {{schema ModelConfig}} |
| `thinking_budget` | Amazon Bedrock with Claude | an integer, or `low`, `medium`, `high` | {{schema ModelConfig}} |
| `thinking_budget` | Gemini 2.5 | an integer, `-1` dynamic, `0` off, 24576 at most | {{schema ModelConfig}} |
| `thinking_budget` | Gemini 3 | `minimal` on Flash only, `low`, `medium`, `high` | {{schema ModelConfig}} |
| `thinking_budget` | DMR on llama.cpp | sent as `llamacpp.reasoning-budget` through `_configure`. On vLLM as `thinking_token_budget` per request. Ignored on MLX and SGLang | {{docs-agent Docker Model Runner}} |
| `task_budget` | Anthropic | an integer or `{type: tokens, total: N}`, sent as `output_config.task_budget` | {{schema ModelConfig}} |
| `provider_opts.context_size` | DMR | the context window, sent through `_configure`. `max_tokens` is never the window | {{docs-agent Docker Model Runner}} |
| `provider_opts.runtime_flags`, `raw_runtime_flags` | DMR | flags for the inference runtime, as a list or one string. Exclusive with each other | {{docs-agent Docker Model Runner}} |
| `provider_opts.keep_alive` | DMR | a Go duration, `0` unloads at once, `-1` never unloads | {{docs-agent Docker Model Runner}} |
| `provider_opts.mode` | DMR | `completion`, `embedding`, `reranking`, `image-generation` | {{docs-agent Docker Model Runner}} |
| `provider_opts.speculative_draft_model`, `speculative_num_tokens`, `speculative_acceptance_rate` | DMR | speculative decoding with a draft model | {{docs-agent Docker Model Runner}} |
| `provider_opts.gpu_memory_utilization`, `hf_overrides` | DMR on vLLM | engine settings sent through `_configure` | {{docs-agent Docker Model Runner}} |
| `provider_opts.supports_images`, `supports_pdf` | DMR | declare attachment types, because DMR models are not in the models.dev catalogue | {{schema ModelConfig}} |
| `provider_opts.http_headers` | OpenAI-compatible providers | headers on every request, such as the Copilot integration id | {{schema ModelConfig}} |
| `fallback.models`, `retries` (`2`), `cooldown` (`1m`) | every provider | models tried after a failure, with backoff | {{schema FallbackConfig}} |
| `capabilities`, `output_capabilities`, `cost` | every provider | attachment flags, image output, and USD prices that override the catalogue | {{schema ModelConfig}} |
| `title_model`, `compaction_model`, `compaction_threshold` (`0.9`) | every provider | cheaper models for titles and summaries, and the compaction point | {{schema ModelConfig}} |
| `providers.<name>` defaults | every provider | `temperature`, `max_tokens`, `thinking_budget`, `task_budget`, and the other defaults a model inherits | {{docs-agent Provider Definitions}} |

The docs give a default reasoning effort per provider {{docs-agent Models}}. It is `medium` on OpenAI always-reasoning models, off on Anthropic, `-1` on Gemini 2.5, and model-dependent on Gemini 3.

Sources: research/sources/probes/docker-agent-doctor.txt, docker-agent-models-list.txt; research/sources/agent-schema.json (`ModelConfig`, `ProviderConfig`, `FallbackConfig`); research/sources/docs-docker-agent.md (pages concepts/models, configuration/models, providers/overview, providers/custom, providers/dmr, getting-started/set-up-a-model, guides/secrets, configuration/user-settings, features/cli); research/sources/help-docker-agent.md (`run`, `models`, `doctor`); /Users/rohitghumare/.cache/aiefs-manuals-wip/docker-research/03-stack.md note 14; research/conflicts-register.md rows C58, C84
