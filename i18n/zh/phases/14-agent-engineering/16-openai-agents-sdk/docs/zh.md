# 开放AI代理 SDK:交付,护卫,追踪

> 开放AI代理SDK是基于响应API的轻量级多代理框架.五个原始:代理,Handoff,守护轨道,会议,追踪.Handoffs是命名的工具.`transfer_to_<agent>`导入或输出时,防护轨道会发生故障.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 06 (Tool Use)
**Time:** ~75 minutes

## 学习目标

- 举个OpenAI代理SDK的五个原始元素.
- 解释交付:为什么它们被模拟为工具,模型看到什么名称形状,以及如何转移文本.
- 区分输入护,输出护和工具护;解释`run_in_parallel`阻塞模式
- 执行一个随时运行的时间,使用手柄 + 护 + 跨度式追踪.

## 问题

无法清洁地委托的代理最终将所有内容都填入一个提示中.没有护的代理运输PII,违反政策输出或永远循环.OpenAI的SDK编码了使多代理工作易于处理的三个原始.

## 概念

### 五个原始

1. **Agent.**士师资格:指令:工具:手工
2. **Handoff.**代表于模型作为一个名为工具`transfer_to_<agent_name>`现在,我们要去.
3. **Guardrail.**验证输入 (仅为第一代理),输出 (仅为最后代理) 或工具调用 (每个函数工具).
4. **Session.**交换时间的自动对话历史.
5. **Tracing.**专业化专业的代人,工具调用,交付,护卫.

### 作为工具的手渡

模型看到`transfer_to_billing_agent`运行时间的信号是:

1. 复制对话背景 (或通过 `nest_handoff_history`其他类型
2. 启动目标代理,并提供指示.
3. 继续与目标代理进行逃跑.

这就是监督模式 (课13/课28),

### 防护

它们有三个味道:

- **Input guardrails.**在任何LLM电话之前,拒绝不安全或不适合的请求.
- **Output guardrails.**检查了最后一个特工的输出,检查了个人信息泄露,违反政策,错误的反应.
- **Tool guardrails.**运行每个函数工具,验证参数,检查权限,审计执行.

模式:

- **Parallel**门线路LLM与主LLM一起运行. 低尾延迟. 如果脚,主LLM的工作会被丢弃 (代币浪费).
- **Blocking**(`run_in_parallel=False`如果,没有代币浪费在主调用.

三线电升级`InputGuardrailTripwireTriggered`现在,`OutputGuardrailTripwireTriggered`现在,我们要去.

### 追踪

默认启动. 每一个LLM代,工具调用,交付,和防护线都发出一个跨度.`OPENAI_AGENTS_DISABLE_TRACING=1`选择退出.`add_trace_processor(processor)`粉丝的范围扩展到你自己的后端,

### 会议

`Session`存储对话历史在后端 (SQLite,Redis,定制). `Runner.run(agent, input, session=session)`汽车装载和附加.

### 在这个模式出现错误的地方

- **Handoff drift.**代理A向B递交,B向A递交.
- **Guardrail bypass.**工具防护只会在功能工具上使用;内置工具 (文件阅读器,网页搜索) 需要单独的政策.
- **Over-tracing.**结与OTel GenAI内容捕获规则 (课3) 存储外部,引用通过ID.

```figure
ae-agent-handoff
```

## 建立它

`code/main.py`在 stdlib 中实现SDK形状:

- `Agent`现在`FunctionTool`现在`Handoff`(作为一个功能工具,具有传输语义).
- `Runner`配备输入/输出/工具防护,送货和跳转计数器.
- 简单的跨度发射器显示痕迹形状.
- 根据用户的查询,交付账单或支持的分类代理;在一个输入时,防护轨道旅行.

运行它:

```
python3 code/main.py
npx tsx code/main.ts
```

痕迹显示了两次成功的转让, 一次输入护旅行,

## 用它

- **OpenAI Agents SDK**对于OpenAI首批产品.
- **Claude Agent SDK**(课 17) 对克劳德第一产品.
- **LangGraph**需要明确的状态和持久的简历.
- **Custom**当你需要精确的控制 (语音,多供应商,联合部署).

## 运送它

`outputs/skill-agents-sdk-scaffold.md`配备一个Agents SDK应用程序,包括分类代理,手持,输入/输出/工具护,会议存储器和追踪处理器.

## 运动

1. 加入一个转发跳计:N转移后拒绝.
2. 实施`nest_handoff_history`在转移之前,将先前的信息分解成一个总结.
3. 写一个阻断输出防护护,比较会使它脚的提示和通过的提示的延迟.
4. 电线`add_trace_processor`它们每次发射的形状是什么?
5. 读取 SDK 文件,将你的玩具移植到`openai-agents-python`你错了什么模型?

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Agent | "LLM + instructions" | Agent type in the SDK; owns tools and handoffs |
| Handoff | "Transfer" | Tool the model calls to delegate to another agent |
| Guardrail | "Policy check" | Validation on input / output / tool invocation |
| Tripwire | "Guardrail trip" | Exception raised when guardrail rejects |
| Session | "History store" | Conversation memory persisted between runs |
| Tracing | "Spans" | Built-in observability over LLM + tool + handoff + guardrail |
| Blocking guardrail | "Sequential check" | Guardrail runs first; no token waste on trip |
| Parallel guardrail | "Concurrent check" | Guardrail runs alongside; lower latency, wastes tokens on trip |

## 进一步阅读

- [OpenAI Agents SDK docs](https://openai.github.io/openai-agents-python/)原始品,手渡,护卫,追踪
- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) 克劳德味的同类
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)什么时候可以向人提供手柄
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/)标准的代理SDK范围为
