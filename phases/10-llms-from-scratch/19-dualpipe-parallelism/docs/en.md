# DualPipe Parallelism

> DeepSeek-V3 は、MoE experts を node 全体に散らした状態で 2,048 基の H800 GPU 上で訓練された。cross-node expert all-to-all communication は、compute 1 GPU-hour ごとに comm 1 GPU-hour を要する規模だった。GPU は半分の時間 idle になっていた。DualPipe (DeepSeek, Dec 2024) は、forward と backward の computation を、それらが発生させる all-to-all comms と重ねる bidirectional pipeline である。bubbles は減り、throughput は上がる。そして model-parameter copies を 2 つ保持すること、つまり名前の由来である "dual" は、Expert Parallelism がすでに experts を ranks 全体へ分散している状況では安く済む。このレッスンは、DualPipe が実際に何をしているのか、また Sea AI Lab の DualPipeV 改良が、ごくわずかに大きい bubble と引き換えに 2x parameter cost を取り除く理由を解説する Learn 型 walkthrough である。

**種類:** Learn
**言語:** Python (stdlib, schedule simulator)
**前提条件:** Phase 10 · 05 (distributed training, FSDP, DeepSpeed), Phase 10 · 14 (open-model architectures and MoE)
**所要時間:** 約60分

## 学習目標

- DualPipe の forward-backward chunk を構成する 4 つの components と、それぞれに固有の overlap window がある理由を挙げる。
- 大規模環境での pipeline bubble problem を説明し、"bubble-free" が marketing 上の表現ではなく実務上何を意味するかを説明する。
- 8 PP ranks と 16 micro-batches の DualPipe schedule を手で追跡し、forward stream と reverse stream が互いの idle slots を埋めることを確認する。
- DualPipeV (Sea AI Lab, 2025) の tradeoff を述べる。Expert Parallelism が inactive のとき、わずかに大きな bubble と引き換えに 2x parameter replication をなくす。

## 問題

671B MoE model を 2k H800 GPUs 上で訓練すると、3 つの bottlenecks が重なって発生する。

1. **Memory pressure。** 各 GPU は model の slice を保持する。61 layers、128 heads、sequence 8k の activation memory は膨大である。
2. **Pipeline bubbles。** 従来の pipeline parallelism (GPipe, 1F1B) では、各 stage が input や gradient を待つあいだ GPU が idle になる。8 stages では、1F1B scheduling を使っても GPU time のおよそ 12% が bubble になり得る。
3. **Cross-node all-to-all。** expert parallelism を伴う MoE は experts を nodes 全体に散らす。すべての forward pass は、tokens を experts に dispatch する all-to-all と、結果を combine するもう 1 つの all-to-all を発生させる。2k GPUs では、これは容易に compute-to-comm ratio 1:1 になる。

それぞれには別々の解決策がある。memory には gradient checkpointing、pipeline bubbles には Zero Bubble (Sea AI Lab, 2023)、all-to-all には expert-parallel comm kernels である。DualPipe が行うのは、それらを協調させることだ。schedule は単一の forward-backward chunk 内で compute と comm を overlap させ、pipeline の両端から micro-batches を同時に投入し、その結果得られる schedule を使って all-to-all を compute windows の内側に隠す。

報告された結果は、pipeline bubbles のほぼ解消と、DeepSeek-V3 の 14.8T-token training run における 95% 超の GPU utilization である。

## コンセプト

### Pipeline parallelism の復習

N-layer model を P devices に分割する。device `i` は layers `i * N/P .. (i+1) * N/P - 1` を保持する。micro-batch は devices 0 から P-1 へ forward に流れ、その後 P-1 から 0 へ backward に流れる。各 device は、前段の device が output を送ってきたときだけ forward stage を開始でき、下流の device が upstream gradient を送ってきたときだけ backward を開始できる。

