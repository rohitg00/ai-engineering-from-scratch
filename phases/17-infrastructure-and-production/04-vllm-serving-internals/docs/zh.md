# vLLM服务内部：PagedAttention、连续批处理、分块预填充

> vLLM在2026年的主导地位建立在三个复合默认设置上，而不是单一技巧。PagedAttention始终开启。连续批处理在每个解码迭代之间将新请求注入活动批次。分块预填充将长提示切片，使解码token不会饥饿。将三者全部开启，Llama 3.3 70B FP8在单个H100 SXM5上以128并发推送2,200-2,400 tok/s —— 比vLLM自身默认高约25%，比朴素PyTorch循环快3-4倍。本课程以你可以绘制的级别阅读调度器和注意力内核，并以`code/main.py`中的玩具连续批处理程序结束，该程序以vLLM的方式调度预填充和解码。

**类型：** 学习
**语言：** Python（标准库，玩具连续批处理调度器）
**前置知识：** 第17阶段 · 01（模型服务），第11阶段（LLM工程）
**时间：** 约75分钟

## 学习目标

- 将PagedAttention解释为KV缓存分配器：块、块表，以及为什么碎片在生产负载下保持在4%以下。
- 在迭代级别绘制连续批处理：完成的序列如何离开批次，新序列如何在不排空的情况下加入。
- 用一句话描述分块预填充，并命名它保护哪个延迟指标（提示：是TTFT尾部，不是平均吞吐量）。
- 命名2026年vLLM v0.18.0的陷阱，该陷阱会咬伤一次性启用每个优化的团队。

## 问题

朴素的PyTorch服务循环一次运行一个请求：tokenize、预填充、解码直到EOS、返回。一个用户时这有效。一百个用户时，它是一个耐心人群的队列。明显的修复 —— 静态批处理 —— 将每个请求填充到窗口中最长的提示，将每个解码填充到最长预期输出，并在最慢序列上停滞整个批次。你为你从未使用的填充付费，快速请求等待慢速请求。

vLLM同时解决三个问题。PagedAttention阻止KV缓存碎片像经典连续分配那样吞噬60-80%的GPU内存。连续批处理让每个请求在每个解码迭代之间加入和离开批次，因此批次始终充满实际工作。分块预填充将32k-token提示分成约512-token切片，与解码交错，因此长提示不会冻结GPU上的每个解码token。

2026年生产默认是三者全部开启。你需要理解每个做什么，因为失败模式都在调度器上，不在模型上。

## 概念

### PagedAttention作为虚拟内存系统

KV缓存是每个序列的`num_layers × 2 × num_heads × head_dim × seq_len × bytes_per_element`。对于Llama 3.3 70B在8192 token，BF16中约1.25 GB每序列。如果你为每个请求预保留8192槽但平均请求只使用1500 token，你浪费约82%你保留的HBM。经典批处理支付这种浪费。

PagedAttention从OS虚拟内存借用想法。KV缓存不是每序列连续的。它以固定大小块分配（默认16 token）。每个序列有一个块表，将其逻辑token位置映射到物理块ID。当序列增长超过其分配块时，添加一个块。当它完成时，其块返回池中。

碎片从60-80%（经典）降至4%以下（PagedAttention）。你不用标志启用PagedAttention —— 它是vLLM唯一提供的分配器。旋钮是`--gpu-memory-utilization`（默认0.9），告诉vLLM在加载权重和激活后为KV块保留多少HBM。

### 迭代级别的连续批处理

旧的"动态批处理"等待窗口（比如10毫秒）填充批次，然后运行预填充 + 解码 + 解码 + 解码直到每个序列完成。快速序列提前离开并在GPU完成慢速序列时空闲。

连续批处理在每个解码步骤之间操作。将运行序列集合称为`RUNNING`列表。在每个迭代：

1. `RUNNING`中刚命中EOS或max_tokens的任何序列被移除。
2. 调度器查看等待队列。如果有空闲KV块，它接纳新序列（预填充或恢复）。
3. 前向传递在`RUNNING`中现在无论什么上运行，为每个序列发出一个新token。

批次大小从不填充到固定数字。输出中不同位置的序列共享一个融合前向。在2026年vLLM中这称为`V1调度器`。关键不变量：调度器每个解码迭代运行一次，不是每个请求一次。

### 分块预填充保护TTFT尾部

预填充是计算约束的。Llama 3.3 70B上32k-token提示在单个H100上需要约800毫秒纯预填充。预填充运行时，批次中每个其他序列的解码token等待。在服务循环中，一个长提示的首token延迟（TTFT）成为数十个其他用户的token间延迟（ITL）波动。

分块预填充将预填充分成固定大小块（默认512 token）并将每个块作为单元调度。块之间调度器可以为解码序列推进一个token。你交易小的绝对预填充延迟命中（每块几毫秒）以换取低得多的解码时间抖动。在发布基准测试中，混合负载下P99 ITL从约50毫秒降至约15毫秒。

### 三个默认设置交互

所有三个功能相互假设。PagedAttention给调度器一个细粒度KV资源来交易。连续批处理需要该细粒度资源，因此接纳新序列不会强制全局重组。分块预填充是调度器在同一`RUNNING`列表上做出的决策 —— 它是一个调度器策略，不是单独系统。

你不需要知道每个标志。你需要知道调度器优化什么：KV块预算下的良好吞吐量，受分块预填充切片约束。

