# 04 · vLLM 推理服务内幕：PagedAttention、连续批处理与分块预填充

> vLLM 在 2026 年的统治地位建立在三个叠加生效的默认特性之上，而不是某个单一技巧。「PagedAttention（分页注意力）」始终开启。「连续批处理（continuous batching）」会在两次解码迭代之间把新请求注入正在运行的批次。「分块预填充（chunked prefill）」会把长提示词切片，让解码 token 永不饿死。把这三者全部打开后，单张 H100 SXM5 上运行的 Llama 3.3 70B FP8 在 128 并发下可达到 2,200-2,400 tok/s——比 vLLM 自带默认配置高约 25%，是朴素 PyTorch 循环的 3-4 倍。本课会把调度器和注意力内核讲到你能画出图的程度，并以 `code/main.py` 中一个玩具级连续批处理器收尾，它会用 vLLM 的方式调度预填充与解码。

**类型：** 学习
**语言：** Python（标准库，玩具级连续批处理调度器）
**前置：** 阶段 17 · 01（模型服务）、阶段 11（LLM 工程）
**时长：** 约 75 分钟

## 学习目标

- 把 PagedAttention 解释为一种 KV 缓存分配器：块（block）、块表（block table），以及为什么在生产负载下碎片率能保持在 4% 以下。
- 在迭代层面画出连续批处理：已完成的序列如何离开批次，新序列如何加入而无需排空整个批次。
- 用一句话描述分块预填充，并说出它保护的是哪一项延迟指标（提示：是 TTFT 尾延迟，而非平均吞吐量）。
- 说出 2026 年 vLLM v0.18.0 的那个坑——它专坑那些一次性打开所有优化的团队。

## 问题所在

朴素的 PyTorch 服务循环一次只处理一个请求：分词、预填充、解码直到 EOS、返回。在单用户场景下这能用。在一百个用户面前，它就是一队耐心排队的人。显而易见的修补办法——「静态批处理（static batching）」——会把每个请求都填充（pad）到窗口内最长的提示词长度，把每次解码填充到最长的预期输出长度，并让整个批次卡在最慢的那条序列上。你为从未用到的填充付费，快请求还得等慢请求。

vLLM 一次性解决三个问题。PagedAttention 阻止了 KV 缓存碎片像经典连续分配那样吃掉 60-80% 的 GPU 显存。连续批处理让请求能在每次解码迭代之间加入和离开批次，从而让批次里始终装满真正的工作。分块预填充把一个 32k token 的提示词拆成约 512 token 的切片，与解码交错执行，这样一个长提示词就不会把 GPU 上每一个解码 token 都冻住。

2026 年的生产默认配置是三者全开。你需要理解每一个特性各自做什么，因为它们的失效模式全都出在调度器上，而不是模型上。

## 概念解析

### 把 PagedAttention 当作虚拟内存系统

每条序列的 KV 缓存大小为 `num_layers × 2 × num_heads × head_dim × seq_len × bytes_per_element`。对于 Llama 3.3 70B、8192 token 而言，在 BF16 下每条序列约为 1.25 GB。如果你为每个请求都预留 8192 个槽位，但平均请求只用到 1500 token，你就浪费了所预留 HBM 中约 82% 的空间。经典批处理正是要为这份浪费买单。

PagedAttention 借鉴了操作系统虚拟内存的思路。KV 缓存不再是每条序列一段连续内存，而是以固定大小的块（默认 16 token）来分配。每条序列拥有一张块表，把它的逻辑 token 位置映射到物理块 ID。当序列增长超出已分配的块时，就再追加一个块。序列完成后，它的块归还到池子里。

碎片率从（经典方案的）60-80% 降到（PagedAttention 的）4% 以下。你无需用某个开关来启用 PagedAttention——它是 vLLM 唯一发布的分配器。可调旋钮是 `--gpu-memory-utilization`（默认 0.9），它告诉 vLLM 在加载权重和激活之后留出多少 HBM 用于 KV 块。

### 迭代层面的连续批处理

旧的「动态批处理（dynamic batching）」会等待一个窗口（比如 10 ms）来填满一个批次，然后运行预填充 + 解码 + 解码 + 解码，直到每条序列都完成。快序列早早离场，然后干等着 GPU 把慢序列跑完。