GPipe (Huang et al., 2019) は micro-batch を 1 つずつ schedule するため、GPU time の大半を浪費する。1F1B (Narayanan et al., 2021) は複数の micro-batches について forward と backward passes を interleave する。Zero Bubble (Qi et al., 2023) は backward pass を 2 つ、backward-for-input (B) と backward-for-weights (W) に分割し、それらを bubble を埋めるよう schedule する。Zero Bubble 後の pipeline はほぼ詰まっている。

DualPipe は次の一歩である。そこに 2 つの ideas を追加する。

### Idea 1: chunk decomposition

各 forward chunk は 4 つの components に分割される。

- **Attention。** Q/K/V projections、attention、output projection。
- **All-to-all dispatch。** tokens を experts に送る cross-node communication。
- **MLP。** MoE expert computation。
- **All-to-all combine。** expert outputs を戻す cross-node communication。

backward chunk には、これらそれぞれの gradient versions が加わる。DualPipe は、all-to-all dispatch が次の chunk の attention compute と並行して起き、all-to-all combine が後続 chunk の MLP compute と並行して起きるように schedule する。

### Idea 2: bidirectional scheduling

ほとんどの pipeline schedules は stage 0 から micro-batches を投入し、stage P-1 に向けて流す。DualPipe は両端から micro-batches を投入する。Stage 0 はそこを起点とする forward micro-batches を見て、stage P-1 も同じくそこを起点とする forward micro-batches を見る。2 つの streams は中央で出会う。

これを成立させるには、device `i` が early-pipeline layer `i` と late-pipeline layer `P - 1 - i` の両方を保持しなければならない。これが DualPipe の "dual" の部分である。各 device は、自分が各 direction を処理するために必要な model layers を 2 copies 保持する。DeepSeek-V3 の scale では、これは 2x parameter replication cost になる。ただし Expert Parallelism がすでに MoE experts をかなり薄く分散しているため、non-expert layers を 2 回 replicate することは大きな負担ではない。

重要なのは、一方向の forward stream と反対方向の backward stream が、single-direction schedule なら bubbles になっていた場所でちょうど overlap することだ。bubbles は消える。

### 手で追う schedule

P = 4 ranks、8 micro-batches を考える。4 forward / 4 reverse に分かれている。time は左から右へ進み、rows は device ranks である。

```
           Time →
rank 0:  F1 F2 F3 F4  F5R F6R F7R F8R  B1 B2 B3 B4  ...
rank 1:     F1 F2 F3  F4/F5R F6R F7R   B1 B2 ...
rank 2:        F1 F2  F3/F5R F4/F6R    B1 ...
rank 3:           F1  F2/F5R F3/F6R    ...
```

"F4/F5R" という表記は、rank 1 が同じ time slot で micro-batch 4 の forward (pipeline を左から右へ進む) と micro-batch 5 の forward (右から左へ進む) を実行していることを意味する。これが operational な意味での "bidirectional" である。

rank 2 では cross streams がより早く overlap し、rank 0 と P-1 では最も遅く overlap する。schedule の安定した中間 phase では、すべての rank が X direction の forward と Y direction の backward を overlap して実行する。compute は埋まっている。forward pass の all-to-all dispatches は backward compute の中に隠れ、all-to-all combines は forward compute の中に隠れる。bubbles は押し出される。

### Bubble accounting

標準的な 1F1B pipeline bubble (rank あたりの wasted time):

```
bubble_1F1B = (P - 1) * forward_chunk_time
```

Zero Bubble refinement はこれを下げるが、ゼロにはしない。DualPipe は stable phase において、micro-batch count が pipeline depth の 2 倍で割り切れるなら bubble がゼロになる。stable phase の外側 (warmup と cooldown) にはいくらか bubble があるが、micro-batches の数とともに増えない。これが paper の強調する key property である。

