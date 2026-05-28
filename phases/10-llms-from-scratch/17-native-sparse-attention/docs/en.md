# Native Sparse Attention (DeepSeek NSA)

> 64k tokens では、attention が decode latency の 70-80% を食う。どの open-model lab もこれを直す計画を持っている。DeepSeek の NSA (ACL 2025 best paper) は、その中で定着した方式だ。3 つの parallel attention branches、つまり compressed coarse-grained tokens、選択的に保持された fine-grained tokens、local context 用の sliding windows を、learned gate で結合する。hardware-aligned (kernel-friendly) で、natively trainable (inference 時に後付けするのではなく pre-training で機能する) であり、64k decode では full attention の品質に並ぶか上回りながら FlashAttention より速く動く。このレッスンでは 3 つの branches をエンドツーエンドで構築し、なぜ sparsity がエンドツーエンドで differentiable なのかを示す。

**種類:** Build
**言語:** Python (stdlib)
**前提条件:** Phase 7 · 12 (KV cache, flash-attention), Phase 7 · 15 (attention variants), Phase 10 · 16 (differential attention)
**所要時間:** 約60分

## 学習目標

- NSA の 3 つの attention branches と、それぞれが捉えるものを述べる。
- 以前の sparse-attention 手法が inference-only だったのに対し、NSA が「natively trainable」である理由を説明する。
- 64k context における NSA と full attention の attention compute savings を、compression block size と selection top-k の関数として計算する。
- 短い synthetic sequence 上で stdlib Python による three-branch combination を実装し、gating weights が妥当に振る舞うことを検証する。

## 問題

sequence length N の full attention は、時間が `O(N^2)`、layer ごとの KV cache が `O(N)` かかる。64k tokens では、compute と memory bandwidth の数字が破滅的になる。NSA paper の理論見積もりでは、64k における total decode latency の 70-80% を attention が占める。下流のすべて、つまり TTFT、tokens/sec、cost per million tokens は attention cost に支配される。

Sparse attention は明らかな答えだ。従来の試みは 2 つの bucket に分かれる。Fixed-pattern sparsity (sliding-window、strided、block-local) は情報を捨て、long-range recall tasks で失敗する。Inference-time sparsity (KV cache pruning、H2O、StreamingLLM) は dense attention で pre-trained された model に適用されるため、潜在的な speedup の一部しか回収できない。model が sparse pattern を通じて情報を routing するよう訓練されていないからだ。

Native Sparse Attention (Yuan et al., DeepSeek + PKU + UW, ACL 2025 best paper, arXiv:2502.11089) はその両方を行う。model が pre-training 中に学ぶ sparsity pattern を、inference で実際に compute savings をもたらす kernel-aligned algorithm として実装する。2 年後には、NSA またはその直系の後継が、あらゆる frontier long-context model の default attention になっているだろう。

## コンセプト

### 3 つの parallel branches

各 query について、NSA は KV cache の 3 つの異なる view に対して attention を 3 回実行する。

1. **Compressed branch.** Tokens は size `l` (典型的には 32 または 64) の blocks にまとめられる。各 block は小さな learned MLP によって 1 つの summary token に圧縮される。query はこれらの compressed tokens に attend し、sequence 全体の coarse-grained view を得る。

2. **Selected branch.** compressed branch の attention scores を使い、現在の query に最も関連する top-k blocks を特定する。それらの blocks から fine-grained (uncompressed) tokens を読み出し、query はそのすべてに attend する。compressed-branch attention を selection の routing signal と考えればよい。

3. **Sliding-window branch.** query は local context のため、直近の `W` tokens (典型的には 512) に attend する。この branch は、他の 2 つが見逃す可能性のある structure-heavy な short-range patterns (syntax、local coreference) を捉える。

3 つの branch outputs は、position ごとの learned gate で結合される。

```
out = g_cmp * out_cmp + g_sel * out_sel + g_win * out_win
```

`g_cmp, g_sel, g_win` は query 上の小さな MLP から得られる gate weights である。合計が 1 である必要はない。branches を独立に重み付けできる。

### これが「natively trainable」である理由

selection step (top-k blocks) は discrete である。Discrete operations は gradient flow を壊す。従来の sparse-attention work は selection 経由の backprop を省略する (training を制限する) か、inference で本物の sparsity を与えない continuous relaxations を使っていた。

NSA はこれを迂回する。compressed-branch attention そのものが、sequence 全体に対する differentiable coarse-grained attention である。top-k operation は、compressed branch から得た上位の attention scores を再利用して、どの fine-grained blocks を load するかを選ぶだけだ。gradients は compressed-branch scores を通って流れる。この scores は compressed output と selection logic の両方に影響する。また、selected blocks の final output への寄与も differentiable である。non-differentiable な `top_k` operation は forward computational graph 上では no-op であり、memory からどの blocks を load するかだけを制御する。

