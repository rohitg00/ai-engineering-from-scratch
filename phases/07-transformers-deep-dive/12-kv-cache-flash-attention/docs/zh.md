# KV Cache, Flash Attention & Inference Optimization

> 培训是平行的且是FLOP限制的。推理是连续的且受记忆限制的。不同的瓶颈，不同的技巧。

** 类型：** 构建
** 语言：** Python
** 先决条件：** 阶段7 · 02（自我注意力）、阶段7 · 05（全Transformer）、阶段7 · 07（GPT）
** 时间：** ~75分钟

## The Problem

天真的自回归解码器通过“O（N²）”工作来生成“N”个令牌：在每一步中，它都会重新计算对完整前置的注意力。对于16 M个注意力操作的4K代币响应来说，其中大部分都是多余的。一旦计算，前置标记的每个隐藏状态都是确定性的-您只需针对之前所有内容的缓存键和值运行新标记的查询。

最重要的是，注意力本身会移动大量数据。标准注意力实现了N×N得分矩阵、N×d softmax输出、N×d最终输出-对HBM的读写太多。当N = 2K时，注意力在成为FLOP束缚之前先成为记忆束缚。经典注意力内核未充分利用现代图形处理器4-10倍。

两项优化，均来自Dao等人，将前沿推理从“慢”推向“快”：

1. **KV缓存。**存储每个前置标记的K和V载体。每个新令牌的注意力都是对缓存密钥的一次查询。每生成步骤的推理从“O（N²）”减少到“O（N）”。
2. ** 闪光注意。**平铺注意力计算，使完整的N×N矩阵永远不会击中HBM。所有的softmax + matmul都发生在SRAM中。在A100上实现2-4倍挂钟加速;在H100上采用FP 8实现5-10倍挂钟加速。

到2026年，两者都将普遍存在。每个生产式推理栈（vLLM、TensorRT-LLM、SGLang、llama.cpp）都假设它们。每个前沿模型都启用了Flash Attention。

## The Concept

![KV cache growth and Flash Attention tiling](../assets/kv-cache-flash-attn.svg)

### KV cache math

每个解码器层、每个令牌、每个头：

```
bytes_per_token_per_layer = 2 * d_head * dtype_size
                          ^
                          K and V
```

对于具有32层、32个头的7 B型号，d_head=128，fp 16：

```
per token per layer = 2 * 128 * 2 = 512 bytes
per token (32 layers) = 16 KB
per 32K context = 512 MB
```

对于Llama 3 70 B（80层，d_head=128，GQA，8 KV头部）：

```
per token per layer = 2 * 8 * 128 * 2 = 4096 bytes (4 KB)
per 32K context = 10.4 GB
```

这10 GB就是为什么128 K环境下的Llama 3 70 B需要大部分40 GB A100，仅用于批量大小为1的KV缓存。

**GQA是KV缓存的胜利。**具有64个头的MHA将为32 GB。MLA进一步压缩。

### Flash Attention — the tiling trick

标准关注：

```
S = Q @ K^T          (HBM read, N×N, HBM write)
P = softmax(S)       (HBM read, HBM write)
O = P @ V            (HBM read, HBM write)
```

三次HBM往返。在H100上，HBM带宽为3 TB/s;静态存储器为30 TB/s。与将所有内容保持在芯片上相比，每一次HBM行程都会减慢10倍。

闪光注意：

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

每个瓷砖一次HBM行程。总内存占用面积从“O（N²）”下降到“O（N）”。向后传递重新计算向前传递的一些值，而不是存储它们-又一次内存胜利。

** 数字技巧。**运行softmax会在切片中维护“（max，sum）”，因此最终的规范化是精确的。不是一个近似值- Flash Attention计算与标准注意力相同的位输出（模fp 16非关联性）。

** 版本演变：**

| 版本 | 年 | 密钥改变 | 参考硬件加速 |
|---------|------|-----------|-------------------------------|
| 毛边1 | 2022 | 切片的静态随机存储器内核 | A100上的2倍 |
| 闪光灯2 | 2023 | 更好的并行性，catherine优先排序 | A100上的3倍 |
| 闪式3 | 2024 | 霍珀·托马西，FP 8 | H100上1.5-2倍（~740 TFLOPs FP 16） |
| Flash 4 | 2026 | Blackwell 5级管道，软件exp2 | 推理优先（仅最初转发） |

Flash 4仅在发布时向前传递。培训仍然使用Flash 3。GQA和varlen对Flash 4的支持正在等待中（2026年中期）。

### Speculative decoding — the other latency win

廉价模型提出N个代币。大模型并行验证所有N。如果验证接受k个代币，则您为k代支付了1次大型转发通行证。代码和散文上的典型k=3-5。

2026年默认值：
- ** 酒店EAGLE 2 / Medusa.**共享验证器隐藏状态的集成草稿头。2-3倍加速，无质量损失。
- ** 使用草稿模型的推测解码。**消费者硬件的2-4倍加速。
- ** 前瞻解码。** Jacobi迭代;不需要草稿模型。小众但免费。

### Continuous batching

经典的批量推理：等待最慢的序列完成，然后开始新的批量。当短响应提前完成时，会浪费图形处理器。

