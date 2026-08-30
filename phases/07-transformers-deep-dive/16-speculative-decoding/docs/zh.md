# Speculative Decoding — Draft, Verify, Repeat

> 自回归解码是连续的。每个代币都等待前一个代币。推测解码打破了链条：廉价的模型起草了N个代币，昂贵的模型在一次前向验证所有N个代币。当选秀正确时，你为N代人支付了一名大前锋。

** 类型：** 构建
** 语言：** Python
** 先决条件：** 阶段7 · 07（GPT因果LM）、阶段7 · 12（KV缓存和Flash注意）
** 时间：** ~60分钟

## The Problem

在H100上对一个令牌进行70 B LLM采样大约需要30 ms。3B草案模型需要约3 ms。如果我们让3B草案5个令牌提前，然后运行70 B * 一次 * 来验证所有5个令牌，那么最多5个接受的令牌的总数为“5 x 3 + 30 = 45 ms”-而直线生成则为“5 x 30 = 150 ms”。这就是完整的推测解码宣传：用少量额外的图形处理器内存（草稿模型）换取2-4倍更低的解码延迟。

技巧必须保持分布。Leviathan等人（2023）和Chen等人同时引入的推测抽样确保输出序列 ** 相同分布 ** 到大模型本身会产生的序列。没有质量权衡。只是快点。

四个草案验证者对家族主导了2026年的推断：

1. ** 香草投机（利维坦2023）。**单独的草稿模型（例如，Lama 3 1B）+验证器（例如，Lama 3 70 B）。
2. ** 美杜莎（Cai 2024）。**验证器上的多个解码头预测位置' t+1. t+k '并行。没有单独的草稿模型。
3. **EAGLE家族（Li 2024，2025）。**重用验证者隐藏状态的轻量级草稿;比香草更接近的接受率; 3-4倍典型。
4. ** 前瞻解码（Du 2024）。** Jacobi迭代;根本不需要草稿模型。自我猜测。小众但无依赖性。

2026年的每个生产推理栈都会默认进行推测解码。vLLM、TensorRT-LLM、SGLang和llama.cpp均至少支持vanilla + EAGLE-2。

## The Concept

### The core algorithm

给定验证者“M_q”和更便宜的草稿“M_p”：

1. 让' x_1.. x_k '是已解码的前置码。
2. ** 草案 **：使用“M_p”自回归提出“d_{k+1}，d_{k+2}，.，d_{k+N}'具有草案概率' p_1.. p_N '。
3. ** 并行验证 **：在“x_1”上运行“M_q”一次。x_k，d_{k+1}，.，d_{k+N}'，获得验证者概率' q_1. q_{N+1}'位置' k+1.. k+N+1 '。
4. ** 从左到右接受/拒绝每个草案令牌 **：对于每个“i”，以概率“min（1，q_i（d_i）/ p_i（d_i））”接受。
5. 在位置“j”处第一次拒绝时：来自“剩余”分布“（q_j - p_j）_+“标准化”样本“t_j”。“j”后面的所有草稿都被丢弃。
6. 接受所有“N”后：从“q_{N +1}”（免费奖励代币）中采样一个额外代币“t_{N+1}”。

剩余分布技巧是数学洞察力，可以保持输出完全分布，就像“M_q”从头开始采样一样。

### What determines speedup

令' a '=每个草案代币的预期接受率。令' c '=起草人与验证人的成本比。每步：

- 天真一代每个代币进行1次大型呼叫。
- 当“a”较高时，投机者会对每个“（1 -a ^{N+1}）/（1 -a）ð 1/（1-a）'代币进行1次大模型调用。

“a = 0.75”和“N = 5”的典型经验法则：大模特的电话数量减少3倍。草稿成本便宜5倍。总壁挂时钟下降~2.5倍。

** a取决于：**

- 草稿与验证者的接近程度。相同的家庭/相同的训练数据会显着提高a。
- 解码策略。贪婪草案对抗贪婪验证者：高阿尔法。温度采样：更难匹配;接受度下降。
- 任务类型。代码和结构化输出接受度更高（可预测）;自由形式的创意写作接受度更低。

### Medusa — drafts without a draft model

美杜莎在验证器上用额外的输出头替换了草稿模型。在位置“t”：

```
shared trunk → hidden h_t
    ├── head_0: predict token at t+1  (standard LM head)
    ├── head_1: predict token at t+2
    ├── head_2: predict token at t+3
    ├── head_3: predict token at t+4
```

