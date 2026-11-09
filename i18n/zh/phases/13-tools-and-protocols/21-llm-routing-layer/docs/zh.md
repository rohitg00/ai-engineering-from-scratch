#            

> 提供商锁定是昂贵的. 不同工具调用工作负载适合不同的模型. 路由网关提供一个API表面,重试,故障,成本跟踪和防护. 2026年将占据三种类型的主导地位:LiteLLM (开源自主托管),OpenRouter (管理SaaS),Portkey (生产级,开源于2026年3月). 这一课列出了决策标准,并通过了SDLB路由门户.

**Type:** Learn
**Languages:** Python (stdlib, routing + failover + cost tracker), TypeScript
**Prerequisites:** Phase 13 · 02 (function calling), Phase 13 · 17 (gateways)
**Time:** ~45 minutes

## 学习目标

- 区分自主托管,管理和生产级路由选项.
- 实施一个反弹链,以确定优先顺序重新尝试供应商故障.
- 追踪每次请求成本和托克使用在供应商之间.
- 对于给定的生产限制,选择LiteLLM,OpenRouter和Portkey之间.

## 问题

提供商路由情况:

1. **Cost.**对于一个分类任务,海库足够,对于一个合成任务,索尼特值得它. 按要求路线.

2. **Failover.**开放AI有个糟糕的时刻,每一个请求都失败了,你想要自动返回人类,而不会重新部署.

3. **Latency.**现场聊天界面需要快速的时间到第一代代码.

4. **Compliance.**欧盟用户必须留在欧盟地区.

5. **Experimentation.**两种模型在同一工作量上,测试桶的路线.

通过手动编码,每个集成都会重复.一个路由网关给一个与OpenAI兼容的API,处理其余的.

## 概念

### 基于 OpenAI的代理形状

路由门户暴露了`/v1/chat/completions`通过""来实现,它可以接受OpenAI的方案,并内部代理到"人类"/"双子座"/"科赫"/"奥拉马"任何东西.

### 模型姓名

代码是""的.`our_smart_model`当一个提供商发送新一代时,你改变了代号服务器侧面;你的代码不会触摸任何东西.

### 背后链

```
primary: openai/gpt-4o
on 5xx: anthropic/claude-3-5-sonnet
on 5xx: google/gemini-1.5-pro
on 5xx: refuse
```

通过网关来定义这个配置,反试计算预算,所以反弹升不会导致成本爆炸.

### 语义缓存

类似或接近相同的提示会进入缓存,而不是提供商.重复代理循环的节省率可能为30至60%.键是基于嵌入式的;几乎相同的提示共享缓存槽.

### 防护

网关级别:

- **PII redaction.**在发送提示之前,通过Regex或ML.
- **Policy violations.**拒绝禁止内容的提示.
- **Output filters.**除漏的完成.

波特基和康格都拥有专注的防护护.

### 每个关键利率限制

单个 API 关键 = 一个团队. 每个关键预算阻止一个团队消耗共享的配额.大多数网关支持这一点.

### 自主托管与管理交易

| Factor | LiteLLM (self-hosted) | OpenRouter (managed) | Portkey (production) |
|--------|----------------------|----------------------|----------------------|
| Code | Open source, Python | Managed SaaS | Open source (Mar 2026) + managed |
| Setup | Deploy a proxy | Sign up | Either |
| Providers | 100+ | 300+ | 100+ |
| Billing | Your own keys | OpenRouter credits | Your own keys |
| Observability | OpenTelemetry | Dashboard | Full OTel + PII redaction |
| Best for | Teams that want full control | Rapid prototyping | Production with compliance |

利特莱姆在拥有SRE团队并希望数据主权时获胜. 开通路由器在想要单个订阅而没有过度订阅时获胜. 需要防护和合规时获胜.

### 成本追踪

每个要求都包含`provider`现在`model`现在`input_tokens`现在`output_tokens`乘以每个模型的每个代币价格 (从门户管理的价格表中抽取).

### 转换方式

网关可以导航LLM电话和MCP样本请求.当采样请求的模型偏好特定模型时,网关转化为右后端.这是阶段13·17 (MCP网关) 和本课程的路由网关有时合并成一个服务.

### 路由策略

- **Static priority.**排名第一,回归错误.
- **Load balancing.**圆或重量.
- **Cost-aware.**选择最便宜的模型,满足延迟/质量.
- **Latency-aware.**在最后的9分钟中选择最快的模型.
- **Task-aware.**快速分类器路线编码到一个模型,总结到另一个模型.

```figure
tp-router-failover
```

## 用它

`code/main.py`执行一个路由门口在150行:接受OpenAI形状的请求,转换为每个提供商的条,运行优先回归链,追踪每请求成本,并对输入应用PII编辑通行.运行它三个场景:正常请求,主要提供商中断引发回归,编辑捕获的PII泄漏.

什么要看:

- `ROUTES`标签: alias -> 具体供应商优先排序列表.
- 倒退循环在5xx上重新尝试.
- 成本跟踪器乘以每个模型的价格乘以代币使用率.
- 信息编辑器在转发之前扫除SSN形状的模式.

## 运送它

这一课产生了`outputs/skill-routing-config-designer.md`鉴于工作负载配置 (延迟,成本,合规性),技能选择LiteLLM/OpenRouter/Portkey并生成路由配置.

## 运动

1. 跑步`code/main.py`引发停机情况;确认第二家供应商出现逆转,并将成本正确归因.

2. 添加语义缓存:提示的SHA256是一个搜索密钥;缓存击中即时返回. 测量重复通话的成本节省.

3. 添加一个快速分类器,将"代码"...的提示传递到一个支持智能的名,

4. 设计每组预算:每个团队都有一个月度支出限制;一旦达到限制,网关拒绝请求.选择执行细节性 (按要求或窗口).

5. 阅读LiteLLM,OpenRouter和Portkey文件.

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Routing gateway | "LLM proxy" | One-API-surface layer in front of many providers |
| OpenAI-compatible | "Speaks the OpenAI schema" | Accepts `/v1/chat/completions` shape, translates to any backend |
| Model alias | "our_smart_model" | Name in your code that the gateway maps to a concrete model |
| Fallback chain | "Retry list" | Ordered list of providers attempted on failure |
| Semantic caching | "Prompt-embedding cache" | Key is embedding of the prompt; near-duplicates share a cache hit |
| Guardrails | "Input/output filters" | Redact PII, reject policy violations |
| Per-key rate limit | "Team budget" | Quota scoped to an API key |
| Cost tracking | "Per-request spend" | Aggregate token usage x price per model |
| LiteLLM | "The open proxy" | Self-hostable OSS routing gateway |
| OpenRouter | "The managed SaaS" | Hosted gateway with credit-based billing |
| Portkey | "The production option" | Open-source + managed with guardrails built in |

## 进一步阅读

- [LiteLLM — docs](https://docs.litellm.ai/)自主托管的路由门户
- [OpenRouter — quickstart](https://openrouter.ai/docs/quickstart)管理的路由SaaS
- [Portkey — docs](https://portkey.ai/docs)生产路由,有护
- [TrueFoundry — LiteLLM vs OpenRouter](https://www.truefoundry.com/blog/litellm-vs-openrouter)决策指南
- [Relayplane — LLM gateway comparison 2026](https://relayplane.com/blog/llm-gateway-comparison-2026)供应商调查
