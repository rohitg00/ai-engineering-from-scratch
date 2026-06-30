# Phase 17 — Infrastructure and Production

## What is this phase about?
You built models and agents — now you have to **run them for real users**, fast and cheaply, without falling over. This phase is the "ops" side of AI: where to host models, how serving engines squeeze GPUs, how to cut costs (caching, batching, routing, quantization), how to monitor and load-test, and how to stay secure and compliant. It's the bridge from "works on my laptop" to "serves millions reliably."

## Why is this phase important?
Inference is where the money and the user experience live. A model that's slow or expensive in production fails commercially even if it's smart. These are the skills that make you an *AI engineer* rather than just a prototyper — and they're in high demand because few people have them.

## What will I be able to build after this phase?
- Production LLM serving that's fast and cost-efficient
- Cost controls: caching, batching, routing, quantization
- Observability, load testing, and chaos testing for AI
- Secure, compliant, multi-tenant AI infrastructure

## How important is this phase?
⭐⭐⭐⭐ Important. Essential for anyone deploying AI products; lighter priority for pure researchers.

## Difficulty
Hard. Heavy on systems, GPUs, and ops concepts — practical but dense. You'll get more from it once you've actually tried to ship something.

## Estimated Study Time
**20–30 hours** across 28 lessons. Lessons 04, 08, 09, 13–16, 19 are the highest-leverage core; the hardware-deep lessons (05, 07, 17) can be skimmed first time.

---

# Managed LLM Platforms — Bedrock, Vertex AI, Azure OpenAI

## Simple Definition
Once you pick a model, you must serve it. You can call a provider's API directly, or go through a hyperscaler platform (AWS Bedrock, Google Vertex, Azure OpenAI) that adds enterprise extras — security, compliance, billing, monitoring. Each hyperscaler made a different bet on which models it offers.

## Imagine This...
Like buying groceries direct from a farm versus a supermarket that adds delivery, returns, and a loyalty card.

## Why Do We Need This?
- Serving needs more than a raw API call
- Enterprises need security and compliance features
- Model catalogs differ by platform

## Where Is It Used?
Enterprise AI deployments on AWS, Google, Azure.

## Do I Need to Master This?
🟡 Know the options; pick based on your stack.

## In One Sentence
Managed platforms wrap model APIs with enterprise security, billing, and monitoring.

## What Should I Remember?
- Direct API is simplest; platforms add enterprise features
- No single platform has every model
- Choose by your cloud and compliance needs

## Common Beginner Confusion
These platforms don't make the model smarter — they add the enterprise plumbing around it.

## What Comes Next?
Next: the economics of specialized inference providers.

---

# Inference Platform Economics — Fireworks, Together, Baseten, Modal, Replicate, Anyscale

## Simple Definition
Beyond hyperscalers, specialized providers (Fireworks, Together, Baseten, Modal, etc.) serve models faster or cheaper — but their pricing units don't line up ($/token vs $/minute vs $/second vs $/prediction). You can't compare them without modeling your actual workload.

## Imagine This...
Like comparing phone plans priced per-minute, per-gigabyte, and per-month — you must know your usage to choose.

## Why Do We Need This?
- Specialized providers can beat hyperscalers
- Pricing units differ and don't compare directly
- Workload determines real cost

## Where Is It Used?
Cost/latency-optimized model serving.

## Do I Need to Master This?
🟡 Learn to model cost against your workload.

## In One Sentence
Inference providers price differently, so you must model your workload to compare them fairly.

## What Should I Remember?
- Pricing units vary: token, minute, second, prediction
- The business model shapes the price
- Compare via your real workload, not the sticker

## Common Beginner Confusion
A lower per-unit price isn't automatically cheaper — it depends on your traffic pattern.

## What Comes Next?
Next: scaling GPU serving on Kubernetes.

---

# GPU Autoscaling on Kubernetes — Karpenter, KAI Scheduler, Gang Scheduling

## Simple Definition
Standard Kubernetes autoscaling lies for LLMs: GPU utilization pins at 100% so it never scales, and node provisioning is too slow for big prompts. This lesson covers GPU-aware scaling (Karpenter, KAI Scheduler, gang scheduling) that actually works for model serving.

## Imagine This...
Like a thermostat that reads the wrong sensor — it needs gauges built for the actual job.

