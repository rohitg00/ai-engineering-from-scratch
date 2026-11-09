# 预测解码 草稿,验证,重复

> 推迟解码是序列的.每个代币等待上一个. 投机解码打破链条:一个廉价的模型在一个前进通行中验证所有N代币,而昂贵的模型在一个前进通行中验证所有N代币. 当草案正确时,你为N代代付出了一个大额的前进.

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 07 (GPT Causal LM), Phase 7 · 12 (KV Cache & Flash Attention)
**Time:** ~60 minutes

## 问题

如果我们让3B草案5个代币前进,然后运行70B *一次*验证所有5,总数是$5 \times 3 + 30 = 45$对于最大5个被接受的代币`5×30 = 150 ms`这就是完全的投机解码比率:换取少量的额外的GPU内存 (草案模型) 为24x较低的解码延迟.

投机性样本采集,由Leviathan等 (2023) 和陈等同时引入,确保输出序列是**identically distributed**没有质量妥协,只是更快.

根据2026年推断,四个设计验证器对的家庭占据主导地位:

1. **Vanilla speculative (Leviathan 2023).**单独的草案模型 (例如,Llama 3 1B) +验证器 (例如,Llama 3 70B).
2. **Medusa (Cai 2024).**验证器上的多个解码头预测位置`t+1..t+k`没有单独的模型草案.
3. **EAGLE family (Li 2024, 2025).**轻量级的草稿,重复验证器隐藏状态;比尼拉更接近接受率;典型的34×.
4. **Lookahead decoding (Fu 2024).**简单的,但没有依赖.

在2026年,每一个生产推断堆都会默认地发送投机解码. vLLM,TensorRT-LLM,SGLang和 llama.cpp都支持至少尼 + EAGLE-2.

## 概念

### 核心算法

鉴于验证器$M_q$并且更便宜的草稿$M_p$其他:

1. 让我们$x_1 \ldots x_k$已解码的前.
2. **Draft**:使用 $M_p$推出自动推移$d_{k+1}, d_{k+2}, \ldots, d_{k+N}$具有草案概率$p_1 \ldots p_N$现在,我们要去.
3. **Verify in parallel**运行$M_q$一次就这样了$x_1 \ldots x_k, d_{k+1}, \ldots, d_{k+N}$获得验证器概率$q_1 \ldots q_{N+1}$对于职位$k+1 \ldots k+N+1$现在,我们要去.
4. **Accept/reject each draft token left to right**对于每一个$i$接受一个可能的$\min(1, q_i(d_i) / p_i(d_i))$现在,我们要去.
5. 在第一次拒绝位置$j$: 样本$t_j$由于"残留"分布而导致的$(q_j - p_j)_+$之后的所有草案都正常化了.$j$它们被丢弃.
6. 接受一切$N$: 样本一个额外的代币$t_{N+1}$其他$q_{N+1}$(免费奖金代币)

剩余分布技巧是保持输出分布的数学洞察力$M_q$没有任何东西.

### 什么决定了加速

让我们$\alpha$预期的每项项目代币的接受率.$c$项目/验证人成本比例.

- 无辜的世代每代币都会做一个大型号.
- 投机者每次打一个大型号电话$(1 - \alpha^{N+1}) / (1 - \alpha) \approx 1/(1-\alpha)$什么时候的代币$\alpha$了.

典型的指南$\alpha = 0.75$其他$N = 5$现在,我们在线观看,我们在线观看,我们在线观看,我们在线观看,我们在线观看,我们在线观看,我们在线观看,我们在线观看,我们在线观看,我们在线观看,我们在线观看,我们在线观看,我们在线观看,我们在线观看,我们在线观看,我们在线观看,我们在线观看,我们在线观看,我们在线观看,我们在线观看,我们在线观看,我们在线观看,我们在线观看,我们在线观看,我们在线观看,我们在线观看,我们在线观看,我们在线观看,我们在线观看,我们在线观看,我们在线观看,我们在线观看,我们在线观看,我们在线观看,我们在线观看,我们在线观看,我们在线观看,我们在线观看,我们在线观看,我们在线观看,我们在线观看,我们在线观看,我们在线观看,我们在线观看,我们在线观看,我们在线观看,我们在线观看.

**$\alpha$ depends on:**

