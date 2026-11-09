# 缓存,闪光注意力和推理优化

> 训练是平行的,FLOP的. 推理是序列的,记忆的. 不同的瓶,不同的技巧.

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 02 (Self-Attention), Phase 7 · 05 (Full Transformer), Phase 7 · 07 (GPT)
**Time:** ~75 minutes

## 问题

一个天真的自动降解器可以$O(N^2)$工作要产生$N$代币:在每一步上,它重新计算注意力在完整的预先代币上.对于4K代币响应,这是16M注意力操作,其中大多数是冗余的.一个预先代币的每个隐藏状态是确定性的,一旦计算了,你只需要运行新的代币的查询与之前所有东西的缓存键和值.

另外,注意力本身移动了大量数据.标准注意力实现了N×N分数矩阵,N×d软max输出,N×d最终输出 读写太多.对于N≥2K,注意力在成为FLOP之前会被绑定到内存.经典注意力内核使用现代GPU不足410×.

两种优化,来自达和其他,将边界推断从"慢"转化为"快":

1. **KV cache.**存储每个预सर्ग代币的K和V向量.每个新代币的注意力是一个查询对缓存键. 推理减少了$O(N^2)$为了$O(N)$对于每一代的步骤.
2. **Flash Attention.**切注意计算,使N×N矩阵永远不会达到HBM.所有软max + matmul都发生在SRAM中.A100上24×墙钟速度加快;FP8上H100上510×.

到2026年,这两种模型都将成为通用的.每个生产推理堆 (vLLM,TensorRT-LLM,SGLang, llama.cpp) 都会假设它们.每个边境模型船只都能使用Flash Attention.

## 概念

![KV cache growth and Flash Attention tiling](../assets/kv-cache-flash-attn.svg)

### 预存计算

每个解码器层,每一个代币,在所有KV头上:

```
bytes_per_token_per_layer = 2 * n_kv_heads * d_head * dtype_size
                          ^
                          K and V
```

对于7B型号,有32层,32个头 (所有用于K和V),d_head=128,fp16:

```
per token per layer = 2 * 32 * 128 * 2 = 16384 bytes (16 KiB)
per token (32 layers) = 512 KiB
per 32K context = 16 GiB
```

对于Llama 3 70B (80层,d_head=128,GQA 8 KV头):

```
per token per layer = 2 * 8 * 128 * 2 = 4096 bytes (4 KiB)
per 32K context = 10 GiB
```

这一10GB的32K变得128K的40GB,这就是40GB的A100,仅仅用于KV缓存的批量1.

**GQA is the KV-cache win.**机机的64KV头大约8倍,大约80Gb在32K.

拉取尺寸,看缓存尺寸移动. 按下序列长度或批量,看它在单个GPU上爆炸的速度:

```figure
kv-cache-sizer
```

###  片技巧

标准注意力:

```
S = Q @ K^T          (HBM read, N×N, HBM write)
P = softmax(S)       (HBM read, HBM write)
O = P @ V            (HBM read, HBM write)
```

在H100上,HBM带宽为3TB/s;SRAM为30TB/s.每次HBM旅行都是10倍的减速相比,保持一切在芯片上.

闪光注意:

```
for each block of Q (tile size ~128 × 128):
    load Q_tile into SRAM
    for each block of K, V:
        load K_tile, V_tile into SRAM
        compute S_tile = Q_tile @ K_tile^T     (SRAM)
        running softmax aggregation             (SRAM)
        accumulate into O_tile                  (SRAM)
    write O_tile to HBM
```

每每次一次HBM旅行,总记忆足迹从$O(N^2)$为了$O(N)$后传输将从前传输中重新计算一些值,而不是存储它们另一个记忆获取.

**Numerical trick.**运行软max保持`(max, sum)`闪光注意力计算的比特相同输出标准注意力 (模块fp16非关联性).

**Version evolution:**