### 2026年v0.18.0陷阱

在vLLM v0.18.0中，你不能将`--enable-chunked-prefill`与草稿模型投机解码（`--speculative-model`）组合。记录的例外是V1调度器中的N-gram GPU投机解码。一次性翻转每个标志而不阅读发布说明的团队在启动时得到运行时错误，不是软回归。如果你的投机增益值得为此启用分块预填充，重新审视选择 —— 2026年的正确答案通常是EAGLE-3而不使用分块预填充，不是不编译的草稿模型加分块预填充。

### 你应该记住的数字

- Llama 3.3 70B FP8、H100 SXM5、128并发、三者全部开启：2,200-2,400 tok/s。
- 相同模型、默认vLLM（无分块预填充）：约1,800 tok/s。
- 相同模型、朴素PyTorch前向循环：约600 tok/s。
- 生产负载下PagedAttention的KV碎片浪费：<4%。
- 混合负载下P99 ITL：使用分块预填充约15毫秒，不使用约50毫秒。

### 调度器的样子

```
while True:
    finished = [s for s in RUNNING if s.is_done()]
    for s in finished: release_blocks(s); RUNNING.remove(s)

    while WAITING and have_free_blocks_for(WAITING[0]):
        s = WAITING.pop(0)
        allocate_initial_blocks(s)
        RUNNING.append(s)

    # 在一个批次中调度预填充块 + 解码
    batch = []
    for s in RUNNING:
        if s.in_prefill:
            batch.append(next_prefill_chunk(s))   # 例如512 token
        else:
            batch.append(decode_one_token(s))     # 1 token

    run_forward(batch)                            # 一个融合GPU调用
```

`code/main.py`正是这个循环，使用stdlib Python和假token计数及假前向延迟。运行它显示分块预填充如何在长预填充期间保持解码序列活跃。

## 使用它

`code/main.py`模拟具有可切换功能的vLLM风格调度器。运行它以查看：

- `NAIVE`模式：一次一个请求，无批处理。
- `STATIC`模式：填充并等待，经典批处理。
- `CONTINUOUS`模式：迭代级准入和释放。
- `CONTINUOUS + CHUNKED`模式：与解码交错的预填充切片。

输出显示总吞吐量（每虚拟秒token）、TTFT平均值和P99 ITL。`CONTINUOUS + CHUNKED`行应在混合流量上占主导。

## 交付它

本课程产出`outputs/skill-vllm-scheduler-reader.md`。给定服务配置（批次大小、KV内存利用率、分块预填充大小、投机配置），它产生调度器诊断，命名三个默认设置中哪个是瓶颈以及调整什么。

## 练习

1. 运行`code/main.py`。在具有混合短请求和长请求的工作负载上比较`STATIC`到`CONTINUOUS`。吞吐量差距来自哪里 —— 预填充效率、解码效率，还是尾部延迟？
2. 修改玩具调度器以添加`--max-num-batched-tokens`。对于运行Llama 3.3 70B FP8的H100，正确值是什么？（提示：它是KV块大小和空闲块数量的函数，不是原始HBM。）
3. 重新阅读vLLM v0.18.0发布说明。哪些标志组合互斥？列出它们。
4. 计算在（a）8192最大连续每请求分配，（b）16-token块的PagedAttention下，1000个请求跟踪的KV缓存碎片浪费，平均1500输出token，标准差600 token。
5. 用一段话解释为什么分块预填充帮助P99 ITL但不单独帮助吞吐量。实践中吞吐量胜利来自哪里？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|---------|
| PagedAttention | "KV技巧" | KV缓存的固定大小块分配器；碎片<4% |
| 块表 | "页表" | 每序列从逻辑token位置到物理KV块的映射 |
| 连续批处理 | "动态批处理，但是正确的" | 每个解码迭代做出准入/释放决策 |
| 分块预填充 | "预填充拆分" | 将长预填充拆分为与解码交错的512-token切片 |
| TTFT | "首token时间" | 预填充 + 队列 + 网络；长提示时由预填充主导 |
| ITL | "token间延迟" | 连续解码token之间的时间；由批次大小主导 |
| 良好吞吐量 | "满足SLO的吞吐量" | 每个请求仍命中TTFT和ITL目标的tok/s |
| V1调度器 | "新调度器" | vLLM的2026年调度器；N-gram投机解码是分块预填充兼容路径 |
| `--gpu-memory-utilization` | "内存旋钮" | 权重和激活后为KV块保留的HBM比例 |

## 延伸阅读

- [vLLM文档 —— 投机解码](https://docs.vllm.ai/en/latest/features/spec_decode/) —— 分块预填充和投机解码兼容性的官方来源。
- [vLLM发布说明（NVIDIA）](https://docs.nvidia.com/deeplearning/frameworks/vllm-release-notes/index.html) —— 2026年发布节奏和版本特定行为。
- [vLLM博客 —— PagedAttention](https://blog.vllm.ai/2023/06/20/vllm.html) —— 仍然定义如何思考分配器的原始文章。
- [PagedAttention论文（arXiv:2309.06180）](https://arxiv.org/abs/2309.06180) —— 碎片分析和调度器设计。
- [Aleksa Gordic —— vLLM内部](https://www.aleksagordic.com/blog/vllm) —— 带火焰图的详细V1调度器演练。