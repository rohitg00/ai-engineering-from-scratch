# 面向 agent 的共识与拜占庭容错

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 经典分布式系统里的 BFT（Byzantine Fault Tolerance，拜占庭容错）撞上随机性十足的 LLM。2025-2026 年涌现了三条研究方向：**CP-WBFT**（arXiv:2511.10400）按置信度探针给每张选票加权；**DecentLLMs**（arXiv:2507.14928）走 leaderless（无领导者）路线，让 worker 并行提议、再用几何中位数聚合；**WBFT**（arXiv:2505.05103）把加权投票和 Hierarchical Structure Clustering（分层结构聚类）结合，把节点拆成 Core 和 Edge。"Can AI Agents Agree?"（arXiv:2603.01213）这篇论文给出的实证结论很扎心——即使是标量共识，今天也很脆弱：单个会撒谎的 agent 就能让 Mixture-of-Agents 翻车。BFT 是必要的，但远远不够。本课会搭一个最小版的 BFT 协议，注入三类 agent 特有的攻击（拜占庭谎言、谄媚式从众、相关错误的单一栽培），然后量度每种共识变体能扛到什么程度。

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 16 · 07 (Society of Mind and Debate), Phase 16 · 13 (Shared Memory)
**Time:** ~75 minutes

## 问题（Problem）

你有 N 个 LLM agent，每个都给出一个答案。它们意见不一致。多数票（majority vote）选了错的那个，因为有两个 agent 是相关的（同一个 base model、同一份训练数据、同一种失败模式）。第三个 agent 恰好以一种新颖的方式答错——所以多数派是个伪多数派。

再加一个会撒谎的 agent：它故意给错答案。或者一个谄媚（sycophantic）的 agent：它会附和最后一个发言的人。在经典 BFT 里，假设是拜占庭节点占比 `f < n/3`，且行为可以任意。而 2026 年的现实是：LLM 节点即使在"诚实"时也是随机的、跨模型相关、还会被彼此的输出影响。你没法把它们当成独立的伯努利投票者。

经典 BFT（PBFT，1999）并没有错——它只是不完整。它能处理任意比特翻转，却处理不了"三个诚实 agent 因为共享训练数据而共享同一个幻觉"这种情况。本课会以 PBFT 为底，叠加三个 2025-2026 的改造方案。

## 概念（Concept）

### 经典 BFT 给你的能力

Practical Byzantine Fault Tolerance（Castro & Liskov，OSDI 1999）能容忍 `f < n/3` 个拜占庭节点。协议有三个阶段（pre-prepare、prepare、commit）和两个原语（签名消息、quorum 证书）。在 `n >= 3f + 1` 个节点（无论诚实或恶意）之间就单一值达成一致。

保证很强，但前提是：

1. **故障互相独立。** 拜占庭节点之间不串通。
2. **诚实节点是真的诚实。** 诚实输出的正确性不在协议视野内；协议只对齐分歧。
3. **问题有 ground truth。** 即便共识到的是错的事实，那也叫共识。

LLM agent 把这三条全打破了。两个跑同一个 base model 的 agent 共享故障。即便是"诚实"的 LLM 也会 hallucinate（幻觉）。而在模糊问题上，"真相"就是 agent 们的决定——没有外部 oracle。

### 三种 LLM 特有的攻击

**拜占庭谎言（Byzantine lie）。** 某个 agent 故意输出错答案。只要 `f < n/3`，经典 BFT 就能扛住。

**谄媚式从众（Sycophantic conformity）。** 某个 agent 在投票前会先看别人的答案，然后跟最后一个发言的人对齐。这不算恶意，但会和最大声那一方相关。经典 BFT 防不住，因为这个 agent 每一步签名验证都过得去。

**相关错误的单一栽培（Correlated-error monoculture）。** 三个 agent 共用一个 base model，它们一起 hallucinate 出同一个错答案。多数派就是错的。经典 BFT 帮不上忙，因为这三个都"诚实地"持同一意见。

### 2025-2026 的应对

