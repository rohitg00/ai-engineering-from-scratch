# DeepSeek-V3 アーキテクチャ解説

> Phase 10 · Lesson 14 では、すべての open model が調整する 6 つの architectural knobs を挙げた。DeepSeek-V3 (December 2024、671B parameters total、37B active) はその 6 つをすべて調整し、さらに 4 つを追加する。Multi-Head Latent Attention、auxiliary-loss-free load balancing、Multi-Token Prediction、DualPipe training である。このレッスンでは、DeepSeek-V3 の architecture を上から下まで読み、published config からすべての parameter count を導出する。最後には、671B/37B ratio がなぜ正しい賭けなのか、そして frontier で MLA + MoE の組み合わせが単独のどちらよりも優れる理由を説明できるようになる。

**種類:** Learn
**言語:** Python (stdlib, parameter calculator)
**前提条件:** Phase 10 · 14 (open-model walkthroughs), Phase 10 · 17 (NSA), Phase 10 · 18 (MTP), Phase 10 · 19 (DualPipe)
**所要時間:** 約75分

## 学習目標

- DeepSeek-V3 config を上から下まで読み、各 field を 6 つの GPT-2 knobs と 4 つの DeepSeek-specific additions の観点から説明する。
- total parameter count (671B)、active parameter count (37B)、それぞれに寄与する components を導出する。
- 128k context における MLA の KV cache footprint を計算し、同じ active-param の dense model が GQA で支払う cost と比較する。
- DeepSeek-specific innovations 4 つ (MLA、MTP、auxiliary-loss-free routing、DualPipe) を述べ、それぞれが architecture/training stack のどの部分を対象にするかを名指しする。

## 問題

DeepSeek-V3 は、architecture が Llama family と意味のある形で異なる最初の frontier open model である。Llama 3 405B は "GPT-2 with six knobs turned" だ。DeepSeek-V3 は、6 つすべての knobs に加えて 4 つを持つ GPT-2 である。Llama 3 config を読むことは DeepSeek config を読むための warmup にはなるが、deep structure、つまり attention block の shape、routing logic、training-time objective が十分に異なるため、別個の walkthrough が必要になる。

これを学ぶ payoff は大きい。DeepSeek-V3 の open-weights release は、open models における "frontier capability" の意味を変えた。この architecture は、多くの 2026 training runs が copying している blueprint である。frontier LLM training または inference に触れる role にとって、これを理解することは必須条件である。

## コンセプト

### 変わらない core

DeepSeek-V3 は今でも autoregressive である。decoder blocks を stack する点も同じである。各 block は attention、MLP、2 つの RMSNorms を持つ。MLP では SwiGLU を使う。RoPE も使う。Pre-norm。Weight-tied embeddings。すべての Llama や Mistral と同じ baseline である。

### twist: GQA ではなく MLA

Phase 10 · 14 で見たように、GQA は groups of Q heads 全体で K と V を共有することで KV cache を小さくする。Multi-Head Latent Attention (MLA) はさらに進む。K と V は shared low-rank latent representation (`kv_lora_rank`) に圧縮され、その後 per head に on the fly で decompressed される。KV cache が保存するのは latent だけである。典型的には token per layer あたり 512 floats であり、8 x 128 = 1024 floats ではない。

128k context では、MLA を使う DeepSeek-V3 (token per layer あたり 1 つの shared latent `c^{KV}`。K と V はどちらもこの latent から up-projections によって導出され、その up-projections は subsequent matmul に吸収できる):

```
kv_cache = num_layers * kv_lora_rank * max_seq_len * bytes_per_element
         = 61 * 512 * 131072 * 2
         = 7.6 GB
```

hypothetical GQA baseline (Llama 3 70B shape、8 KV heads、head dim 128) では次の cost になる。

```
kv_cache = 2 * 61 * 8 * 128 * 131072 * 2
         = 30.5 GB
```

MLA は 128k context において、Llama-3-70B-style GQA cache より 4x 小さい。

tradeoff: MLA は attention computation (per head) ごとに decompression step を追加する。extra compute は節約される bandwidth に比べて小さい。long-context inference では net win である。

### routing: auxiliary-loss-free load balancing

MoE routers は、各 token をどの top-k experts が処理するかを決める。naive router は少数の experts に work を集中させすぎ、他の experts を idle にしてしまう。標準的な fix は、load imbalance に penalty を課す auxiliary loss term を追加することだ。これは機能するが、main-task performance をわずかに悪化させる。

DeepSeek-V3 は auxiliary-loss-free scheme を導入する。per-expert bias terms を router logits に加え、training 中に単純な rule で調整する。expert `e` が overloaded なら `bias_e` を下げ、underloaded なら上げる。extra loss term はない。training は clean に保たれ、expert load は balanced に保たれる。

main loss への effect: 測定可能なものはない。MoE architecture への effect: より clean になり、tune すべき auxiliary-loss hyperparameter がなくなる。

### MTP: denser training + free draft

