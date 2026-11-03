# 投机解码和

> 一个创建一个代币的跨界法规需要通过数十亿个参数. 往往的通行量大大过于充足:通常一个更小的模型可以正确猜测下一个3-5个代币, 如果猜测是正确的,你会得到5个代币. 投机解码 (Leviathan等人) 据估计,在2023年,EAGLE-3 (2025) 将接受率推至4.5个代币,以实现4-5倍的速度.

**Type:** Build
**Languages:** Python (with numpy)
**Prerequisites:** Phase 10 Lesson 12 (Inference Optimization), Phase 10 Lesson 04 (Pre-training Mini-GPT)
**Time:** ~75 minutes

## 问题

对于 H100 的 70B 类型的代码输出通常为 40-80 代币/秒.每个代币需要一个全前传输,读取HBM 的所有模型重量.你不能使模型变小而不改变输出.你不能增加更大的批量.你卡在,除非你可以让模型输出超过一个代币.

后代的产量看起来是连续性的:`x_{t+1} = sample(p(· | x_{1:t}))`如果您有一个廉价的预测器,它说"下一个4个代币可能是 [a,b,c,d]"您可以验证所有5个位置在a**single forward pass of the big model**接收最长的相匹配的前.

利维雅坦,卡莱,马蒂亚斯 (2023,通过投机解码从变体中快速推理) 通过一个聪明的接受/拒绝规则来实现这一点,以保持目标模型的样本分布.同样的输出分布, 2-4 倍更快.

## 概念

### 两种模式的设置

- **Target model** `M_p`您实际上想要的样本是大,慢,高质量的模型.`p(x)`现在,我们要去.
- **Draft model** `M_q`快速,低质量的小型模型.`q(x)`五到三倍小.

每一步:

1. 拟议的模型草案`K`代币自动下降: `x_1, x_2, ..., x_K ~ q`现在,我们要去.
2. 目标模型在所有情况下运行一个前进通行`K+1`位并行,产生`p(x_k)`对于每一个拟议的代币.
3. 通过下面修改的拒绝样本规则,从左到右接受/拒绝每个代币. 接受最长的匹配前.
4. 如果任何代币被拒绝,请从纠正的分布中取代代代币的样本,然后停止.`p(· | x_1...x_K)`现在,我们要去.

如果草案完全匹配目标,你会得到每一个目标前进的K+1代币.如果草案在位置1上错误,你只会得到1代币.

### 准确性规则

预测解码是**provably equivalent in distribution to sampling from p**拒绝的规则:

```
For each drafted token x_t:
    r ~ Uniform(0, 1)
    if r < p(x_t) / q(x_t):
        accept x_t
    else:
        sample replacement from residual: (p - q)+ / ||(p - q)+||_1
        stop
```

在哪里`(p - q)+`标志着点差的正面部分.`p ≈ q`) 接受率接近 1. 当他们不同意时,残余分布是这样构建的,使整体样本仍然是准确的`p`现在,我们要去.

**Greedy case.**对于温度=0的样本,请检查`argmax(p) == x_t`如果是,接受;如果不是,输出`argmax(p)`停止.

### 预期的增速

如果草案模型的代币级接受率为`α`预期每次目标前进通行产生的代币为:

```math
\mathbb{E}[\text{tokens}] = \frac{1 - \alpha^{K+1}}{1 - \alpha} \qquad K = \text{draft length}, \ \alpha \in [0, 1]
```

在`α = 0.8, K = 4`其他`(1 - 0.8^5)/(1 - 0.8) = 3.36`预期期期货的代币.`cost_q * K + cost_p`(K草案步骤加上一个目标验证).`cost_p >> cost_q * K`速度增速率为`3.36× / 1 = 3.36×`通过量.

唯一真正的参数是`α`根据"项目目标"的结合, 一个好的项目是一切.

### 培训项目:蒸

随机的小模型做了一个糟糕的草稿.

1. 选择一个小的架构 (70B目标的~1B,7B目标的~500M).
2. 运行目标模型在一个大文本体内;存储其下一个代币分布.
3. 根据目标分布 (而不是实地真相代币) 进行KL分歧训练.

结果是:`α`在编码中通常是0.6-0.8,在自然语言聊天中是0.7-0.85.

### :树木绘制+重用特征