**CP-WBFT**（arXiv:2511.10400）—— Confidence-Probed Weighted BFT，置信度探针加权 BFT。每个投票者在答案上附一份置信度探针（自报概率，或者由独立校准模型给出的预测）。投票权重随置信度缩放。论文报告在完全图上 BFT 性能提升 +85.71%。主要缓解：谄媚式从众（从众的 agent 在自己主动给出的立场上往往置信度偏低）。

**DecentLLMs**（arXiv:2507.14928）—— 无领导者方案。worker agent 并行提议，evaluator agent 给提议打分，最终答案是被打分立场的几何中位数。在 `f < n/2` 时仍然鲁棒。主要缓解：拜占庭谎言、相关错误（几何中位数对离群点鲁棒，会向密集簇方向收敛，而不是向受模型偏置影响的均值方向）。

**WBFT**（arXiv:2505.05103）—— 带 Hierarchical Structure Clustering 的加权 BFT。投票权重由响应质量加上从历史中学到的信任分综合决定。把 agent 聚成 Core 和 Edge：Core 先达成共识，Edge 跟进。主要缓解：可扩展性（Core 共识规模小、速度快），以及部分缓解 monoculture（Core 可以按多样性挑选）。

### 实证：「Can AI Agents Agree?」（arXiv:2603.01213）

这篇论文测量多个前沿模型上的标量共识（让 LLM agent 就单个数值达成一致）。结论挺难堪：

- 即使没有任何对手，LLM agent 在很多基准上对标量问题的不一致率都超过 30%。
- 单个采用欺骗人格的 agent，可以把 Mixture-of-Agents 的共识从诚实基线上拉偏 40+ 个百分点。
- 不一致率与模型多样性正相关——异质 ensemble 比同质 ensemble 分歧更多（好处：错误不相关）但也漂移得更慢（坏处：达成一致的耗时更长）。

要点：BFT 给你的是把输出对齐的机器，但它不会告诉你被对齐的输出是不是对的。要和验证（Phase 16 · 08 角色专精）、多样性（Phase 16 · 15 debate 变体）、evaluator agent（Phase 16 · 24 基准测试）一起用。

### 协议核心，最简版

面向 LLM agent 的最小 BFT 一轮：

```
1. task arrives; each agent i produces answer a_i
2. each agent attaches confidence probe c_i in [0, 1]
3. aggregator collects (a_i, c_i) from all n agents
4. aggregator groups by semantic cluster (equivalent answers)
5. aggregator computes weight for each cluster C:
     w(C) = sum_{i in C} c_i
6. winner = cluster with max weight, if max > threshold * sum(c_i)
   else: retry or escalate
7. minority clusters logged with provenance for post-hoc audit
```

语义聚类这一步是 LLM 特有的扭转。"the study reports 4.2%"和"4.2% improvement"是同一个 cluster。朴素的字符串相等检查会漏掉。生产环境里要么用一个轻量 embedding 模型，要么做显式规范化。

### 阈值调参

`threshold` 参数决定何时接受、何时重试。太低：你会接受弱多数派。太高：什么都接受不了。经验区间：`n=5-7` 个 agent 时取 0.5-0.67，更小的 `n` 取更高值。低于阈值就升级到人工，或者切到另一个 agent ensemble。

### 共识帮不上忙的地方

- **模糊问题。** 如果问题没有 ground truth，共识就是一种意见。那就别叫它共识。
- **复合问题。** "写代码并解释"——两个答案。两个答案分别投票。
- **对抗性多轮。** 如果 agent 能看到前几轮并模仿（Du 2023 debate），它们就会无视真相、彼此附和。所以要限轮次（一般 2-3 轮）。

## 动手实现（Build It）

`code/main.py` 实现了：

- `AgentVoter` —— 一个写死的策略，输出 (answer, confidence)。
- `MajorityVote` —— 经典相对多数投票。
- `CPWBFT` —— 带语义聚类的置信度加权投票。
- `DecentLLMs` —— 在打分提议上做几何中位数聚合。
- `Scenario` —— 在三种攻击模式下跑各个聚合器。

实现的攻击模式：

1. `byzantine`：一个 agent 用高置信度撒谎。
2. `sycophancy`：一个 agent 抄它最先看到的答案，并匹配其置信度。
3. `monoculture`：三个 agent 以中等置信度共享同一个错答案（相关错误）。

