# vLLM 服务内部原理：PagedAttention、Continuous Batching、Chunked Prefill

> vLLM 在 2026 年的主导地位建立在三个复合默认值之上，而不是单一技巧。PagedAttention 始终开启。Continuous batching 在解码迭代之间将新请求注入活动批次。Chunked prefill 切片长提示，以便解码 token 永不饿死。三者全开，一个 H100 SXM5 上的 Llama 3.3 70B FP8 在 128 并发时推送 2,200-2,400 tok/s——比 vLLM 自己的默认值高约 25%，比朴素的 PyTorch 循环高 3-4 倍。本课以你可以绘制图表的水准阅读调度器和注意力内核，并以 `code/main.py` 中的一个简单连续批处理调度器结束，该调度器以 vLLM 的方式调度 prefill 和 decode。

**类型：** 学习
**语言：** Python（标准库，简单的连续批处理调度器）
**先修要求：** 阶段 17 · 01（模型服务）、阶段 11（LLM 工程）
**时间：** 约 75 分钟

## 学习目标

- 将 PagedAttention 解释为 KV 缓存分配器：块、块表，以及为什么生产负载下的碎片率保持在 4% 以下。
- 在迭代级别绘制 continuous batching：完成的序列如何离开批次，新序列如何在不排空的情况下加入。
- 用一句话描述 chunked prefill，并说出它保护哪个延迟指标（提示：是 TTFT 尾部，而非平均吞吐量）。
- 说出 2026 年 vLLM v0.18.0 的陷阱，它会困扰一次性启用每个优化的团队。

## 问题

朴素的 PyTorch 服务循环一次运行一个请求：tokenize、prefill、decode 直到 EOS、返回。在一个用户时这可行。在一百个用户时，这是一个耐心等待的人的队列。显而易见的修复——静态批处理——将每个请求填充到窗口中最长提示的长度，将每个解码填充到最长预期输出，并使整个批次在最慢的序列上停滞。你为从未使用的填充付费，快速请求等待慢速请求。

vLLM 同时解决三个问题。PagedAttention 阻止 KV 缓存碎片以经典连续分配方式吃掉 60-80% 的 GPU 内存。Continuous batching 允许请求在每个解码迭代之间加入和离开批次，因此批次始终充满真实工作。Chunked prefill 将 32k token 提示分解为约 512 token 的切片，与解码交错，因此长提示不会冻结 GPU 上的每个解码 token。

2026 年的生产默认是三者全开。你需要了解每个的作用，因为失败模式都在调度器上，而不是模型上。

## 概念

### PagedAttention 作为虚拟内存系统

KV 缓存是每个序列的 `num_layers × 2 × num_heads × head_dim × seq_len × bytes_per_element`。对于 8192 token 的 Llama 3.3 70B，每个序列在 BF16 中约为 1.25 GB。如果你为每个请求预保留 8192 个槽位，但平均请求仅使用 1500 个 token，你浪费了约 82% 的你保留的 HBM。经典批处理支付这种浪费。

PagedAttention 从操作系统虚拟内存借用了想法。KV 缓存在每个序列中不是连续的。它在固定大小的块（默认 16 个 token）中分配。每个序列有一个块表，将其逻辑 token 位置映射到物理块 ID。当序列增长到超出其分配的块时，会添加一个更多块。当它完成时，其块返回到池中。

碎片率从 60-80%（经典）下降到 4% 以下（PagedAttention）。你不是用标志启用 PagedAttention——它是 vLLM 提供的唯一分配器。旋钮是 `--gpu-memory-utilization`（默认 0.9），它告诉 vLLM 在加载权重和激活后为多少 HBM 保留给 KV 块。

### 迭代级别的 Continuous batching

旧的"动态批处理"等待一个窗口（比如 10 毫秒）来填充批次，然后运行 prefill + decode + decode + decode 直到每个序列完成。快速序列提前离开并在 GPU 完成慢速序列时闲置。

