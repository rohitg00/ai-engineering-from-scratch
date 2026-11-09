# 服务引擎内部 页面注意,连续批量,零碎预填

> 现代服务引擎的吞吐量依赖于三个合并默认, 网页关注总是开放. 连续批量将新的请求注入解码代之间. 碎片的预填片长时间提示,所以解码代码永远不会饿死. 启动三种,一个H100 SXM5上的Llama 3.3 70B FP8在128次同时下推出2,200-2,400个/秒,大约比VLLM的默认高25%, 是所有三种技术的参考引擎在一个你可以图表的水平上,并结束在玩具连续批量`code/main.py`时间表像VLLM一样预填和解码.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy continuous batching scheduler)
**Prerequisites:** Phase 17 · 01 (Model Serving), Phase 11 (LLM Engineering)
**Time:** ~75 minutes

## 学习目标

- 解释PagedAttention作为KV缓存分配器:区块,区块表,以及为什么在生产负载时碎片化保持在4%以下.
- 在反复级别上进行连续批量图:完成的序列如何离开批量,而新的序列如何在没有排水的情况下加入.
- 描述一个句子中的零件预填写,并命名它保护的延迟指标 (提示:这是同时解码的ITL尾巴,而不是平均吞吐量).
- 在一次启用每个优化之前,请检查您的版本的vLLM功能组合与兼容性矩阵.

## 问题

一个天真的 PyTorch 服务循环一次执行一个请求:代码化,预填,解码到 EOS,返回. 在一个用户上,这就有效了. 百人,是一队耐心的人. 显而易见的解决方案是: 静态批量 将每个请求都将放在窗口中最长的提示,每个解码都将被放在最长的预期输出中,并且将整个批量停滞在最慢的序列中. 你付钱买不用的填充, 快速的请求等待缓慢的请求.

机可以同时解决三个问题. 页面注意力阻止KV缓存碎片化消耗60至80%的GPU内存, 连续批量允许请求在每个解码反复之间加入和离开批量,所以批量总是充满了真正的工作. 碎片预填将32k代码提示分解为512代码切片,与解码交互,因此长时间的提示不会结 GPU上的每个解码代码.

需要了解每个机器的操作,因为失败模式都在调度器上,而不是模型上.

## 概念

### 页面关注作为虚拟内存系统

一个KV缓存是`num_layers × 2 × num_heads × head_dim × seq_len × bytes_per_element`如果您预先预订每次请求的8192个插槽,但平均请求只使用1500个插座,您将浪费约82%的预订的HBM.经典批量支付了这个浪费.

页面注意从OS虚拟内存借用这个想法.KV缓存不连续于每个序列.它分为固体尺寸的块 (默认16个代币).每个序列都有一个区块表,将其逻辑代币位置映射到物理区块ID.当一个序列越来越多,其分配的区块被添加了另一个区块.当它完成时,其区块返回池中.

,它是唯一的分配器vLLM船只. 按是`--gpu-memory-utilization`(默认0.9),该文件告诉vLLM在加载重量和激活后,HBM应为KV块保留多少.

### 在反复级别的连续批量

旧的"动态批量"等待一个窗口 (例如10 ms) 填充批量,然后运行预填+解码+解码+解码+解码直到每个序列完成.快速序列早就离开了,停留在空中,而GPU完成了缓慢的序列.

连续批量在每个解码步骤之间运行.`RUNNING`在每次代时:

1. 任何序列`RUNNING`现在,我们可以将 EOS 输入到 EOS 输入中,
2. 编程器看待排队.如果有免费的KV块,它会允许新的序列 (预填或恢复).
3. 进口通行是现在的任何东西.`RUNNING`发出每次一个新的代币.

批量尺寸从来没有被到固定数量.在不同位置的序列在输出中共享一个前进的融合.`V1 scheduler`关键不变:调节器每次解码反复运行一次,而不是每次请求.

### 碎片预填保护ITL尾部

在Llama 3.3 70B上使用32k代币提示需要在一个H100上使用800ms的纯预填.在预填运行期间,在批量等待中,对每个其他序列进行代码解码.在服务循环中,一个长时间的提示的第一代币延迟 (TTFT) 成为数十个其他用户的代币间延迟 (ITL) 漏洞.

按零件预填分成固定尺寸的零件 (默认512个代币) 并将每个零件作为单位安排.在零件之间,计程师可以提升一个代码序列.您以较低的解码时间位换取一个小的绝对预填延迟 (每零件数 ms).在发布的基准中,混合负载下 P99 ITL 从 ~ 50 ms 到 ~ 15 ms 降低.

### 三个默认互动

