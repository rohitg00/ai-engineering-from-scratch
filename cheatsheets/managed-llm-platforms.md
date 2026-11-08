---
id: managed-llm-platforms
title: Managed Platforms and Self-Hosting Compared
code: MN
subtitle: Pick a hyperscaler, an inference platform or a self-hosted engine. Price it, size it, cut cold starts.
hue: 28
sources: phases/17-infrastructure-and-production/01-managed-llm-platforms, phases/17-infrastructure-and-production/02-inference-platform-economics, phases/17-infrastructure-and-production/10-cold-start-mitigation, phases/17-infrastructure-and-production/28-self-hosted-serving-selection
source_hash: 989d353d0e149310
---

## Three hyperscalers side by side
type: comparison
span: 2
from: phases/17-infrastructure-and-production/01-managed-llm-platforms

| Factor | Bedrock | Azure OpenAI | Vertex AI |
|---|---|---|---|
| Strategy | Model marketplace | Exclusive OpenAI models | Gemini first |
| Catalog | Claude, Llama, Titan, Mistral, Cohere | GPT, o-series, DALL·E, Whisper | Gemini plus Model Garden |
| Median TTFT | ~75 ms on-demand | ~50 ms with PTUs | 60 ms in `main.py` |
| Dedicated capacity | Provisioned Throughput, $21-$50/hr | PTU, up to 70% savings | Per Gemini SKU |
| Break-even | About half peak utilization | ~40-60% sustained utilization | Less publicly advertised |
| Cost attribution | Application Inference Profiles | Scopes, tags, PTU reservations | Project per team, BigQuery export |
| Compliance | BAAs, VPC endpoints, guardrails | HIPAA, SOC 2, ISO 27001 | HIPAA, GDPR, residency per region |

## Inference platforms side by side
type: comparison
span: 2
from: phases/17-infrastructure-and-production/02-inference-platform-economics

| Factor | Fireworks | Together | Baseten | Modal |
|---|---|---|---|---|
| Optimizes | Latency | Catalog breadth | Enterprise polish | Python-native DX |
| Billing | Per token | Per token | Per minute | Per second |
| Rate in `main.py` | $0.90/M output | $0.88/M output | $0.55/min | $0.48/min |
| Reserved floor | None | None | 1440 min/day | 60 min/day |
| Cold start in `main.py` | 1.5 s | 2.0 s | 5.0 s | 2.5 s |
| Key fact | Batch tier ~50% of serverless | 200+ models | Truss, SOC 2 Type II | `@modal.function(gpu="A100")` |

## Use a hyperscaler when
type: concepts
from: phases/17-infrastructure-and-production/01-managed-llm-platforms

- **Bedrock**: you need Claude, Llama and others behind one API and one IAM surface.
- **Bedrock**: you need cost per team, product or feature with no post-processing.
- **Azure OpenAI**: you need GPT models and TTFT P99 under 100 ms on PTUs.
- **Vertex AI**: you need 1M-token Gemini context or multimodal input.
- **Two providers**: every product-critical call runs on two hyperscalers.
- **Common pair**: Claude from Bedrock, GPT from Azure OpenAI, one gateway.

## Use a platform or self-host when
type: concepts
from: phases/17-infrastructure-and-production/02-inference-platform-economics, phases/17-infrastructure-and-production/28-self-hosted-serving-selection

- **Custom silicon**: latency is critical. Groq is the pick for voice agents.
- **Fireworks**: you need low latency and LoRA at the base model rate.
- **Together**: you need new open models within days of release.
- **Baseten**: you need a fine-tuned model, dedicated GPUs, SOC 2 and HIPAA.
- **Modal**: your team writes Python and wants per-second billing.
- **Replicate**: you serve image, video and audio models per prediction.
- **Anyscale**: inference is one node in a larger Ray graph.
- **Self-host**: data residency, custom fine-tune, cost at scale or no hosted model.

## Pick a self-hosted engine
type: flow
from: phases/17-infrastructure-and-production/28-self-hosted-serving-selection

1. **Hardware CPU**: use llama.cpp. No other engine is competitive on CPU.
2. **Hardware AMD**: use vLLM with ROCm. TRT-LLM is NVIDIA-locked.
3. **Hardware Blackwell**: TRT-LLM leads on B200/GB200. vLLM and SGLang follow.
4. **Scale 1 user**: use Ollama. One command, first token in seconds.
5. **Scale 10-100 users**: use vLLM on a single GPU.
6. **Scale 100-10k users**: use vLLM production-stack or SGLang.
7. **Workload agentic or prefix heavy**: use SGLang RadixAttention.
8. **Pipeline**: dev Ollama, staging llama.cpp, prod vLLM. Convert GGUF to safetensors.

## Cold start of a 70B model (seconds)
type: comparison
span: 2
from: phases/17-infrastructure-and-production/10-cold-start-mitigation

