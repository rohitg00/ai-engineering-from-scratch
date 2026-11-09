# 双管平行

> 通过2 048个H800GPU训练, 跨节点专家的通讯成本为每一个GPU计算的1个GPU-小时. 半个时间,GPU都置. 双管 (DeepSeek,Dec 2024) 是一个双向管道,它与它们触发的通讯互联网重叠前后计算. 由于专家平行主义已经在各个行列中传播专家, 泡下降,吞吐量上升, 这一课是学习类型的, 了解双实际上做什么,以及海人工智能实验室的双V精炼为什么会降低2倍的参数成本,

**Type:** Learn
**Languages:** Python (stdlib, schedule simulator), Rust
**Prerequisites:** Phase 10 · 05 (distributed training, FSDP, DeepSpeed), Phase 10 · 14 (open-model architectures and MoE)
**Time:** ~60 minutes

## 学习目标

- 两管前后面的四个组件,以及为什么每个组件都有自己的窗口.
- 解释了管道泡问题,以及"无泡"在实践中与营销中意味着什么.
- 通过手动追踪双管的时间表,为8个PP级和16个微批量,并确认前向和反向流填补彼此的空.
- 声明DualPipeV (Sea AI Lab, 2025) 所做的交易:在专家平行性不活跃时,以稍大泡的成本降低2倍参数复制.

## 问题

在2KH800GPU上训练671BMoE模型,

1. **Memory pressure.**每个GPU都包含一个模型的片段. 激活内存在8k序列上,在128个头上,在61层上是巨大的.
2. **Pipeline bubbles.**传统的管道平行 (GPipe, 1F1B) 让GPU在等待阶段输入或梯度时停滞不前.在8个阶段,即使是1F1B计划,大约12%的GPU时间也可以泡.
3. **Cross-node all-to-all.**通过专家平行化,MoE将专家分散在节点之间.每一个前进通行都会触发一个全通向向专家发送代币,另一个将代币结合起来.在2kGPU时,这很容易成为1:1计算与通信比率.

每个解决方案都有不同的解决方案:对内存的梯度检查,对管道泡的零泡 (海人工智能实验室, 2023) 双的做法是让他们一起玩. 时间表在一个前后回的部分内覆盖计算和通信,同时从管道的两端注入微批量,并使用结果的时间表在计算窗口内隐藏所有内容.

报告结果:近乎消除了管道泡, 在DeepSeek-V3的14.8T代币训练中使用了超过95%的GPU.

## 概念

### 管道平行性更新

通过P设备分开一个N层模型.`i`保持层次`i * N/P .. (i+1) * N/P - 1`微批流通过设备0向P-1,然后从P-1向0向后流动.每种设备只能在前端设备发出输出时启动前端阶段,而下端设备发出上游梯度时才可以向后流动.

