# 推理引擎内部机制 — PagedAttention、Continuous Batching、Chunked Prefill

> 现代推理引擎的吞吐量建立在三个相互叠加的默认机制之上，而不是单一的技巧。PagedAttention 始终开启。Continuous batching 在 decode 迭代之间将新请求注入活跃批次。Chunked prefill 将长 prompt 切分，使 decode token 永远不会挨饿。三者全部开启后，单张 H100 SXM5 上的 Llama 3.3 70B FP8 在 128 并发下可达到 2,200-2,400 tok/s —— 比 vLLM 自身默认配置高出约 25%，是朴素 PyTorch 循环的 3-4 倍。本课以你可以画出图来的深度解读 vLLM —— 这三种技术的参考引擎 —— 的调度器和 attention kernel，并以一个用 `code/main.py` 实现的、按照 vLLM 方式调度 prefill 和 decode 的玩具级 continuous batcher 收尾。

**Type:** Learn
**Languages:** Python (stdlib, toy continuous batching scheduler)
**Prerequisites:** Phase 17 · 01 (Model Serving), Phase 11 (LLM Engineering)
**Time:** ~75 分钟

## 学习目标

- 将 PagedAttention 解释为一种 KV cache 分配器：块、块表，以及为什么在生产负载下碎片率保持在 4% 以下。
- 在迭代层面画出 continuous batching 的图示：已完成的序列如何离开批次、新序列如何加入而不清空批次。
- 用一句话描述 chunked prefill，并说出它保护的是哪个延迟指标(提示:是 TTFT 尾延迟，不是平均吞吐量)。
- 说出 2026 年 vLLM v0.18.0 中会让同时开启所有优化的团队踩坑的问题。

## 问题所在

朴素的 PyTorch 推理循环一次只处理一个请求：tokenize、prefill、decode 直到 EOS、返回。只有一个用户时没问题。有一百个用户时，就成了一队耐心等待的人。显而易见的修复方案 —— static batching —— 将每个请求填充到窗口内最长的 prompt,将每次 decode 填充到预期的最长输出，然后整个批次被最慢的序列拖住。你为从未使用的 padding 付费，而快请求还要等慢请求。

vLLM 一次解决三个问题。PagedAttention 阻止 KV cache 碎片像经典连续分配那样吃掉 60-80% 的 GPU 显存。Continuous batching 允许请求在每次 decode 迭代之间加入和离开批次，因此批次始终装满真实的工作。Chunked prefill 将一个 32k token 的 prompt 拆成约 512 token 的切片，与 decode 交错执行，因此一个长 prompt 不会冻结 GPU 上的所有 decode token。

2026 年的生产默认配置是三者全开。你需要理解每一项的作用，因为故障模式全部出在调度器上，而不是模型上。

## 概念

### 作为虚拟内存系统的 PagedAttention

一个 KV cache 每个序列占用 `num_layers × 2 × num_heads × head_dim × seq_len × bytes_per_element`。对于 8192 token 的 Llama 3.3 70B,在 BF16 下每个序列大约 1.25 GB。如果你为每个请求预留 8192 个槽位，但平均请求只使用 1500 个 token,你就浪费了大约 82% 所预留的 HBM。经典 batching 付出了这种浪费的代价。

PagedAttention 借用了操作系统虚拟内存的思想。KV cache 不再按序列连续存放。它以固定大小的块(默认 16 个 token)分配。每个序列有一个块表，将其逻辑 token 位置映射到物理块 ID。当序列增长超过已分配的块时，就再添加一个块。当它完成时，其块归还给池。

碎片率从 60-80%(经典方式)降到 4% 以下(PagedAttention)。你不需要用开关来启用 PagedAttention —— 它是 vLLM 唯一自带的分配器。可调参数是 `--gpu-memory-utilization`(默认 0.9),它告诉 vLLM 在加载权重和激活之后，为 KV 块预留多少 HBM。

### 迭代层面的 Continuous batching

旧的"dynamic batching"等待一个窗口(比如 10 ms)来填满一个批次，然后运行 prefill + decode + decode + decode,直到每个序列都完成。快的序列早早离开，在 GPU 处理慢序列时闲置。

Continuous batching 在每个 decode 步之间运作。把正在运行的序列集合称为 `RUNNING` 列表。在每次迭代中：

1. `RUNNING` 中任何刚达到 EOS 或 max_tokens 的序列被移除。
2. 调度器查看等待队列。如果有空闲的 KV 块，就接纳新序列(prefill 或恢复的)。
3. 前向传播在当前 `RUNNING` 中的所有序列上运行，为每个序列生成一个新 token。

批次大小从不填充到固定数值。处于输出不同位置的序列共享一次融合的前向传播。在 2026 年的 vLLM 中，这被称为 `V1 scheduler`。关键不变量：调度器每个 decode 迭代运行一次，而不是每个请求运行一次。

### Chunked prefill 保护 TTFT 尾延迟

Prefill 是计算受限的。在 Llama 3.3 70B 上处理一个 32k token 的 prompt,在单张 H100 上需要约 800 ms 的纯 prefill。当 prefill 运行时，批次中所有其他序列的 decode token 都在等待。在推理循环中，一个长 prompt 的首 token 延迟(TTFT)变成了数十个其他用户的 token 间延迟(ITL)毛刺。

Chunked prefill 将 prefill 拆分为固定大小的块(默认 512 token),并将每个块作为一个单元调度。在块之间，调度器可以让 decode 序列前进一个 token。你以少量绝对的 prefill 延迟损失(每块几毫秒)换取大幅降低的 decode 期抖动。在已发表的基准测试中，混合负载下的 P99 ITL 从约 50 ms 降到约 15 ms。

### 三个默认机制相互作用

