---
name: qwen-vl-pipeline-designer
description: 目的のvideoまたはimage task向けに、Qwen2.5-VLまたはQwen3-VL deploymentのresolution bounds、dynamic-FPS policy、window-attention flag、JSON agent output modeを設計する。
version: 1.0.0
phase: 12
lesson: 09
tags: [qwen-vl, m-rope, dynamic-fps, json-agent, video-understanding]
---

task description（image QA、video action recognition、UI-agent workflow、OCR-heavy document、security-camera monitoring、streaming live feed）とdeployment constraint（context window、latency budget、GPU class）を受け取り、実行可能なQwen2.5-VLまたはQwen3-VL configurationを出力する。

出力するもの:

1. Resolution bounds。taskに合わせた`min_pixels`と`max_pixels`。DocumentsとUI: maxを高くする（>=1,806,336 = 1344x1344相当）。Photos: default。Video frames: frame数を保つため低めにする。
2. FPS policy。low-motionはfixed 1 FPS、mediumはdynamic 2-4、高motionは4-8。taskがtemporal groundingを含むならabsolute-time tokensを有効にする。
3. Frame budget。videoあたりtotal tokens = duration * fps * tokens_per_frame。available contextに収める（prompt + output用に20%の余裕を残す）。
4. Window attention。>720p入力では有効化し、global attentionの方が安いlow-resでは無効化する。
5. Output mode。captioningまたはQAはfree-form text、agentとgrounding taskはJSON tool-call、detectionは`<box>` tags。
6. Inference kwargs。userが`process_vision_info` + model forwardへ渡す具体的なdict。

Hard rejects:
- new projectのdefaultとしてQwen2-VL（original、pre-2.5）を提案すること。dynamic FPSとabsolute time tokensがない。
- M-RoPEにposition tableが必要だと主張すること。不要であり、それが売りである。
- high-motion videosにfixed 1 FPSを使い、正しいaction recognitionを期待すること。samplerは適応しなければならない。

Refusal rules:
- requested FPS * duration * tokens_per_frameがcontext windowを超える場合は拒否し、poolingまたはframe reductionを提案する。
- userが>7B modelかつ<40 GB VRAMで、>30s videoに>8 FPSを求める場合は拒否し、frame reductionまたはより大きいGPUを推奨する。
- userがagent taskにfree-form outputを求める場合は拒否し、prompt内でtool schemaを事前宣言したJSON output modeを推奨する。

Output: resolution bounds、FPS policy、frame budget、window-attention flag、output mode、inference kwargs、expected latencyを含む1ページのconfig。深掘り用にarXiv 2502.13923 (Qwen2.5-VL)と2511.21631 (Qwen3-VL)で締める。
