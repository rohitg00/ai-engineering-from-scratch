# 失败模式 —— MAST、群体思维、单一文化、级联错误

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 2026 年的参考分类法是 **MAST**（Cemri et al., NeurIPS 2025, arXiv:2503.13657），它来自 7 个 SOTA 开源 MAS 的 1642 条执行轨迹（trajectory），结果显示**失败率 41–86.7%**。三大根类别：**Specification Problems（规格问题，41.77%）**——角色含糊、任务定义不清；**Coordination Failures（协调失败，36.94%）**——通信中断、状态失同步；**Verification Gaps（验证缺口，21.30%）**——缺少校验、缺少质量检查。**Groupthink（群体思维）** 家族（arXiv:2508.05687）补充了：单一文化坍塌（同一基座模型 → 错误高度相关）、从众偏差（agent 互相强化彼此的错误）、心智理论（theory of mind）缺失、混合动机动力学、级联可靠性失败。级联示例：retry storm（重试风暴），支付失败触发订单重试，订单重试又触发库存重试，把库存服务打爆（几秒钟内 10 倍负载——需要 circuit breaker，断路器）。Memory poisoning（内存投毒）：某个 agent 的 hallucination（幻觉）写入共享内存，下游 agent 把它当事实；准确率缓慢衰减，根因排查极痛苦。**STRATUS**（NeurIPS 2025）报告通过专门的检测 / 诊断 / 验证 agent 实现 1.5 倍的缓解成功率提升。本课把失败模式当作一等工程目标。

**Type:** Learn
**Languages:** Python (stdlib)
**Prerequisites:** Phase 16 · 13 (Shared Memory), Phase 16 · 14 (Consensus and BFT), Phase 16 · 15 (Voting and Debate Topology)
**Time:** ~75 minutes

## 问题（Problem）

多 agent 系统在真实任务上的失败率是 41–86.7%（Cemri et al. 2025 在 7 个开源 MAS 上测得）。这不是「再加几个 agent」就能调好的。这些失败有结构性成因。MAST 分类法给了你类别。本课把每一类映射到具体的检测、诊断、缓解套路，让那些数字不再像随口报的。

2026 年的生产实践是把失败模式当作设计输入。你的架构在能逐项指着 MAST 每一类、并说出你部署的对应缓解措施之前，都不算「足够好」。

## 概念（Concept）

### MAST 类别（MAST categories）

**Specification Problems（规格问题，占失败的 41.77%）。** agent 的任务没被定义得足够紧。例如：

- 角色含糊：两个 agent 都以为自己是 reviewer（验证器）。
- 任务欠规格：用户想要某个特定角度的概述，prompt 却只是 "summarize this"。
- 成功标准隐式：agent 自己也不知道有没有做成。

缓解：
- 写明确的角色契约。每个 agent 的 prompt 要写清楚它做什么*以及它不做什么*。
- 每个任务都有验收测试。agent 启动前定义「完成的样子是 X」。
- 起飞前规格检查：另一个 agent 在分派前审阅任务定义。

**Coordination Failures（协调失败，36.94%）。** 通信或状态层面的崩坏。

例如：
- 两个 agent 不加同步地更新共享状态。
- agent 之间消息丢失（队列故障、超时）。
- 状态漂移：agent A 以为任务已完成；agent B 还在执行。

缓解：
- 带版本的共享状态 + 乐观并发控制。
- 关键消息显式 ack（重试直到 ack）。
- 周期性状态同步检查点；及早发现漂移。

**Verification Gaps（验证缺口，21.30%）。** 输出没有任何独立检查。

例如：
- 一个 agent 自称成功，没人验证。
- 一串 agent 各自信任前一个的输出。
- 涌现的组合行为没有测试覆盖。

缓解：
- 独立的 verifier（验证器）agent（见第 13 课）。只读、独立的源访问。
- 显式 handoff（交接包）契约：「A 的输出必须经过 checker C 才能进入 B」。
- 结果落日志，便于事后分析。

### 群体思维家族（Groupthink family，arXiv:2508.05687）

agent 同质化或互相模仿时会出现的五种相关失败：

