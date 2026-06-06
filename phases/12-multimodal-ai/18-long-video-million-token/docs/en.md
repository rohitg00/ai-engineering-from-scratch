# Long-Video Understanding at Million-Token Context

> A 1-hour 4K video at 24 FPS, patched and embedded, produces on the order of 60 million tokens. A 2-hour podcast episode transcribed is 30,000 tokens. A full Blu-ray feature film, even compressed with aggressive pooling, is hundreds of thousands of tokens. Google's Gemini 1.5 (March 2024) opened this era with a 10-million-token context, doing reliable needle-in-a-haystack recall over hour-long videos. LWM (Liu et al., February 2024) showed ring attention's scaling path. LongVILA and Video-XL scaled ingestion further. VideoAgent swapped raw context for agentic retrieval. Each approach is a different trade-off on compute, recall, and engineering complexity. This lesson reads them side by side.

**Type:** Build
**Languages:** Python (stdlib, needle-in-haystack simulator + agentic-retrieval router)
**Prerequisites:** Phase 12 · 17 (video temporal tokens)
**Time:** ~180 minutes

## Learning Objectives

- Compute total visual-token counts for long-form video at varying FPS and pooling.
- Explain the three scaling paths: brute context (Gemini 1.5), ring attention (LWM), token compression (LongVILA / Video-XL).
- Compare raw-context video VLMs vs agentic-retrieval video VLMs (VideoAgent) on accuracy and latency.
- Design a needle-in-a-haystack test for a 30-minute video and measure recall at a specific minute.

## The Problem

A single frame of Qwen2.5-VL-sized patches at 384 native resolution is ~729 tokens. At 3x3 pooling that's 81 tokens per frame. A 30-minute clip at 1 FPS = 1800 frames = 145,800 tokens. Doable by 2025 open VLMs, tight. At 2 FPS, 291,600 tokens — only the biggest contexts fit.

A 2-hour movie at 1 FPS is 583k tokens. Beyond most 2026 open models; requires Gemini 2.5 Pro or pooling more aggressively.

Three scaling paths emerged.

## The Concept

### Path 1: Brute context (Gemini 1.5, Claude Opus)

Throw hardware at the problem. Scale context to millions of tokens, process everything in one forward pass.

Gemini 1.5 Pro launched with 1M tokens; Gemini 1.5 Ultra to 10M; Gemini 2.5 Pro in 2026 does hours of video reliably. The paper (arXiv:2403.05530) documents needle-in-a-haystack recall at 99.7% up to ~9.5M tokens.

Engineering: a custom attention implementation with memory hierarchy (local + global + sparse) plus MoE expert routing for long-context efficiency. Not published in full detail. Not open-source.

### Path 2: Ring attention (LWM, LongVILA)

Ring attention distributes long sequences across devices in a "ring" where each device holds a chunk. Attention across the full sequence happens by each device sending its chunk to the next in a ring pattern, computing partial attention, and aggregating.

LWM (Liu et al., 2024) trained a 1M-token context model this way. Training compute scales linearly with context, not quadratically — the quadratic hit on attention is amortized across the ring's devices.

LongVILA (arXiv:2408.10188) adapted the pattern to VLMs. 1400-frame videos at 192 tokens per frame = 268k context, trained with ring attention across 8-way parallelism.

### Path 3: Token compression (Video-XL, LongVA)

Cheaper than brute context: compress aggressively before the LLM sees the sequence.

Video-XL (arXiv:2409.14485) uses a visual summary token: each clip of N frames produces a single "summary" token that attends over the N. At inference, the LLM sees one summary token per clip, drastically shrinking the context.

LongVA extends LLM context from 200k to 2M with a "long context transfer" technique. Train on long-context text, transfer to long-context video via shared representation.

Token compression trades off recall at specific timestamps for scalability. The model knows generally what happened but sometimes misses exact frames.

### Path 4: Agentic retrieval (VideoAgent)

Do not feed the full video to the LLM. Instead, treat the video as a database and use an LLM to query it.

VideoAgent (arXiv:2403.10517):

