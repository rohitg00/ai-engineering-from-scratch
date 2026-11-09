# 行动预算,反复上限和成本管理

> 平均平均的电子商务代理人每月的LLM成本从$1,200 to $据了解,在微软的代理管理工具包 (2026年4月2日) 中,微软的代理管理工具包编码了对此类类的防御:`max_tokens`根据"每任务代币和美元预算,每天/月限,反复限,级别模型路由,即时缓存,文本窗口,HITL检查点对昂贵的行动,杀死开关在预算违规时.安тропо克的Cloed Code Agent SDK在不同的名称下发送相同的原始化. 财务速度限制 例如在10分钟内切断访问量>50美元 捕获循环比月限更快.

**Type:** Learn
**Languages:** Python (stdlib, layered cost-governor simulator), TypeScript
**Prerequisites:** Phase 15 · 10 (Permission modes), Phase 15 · 12 (Durable execution)
**Time:** ~60 minutes

## 问题

专有代理人每次都花费了真钱.聊天机器人的坏输出是坏答案;代理人的坏循环是账单.业界记录的失败模式的术语是"拒绝钱包"

解决方案不是一个数字.它是一个不同时间尺度和细节性的限制堆:每次请求,每次任务,每小时,每天,每月.一个设计好的堆在几分钟内捕获了逃跑循环,几个小时内缓慢泄漏,并在一天内释放了坏东西.当代理长视线和自主时,同样的堆保持了预算.

这是一个工程课程:数学是微不足道的,学科是团队失败的地方.下面的限制列表都在微软代理管理工具包或人类克劳德代码代理SDK文件中命名.

## 概念

### 成本管理者堆

1. **`max_tokens` per request.**简单,防止任何一个电话发出无限的完成.
2. **Per-task token budget.**在整个运行中,不要超过N代币.
3. **Per-task dollar budget.**像代币一样,但用货币.`max_budget_usd`在"克劳德代码"中.
4. **Per-tool call cap.**超过N`WebFetch`电话,N`shell_exec`电话等等
5. **Iteration cap (`max_turns`).**总代理循环反复;防止无限的推理循环.
6. **Per-minute / per-hour / per-day / per-month cap.**窗,在不同的时间尺度上发现泄漏.
7. **Financial velocity limit.**举个例子,如果10分钟内支出超过50美元, 切断访问.
8. **Tiered model routing.**默认的较小模型;只有当分类器判断任务授权时,升级到更大的模型.
9. **Prompt caching.**系统快速和稳定的语境存储在供应商缓存中;重发的代币成本接近零.
10. **Context windowing.**缩小/总结,以保持活跃的背景低于门值;直接降低代币成本.
11. **HITL checkpoints on expensive actions.**在一个已知昂贵的操作 (长时间的工具调用,大量下载,昂贵的模型升级) 之前,需要人体的触摸.
12. **Kill switch on budget breach.**任何封顶火灾时会停止会议.封顶记录,需要单独的重新启用路径.

### 为什么堆,没有一个帽子

单个月限只能在钱包消失后捕获逃跑代理.每次请求的单个限量在会议水平上捕获什么都不了.不同故障模式需要不同的时间尺度:

- **Runaway loop**速度限制被捕.
- **Slow leak**据报道,每天的每天工作量均为2倍.
- **Bad release**(新版本使用5x代币):按每周/月限被捕.
- **Legitimate surge**(实际需求,不是错误): 通过清晰的日日日限被捕.

### 带预算表面

克劳德代码代理SDK揭示 (公开文件):

- `max_turns`    
- `max_budget_usd`美元上限; 违规的会期堕胎.
- `allowed_tools`现在,`disallowed_tools`工具和.
- 在使用工具之前,按定制计算成本的点.

结合使用许可模式的梯子 (课10).`autoMode`没有会议`max_budget_usd`无政府自主化. 人类明确地设置自动模式需要预算控制; 类别符是对成本直角的.

### 欧盟人工智能法,OWASP代理前十名

微软的代理管理工具包涵盖了OWASP代理排名前十的要求和欧盟人工智能法第14条 (人力监督) 要求.

### 观察到的$1,200 → $4,800 个案例

微软文件中的真实情况:一个电子商务代理, 工具允许代理在每次会议中进行调查. 没有循环检测. 没有工具帽子. 没有预警,每周增长. 解决方案是每种工具的顶加上每天的增长报警. 这是一个模板:每一个新工具表面都是新的潜在循环;每一个新工具都需要自己的封顶和自己的警报.

```figure
cost-governor-stack
```

## 用它

`code/main.py`模拟的代理在一些转折后漂浮到投票循环中; 层级的堆在速度窗口内抓住它,而单个月的盖顶直到几天后才会发射.

## 运送它

`outputs/skill-agent-budget-audit.md`审计拟定部署代理人的成本管理层,并标记缺失层次.

## 运动

1. 跑步`code/main.py`现在,禁用速度限制,然后测量代理在代代代 cap 抓住它之前"花多少钱".

2. 设计一个浏览器代理的工具封顶套件 (教训11).哪个工具需要最紧的封顶?哪个工具可以无限地运行,没有风险?

3. 阅读微软代理管理工具包文件.列出每个封顶类型的工具包名称.将每个工具包地图到故障模式中的一个 (运行循环,缓慢泄漏,错误释放,冲动).

4. 设置   价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格: 价格:`max_budget_usd`根据你的点估计,为 2x 证明了.

5. 克劳德·科德的`max_budget_usd`设计一个补充速度限制,你会执行外部.什么会触发切断,以及重新启动看起来像什么?

## 关键词

| Term | What people say | What it actually means |
|---|---|---|
| Denial of Wallet | "Runaway bill" | Agent loop generating spend with no cap to stop it |
| max_tokens | "Per-request cap" | Ceiling on a single completion's size |
| max_turns | "Iteration cap" | Ceiling on agent loop iterations in a session |
| max_budget_usd | "Dollar kill switch" | Session cost cap; aborts on breach |
| Velocity limit | "Rate cap" | Limit on spend per short window (e.g., $50 / 10 min) |
| Tiered routing | "Small model first" | Cheap model default; escalate only when classifier warrants |
| Prompt caching | "Cached system prompt" | Provider-side cache reduces re-send token cost to near zero |
| HITL checkpoint | "Human approval gate" | Human tap required before expensive action |

## 进一步阅读

- [Anthropic Claude Code Agent SDK — agent loop and budgets](https://code.claude.com/docs/en/agent-sdk/agent-loop) `max_turns`现在`max_budget_usd`工具的使用者.
- [Microsoft Agent Framework — human-in-the-loop and governance](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop)成本管理员检查站.
- [Anthropic — Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview)供应商成本控制.
- [Anthropic — Prompt caching (Claude API docs)](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)缓存机械.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy)长视野代理人的成本配置.
