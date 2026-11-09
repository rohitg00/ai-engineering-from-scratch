# 马巴 混合型SSM变压器

> 美国国家空间模型和变压器需要不同的东西. 转变器通过注意力以平方成本购买质量. 通过复发,但质量滞后的SSM购买线性时间推理和恒定记忆. AI21的Jamba (2024年3月) 和Jamba 1.5 (2024年8月) 将它们放在同一模型中:每7层Mamba的1层变压器,每块的MoE,以及一个适合80GB GPU的256k文本窗口. 巴-3 (ICLR 2026) 通过复杂值状态空间和MIMO预测,紧缩了SSM侧面. 这一课程将两种架构都读到一直到一直到一直到,解释了混合配方为什么在纯SSM和纯Transformer长文本尝试中没有生存过三年的扩展.

**Type:** Learn
**Languages:** Python (stdlib, layer-mix calculator), Rust
**Prerequisites:** Phase 10 · 14 (open-model architectures), Phase 10 · 17 (native sparse attention)
**Time:** ~60 minutes

## 学习目标

- 解释一个Jamba块中的三个原始性:变压器层,Mamba层,MoE层和1:7甚至交织的配方.
- 描述SSM的高水平复发情况以及为什么它能够推断恒定记忆.
- 在256k文本下计算一个Jamba模型的KV缓存足迹,并与纯变压器模型所需的相比较.
- 举个三项Mamba-3创新 (指数-形分辨率,复杂价值状态更新,MIMO) 和每个目标的问题.

## 问题

关注是序列长度的方形.状态空间模型是线性的. 这种差异是复合的:在256k代币时,变压器注意力地图为每头65B的输入;SSM的复发状态是固定的尺寸,无论序列长度如何.

纯SSM模型 (Mamba,Mamba-2) 在小规模上匹配变压器的复杂性,但在状态跟踪任务上落后,并在某些类别的内文检索上失败.直觉:SSM将历史压缩到固定状态,而当历史长时,信息泄漏.注意力记住一切,但支付了平方成本.

显而易见的解决方案是:使用两者. 让变压器层在准确的回忆重点. 其他地方使用SSM层. 调整比率. 巴是第一款生产级的产品,在规模上运送了这种混合配方 (52B总量,12B活跃,256k背景,单个80GB的GPU). 巴1.5将家族扩展到398B总 / 94B活跃. 巴-3 (ICLR 2026) 是目前最好的纯SSM基线,可以重建混合物.

这一课阅读了三个论文,

## 概念

### 一页的SSM

状态空间模型处理一个序列`x_1, ..., x_N`通过固定尺寸状态`h`其他:

```math
\begin{aligned}
h_t &= A h_{t-1} + B x_t \\
y_t &= C h_t
\end{aligned}
```

在每一步,状态通过线性动态发展.`A`需要输入`B x_t`并且发出输出`C h_t`现在,我们要去.`A, B, C`需要注意的是,`y_t`需要`h_{t-1}`其他`x_t`没有任何早些时候`x`记忆是恒定的.$O(1)$对于每一个代币.

模型质量的秘是`A` (Gu 2021) 使用高度结构化的矩阵,可以有效地评估为训练期间长节.`A, B, C`根据"数据"的定义,Mamba-2 (2024) 进一步简化了结构.Mamba-3 (2026) 重新增加了特定地方的复杂性.

关键属性:对于解码器LLM,SSM层是一种注重层的下降替代,而不是不断增长的KV缓存.

### 巴区

巴块根据两个数字交织层:

- `l`巴使用的注意力与巴比率`l = 8`换句话说,每7层Mamba (7层Mamba+1层注意力=每组8层) 均为1层变压器.
- `e`巴使用的频率`e = 2`其他层都适用于MoE.

区块内的层序列:

```
M  M  M  M  M  M  M  A    (7 Mamba + 1 Attention)
|  M  |  M  |  M  |  M    (where | marks MoE applied)
```

每个Jamba块有8层.在4块深处 (32层总共),你得到28层Mamba和4层注意力.其中16层使用MoE.

### 为什么 1:7 的比率

AI21运行了排放:注意力与Mamba的比率在长文本评估中能给出最好的参数复杂性和内文回忆?

- 太多的注意力 (1:1):质量会上升,但记忆力和速度会下降.
- 太少注意力 (1:15):记忆力很大,但在文本中检索失败.
- 甜点点:1: 7或1: 8.

