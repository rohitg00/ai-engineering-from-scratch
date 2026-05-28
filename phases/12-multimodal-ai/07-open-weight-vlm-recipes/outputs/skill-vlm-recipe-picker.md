---
name: vlm-recipe-picker
description: open-weight VLM recipe (encoder、connector、LLM、data mix、resolution schedule) を選び、各選択に ablation-table citation を付ける。
version: 1.0.0
phase: 12
lesson: 07
tags: [vlm, mm1, idefics2, molmo, cambrian, prismatic, ablation]
---

task mix (OCR、chart、UI agent、reasoning、grounding)、compute budget (LLM params、training GPU hours、または inference latency target)、deployment constraint (edge、cloud、on-device) が与えられたら、citation 付きの完全な open-weight VLM recipe を出力する。

作成するもの:

1. Encoder pick。default は SigLIP 2 SO400m/14。grounding/segmentation が task mix に含まれる場合は DINOv2 ViT-g/14 と concat する。MM1 Table 3 と Cambrian-1 の vision encoder match-up を引用する。
2. Connector pick。token-constrained でない限り default は 2-layer MLP。token-constrained なら Q-Former 32 queries。connector ablation で delta が <1 point だった Prismatic VLMs を引用する。
3. LLM pick。budget に基づく。<10B なら Qwen2.5-7B、>30B なら Llama-3.1-70B または Qwen2.5-72B。70B を超える MMMU plateau を flag する。
4. Data mix。default は PixMo + ShareGPT4V + Cauldron。同じ token count で detailed-human-caption が distillation より +2-3 MMMU だった Molmo の結果を引用する。
5. Resolution schedule。default は dynamic (256-1280) と stage-1 fixed-384 alignment pretraining。AnyRes により DocVQA が +3-5 伸びた Idefics2 resolution ablation と、Qwen2.5-VL dynamic M-RoPE を引用する。
6. Training stages。Stage 1 projector-only、Stage 2 full fine-tune、Stage 3 task-specific。

Hard rejects:

- 新規 project の default encoder として CLIP ViT-L/14 を推奨しながら、SigLIP 2 に置き換わっていることを flag しないこと。
- Q-Former を MLP に対する quality gain として提案すること。これは token-budget lever であり、quality lever ではない。
- human-captioned alternatives が存在するのに、synthetic GPT-4V captions を primary training data として提案すること。Molmo を引用する。
- 実際には token count に由来する variance を connector architecture の効果だと主張すること。

Refusal rules:

- user が reasoning-heavy task 向けに 1-3B VLM を望む場合は拒否し、より大きい LLM を推奨する。reasoning ceiling は LLM が決める。
- user が detailed-human-caption data を確保できない場合は、expected 2-3 MMMU ceiling を明示し、best-effort distillation fallback を提示する。
- task mix に 4K+ document imagery が含まれ、deployment が frozen-encoder の場合は AnyRes を拒否し、Qwen2.5-VL のような native-resolution M-RoPE encoder を推奨する。

Output: per-axis pick、ablation citation (arXiv ID)、training stage plan、expected benchmark range を含む1ページの recipe card。最後に次に読む3本の ablation paper を示す: arXiv 2403.09611 (MM1)、2405.02246 (Idefics2)、2409.17146 (Molmo)。
