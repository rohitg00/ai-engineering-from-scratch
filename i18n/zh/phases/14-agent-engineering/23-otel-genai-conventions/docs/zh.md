# 开放电气通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通用通

> 开通通信的GenAI SIG (于2024年4月推出) 定义了代理遥测标准方案.跨域名称,属性和内容捕获规则在供应商之间融合,因此代理痕迹在Datadog,Grafana,Jaeger和Honeycomb中意味着相同的东西.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 13 (LangGraph), Phase 14 · 24 (Observability Platforms)
**Time:** ~60 minutes

## 学习目标

- 命名GenAI跨度类别:模型/客户端,代理,工具.
- 区分`invoke_agent`客户与内部范围,以及当每一个应用时.
- 列出最高级别的GenAI属性:提供商名称,请求模型,数据源ID.
- 解释内容捕获合同:选择,`OTEL_SEMCONV_STABILITY_OPT_IN`其他国家

## 问题

每个供应商都发明了自己的跨度名称. 运营团队最终构建每个框架的仪表板. OpenTelemetry的GenAI SIG通过定义一个标准来解决这个问题.

## 概念

### 跨度类别

1. **Model / client spans.**覆盖原始的LLM调用.由供应商SDK (Anthropic,OpenAI,Bedrock) 和框架模型适配器发行.
2. **Agent spans.** `create_agent`(当代理人构建时) 和`invoke_agent`它们在运行时.
3. **Tool spans.**通过父母-孩子关系连接到代理跨度.

### 代理跨度命名

- 标签:`invoke_agent {gen_ai.agent.name}`如果有名称; 返回`invoke_agent`现在,我们要去.
- 的类型:
  - **CLIENT**用于远程代理服务 (OpenAI助理API,Bedrock代理).
  - **INTERNAL**用于正在进行的代理框架 (LangChain, CrewAI,本地ReAct).

### 关键属性

- `gen_ai.provider.name` `anthropic`现在`openai`现在`aws.bedrock`现在`google.vertex`现在,我们要去.
- `gen_ai.request.model`模型身份证.
- `gen_ai.response.model`解决模型 (可能因路由而不同于请求).
- `gen_ai.agent.name`代理身份证.
- `gen_ai.operation.name` `chat`现在`completion`现在`invoke_agent`现在`tool_call`现在,我们要去.
- `gen_ai.data_source.id`用于RAG:咨询了哪个库或商店.

技术特定的公约存在于人类,Azure AI 推理,AWS 床床,OpenAI.

### 内容捕获

默认规则:仪器不应默认捕获输入/输出.捕获通过:

- `gen_ai.system_instructions`
- `gen_ai.input.messages`
- `gen_ai.output.messages`

建议的生产模式:将内容存储外部 (S3,您的日志存储),记录引用在跨度 (指标标识别,而不是散文).这是27课内容中毒防御,以实现可观测性.

### 稳定性

根据2026年3月的实验性情况,大多数会议都会进行实验性.

```
OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental
```

基因AI在其LLM观察性方案中原生归因.其他后台 (Grafana,Honeycomb,Jaeger) 支持原始属性.

### 在这个模式出现错误的地方

- **Capturing full prompts in spans.**信息,秘密,客户数据,可以被操作人员读取.
- **No `gen_ai.provider.name`.**由于缺乏属性,多供应商仪表板会断裂.
- **Spans without parent links.**孤儿工具的范围,总是传播背景.
- **Not setting stability opt-in.**在后端升级时,你的属性可能会被改名.

```figure
ae-genai-span-tree
```

## 建立它

`code/main.py`执行与GenAI公约相匹配的 stdlib跨度发射器:

- `Span`通过Genai属性方案.
- `Tracer`随着`start_span`它们是嵌的.
- 发射一个编写的代理:`create_agent`现在`invoke_agent`,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,`chat`对于法学士的电话.
- 内容捕获模式,可以将外部提示存储并记录跨度上的身份证.

运行它:

```
python3 code/main.py
npx tsx code/main.ts
```

输出:包含所有所需的GenAI属性的跨度树,以及显示选择内容引用的"外部存储器".

## 用它

- **Datadog LLM Observability**图表属性原生.
- **Langfuse / Phoenix / Opik**自动工具生态系统.
- **Jaeger / Honeycomb / Grafana Tempo**原始 OTel 痕迹;从GenAI属性构建仪表板.
- **Self-hosted**使用GenAI处理器运行OTel收藏器.

## 运送它

`outputs/skill-otel-genai.md`电线 OTel GenAI 扩展到现有代理,具有内容捕获默认和外部参考存储.

## 运动

1. 工具你的课01 复制循环`invoke_agent`通过一个Jaeger实例来传输.
2. 在"仅引用"模式中添加内容捕获:提示到SQLite,跨度属性只包含行ID.
3. 阅读规格`gen_ai.data_source.id`把它带到你的第09课时的搜索中.
4. 设置`OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental`检查你的属性不会被收藏人改名.
5. 构建仪表板:仅仅从GenAI属性中"哪些工具错误与哪些模型相关".

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| GenAI SIG | "OpenTelemetry GenAI group" | OTel working group defining the schema |
| invoke_agent | "Agent span" | Name of the span representing an agent run |
| CLIENT span | "Remote call" | Span for a call to a remote agent service |
| INTERNAL span | "In-process" | Span for an in-process agent run |
| gen_ai.provider.name | "Provider" | anthropic / openai / aws.bedrock / google.vertex |
| gen_ai.data_source.id | "RAG source" | Which corpus/store a retrieval hit |
| Content capture | "Prompt logging" | Opt-in capture of messages; store externally in prod |
| Stability opt-in | "Preview mode" | Env var to pin experimental conventions |

## 进一步阅读

- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/)规格
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) 默认的GENAI范围
- [AutoGen v0.4 (Microsoft Research)](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) 内部的OTel跨度
- [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview) W3C 追踪环境传播