每个头部输出自己的日志。在推理时，您从每个头部进行采样以获得候选序列，然后使用一次考虑所有候选延续的树注意方案进行一次向前传递进行验证。

优点：没有第二个型号。缺点：添加可训练参数;需要一个有监督的微调阶段（~1B代币）;接受率略低于具有良好草稿的普通推测。

### EAGLE — better draft by reusing hidden states

EAGLE-1/2/3（Li等人，2024-2025）使草稿模型成为一个微小的Transformer（通常为1层），它吸收验证者的最后一层隐藏状态。由于草案看到验证者的特征表示，因此其预测与验证者的输出分布密切相关。接受率从~0.6（香草）攀升至0.85+。

EAGLE-3（2025）在候选延续上添加了树搜索。vLLM和SGLang将EAGLE-2/3作为Lama 3/4和Qwen 3的默认规范路径。

### The KV cache dance

验证在一次向前传递中将“N”个草案令牌输入到验证器。这将验证者的KV缓存扩展“N”个条目。如果某些草稿被拒绝，您必须将缓存回滚到接受的前置长度。

生产实现（vLLM的“--speculative-models”、TensorRT-LLM的LookaheadDecoder）通过临时KV缓冲区处理此问题。先写，承诺接受。这在概念上并不难，但却很棘手。

## Build It

请参阅' code/main.py '。我们通过以下方式实现核心推测抽样算法（拒绝步骤+剩余分布）：

- 一个“大模型”，它是一个手工编码分布上的确定性softmax（因此我们可以通过分析来验证接受数学）。
- “模型草案”是大模型的扰动。
- 一个接受/拒绝循环，产生与直接抽样相同的边际分布。

### Step 1: the rejection step

```python
def accept_or_reject(q_prob, p_prob, draft_token, u):
    ratio = q_prob / p_prob if p_prob > 0 else float("inf")
    return u < min(1.0, ratio)
```

“u”是一个均匀随机数。' q_prob '是验证者对起草令牌的概率。' p_prob '是草稿模型的概率。利维坦定理是，这个伯努里判决，然后从拒绝的剩余中进行抽样，精确地保留了验证者的分布。

### Step 2: residual distribution

```python
def residual_dist(q, p):
    raw = [max(0.0, qi - pi) for qi, pi in zip(q, p)]
    s = sum(raw)
    return [r / s for r in raw]
```

从“q”元素中减去“p”，将负值钳位为零，重新规范化。在任何拒绝时都从中抽取样本。

### Step 3: one speculative step

```python
def spec_step(prefix, q_model, p_model, N, rng):
    drafts = []
    p_probs = []
    ctx = list(prefix)
    for _ in range(N):
        p_dist = p_model(ctx)
        d = sample(p_dist, rng)
        drafts.append(d)
        p_probs.append(p_dist[d])
        ctx.append(d)

    q_dists = [q_model(prefix + drafts[:i]) for i in range(N + 1)]

    for i, d in enumerate(drafts):
        u = rng.random()
        q_prob = q_dists[i][d]
        p_prob = p_probs[i]
        if u < min(1.0, q_prob / p_prob if p_prob > 0 else float("inf")):
            prefix = prefix + [d]
        else:
            res = residual_dist(q_dists[i], p_model(prefix))
            prefix = prefix + [sample(res, rng)]
            return prefix
    prefix = prefix + [sample(q_dists[N], rng)]
    return prefix
```

五个接受|一个奖励|一个验证者通行证中产生六个代币。

### Step 4: measure acceptance rate

以不同的草稿质量水平运行10，000个推测步骤。草图和验证者分布之间的绘图接受率与KL偏差。您应该看到一种干净的单调关系。

### Step 5: verify distribution equivalence

经验上：推测循环产生的代币的矩形图应该与直接从验证器采样产生的矩形图相匹配。这就是实践中的利维坦定理。卡方检验确认在抽样误差范围内。

## Use It

生产：

```bash
# vLLM with EAGLE
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --speculative-model /models/llama-3.1-eagle-70b \
    --speculative-draft-tensor-parallel-size 1 \
    --num-speculative-tokens 5

# vLLM with vanilla draft model
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --speculative-model meta-llama/Llama-3.2-1B-Instruct \
    --num-speculative-tokens 5
```

截至2026年中期，TensorRT-LLM拥有最快的美杜莎路径。“faster-whisper”用一个小草稿包裹了Whisper-large的推测性解码。

** 挑选草稿：**