Continuous batching 在每个解码步骤之间操作。将运行序列的集合称为 `RUNNING` 列表。在每个迭代：

1. `RUNNING` 中刚刚命中 EOS 或 max_tokens 的任何序列都被移除。
2. 调度器查看等待队列。如果有空闲 KV 块，它接纳新序列（prefill 或恢复）。
3. 前向传递在现在 `RUNNING` 中的任何内容上运行，每个序列发出一个新 token。

批次大小永远不会填充到固定数字。在其输出中不同位置的序列共享一个融合前向。在 2026 vLLM 中，这称为 `V1 scheduler`。关键不变量：调度器每个解码迭代运行一次，而不是每个请求运行一次。

### Chunked prefill 保护 TTFT 尾部

Prefill 是计算绑定的。一个 H100 上的一个 Llama 3.3 70B 的 32k token 提示需要约 800 毫秒的纯 prefill。当 prefill 运行时，批次中每个其他序列的解码 token 都在等待。在服务循环中，一个长提示的首 token 延迟（TTFT）变成其他几十个用户的 token 间延迟（ITL）毛刺。

Chunked prefill 将 prefill 分割成固定大小的块（默认 512 个 token），并将每个块作为一个单元调度。在块之间，调度器可以将解码序列推进一个 token。你以较小的绝对 prefill 延迟损失（每个块几毫秒）来换取低得多的解码时间抖动。已发布基准测试中混合负载下的 P99 ITL 从约 50 毫秒下降到约 15 毫秒。

### 三个默认值交互

所有三个特性都假设彼此。PagedAttention 给调度器一个细粒度 KV 资源来进行交易。Continuous batching 需要那个细粒度资源，因此接纳新序列不会强制全局重组。Chunked prefill 是调度器在同一个 `RUNNING` 列表上做出的决定——它是一个更多的调度器策略，而不是一个单独的系统。

你不需要知道每个标志。你需要知道调度器优化什么：在 KV 块预算下的 goodput，受 chunked prefill 切片限制。

### 2026 年 v0.18.0 陷阱

在 vLLM v0.18.0 中，你不能将 `--enable-chunked-prefill` 与 draft-model speculative decoding（`--speculative-model`）结合。记录的例外是 V1 调度器中的 N-gram GPU speculative decoding。不阅读发行说明就翻开每个标志的团队在启动时收到运行时错误，而不是软回归。如果你的 speculative 增益值得为 chunked prefill 启用，重新审视选择——2026 年的正确答案通常是没有 chunked prefill 的 EAGLE-3，而不是无法编译的 draft model 加 chunked prefill。

### 你应该记住的数字

- Llama 3.3 70B FP8、H100 SXM5、128 并发、三者全开：2,200-2,400 tok/s。
- 相同模型，默认 vLLM（无 chunked prefill）：约 1,800 tok/s。
- 相同模型，朴素 PyTorch 前向循环：约 600 tok/s。
- 生产负载下 PagedAttention 下的 KV 碎片浪费：<4%。
- 混合负载下 P99 ITL：使用 chunked prefill 时约 15 毫秒，没有时约 50 毫秒。

### 调度器是什么样的

```
while True:
    finished = [s for s in RUNNING if s.is_done()]
    for s in finished: release_blocks(s); RUNNING.remove(s)

    while WAITING and have_free_blocks_for(WAITING[0]):
        s = WAITING.pop(0)
        allocate_initial_blocks(s)
        RUNNING.append(s)

    # 在一个批次中调度 prefill chunks + decode
    batch = []
    for s in RUNNING:
        if s.in_prefill:
            batch.append(next_prefill_chunk(s))   # 例如 512 tokens
        else:
            batch.append(decode_one_token(s))     # 1 个 token

    run_forward(batch)                            # 一个融合 GPU 调用
```

