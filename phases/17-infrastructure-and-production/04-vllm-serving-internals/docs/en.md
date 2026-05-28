# vLLM Serving Internals: PagedAttention, Continuous Batching, Chunked Prefill

> 2026 年の vLLM の強さは、1 つの trick ではなく、相互に効く 3 つの default にあります。PagedAttention は常に有効です。Continuous batching は decode iteration の間に新しい request を active batch へ差し込みます。Chunked prefill は long prompt を分割し、decode token が飢えないようにします。3 つをすべて有効にすると、1 枚の H100 SXM5 上の Llama 3.3 70B FP8 は 128 concurrent で 2,200-2,400 tok/s を出し、vLLM default より約 25%、naive PyTorch loop より 3-4x 高くなります。この lesson では scheduler と attention kernel を diagram できる粒度で読み、最後に `code/main.py` の toy continuous batcher で vLLM 方式の prefill/decode scheduling を実装します。

**種別:** 学習
**言語:** Python (stdlib, toy continuous batching scheduler)
**前提条件:** Phase 17 · 01 (Model Serving), Phase 11 (LLM Engineering)
**所要時間:** 約75分

## Learning Objectives

- PagedAttention を KV cache allocator として説明する: blocks、block tables、本番 load で fragmentation が 4% 未満に収まる理由。
- Continuous batching を iteration level で diagram する: finished sequence が batch から抜け、新しい sequence が drain なしに入る仕組み。
- Chunked prefill を 1 文で説明し、守る latency metric を言えるようにする (hint: mean throughput ではなく TTFT tail)。
- すべての optimization を同時に有効化した team を刺す 2026 vLLM v0.18.0 gotcha を言えるようにする。

## 問題

naive PyTorch serve loop は 1 request ずつ処理します。tokenize、prefill、EOS まで decode、return。1 user なら動きます。100 user では、忍耐強い人の queue になります。明 obvious な fix である static batching は、window 内の最長 prompt に合わせてすべてを pad し、想定最長 output に合わせて decode も pad し、最も遅い sequence で batch 全体を stall させます。使わない padding に cost を払い、fast request は slow request を待ちます。

vLLM は 3 つの問題を同時に解きます。PagedAttention は classic contiguous allocation で 60-80% の GPU memory を食う KV cache fragmentation を止めます。Continuous batching は各 decode iteration の間に request を batch へ出し入れし、batch を常に real work で埋めます。Chunked prefill は 32k-token prompt を約 512-token slice に分割して decode と interleave するため、long prompt が GPU 上の全 decode token を freeze しません。

2026 年の production default はこの 3 つすべてです。それぞれが何をするかを理解する必要があります。failure mode は model ではなく scheduler 側にあるからです。

## The Concept

### virtual memory system としての PagedAttention

KV cache は sequence ごとに `num_layers × 2 × num_heads × head_dim × seq_len × bytes_per_element` です。Llama 3.3 70B で 8192 tokens の場合、BF16 では sequence ごとに約 1.25 GB になります。すべての request に 8192 slots を pre-reserve し、平均 request が 1500 tokens しか使わないなら、reserved HBM の約 82% を浪費します。classic batching はこの waste を払います。

PagedAttention は OS virtual memory の idea を借ります。KV cache は sequence ごとに contiguous ではありません。fixed-size blocks (default 16 tokens) で allocate されます。各 sequence は logical token position を physical block ID に map する block table を持ちます。sequence が割り当て済み block を超えて伸びたら block を 1 つ追加します。完了したら block は pool に戻ります。

fragmentation は classic の 60-80% から PagedAttention では 4% 未満に落ちます。PagedAttention は flag で有効化するものではありません。vLLM が出荷する allocator はこれだけです。knob は `--gpu-memory-utilization` (default 0.9) で、weights と activations を load した後に HBM のどれだけを KV blocks 用に reserve するかを指定します。

### iteration level の continuous batching