**Monoculture collapse（单一文化坍塌）。** 同一基座模型或同一训练数据 → 错误高度相关。三个 agent 共享一个 LLM，就共享它的 hallucination。

**Conformity bias（从众偏差）。** agent 会向最大声或最自信的同伴靠拢，哪怕对方是错的。

**Deficient ToM（心智理论缺失）。** agent 没法对彼此的信念建模；协调随之崩塌（见第 18 课）。

**Mixed-motive dynamics（混合动机动力学）。** 激励只是部分对齐的 agent 会漂向「折中中间值」，谁都不满意。

**Cascading reliability failures（级联可靠性失败）。** 某个组件的错误模式触发依赖组件的错误模式。

### 级联示例 —— retry storm（The retry storm）

2026 年一个经典事故模式：

```
payment service fails 10% of requests
   ↓
order agent retries payment (exponential backoff but naive)
   ↓
each retry is a new order-inventory check
   ↓
inventory service sees 2x normal load
   ↓
inventory service starts timing out
   ↓
every order retries inventory check
   ↓
inventory service sees 10x normal load
   ↓
cluster goes down
```

修法很经典：**circuit breaker（断路器）**。当下游错误率超过阈值时，短路掉，用缓存或默认结果应付。再加上每个请求的重试预算上限。

circuit breaker 是少数几个能从分布式系统里直接照搬、不用改的多 agent 失败缓解手段之一。

### Memory poisoning（再访）（Memory poisoning revisited）

第 13 课讲过：某个 agent 的 hallucination 变成共享内存事实；下游 agent 在被毒化的事实上推理。用 MAST 的话讲，这是共享内存层的验证缺口。

症状是准确率缓慢衰减。你不会看到崩溃；你看到的是难以追根溯源的慢漂移。

缓解：append-only 日志、provenance（出处溯源）、不可写的 verifier。第 13 课已覆盖。

### STRATUS —— 用于失败检测的专门 agent（STRATUS — specialized agents for failure detection）

STRATUS（NeurIPS 2025）报告称，部署以下三类 agent 后，缓解成功率提升 1.5 倍：

- **Detection agent（检测 agent）。** 监测症状模式（高分歧、重试激增、准确率漂移）。
- **Diagnosis agent（诊断 agent）。** 给定症状，从 MAST 分类法里推断最可能的根因。
- **Validation agent（验证 agent）。** 缓解措施部署后，检查症状是否消除。

这就是 SRE 风格的事故响应，应用到 agent 系统上。三种角色都可以是带有专门 prompt 的 LLM agent。

### 失败模式审计（The failure-mode audit）

2026 年的最佳实践是每年（或每个大版本）做一次失败模式审计：

1. **采样轨迹。** 收集约 1000 条真实执行轨迹。
2. **归类。** 把每条轨迹的失败映射到 MAST + Groupthink 类别。
3. **算分类失败率。** 哪类在你的系统里占主导？
4. **缓解排序。** 哪个修复能消掉最多失败？
5. **挑 2–3 个缓解。** 实施；下季度再审计。

纪律比具体选择更重要。没有审计，失败就会和噪声混在一起，永远得不到系统性处理。

### 当系统静默失败时（When systems fail silently）

最危险的失败类别是「静默正确性失败」。一个会大声出事的系统（崩溃、异常、报警）可以监控。一个产出貌似合理但其实错误结果的系统，靠异常日志根本发现不了。这就是为什么验证缺口虽然只占 21.30% 的数量，却是单次失败成本最高的一类。

要在以下方面投入：
- 抽样人工 review。
- 黄金数据集回归测试。
- 在重要输出上做跨 agent 交叉核验。

### 失败 vs 慢失败（Failure vs slow failure）

有些失败是即时的；有些是慢的。即时失败（超时、schema 不匹配、auth 错误）检测成本低。慢失败（memory poisoning、单一文化漂移、角色含糊）检测和预防成本都高。

2026 年工程上的做法：埋点慢失败的代理指标，让你能在漂移变成肉眼可见的错误前抓到它。一致率（agreement rate）、重试率、输出长度分布、连续 agent 版本之间的编辑距离，都是有用的代理指标。

## 动手实现（Build It）

`code/main.py` 实现了：