marketing の言葉では "bubble-free"。technical には、bubbles が micro-batch count とともに増えないという意味である。Sea AI Lab の follow-up analysis (DualPipeV / Cut-in-half) は、完全な zero-bubble が成り立つのは Expert Parallelism が bottleneck でない場合だけだと示している。EP-driven all-to-all がある場合、何らかの scheduling compromise は常に存在する。

### DualPipeV — refinement

Sea AI Lab (2025) は、EP comm overlap が目的でない場合、2x parameter replication は無駄だと観察した。彼らの DualPipeV schedule は bidirectional injection を、single parameter copy 上で動く "V-shape" schedule に折りたたむ。bubble は DualPipe より少し大きいが、memory savings は大きい。DeepSeek は open-source DualPipe implementation において、EP-off mode として DualPipeV を採用した。

tradeoff は次の通り。

| 特徴 | DualPipe | DualPipeV | 1F1B | Zero Bubble |
|---------|---------|-----------|------|------------|
| device あたりの parameter copies | 2 | 1 | 1 | 1 |
| micro-batches に対する bubble | 一定 | 小さく増加 | 増加 | 増加 |
| Compute-comm overlap | 完全 | 部分的 | 最小限 | 部分的 |
| 使う場面 | EP-heavy MoE | dense or EP-light | baseline | どの pipeline でも |

### 14.8T-token run にとっての意味

DeepSeek-V3 の pre-training は、2,048 H800 GPUs 上で 14.8T tokens を消費し、およそ 2.8M GPU-hours を要した。naive 1F1B なら、その 12-15% が pipeline bubbles に失われていたはずである。340-420K GPU-hours、full 70B model を訓練できる量である。DualPipe はその大半を回収した。internal logs がなければ contribution を直接定量化するのは難しいが、paper は training 全体の平均 GPU utilization が 95% 超だと主張している。

より小さな runs (1k GPUs 未満) では、DualPipe は過剰である。pipeline bubbles は total cost に対して小さく、dense-model training では all-to-all bottleneck に達することがまれだからだ。multi-thousand GPU scale の frontier MoE training では、実質的に必須である。

### stack 内での位置づけ

- **FSDP** (Phase 10 · 05) と補完関係にある。FSDP は model parameters を ranks 全体に shard し、DualPipe は compute を ranks 全体に schedule する。両者は組み合わせられる。
- **ZeRO-3** gradient sharding と compatible である。two-copy replication の bookkeeping は、ZeRO の sharded gradients と協調する必要がある。
- specific cluster topology に tuned された **custom all-to-all kernels** が必要である。DeepSeek の open-source kernels が reference implementation である。

## 使う

`code/main.py` は pipeline schedule simulator である。`(P, n_micro_batches, schedule)` を受け取り、1F1B、Zero Bubble、DualPipe、DualPipeV それぞれについて stable-phase utilization を print する。これは teaching tool である。numbers は papers の qualitative claims と一致するが、production measured speedup に関する主張ではない。

この simulator の価値は、異なる P と micro-batch counts で動かし、1F1B では bubble fraction が増える一方で DualPipe では増えない様子を観察できることにある。

実際の training run での integration considerations:

- micro-batch count をきれいに割り切る pipeline-parallel depth を選ぶ。
- expert-parallel mesh が bidirectional all-to-all を support していることを確認する。DeepSeek の kernels が reference である。
- 初回は schedule 自体の debugging に 1 週間ほど費やす覚悟をする。bookkeeping は細かい。
- aggregate だけでなく、rank ごとの GPU utilization を monitor する。DualPipe の benefit は stragglers を詰めることから生まれる。

## 出荷する

このレッスンは `outputs/skill-dualpipe-planner.md` を生成する。training cluster specification (GPU count、topology、interconnect、model shape) が与えられると、pipeline parallelism strategy、使用する scheduling algorithm、target scale で期待される bubble fraction を推奨する。

## 演習