- 如何接近验证器的草案.$\alpha$显著.
- 贪的草案与贪的验证器:高$\alpha$温度采样:难以匹配;接受度下降.
- 任务类型:代码和结构化输出接受更多 (可预测);自由形式的创意写作接受少.

### 梅杜萨  草案没有草案模型

梅杜萨将草案模型取代,在验证器上加上输出头.`t`其他:

```
shared trunk → hidden h_t
    ├── head_0: predict token at t+1  (standard LM head)
    ├── head_1: predict token at t+2
    ├── head_2: predict token at t+3
    ├── head_3: predict token at t+4
```

每个头都输出了自己的 logits. 在推断时,你从每个头进行样本来获得候选人序列,然后通过使用树注意方案验证一个前进通过,同时考虑所有候选人延续.

优势:没有第二个模型. 缺点:添加可训练的参数;需要监督的细节调整阶段 (~1B代币);接受率略低于良好的草稿的尼拉投机.

### 通过重复使用隐藏状态来更好地绘制

-1/2/3 (Li等, 20242025) 使草案模型成为一个微小的变压器 (通常是1层),它吞了验证器的最后层隐藏状态. 由于草案看到验证器的特征表示,因此它的预测与验证器的输出分布密切相关. 接受率从0.6 (尼拉) 升至0.85+ 这些是聊天基准的每代币率, 在混合生产流量上,17 · 05阶段计划为EAGLE-30.6至0.8次,域流量可能会降低.

3 (2025) 增加了对候选延续的树搜索. vLLM和SGLang 作为Llama 3/4和Qwen 3的默认规范路径,将Eagle-2/3作为3/3的预定规范路径.

### 的舞蹈

验证数据$N$通过一个前进传输,将验证器的KV缓存扩大到 $N$如果一些草案被拒绝,则必须将缓存重新滚动到接受的预写长度.

生产实施 (vLLM 项目)`--speculative-config`首先写一下,承诺接受.这不是概念上很难,但它很难.

```figure
draft-verify-tokens
```

## 建立它

看到`code/main.py`我们实施了核心投机性样本采集算法 (拒绝步骤+残余分布)

- 一个"大模型",是指指数定性软最大值,而不是指数编码的分布 (所以我们可以分析验证接受数学的结果).
- 它们是对大模型的颠覆.
- 接受/拒绝循环,产生与直接采样相同的边际分布.

`code/main.rs`果版的数据和数据库是相同的.它只使用标准库.随机数字与Python不同,但打印的结论是相同的.

```bash
python3 code/main.py
rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson
```

### 步骤1:拒绝步骤

```python
def accept_or_reject(q_prob, p_prob, draft_token, u):
    ratio = q_prob / p_prob if p_prob > 0 else float("inf")
    return u < min(1.0, ratio)
```

`u`是一个统一的随机数字.`q_prob`是验证者对拟定的代币的概率. `p_prob`利维雅坦定理是,这个伯诺利决定,然后是从废弃的残留样本中抽取样本,

### 步骤2:残余分布

```python
def residual_dist(q, p):
    raw = [max(0.0, qi - pi) for qi, pi in zip(q, p)]
    s = sum(raw)
    return [r / s for r in raw]
```

减去`p`其他`q`根据元素,将负值压缩到零,重新正常化.

### 步骤3:一个投机步骤

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

五个接受的 → 一个奖金 → 一个验证器通行中产生的六个代币.

### 步骤4:测量接受率

运行1万个投机步骤,在不同的草案质量水平.图片接受率与草案和验证器分布之间的KL差异.你应该看到一个清洁的单调关系.

### 步骤5:验证分布等效

经验:投机循环产生的代币的历史图应与直接从验证器中采样生成的历史图相匹配.这是实践中的利维亚坦定理.一个奇方体测试在采样错误中确认.

## 用它

产量:

```bash
# vLLM with EAGLE
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --speculative-config '{"method": "eagle", "model": "/models/llama-3.1-eagle-70b", "draft_tensor_parallel_size": 1, "num_speculative_tokens": 5}'

# vLLM with vanilla draft model
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --speculative-config '{"method": "draft_model", "model": "meta-llama/Llama-3.2-1B-Instruct", "num_speculative_tokens": 5}'
```

据悉,在2026年中旬,TensorRT-LLM将拥有最快的梅杜萨路径.`faster-whisper`语大的猜测解码用一个小的草稿.

