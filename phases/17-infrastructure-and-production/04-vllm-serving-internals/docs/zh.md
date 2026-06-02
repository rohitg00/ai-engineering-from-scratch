# vLLM 服务内幕：PagedAttention、连续批处理、分块 prefill

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> vLLM 在 2026 年的统治地位不是靠某一个绝招，而是靠三个互相叠加的默认设置。PagedAttention 永远开着。连续批处理（continuous batching）会在两次 decode 迭代之间，把新请求注入到正在运行的 batch 里。分块 prefill（chunked prefill）把长 prompt 切片，让 decode token 永远不会被饿着。三个全开，单卡 H100 SXM5 上跑 Llama 3.3 70B FP8、128 并发，能推到 2,200–2,400 tok/s——大约比 vLLM 自己的默认值高 25%，是朴素 PyTorch 循环的 3–4 倍。本课会把调度器和 attention（注意力）kernel 讲到你能画出图的程度，最后用 `code/main.py` 里一个玩具版的连续批处理器，按 vLLM 的方式调度 prefill 和 decode 收尾。

**Type:** Learn
**Languages:** Python（标准库实现的玩具版连续批处理调度器）
**Prerequisites:** Phase 17 · 01（Model Serving）、Phase 11（LLM Engineering）
**Time:** ~75 minutes

## 学习目标（Learning Objectives）

- 把 PagedAttention 解释成一个 KV cache 分配器：block、block table，以及为什么生产负载下碎片率能压在 4% 以下。
- 在迭代级别画出连续批处理：已完成的序列怎么离开 batch、新序列怎么不排空就加入。
- 用一句话描述分块 prefill，并说出它保护的是哪条延迟指标（提示：是 TTFT 的尾部，不是平均吞吐）。
- 说出 2026 年 vLLM v0.18.0 那个一开全所有优化就翻车的坑。

## 问题（The Problem）

朴素的 PyTorch 服务循环一次只跑一个请求：tokenize、prefill、decode 直到 EOS、返回。一个用户没问题。一百个用户，那就是一队耐心的人。最显而易见的修法——静态批处理——会把每个请求 padding 到窗口里最长的那个 prompt，把每段 decode padding 到最长的预期输出，然后让整个 batch 卡在最慢那条序列上。你为没用上的 padding 付费，快请求还得等慢请求。

vLLM 一次解决三个问题。PagedAttention 阻止 KV cache 碎片像传统连续分配那样吃掉 60–80% 的 GPU 显存。连续批处理让请求能在每两次 decode 迭代之间加入或离开 batch，所以 batch 里永远塞满真活儿。分块 prefill 把 32k token 的 prompt 切成 ~512 token 的小片，与 decode 交错执行，这样一个长 prompt 就不会把 GPU 上每一个 decode token 都冻住。

2026 年的生产默认就是三个全开。你需要理解每一个具体在干什么，因为出问题的地方都在调度器，而不在模型。

## 概念（The Concept）

### 把 PagedAttention 当虚拟内存系统看

每条序列的 KV cache 是 `num_layers × 2 × num_heads × head_dim × seq_len × bytes_per_element`。对 Llama 3.3 70B、8192 token，BF16 下大约是每条序列 1.25 GB。如果你给每个请求都预留 8192 个槽位，但平均请求只用 1500 token，那你预留的 HBM 大约浪费了 82%。传统批处理就在交这份税。

PagedAttention 借用了操作系统虚拟内存的思路。KV cache 不是按序列连续分配的。它是按固定大小的 block 分配的（默认 16 token）。每条序列有一张 block table，把它逻辑上的 token 位置映射到物理 block ID。当一条序列长过它已分配的 block，就再加一个 block。当它结束时，它的 block 回到池子里。

碎片从 60–80%（传统）降到 4% 以下（PagedAttention）。你不会用某个 flag 去启用 PagedAttention——它是 vLLM 唯一的分配器。可调的旋钮是 `--gpu-memory-utilization`（默认 0.9），告诉 vLLM 在加载完权重和激活之后，留多少 HBM 给 KV block。

