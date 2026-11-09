# 法定学的终点 单位经济和多租户分配

> 传统的FinOps在LLM支出上断绝.成本是代币交易,而不是资源上班时间.标签不映射API调用是一个交易,而不是资产.工程决策 (即时设计,文本窗口,输出长度) 是财务决策.2026年游戏册在第一天对仪器的三个属性维度:每个用户 (`user_id`) 对于座位定价和扩展,每任务 (`task_id`其他`route`) 对于产品表面成本和优先级,`tenant_id`) 单位经济和更新. 两个代币层,一个藏的钱. 多租户产品的执行梯度:每租户的利率限制 (2-3倍预期峰值,清除429+再试);每日支出限额 (1.5-3倍合约的上限;触发加紧速度+警报);消耗点 z-score > 4 (自动暂停+开启页面). 归类模式:标签和汇总,远程测量连接器 (追踪ID →发票;最高精度),采样和抽象,基于模型的分配,事件来源,实时流媒体. 单位指标:每个解决查询的成本,每一个生成的文物的成本  不是$/M代币. 复制标签总是错失; 要求创建工具.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy cost-attribution simulator with kill switch)
**Prerequisites:** Phase 17 · 13 (Observability), Phase 17 · 14 (Caching)
**Time:** ~60 minutes

## 学习目标

- 解释传统的FinOps (标签+层次) 为什么不适用于LLM支出,并列出三个新的归属尺寸.
- 列出四个代币层 (即时,工具,内存,响应) 以及为什么单桶支付隐藏成本.
- 设计一个多租户产品的执行梯度 (利率 →支出 cap →杀死开关).
- 选择单位指标 (每个解决的查询/文物的成本) 而不是$/M代币.

## 问题

你的账单上写着4万美元.
- 租户花了它.
- 哪个产品特征驱动它.
- 任何个人使用者是否虐待.
- 无论是快速膨胀,工具调用,还是提升记忆力,

标签和集成在提供商侧工作云资源 (EC2,S3) 标签扩散到线条项目.LLM API呼叫不自动标签.

## 概念

### 属性三维度

**Per-user**(`user_id`):谁是什么成本. 驱动座位的定价,扩张对话,识别电源用户.

**Per-task**(`task_id`其他`route`车辆具有优先级,杀死成本的决定.

**Per-tenant**(`tenant_id`):哪个客户是利的. 驱动单位经济,续航定价,层次门.

仪器三位都在电话站第一天.

### 象征的四层

| Layer | Example | Typical % of total |
|-------|---------|---------------------|
| Prompt | system + user input | 40-60% |
| Tool | tool-call results fed back | 20-40% (agent workloads) |
| Memory | prior conversation / retrieved docs | 10-30% |
| Response | model output | 10-30% |

它们在属性方案中被分解.

### 执行阶梯

1. **Rate limit**预期峰值的2~3倍. 返回429个`Retry-After`租户看到摩擦,没有意外账单.

2. **Daily spend cap**预测,每租户的收费率为1.5-3倍,

3. **Kill switch**租户自动暂停租户; 电话页面;升级到运营+CS.

### 归因模式

- **Tag-and-aggregate**简单,粗略. 简单,简单,简单,简单,简单,简单,简单,简单,简单,简单,简单,简单,简单,简单,简单,简单,简单,简单,简单,简单,简单,简单,简单,简单,简单,简单,简单,简单,简单,简单,简单,简单,简单,简单,简单,简单,简单,简单,简单,简单,简单,简单,简单,简单,简单,简单,简单,简单,简单,简单,简单,简单,简单,简单,简单,简单
- **Telemetry joiner**通过追踪身份证将痕迹连接到账单.
- **Sampling + extrapolation**平均成本: 样本5-10%,乘以. 成本效益较高,不用排尾.
- **Model-based allocation**对于没有标签的遗留数据.
- **Event-sourced**实时的事件 (Kafka/Kinesis).
- **Real-time streaming**仪表板更新次下.

### 每个X的成本是单位指数

货币的价格是卖家的价格.

- 解决的支持票的成本.
- 产品成本
- 通过成功的代理任务的成本.
- 按用户会议分钟的成本.

关键成本与产品结果,否则优化是无关的.

### 成本归因的痕迹形状

```
trace_id: abc123
  user_id: u_42
  tenant_id: t_7
  task_id: task_classify_doc
  route: model_haiku
  layers:
    prompt_tokens: 1800
    tool_tokens: 600
    memory_tokens: 400
    response_tokens: 150
  cost_usd: 0.0135
  cached_input: true
  batch: false
```

通过每次通话发射. 存储在数据湖中. 按维度汇总. 17 期 13 期可观测性堆是这个生活的地方.

### 合金储蓄堆

堆积:缓存+批量+路线+网关.
- 缓存 L2 (阶段17 · 14):输入价格低于10倍.
- 批量 (阶段17·15):50%折扣.
- 路线到廉价型号 (阶段17·16):成本降低60%.
- 网关效率 (阶段17·19):冗余性+重试.

最好的情况: 起的基线是5-10%. 大多数团队都使用了2-3个杆;少数团队都使用了四个杆.

### 你应该记住的数字

- 分配尺寸:每用户,每任务,每租户.
- 快速,工具,内存,响应.
- 关闭开关:使用z分数> 4.
- 单位指标:每个解决查询的成本,而不是$/M代币.
- 堆积优化:可能的基线5%~10%

```figure
i4-spend-ladder
```

## 用它

`code/main.py`模拟一个多租户的LLM服务,使用三层级的执行梯度. 注射一个虐待租户,并证明杀死开关的射击.

## 运送它

这一课产生了`outputs/skill-finops-plan.md`根据产品和规模,设计了归属方案和执行阶梯.

## 运动

1. 跑步`code/main.py`杀人开关在哪个点射?
2. 设计一个每租户,每任务成本仪表板.
3. 你最大的租户是单位经济负, 根据客户影响,提出三个干预措施.
4. 计算支持产品的解决门票的成本: 3M代币/门票,每天约800门票,所有输入以GPT-5缓存率为0.125/M美元 (启动列表价格;查看现场门票卡).
5. 提议是否可以回归标签.

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Per-user attribution | "user-level cost" | `user_id` stamped on every call |
| Per-task attribution | "feature cost" | `task_id` + `route` identify product surface |
| Per-tenant attribution | "customer cost" | `tenant_id`; drives unit economics |
| Four token layers | "cost layers" | prompt + tool + memory + response |
| Rate limit | "429 guard" | Per-tenant ceiling enforced at gateway |
| Daily spend cap | "daily ceiling" | Tenant-scoped budget with alert |
| Kill switch | "auto-pause" | Spend z-score > 4 triggers auto-suspension |
| Cost per resolved | "product unit metric" | Cost tied to product outcome, not tokens |
| Telemetry joiner | "trace-to-billing" | Highest-accuracy attribution pattern |
| Stacked optimization | "cache+batch+route+gateway" | Compounding savings to ~5-10% baseline |

## 进一步阅读

- [FinOps Foundation — FinOps for AI Overview](https://www.finops.org/wg/finops-for-ai-overview/)
- [FinOps School — Cost per Unit 2026 Guide](https://finopsschool.com/blog/cost-per-unit/)
- [Digital Applied — LLM Agent Cost Attribution 2026](https://www.digitalapplied.com/blog/llm-agent-cost-attribution-guide-production-2026)
- [PointFive — Managed LLMs in Azure OpenAI](https://www.pointfive.co/blog/finops-for-ai-economics-of-managed-llms-in-azure-open-ai)
