# 流水线并行与气泡分析

> 张量并行将矩阵乘法按 rank 切分。流水线并行将模型按 rank 切分，每个 rank 承载一个阶段（stage）。微批次（microbatch）在流水线中流动。开头和结尾的空闲时间就是气泡（bubble）；最小化气泡正是全部技巧所在。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 19 Track C lessons 42-49
**Time:** ~90 min

## 学习目标

- 将一个顺序模型切分为 N 个阶段，并模拟跨 N 个 rank 的前向流水线。
- 使用 GPipe 调度（先全部前向填充，再反向传播）将 M 个微批次调度通过流水线，并计算气泡占比。
- 将气泡与 Megatron-LM 和 PipeDream 使用的交错 1F1B 调度进行比较。
- 论证阶段分配的合理性：每阶段的计算量均衡比每阶段的参数量均衡更重要。

## 问题所在

一个 70B 参数的模型仅参数本身在 fp16 下就需要 140 GB。没有任何消费级 GPU 能装下它。ZeRO-3 将参数按 rank 分片，但每个 rank 在每次前向传播时仍需 allgather 完整层，每层都要付出 log(N) 跳的通信代价。流水线并行走的是另一条路：把模型切成 N 个阶段，每个 rank 放一个阶段。第 1 层的前向在 rank 0 完成后，把激活张量交给 rank 1；rank 1 运行第 2 层再交给 rank 2；以此类推。反向沿相反方向流动。内存随阶段数线性下降，因为每个 rank 只持有自己的阶段；但计算是串行的，这正是气泡问题的来源。

气泡是流水线开头的空闲时间（等待第一个微批次到达最后一个阶段）和结尾的空闲时间（等待最后一个微批次排空回传）。设微批次数为 M、阶段数为 N，则每阶段的气泡占比为 (N-1)/(M+N-1)。M=8、N=4 时为 27%；M=64、N=4 时为 4.5%。每步微批次越多，气泡越小，这意味着每个微批次的 batch size 要小，而这正是驱动微批次设计的约束条件。

## 核心概念

```mermaid
flowchart LR
  R0[rank 0: stage 0 / layer 0] --> R1[rank 1: stage 1 / layer 1]
  R1 --> R2[rank 2: stage 2 / layer 2]
  R2 --> R3[rank 3: stage 3 / loss]
  R3 -.backward.-> R2
  R2 -.backward.-> R1
  R1 -.backward.-> R0
```

### GPipe 调度

在开始任何反向传播之前，先把全部 M 个微批次前向填满流水线；然后反向排空。每个微批次的激活必须一直保留到它的反向传播时刻，因此内存随 M 线性增长。前向需要 M+N-1 个周期，反向又需要 M+N-1 个周期。每阶段的有效工作为 2M 个周期；每阶段的气泡为 2(N-1) 个周期。当前向和反向各占一个时间单位时，气泡占比为 (N-1)/(M+N-1)。选取远大于 N 的 M 可以掩盖气泡。

### 1F1B 调度

交错执行：一旦某个微批次的前向到达最后一个阶段，就立刻启动它的反向传播并让它回流。该调度在每个阶段交替执行一次前向和一次反向。气泡仍然是 N-1，但激活内存的上界取决于流水线深度而不是微批次数量。生产级流水线使用 1F1B（Megatron、PipeDream）。本课先实现 GPipe，因为它更简单，1F1B 留作练习。

### 为什么每阶段计算量均衡很重要

如果阶段 0 耗时 50 ms，阶段 1 耗时 100 ms，那么每个周期都被阶段 1 卡住。其他阶段每个周期空闲 50 ms 等待阶段 1 释放。参数量均衡是错误的衡量轴：Transformer 的计算量由每层的注意力加 MLP 主导，而嵌入层参数多但计算少。阶段分配应当使每阶段的 FLOPs 均衡，而不是每阶段的权重均衡。

### 微批次与批次

流水线运行 M 个大小为 B 的微批次。有效 batch size 为 M*B。流水线一步结束时得到的梯度是对这 M*B 个样本合并计算的梯度。气泡占比取决于 M；优化器看到的是 M*B。调整 M 意味着在气泡（M 越高越低）和每微批次内存（对 GPipe 而言 M 越高激活内存越高）之间权衡。