これが、NSA を pre-training でエンドツーエンドに使える理由である。model は 3 つの branches を通じた情報 routing を jointly に学び、inference で約束どおりの speedup を実際にもたらす sparse pattern を生成する。

### Hardware-aligned kernel

NSA の kernel は modern GPU memory hierarchies 向けに設計されている。kernel は GQA groups ごとに queries を load し (outer loop)、group ごとに対応する sparse KV blocks を fetch し (inner loop)、SRAM 上で attention を実行する。各 query group は同じ selected blocks を見るため (selection は per-query-head ではなく per-query-group)、KV loads は group 全体で amortize される。Arithmetic intensity は高く保たれる。

paper は、Triton kernels が 64k decodes で FlashAttention より 9x 速く動き、speedup ratio は sequence length とともに増加すると報告している。Forward kernels と backward kernels の両方が提供されている。

### compute budget

`N` を sequence length、`l` を compression block size、`k` を top-k selection count、`w` を sliding window、`b` を selected block size (典型的には `l` と同じ) とする。

- Compressed branch: query ごとに `O(N/l)` keys なので、total は `O(N * N / l)`。
- Selected branch: query ごとに `O(k * b)` keys なので、`O(N * k * b)`。
- Sliding branch: query ごとに `O(w)` keys なので、`O(N * w)`。

Total: `O(N * (N/l + k*b + w))`。

`N = 64k, l = 64, k = 16, b = 64, w = 512` の場合、per-query cost は `1000 + 1024 + 512 = 2536 keys` である。Full attention は `64000 keys`。compute reduction は 25x になる。

`N = 128k, l = 64, k = 16, b = 64, w = 512` の場合、per-query cost は `2000 + 1024 + 512 = 3536 keys` である。Full attention は `128000 keys`。reduction は 36x。sequence length が伸びるほど利点が大きくなる。そこが要点だ。

### 比較

| 方法 | 微分可能 | 実際の inference speedup | Long-range recall |
|--------|---------------|----------------------|-------------------|
| Sliding window only | はい | はい | 失敗する |
| Strided / block-sparse | はい | はい | 部分的 |
| KV pruning (H2O, StreamingLLM) | N/A (inference-time) | はい | 部分的 |
| MoBA (Moonshot) | 部分的 | はい | 良好 |
| NSA | はい (natively) | はい (64k で 9x) | full attention に匹敵 |

MoBA (Moonshot, arXiv:2502.13189) は同時期に公開され、one より three のほうがよいという似た approach をとり、MoE principle を attention blocks に適用する。NSA と MoBA は、2026 年の long-context pre-training で知っておくべき 2 つの architectures である。

## 作る

`code/main.py` は短い synthetic sequence 上で 3 つの branches を実装し、次を示す。

- compression MLP (教育上の明快さのため simple mean-pool baseline を使う。実際の NSA は learned MLP を使う)。
- compressed-branch scores によって駆動される top-k block selection。
- 最後の `w` tokens に対する sliding-window attention。
- gated combination。
- full attention と比較する compute-count printout。

### Step 1: tokens を blocks に圧縮する

```python
def compress(K, l):
    n = len(K)
    n_blocks = (n + l - 1) // l
    out = []
    for b in range(n_blocks):
        start, end = b * l, min((b + 1) * l, n)
        block = K[start:end]
        summary = [sum(row[d] for row in block) / len(block) for d in range(len(K[0]))]
        out.append(summary)
    return out
```

### Step 2: compressed-branch attention

query を compressed keys に対して softmax attention する。compressed-branch scores は top-k selection の signal も兼ねる。

### Step 3: top-k block selection

score が最も高い `k` 個の compressed blocks の indices を選ぶ。それらの blocks から元の uncompressed tokens を load し、その tokens に対して attention を実行する。

### Step 4: sliding-window attention

最後の `w` tokens を取り、それらに対して standard attention を実行する。

### Step 5: gate + combine

query 上の小さな MLP が 3 つの gate weights を生成する。final output は 3 つの branch outputs の weighted sum である。

### Step 6: compute counting

branch ごと、および total の query あたり attended keys 数を print する。`N` (full attention) と比較する。`l = 32, k = 4, w = 128` の 1024-token synthetic では、NSA は query ごとに `32 + 128 + 128 = 288` keys を見ればよく、full attention の 1024 に対して 3.5x 少ない。

## 使う

NSA は DeepSeek 自身の long-context pre-training pipeline に投入されている。2026 年 4 月時点の public inference stacks での integration status は次の通り。

- **DeepSeek internal**: native。published weights は NSA またはその successor である DSA (Deepseek Sparse Attention) を使う。
- **vLLM**: DeepSeek-V3.x weights 向けの experimental NSA support が開発中。
- **SGLang**: NSA benchmarks は公開済み。production path は vLLM に続く。
- **llama.cpp / CPU**: unsupported。kernel decomposition の overhead は CPU throughput では割に合わない。

