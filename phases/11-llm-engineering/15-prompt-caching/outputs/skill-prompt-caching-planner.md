---
name: prompt-caching-planner
description: cache-friendly な prompt layout を設計し、適切な provider caching mode を選ぶ。
version: 1.0.0
phase: 11
lesson: 15
tags: [llm-engineering, caching, cost]
---

prompt (system + tools + few-shot + retrieval + history + user) と usage profile (requests per hour、TTL needed、provider) が与えられたら、次を出力する:

1. Layout。section を並べ替え、single cache breakpoint を mark する。どの section が stable で、どれが volatile かを説明する。
2. Provider mode。Anthropic cache_control、OpenAI automatic、Gemini CachedContent のいずれか。TTL と reuse pattern から理由を述べる。
3. Break-even。TTL 内の expected reads per write。no-cache と比べた net cost を計算式付きで示す。
4. Verification plan。2回目の identical request で cache_read_input_tokens > 0 を CI で assert する。dashboard は cached と uncached tokens を分ける。
5. Failure modes。この setup で cache miss になる最もありそうな理由を3つ (dynamic timestamp、tool reorder、near-duplicate text) 挙げ、それぞれの防止策を書く。

dynamic field を breakpoint より上に置く cache plan は ship しない。reuse count が 2x write premium を回収できることを示さずに 1h TTL を有効にしない。