跑：

```
python3 code/main.py
```

预期输出：一个 (attack, aggregator) -> final answer 的表，正确答案高亮。相对多数会在 monoculture 这种场景下翻车。CPWBFT 的置信度加权能缓解 sycophancy。DecentLLMs 的几何中位数在 monoculture 占比不到一半时会把结果拉向诚实簇。

## 用起来（Use It）

`outputs/skill-consensus-designer.md` 给一个多 agent ensemble 设计共识协议：聚类方法、加权方式、阈值，以及未达阈值轮次的升级策略。

## 上线部署（Ship It）

任何共识机制上线前：

- **至少用上面三种攻击模式做过攻防测试。** 你的协议应该可预测地失败，而不是默默失败。
- **每个少数派 cluster 都带 provenance（来源）记录下来。** 少数派 cluster 是相关错误的早期预警系统。
- **强制限轮次。** 不要"一直 debate 到达成一致"——那会奖励谄媚。
- **把"达成一致"和"正确"分开。** 共识输出要送到一个 verifier；verifier 独立于这个 ensemble。
- **监控一致率。** 急升说明从众偏置（conformity bias）；急降说明模型漂移。

## 练习（Exercises）

1. 跑 `code/main.py`。确认相对多数在 monoculture 攻击下会失败，但当 monoculture 的置信度低于 0.7 时 CPWBFT 能部分缓解。
2. 加第四种攻击模式：**沉默弃权（silent abstention）**——一个 agent 拒答（"I don't know"）。每个聚合器该如何处理弃权？实现你的方案。
3. 把语义聚类从字符串规范化换成 embedding 相似度（任选一个开源 embedding 模型）。sycophancy 攻击会怎样？
4. 读 CP-WBFT（arXiv:2511.10400）。实现置信度探针的校准步骤（用一个独立校准模型来核查每个 agent 自报的置信度）。测量在 monoculture 场景下的准确率提升。
5. 读「Can AI Agents Agree?」（arXiv:2603.01213）。复现一个简化的标量共识实验：三个 agent、一个标量问题、欺骗人格 prompt。CPWBFT 或 DecentLLMs 能抓到吗？

## 关键术语（Key Terms）

| 术语 | 大家口头怎么说 | 实际是什么 |
|------|----------------|------------------------|
| BFT | "拜占庭容错" | Castro-Liskov 1999 协议，能在 `f < n/3` 个任意故障下达成共识。 |
| Byzantine | "任何坏行为" | 一个可以撒谎、丢消息、悄悄失败的节点——除了"安全崩溃"以外什么都干得出来。 |
| Confidence probe | "你有多确定？" | 自报或由校准器预测的概率，附在投票上。 |
| Semantic clustering | "同一个答案、不同的措辞" | 在数票前把等价答案归到一组。 |
| Geometric median | "鲁棒的中心" | 使到样本点距离之和最小的那个点。和均值不同，对离群点鲁棒。 |
| Monoculture | "同一个模型、同样的失败" | agent 共享训练数据或 base model 时的相关错误。 |
| Sycophantic conformity | "跟着大声那位走" | 一个 agent 的票偏向最先/最响发言的那个。 |
| Core/Edge | "分层 BFT" | WBFT 的拆分：小规模 Core 先达成共识，Edge 节点跟进。把延迟封顶。 |

## 延伸阅读（Further Reading）

- [Castro & Liskov — Practical Byzantine Fault Tolerance (OSDI 1999)](https://pmg.csail.mit.edu/papers/osdi99.pdf) — 奠基之作
- [CP-WBFT — Confidence-Probe Weighted BFT](https://arxiv.org/abs/2511.10400) — 按置信度给票加权
- [DecentLLMs — leaderless multi-agent consensus](https://arxiv.org/abs/2507.14928) — 几何中位数聚合
- [WBFT — Weighted BFT with Hierarchical Structure Clustering](https://arxiv.org/abs/2505.05103) — Core/Edge 拆分以封顶延迟
- [Can AI Agents Agree?](https://arxiv.org/abs/2603.01213) — 标量共识的脆弱性与欺骗人格攻击
