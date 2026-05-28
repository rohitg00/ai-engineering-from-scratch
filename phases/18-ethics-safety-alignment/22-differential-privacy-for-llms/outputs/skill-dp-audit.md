---
name: dp-audit
description: language-model deployment に対する differential-privacy claim を監査する。
version: 1.0.0
phase: 18
lesson: 22
tags: [differential-privacy, dp-sgd, lora, mia, pmixed]
---

language-model deployment に関する privacy claim が与えられたら、その claim を監査する。

作成するもの:

1. (ε, δ) values。使われた ε と δ は何か。それらを計算した accountant は何か (Moments Accountant, Rényi DP, GDP)。accountant のない ε は意味を持たない。
2. DP target。DP guarantee は full model に対するものか、adapter (LoRA) に対するものか。LoRA の場合、base-model memorization は covered ではない。
3. MIA protocol。membership-inference は canaries (Duan 2024) で test されたか、extraction (Carlini 2021, Nasr 2025) で test されたか。Kowalczyk et al. 2025 によれば、この2つは異なるものを測る。
4. Confidence-exposure check。deployment は confidence scores を公開しているか。公開しているなら DP Reversal via LLM Feedback attack が適用される。追加の truncation / quantization が必要。
5. Alternative-mechanism comparison。PMixED や DP-synthetic-data は検討されたか。特定の threat model では、これらの alternative がより良い utility を与える場合がある。

Hard rejects:
- ε, δ pair と accountant のない DP claim。
- canary MIA だけに基づく DP claim。
- DP Reversal に対処せず confidence scores を公開している deployment。

Refusal rules:
- ユーザーが「epsilon=8 は十分安全か」と尋ねたら、数値だけの答えは拒否する。safety は threat model と most-extractable-data distribution に依存する。
- ユーザーが LLM deployment に推奨される ε を尋ねたら、普遍的な数値 target は拒否する。candidate ranges を議論する前に threat model、data sensitivity、utility constraints、accountant details を要求する。

出力: 5つの section を埋めた1ページの監査。accountant や MIA evaluation の欠落を flag し、最も価値の高い remediation を名指しする。Abadi et al. 2016 (DP-SGD) と Kowalczyk et al. 2025 をそれぞれ一度引用する。