连续收件箱（首先在Orca中发布，现在在vLLM、TensorRT-LLM、SGLang中）：旧请求完成后，立即将新请求交换到批处理中。典型聊天工作负载的吞吐量增加5-10倍。

### PagedAttention — KV cache as virtual memory

vLLM的头条新闻。KV缓存分配在16个令牌块中;页表将逻辑位置映射到物理块。允许您跨并行样本（射束搜索、并行采样）共享KV、用于提示缓存的热交换前置码和内存碎片整理。与朴素连续分配相比，吞吐量提高了4倍。

## Build It

请参阅' code/main.py '。我们实施：

1. 一个简单的“O（N²）”增量解码器。
2. 一个“O（N）”KV缓存解码器。
3. 模拟Flash Attention最大运行算法的拼贴softmax。

### Step 1: KV cache

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

简单：在每层、每头列表中不断增长每令牌的K、V载体。

### Step 2: tiled softmax

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

一次输出与' softmax（qK）V '位相同，但在任何时候工作集都是' tile x d_head '块，而不是完整的' N x d_head '。

### Step 3: compare naive vs cached decoding on 100-token generation

计算注意力操作。天真：“O（N²）”= 5050。缓存：“O（N）”= 100。代码会打印两者。

## Use It

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

vLLM制作：

```bash
pip install vllm
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --tensor-parallel-size 4 \
    --max-model-len 32768 \
    --enable-prefix-caching \
    --kv-cache-dtype fp8
```

跨请求的后缀缓存是2026年的一个重大胜利-相同的系统提示、少数示例或长上下文文档跨调用重复使用KV。对于具有重复工具提示的代理工作负载，前置缓存通常会增加5倍的吞吐量。

## Ship It

请参阅“输出/skill-inference-optimizer.md”。该技能为新的推理部署选择注意力实现、KV缓存策略、量化和推测解码。

## Exercises

1. ** 简单。**运行'代码/main.py '。确认原始解码器和缓存解码器产生相同的输出;注意操作计数差异。
2. ** 中等。**实现前置缓存：给定提示P和多个完成，在P上运行一次前向传递以填充KV缓存，然后在每次完成时分支。衡量每个项目的加速与重新编码P。
3. ** 很难。**在带有自由列表的固定16个令牌块中实现一个玩具PagedAttention：KV缓存。当序列完成时，将其块返回到池中。模拟1，000个不同长度的聊天完成。比较内存碎片与连续分配。

## Key Terms

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| KV缓存 | “让解码速度更快的技巧” | 存储每个前置标记的K和V;新查询会处理它们，而不是重新计算。 |
| HBM | “图形处理器主内存” | 高带宽内存; H100上为80 GB，B200上为192 GB。~3 TB/s带宽。 |
| SRAM | “片内存储器” | 每个SM快速内存，H100上每个SM约256 KB。~30 TB/s带宽。 |
| 瞬间关注 | “瓷砖关注核心” | 计算注意力，而不会在HBM中实现N×N。 |
| 连续配料 | “不等待” | 交换完成的序列，放入新序列，而不会耗尽批次。 |
| 页面关注 | “vLLM的头条新闻” | KV缓存分配到带有页表的固定块中;消除碎片。 |
| 前缀缓存 | “重复使用长提示” | 为请求之间的共享前置缓存KV;为代理节省了大量成本。 |
| 推测解码 | “草案+验证” | 廉价草案模型提出代币;大模型一次性验证k。 |

## Further Reading

- [Dao等人（2022）。Flash注意力：具有IO-Awareness的快速且内存高效的精确注意力]（https：//arxiv.org/ab/2205.14135）- Flash 1。
- [Dao（2023）。Flash Attention-2：更快的注意力，具有更好的并行主义和工作分区]（https：//arxiv.org/ab/2307.08691）- Flash 2。
- [Shah等人（2024）。Flash Attention-3：快速准确的注意力，具有不同步性和低精度]（https：//arxiv.org/ab/2407.08608）- Flash 3。
- [Flash Attention-4发布说明（Dao-Ailab，2026）]（https：//github.com/Dao-Ailab/flash-attention）- Blackwell 5阶段管道和software-exp 2技巧;阅读repo REAUTE以了解本课提到的仅向前启动的警告。
- [Kwon等人（2023）。使用PagedAttention服务的大型语言模型的高效内存管理]（https：//arxiv.org/ab/2309.06180）- vLLM论文。
- [Leviathan et al.（2023）.通过推测解码从变压器快速推断]（https：//arxiv.org/abs/2211.17192）-规范解码。
- [Li等人（2024）。老鹰：推测性抽样需要重新思考特征不确定性]（https：//arxiv.org/ab/2401.15077）- EAGLE-1/2论文，内容涉及课程引用的集成草稿方法。
- [Cai等人（2024）。美杜莎：具有多个解码头的简单LLM推理加速框架]（https：//arxiv.org/ab/2401.10774）-与EAGLE一起引用的美杜莎方法。
- [vLLM docs - PagedAttention]（https：//docs.vllm.ai/en/latest/design/kernel/paged_attention.html）-16个令牌块和页面表设计的典型深入研究。