**Picking a draft:**

| Strategy | When to pick | Speedup |
|----------|--------------|---------|
| Vanilla draft (1B/3B Llama family) | Fast prototype, no training | 1.8–2.3× |
| Medusa heads | You can fine-tune the verifier | 2–3× |
| EAGLE-2 / 3 | Production, max speed | 3–4× |
| Lookahead | No draft, no training, no extra params | 1.3–1.6× |

**When NOT to spec-decode:**

- 单次序列生成15个代币.
- 非常有创意/高温采样 ($\alpha$子
- 存储量限制的部署 (草案模型添加VRAM).

## 运送它

看到`outputs/skill-spec-decode-picker.md`技能选择一个投机式解码策略 (尼拉/梅杜萨/鱼/头) 和调节参数 (N,草稿温度) 进行新的推断工作负载.

## 运动

1. **Easy.**跑步`code/main.py`确认投机代币分布与验证人在50万代币中直接样本分布相匹配,在平平面 p >0.05内.
2. **Medium.**作为一个函数的图片加速 (每大模型前进的代币)$N$为了$\alpha = 0.5, 0.7, 0.85$确定最佳的方法$N$每个$\alpha$. (提示:每次验证调用预期的代币 = $(1 - \alpha^{N+1}) / (1 - \alpha)$)
3. **Hard.**执行一个小的梅杜萨:从14课中取下顶石GPT,添加3个额外的LM头,预测位置t+2,t+3,t+4. 训练小克斯佩尔,并进行多头损失.比较接受率与尼拉草图,通过缩小相同模型.
4. **Hard.**实现反弹:从10代标前标KV缓存开始,输入5个草案代标,模拟在3位的拒绝.在下一次回复时,检查缓存读数正确匹配"前标+第2个接受草案".

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Draft model | "The cheap one" | A smaller model that proposes candidate tokens; usually 10–50× cheaper than the verifier. |
| Verifier | "The big one" | The target model whose distribution we preserve; runs once per speculative step. |
| Acceptance rate ($\alpha$) | "How often the draft is right" | Per-token probability that the verifier accepts the draft. 0.7–0.9 typical. |
| Residual distribution | "The rejection fallback" | `(q - p)_+` normalized; sampling from this on rejection preserves the verifier's distribution. |
| Bonus token | "The free one" | When all N drafts accepted, sample one more from the verifier's next-step distribution. |
| Medusa | "Draft-less speculative" | Multiple LM heads on the verifier predict positions t+1..t+k in parallel. |
| EAGLE | "Hidden-state draft" | Tiny transformer draft conditioned on the verifier's last-layer hidden states. |
| Lookahead decoding | "Jacobi iteration" | Self-speculation using a fixed-point iteration; no draft model. |
| Tree attention | "Verify many candidates at once" | Branching verification that considers several draft continuations simultaneously. |
| KV rollback | "Undo rejected drafts" | Scratch KV buffer; commit on acceptance, discard on reject. |

## 进一步阅读

- [Leviathan, Kalman, Matias (2023). Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192)核心算法和等效定理.
- [Chen et al. (2023). Accelerating Large Language Model Decoding with Speculative Sampling](https://arxiv.org/abs/2302.01318)同时引入;清洁的伯诺利拒绝证明.
- [Cai et al. (2024). Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads](https://arxiv.org/abs/2401.10774)梅杜萨纸;树木注意力验证.
- [Li et al. (2024). EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty](https://arxiv.org/abs/2401.15077)-1;隐藏状态的预案.
- [Li et al. (2024). EAGLE-2: Faster Inference of Language Models with Dynamic Draft Trees](https://arxiv.org/abs/2406.16858)-2;动态树深度.
- [Li et al. (2025). EAGLE-3: Scaling up Inference Acceleration of Large Language Models via Training-Time Test](https://arxiv.org/abs/2503.01840)3号.
- [Fu et al. (2024). Break the Sequential Dependency of LLM Inference Using Lookahead Decoding](https://arxiv.org/abs/2402.02057)看着,没有草稿的方法.
- [vLLM docs — Speculative Decoding](https://docs.vllm.ai/en/latest/features/spec_decode.html)可信生产参考,四个战略都连接在一起.
- [SafeAILab / EAGLE reference implementation](https://github.com/SafeAILab/EAGLE) EAGLE-1/2/3的参考代码.