1. LLM reads the question.
2. LLM asks a retrieval tool for relevant clips ("show me segments with a cat").
3. Tool returns matching clip timestamps.
4. LLM reads those clips via a VLM.
5. LLM composes the answer or asks follow-up queries.

This is the LLM-as-agent pattern applied to long video. Cheaper inference (only relevant clips encoded), harder engineering (retrieval quality becomes the bottleneck).

### Needle-in-a-haystack benchmarks

The standard long-context test: insert a unique visual or textual marker at a random point in the video, then ask a query that requires recalling it.

Metric: Recall@k across video length and marker position.

Gemini 2.5 Pro scores >99% recall at up to 90-minute videos. Open 72B models (Qwen2.5-VL-72B, InternVL3-78B) score ~85-90% at 30 minutes and degrade past 60.

VideoAgent can match or beat raw-context models at 2+ hours because retrieval hits the needle if the tool is good.

### Which path to pick

For a 15-minute clip at frontier accuracy: open 72B + native context usually works. Pick Qwen2.5-VL-72B.

For 30-minute to 1-hour content: LongVILA or Video-XL for open; Gemini 2.5 Pro for closed. The quality bar matters — frontier goes closed.

For 2+ hour content: VideoAgent or similar retrieval patterns. Alternatively, summarize to smaller chunks and feed hierarchical summaries.

### 2026 production pattern

In practice, production long-video pipelines are hybrid:

1. Run dynamic-FPS sampling + aggressive pooling on the entire video (get a 100k-token global representation).
2. Pass to a 72B VLM for a global summary.
3. If user asks detailed questions, run agentic retrieval using the summary as an index.

This combines brute-context for global understanding and retrieval for local detail.

## Use It

`code/main.py`:

- Computes token budgets for videos from 1 minute to 3 hours at varying FPS + pooling.
- Simulates a needle-in-a-haystack run: inject a marker at a random timestamp, ask a question, score recall.
- Includes an agentic-retrieval router simulator that picks specific clips to feed to a downstream VLM.

Run the budget table and feel the scale gap.

## Ship It

This lesson produces `outputs/skill-long-video-strategy-planner.md`. Given a video duration and query complexity, it picks between brute-context, compression, and agentic retrieval, and computes the latency + quality expectations.

## Exercises

1. A 45-minute lecture at 1 FPS, 81 tokens per frame. Total tokens? Fits in which models' contexts?

2. Design a needle-in-a-haystack test: at what minute do you inject the marker, and what is the exact query format?

3. Compare brute-context Qwen2.5-VL-72B (80k context) to VideoAgent (Claude 3.5 + retrieval) on a 1-hour video. Which wins on recall? Which wins on latency?

4. Ring attention's memory cost scales linearly in sequence length and linearly in device count. Explain why and what fails if you drop the ring-rotation phase.

5. Read Gemini 1.5 Section 5 on needle-in-a-haystack. What did the paper find about recall at the 1M vs 10M token boundary?

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Brute context | "Just more tokens" | Scale LLM context to millions of tokens; process everything in one pass |
| Ring attention | "LWM-style parallel" | Distributed attention pattern where each device holds a chunk and rotates |
| Token compression | "Summary tokens" | Reduce per-clip tokens via a learned compressor before the LLM |
| Needle-in-haystack | "NIH test" | Insert a unique marker at a random point, ask model to recall it at test time |
| Agentic retrieval | "LLM as query planner" | LLM asks a retrieval tool for relevant clips, reads them via a VLM, composes answer |
| VideoAgent | "Retrieval pattern for video" | Canonical agentic-retrieval design: question -> tool -> clip -> answer |

## Further Reading

- [Gemini Team — Gemini 1.5 (arXiv:2403.05530)](https://arxiv.org/abs/2403.05530)
- [Liu et al. — LWM / RingAttention (arXiv:2402.08268)](https://arxiv.org/abs/2402.08268)
- [Xue et al. — LongVILA (arXiv:2408.10188)](https://arxiv.org/abs/2408.10188)
- [Shu et al. — Video-XL (arXiv:2409.14485)](https://arxiv.org/abs/2409.14485)
- [Wang et al. — VideoAgent (arXiv:2403.10517)](https://arxiv.org/abs/2403.10517)