旧来の "dynamic batching" は batch を満たすために window (例: 10 ms) を待ち、その後 prefill + decode + decode + decode を全 sequence が終わるまで走らせました。fast sequence は早く終わっても idle になり、GPU は slow sequence を処理し続けます。

Continuous batching は各 decode step の間で動きます。running sequences の集合を `RUNNING` list とします。各 iteration:

1. `RUNNING` 内で EOS または max_tokens に達した sequence を取り除く。
2. scheduler が waiting queue を見る。free KV blocks があれば、新しい sequence (prefill または resumed) を admit する。
3. 現在の `RUNNING` 上で forward pass を実行し、sequence ごとに 1 new token を emit する。

batch size は固定数へ pad されません。output position が異なる sequence が 1 つの fused forward を共有します。2026 vLLM ではこれを `V1 scheduler` と呼びます。key invariant: scheduler は request ごとではなく decode iteration ごとに 1 回走ります。

### Chunked prefill は TTFT tail を守る

prefill は compute-bound です。1 枚の H100 上で Llama 3.3 70B に 32k-token prompt を prefill すると、純粋な prefill だけで約 800 ms かかります。prefill 中、batch 内の他 sequence の decode token は待ちます。serving loop では、1 つの long prompt の first-token latency (TTFT) が、何十人もの user の inter-token latency (ITL) blip になります。

Chunked prefill は prefill を fixed-size chunks (default 512 tokens) に分け、chunk ごとに schedule します。chunk の間で scheduler は decode sequence を 1 token 進められます。少しの absolute prefill latency hit (chunk ごとに数 ms) と引き換えに、decode-time jitter を大きく減らします。published benchmark では、mixed load の P99 ITL は chunked prefill なしの約 50 ms から、ありでは約 15 ms に落ちます。

### 3 つの default は相互作用する

3 機能は互いを前提にしています。PagedAttention は scheduler が取引できる fine-grained KV resource を与えます。Continuous batching は、新しい sequence を admit しても global reshuffle が不要になるよう、その fine-grained resource を必要とします。Chunked prefill は同じ `RUNNING` list 上で scheduler が行う decision です。別 system ではなく、scheduler policy の 1 つです。

すべての flag を覚える必要はありません。scheduler が何を optimize しているかを知れば十分です。KV-block budget の下で goodput を最大化し、chunked prefill slicing を制約として扱っています。

### 2026 v0.18.0 gotcha

vLLM v0.18.0 では、`--enable-chunked-prefill` と draft-model speculative decoding (`--speculative-model`) を組み合わせられません。documented exception は V1 scheduler の N-gram GPU speculative decoding です。release notes を読まずにすべての flag を on にする team は、soft regression ではなく startup 時の run-time error を受けます。speculative gain が chunked prefill を有効化する価値を持つなら選択を見直してください。2026 年の正解は、多くの場合、compile しない draft model + chunked prefill ではなく、chunked prefill なしの EAGLE-3 です。

### 覚えるべき数字

- Llama 3.3 70B FP8、H100 SXM5、128 concurrent、3 つすべて on: 2,200-2,400 tok/s。
- 同じ model、default vLLM (chunked prefill なし): 約 1,800 tok/s。
- 同じ model、naive PyTorch forward loop: 約 600 tok/s。
- production load における PagedAttention の KV fragmentation waste: <4%。
- mixed load の P99 ITL: chunked prefill あり約 15 ms、なし約 50 ms。

### scheduler の形

```
while True:
    finished = [s for s in RUNNING if s.is_done()]
    for s in finished: release_blocks(s); RUNNING.remove(s)

    while WAITING and have_free_blocks_for(WAITING[0]):
        s = WAITING.pop(0)
        allocate_initial_blocks(s)
        RUNNING.append(s)

    # schedule prefill chunks + decode in one batch
    batch = []
    for s in RUNNING:
        if s.in_prefill:
            batch.append(next_prefill_chunk(s))   # e.g. 512 tokens
        else:
            batch.append(decode_one_token(s))     # 1 token

    run_forward(batch)                            # one fused GPU call
```

