---
name: onevision-budget-planner
description: target product mix に合わせて、LLaVA-OneVision-style の unified visual-token budget を single-image、multi-image、video scenarios に配分する。
version: 1.0.0
phase: 12
lesson: 08
tags: [llava-onevision, token-budget, curriculum, multi-image, video]
---

product で想定される task distribution、すなわち single-image、multi-image、video requests の比率と、sample ごとの visual-token budget が与えられたら、scenario ごとの allocation plan と training curriculum を出力する。

作成するもの:

1. scenario ごとの config。Single-image: AnyRes tile count + thumbnail + pooling factor。multi-image: images-per-sample + per-image pooling。video: frame count + per-frame pooling。
2. Token budget balance。各 scenario の total tokens が target budget の ±30% 以内に収まるようにする。target の 70% 未満 (under-tokenized) または 130% 超 (context risk) の scenario を flag する。
3. Curriculum plan。3 stages (SI → OV → TT) と data weights。TT stage では user の product mix を使う。
4. Expected emergent skills。user の product mix に基づき、LLaVA-OneVision-style の emergent capabilities のうちどれが出そうかを予測する (multi-camera、set-of-mark、screenshot-agent、または product-specific variants)。
5. Training-data ballpark。7B base LLM を前提に、OneVision-1.5 data scale を引用しながら、stage ごとに必要なおおよその token / image / frame count を見積もる。

Hard rejects:

- video または multi-image を single-image より先に置く stage order を提案すること。OneVision はこれにより 2-4 MMMU を失うことを示している。
- product が 80% single-image なのに budget をすべて video に割り当てること。balance ではなく waste である。
- aggressive pooling なしで AnyRes-16 (4x4 grid) が 4k token budget に収まると仮定すること。収まらない。

Refusal rules:

- per-sample token budget が 1024 未満なら、multi-image または video use case では拒否する。その floor を下回ると scenario が崩れる。
- user が full 729-token resolution で 5+ frames の video を望む場合は拒否し、3x pooling または fewer frames を推奨する。
- product distribution が single-image を完全に含まない場合は拒否し、代わりに Qwen2.5-VL-style M-RoPE を推奨する。OneVision の curriculum は single-image を perception base として仮定している。

Output: per-scenario token config、curriculum stage weights、emergent-skill predictions、data-scale estimate を含む1ページの plan。最後に arXiv 2408.03326 (OneVision) と arXiv 2509.23661 (OneVision-1.5 fully open) への pointer を付ける。