连续批处理工作在每个解码步之间。把正在运行的序列集合称为 `RUNNING` 列表。在每次迭代中：

1. 任何刚刚触及 EOS 或 max_tokens 的 `RUNNING` 序列会被移除。
2. 调度器查看等待队列。如果有空闲的 KV 块，它就接纳新序列（预填充或恢复的序列）。
3. 前向传播在此刻的 `RUNNING` 集合上运行，为每条序列发出一个新 token。

批次大小从不被填充到某个固定值。处于输出不同位置的序列共享同一次融合的前向传播。在 2026 年的 vLLM 中，这被称为 `V1 scheduler`。关键不变式是：调度器每次解码迭代运行一次，而不是每个请求运行一次。

### 分块预填充保护 TTFT 尾延迟

预填充是计算受限（compute-bound）的。一个 32k token 的提示词在 Llama 3.3 70B 上、单张 H100 需要约 800 ms 的纯预填充时间。在预填充运行期间，批次中其他每一条序列的解码 token 都得等着。在服务循环里，一个长提示词的首 token 延迟（TTFT）会变成其他数十个用户的「token 间延迟（ITL）」抖动。

分块预填充把预填充切成固定大小的块（默认 512 token），并以块为单位进行调度。在块与块之间，调度器可以把解码序列推进一个 token。你用一点点绝对预填充延迟的代价（每块多几毫秒）换来大幅降低的解码时抖动。在公开的基准测试中，混合负载下的 P99 ITL 从约 50 ms 降到约 15 ms。

### 三个默认特性相互依赖

这三个特性彼此假定对方存在。PagedAttention 给了调度器一种细粒度的 KV 资源用来权衡取舍。连续批处理需要这种细粒度资源，这样接纳一个新序列才不会强制全局重排。分块预填充则是调度器在同一个 `RUNNING` 列表上做出的一个决策——它只是多了一条调度策略，而非一个独立的系统。

你不需要知道每一个标志位。你需要知道调度器在优化什么：在 KV 块预算约束下、并受分块预填充切片约束的「有效吞吐（goodput）」。

### 2026 年 v0.18.0 的坑

在 vLLM v0.18.0 中，你无法把 `--enable-chunked-prefill` 与草稿模型推测解码（`--speculative-model`）组合使用。文档中记载的例外是 V1 调度器中的 N-gram GPU 推测解码。那些不读发布说明就把每个标志位全打开的团队，会在启动时拿到一个运行时错误，而不是一次温和的性能退化。如果你的推测解码收益值得为之启用分块预填充，那就重新审视这个选择——2026 年的正确答案往往是不带分块预填充的 EAGLE-3，而不是一个草稿模型加上一个根本编译不通过的分块预填充。

### 你应该记住的数字

- Llama 3.3 70B FP8、H100 SXM5、128 并发、三者全开：2,200-2,400 tok/s。
- 同款模型，vLLM 默认配置（无分块预填充）：约 1,800 tok/s。
- 同款模型，朴素 PyTorch 前向循环：约 600 tok/s。
- 生产负载下 PagedAttention 的 KV 碎片浪费：<4%。
- 混合负载下的 P99 ITL：带分块预填充约 15 ms，不带约 50 ms。

### 调度器长什么样

```
while True:
    finished = [s for s in RUNNING if s.is_done()]
    for s in finished: release_blocks(s); RUNNING.remove(s)

    while WAITING and have_free_blocks_for(WAITING[0]):
        s = WAITING.pop(0)
        allocate_initial_blocks(s)
        RUNNING.append(s)

    # 在一个批次里调度预填充块 + 解码
    batch = []
    for s in RUNNING:
        if s.in_prefill:
            batch.append(next_prefill_chunk(s))   # 例如 512 个 token
        else:
            batch.append(decode_one_token(s))     # 1 个 token

    run_forward(batch)                            # 一次融合的 GPU 调用
```

`code/main.py` 就是用标准库 Python 实现的这个循环，配以假的 token 计数和假的前向延迟。运行它能展示分块预填充如何在一次长预填充期间让解码序列保持存活。