`code/main.py` はこの loop を stdlib Python でそのまま実装し、fake token counts と fake forward latency を使います。実行すると、chunked prefill が long prefill 中にも decode sequence を生かし続ける様子が見えます。

## Use It

`code/main.py` は vLLM-style scheduler を toggleable features つきで simulate します。実行すると次を比較できます。

- `NAIVE` mode: 1 request ずつ、batching なし。
- `STATIC` mode: pad and wait、classic batching。
- `CONTINUOUS` mode: iteration-level admission and release。
- `CONTINUOUS + CHUNKED` mode: prefill slice を decode と interleave。

output は total throughput (virtual second あたり tokens)、TTFT mean、P99 ITL を表示します。mixed traffic では `CONTINUOUS + CHUNKED` row が勝つはずです。

## Ship It

この lesson は `outputs/skill-vllm-scheduler-reader.md` を生成します。serving config (batch size、KV memory utilization、chunked prefill size、speculative config) を与えると、3 つの default のどれが bottleneck か、何を tune すべきかを naming する scheduler diagnosis を作ります。

## Exercises

1. `code/main.py` を実行してください。short request と long request が混ざる workload で `STATIC` と `CONTINUOUS` を比較してください。throughput gap は prefill efficiency、decode efficiency、tail latency のどこから来ていますか。
2. toy scheduler に `--max-num-batched-tokens` を追加してください。Llama 3.3 70B FP8 を H100 で動かす場合の正しい値は何ですか。(Hint: raw HBM ではなく、KV block size と free block 数の関数です。)
3. vLLM v0.18.0 release notes を読み直してください。mutually exclusive な flag の組み合わせはどれですか。列挙してください。
4. 平均 1,500 output tokens、std 600 tokens の 1,000 requests trace で KV cache fragmentation waste を計算してください。(a) 8192 max の contiguous per-request allocation、(b) 16-token blocks の PagedAttention。
5. chunked prefill が P99 ITL には効くが、単体では throughput を増やさない理由を 1 段落で説明してください。実際の throughput win はどこから来ますか。

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| PagedAttention | 「KV trick」 | KV cache 用 fixed-size block allocator。fragmentation <4% |
| Block table | 「page table」 | logical token position から physical KV block への sequence ごとの map |
| Continuous batching | 「正しい dynamic batching」 | decode iteration ごとに admit/release decision を行う |
| Chunked prefill | 「prefill splitting」 | long prefill を 512-token slice に分け decode と interleave する |
| TTFT | 「first token time」 | prefill + queue + network。long prompt では prefill が支配 |
| ITL | 「inter-token latency」 | 連続 decode token 間の時間。batch size が支配 |
| Goodput | 「SLO を満たす throughput」 | すべての request が TTFT と ITL target を満たす tokens/sec |
| V1 scheduler | 「new scheduler」 | vLLM の 2026 scheduler。N-gram spec decode が chunked-prefill-compatible path |
| `--gpu-memory-utilization` | 「memory knob」 | weights と activations 後に KV blocks 用へ reserve する HBM fraction |

## 参考文献

- [vLLM documentation — Speculative Decoding](https://docs.vllm.ai/en/latest/features/spec_decode/) — chunked-prefill と speculative-decoding compatibility の official source。
- [vLLM Release Notes (NVIDIA)](https://docs.nvidia.com/deeplearning/frameworks/vllm-release-notes/index.html) — 2026 release cadence と version-specific behavior。
- [vLLM Blog — PagedAttention](https://blog.vllm.ai/2023/06/20/vllm.html) — allocator の考え方を今も定義する original write-up。
- [PagedAttention paper (arXiv:2309.06180)](https://arxiv.org/abs/2309.06180) — fragmentation analysis と scheduler design。
- [Aleksa Gordic — Inside vLLM](https://www.aleksagordic.com/blog/vllm) — flame graph つきの detailed V1 scheduler walkthrough。