随着时间表的推进,可实现一个新的测量,即将进行测量. 随着时间表的推进,可实现一个新的测量.`RUNNING`                                                                                                                                                                                                                                                              

你不需要知道每一个旗,你需要知道调度器优化什么:KV区块预算下,

### 检查兼容性矩阵

在一次启用它们之前,请检查每个功能组合与兼容性矩阵的确切vLLM版本,因为版本之间构成的内容会发生变化. 在v0.18.0中,特征矩阵标记了投机解码与分块预填和预写缓存兼容,投机解码页面列出了两个已知不兼容性:通过v0.15.0的管道平行性,通过v0.10.0的草案模型投机性. 对于草案方法本身,2026年默认通常是EAGLE-3 (`"method": "eagle3"`),包括17期 · 05.

### 你应该记住的数字

- 拉马3.3 70B FP8,H100 SXM5,128同时,所有三种都在: 2,200-2,400 /秒.
- 模板相同,默认vLLM (没有碎片预填): ~ 1,800 tok/s.
- 模特相同,纯粹的 PyTorch 前进循环: ~600通/秒.
- 在生产负载下,KV碎片化废物在 PagedAttention下: <4%.
- 混合载荷下 P99 ITL: ~15 ms,含有碎片预填,没有含有 ~50 ms.

### 时间表表的样子

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

`code/main.py`运行它显示了如何在长时间的预填中保持解码序列的活力.

```figure
tensor-parallel
```

## 用它

`code/main.py`模拟一个可转换功能的vLLM类型的调度器.运行它,以查看:

- `NAIVE`模式:一次一次要求,无批量.
- `STATIC`模式: 片和等待,经典的批量.
- `CONTINUOUS`模式:回复级的接入和释放.
- `CONTINUOUS + CHUNKED`模式:用解码插入的预填片.

输出显示了总吞吐量 (每虚拟秒的代币),TTFT平均值和P99ITL.`CONTINUOUS + CHUNKED`排列应在混合交通中占主导地位.

## 运送它

这一课产生了`outputs/skill-vllm-scheduler-reader.md`鉴于服务配置 (批量大小,KV内存使用,零碎预填尺寸,投机配置),它产生了一个调度器诊断,该诊断列出三个默认缺陷中的哪个是瓶和什么调节.

## 运动

1. 跑步`code/main.py`比较`STATIC`为了`CONTINUOUS`预填效率,解码效率或尾延迟的产量差距来自哪里?
2. 修改玩具调节器`--max-num-batched-tokens`运行Llama 3.3 70B FP8的H100的正确值是什么? (提示:它是KV块大小和数量的函数,而不是原始HBM).
3. 列出哪些旗组合是相互排斥的?
4. 计算KV缓存碎片化废物为1000个请求的追踪,平均输出代币为1,500个,STD600代币,根据 (a) 每次请求分配的连续性最高为8192, (b) PagedAttention,含16代币块.
5. 解释一段落,为什么碎片预填有助于P99ITL,但不单独地提供产量.

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| PagedAttention | "the KV trick" | Fixed-size block allocator for KV cache; fragmentation <4% |
| Block table | "the page table" | Per-sequence map from logical token position to physical KV block |
| Continuous batching | "dynamic batching, but right" | Admit/release decisions made every decode iteration |
| Chunked prefill | "prefill splitting" | Break long prefill into 512-token slices interleaved with decode |
| TTFT | "first token time" | Prefill + queue + network; dominated by prefill at long prompts |
| ITL | "inter-token latency" | Time between consecutive decode tokens; dominated by batch size |
| Goodput | "throughput that meets SLO" | Requests/sec that still hit TTFT and ITL targets (Phase 17 · 08 reports it as the share of requests) |
| V1 scheduler | "the new scheduler" | vLLM's 2026 scheduler; runs continuous batching with chunked prefill |
| `--gpu-memory-utilization` | "the memory knob" | Fraction of HBM reserved for KV blocks after weights and activations |

## 进一步阅读

- [vLLM documentation — Speculative Decoding](https://docs.vllm.ai/en/latest/features/spec_decode/)关于零碎预填和投机解码兼容性的官方来源.
- [vLLM Release Notes (NVIDIA)](https://docs.nvidia.com/deeplearning/frameworks/vllm-release-notes/index.html) 2026 发布序列和版本特定行为.
- [vLLM Blog — PagedAttention](https://blog.vllm.ai/2023/06/20/vllm.html)原始的写作,仍然定义了如何思考分配器.
- [PagedAttention paper (arXiv:2309.06180)](https://arxiv.org/abs/2309.06180) 分裂分析和规划设计.
- [Aleksa Gordic — Inside vLLM](https://www.aleksagordic.com/blog/vllm)详细的V1调度器通过火焰图.
