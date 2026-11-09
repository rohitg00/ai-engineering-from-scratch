# 多代币预测 (MTP)

> 每个自动退缩的LLM从GPT-2到Llama3都以每一个位置的损失:预测下一个代币. 根据 DeepSeek-V3 的数据, 通过梯度流程,额外的14B参数 (在671B模型上) 被蒸回主模型中,训练有素的MTP头部在推断时被重新使用为80%+的接受率的投机解码设计者. 产量1.8倍,是免费的. 这一课构建了从DeepSeek技术报告中的序列MTP模块,计算了损失和共享头参数布局,并解释了为什么MTP保留了因果链,而Gloeckle等的原始平行MTP破了它.

**Type:** Build
**Languages:** Python (stdlib), Rust
**Prerequisites:** Phase 10 · 04 (pre-training a mini GPT), Phase 10 · 15 (speculative decoding)
**Time:** ~60 minutes

## 学习目标

- 说明MTP训练目标,并通过预测深度推导联合损失.
- 解释Gloeckle等平行MTP头 (2024) 和DeepSeek-V3的连续MTP模块之间的区别,以及为什么连续设计保留了因果链.
- 计算在预训练运行中添加MTP模块的参数和内存总费用.
- 从零开始实现一个MTP模块:共享嵌入,深度变压器块,投影和共享输出头.

## 问题

预测下一个标志是标准的LLM培训目标. 每个隐藏状态都被监督, 预测到一个事物: 这是一个令人惊的弱势信号. 一个序列中的大部分信息超越一个标志性结构,连贯性,事实性,算术流程. 模型必须通过积累数万亿个代币的许多单代币信号来学习这些.

如果每个隐藏状态都被监督, 子等 它们可以帮助. 它们的实施将几个独立的输出头放在脊柱上,每个都预测着不同的偏移. 它们是平行,简单的,但头脑在没有任何层次的完善的情况下看到相同的隐藏状态,预测并没有因果链,所以它们不能用于推测解码.

根据DeepSeek-V3 (2024年12月) 的设计,MTP将被重新设计成连续模块,以保持因果链在每个预测深度.`t+1`其他`h_i^(0)`然后预测`t+2`从一个新的隐藏状态中`h_i^(1)`总体而言,`h_i^(0)`随着`E(t+1)`嵌入式和共享输出头保持参数上层小.在DeepSeek-V3的规模上,MTP模块中14B的额外参数在671B主模型重量上.那2%的上层购买了更密集的训练信号和一个准备好的投机解码草案.

这一课构建一个单个MTP模块,从零开始就会失去D深度.数学很有序.实现是150行.

## 概念

### 序列MTP配方

深度搜索V3增加了`D`基本模型的顶部MTP模块.`t_{i+1}`每个模块`k`(为`k = 1..D`) 预测标志`k`进一步的步骤,`t_{i+k+1}`通过位置给出一个前`i`现在,我们要去.

模块`k`组成:

- 一个变压器块`T_k`通过自己的注意力和MLP.
- 投影矩阵`M_k`结合了以前的深度隐藏状态,
- 共同的嵌入式`E`(与主要模型相同).
- 共享输出头`Out`(与主要模型相同).

在训练中,一个前通过位置`i`隐藏状态是:

```math
\begin{aligned}
h_i^{(0)} &= \text{main model backbone at position } i \\
h_i^{(k)} &= T_k\Big( M_k \cdot \mathop{\mathrm{concat}}\big(\mathop{\mathrm{RMSNorm}}(h_i^{(k-1)}), \mathop{\mathrm{RMSNorm}}(E(t_{i+k}))\big) \Big) \quad \text{for } k \ge 1
\end{aligned}
```

预测是:

```math
\text{logits}_{i+k+1} = \mathop{\mathrm{Out}}(h_i^{(k)}) \quad \text{for } k = 1, \ldots, D
```

对于深度的损失,是与真相相相反的交叉透.`t_{i+k+1}`其他:

```math
L_k = \mathop{\mathrm{CE}}(\text{logits}_{i+k+1}, t_{i+k+1})
```

关节损失在深度:

```math
L_{\text{MTP}} = \frac{\lambda}{D} \sum_{k=1}^{D} L_k
```

`lambda`                                                                                                                                                                                                                                                              `L_main + L_MTP`现在,我们要去.

### 为什么是连续的,而不是平行的