| Version | Year | Key change | Speedup on reference hardware |
|---------|------|-----------|-------------------------------|
| Flash 1 | 2022 | Tiled SRAM kernel | 2× on A100 |
| Flash 2 | 2023 | Better parallelism, causal-first ordering | 3× on A100 |
| Flash 3 | 2024 | Hopper asynchrony, FP8 | 1.5–2× on H100 (~740 TFLOPs FP16) |
| Flash 4 | 2026 | Blackwell 5-stage pipeline, software exp2 | Inference-first (forward only initially) |

4仅在发射时才会通过.训练仍然使用Flash 3.GQA和varlen支持Flash 4正在等待 (2026年中期).

### 其他延迟获胜

廉价模型提出N代币.大模型并行验证所有N代币.如果验证接受k代币,则你为k代代币支付1个大模型前行通行.典型的k=35在代码和散文中.

2026 违约:
- **EAGLE 2 / Medusa.**通过互联网,我们可以实现快速化,
- **Speculative decoding with draft model.**消费者硬件的速度增加了24倍.
- **Lookahead decoding.**没有草稿模型,但是免费的.

### 连续批发

典型的批量推断:等待最慢的序列完成,然后开始新的批量.

连续批发 (首先出货在Orca,现在在vLLM,TensorRT-LLM,SGLang):在旧批发完成后,将新请求交换到批发中.

### 页面注意  KV缓存作为虚拟内存

维LLM的主题功能.KV缓存分为16个代币块;一个页面表将逻辑位置映射到物理块.允许您共享KV在并行样本中 (光束搜索,并行样本采集),热交换预先设用于快速缓存,以及消碎内存.

```figure
flash-attention-memory
```

## 建立它

```figure
iso-machine {"machine":"kv-cache"}
```

看到`code/main.py`或其的港口`code/main.rs`运行了""版本:`rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson`我们实施:

1. 一个天真的人.$O(N^2)$增量解码器.
2. $O(N)$设置了KV缓存解码器.
3. 模拟闪光注意力运行最大算法的软max.

### 步骤1:KV缓存

```python
class KVCache:
    def __init__(self, n_layers, n_heads, d_head):
        self.K = [[[] for _ in range(n_heads)] for _ in range(n_layers)]
        self.V = [[[] for _ in range(n_heads)] for _ in range(n_layers)]

    def append(self, layer, head, k, v):
        self.K[layer][head].append(k)
        self.V[layer][head].append(v)

    def read(self, layer, head):
        return self.K[layer][head], self.V[layer][head]
```

简单:继续在每个层,每个头条列表中增长每代币K,V向量.

### 步骤2: 软max

```python
def tiled_softmax_dot(q, K, V, tile=4):
    """Flash-attention-style softmax(qK^T)V with running max/sum."""
    m = float("-inf")
    s = 0.0
    out = [0.0] * len(V[0])
    for start in range(0, len(K), tile):
        k_block = K[start:start + tile]
        v_block = V[start:start + tile]
        scores = [sum(qi * ki for qi, ki in zip(q, k)) for k in k_block]
        new_m = max(m, *scores)
        exp_old = math.exp(m - new_m) if m != float("-inf") else 0.0
        exp_new = [math.exp(sc - new_m) for sc in scores]
        s = s * exp_old + sum(exp_new)
        for j in range(len(out)):
            out[j] = out[j] * exp_old + sum(e * v[j] for e, v in zip(exp_new, v_block))
        m = new_m
    return [o / s for o in out]
```

比特相同输出`softmax(qK) V`任何时候工作组是一个`tile × d_head`区块,不是全部`N × d_head`现在,我们要去.

### 步骤3:比较简单与缓存解码

两个解码器都进行相同的查询密钥比较:步骤 `t`接待了`t`代币,所以总数是1+2+... 其他类型的产品 代码使用N=10,每一个解码器打印55个. 对于一个100代代币,两者都做5050个比较. 缓存存储K和V投影. 没有缓存,每个步骤都会重新计算K和V,以获得完整的预सर्ग,所以100代代代代代码计算5050代代码状态. 随着缓存,每个代币的K和V的计算一次,