感觉:变压器层处理精确的召回和状态跟踪.

### 位置编码

巴层本身是位置意识 (通过复发).原始巴混合物中的注意层没有使用RoPE  SSM层提供位置信息.Jamba 1.5为更长的文本概括添加RoPE,这是基于经验性的长文本评估的后期精炼.

### 记忆预算

对于Jamba-1形状 (32层: 28 Mamba + 4 注意,隐藏 4096, 32 注意头):

-  KV缓存 (仅注意层): `2 * 4 * 32 * 128 * 256k * 2 = 16 GB`只有4个注意力层贡献. 释放的Jamba使用GQA,其中有8KV头,这使得4GB,这是Jamba纸上的数字.
-  SSM状态: `28 * hidden * state_size`对于每个代号前,但这是一个固定尺寸的每个层,不随序列长度进行扩展.典型的Mamba状态为16个特征,隐藏4096:`28 * 4096 * 16 * 2 = 3.7 MB`总的来说.

比较一个纯变压器的32层,相同的隐藏,满满MHA的32头:`2 * 32 * 32 * 128 * 256k * 2 = 128 GB`尽管与GQA8相比,大多数2024型号使用 (`2 * 32 * 8 * 128 * 256k * 2 = 32 GB`),一个 1:7 混合动力,32KV头16GB仍然是2倍小. 释放的Jamba,4GB,是8倍小.

这就是AI21所指的"在单个80GB GPU上256k文本".一个全MHA纯变压器的KV缓存不适合;即使是GQA基线也没有权重和激活的空间;Jamba的确适合.

### 2026年纯SSM基准

马巴-3 (ICLR 2026, arXiv:2603.15569) 引入了三项纯SSM方面创新:

1. **Exponential-trapezoidal discretization.**换取了Mamba-2中的尤勒方法分辨率,以更具表达性的复发. 转折式操作应用于核心复发中的状态输入,而不是作为外部转折式.`x_t`现在,我们要去.

2. **Complex-valued state update.**之前的Mamba将状态矩阵从复杂 (S4) 降低到真实角形 (Mamba) 到规模身份 (Mamba-2).Mamba-3重新添加复杂值等于数据依赖的旋转嵌入状态.这恢复了以前的真实价值简化成本的状态跟踪功能.

3. **Multi-input multi-output (MIMO) projections.**通过使用矩阵值的投影,改进建模能力和推断时间硬件使用,而不会增加解码延迟.

在1.5B参数时,Mamba-3在Gated DeltaNet上提高了平均下游精度0.6分;MIMO变种增加了1.2分,获得了总1.8分.在相同状态大小时,Mamba-3与Mamba-2相匹配.

巴-3尚未以规模生产混合动力运输,但它是下一款巴级车型的SSM方面显而易见的候选人.

### 什么时候要找到混合动力

混合物当:

- 文本是足够长的,使得纯变压器KV缓存变得痛苦 (64k+).
- 任务混合短距离结构 (适合SSM) 和长距离召回 (需要变压器).
- 你想在单个GPU内存预算上部署, 变压器KV缓存本身就不适合.

混合物输出时:

- 短文本 (低于16k).SSM上层费用是浪费的;纯变压器是好的.
- 任务需要在各个地方都得到关注 (深入推理,多文档交叉引用).
- 现在,我们正在扩大到数万亿参数的边界模型.

### 竞争环境

| Model | Family | Scale | Unique claim |
|-------|--------|------|-------------|
| Mamba-2 | pure SSM | 3B | linear time, constant memory |
| Jamba | hybrid | 52B/12B | 256k on 80GB |
| Jamba 1.5 Large | hybrid | 398B/94B | enterprise-grade long-context |
| Mamba-3 | pure SSM | 1.5B (paper) | state-tracking restored |
| DeepSeek-V3 | pure Transformer + MoE | 671B/37B | frontier capability |

2026年景观:纯变压器MoE主导边界,但混合动力拥有256k以上的背景.Mamba-3的状态跟踪胜利可能会在下一代推低混合动力比率 (更多SSM,更少关注).

```figure
swiglu-ffn
```

## 用它

`code/main.py`由于SSM-Transformer比率和隐藏尺寸/层数量配置,它计算:

- 在目标语境中 KV缓存.
- 系统状态存储器.
- 对于一系列模型形状,在语境N的总内存.

计算器支持:

- 纯变压器基线 (KV缓存增长N).
- 巴式1: 7混合物.
- 纯SSM (根本没有KV缓存).