格洛克尔的原始平行MTP有D输出头,每个直接应用到`h_i^(0)`每个头脑都预测`t_{i+k}`它们可以从同一条脊椎隐藏状态中运行,但预测并非相互条件.`head_1`输出可以帮助`head_2`头部同时开火.

探V3的序列设计构建`h_i^(k)`其他`h_i^(k-1)`加上实际的下一个代币嵌入式`E(t_{i+k})`这样可以保持因果链:`t_{i+k+1}`入深度的模块`k`看到什么是`t_{i+k}`结构上,这与自动降低解码器的使用方式相同,使MTP模块直接可作为投机解码设计者使用.

在推断时:料`h_i^(k-1)`其他国家`t_{i+k}`进入模块`k`预测到什么时候?`t_{i+k+1}`探V3报告了第一个MTP模块的80%+接受度,速度提高了1.8倍.

### 参数会计

为了一个隐藏的模型`h`语言和词汇`V`其他:

- 主要模型:数十亿个参数,加上一个输出尺寸的头`V * h`现在,我们要去.
- 共享输出头:重用主机头,没有额外的参数.
- 共享嵌入式:重复使用主模型嵌入式,没有额外的参数.
- 每个MTP模块:
  - 投影`M_k`其他`(2h) * h = 2h^2`现在,我们要去.
  - 变压器块`T_k`关注 (`4h^2`对于MHA) 加上MLP (通常是`8h^2`对于SwiGLU的比例为8/3).`12h^2`按区块.

每个模块的总额额外: `~14h^2`对于深度搜索V3`h = 7168`, D = 1 个模块: `~14 * 7168^2 = ~720M`,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,

### 投机解码的回报

在预训练期间,MTP模块将训练减慢约10% (更多的前进计算,额外的损失).

1. 密度训练信号.每个隐藏状态都能看到D+1监测目标.测量对MMLU,GSM8K,MATH,HumanEval的影响:深度搜索-V3的排放量持续提高了几个百分点.

2. 免费的投机解码草案在推理.MTP模块已经训练来预测下几代币.作为一个草案网络,它提供80%+的接受率.在这个水平上,N=3或N=5规格解码给出1.8×吞吐量. 10%的训练时间成本在你第一次运行推理时回报.

### 与的关系

鱼在预训练后单独训练一个小型草案模型.MTP将草案入预训练中.

| Dimension | EAGLE-3 | MTP (DeepSeek-V3) |
|-----------|---------|------------------|
| When trained | Post-pre-training | During pre-training |
| Backward-compatible with existing weights | Yes | No (need to re-train) |
| Draft params | 1-2 transformer layers | 1 transformer block + projection |
| Acceptance rate | 0.88-0.92 | 0.80+ at depth 1 |
| Benefit beyond speedup | Speculative decoding only | Denser training signal + speedup |

```figure
multi-token-predict
```

## 建立它

`code/main.py`构建一个单个MTP模块端到端:共享嵌入,投影,变压器块,共享输出头.然后在短合成序列上计算每深度交叉缩损失,并按组件打印参数数. 32个代币的玩具词汇使数字可读.

### 步骤1:共享嵌入表

一个单身的`vocab_size x hidden`图表是主要模型和每个MTP模块在每个深度使用的.

### 步骤2:每深度组合

```python
def combine(prev_hidden, next_token_embed, M_k):
    # concat along feature dim, then project down to hidden
    concat = rms_norm(prev_hidden) + rms_norm(next_token_embed)  # vector addition stand-in
    projected = matvec(M_k, concat)
    return projected
```

实际的DeepSeek-V3将两个RMS规范向量连接到`[2h]`项目与项目`h x 2h`玩具使用向量加算来简短的SDLB.

### 步骤3:变压器块在 k 深度

在玩具中,一个层线性注意力块和SwiGLU MLP使结构可见,而不会.

### 步骤4:共享输出头

重新使用主模型的输出投影,对词汇进行调整.

### 步骤5:每深度损失

软max的交叉缩 (logits) 与地面真相符号的抵消`k+1`通过深度的集成`lambda / D`扩展因素

### 步骤 6:参数会计

打印共计参数数,共享 (嵌入,头) 数量和每模块额外数量.显示MTP额外与主模型大小的比例.

## 用它

 MTP 集成到 DeepSeek-V3 (2024年12月) 和 DeepSeek-R1 系列中.

