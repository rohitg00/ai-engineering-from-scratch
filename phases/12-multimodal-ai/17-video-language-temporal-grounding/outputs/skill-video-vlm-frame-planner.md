---
name: video-vlm-frame-planner
description: video-language model deployment 向けに frame sampling、per-frame pooling、output format、benchmark targets を計画する。
version: 1.0.0
phase: 12
lesson: 17
tags: [video-vlm, temporal-grounding, tmrope, dynamic-fps, benchmarks]
---

video task (action recognition、temporal grounding、summarization、monitoring、agent-workflow replay) と deployment constraint (model context、latency budget、throughput) を受け取り、frame sampling と output の plan を出力する。

生成するもの:

1. Frame sampler の選択。steady content には uniform、mixed motion には dynamic-FPS、action-heavy には event-driven、cinematic には keyframe+context。
2. Per-frame pooling。high-detail には 2x2、default は 3x3、coverage が content density より重要な agent workflow には 4x4 または 6x6。
3. Temporal encoding。Qwen2.5-VL-family には TMRoPE、小型 model には learned temporal embedding、single-clip tasks には encoding なし。
4. Output format。grounding には `{event, start, end, confidence}` を持つ JSON、summarization には free text、mixed flows には token-delimited。
5. Benchmark plan。general には VideoMME、grounding には TempCompass、long-horizon には EgoSchema。expected accuracy tier を明記する。
6. Context / latency budget。Total tokens = duration * fps * tokens_per_frame。context の 40% を超える場合は警告する。

Hard rejects:
- action-heavy video に uniform sampling を提案すること。peak events を失う。
- downstream parsing で token-delimited output が JSON accuracy と同等だと主張すること。JSON の方が robust。
- 2026年に始まる project に Video-LLaMA を推奨すること。古い architecture はもはや competitive ではない。

Refusal rules:
- duration > 10 minutes かつ context < 32k の場合は拒否し、hierarchical summarization または agentic retrieval (Lesson 12.18) を推奨する。
- target accuracy が frontier (VideoMME で Gemini 2.5 Pro から2 points 以内) の場合は open 7B models を拒否し、32B+ または proprietary を要求する。
- 7B で > 30s clip に対して dynamic-FPS target > 8 の場合は latency の観点で拒否し、より低い cap を推奨する。

Output: sampler、pooling、temporal encoding、output format、benchmark targets、context estimate を含む1ページの frame plan。比較読解用に arXiv 2502.13923 (Qwen2.5-VL) と 2306.02858 (Video-LLaMA) で締める。
