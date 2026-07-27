# vLLM 推理引擎内部原理：PagedAttention、连续批处理、分块预填充

> vLLM 在 2026 年的统治地位并非依赖某个单一技巧，而是建立在三个相互配合的默认机制之上。PagedAttention 始终开启。连续批处理（Continuous Batching）在每次解码迭代之间将新请求注入到活跃批次中。分块预填充（Chunked Prefill）将长提示词切分成多个切片，确保解码 token 永远不会因等待而停滞。同时开启这三个优化后，单张 H100 SXM5 上运行 Llama 3.3 70B FP8 模型，在 128 并发下可达 2,200–2,400 tok/s —— 比 vLLM 自身的默认配置高出约 25%，是朴素 PyTorch 循环的 3–4 倍。本课程将深入解读调度器和注意力内核，让你能够画出架构图，并以 `code/main.py` 中的玩具级连续批处理器作为收尾，它采用与 vLLM 相同的方式来调度预填充和解码。

**类型：** 学习
**语言：** Python（标准库，玩具级连续批处理调度器）
**前置要求：** 阶段 17 · 01（模型推理服务）、阶段 11（LLM 工程）
**时长：** 约 75 分钟

## 学习目标

- 将 PagedAttention 解释为 KV 缓存分配器：块、块表，以及为何在生产负载下碎片率低于 4%。
- 在迭代级别上图示连续批处理：已完成序列如何离开批次，新序列如何加入而不需要排空整个批次。
- 用一句话描述分块预填充，并指出它保护的是哪个延迟指标（提示：是 TTFT 尾部，而非平均吞吐量）。
- 指出 2026 年 vLLM v0.18.0 中那个让同时启用所有优化选项的团队踩坑的陷阱。

## 问题所在

朴素的 PyTorch 推理服务循环一次只处理一个请求：分词、预填充、解码直到 EOS，返回结果。一个用户时没问题，一百个用户时就成了一长串排队等待的人。显然的"修复"——静态批处理——会将每个请求填充到窗口中最长提示词的长度，将每次解码填充到最长预期输出的长度，并且整个批次要等最慢的序列完成后才能继续。你为永远不会用到的填充付出了代价，而快的请求必须等待慢的请求。

vLLM 一次性解决了三个问题。PagedAttention 阻止了 KV 缓存碎片化消耗 60-80% GPU 内存的问题（而经典连续分配方式正是如此）。连续批处理允许请求在每次解码迭代之间加入和离开批次，因此批处理中始终充满真实工作。分块预填充将一个 32k token 的提示词拆分成约 512 token 的切片，与解码交错执行，因此一个长提示词不会冻结 GPU 上的每个解码 token。

2026 年的生产默认配置是三者全开。你需要理解各自的原理，因为所有的故障模式都出在调度器上，而非模型本身。

## 概念解析

### PagedAttention：一种虚拟内存系统

KV 缓存的大小为 `num_layers × 2 × num_heads × head_dim × seq_len × bytes_per_element` 每序列。对于 Llama 3.3 70B 在 8192 token 下，BF16 格式大约为每序列 1.25 GB。如果为每个请求预分配 8192 个槽位，但平均请求只使用 1500 个 token，那么你预留的 HBM 中大约有 82% 被浪费了。经典批处理方式要承受这种浪费。

PagedAttention 借鉴了操作系统虚拟内存的思想。KV 缓存不再按序列连续分配，而是以固定大小的块（默认 16 个 token）进行分配。每个序列有一个块表，将其逻辑 token 位置映射到物理块 ID。当一个序列增长超出其已分配的块时，增加一个额外的块。序列完成后，其块归还到池中。

碎片率从 60-80%（经典方式）降至 4% 以下（PagedAttention）。你不需要通过某个标志来启用 PagedAttention——它是 vLLM 唯一的分配器。相关的参数是 `--gpu-memory-utilization`（默认 0.9），它告诉 vLLM 在加载权重和激活值之后，预留多少 HBM 用于 KV 块。

### 迭代级别的连续批处理