据报道,这些数字直接来自Jamba-1和Jamba-1.5论文,用于发表的形状,并用于假设变体.

实际部署的整合考虑因素:

- 大多数生产推断服务器 (vLLM,SGLang) 支持Jamba和Mamba.
- 在256k语境下,Jamba的内存优势显示在同步请求吞吐量.在同一VRAM上,您可以安装更多的Jamba序列比变压器序列.
- 巴-3作为一个独立的模型尚未出货.

## 运送它

这一课产生了`outputs/skill-hybrid-picker.md`鉴于工作量规格 (文本长度配置文件,任务组合,内存预算),它建议在纯变压器,Jamba式混合动力和纯SSM之间进行明确推理,以考虑内存和质量差距.

## 运动

1. 跑步`code/main.py`计算KV缓存在256k语境中进行32层纯变压器 (隐藏4096,32头) 和同一形状的Jamba-1混合动力计算.

2. 修改计算器以模型为1:3混合型 (4Mamba: 1注意) 和1:15混合型 (14Mamba: 1注意). 插图KV缓存与比率.在哪个比率下,KV缓存等于SSM状态内存?

3. 阅读Jamba论文第3节 (arXiv:2403.19887).解释为什么AI21使用Mamba-1而不是Mamba-2尽管Mamba-2更快.提示:混合式除部分记录了这一点.

4. 计算Jamba 1.5 大中 MoE-每一个其他层的参数上层 (398B总数, 94B活跃).将活跃比度与DeepSeek-V3 (37B/671B) 进行比较,并解释为什么Jamba的架构会推动活跃比度升高.

5. 阅读Mamba-3论文的第3节 (arXiv:2603.15569). 用三个句子解释为什么复杂值状态更新等于数据依赖的旋转嵌入. 联系答案与第7阶段 · 第04课的ROPE衍生.

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| State space model (SSM) | "Recurrence with a fixed state" | A layer with a learned recurrence `h_t = A h_{t-1} + B x_t`; constant memory per token |
| Selective SSM | "Mamba's trick" | Data-dependent A, B, C parameters that give the model gating-like selectivity at linear time |
| Attention-to-Mamba ratio | "How many attention layers" | In Jamba, `l = 8` means 1 attention layer per 7 Mamba layers |
| Jamba block | "The 8-layer group" | One attention + seven Mamba + MoE on alternate positions |
| SSM state | "The hidden buffer" | Fixed-size per-layer state that replaces the KV cache for Mamba layers |
| 256k context | "Jamba's flagship number" | The sequence length Jamba-1 fits on a single 80GB GPU; pure Transformer cannot at that size |
| Mamba-3 | "2026 pure SSM" | Current-best pure-SSM architecture with complex state + MIMO; the baseline hybrids rebuild around |
| MIMO | "Multi-input multi-output" | Mamba-3 innovation using matrix-valued projections instead of scalar per-feature |
| Exponential-trapezoidal discretization | "Mamba-3's recurrence" | More expressive recurrence that subsumes Mamba-2's Euler-method discretization |
| Hybrid architecture | "Mix attention and SSM" | Any model that interleaves Transformer and SSM layers; Jamba is the production archetype |

## 进一步阅读

- [Lieber et al. — Jamba: A Hybrid Transformer-Mamba Language Model (arXiv:2403.19887)](https://arxiv.org/abs/2403.19887)原始的Jamba纸,比例减法,256k的文本要求
- [AI21 — Jamba 1.5: Hybrid Transformer-Mamba at Scale (arXiv:2408.12570)](https://arxiv.org/abs/2408.12570)扩大家庭,公开公开公开 398B/94B和 12B/52B
- [Gu, Dao — Mamba: Linear-Time Sequence Modeling with Selective State Spaces (arXiv:2312.00752)](https://arxiv.org/abs/2312.00752)Jamba基于选择性SSM论文
- [Dao, Gu — Mamba-2 (arXiv:2405.21060)](https://arxiv.org/abs/2405.21060)简化结构状态空间继承者
- [Lahoti et al. — Mamba-3 (arXiv:2603.15569, ICLR 2026)](https://arxiv.org/abs/2603.15569)复杂价值国家,MIMO,2026年纯SSM边界
- [Gu et al. — Efficiently Modeling Long Sequences with Structured State Spaces (arXiv:2111.00396)](https://arxiv.org/abs/2111.00396)S4论文,SSM的首发基因
