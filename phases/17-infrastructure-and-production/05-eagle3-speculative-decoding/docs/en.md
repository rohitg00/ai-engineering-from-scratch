# EAGLE-3 Speculative Decoding in Production

> Speculative decoding は fast draft model と target model を組み合わせます。draft が K tokens を提案し、target が single forward で verify します。accepted tokens は実質 free です。2026 年の production-grade variant は EAGLE-3 です。raw tokens ではなく target model の hidden states 上で draft head を training し、general chat で acceptance rate alpha を 0.6-0.8 帯へ押し上げます。正しい問いは「draft はどれだけ速いか」ではなく「自分の traffic で alpha はいくつか」です。alpha が約 0.55 を下回ると、高 concurrency では speculative decoding は net negative になります。rejected draft ごとに 2 回目の target forward pass が必要になるからです。この lesson では、先に alpha を測り、その後に flag を flip する方法を学びます。

**種別:** 学習
**言語:** Python (stdlib, toy acceptance-rate simulator)
**前提条件:** Phase 17 · 04 (vLLM Serving Internals), Phase 10 · 18 (Multi-Token Prediction)
**所要時間:** 約60分

## Learning Objectives

- speculative decoding の 3 世代を naming し、EAGLE-3 が EAGLE-2 と classic draft model から何を変えたか説明できる。
- acceptance rate alpha を定義し、alpha と K (draft length) から expected speedup を計算し、target concurrency の break-even alpha を特定できる。
- vLLM 2026 で speculative decoding が opt-in (default ではない) 理由と、alpha 測定なしに有効化することが production anti-pattern である理由を説明できる。
- measurement plan を書ける: どの benchmark、どの prompt distribution、どの concurrency point、どの metric で gate するか。

## 問題

decode は memory-bound です。H100 上の Llama 3.3 70B FP8 では、decoded token ごとに約 140 GB/s の weights を読み、1 token を emit します。decode 中の GPU compute はほぼ idle で、bottleneck は matmul throughput ではなく HBM bandwidth です。

Speculative decoding はこの gap を利用します。cheap draft model で K candidate tokens を生成し、target model に single forward pass で K 個すべてを verify させます。verified token は、target がどのみち行う batch-of-K forward に amortize されるため実質 free です。

classic draft-model approach は同じ family の smaller model を使います (Llama 3.2 1B が Llama 3.3 70B の draft を作るなど)。動きますが acceptance rate は mediocre です。smaller model distribution が target から diverge するからです。EAGLE、EAGLE-2、EAGLE-3 は、light draft head を target model の internal states 上で直接 training し、draft distribution を target にかなり近づけます。これが draft-model の alpha 0.4 を、EAGLE-3 で 0.6-0.8 へ上げる理由です。

catch: EAGLE-3 は vLLM 2026 では opt-in です。`speculative_config` を明示的に設定する必要があります。flag がなければ acceleration はありません。real traffic で alpha を測らずに有効化した team は、tail latency が悪化することもよくあります。

## The Concept

### speculative decoding が実際に買うもの

spec decode なしでは、per-token cost は target forward 1 回です。draft length K と acceptance alpha の spec decode では、target forward あたりの expected tokens は `1 + K * alpha` です。speedup は `(1 + K * alpha) / (1 + epsilon)` で、epsilon は draft-plus-verify overhead です。K=5、alpha=0.7 なら `(1 + 5*0.7) / (1 + 0.1) = 4.5 / 1.1 = 4.1x` です。real-world では production traffic で alpha がそこまで高くないこと、high batch size では epsilon が増えることから 2-3x に集まります。

### alpha が唯一重要な metric である理由

rejected token は消えません。最初の rejected token のために 2 回目の target forward を強制します。alpha が 0.4 に落ちる workload では、draft overhead、verification、reroll を支払います。high concurrency (例: 256 concurrent) では decode batch がすでに十分大きく、"target alone" と "target with verify" の memory-bandwidth gap は小さくなります。多くの 2026 hardware では alpha 0.55 未満で spec decode は net negative になります。

alpha は workload によって変わります。ShareGPT-style general chat では、ShareGPT で training した EAGLE-3 は 0.6-0.8 に達します。domain-specific traffic (code, medical, legal) では、general data で training した draft head は 0.4-0.6 に落ちます。domain-specific draft head を training すると alpha は戻ります。これは target finetuning と比べれば軽く速い training job です。

### EAGLE generations at a glance

- **Classic draft model**: 同じ family の small model。Alpha 0.3-0.5。infra は単純。2 models を load し、draft は target forward 1 回につき K forwards を走らせる。
- **EAGLE-1 (2024)**: target hidden states (last layer) 上で training した single draft head。Alpha 約 0.5-0.6。target 上の small param overhead。
- **EAGLE-2 (2025)**: adaptive draft length と tree-based drafts (1 target pass で multiple branches を verify)。Alpha 約 0.6-0.7。draft scheduler はより複雑。
- **EAGLE-3 (2025-2026)**: last layer だけでなく multiple target layers 上で draft head を training し、alignment を改善。general chat で alpha 約 0.6-0.8。

### 2026 production recipe

1. target model を plain に ship する。target concurrency で baseline TTFT、ITL、throughput を測る。
2. vLLM `speculative_config` で EAGLE-3 draft を有効化する。benchmark を再実行する。
3. acceptance rate alpha を log する。vLLM V1 は `spec_decode_metrics.accepted_tokens_per_request` として報告します。requested draft length で割ると alpha です。
4. production traffic distribution 上で alpha < 0.55 なら spec decode を disable するか、domain-specific EAGLE-3 draft を training する。
5. production concurrency で再実行し、P99 ITL が悪化していないことを確認する。