1. `(P=8, micro_batches=16, schedule=dualpipe)` と `(P=8, micro_batches=16, schedule=1f1b)` で `code/main.py` を実行する。GPU utilization difference を計算し、training 100 万 tokens あたりに回収される GPU-hours として表す。

2. `(P=4, micro_batches=8, schedule=dualpipe)` の schedule table を手で sketch する。各 time slot に micro-batch ID と direction を記す。bubbles が存在しない最初の time slot を特定する。

3. DeepSeek-V3 technical report (arXiv:2412.19437) の Figure 5 を読む。DualPipe forward chunk 内の all-to-all dispatch の overlap window を特定する。compute schedule がそれをどのように隠すかを説明する。

4. P=8 pipeline stages の 70B dense model と、P=16 pipeline stages の 671B MoE model について、DualPipe の 2x parameter overhead を計算する。MoE case の overhead が proportionally に小さい理由を示す。ほとんどの parameters は experts であり、大きな EP group 全体に sharded されているためである。

5. DualPipe を Chimera (2021 年の competing bidirectional scheduler) と比較する。paper の Section 3.4 を reference として、DualPipe が追加し、Chimera にはなかった 2 つの specific properties を特定する。

## 重要語句

| Term | よく言われること | 実際の意味 |
|------|----------------|------------------------|
| Pipeline bubble | "rank あたりの idle time" | pipeline stage が input または gradient を待つために浪費される GPU cycles |
| 1F1B | "default pipeline schedule" | one forward / one backward を interleave する scheduling。DualPipe が上回る baseline |
| Zero Bubble | "Sea AI Lab 2023" | backward を B (input gradient) と W (weight gradient) に分割する。pipeline をほぼ完全に詰める |
| DualPipe | "DeepSeek-V3 schedule" | bidirectional pipeline + compute-comm overlap。bubbles が micro-batch count とともに増えない |
| DualPipeV | "Cut-in-half" | 少し大きな bubbles と引き換えに 2x parameter replication をなくす V-shape refinement |
| Chunk | "pipeline work の単位" | 1 つの micro-batch が 1 つの pipeline stage を通過する forward または backward pass |
| All-to-all dispatch | "tokens を experts に送る" | tokens を割り当てられた MoE experts に route する cross-node comm |
| All-to-all combine | "expert outputs を戻す" | MLP 後に expert outputs を gather する cross-node comm |
| Expert Parallelism (EP) | "GPUs 全体に experts" | MoE experts を ranks 全体に shard し、異なる GPUs が異なる experts を保持する |
| Pipeline Parallelism (PP) | "GPUs 全体に layers" | model layers を ranks 全体に shard する。DualPipe が schedule する dimension |
| Bubble fraction | "wasted GPU time" | (bubble_time / total_time)。DualPipe がゼロへ近づける fraction |

## 参考資料

- [DeepSeek-AI — DeepSeek-V3 Technical Report (arXiv:2412.19437), Section 3.3.2 and Figure 5](https://arxiv.org/abs/2412.19437) — primary DualPipe reference
- [DeepSeek — DualPipe GitHub repository](https://github.com/deepseek-ai/DualPipe) — DualPipeV (Cut-in-half) mode を含む open-source reference implementation
- [Qi et al. — Zero Bubble Pipeline Parallelism (arXiv:2401.10241, Sea AI Lab 2023)](https://arxiv.org/abs/2401.10241) — Zero Bubble predecessor
- [Sea AI Lab — DualPipe could be better without the Dual](https://sail.sea.com/blog/articles/63) — DeepSeek の EP-off mode に影響した DualPipeV analysis
- [Narayanan et al. — PipeDream / 1F1B (arXiv:1806.03377, 2018-2021)](https://arxiv.org/abs/1806.03377) — DualPipe が比較対象にする 1F1B schedule
- [Huang et al. — GPipe (arXiv:1811.06965, 2018)](https://arxiv.org/abs/1811.06965) — original pipeline parallelism paper と bubble problem