### 在迭代级别看连续批处理

老式的"动态批处理"会等一个时间窗（比如 10 ms）把 batch 凑满，然后跑 prefill + decode + decode + decode，直到所有序列都结束。快序列早早离开，然后空着等 GPU 把慢序列跑完。

连续批处理在每两次 decode 之间动作。把当前正在跑的序列集合叫做 `RUNNING`。每次迭代：

1. `RUNNING` 里任何刚命中 EOS 或 max_tokens 的序列被移除。
2. 调度器看 waiting 队列。如果还有空闲的 KV block，就准入新序列（prefill 或恢复）。
3. 在现在的 `RUNNING` 上跑一次前向传播，每条序列吐一个新 token。

batch size 永远不会被 padding 到一个固定数。处于不同输出位置的序列共用同一次融合的前向。在 2026 的 vLLM 里，这叫 `V1 scheduler`。关键不变量：调度器是每次 decode 迭代跑一次，不是每个请求跑一次。

### 分块 prefill 保护的是 TTFT 尾部

prefill 是 compute-bound 的。Llama 3.3 70B 上一段 32k token 的 prompt，在单卡 H100 上纯 prefill 大约要 800 ms。prefill 在跑的时候，batch 里其他每条序列的 decode token 都在等。在一个服务循环里，一条长 prompt 的首 token 延迟（TTFT）会变成另外几十个用户的 token 间延迟（ITL）抖动。

分块 prefill 把 prefill 切成固定大小的 chunk（默认 512 token），把每个 chunk 当作一个调度单元。chunk 之间，调度器可以让 decode 序列各前进一个 token。你拿一点点绝对的 prefill 延迟代价（每个 chunk 几毫秒），换来 decode 时延抖动大幅下降。在公开 benchmark 里，混合负载下的 P99 ITL 从 ~50 ms 降到 ~15 ms。

### 三个默认互相依赖

这三项都假定了对方的存在。PagedAttention 给调度器提供一个粒度足够细的 KV 资源去权衡。连续批处理需要这种细粒度资源，这样准入新序列才不会触发全局重排。分块 prefill 是调度器在同一张 `RUNNING` 列表上做出的决定——它只是多一条调度策略，不是另一个独立系统。

你不需要记住每一个 flag。你需要知道调度器在优化什么：在 KV-block 预算下的 goodput，并受分块 prefill 切片约束。

### 2026 v0.18.0 的那个坑

在 vLLM v0.18.0 里，你不能把 `--enable-chunked-prefill` 和 draft-model 形式的 speculative decoding（投机解码，`--speculative-model`）一起开。文档列出的例外是 V1 scheduler 里的 N-gram GPU speculative decoding。把所有 flag 都打开却没读 release notes 的团队，会在启动时拿到一个运行时报错，而不是悄悄性能回退。如果你之前的 speculative 收益就是为了能开分块 prefill 才上的，重新评估一下——2026 年大多数情况下正确答案是不开分块 prefill 的 EAGLE-3，而不是一个根本编不过去的 draft model 加分块 prefill。

### 你应该记住的几个数字

- Llama 3.3 70B FP8、H100 SXM5、128 并发、三个全开：2,200–2,400 tok/s。
- 同模型，vLLM 默认（不开分块 prefill）：~1,800 tok/s。
- 同模型，朴素 PyTorch 前向循环：~600 tok/s。
- 生产负载下 PagedAttention 的 KV 碎片浪费：<4%。
- 混合负载下的 P99 ITL：开分块 prefill ~15 ms，不开 ~50 ms。

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

`code/main.py` 就是这个循环，用 Python 标准库写，token 数和前向延迟都是假的。跑一下你会看到分块 prefill 怎么在一段长 prefill 期间让 decode 序列继续推进。

## 用起来（Use It）

`code/main.py` 模拟一个 vLLM 风格的调度器，特性可开可关。跑起来你会看到：