NSA を選ぶべき場合:

- 64k-plus context を狙う pre-training または continued-training run で、十分な compute budget がある。
- DeepSeek 自身の long-context checkpoints の inference。weights は NSA-native である。

選ぶべきでない場合:

- 既存の dense-attention pre-trained model を serving する場合。continued training なしに NSA を retrofit することはできない。
- context が 16k 未満の場合。three-branch overhead が savings を上回る。
- Batch-1 interactive chat。latency-sensitive decode は恩恵を受けるが、long contexts の場合に限られる。

## 出荷する

このレッスンは `outputs/skill-nsa-integrator.md` を生成する。long-context pre-training run specification が与えられると、NSA integration plan を生成する。compression block size、top-k、sliding window、gate MLP width、kernel choice、そして architecture change を正当化する specific long-context evals を含む。

## 演習

1. `code/main.py` を 1024-token synthetic で実行する。`(l, k, w)` を 3 つの presets にわたって sweep し、compute counts を print する。needle-in-haystack test で full attention に対して 95% recall を保ちながら、query あたりの key-count が最も低い preset を特定する。

2. mean-pool compressor を tiny learned MLP (2-layer, hidden 32) に置き換える。signal が block の average である synthetic task で訓練する。held-out data 上で mean-pool baseline に対する perplexity gap を測定する。

3. gate MLP を実装する。query を input として受け取り、3 つの scalars を output する。gate が妥当に振る舞うことを示す。random queries ではほぼ uniform weighting、query が far-back block に当たる場合は selected branch に大きな weight を置く。

4. 128k context の NSA-enabled 70B model について、KV cache memory budget を計算する。KV heads は 8、head dim は 128、BF16。full attention および MLA (Phase 10 · 14 で MLA の数字を示した) と比較する。NSA の fine-grained branch KV cache が full attention と等しくなる sequence length を特定する。

5. NSA paper (arXiv:2502.11089) の Section 4 を読み、separate routing score を計算するのではなく compressed branch の attention scores を top-k selection に再利用する理由を 3 文で説明する。答えを gradient flow と結びつける。

## 重要用語

| 用語 | よく言われる表現 | 実際の意味 |
|------|----------------|------------------------|
| Compressed branch | 「粗い view」 | global context を query あたり O(N/l) keys で提供する、block-averaged keys への attention |
| Selected branch | 「Top-k blocks」 | compressed-branch scores が最も高い `k` blocks に対する fine-grained attention |
| Sliding window | 「local context」 | short-range patterns 用に最後の `W` tokens へ行う attention |
| Native trainability | 「sparsity を有効にして pre-train する」 | sparsity pattern が inference で後付けされるのではなく pre-training 中に学習されること |
| Compression block size l | 「coarse view の group size」 | 1 つの summary に merge される token 数。典型値は 32-64 |
| Top-k | 「保持する blocks」 | uncompressed tokens が読まれる compressed blocks の数。典型値は 16 |
| Sliding window W | 「local attention の半径」 | 典型値は 512。短すぎると local coherence が落ち、長すぎると compute を浪費する |
| Branch gate | 「3 つをどう混ぜるか」 | 3 つの branches の contributions を重み付けする per-position MLP output |
| Hardware alignment | 「kernel-friendly な sparsity」 | 実際の GPU kernel が theoretical speedup を達成できるように選ばれた sparse pattern |
| DSA | 「NSA の後継」 | DeepSeek の系譜で NSA の後に続く architecture、Deepseek Sparse Attention |

## 参考文献

- [Yuan et al. — Native Sparse Attention: Hardware-Aligned and Natively Trainable Sparse Attention (arXiv:2502.11089, ACL 2025 Best Paper)](https://arxiv.org/abs/2502.11089) — 元論文
- [DeepSeek-V3 Technical Report (arXiv:2412.19437)](https://arxiv.org/abs/2412.19437) — NSA が対象にする architecture family
- [Moonshot AI — MoBA: Mixture of Block Attention for Long-Context LLMs (arXiv:2502.13189)](https://arxiv.org/abs/2502.13189) — concurrent work、blocks 上の MoE-style attention
- [Beltagy et al. — Longformer: The Long-Document Transformer (arXiv:2004.05150)](https://arxiv.org/abs/2004.05150) — sliding-window の源流
- [Xiao et al. — StreamingLLM: Efficient Streaming Language Models with Attention Sinks (arXiv:2309.17453)](https://arxiv.org/abs/2309.17453) — NSA が改善する inference-time sparsity baseline
- [Dao et al. — FlashAttention-2 (arXiv:2307.08691)](https://arxiv.org/abs/2307.08691) — NSA kernels が 64k で上回る full-attention baseline