旧的"动态批处理"会等待一个时间窗口（例如 10 毫秒）来填满一个批次，然后执行 预填充 + 解码 + 解码 + 解码……直到每个序列都完成。快的序列早早结束，却在 GPU 完成慢序列时闲置着。

连续批处理在每次解码步骤之间运作。将正在运行的序列集合称为 `RUNNING` 列表。在每次迭代中：

1.  `RUNNING` 中刚刚到达 EOS 或 max_tokens 的序列被移除。
2.  调度器检查等待队列。如果有空闲的 KV 块，就准入新序列（预填充或恢复）。
3.  前向传播在当前 `RUNNING` 中的所有序列上执行，每个序列生成一个新 token。

批次大小从不填充到固定数量。处于输出不同位置的序列共享一次融合前向传播。在 2026 年的 vLLM 中，这被称为 `V1 调度器`。关键不变式是：调度器每次解码迭代运行一次，而不是每个请求运行一次。

### 分块预填充保护 TTFT 尾部

预填充是计算密集型的。在 Llama 3.3 70B 上，一个 32k token 的提示词在单张 H100 上需要约 800 毫秒的纯预填充时间。当预填充运行时，批次中所有其他序列的解码 token 都在等待。在推理服务循环中，一个长提示词的首 token 延迟（TTFT）会成为其他几十个用户的 token 间延迟（ITL）的尖峰。

分块预填充将预填充拆分为固定大小的块（默认 512 个 token），并将每个块作为一个单元调度。在块之间，调度器可以将解码序列推进一个 token。你以较小的绝对预填充延迟代价（每块几毫秒）换来了大幅降低的解码时间抖动。在已发表的基准测试中，混合负载下的 P99 ITL 从约 50 毫秒降至约 15 毫秒。

### 三个默认机制的相互作用

这三个特性相互依赖。PagedAttention 为调度器提供了一个细粒度的 KV 资源来进行权衡。连续批处理需要这种细粒度资源，以便准入一个新序列不会强制进行全局重排。分块预填充是调度器在同一个 `RUNNING` 列表上做出的决策——它只是多一个调度策略，而不是一个独立的系统。

你不需要记住每一个标志位。你需要知道调度器优化的是什么：在 KV 块预算约束下，并受分块预填充切分影响的情况下，最大化有效吞吐量（goodput）。

### 2026 年 v0.18.0 的陷阱

在 vLLM v0.18.0 中，你不能同时使用 `--enable-chunked-prefill` 和草稿模型推测解码（`--speculative-model`）。记录在案的例外是 V1 调度器中的 N-gram GPU 推测解码。那些不加阅读发布说明就一股脑开启所有标志的团队会在启动时遇到运行时错误，而不是一个温和的性能回退。如果你的推测增益值得为此关闭分块预填充，请重新审视这个选择——2026 年正确的答案通常是使用 EAGLE-3 而不启用分块预填充，而不是使用一个根本无法编译的草稿模型加分块预填充组合。

### 你应该记住的数字

- Llama 3.3 70B FP8, H100 SXM5, 128 并发, 三者全开: 2,200–2,400 tok/s。
- 相同模型，默认 vLLM（无分块预填充）: ~1,800 tok/s。
- 相同模型，朴素 PyTorch 前向循环: ~600 tok/s。
- 生产负载下 PagedAttention 的 KV 碎片浪费: <4%。
- 混合负载下的 P99 ITL: 有分块预填充约 15 ms，无分块预填充约 50 ms。

### 调度器的伪代码

```
while True:
    finished = [s for s in RUNNING if s.is_done()]
    for s in finished: release_blocks(s); RUNNING.remove(s)

    while WAITING and have_free_blocks_for(WAITING[0]):
        s = WAITING.pop(0)
        allocate_initial_blocks(s)
        RUNNING.append(s)

    # 在一次批次中调度预填充块 + 解码
    batch = []
    for s in RUNNING:
        if s.in_prefill:
            batch.append(next_prefill_chunk(s))   # 例如 512 个 token
        else:
            batch.append(decode_one_token(s))     # 1 个 token

    run_forward(batch)                            # 一次融合的 GPU 调用
```

`code/main.py` 就是用标准库 Python 实现的上述循环，包含模拟的 token 计数和模拟的前向延迟。运行它可以展示分块预填充如何在长预填充期间保持解码序列存活。