GPipe (Huang等人,2019) 每次安排一个微批次,这浪费了大部分GPU时间. 通过1F1B (Narayanan等,2021年) 进行多个微批次的前后和后后传. 零泡 (Qi等, 2023) 将后退通道分为两个部分 (后退输入 (B) 和后退输入 (W) ,并安排它们填满泡. 气泡后,管道几乎紧张.

双管是下一步,它增加了两个想法:

### 想法1:碎片分解

每个前面的部分分为四个组成部分:

- **Attention.**预测,注意力,输出预测.
- **All-to-all dispatch.**交叉节点通信,向他们的专家发送代币.
- **MLP.**电脑专家计算.
- **All-to-all combine.**通过节点交通信,使专家输出回来.

一个倒退的部分添加了每个这些版本的梯度版本.双管将它们安排,使所有到所有的发送与下一个部分的注意力计算并行,而所有到所有的组合与下一个部分的MLP计算并行.

### 两方向安排

大多数管道计划从0阶段注入微批量,并向P1阶段流动.双管从两端注入微批量.0阶段看到来自那里的前微批量;P1阶段看到来自那里的前微批量.两个流在中间相遇.

为了使这起作用,设备`i`必须保持早期管道层的两者都`i`并且是后期管道层.`P - 1 - i`这就是DualPipe的"双重"部分:每个设备都保留需要服务的模型层的两个副本 (每个方向都需要一个).在DeepSeek-V3的规模上,这是一项2倍的参数复制成本.这是负担得起的,因为专家平行已经分散了MoE专家,这么薄,复制非专家层两次是小子.

重要的是,向前流向的方向和向后流向的方向相叠加,

### 一个手动追踪的时间表

考虑P=4个行,8个微批,分为4个前进/4个倒车.时间从左到右移动;行是设备行.

```
           Time →
rank 0:  F1 F2 F3 F4  F5R F6R F7R F8R  B1 B2 B3 B4  ...
rank 1:     F1 F2 F3  F4/F5R F6R F7R   B1 B2 ...
rank 2:        F1 F2  F3/F5R F4/F6R    B1 ...
rank 3:           F1  F2/F5R F3/F6R    ...
```

读取"F4/F5R"标记:排名1在同一时间段前行于微批4 (在管道中从左到右) 和微批5 (从右到左) 前行.

在排名2的交叉流更早重叠,在排名0和P-1的交叉流最晚重叠.在时间表的稳定的中期,每个排名都在X方向前面和Y方向后面重叠.计算繁忙.前进通行的全通发送器隐藏在后退计算中.全通组合隐藏在前进计算中.泡被挤出.

### 泡会计

标准1F1B管道泡 (每级浪费时间):

```
bubble_1F1B = (P - 1) * forward_chunk_time
```

双管,在稳定的阶段,如果微批次数是可乘以管道深度的2倍的零泡.在稳定的阶段 (加热和冷却) 外,有一些泡,但它不会随着微批次数而增长.

在营销方面: "无泡".在技术方面:泡不会随着微批次数而生长.海人工智能实验室的后续分析 (DualPipeV / Cut-in-half) 显示只有当专家平行主义不是瓶时才会完全零泡;在以 EP为导向的全至全的情况下,总是存在一些安排妥协.

###       

海洋AI实验室 (2025) 观察到,当EP通信重叠不是重点时, 2x参数复制是浪费的. 它们的双PipeV计划将双向注射折叠成一个"V形"计划, 泡比双管大一点,但存储量相当大. 果公司在其开源DualPipe实现中采用了DualPipeV作为EP-off模式.

交易:

| Feature | DualPipe | DualPipeV | 1F1B | Zero Bubble |
|---------|---------|-----------|------|------------|
| Param copies per device | 2 | 1 | 1 | 1 |
| Bubble vs micro-batches | constant | small growth | grows | grows |
| Compute-comm overlap | full | partial | minimal | partial |
| Use when | EP-heavy MoE | dense or EP-light | baseline | any pipeline |

### 这意味着 14,8T的代币运行

在大约2.8亿GPU小时内, DeepSeek-V3的预训练用了2.048个H800GPU上的14.8T代币. 如果1F1B是天真的,他们会失去12-15%的管道泡340-420KGPU-小时,足以训练一个完整的70B模型. 双管检索了大部分. 直接量化贡献是很难的,没有内部日志,但论文中的说法是超过95%的GPU使用率在培训中平均.

对于较小的运行 (低于1kGPU),DualPipe是过度的管道泡较小相对于总成本,密集型训练很少达到全方位瓶.对于跨界MoE训练在数千GPU规模,它是有效的要求.

### 在堆里.

- 补充**FSDP**(阶段10 · 05).FSDP将模型参数分为数列;DualPipe将数列计算时间表.
- 适合**ZeRO-3**两副本复制的账户需要与ZERO的碎片梯度合作.
- 需要**custom all-to-all kernels**根据 DeepSeek 的开源核心,

```figure
expert-capacity
```

## 用它

`code/main.py`需要一个模拟器.`(P, n_micro_batches, schedule)`它们是指数与论文中的质量要求相匹配,而不是指量生产速度的要求.

模拟器的值:用不同的P和微批数运行,看看泡分数如何增长1F1B,但不是DualPipe.

实质培训的整合考虑因素:

- 选择一个平行深度, 清晰地分为微批次数.
- 确保你的专家并行网支持双向的通用.
- 预计第一次会耗费一周的时间调试时间.
- 双的好处来自于紧缩拖延器.

## 运送它

这一课产生了`outputs/skill-dualpipe-planner.md`鉴于训练集群规格 (GPU数量,拓学,互联网,模型形状),它建议采用管道平行化策略,使用的规划算法以及预期的泡分数在目标规模上.

## 运动

1. 跑步`code/main.py`现在`(P=8, micro_batches=16, schedule=dualpipe)`其他`(P=8, micro_batches=16, schedule=1f1b)`计算GPU使用率差异,并以每百万训练代币的GPU-小时计算.

2. 绘制时间表`(P=4, micro_batches=8, schedule=dualpipe)`标记每一个时间区块,用微批次的ID和方向. 确定泡缺失的第一个时间区块.

3. 阅读深度搜索-V3技术报告的5个图 (arXiv:2412.19437). 确定双管前部件内部的全向发送的重叠窗口.解释计算时间表如何隐藏它.

4. 计算双管的2倍参数上费用,用于70B密集型型号,P=8管道阶段和671BMoE模型,P=16管道阶段. 显示为什么MoE外费用比较小 (大多数参数是专家,分为大型EP组).

5. 根据该文件的3.4节,确定双管没有的两个特定属性.

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Pipeline bubble | "Idle time per rank" | GPU cycles wasted because a pipeline stage is waiting for its input or gradient |
| 1F1B | "Default pipeline schedule" | One forward / one backward interleaved scheduling; the baseline DualPipe beats |
| Zero Bubble | "Sea AI Lab 2023" | Splits backward into B (input gradient) and W (weight gradient); almost fully tightens the pipeline |
| DualPipe | "DeepSeek-V3 schedule" | Bidirectional pipeline + compute-comm overlap; bubbles do not grow with micro-batch count |
| DualPipeV | "Cut-in-half" | V-shape refinement that drops the 2x parameter replication at the cost of slightly larger bubbles |
| Chunk | "Unit of pipeline work" | A forward or backward pass of one micro-batch through one pipeline stage |
| All-to-all dispatch | "Send tokens to experts" | Cross-node comm that routes tokens to their assigned MoE experts |
| All-to-all combine | "Bring expert outputs back" | Cross-node comm that gathers expert outputs after the MLP |
| Expert Parallelism (EP) | "Experts across GPUs" | Shards MoE experts across ranks so different GPUs hold different experts |
| Pipeline Parallelism (PP) | "Layers across GPUs" | Shards model layers across ranks; the dimension DualPipe schedules |
| Bubble fraction | "Wasted GPU time" | (bubble_time / total_time); the fraction DualPipe drives toward zero |

## 进一步阅读

- [DeepSeek-AI — DeepSeek-V3 Technical Report (arXiv:2412.19437), Section 3.3.2 and Figure 5](https://arxiv.org/abs/2412.19437)主要的双管参考
- [DeepSeek — DualPipe GitHub repository](https://github.com/deepseek-ai/DualPipe)开源参考实现,包括双PipeV (切断半) 模式
- [Qi et al. — Zero Bubble Pipeline Parallelism (arXiv:2401.10241, Sea AI Lab 2023)](https://arxiv.org/abs/2401.10241)零泡前身
- [Sea AI Lab — DualPipe could be better without the Dual](https://sail.sea.com/blog/articles/63) 分析了DeepSeek的EP-off模式
- [Narayanan et al. — PipeDream / 1F1B (arXiv:1806.03377, 2018-2021)](https://arxiv.org/abs/1806.03377)1F1B计划对双管相比
- [Huang et al. — GPipe (arXiv:1811.06965, 2018)](https://arxiv.org/abs/1811.06965)原始的管道平行性纸和泡问题
