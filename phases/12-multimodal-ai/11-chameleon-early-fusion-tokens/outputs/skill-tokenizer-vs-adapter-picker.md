---
name: tokenizer-vs-adapter-picker
description: VLM project向けに、Chameleon-style early fusion（shared-vocab tokenizer）とLLaVA-style late fusion（frozen LLM上のadapter）のどちらを選ぶか決める。
version: 1.0.0
phase: 12
lesson: 11
tags: [chameleon, early-fusion, vq-vae, late-fusion, adapter]
---

product specification（understanding-onlyまたはunderstanding+generation）、target image quality（social-post / magazine / print / broadcast）、cost budget（training + inference）を受け取り、concrete architecture outline付きでChameleon-familyまたはLLaVA-familyを推奨する。

出力するもの:

1. Verdict。Early-fusion（Chameleon / Emu3 / AnyGPT）またはlate-fusion（LLaVA / BLIP-2 / Qwen-VL）family。
2. Tokenizer pick（early-fusion verdictの場合）。VQ-VAE（Chameleon）、MAGVIT-v2、IBQ、SBER-MoVQGANのいずれか。expected reconstruction ceilingをPSNRで引用する。
3. Training-stability plan。scaleしたearly-fusion向けのQK-Norm、dropout placement、LayerNorm ordering。
4. Cost estimate。late-fusion alternativeと比べたtraining GPU-hoursとimageあたりinference latency。
5. Generation-quality ceiling。期待できるPSNR / FID range。productのquality barがdiscrete tokensで届くか、continuous（Transfusion-style）generationが必要か。
6. Migration path。userが成長してlate-fusionが制約になる（image outputが必要になる）場合、migrationはどう見えるか。

Hard rejects:
- understanding-only productにChameleon-styleを推奨すること。pure understandingではlate-fusionの方がsimple、cheap、higher-ceiling。
- production image generationにK<4096のVQ-VAEを提案すること。codebookが小さすぎ、artifactsが見える。
- early-fusion inferenceは無料だと主張すること。VQ decoderはgenerated imageごとに50-200msを追加し、しばしばLLM output timeを上回る。

Refusal rules:
- userがfrontier-quality image generation（FID < 15、print-ready）を求める場合、discrete tokensを拒否し、Transfusion / Stable Diffusion 3 / MMDiT（Lesson 12.13）を示す。
- productがimage outputを一切必要としない場合、early-fusionを拒否する。complexityに見合わない。
- userが既存のLlama / Qwen LLM weightsを差し込みたい場合、early-fusionを拒否する。fresh modelのpretrainingが必要。

Output: verdict、tokenizer pick、stability checklist、cost estimate、quality ceiling、migration pathを含む1ページplan。comparison readingとしてarXiv 2405.09818 (Chameleon)と2408.11039 (Transfusion)で締める。
