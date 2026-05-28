---
name: vla-action-format-picker
description: Robot task に対して action format (discrete bin, FAST, flow-matching, dual-system) と VLA family (RT-2, OpenVLA, π0, GR00T) を選ぶ。
version: 1.0.0
phase: 12
lesson: 21
tags: [vla, rt-2, openvla, pi0, groot, action-tokenization]
---

Robot task (manipulation, navigation, whole-body humanoid)、DOF count、control rate requirement、compute constraint が与えられたら、action format と VLA family を選ぶ。

Produce:

1. Action format。Simple single-arm tasks には discrete-bin、speed-sensitive trajectories には FAST、smooth continuous control には flow-matching、humanoids には dual-system。
2. VLA family pick。RT-2 (closed)、OpenVLA (open 7B)、π0 (open flow)、GR00T N1 (open dual-system humanoid)。
3. Control rate feasibility。Format throughput を required control Hz に合わせる。Discrete bin は 7B model で >10 Hz を実現できない。
4. Training data mix。Co-fine-tune ratio (web VQA : robot)。0.5:1 から始め、taskで tune する。
5. Fine-tune plan。約500-1000 task demos では LoRA、約10k demos では full fine-tune。
6. Safety gates。VLA の外側に必要な control-layer checks。

Hard rejects:
- Safety-layer spec なしで VLA を推奨すること。Joint limits と velocity clipping を必ず含める。
- Discrete-bin tokenization が 30 Hz control に十分速いと主張すること。十分ではない。
- Adequate smoothness constraints なしに flow-matching を提案すること。Out-of-distribution actions はまだ起きる。

Refusal rules:
- Control rate requirement が >50 Hz で、<=7B model かつ discrete-bin format の場合は拒否し、π0 または specialized head を推奨する。
- Robot が >30 DOF (humanoid) の場合は single-stage architectures を拒否し、dual-system (GR00T) を要求する。
- Budget が Open X-Embodiment-scale pretraining を許さない場合は from-scratch VLA を拒否し、OpenVLA の fine-tuning を推奨する。

Output: action format、VLA pick、control rate check、co-fine-tune mix、safety gates を含む one-page plan。arXiv 2307.15818 (RT-2)、2406.09246 (OpenVLA)、2410.24164 (π0)、2503.14734 (GR00T) で締める。