```figure
cd-pipeline-bubble
```

## 动手实现

`code/main.py` 实现了：

- `PipelineStage`：一个小的 `nn.Module`，持有一个阶段的参数并提供 `forward(activation)`。
- `Pipeline(stages, num_microbatches)`：使用每阶段的模拟墙上时间，在模拟阶段上编排 GPipe 调度。
- `bubble_fraction(num_stages, num_microbatches)`：闭式解 (N-1)/(M+N-1)。
- 一个 4 阶段的演示，打印每个微批次的轨迹和实测气泡占比。

运行它：

```bash
python3 code/main.py
```

输出：一张阶段-微批次甘特图，以及实测气泡百分比与闭式解预测的对比。

## 生产环境中的常见模式

有三种模式让流水线并行足够健壮、可以上线。

**激活检查点与流水线配合使用。** 在 GPipe 上有 M 个微批次同时在途时，激活内存是单个微批次的 M 倍。激活检查点在反向传播时重算前向，用计算换内存；正是这种组合让流水线对长序列变得可行。

**阶段均衡靠测量，而非假设。** 生产团队会运行一次 profiling，在目标硬件上测量每层的实际计算量（FLOPs 和墙上时间），然后按测量结果切分。Megatron-LM 的 `--num-layers-per-stage` 标志接受一个列表，以允许在每层开销不同的阶段之间采用不均匀的层数。

**send-recv 调度必须避免死锁。** 如果每个阶段都先发送后接收，流水线会在通信上死锁。标准修法是交错：偶数 rank 的阶段先 send 后 recv，奇数 rank 的阶段先 recv 后 send。本课显式地调度各 rank，使这一模式清晰可见。

## 实际应用

生产模式：

- **Megatron-LM.** 大规模流水线并行的参考实现。使用 1F1B，并支持张量 + 流水线 + 数据并行的组合。
- **DeepSpeed Pipeline.** 与 ZeRO 集成；ZeRO-1 + 流水线是训练最大的开源模型时的常见组合。
- **PyTorch Pipe.** PyTorch 原生的流水线封装，构建在 `torch.distributed.pipeline.sync.Pipe` 之上。

## 上线衔接

Lesson 80 会把每阶段的参数分片存入分片检查点。Lesson 81 在端到端演示上组合 DDP + ZeRO + 流水线（理念上如此；演示中流水线仍保持模拟以控制运行时）。

## 练习

1. 实现 1F1B，验证其气泡占比与 GPipe 一致，但激活内存有上界。
2. 在更深的模型上剖析真实的每阶段耗时，并按测得的墙上时间重新均衡各阶段。
3. 在流水线微批次上增加梯度累积，并验证该梯度等于等效全量 batch 前向的梯度。
4. 将流水线与激活检查点结合，测量内存下降与计算代价的对比。
5. 将流水线与 DDP 结合（每个流水线 rank 在一个数据并行组内被复制），并推演 2D 调度。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|------------------------|
| Pipeline | "沿深度方向的模型并行" | 每 rank 一个阶段，激活在阶段间流动 |
| Bubble | "流水线空闲时间" | 开头 + 结尾处 (N-1) 步中某些阶段无工作 |
| Microbatch | "批次的一个切片" | 一个前向/反向单元；M 越大气泡越小 |
| GPipe | "先填充再排空" | 全部 M 次前向完成后才开始反向；激活内存高 |
| 1F1B | "交错调度" | 每阶段一次前向一次反向；激活内存有界 |

## 延伸阅读

- [Huang et al, GPipe: Efficient Training of Giant Neural Networks](https://arxiv.org/abs/1811.06965)
- [Narayanan et al, PipeDream: Generalized Pipeline Parallelism for DNN Training](https://arxiv.org/abs/1806.03377)
- [Megatron-LM pipeline parallel docs](https://github.com/NVIDIA/Megatron-LM)
- Phase 19 Lesson 76 - 该调度所用的 send/recv 原语
- Phase 19 Lesson 78 - ZeRO 与流水线正交，且经常结合使用