李,韦,张,张 (2024, ":投机性样本需要重新思考特征不确定性") 观察到标准投机性解码中的两个效率低下:

1. 草案执行K序列步骤,每个都是完整的. 但草案可能会重新利用目标的特性 (隐藏状态) 从最近验证 目标已经计算了丰富的表示,该草案是从零中重新衍生.
2. 如果草案可以输出候选人的*树* (每个节点都会多次猜测),目标的单一向前传递可以通过树注意力面具并行验证多个候选人的路径,并选择最长的接受分支.

-1变化:
- 预示输入 = 目标在位置 t 的最后隐藏状态,而不是原始代币.
- 草案架构 = 1 变压器解码器层 (不是单独的小模型).
- 输出 = K 的树 = 每个深度4-8个候选,深度4-6.

子-2 (2024) 增加了动态树木拓:树在不确定的地段上长得更宽,而在自信的地方保持狭窄.`α_effective`没有增加验证成本.

3 (Li等) 2025年",EAGLE-3:通过训练时间测试扩大大型语言模型的推理加速") 消除了固定的顶层功能依赖性,并将草案训练以新的"测试时间模拟"损失. 接受率从0.75 (EAGLE-2) 升至0.82 (EAGLE-3) ,平均代币/验证率从3.0升至4.5. 这些数据来自一个参考设置. 接受取决于模型对,草稿树和流量:第10期15期在聊天基准上每次接受路径代币0.88至0.92的报价,第17期05期计划在生产总值聊天上0.6至0.8.

### 树木注意力检查

目标模型通过一个单个前进传输来验证树的输出.**tree attention mask**一个因果化面具,它编码树木拓而不是纯线.每个代币只为树上的祖先服务.验证通过仍然是前面,一条马特尔;拓化面具只花费了几次额外的KV入口.

```
        root
       /    \
      a      b
     / \    / \
    c  d   e   f
```

如果`a, b`竞争的第一代代标志候选人`c, d, e, f`输出是任何接受的路径上最长的前.

### 当它胜利时,当它不胜利时

**Wins:**
- 通过可预测的文本进行聊天/完成 (代码,普通英语,结构化输出). `α`了.
- 设置在解码过程中未使用的GPU计算 (内存绑定阶段).树草图使用可用的FLOP.

**Loses / no win:**
- 极高的性输出 (高温创意写作).`α`落到`1/|vocab|`现在,我们要去.
- 批量服务具有非常高的同时批量已经填补了FLOP,对树木验证的空间很少.
- 非常小的目标模型,其中的草案并不小.

制作商店通常会报告聊天的速度2~3倍,代码生成3~5倍,创意写作几乎是零.

```figure
speculative-decoding
```

## 建立它

`code/main.py`其他:

- 参考`speculative_decode(target, draft, prompt, K, temperature)`执行确切的拒绝规则并验证它保留了目标分布 (实验性KL <0.01对平凡目标采样).
- 树的设计师, 构建一个深度K树,
- 树木注意力面具制造器,为验证器产生了正确的因果模式.
- 通过一个小LM (从GPT-2-中目标中除一个GPT-2-小) 运行的接受率带.

```python
def speculative_step(p_target, q_draft, K, temperature=1.0):
    """One round of speculative decoding. Returns list of accepted tokens."""
    # 1. Draft K tokens
    draft_tokens = []
    q_dists = []
    state = draft_state_init()
    for _ in range(K):
        probs = softmax(q_draft(state) / temperature)
        t = np.random.choice(len(probs), p=probs)
        draft_tokens.append(t)
        q_dists.append(probs)
        state = draft_step(state, t)

    # 2. Target computes p at every drafted position + 1 extra
    p_probs_all = target_forward_batched(p_target, draft_tokens, temperature)

    # 3. Accept/reject left-to-right
    accepted = []
    for k, tok in enumerate(draft_tokens):
        r = np.random.uniform()
        if r < p_probs_all[k][tok] / q_dists[k][tok]:
            accepted.append(tok)
        else:
            residual = np.maximum(p_probs_all[k] - q_dists[k], 0)
            residual /= residual.sum()
            accepted.append(np.random.choice(len(residual), p=residual))
            return accepted
    # 4. All K accepted → sample bonus token from target
    accepted.append(np.random.choice(len(p_probs_all[-1]), p=p_probs_all[-1]))
    return accepted
```

## 用它