## Why Do We Need This?
- Default autoscaling signals mislead for GPUs
- Slow node provisioning times out requests
- LLM serving needs GPU-aware scheduling

## Where Is It Used?
Self-hosted LLM serving on Kubernetes.

## Do I Need to Master This?
🟡 Learn it if you run your own GPU clusters.

## In One Sentence
GPU serving needs GPU-aware autoscaling, since default Kubernetes signals don't reflect real load.

## What Should I Remember?
- GPU utilization is a misleading scaling signal
- Node provisioning is slow — plan for it
- Use GPU-aware schedulers

## Common Beginner Confusion
100% GPU utilization doesn't mean "at capacity" — the standard signal can't tell.

## What Comes Next?
Next: the serving engine that revolutionized throughput — vLLM.

---

# vLLM Serving Internals: PagedAttention, Continuous Batching, Chunked Prefill

## Simple Definition
A naive serve loop handles one request at a time and wastes huge GPU memory. vLLM fixes three things: PagedAttention (stops memory fragmentation), continuous batching (requests join/leave between steps so the GPU stays busy), and chunked prefill (big prompts don't freeze everything). It's the standard high-throughput engine.

## Imagine This...
Like a restaurant kitchen that seats new diners as others leave, instead of waiting for the whole room to clear.

## Why Do We Need This?
- Naive serving wastes GPU memory and time
- Continuous batching keeps GPUs full
- It's the throughput backbone of modern serving

## Where Is It Used?
Most production self-hosted LLM serving.

## Do I Need to Master This?
🔴 Yes — vLLM's ideas underpin modern serving.

## In One Sentence
vLLM maximizes throughput with paged memory, continuous batching, and chunked prefill.

## What Should I Remember?
- PagedAttention reclaims wasted KV memory
- Continuous batching keeps the GPU busy
- Chunked prefill stops long prompts from stalling

## Common Beginner Confusion
Static batching seems efficient but wastes huge amounts on padding and slow-request stalls.

## What Comes Next?
Next: making decoding faster with speculation.

---

# EAGLE-3 Speculative Decoding in Production

## Simple Definition
Generating tokens is memory-bound — the GPU's compute sits idle reading weights. Speculative decoding uses a cheap "draft" model to guess several tokens ahead, then the real model verifies them all in one pass. Verified tokens are nearly free, speeding up generation.

## Imagine This...
Like a fast typist drafting a sentence and a careful editor approving the whole thing at once.

## Why Do We Need This?
- Decode wastes idle GPU compute
- Speculation fills that gap
- It speeds up generation significantly

## Where Is It Used?
Latency-optimized production serving.

## Do I Need to Master This?
🟢 Know the idea; deep detail is specialized.

## In One Sentence
Speculative decoding drafts tokens cheaply and verifies them in bulk to speed up generation.

## What Should I Remember?
- Decode is memory-bound, compute is idle
- A draft model guesses; the target verifies
- Verified tokens come nearly free

## Common Beginner Confusion
The draft model can be "wrong" — verification ensures correctness, so quality isn't sacrificed.

## What Comes Next?
Next: reusing shared prompt prefixes.

---

# SGLang and RadixAttention for Prefix-Heavy Workloads

## Simple Definition
RAG and agent requests usually share long prefixes (same system prompt, tools, examples). Naive serving re-processes that prefix every time. SGLang's RadixAttention stores the prefix's computation once and reuses it across requests — huge savings when prefixes repeat.

## Imagine This...
Like pre-printing the letterhead once instead of re-typing it on every page.

## Why Do We Need This?
- Requests share long, repeated prefixes
- Re-processing them wastes GPU work
- Caching prefixes saves a lot

## Where Is It Used?
RAG and agent serving with shared prompts.

## Do I Need to Master This?
🟡 Learn it for prefix-heavy workloads.

## In One Sentence
RadixAttention reuses shared prompt prefixes so the GPU doesn't reprocess them every request.

## What Should I Remember?
- RAG/agent prompts share long prefixes
- Reuse the prefix's cached computation
- Big savings when prefixes repeat

## Common Beginner Confusion
Every request looking unique on the surface can still share most of its prefix — that's the win.

## What Comes Next?
Next: pushing cost down with cutting-edge hardware.

---

# TensorRT-LLM on Blackwell with FP8 and NVFP4

## Simple Definition
Inference cost depends on four stacked choices: hardware generation, precision (BF16→FP8→FP4), serving engine, and orchestration. On the newest stack (Blackwell GPUs + TensorRT-LLM), the same model can run ~7x cheaper than on older setups. This lesson shows where those savings come from.

## Imagine This...
Like the same trip costing far less in a newer, more fuel-efficient car on a better route.

## Why Do We Need This?
- Cost-per-token is the inference frontier
- Hardware + precision + engine stack matters
- Big savings are available with the right stack

## Where Is It Used?
Cost-optimized large-scale inference.

## Do I Need to Master This?
🟢 Know the levers; deep tuning is specialized.

## In One Sentence
Cost-per-token drops dramatically by stacking newer hardware, lower precision, and optimized engines.

## What Should I Remember?
- Four stacked choices set the cost
- Lower precision (FP8/FP4) cuts cost
- Newer hardware can be many times cheaper

## Common Beginner Confusion
Cheaper inference isn't one trick — it's a stack of hardware and software choices combined.

## What Comes Next?
Next: the metrics that tell you if serving actually works.

---

# Inference Metrics — TTFT, TPOT, ITL, Goodput, P99

## Simple Definition
"Tokens per second" alone doesn't tell you if users are happy. You need specific metrics: time-to-first-token (TTFT), time-per-output-token (TPOT), inter-token latency (ITL), percentiles (P99), and goodput — a composite saying "did the user actually get what they expected in time."

## Imagine This...
Like judging a restaurant not by total meals served, but by how long each diner waited and how many left unhappy.

## Why Do We Need This?
- Throughput hides per-user latency
- Different latency types fail differently
- Goodput captures real user success

## Where Is It Used?
Every serious LLM serving deployment.

## Do I Need to Master This?
🔴 Yes — you can't operate serving without these.

## In One Sentence
Inference metrics like TTFT, TPOT, P99, and goodput reveal real user experience, not just raw throughput.

## What Should I Remember?
- TTFT = time to first token; TPOT = per-token time
- Always look at percentiles (P99), not averages
- Goodput is the user-success composite

## Common Beginner Confusion
High throughput can coexist with terrible user experience — percentiles tell the truth.

## What Comes Next?
Next: shrinking models with quantization.

---

# Production Quantization — AWQ, GPTQ, GGUF K-quants, FP8, MXFP4/NVFP4

## Simple Definition
Quantization stores model weights at lower precision, cutting memory and bandwidth — exactly what decoding needs. A 70B model can drop from 140GB to 35GB, fitting one GPU. But too-aggressive quantization hurts quality, and formats are tied to specific engines and hardware, so you must choose for your stack.

## Imagine This...
Like compressing a photo: smaller and faster, but push too far and it gets blurry.

## Why Do We Need This?
- Lower precision saves memory and bandwidth
- It fits big models on fewer GPUs
- But it can degrade quality

## Where Is It Used?
Cost-efficient model serving; edge deployment.

## Do I Need to Master This?
🔴 Yes — quantization is a core cost lever.

## In One Sentence
Quantization shrinks models to save memory and cost, trading off some quality.

## What Should I Remember?
- Lower precision = less memory and bandwidth
- Too aggressive hurts reasoning quality
- Formats depend on engine and hardware

## Common Beginner Confusion
You can't just copy someone's quantization choice — it depends on your engine and GPU.

## What Comes Next?
Next: handling cold starts in serverless serving.

---

# Cold Start Mitigation for Serverless LLMs

## Simple Definition
Serverless LLM endpoints scale to zero to save money, but the first request after idle is slow — provisioning a GPU node, loading the model, warming the cache can take a minute. This lesson covers ways to mitigate that cold-start delay.

## Imagine This...
Like a car that's cheap to park but takes a while to warm up on a cold morning.

## Why Do We Need This?
- Scaling to zero saves money but adds latency
- First requests after idle are slow
- Mitigation balances cost and responsiveness

## Where Is It Used?
Serverless and bursty LLM deployments.

## Do I Need to Master This?
🟡 Learn it if you use serverless serving.

## In One Sentence
Cold-start mitigation reduces the slow first request when a serverless endpoint wakes from idle.

## What Should I Remember?
- Scale-to-zero trades latency for cost
- Model loading dominates cold start
- Pre-warming and snapshots help

## Common Beginner Confusion
Scaling to zero isn't free — it pushes cost onto the next user as latency.

## What Comes Next?
Next: serving across regions without losing cache.

---

# Multi-Region LLM Serving and KV Cache Locality

## Simple Definition
LLM serving is *stateful* — the KV cache holds what the model has seen. Round-robin load balancing across regions scatters requests away from their cache, crashing hit rates and tripling latency. You must route requests to where their cache lives.

## Imagine This...
Like sending a returning customer to a random branch where no one remembers their order.

## Why Do We Need This?
- LLM serving is stateful, not stateless
- Blind routing misses the cache
- Cache-aware routing keeps it fast

## Where Is It Used?
Multi-region LLM deployments.

## Do I Need to Master This?
🟡 Learn it for global deployments.

## In One Sentence
Route requests to where their KV cache lives, since blind round-robin destroys cache hits.

## What Should I Remember?
- KV cache makes serving stateful
- Round-robin is wrong for stateful serving
- Route by cache locality

## Common Beginner Confusion
Standard load balancing is built for stateless services — LLM serving needs cache-aware routing.

## What Comes Next?
Next: running models on devices at the edge.

---

# Edge Inference — Apple Neural Engine, Qualcomm Hexagon, WebGPU/WebLLM, Jetson

## Simple Definition
Running models on-device (phones, laptops, browsers, Jetson boards) gives privacy and offline use, but performance varies wildly — the same model might run 55 tok/s on a laptop and 3 tok/s on a phone. Edge inference is really four different problems with four different solutions.

## Imagine This...
Like the same recipe cooking fast on a pro stove and slowly on a camping burner.

## Why Do We Need This?
- On-device gives privacy and offline use
- Performance varies hugely across hardware
- Each platform needs its own approach

## Where Is It Used?
On-device assistants, private/offline apps.

## Do I Need to Master This?
🟢 Know the landscape; deep dive if building edge apps.

## In One Sentence
Edge inference runs models on devices for privacy and offline use, with wildly varying performance.

## What Should I Remember?
- Edge = privacy + offline, variable speed
- Bandwidth and NPU access drive performance
- It's several distinct problems, not one

## Common Beginner Confusion
A model that's fast on a laptop can crawl on a phone — edge performance isn't portable.

## What Comes Next?
Next: seeing what your LLM app is doing.

---

# LLM Observability Stack Selection

## Simple Definition
You shipped an LLM feature but have no visibility into failures, tool loops, latency, cost spikes, or cache hits. Observability tools (LangSmith, Phoenix, Helicone, Langfuse) each answer different questions, so you choose based on what you most need to see.

## Imagine This...
Like picking a dashboard — speedometer, fuel gauge, or engine diagnostics — based on what you're tracking.

## Why Do We Need This?
- Shipping blind hides failures and cost spikes
- Each tool answers different questions
- You need visibility to improve

## Where Is It Used?
Every production LLM application.

## Do I Need to Master This?
🔴 Yes — observability is non-negotiable in production.

## In One Sentence
Observability tools reveal LLM failures, latency, and cost — pick the one matching your needs.

## What Should I Remember?
- Don't ship LLM features blind
- Different tools, different focuses
- Choose by the question you most need answered

## Common Beginner Confusion
These tools don't all do the same thing — match the tool to your actual problem.

## What Comes Next?
Next: caching to cut cost — done right.

---

# Prompt Caching and Semantic Caching Economics

## Simple Definition
Prompt caching can slash costs, but only if prompts are actually stable. Hidden variability (timestamps, request IDs, reordered examples) writes a new cache entry every time and reads zero. And parallel calls can all miss before the first write lands. Caching savings require deliberate design.

## Imagine This...
Like a reusable template ruined by stamping a new timestamp on every copy.

## Why Do We Need This?
- Caching can dramatically cut cost
- Hidden prompt variability kills hit rates
- Parallel calls can all miss

## Where Is It Used?
RAG and agent cost optimization.

## Do I Need to Master This?
🔴 Yes — caching is a top cost lever, easy to get wrong.

## In One Sentence
Prompt caching only saves money if prompts are genuinely stable and writes land before reads.

## What Should I Remember?
- Stable prefixes are required for cache hits
- Timestamps/IDs silently break caching
- Watch out for parallel-call cache misses

## Common Beginner Confusion
"I added caching but the bill is flat" usually means hidden variability is breaking every hit.

## What Comes Next?
Next: the 50%-off batch API discount.

---

# Batch APIs — the 50% Discount as Industry Standard

## Simple Definition
For non-urgent bulk jobs (nightly reports, mass summarization), batch APIs run your requests asynchronously at ~50% off. Stack that with prompt caching on shared system prompts, and a pipeline's cost can drop to under 10% of the synchronous baseline.

## Imagine This...
Like shipping a big order by slow freight at a fraction of express cost.

## Why Do We Need This?
- Bulk jobs don't need instant responses
- Batch gives ~50% off
- Stacking with caching multiplies savings

## Where Is It Used?
Nightly pipelines, bulk processing.

## Do I Need to Master This?
🟡 Learn it — easy, huge savings for batch work.

## In One Sentence
Batch APIs run bulk jobs asynchronously at ~50% off, stackable with caching for more.

## What Should I Remember?
- ~50% discount for async bulk work
- Stack with prompt caching
- Only for non-time-sensitive jobs

## Common Beginner Confusion
Batch isn't for live requests — it trades latency for a big discount.

## What Comes Next?
Next: routing requests to cheaper models.

---

# Model Routing as a Cost-Reduction Primitive

## Simple Definition
Most queries are simple ("what time is it in Paris?") and a cheap model handles them perfectly; only a minority need an expensive model's reasoning. Routing the easy ones to cheap models and hard ones to strong models can cut your bill ~65% at the same quality — if you build the router without regressing quality.

## Imagine This...
Like sending routine questions to a junior staffer and only escalating the hard ones to a senior expert.

## Why Do We Need This?
- Most queries are simple and cheap to serve
- Expensive models are overkill for them
- Routing cuts cost dramatically

## Where Is It Used?
Cost-optimized LLM products.

## Do I Need to Master This?
🔴 Yes — routing is one of the biggest cost wins.

## In One Sentence
Model routing sends easy queries to cheap models and hard ones to strong models, cutting cost.

## What Should I Remember?
- Most traffic is simple — route it cheap
- Reserve strong models for hard queries
- Build the router without losing quality

## Common Beginner Confusion
Routing only helps if the router classifies correctly — bad routing regresses quality.

## What Comes Next?
Next: splitting prefill and decode across hardware.

---

# Disaggregated Prefill/Decode — NVIDIA Dynamo and llm-d

## Simple Definition
Prefill (reading the prompt) is compute-heavy; decode (generating) is memory-heavy. Running them on the same GPUs over-provisions both and wastes 20–40% of GPU time. Disaggregation runs prefill and decode on separate, right-sized resources for big efficiency gains.

## Imagine This...
Like separating a kitchen's prep station from its cooking line so neither bottlenecks the other.

## Why Do We Need This?
- Prefill and decode have opposite needs
- Combining them wastes GPU time
- Separating right-sizes each

## Where Is It Used?
Large-scale, cost-optimized serving.

## Do I Need to Master This?
🟢 Know the concept; advanced infra topic.

## In One Sentence
Disaggregating prefill and decode onto separate resources cuts the waste of running them together.

## What Should I Remember?
- Prefill = compute-bound; decode = memory-bound
- Colocating wastes 20–40% of GPU time
- Separate them to right-size resources

## Common Beginner Confusion
Prefill and decode aren't the same workload — one tool can't be optimal for both at once.

## What Comes Next?
Next: offloading cache to cheaper memory.

---

# vLLM Production Stack with LMCache KV Offloading

## Simple Definition
When GPU memory fills, requests get evicted and re-processed repeatedly, wasting compute. GPU memory can't be expanded, but cheap CPU RAM can hold "warm" KV cache. LMCache offloads KV cache to CPU memory so prompts aren't re-prefilled constantly.

## Imagine This...
Like keeping overflow files in a nearby cabinet instead of redoing the paperwork each time.

## Why Do We Need This?
- Full GPU memory causes re-prefill waste
- GPU memory can't grow; CPU RAM is cheap
- Offloading cache reclaims throughput

## Where Is It Used?
High-concurrency vLLM serving.

## Do I Need to Master This?
🟢 Know it; useful at high scale.

## In One Sentence
LMCache offloads KV cache to cheap CPU RAM so the GPU stops re-prefilling the same prompts.

## What Should I Remember?
- GPU eviction causes redundant re-prefill
- CPU RAM is cheap "warm" storage
- Offloading boosts goodput

## Common Beginner Confusion
You can't add GPU memory, but you *can* offload cache to system RAM to relieve pressure.

## What Comes Next?
Next: gateways that unify many providers.

---

# AI Gateways — LiteLLM, Portkey, Kong AI Gateway, Bifrost

## Simple Definition
When your product calls several providers (OpenAI, Anthropic, self-hosted), each has its own SDK, errors, and limits. An AI gateway consolidates them behind one API with failover, unified billing, observability, and per-tenant rate limits — instead of coupling every service to every provider.

## Imagine This...
Like a universal power adapter that lets one plug work in every country.

## Why Do We Need This?
- Multiple providers mean multiple SDKs
- Gateways add failover and unified control
- App code stays decoupled from providers

## Where Is It Used?
Multi-provider production apps.

## Do I Need to Master This?
🔴 Yes — gateways are standard production infrastructure.

## In One Sentence
An AI gateway unifies many model providers behind one API with failover and observability.

## What Should I Remember?
- One API in front of many providers
- Adds failover, billing, rate limits
- Keeps app code provider-agnostic

## Common Beginner Confusion
A gateway isn't just a proxy — it's where failover, limits, and observability live.

## What Comes Next?
Next: rolling out model changes safely.

---

# Shadow Traffic, Canary Rollout, and Progressive Deployment for LLMs

## Simple Definition
Flipping a new model straight to production risks cost spikes, worse answers, and angry users. Shadow mode tests it on real traffic invisibly, canary exposes it to a small slice, and progressive rollout (with fast flag-based rollback) catches problems before everyone sees them.

## Imagine This...
Like test-screening a movie with a small audience before the wide release.

## Why Do We Need This?
- New models can regress cost and quality
- Gradual rollout catches issues early
- Fast rollback limits damage

## Where Is It Used?
Safe model and prompt deployments.

## Do I Need to Master This?
🔴 Yes — safe rollout discipline prevents disasters.

## In One Sentence
Shadow, canary, and progressive rollout catch model regressions before all users are affected.

## What Should I Remember?
- Shadow tests invisibly on real traffic
- Canary exposes a small slice first
- Flag-based rollback should be instant

## Common Beginner Confusion
"Offline evals look good" doesn't mean production-ready — staged rollout is still essential.

## What Comes Next?
Next: proving changes with A/B tests.

---

# A/B Testing LLM Features — GrowthBook, Statsig, and the Vibes Problem

## Simple Definition
A prompt that "feels better" might do nothing for real metrics. Evals tell you if a model *can* do a task; only a controlled A/B test tells you if *users prefer* the output — and only if it has enough statistical power and controls for the model's randomness.

## Imagine This...
Like trusting taste-test data instead of just your own opinion about a new recipe.

## Why Do We Need This?
- "Feels better" isn't evidence
- Evals don't measure user preference
- A/B tests give real answers

## Where Is It Used?
LLM product decisions; prompt and model changes.

## Do I Need to Master This?
🟡 Learn it — how to prove changes actually help.

## In One Sentence
A/B testing measures whether users actually prefer an LLM change, beyond gut feel or evals.

## What Should I Remember?
- Evals ≠ user preference
- A/B tests need statistical power
- Control for LLM non-determinism

## Common Beginner Confusion
A change feeling better to you isn't proof — only a powered experiment shows real impact.

## What Comes Next?
Next: load testing that doesn't lie.

---

# Load Testing LLM APIs — Why k6 and Locust Lie

## Simple Definition
Standard load tests mislead for LLMs: sending identical prompts lets caching fake high capacity, and tools that see one HTTP connection miss the per-token streaming experience. You need LLM-aware load testing with realistic, varied prompts to know true capacity.

## Imagine This...
Like stress-testing a bridge with one repeated truck instead of real, varied traffic.

## Why Do We Need This?
- Identical prompts let caching fake capacity
- Streaming latency is invisible to basic tools
- You need realistic, varied load tests

## Where Is It Used?
Capacity planning for LLM serving.

## Do I Need to Master This?
🟡 Learn it before trusting any load test.

## In One Sentence
Standard load tests overstate LLM capacity unless they use varied prompts and track streaming latency.

## What Should I Remember?
- Identical prompts trigger misleading caching
- Track inter-token latency on streams
- Use varied, realistic prompts

## Common Beginner Confusion
Passing a load test with repeated prompts means little — real traffic is varied and harder.

## What Comes Next?
Next: operating AI systems reliably (SRE).

---

# SRE for AI — Multi-Agent Incident Response, Runbooks, Predictive Detection

## Simple Definition
When an AI system breaks at 3 a.m., the first 20 minutes of triage — grouping logs, correlating to deploys, matching runbooks — is now automatable with agents. SRE for AI applies site-reliability practices, with agents doing first-pass triage before a human even opens the dashboard.

## Imagine This...
Like a smart assistant that gathers all the clues before the detective arrives.

## Why Do We Need This?
- AI systems fail in new ways
- Early triage is slow but automatable
- Agents speed up incident response

## Where Is It Used?
On-call operations for AI systems.

## Do I Need to Master This?
🟡 Learn the practices for operating AI in production.

## In One Sentence
SRE for AI applies reliability practices, using agents to automate first-pass incident triage.

## What Should I Remember?
- AI adds new failure modes to operate
- First-pass triage can be automated
- Runbooks and predictive detection help

## Common Beginner Confusion
Reliability work doesn't disappear with AI — it grows, but agents can shoulder the early triage.

## What Comes Next?
Next: breaking things on purpose to find weaknesses.

---

# Chaos Engineering for LLM Production

## Simple Definition
Chaos engineering deliberately injects failures to find weaknesses before users do. LLM stacks have new ones: a poison character stalling the tokenizer, retry storms causing OOM, KV-cache eviction cascades. None show up in unit tests — chaos testing surfaces them.

## Imagine This...
Like a fire drill that reveals which exits are actually blocked.

## Why Do We Need This?
- LLM stacks have unique failure modes
- Unit tests miss them
- Chaos testing finds them first

## Where Is It Used?
Hardening production AI systems.

## Do I Need to Master This?
🟢 Know it; valuable for mature deployments.

## In One Sentence
Chaos engineering deliberately injects LLM-specific failures to find weaknesses before users do.

## What Should I Remember?
- Inject failures intentionally
- LLM failure modes are novel
- Discover them before users do

## Common Beginner Confusion
LLM-specific failures (tokenizer stalls, cache cascades) won't appear in normal tests.

## What Comes Next?
Next: securing keys, secrets, and user data.

---

# Security — Secrets, API Key Rotation, Audit Logs, Guardrails

## Simple Definition
AI systems leak in old and new ways: a committed `.env` exposes keys to git history forever; user prompts may contain PII (like an SSN) that gets forwarded to a provider against policy. This lesson covers secrets management, key rotation, audit logs, and guardrails.

## Imagine This...
Like locking up the master keys and shredding sensitive documents before they leave the building.

## Why Do We Need This?
- Leaked keys and PII are real risks
- Rotation must be fast and clean
- Guardrails prevent policy violations

## Where Is It Used?
Every production AI system.

## Do I Need to Master This?
🔴 Yes — security failures are costly and common.

## In One Sentence
AI security covers protecting secrets, rotating keys, auditing access, and masking sensitive data.

## What Should I Remember?
- Secrets in git history persist — rotate fast
- Mask PII before forwarding to providers
- Audit logs and guardrails are essential

## Common Beginner Confusion
Deleting a committed secret doesn't remove it from git history — you must rotate the key.

## What Comes Next?
Next: meeting compliance requirements.

---

# Compliance — SOC 2, HIPAA, GDPR, PCI-DSS, EU AI Act, ISO 42001

## Simple Definition
Enterprise customers demand compliance: SOC 2, HIPAA, GDPR, PCI-DSS, the EU AI Act, and more. This is largely an enterprise-SaaS problem with AI-specific overlays. Procurement wants a clear matrix of frameworks and controls, not a vague PDF.

## Imagine This...
Like a restaurant needing health, fire, and safety certificates before it can serve corporate clients.

## Why Do We Need This?
- Enterprises require compliance to buy
- Multiple frameworks apply at once
- AI adds specific overlays

## Where Is It Used?
Enterprise AI sales and deployment.

## Do I Need to Master This?
🟢 Know the major frameworks exist; specialists handle detail.

## In One Sentence
Compliance means meeting frameworks like SOC 2, HIPAA, GDPR, and the EU AI Act to sell to enterprises.

## What Should I Remember?
- Compliance gates enterprise deals
- Many frameworks overlap
- AI adds specific requirements (EU AI Act, ISO 42001)

## Common Beginner Confusion
Compliance is mostly enterprise-SaaS practice with AI add-ons — not unique to AI.

## What Comes Next?
Next: understanding and attributing your AI costs.

---

# FinOps for LLMs — Unit Economics and Multi-Tenant Attribution

## Simple Definition
A $40,000 bill is useless if you don't know which tenant, feature, or model spent it. FinOps for LLMs is about unit economics (cost per request/user) and attribution (who spent what), so you can price, optimize, and control AI spending.

## Imagine This...
Like an itemized utility bill instead of one mysterious lump sum.

## Why Do We Need This?
- Lump-sum bills hide what's costing money
- Attribution enables pricing and optimization
- Unit economics drive decisions

## Where Is It Used?
AI product pricing and cost management.

## Do I Need to Master This?
🟡 Learn it — crucial for running a profitable AI product.

## In One Sentence
FinOps for LLMs attributes AI spend by tenant and feature so you can price and optimize.

## What Should I Remember?
- Know cost per request, user, tenant
- Attribution enables smart pricing
- Track unit economics continuously

## Common Beginner Confusion
A total bill tells you nothing actionable — you need per-tenant, per-feature attribution.

## What Comes Next?
Next: choosing a self-hosted serving engine.

---

# Self-Hosted Serving Selection — llama.cpp, Ollama, TGI, vLLM, SGLang

## Simple Definition
Picking a self-hosted serving engine depends on hardware first, scale second, workload third. Ollama is great for local dev, vLLM for production throughput, llama.cpp for edge — and one 2025 event (TGI entering maintenance mode) shifts the default for new projects.

## Imagine This...
Like choosing a vehicle: a bike for errands, a van for deliveries, a truck for freight.

## Why Do We Need This?
- No engine is right for everything
- Hardware, scale, and workload decide
- Defaults shift over time

## Where Is It Used?
Any self-hosted LLM project.

## Do I Need to Master This?
🟡 Learn the decision tree to pick correctly.

## In One Sentence
Choose a serving engine by hardware, scale, and workload — there's no one-size-fits-all.

## What Should I Remember?
- Ollama = dev, vLLM = production, llama.cpp = edge
- Decide hardware → scale → workload
- TGI is now maintenance mode for new projects

## Common Beginner Confusion
"Which is best?" has no single answer — it depends entirely on your context.

## What Comes Next?
Phase 18 turns to ethics, safety, and alignment — making sure all this powerful infrastructure is used responsibly.

---

## Phase Summary

**What I learned.** How to take AI from prototype to production: where to host models, how serving engines (vLLM, SGLang, TensorRT-LLM) squeeze GPUs, the metrics that matter, cost levers (quantization, caching, batching, routing, disaggregation), observability, deployment discipline, load and chaos testing, security, compliance, and FinOps.

**What I should remember.** Inference cost and latency make or break an AI product. Caching, batching, routing, and quantization are the big cost levers. Serving is stateful — cache locality matters. Always measure percentiles and goodput, and roll out changes gradually.

**Most important lessons.** 🔴 vLLM Internals, Inference Metrics, Quantization, Observability, Prompt Caching, Model Routing, AI Gateways, Shadow/Canary Rollout, Security.

**Revisit later.** The hardware-deep lessons (EAGLE-3, TensorRT-LLM/Blackwell, disaggregation, LMCache) and compliance — return when you operate at scale or face enterprise requirements.

**Real-world applications.** Every production AI product — chat assistants, RAG systems, agent backends — and the cost/reliability work that keeps them viable.

**Interview relevance.** Very high for AI engineering and platform roles. vLLM internals, inference metrics, cost optimization (caching/routing/quantization), and safe deployment are common, differentiating topics few candidates can discuss well.