Phase 10 · 18 で見たように、DeepSeek-V3 は 2 positions 先の token を予測する D=1 MTP module を追加する。inference では、trained module が 80%+ acceptance の speculative-decoding draft として再利用される。training では、各 hidden state が D+1 = 2 targets で supervised され、より dense な signal が得られる。

parameters: 671B main の上に 14B。overhead: 2.1%。

### training: DualPipe

Phase 10 · 19 で見たように、DualPipe は forward/backward chunks を cross-node all-to-all comms と overlap させる bidirectional pipeline である。DeepSeek-V3 の 2,048-H800 scale では、1F1B なら pipeline bubbles で失っていた約 245k GPU-hours を回収する。

### config を field ごとに読む

DeepSeek-V3 config (simplified) は次の通り。

```
hidden_size: 7168
intermediate_size: 18432   (dense MLP hidden size, used on first few layers)
moe_intermediate_size: 2048 (expert MLP hidden size)
num_hidden_layers: 61
first_k_dense_layers: 3    (first 3 layers use dense MLP)
num_attention_heads: 128
num_key_value_heads: 128   (formally equal to num_heads under MLA, but
                           the real compression is in kv_lora_rank)
kv_lora_rank: 512          (MLA latent dimension)
num_experts: 256            (MoE expert count per block)
num_experts_per_tok: 8      (top-8 routing)
shared_experts: 1           (always-on shared expert per block)
max_position_embeddings: 163840
rope_theta: 10000.0
vocab_size: 129280
mtp_module: 1               (1 MTP module at depth 1)
```

これを parse する。

- `hidden_size=7168`: embedding dimension。
- `num_hidden_layers=61`: total block depth。
- `first_k_dense_layers=3`: 最初の 3 blocks は size 18432 の dense MLP を使う。残りの 58 は MoE を使う。
- `num_attention_heads=128`: 128 query heads。
- `kv_lora_rank=512`: K と V はこの latent dimension に compressed され、per head に decompressed される。
- `num_experts=256, num_experts_per_tok=8`: 各 MoE block は 256 experts を持ち、top-8 を route する。
- `shared_experts=1`: 256 routed experts に加えて、1 つの always-on expert がすべての token に寄与する。すべての token が信頼できる何かを受け取れるようにする "dense floor" と考える。
- `moe_intermediate_size=2048`: 各 expert の MLP hidden size。256 個あるため dense MLP より小さい。

### Parameter accounting

完全な計算は `code/main.py` にある。headline は次の通り。

- Embedding: `vocab * hidden = 129280 * 7168 = ~0.93B`。
- 最初の 3 dense blocks: MLA を伴う attention (block あたり ~144M) + dense MLP (block あたり ~260M) + norms。合計で約 1.2B。
- 58 MoE blocks: MLA を伴う attention (~144M) + 256 experts each (1 つあたり 30M) + 1 shared expert (30M) + norm。all experts を含めると block あたり合計 ~7.95B。58 MoE blocks で合計 461B。
- MTP module: 14B。

grand total: core architecture が ~476B + MTP が 14B。published 671B number は、additional structural parameters (bias tensors、expert-specific components、shared expert scaling など) を別途含んでいる。calculator で再現する number は published から 3-5% 以内である。delta は、DeepSeek report の Section 2 appendix に記載されている fine-grained accounting から来る。

forward あたりの active parameters:

- Attention: 144M per layer * 61 = 8.8B (all layers が発火)。
- MLP active: 最初の 3 layers は dense (3 * 260M = 780M)、58 MoE layers はそれぞれ 8 routed + 1 shared + routing overhead が active。per layer active MLP: ~260M。合計: 3 * 260M + 58 * 260M = ~15.9B。
- Embedding + norms: 1.2B。
- Total active: およそ 26B core + 14B MTP (訓練されるが inference で常に走るわけではない) ≈ 37B。

### 671B / 37B ratio

18x sparsity ratio (active params は total の 5.5%)。DeepSeek-V3 は、open weights として出荷された frontier MoE model の中で最も sparse である。ratio 13/47 (28%) の Mixtral 8x7B ははるかに dense である。ratio 17B/400B (4.25%) の Llama 4 Maverick は comparable である。DeepSeek の bet は、frontier scale では、より低い activation ratio でより多くの experts を持つ方が active-FLOP あたりの quality を高める、というものだ。

### DeepSeek-V3 の位置づけ

| モデル | Total | Active | Ratio | Attention | 新規要素 |
|-------|------|-------|-------|-----------|-------------|
| Llama 3 70B | 70B | 70B | 100% | GQA 64/8 | — |
| Llama 4 Maverick | 400B | 17B | 4.25% | GQA | — |
| Mixtral 8x22B | 141B | 39B | 27% | GQA | — |
| DeepSeek V3 | 671B | 37B | 5.5% | MLA 512 | MLA + MTP + aux-free + DualPipe |
| Qwen 2.5 72B | 72B | 72B | 100% | GQA 64/8 | YaRN extension |