这三个特性互相依赖。PagedAttention 为调度器提供了一种可权衡的细粒度 KV 资源。Continuous batching 需要这种细粒度资源，以便接纳新序列时不必强制全局重排。Chunked prefill 是调度器在同一个 `RUNNING` 列表上做出的决策 —— 它只是又一条调度策略，而不是一个独立的系统。

你不需要了解每一个参数。你需要了解调度器优化的是什么：在 KV 块预算约束下、经 chunked prefill 切片约束的 goodput。

### 2026 年 v0.18.0 的坑

在 vLLM v0.18.0 中，你不能将 `--enable-chunked-prefill` 与 draft-model 投机解码(`--speculative-model`)组合使用。文档中记录的例外是 V1 调度器中的 N-gram GPU 投机解码。没有读发布说明就把所有开关都打开的团队会在启动时遇到运行时错误，而不是软性的性能回退。如果你的投机解码收益值得为它开启 chunked prefill,那就重新审视这个选择 —— 2026 年的正确答案通常是不带 chunked prefill 的 EAGLE-3,而不是无法编译的 draft model 加 chunked prefill。

### 应该记住的数字

- Llama 3.3 70B FP8,H100 SXM5,128 并发，三者全开：2,200-2,400 tok/s。
- 同一模型，vLLM 默认配置(无 chunked prefill):约 1,800 tok/s。
- 同一模型，朴素 PyTorch 前向循环：约 600 tok/s。
- 生产负载下 PagedAttention 的 KV 碎片浪费：<4%。
- 混合负载下的 P99 ITL:有 chunked prefill 约 15 ms,没有约 50 ms。

### 调度器长什么样

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

`code/main.py` 正是用 stdlib Python、假 token 数量和假前向延迟实现的这个循环。运行它可以看到 chunked prefill 如何在长 prefill 期间保持 decode 序列存活。

```figure
tensor-parallel
```

## 使用它

`code/main.py` 模拟了一个可切换特性的 vLLM 风格调度器。运行它可以看到：

- `NAIVE` 模式：一次一个请求，无 batching。
- `STATIC` 模式：填充并等待，经典 batching。
- `CONTINUOUS` 模式：迭代级别的接纳与释放。
- `CONTINUOUS + CHUNKED` 模式:prefill 切片与 decode 交错。

输出显示总吞吐量(每虚拟秒的 token 数)、TTFT 均值和 P99 ITL。在混合流量下，`CONTINUOUS + CHUNKED` 模式应该胜出。

## 上线它

本课产出 `outputs/skill-vllm-scheduler-reader.md`。给定一个推理配置(批次大小、KV 内存利用率、chunked prefill 大小、投机解码配置)，它会产生一份调度器诊断，指出三个默认机制中哪一个是瓶颈，以及该调整什么。

## 练习

1. 运行 `code/main.py`。在包含长短混合请求的工作负载上，比较 `STATIC` 与 `CONTINUOUS`。吞吐量差距来自哪里 —— prefill 效率、decode 效率，还是尾延迟？
2. 修改玩具调度器，加入 `--max-num-batched-tokens`。对于运行 Llama 3.3 70B FP8 的 H100,合适的值是多少？(提示：它是 KV 块大小和空闲块数量的函数，而不是原始 HBM 的函数。)
3. 重读 vLLM v0.18.0 的发布说明。哪些参数组合是互斥的？把它们列出来。
4. 计算一条包含 1,000 个请求(输出 token 均值 1,500、标准差 600)的 trace 在以下情况下的 KV cache 碎片浪费:(a) 每个 8192 上限的按请求连续分配，(b) 使用 16-token 块的 PagedAttention。
5. 用一段话解释为什么 chunked prefill 有助于 P99 ITL,但在孤立情况下无助于吞吐量。实践中的吞吐量收益来自哪里？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|------------------------|------------------------|
| PagedAttention | "KV 技巧" | KV cache 的固定大小块分配器；碎片率 <4% |
| Block table | "页表" | 每个序列的、从逻辑 token 位置到物理 KV 块的映射 |
| Continuous batching | "dynamic batching,但做对了" | 每次 decode 迭代做出接纳/释放决策 |
| Chunked prefill | "prefill 切分" | 将长 prefill 拆成 512-token 切片，与 decode 交错 |
| TTFT | "首 token 时间" | Prefill + 排队 + 网络；在长 prompt 下由 prefill 主导 |
| ITL | "token 间延迟" | 相邻 decode token 之间的时间；由批次大小主导 |
| Goodput | "满足 SLO 的吞吐量" | 每个请求仍达到 TTFT 和 ITL 目标的 tokens/sec |
| V1 scheduler | "新调度器" | vLLM 的 2026 年调度器；N-gram 投机解码是兼容 chunked-prefill 的路径 |
| `--gpu-memory-utilization` | "内存旋钮" | 加载权重和激活后为 KV 块预留的 HBM 比例 |

## 延伸阅读

- [vLLM documentation — Speculative Decoding](https://docs.vllm.ai/en/latest/features/spec_decode/) — 关于 chunked-prefill 与投机解码兼容性的官方来源。
- [vLLM Release Notes (NVIDIA)](https://docs.nvidia.com/deeplearning/frameworks/vllm-release-notes/index.html) — 2026 年的发布节奏与版本特定行为。
- [vLLM Blog — PagedAttention](https://blog.vllm.ai/2023/06/20/vllm.html) — 仍然定义着如何思考这个分配器的原始文章。
- [PagedAttention paper (arXiv:2309.06180)](https://arxiv.org/abs/2309.06180) — 碎片分析与调度器设计。
- [Aleksa Gordic — Inside vLLM](https://www.aleksagordic.com/blog/vllm) — 附带火焰图的详细 V1 调度器讲解。