| 战略 | 何时选择 | 加速比 |
|----------|--------------|---------|
| 香草草案（1B/3B美洲驼家庭） | 快速原型，无需培训 | 1.8-2.3 x |
| 美杜莎头 | 您可以微调验证器 | 2–3× |
| 老鹰-2 / 3 | 生产，最大速度 | 3–4× |
| Lookahead | 没有草稿，没有训练，没有额外的参数 | 1.3-1.6 x |

** 何时不规范解码：**

- 单序列生成1-5个代币。管理费用占主导地位。
- 充满创意/高温采样（a下降）。
- 内存受限部署（草案模型添加了VRAM）。

## Ship It

请参阅“输出/skill-spec-decode-picker.md”。该技能为新的推理工作负载选择推测性解码策略（vanilla / MedUSA / EAGLE / lookahead）和调整参数（N，草稿温度）。

## Exercises

1. ** 简单。**运行'代码/main.py '。确认推测性代币分布与验证者对50，000个代币的直接样本分布匹配，卡方p > 0.05内。
2. ** 中等。**对于“a = 0.5、0.7、0.85”，将加速（每个大型模型前锋的代币）绘制为“N”的函数。确定每个a的最佳“N”。(Hint：每次验证调用的预期令牌='（1 -a）'（1 -a）'。）
3. ** 很难。**实现一个微小的美杜莎：从第14课中取出Capstone GPT，添加3个额外的LM头部，用于预测位置t+2、t+3、t+4。在tinyshakespeare上进行火车，联合出现多头损失。比较接受率与通过截断相同模型而制作的普通草稿。
4. ** 很难。**实现回滚：从10个令牌前置的KV缓存开始，输入5个草稿令牌，模拟位置3处的拒绝。验证您的缓存读数在下一次迭代中正确匹配“prepper+前2个接受的草稿”。

## Key Terms

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| 范本草案 | “便宜的” | 提出候选令牌的较小模型;通常比验证器便宜10-50倍。 |
| 验证器 | “大的” | 我们保留其分布的目标模型;每个推测步骤运行一次。 |
| 录取率（a） | “草案正确的频率有多高” | 验证者接受草稿的每代币概率。0.7-0.9典型。 |
| 残差分布 | “拒绝的倒退” | '（q-p）_+'规范化;拒绝时从中进行抽样会保留验证者的分布。 |
| 奖金代币 | “免费的” | 当所有N个草稿都接受后，从验证者的下一步分发中再采样一个草稿。 |
| 美杜莎 | “草稿少投机” | 验证器上的多个LM头预测位置t+1。t+k并行。 |
| 鹰 | “隐藏状态草案” | 微小的Transformer草稿以验证者的最后一层隐藏状态为条件。 |
| 前瞻解码 | “雅各比迭代” | 使用定点迭代进行自我猜测;没有模型草案。 |
| 树木注意 | “一次验证多名候选人” | 同时考虑多个草案延续的分支验证。 |
| KV回滚 | “撤销被拒绝的草稿” | 刮擦KV缓冲区;接受时提交，拒绝时丢弃。 |

## Further Reading

- [利维坦、卡尔曼、马蒂亚斯（2023）。通过推测解码从变形金刚中快速推理]（https：//arxiv.org/ab/2211.17192）-核心算法和等效定理。
- [Chen等人（2023）。使用推测抽样加速大型语言模型解码]（https：//arxiv.org/ab/2302.01318）-并发介绍;干净的伯努里拒绝证明。
- [Cai等人（2024）。美杜莎：具有多个解码头的简单LLM推理加速框架]（https：//arxiv.org/ab/2401.10774）-美杜莎论文;树注意力验证。
- [Li等人（2024）。EAGLE：推测性抽样需要重新思考特征不确定性]（https：//arxiv.org/ab/2401.15077）- EAGLE-1;隐藏状态条件草案。
- [Li等人（2024）。EAGLE-2：Faster Inference of Language Models with Dynamic Draft Trees]（https：//arxiv.org/abs/2406.16858）- EAGLE-2;动态树深度。
- [Li等人（2025）。EAGLE-3：通过训练时间测试扩大大型语言模型的推理加速]（https：//arxiv.org/ab/2503.01840）- EAGLE-3。
- [Fu等人（2024）。使用前瞻解码打破LLM推理的顺序依赖性]（https：//arxiv.org/ab/2402.02057）-前瞻，无草稿方法。
- [vLLM docs -推测解码]（https：//docs.vllm.ai/en/latest/features/spec_decode.html）-规范的制作参考，包含所有四种策略。
- [SafeAIab/ EAGLE参考实现]（https：//github.com/SafeAILab/EAGLE）-EAGLE的参考代码-1/2/3。