- `NAIVE` 模式：一次一个请求，没有批处理。
- `STATIC` 模式：padding 等齐，传统批处理。
- `CONTINUOUS` 模式：迭代级别的准入和释放。
- `CONTINUOUS + CHUNKED` 模式：prefill 切片与 decode 交错。

输出会展示总吞吐（每虚拟秒的 token 数）、TTFT 均值、P99 ITL。在混合流量下，`CONTINUOUS + CHUNKED` 那一行应当压倒其他几行。

## 上线部署（Ship It）

本课产出 `outputs/skill-vllm-scheduler-reader.md`。给定一份服务配置（batch size、KV 内存利用率、分块 prefill 大小、speculative 配置），它会输出一份调度器诊断，指出三个默认里哪一个是瓶颈，以及该调什么。

## 练习（Exercises）

1. 跑 `code/main.py`。在长短请求混合的负载上对比 `STATIC` 和 `CONTINUOUS`。吞吐差距来自哪里——prefill 效率、decode 效率，还是尾部延迟？
2. 修改这个玩具调度器加上 `--max-num-batched-tokens`。在 H100 上跑 Llama 3.3 70B FP8 时这个值应该设成多少？（提示：它是 KV block 大小和空闲 block 数的函数，不是裸 HBM 的函数。）
3. 重读 vLLM v0.18.0 的 release notes。哪些 flag 组合是互斥的？列出来。
4. 给一份 1,000 个请求的轨迹，平均 1,500 个输出 token、标准差 600 token，分别计算 (a) 按请求连续分配到 8192 上限、(b) 16-token block 的 PagedAttention 下，KV cache 的碎片浪费各是多少。
5. 用一段话解释为什么分块 prefill 单独看能改善 P99 ITL 但不改善吞吐。实际中那部分吞吐收益是从哪儿来的？

## 关键术语（Key Terms）

| 术语 | 大家嘴上说的 | 它实际指的 |
|------|----------------|------------------------|
| PagedAttention | "那个 KV 黑科技" | KV cache 的固定大小 block 分配器；碎片 <4% |
| Block table | "页表" | 每条序列上、从逻辑 token 位置到物理 KV block 的映射 |
| Continuous batching | "动态批处理，但做对了" | 准入/释放决策每次 decode 迭代都做一次 |
| Chunked prefill | "prefill 切片" | 把长 prefill 切成 512-token 小片与 decode 交错 |
| TTFT | "首 token 时间" | prefill + 排队 + 网络；长 prompt 下由 prefill 主导 |
| ITL | "token 间延迟" | 相邻 decode token 之间的间隔；由 batch size 主导 |
| Goodput | "满足 SLO 的吞吐" | 仍然命中 TTFT 和 ITL 目标的每秒 token 数 |
| V1 scheduler | "新调度器" | vLLM 在 2026 年的调度器；N-gram speculative decoding 是与分块 prefill 兼容的那条路 |
| `--gpu-memory-utilization` | "内存旋钮" | 加载权重和激活后留给 KV block 的 HBM 比例 |

## 延伸阅读（Further Reading）

- [vLLM documentation — Speculative Decoding](https://docs.vllm.ai/en/latest/features/spec_decode/) —— 关于分块 prefill 与 speculative decoding 兼容性的官方源头。
- [vLLM Release Notes (NVIDIA)](https://docs.nvidia.com/deeplearning/frameworks/vllm-release-notes/index.html) —— 2026 年的发布节奏和版本特定行为。
- [vLLM Blog — PagedAttention](https://blog.vllm.ai/2023/06/20/vllm.html) —— 仍在定义"该怎么思考这个分配器"的原始博文。
- [PagedAttention paper (arXiv:2309.06180)](https://arxiv.org/abs/2309.06180) —— 碎片分析与调度器设计。
- [Aleksa Gordic — Inside vLLM](https://www.aleksagordic.com/blog/vllm) —— 带火焰图的 V1 scheduler 详解。