### production pitfall: P99 tail

spec decode では mean ITL は下がります。しかし tune しないと P99 が悪化することがあります。rejected drafts は two-pass sequence (draft + verify-fail + reroll) を発生させます。full batch ではこの 2 pass が serialize されます。P50 ではなく P99 ITL を見てください。

### EAGLE-3 がすでに使われている場所

Google は 2025 年に AI Overviews で speculative decoding を deploy しました (same quality, faster response)。vLLM V1 は documented interface として `speculative_config` を出荷しています。V1 の N-gram GPU speculative decoding は chunked prefill と互換な variant です。SGLang は prefix-heavy workload の recommended draft path として EAGLE-3 を support しています。

### break-even math in one line

Expected speedup: `S(alpha, K) = (1 + K*alpha) / (1 + verify_overhead)`。`S = 1` と置くと alpha は `alpha_breakeven = verify_overhead / K` です。typical verify_overhead ~0.15、K=5 なら `alpha_breakeven = 0.03` です。ただしこれは raw decode math です。high concurrency では verify overhead が上がり、decode batch がすでに sequences 間で memory reads を amortize しているため、effective alpha_breakeven は実務上 ~0.45-0.55 まで上がります。

### speculative decoding を使わない方がよい場合

- latency が問題でない batch-1 offline generation。plain target を使う。
- very short outputs (50 tokens 未満)。draft overhead と verify cost が支配する。
- domain-trained draft head がない specialized domains。alpha が低すぎる。
- vLLM v0.18.0 + draft-model spec decode + `--enable-chunked-prefill`。この組み合わせは compile しません。documented exception は V1 の N-gram GPU spec decode です。

## Use It

`code/main.py` は alpha values と draft length K の範囲で、speculative decoding あり/なしの decode loop を simulate します。break-even alpha、measured speedup、tail behavior を出力します。複数の (alpha, K) combination で走らせると、speculative decoding がどこで割に合わなくなるかが明確に見えます。

## Ship It

この lesson は `outputs/skill-eagle3-rollout.md` を生成します。target model、traffic distribution description、concurrency target が与えられると、staged EAGLE-3 rollout plan を作ります。baseline benchmark、config enable、alpha measurement、alpha >= 0.55 gate、P99 ITL watch を含みます。

## Exercises

1. `code/main.py` を実行してください。K=5 で 2x speedup に必要な alpha はいくつですか。3x ではどうですか。verify_overhead にどれだけ敏感ですか。
2. production traffic が 70% general chat、30% code に分かれるとします。ShareGPT で training した EAGLE-3 は general chat で alpha 0.7、code で alpha 0.4 です。blended alpha はいくつで、spec decode は net-positive ですか。
3. vLLM `speculative_config` documentation を読んでください。3 つの mode (draft model, EAGLE, N-gram) と、chunked prefill と互換なのはどれかを naming してください。
4. EAGLE-3 有効化後、mean ITL は 25% 下がったが P99 ITL は 15% 上がりました。診断し、mitigation を提案してください。
5. Llama 3.3 70B 用 EAGLE-3 draft head の memory cost を計算してください。classic draft として Llama 3.2 1B を動かす場合と比べてどうですか。

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Speculative decoding | 「draft plus verify」 | cheap model が K tokens を提案し、target forward 1 回で K 個すべてを verify する |
| Acceptance rate alpha | 「spec accept rate」 | draft token のうち target が accept した割合。唯一重要な metric |
| Draft length K | 「spec k」 | target forward ごとに draft が提案する tokens 数。typical 4-8 |
| Verify overhead epsilon | 「spec overhead」 | plain target forward と比べた verify-and-reroll の extra cost。batch とともに増える |
| EAGLE-3 | 「latest EAGLE」 | 2025-2026 variant。multiple target layers 上で draft head を training。general chat で alpha 0.6-0.8 |
| `speculative_config` | 「vLLM spec config」 | vLLM V1 の explicit opt-in。default なし = acceleration なし |
| N-gram spec decode | 「N-gram draft」 | prompt 内の N-gram lookup を使う GPU-side draft。chunked-prefill-compatible |
| Break-even alpha | 「no-op alpha」 | spec decode の speedup が 0 になる alpha。production concurrency で見る |
| Rejected-draft two-pass | 「reroll cost」 | draft reject 時に target forward が 2 回になること。P99 tail を押し上げる |

## 参考文献

- [vLLM — Speculative Decoding docs](https://docs.vllm.ai/en/latest/features/spec_decode/) — V1 の `speculative_config` と chunked-prefill compatibility の authoritative source。
- [vLLM Speculative Config API](https://docs.vllm.ai/en/latest/api/vllm/config/speculative/) — exact field set。
- [EAGLE paper (arXiv:2401.15077)](https://arxiv.org/abs/2401.15077) — original EAGLE draft-head formulation。
- [EAGLE-2 paper (arXiv:2406.16858)](https://arxiv.org/abs/2406.16858) — adaptive drafts and trees。
- [UC Berkeley EECS-2025-224](https://www2.eecs.berkeley.edu/Pubs/TechRpts/2025/EECS-2025-224.html) — speculative decoding を含む efficient LLM system。
- [BentoML — Speculative Decoding](https://bentoml.com/llm/inference-optimization/speculative-decoding) — production rollout checklist。