## 用它

```python
# HuggingFace transformers auto-enables KV cache on decoder-only generate().
from transformers import AutoModelForCausalLM
model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.2-3B",
    attn_implementation="flash_attention_2",  # use FA3 if Hopper
    torch_dtype="bfloat16",
)
# generate() uses KV cache automatically
```

机生产:

```bash
pip install vllm
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --tensor-parallel-size 4 \
    --max-model-len 32768 \
    --enable-prefix-caching \
    --kv-cache-dtype fp8
```

预先文件缓存在请求中是2026年大胜利. 相同的系统提示,少数拍摄示例或长文本文档在调用中重复使用KV. 对于重复工具提示的代理工作负载,预先文件缓存通常是5x吞吐量增长.

## 运送它

看到`outputs/skill-inference-optimizer.md`技能选择注意力实现,KV缓存策略,量化和推测解码来实现新的推理部署.

## 运动

1. **Easy.**跑步`code/main.py`确认无和缓存解码器的输出相同;注意选数差异.
2. **Medium.**实现前置缓存:给出提示P和几个完成,运行一个前进通过P填写KV缓存,然后分支每完成.
3. **Hard.**实现玩具页面注意:在固定16个代币区块中实现KV缓存.一旦一个序列完成,将其区块返回池中.模拟1000个不同长度的聊天完成.比较内存碎片化与连接分配.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| KV cache | "The trick that makes decoding fast" | Stored K and V from every prefix token; new queries attend to them instead of recomputing. |
| HBM | "GPU main memory" | High Bandwidth Memory; 80 GB on H100, 192 GB on B200. ~3 TB/s bandwidth. |
| SRAM | "On-chip memory" | Per-SM fast memory, ~256 KB per SM on H100. ~30 TB/s bandwidth. |
| Flash Attention | "Tiled attention kernel" | Computes attention without materializing N×N in HBM. |
| Continuous batching | "No-wait batching" | Swap finished sequences out, new ones in, without draining the batch. |
| PagedAttention | "vLLM's headline" | KV cache allocated in fixed blocks with a page table; eliminates fragmentation. |
| Prefix caching | "Reuse long prompts" | Cache KV for a shared prefix across requests; major cost cut for agents. |
| Speculative decoding | "Draft + verify" | Cheap draft model proposes tokens; big model verifies k in one pass. |

## 进一步阅读

- [Dao et al. (2022). FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness](https://arxiv.org/abs/2205.14135)闪电1.
- [Dao (2023). FlashAttention-2: Faster Attention with Better Parallelism and Work Partitioning](https://arxiv.org/abs/2307.08691)闪光2.
- [Shah et al. (2024). FlashAttention-3: Fast and Accurate Attention with Asynchrony and Low-precision](https://arxiv.org/abs/2407.08608)闪电3.
- [FlashAttention-4 release notes (Dao-AILab, 2026)](https://github.com/Dao-AILab/flash-attention)黑5阶段管道和软件-exp2技巧;阅读REPREVIEREPREVIE,了解本课程所提到的仅向前发射警告.
- [Kwon et al. (2023). Efficient Memory Management for Large Language Model Serving with PagedAttention](https://arxiv.org/abs/2309.06180)   纸
- [Leviathan et al. (2023). Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192)规格解码.
- [Li et al. (2024). EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty](https://arxiv.org/abs/2401.15077)课程中引用的综合草案方法的EAGLE-1/2论文.
- [Cai et al. (2024). Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads](https://arxiv.org/abs/2401.10774)在Eagle旁边引用了Medusa方法.
- [vLLM docs — PagedAttention](https://docs.vllm.ai/en/latest/design/kernel/paged_attention.html)在16个代币区块和页面表设计上进行了正规深入潜水.