- `FailureTaxonomy` —— 把模拟事故归入 MAST + Groupthink 类别。
- `CircuitBreaker` —— 经典模式；错误率超过阈值时打开。
- `RetryStormSimulator` —— 演示级联失败；可开关 circuit breaker。
- `DetectionAgent` —— 脚本化的 STRATUS 风格症状匹配器。

运行：

```
python3 code/main.py
```

预期输出：
- 没有 circuit breaker 的 retry storm：库存错误炸开（模拟）。
- 有 circuit breaker：在阈值处封顶；返回降级响应。
- 检测 agent 标记出该模式并指出对应的 MAST 类别。

## 用起来（Use It）

`outputs/skill-mast-auditor.md` 在多 agent 系统上跑一次 MAST 风格的失败模式审计。轨迹 → 归类 → 缓解排序。

## 上线部署（Ship It）

生产中的失败模式纪律：

- **每季度一次 MAST 审计。** 不是每年。系统增长时类别分布会变。
- **circuit breaker 到处用。** 每一次对依赖服务的对外调用都加。默认打开阈值 5–10% 错误率。
- **黄金数据集。** 小、高质量、人工审过。每周对它做回归测试。
- **STRATUS 三件套。** Detection + Diagnosis + Validation agent 监控生产。先只上 detection agent；症状变嘈杂时再加 diagnosis。
- **失败预算。** 按类别明确写出失败率 SLO。超预算就触发「停止发版」对话。

## 练习（Exercises）

1. 跑 `code/main.py`。确认 circuit breaker 给 retry storm 封了顶。改改失败阈值，观察取舍。
2. 实现一个**慢失败代理指标**：3 个并行 agent 之间的一致率。当它陡降时触发告警。逐渐提高 agent 输出的相关性来模拟单一文化漂移。
3. 读 Cemri et al.（arXiv:2503.13657）。挑他们 7 个 MAS 中的一个，列出它前 3 类失败。这些跟 MAST 的预测对得上吗？
4. 读 Groupthink 论文（arXiv:2508.05687）。指出五种模式里在生产中最难检测的那个。提一个代理度量。
5. 给你熟悉的某个具体多 agent 系统设计一个 STRATUS 风格的「检测—诊断—验证」三件套。检测在盯哪些症状？诊断推荐哪些缓解？验证如何确认它们生效？

## 关键术语（Key Terms）

| 术语 | 大家口头怎么讲 | 它实际是什么意思 |
|------|----------------|------------------------|
| MAST | "2026 年的分类法" | Cemri 2025；3 大根类 + 14 子类失败。 |
| Specification Problem | "角色含糊" | 任务或角色定义不足；agent 不知道该做什么。 |
| Coordination Failure | "状态漂移" | agent 之间通信或同步崩坏。 |
| Verification Gap | "没人检查" | 输出未经独立校验就被接受。 |
| Groupthink family | "同质化失败" | 单一文化、从众、ToM 缺失、混合动机、级联。 |
| Monoculture collapse | "同模型，同幻觉" | 共享基座模型或训练数据带来的相关错误。 |
| Retry storm | "级联错误放大" | 一次失败触发重试，重试又向下游放大负载。 |
| Circuit breaker | "按错误率快速失败" | 错误率超阈值时打开；用默认值短路。 |
| STRATUS | "事故响应三件套" | Detection + diagnosis + validation agent。1.5 倍缓解成功率。 |
| Memory poisoning | "幻觉传播开来" | 共享内存事实被污染；下游 agent 在毒物上推理。 |

## 延伸阅读（Further Reading）

- [Cemri et al. — Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/abs/2503.13657) —— MAST 分类法，NeurIPS 2025
- [Groupthink failures in multi-agent LLMs](https://arxiv.org/abs/2508.05687) —— 单一文化、从众，以及五家族分类法
- [STRATUS — specialized agents for MAS incident response](https://neurips.cc/) —— NeurIPS 2025 论文集条目（检测 + 诊断 + 验证）
- [Release It! — stability patterns (Nygard)](https://pragprog.com/titles/mnee2/release-it-second-edition/) —— circuit breaker 的经典参考
- [Anthropic — Multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) —— 生产环境失败模式笔记