## 上手实践

`code/main.py` 模拟了一个 vLLM 风格的调度器，其特性可逐项开关。运行它可以看到：

- `NAIVE` 模式：一次一个请求，无批处理。
- `STATIC` 模式：填充并等待，即经典批处理。
- `CONTINUOUS` 模式：迭代层面的接纳与释放。
- `CONTINUOUS + CHUNKED` 模式：预填充切片与解码交错执行。

输出会显示总吞吐量（每虚拟秒 token 数）、TTFT 均值和 P99 ITL。在混合流量下，`CONTINUOUS + CHUNKED` 那一行应当占优。

## 交付物

本课产出 `outputs/skill-vllm-scheduler-reader.md`。给定一份服务配置（批次大小、KV 内存利用率、分块预填充大小、推测解码配置），它会产出一份调度器诊断，指出三个默认特性中哪一个正在成为瓶颈，以及该调什么。

## 练习

1. 运行 `code/main.py`。在一个混合了短请求与长请求的工作负载上，对比 `STATIC` 与 `CONTINUOUS`。吞吐量差距来自哪里——预填充效率、解码效率，还是尾延迟？
2. 修改这个玩具调度器，加入 `--max-num-batched-tokens`。对于运行 Llama 3.3 70B FP8 的 H100，正确的取值是多少？（提示：它是 KV 块大小和空闲块数量的函数，而不是裸 HBM 大小的函数。）
3. 重读 vLLM v0.18.0 发布说明。哪些标志位组合是互斥的？把它们列出来。
4. 计算这样一段 trace 的 KV 缓存碎片浪费：1,000 个请求，输出 token 均值 1,500、标准差 600，分别在 (a) 以 8192 为上限的每请求连续分配，(b) 16 token 块的 PagedAttention 两种方案下。
5. 用一段话解释为什么分块预填充在孤立来看能改善 P99 ITL 却不能改善吞吐量。在实践中，吞吐量的提升又从何而来？

## 关键术语

| 术语 | 大家怎么说 | 实际含义 |
|------|----------------|------------------------|
| PagedAttention | “那个 KV 小技巧” | KV 缓存的固定大小块分配器；碎片率 <4% |
| Block table（块表） | “页表” | 每条序列从逻辑 token 位置到物理 KV 块的映射 |
| Continuous batching（连续批处理） | “动态批处理，但做对了” | 接纳/释放决策在每次解码迭代时做出 |
| Chunked prefill（分块预填充） | “预填充切分” | 把长预填充拆成 512 token 切片，与解码交错执行 |
| TTFT | “首 token 时间” | 预填充 + 排队 + 网络；长提示词时由预填充主导 |
| ITL | “token 间延迟” | 相邻解码 token 之间的时间；由批次大小主导 |
| Goodput（有效吞吐） | “满足 SLO 的吞吐量” | 每个请求仍达到 TTFT 和 ITL 目标的那部分 tokens/sec |
| V1 scheduler | “新调度器” | vLLM 2026 年的调度器；N-gram 推测解码是与分块预填充兼容的路径 |
| `--gpu-memory-utilization` | “那个内存旋钮” | 加载权重和激活后预留给 KV 块的 HBM 比例 |

## 延伸阅读

- [vLLM 文档 —— 推测解码](https://docs.vllm.ai/en/latest/features/spec_decode/) —— 关于分块预填充与推测解码兼容性的官方来源。
- [vLLM 发布说明（NVIDIA）](https://docs.nvidia.com/deeplearning/frameworks/vllm-release-notes/index.html) —— 2026 年的发布节奏与特定版本的行为。
- [vLLM 博客 —— PagedAttention](https://blog.vllm.ai/2023/06/20/vllm.html) —— 那篇至今仍定义了如何思考这个分配器的原始文章。
- [PagedAttention 论文（arXiv:2309.06180）](https://arxiv.org/abs/2309.06180) —— 碎片分析与调度器设计。
- [Aleksa Gordic —— Inside vLLM](https://www.aleksagordic.com/blog/vllm) —— 配有火焰图的详细 V1 调度器讲解。