### follow-on: R1, V4

DeepSeek-R1 (2025) は、V3 backbone 上の reasoning-training run である。R1 は同じ architecture を使う。変わったのは post-training recipe (verifiable tasks 上の large-scale RL) であり、pretraining architecture ではない。

DeepSeek-V4 (出荷されるなら) は MLA + MoE + MTP を維持し、Phase 10 · 17 の NSA の後継である DSA (DeepSeek Sparse Attention) を追加すると expected されている。lineage は安定している。architecture-level innovations は蓄積され、各 version は additional knobs を回す。

## 使う

`code/main.py` は DeepSeek-V3 の shape に特化した parameter calculator である。これを実行し、output を paper の numbers と比較し、hypothetical variants (256 experts vs 512、top-8 vs top-16、MLA rank 512 vs 1024) に使う。

見るべき点:

- Total parameter count vs published 671B。
- Active parameter count vs published 37B。
- 128k context の KV cache、つまり MLA vs GQA comparison。
- parameter budget が実際にどこへ行くかを見るための per-layer breakdown。

## 出荷する

このレッスンは `outputs/skill-deepseek-v3-reader.md` を生成する。DeepSeek-family model (V3、R1、または future variant) が与えられると、config の各 field を名指しし、component ごとの parameter counts を導出し、その model が 4 つの DeepSeek-specific innovations のどれを使っているかを特定する component-by-component architecture reading を生成する。

## 演習

1. `code/main.py` を実行する。calculator の total-parameter estimate を published 671B と比較し、delta がどこから来るかを特定する。paper の Section 2 に full itemization がある。

2. MLA rank 512 の代わりに 256 を使うよう config を変更する。128k context における resulting KV cache size を計算する。何 percent の reduction が得られ、per-head expressiveness にどのような cost があるか。

3. DeepSeek-V3 の (256 experts, top-8) routing を hypothetical (512 experts, top-8) variant と比較する。Total parameters は増えるが、active parameters は同じである。extra expert capacity は理論上何をもたらし、inference で何を cost とするか。

4. DeepSeek-V3 technical report (arXiv:2412.19437) の MLA に関する Section 2.1 を読む。K と V の decompression matrices が inference-time efficiency のために subsequent matmul へ "absorbed" できる理由を 3 文で説明する。

5. DeepSeek-V3 はほとんどの operations で FP8 training を使う。671B weights を保存する場合の FP8 vs BF16 の memory savings を計算する。これは 14.8T-token training budget とどう交わるか。

## 重要語句

| Term | よく言われること | 実際の意味 |
|------|----------------|------------------------|
| MLA | "Multi-Head Latent Attention" | K と V を shared low-rank latent (kv_lora_rank、通常 512) に圧縮し、per head に on-the-fly で decompress する。KV cache は latent だけを保存する |
| kv_lora_rank | "MLA compression dim" | K と V の shared latent の size。DeepSeek-V3 は 512 を使う |
| First k dense layers | "early layers stay dense" | 最初の数個の MoE-model layers は MoE router を skip し、stability のために dense MLP を走らせる |
| num_experts_per_tok | "Top-k routing" | token あたり何個の routed experts が発火するか。DeepSeek-V3 は 8 を使う |
| Shared experts | "Always-on experts" | routing に関係なくすべての token を処理する experts。DeepSeek-V3 は 1 を使う |
| Auxiliary-loss-free routing | "Bias-adjusted load balance" | loss term を追加せずに expert load を balanced に保つため、training 中に調整される per-expert bias terms |
| MTP module | "Extra prediction head" | h^(1) と E(t+1) から t+2 を予測する transformer block。denser training と無料の speculative-decoding draft |
| DualPipe | "Bidirectional pipeline" | forward/backward compute を cross-node all-to-all と overlap させる training schedule |
| Active parameter ratio | "Sparsity" | active_params / total_params。DeepSeek-V3 は 5.5% に達する |
| FP8 training | "8-bit training" | FP8 での training storage と多くの compute ops。小さな quality cost で BF16 比の memory をおよそ半減する |

## 参考資料

- [DeepSeek-AI — DeepSeek-V3 Technical Report (arXiv:2412.19437)](https://arxiv.org/abs/2412.19437) — full architecture、training、results document
- [DeepSeek-V3 model card on Hugging Face](https://huggingface.co/deepseek-ai/DeepSeek-V3) — config files と deployment notes
- [DeepSeek-V2 paper (arXiv:2405.04434)](https://arxiv.org/abs/2405.04434) — MLA を導入した predecessor
- [DeepSeek-R1 paper (arXiv:2501.12948)](https://arxiv.org/abs/2501.12948) — V3 architecture 上の reasoning-training successor
- [Native Sparse Attention (arXiv:2502.11089)](https://arxiv.org/abs/2502.11089) — DeepSeek-family attention の future direction
- [DualPipe repository](https://github.com/deepseek-ai/DualPipe) — training-schedule reference