| Phase | Raw | Pre-seeded image | Model streamer | GPU snapshot |
|---|---|---|---|---|
| node provision | 50.0 | 50.0 | 50.0 | 0.5 |
| image pull | 180.0 | 0.0 | 180.0 | 0.0 |
| weights to HBM | 75.0 | 75.0 | 35.0 | 0.0 |
| engine init | 20.0 | 20.0 | 20.0 | 2.0 |
| first forward | 3.0 | 3.0 | 3.0 | 0.5 |
| Tool | none | Bottlerocket, `EC2NodeClass` | Run:ai Model Streamer | Modal checkpoints |
| Gain | 328s total | 2-4 minutes saved | ~2x weight-load speedup | 10x faster restart |

## Run the models in code
type: task-table
span: 2
from: phases/17-infrastructure-and-production/01-managed-llm-platforms/code/main.py, phases/17-infrastructure-and-production/02-inference-platform-economics/code/main.py, phases/17-infrastructure-and-production/10-cold-start-mitigation/code/main.py, phases/17-infrastructure-and-production/28-self-hosted-serving-selection/code/main.py

| Task | Code |
|---|---|
| Cost and TTFT per hyperscaler | `simulate(tokens_in_per_day, tokens_out_per_day, sla_ttft_ms, use_ptu)` |
| Azure PTU break-even sweep | `break_even_demo()` |
| Cost of the two-provider minimum | `lock_in_cost()` |
| Cost per day for one vendor | `cost_per_day(v, tokens_per_day, predictions_per_day)` |
| Per-token vs per-minute sweep | `utilization_breakeven()` |
| Cold start for a mitigation stack | `total_for_stack({"pre_seeded", "streamer"})` |
| Warm pool break-even | `warm_pool_break_even(gpu_hourly=4.50, cold_seconds=328, sla_tolerated_drops_per_day=5)` |
| Engine for hardware, scale, workload | `pick_engine(hardware, scale, workload)` |

## Troubleshooting
type: troubleshooting
from: phases/17-infrastructure-and-production/01-managed-llm-platforms, phases/17-infrastructure-and-production/10-cold-start-mitigation, phases/17-infrastructure-and-production/28-self-hosted-serving-selection

| Symptom | Cause | Fix |
|---|---|---|
| P99 TTFT misses 100 ms on-demand | Shared capacity competes with other traffic | Buy PTUs or Provisioned Throughput |
| PTU bill high at low traffic | You pay for the reservation when idle | Reserve only at ~40-60% sustained utilization |
| Bedrock bill up 4x, same traffic | No per-feature attribution | Route calls through Application Inference Profiles |
| No per-request cost on Azure | Tags come from resource groups | Application Insights custom metrics or gateway headers |
| Product down in a provider outage | Single-vendor lock-in | Two-provider minimum behind one gateway |
| First token takes 3-8 minutes | Raw 70B cold start after scale to zero | Stack pre-seeded image, streamer, snapshot |
| Snapshot restore fails on new node | Snapshots are per GPU topology | Re-checkpoint on the new SKU |
| New project picks TGI | Maintenance mode since Dec 11, 2025 | Default to vLLM or SGLang |

## Q&A
type: qa
from: phases/17-infrastructure-and-production/01-managed-llm-platforms, phases/17-infrastructure-and-production/02-inference-platform-economics, phases/17-infrastructure-and-production/10-cold-start-mitigation, phases/17-infrastructure-and-production/28-self-hosted-serving-selection

- **Why is Bedrock ~25 ms slower?** Shared on-demand capacity. Azure PTUs reserve GPUs for your tenant.
- **When does per-minute beat per-token?** The docs say above ~30% sustained utilization. `main.py` says ~60-70% under reserved-minute billing.
- **When is a warm pool mandatory?** Typically at TTFT P99 < 60s on a 70B+ model.
- **What does a warm pool cost?** Five products with one warm replica use 3,600 GPU-hours/month.
- **Why does live migration move tokens?** Input is KB. KV cache is GB. Recompute is cheaper.
- **Why not Ollama in production?** 15-30% slower than llama.cpp, 3x gap under prod load.

## Glossary
type: glossary
from: phases/17-infrastructure-and-production/01-managed-llm-platforms, phases/17-infrastructure-and-production/02-inference-platform-economics, phases/17-infrastructure-and-production/10-cold-start-mitigation, phases/17-infrastructure-and-production/28-self-hosted-serving-selection

- **PTU**: Provisioned Throughput Unit. Reserved inference GPUs, priced per hour.
- **BAA**: Business Associate Agreement. Required for PHI. All three provide it.
- **Application Inference Profile**: tagged Bedrock profile with cost per profile in CloudWatch.
- **Truss**: Baseten manifest for dependencies, secrets and serving config.
- **FireAttention**: Fireworks custom attention kernel.
- **RayTurbo**: Anyscale proprietary inference engine on Ray.
- **min_workers**: serverless keep-alive count. `min_workers=1` is a warm pool.
- **GGUF**: llama.cpp weight format with bundled K-quant variants.