```figure
tensor-parallel
```

## 使用它

`code/main.py` 模拟了一个 vLLM 风格的调度器，各特性可独立开关。运行它可以看到：

- `NAIVE` 模式：一次一个请求，无批处理。
- `STATIC` 模式：填充并等待，经典批处理。
- `CONTINUOUS` 模式：迭代级别的准入与释放。
- `CONTINUOUS + CHUNKED` 模式：预填充切片与解码交错执行。

输出显示总吞吐量（每虚拟秒 token 数）、TTFT 均值和 P99 ITL。`CONTINUOUS + CHUNKED` 行在混合流量下应占主导地位。

## 交付成果

本课程产出 `outputs/skill-vllm-scheduler-reader.md`。给定一个推理服务配置（批次大小、KV 内存利用率、分块预填充大小、推测解码配置），它生成一份调度器诊断报告，指出三个默认机制中的哪一个成为瓶颈以及如何调优。

## 练习

1. 运行 `code/main.py`。在包含短请求和长请求的混合负载下，比较 `STATIC` 与 `CONTINUOUS`。吞吐量差距来自哪里——预填充效率、解码效率，还是尾部延迟？
2. 修改玩具调度器，添加 `--max-num-batched-tokens`。在运行 Llama 3.3 70B FP8 的 H100 上，合适的值是多少？（提示：它是 KV 块大小和空闲块数量的函数，而不是原始 HBM 的函数。）
3. 重新阅读 vLLM v0.18.0 的发布说明。哪些标志组合互斥？列出它们。
4. 计算 1000 个请求的 KV 缓存碎片浪费，平均输出 token 数为 1500，标准差为 600 token，在 (a) 连续分配（每个请求最多 8192）和 (b) 16-token 块的 PagedAttention 下分别计算。
5. 用一段话解释为什么分块预填充有助于降低 P99 ITL，但对吞吐量本身没有帮助。实践中吞吐量的提升来自哪里？

## 关键术语

| 术语 | 人们通常怎么说 | 实际含义 |
|------|----------------|----------|
| PagedAttention | "那个 KV 技巧" | KV 缓存的固定大小块分配器；碎片率 <4% |
| 块表 (Block table) | "页表" | 每个序列的逻辑 token 位置到物理 KV 块的映射 |
| 连续批处理 (Continuous batching) | "动态批处理，但做对了" | 每次解码迭代做出准入/释放决策 |
| 分块预填充 (Chunked prefill) | "预填充拆分" | 将长预填充拆分为 512-token 切片，与解码交错执行 |
| TTFT | "首 token 时间" | 预填充 + 排队 + 网络；长提示词下主要由预填充决定 |
| ITL | "token 间延迟" | 连续解码 token 之间的时间；主要由批次大小决定 |
| 有效吞吐量 (Goodput) | "满足 SLO 的吞吐量" | 每秒 token 数，同时每个请求仍满足 TTFT 和 ITL 目标 |
| V1 调度器 | "新调度器" | vLLM 2026 年的调度器；N-gram 推测解码是兼容分块预填充的路径 |
| `--gpu-memory-utilization` | "那个内存旋钮" | 加载权重和激活值后，为 KV 块预留的 HBM 比例 |

## 延伸阅读

- [vLLM 文档 — 推测解码](https://docs.vllm.ai/en/latest/features/spec_decode/) — 关于分块预填充和推测解码兼容性的官方资料。
- [vLLM 发布说明（NVIDIA）](https://docs.nvidia.com/deeplearning/frameworks/vllm-release-notes/index.html) — 2026 年发布节奏和版本特定行为。
- [vLLM 博客 — PagedAttention](https://blog.vllm.ai/2023/06/20/vllm.html) — 原始文章，至今仍定义着如何看待这个分配器。
- [PagedAttention 论文 (arXiv:2309.06180)](https://arxiv.org/abs/2309.06180) — 碎片化分析和调度器设计。
- [Aleksa Gordic — Inside vLLM](https://www.aleksagordic.com/blog/vllm) — 包含火焰图的详细 V1 调度器讲解。