- 果的服务堆使用MTP模块作为投机解码器.
- 根据该协议,将在2026年4月开始实施深度搜索V3MTP的集成途径.
- AMD的ROCm SGLang教程显示了特定的MTP投机解码配置,在V3检查点测量1.8x速度.

在新的预训练运行中使用MTP时:

- 你控制了训练前的整个管道,
- 你知道你会提供规模模型,并且想要免费的猜测解码.
- 在1B尺度上,空头损伤比利帮助更多.

什么时候不:

- 精细调节现有预训练密集模型.
- 需要一个清洁的基线来比较.

## 运送它

这一课产生了`outputs/skill-mtp-planner.md`鉴于训练前运行规格 (模型大小,数据,计算),它返回了集成MTP的计划:深度数量D,`lambda`时间表,内存费用,以及推断时间的猜测解码线程.

## 运动

1. 跑步`code/main.py`显示合成信号强化时,每深度损失单调减少. 修改合成以使用固定模式,并验证深度-1和深度-2损失相近.

2. 计算密集70B模型 (隐藏8192,80层) 的参数上层费用.与D=1MTP模块的DepSeek-V3报告的14B上层费用进行比较.解释为什么DepSeek的数量更高:MTP变压器块继承了相同的MoE结构,从而增加了每个模块参数数数.

3. 插入玩具中的D=2:添加第二个MTP模块,$h^{(1)}$预测`t_{i+3}`检查联合损失和参数会计符合深度搜索论文19-21的方程.

4. 切换玩具为平行MTP (Gloeckle式):在主要隐藏状态之上添加D输出头,每个都预测不同的偏移.测量每深度的损失与同一合成信号的连续版本相比较.连续版本应该产生较低的 k > 1的深度损失,因为它会对中间预测进行条件.

5. 使用训练有素的MTP模块作为EAGLE样式的草案:调用模块 k提出 `t_{i+k+1}`根据模型的预测,这些图标的接受率是对待的. 如果在玩具上达到50%以上,你将复制了经验性MTP-as-draft属性.

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| MTP module | "Extra loss block" | A small transformer block plus projection that predicts a token `k` positions ahead of the main model |
| Prediction depth | "Which offset" | The integer `k` such that module `k` predicts `t_{i+k+1}` from prefix through position `i` (the main model is depth 0 and predicts `t_{i+1}`) |
| Parallel MTP | "Gloeckle-style" | D independent heads on the same backbone hidden state, no conditional chain |
| Sequential MTP | "DeepSeek-V3 style" | Each module conditions on the previous depth's hidden state plus the next token's embedding; preserves causal chain |
| Shared output head | "Reuse the main head" | The MTP modules call the main model's LM head, not a separate output projection |
| Shared embedding | "Reuse the main table" | Same vocabulary embedding table is used everywhere; no duplicate parameters |
| Projection matrix $M_k$ | "Combine hidden + next-token" | An `h x 2h` linear layer that folds the previous hidden state and the target-token embedding into the next depth's input |
| Joint loss $L_{\text{MTP}}$ | "Averaged extra losses" | Arithmetic mean of per-depth cross-entropy losses, scaled by `lambda` |
| Acceptance rate at depth 1 | "How often MTP draft is right" | The rate at which the D=1 MTP module's top-1 prediction equals the main model's top-1 prediction; 80%+ on DeepSeek-V3 |
| Lambda weighting | "Extra-loss importance" | Per-depth scaling factor; 0.3 at start of training, 0.1 later on DeepSeek-V3 |

## 进一步阅读

- [DeepSeek-AI — DeepSeek-V3 Technical Report (arXiv:2412.19437)](https://arxiv.org/abs/2412.19437)完整的连续MTP描述 (第2.2节),包括联合损失方程和推断时1.8x加速
- [Gloeckle et al. — Better & Faster Large Language Models via Multi-token Prediction (arXiv:2404.19737)](https://arxiv.org/abs/2404.19737)平行MTP基线,DeepSeek的设计改进了
- [DeepSeek-V3 model card on Hugging Face](https://huggingface.co/deepseek-ai/DeepSeek-V3)总计685B (671B主要+14BMTP),部署说明
- [Leviathan et al. — Fast Inference from Transformers via Speculative Decoding (arXiv:2211.17192)](https://arxiv.org/abs/2211.17192)投机解码框架MTP适合
- [Li et al. — EAGLE-3 (arXiv:2503.01840)](https://arxiv.org/abs/2503.01840)EAGLE的2025年草案架构,同比MTP与