- **vLLM**其他**SGLang**在vLLM中,通过`--speculative-config`具有 JSON 对象`method`现在`model`其他`num_speculative_tokens`3是`"method": "eagle3"`现在,我们要去.
- **NVIDIA TensorRT-LLM**支持梅杜萨和树的本土.
- **Reference draft models**其他`Qwen/Qwen3-0.6B`(Qwen3-32B草案),`meta-llama/Llama-3.2-1B-Instruct`(关于Llama 3.x 70B的草案)
- **Medusa heads**(Cai et al. 2024,"Medusa:简单的LLM推理加速框架与多个解码头"):而不是一个草案模型,将K平行预测头添加到目标本身.更简单的部署,接受度略低于EAGLE.

## 运送它

这一课产生了`outputs/skill-speculative-tuning.md`一个技能,可以描述目标模型的工作负载,并选择:草案模型,K (草案长度),树宽度,温度,以及何时回到简单的解码.

## 运动

1. 执行确切的拒绝规则,经验验证它.`speculative_decode`通过简单的目标样本采集,计算两个输出分布之间的电视距离. 应为<0.01.

2. 计算加快公式,给定了`α`其他`K`预期的代币按目标前进. 找到最佳的代币$K$为了$\alpha \in \lbrace 0.5, 0.7, 0.9 \rbrace$现在,我们要去.

3. 训练一个小的草稿. 拿一个124MGPT-2目标,并在100M代币上除一个30MGPT-2草稿.`α`预期:0.6至0.7.

4. 执行EIGLE样式的树草图. 代替链条,将草图输出的每一个深度上三个分支. 构建树注意力面具. 检查目标接受最长正确的分支.

5. 测量失败模式.在温度=1.5 (高性) 运行投机解码.显示 α 崩,算法由于开支的草图而比普通解码慢.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Target model | "The big model" | The slow, high-quality model you want samples from (p distribution) |
| Draft model | "The speculator" | The small, fast predictor (q distribution); 5-30x smaller |
| K / draft length | "Look-ahead" | Number of speculated tokens per verify pass |
| α / acceptance rate | "Hit rate" | Per-token probability that the draft's proposal is accepted |
| Exact rejection rule | "The accept test" | r < p/q compare that preserves target's distribution |
| Residual distribution | "Corrected p-q" | (p - q)+ / ||(p - q)+||_1, the distribution to sample from on rejection |
| Tree drafting | "Branching speculation" | Draft outputs a tree of candidates, verified in one pass with tree-structured attention mask |
| Tree attention mask | "Topological mask" | Causal mask encoding the tree topology so each node attends only to its ancestors |
| Medusa heads | "Parallel heads" | K extra prediction heads on the target itself; no separate draft model |
| EAGLE feature reuse | "Hidden-state draft" | Draft input is target's last hidden state, not raw tokens, shrinking the draft |
| Test-time simulation loss | "EAGLE-3 training" | Train draft on outputs matching target's test-time distribution, not teacher forcing |

## 进一步阅读

- [Leviathan, Kalai, Matias, 2023 — "Fast Inference from Transformers via Speculative Decoding"](https://arxiv.org/abs/2211.17192)准确的拒绝规则和理论加速分析
- [Chen, Borgeaud, Irving et al., 2023 — "Accelerating Large Language Model Decoding with Speculative Sampling"](https://arxiv.org/abs/2302.01318)深思维的同时投机性采样论文
- [Cai, Li, Geng, Wang, Wang, Zhu, Dao, 2024 — "Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads"](https://arxiv.org/abs/2401.10774)平行头替代草案模型
- [Li, Wei, Zhang, Zhang, 2024 — "EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty"](https://arxiv.org/abs/2401.15077)重用特征和树木设计
- [Li et al., 2024 — "EAGLE-2: Faster Inference of Language Models with Dynamic Draft Trees"](https://arxiv.org/abs/2406.16858)动态树木拓
- [Li et al., 2025 — "EAGLE-3: Scaling up Inference Acceleration of Large Language Models via Training-Time Test"](https://arxiv.org/abs/2503.01840)火车时间测试时间匹配
- [Fu, Haotian, Peng et al., 2024 — "Break the Sequential Dependency of LLM Inference Using Lookahead Decoding"](https://arxiv.org/abs/2402.02057)  Jacobi/lookahead解码,一个无投机者的替代方案