`code/main.py`正是 stdlib Python 中带有假 token 计数和假前向延迟的这个循环。运行它显示 chunked prefill 如何在长 prefill 期间保持解码序列活动。

## 使用它

`code/main.py`模拟具有可切换特性的 vLLM 风格调度器。运行它以查看：

- `NAIVE` 模式：一次一个请求，无批处理。
- `STATIC` 模式：填充和等待，经典批处理。
- `CONTINUOUS` 模式：迭代级接纳和释放。
- `CONTINUOUS + CHUNKED` 模式：与 decode 交错的 prefill 切片。

输出显示总吞吐量（每虚拟秒 token 数）、TTFT 平均值和 P99 ITL。`CONTINUOUS + CHUNKED` 行应该在混合流量上占主导。

## 交付它

本课生成 `outputs/skill-vllm-scheduler-reader.md`。给定服务配置（批次大小、KV 内存利用率、chunked prefill 大小、speculative 配置），它产生一个调度器诊断，指出三个默认值中的哪个是瓶颈以及要调整什么。

## 练习

1. 运行 `code/main.py`。在混合短和长请求的工作负载上比较 `STATIC` 和 `CONTINUOUS`。吞吐量差距来自哪里——prefill 效率、decode 效率还是尾部延迟？
2. 修改玩具调度器以添加 `--max-num-batched-tokens`。对于运行 Llama 3.3 70B FP8 的 H100，正确值是什么？（提示：它是 KV 块大小和空闲块数量的函数，而不是原始 HBM。）
3. 重新阅读 vLLM v0.18.0 发行说明。哪些标志组合是互斥的？列出它们。
4. 计算 1,000 个请求的跟踪的 KV 缓存碎片浪费，平均 1,500 个输出 token，标准差 600 个 token，在 (a) 8192 最大值时的连续每请求分配下，(b) 16 token 块的 PagedAttention 下。
5. 用一段话解释为什么 chunked prefill 有助于 P99 ITL 但不会隔离提高吞吐量。吞吐量提升在实践中来自哪里？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| PagedAttention | "KV 技巧" | KV 缓存的固定大小块分配器；碎片 <4% |
| Block table | "页表" | 从逻辑 token 位置到物理 KV 块的每序列映射 |
| Continuous batching | "动态批处理，但是正确的" | 每个解码迭代做出接纳/释放决定 |
| Chunked prefill | "prefill 分割" | 将长 prefill 分解成与 decode 交错的 512 token 切片 |
| TTFT | "首 token 时间" | Prefill + 队列 + 网络；在长提示时由 prefill 主导 |
| ITL | "token 间延迟" | 连续解码 token 之间的时间；由批次大小主导 |
| Goodput | "满足 SLO 的吞吐量" | 每个请求仍达到 TTFT 和 ITL 目标的 token/秒 |
| V1 scheduler | "新调度器" | vLLM 的 2026 调度器；N-gram spec decode 是 chunked-prefill 兼容路径 |
| `--gpu-memory-utilization` | "内存旋钮" | 权重和激活后为 KV 块保留的 HBM 分数 |

## 延伸阅读

- [vLLM 文档——Speculative Decoding](https://docs.vllm.ai/en/latest/features/spec_decode/)——关于 chunked-prefill 和 speculative-decoding 兼容性的官方来源。
- [vLLM 发行说明 (NVIDIA)](https://docs.nvidia.com/deeplearning/frameworks/vllm-release-notes/index.html)——2026 年发行节奏和版本特定行为。
- [vLLM 博客——PagedAttention](https://blog.vllm.ai/2023/06/20/vllm.html)——仍然定义如何思考分配器的原始文章。
- [PagedAttention 论文 (arXiv:2309.06180)](https://arxiv.org/abs/2309.06180)——碎片分析和调度器设计。
- [Aleksa Gordic——Inside vLLM](https://www.aleksagordic.com/blog/vllm)——带火焰图的详细 V1 调度器演练。
