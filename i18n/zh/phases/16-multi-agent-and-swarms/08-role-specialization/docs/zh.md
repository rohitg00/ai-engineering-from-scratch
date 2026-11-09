# 角色专业化 规划者,批评者,执行者,验证者

> 2026年最常见的多代理分解:一个代理计划,一个执行,一个批评或验证.MetaGPT (arXiv:2308.00352) 将此形式化为编码到角色提示中的SOP 产品经理,建筑师,项目经理,工程师,QA工程师 以下`Code = SOP(Team)`现在,我们要去. 聊天Dev (arXiv:2307.07924) 通过"聊天链"连接设计师,程序员,评论员,测试员,并通过"沟通性幻觉" (代理人明确要求缺失的细节). 验证器承载量:Cemri等人 任何多代理失败都可能被追溯到失踪或故障的验证. 普华永道公司报告了CrewAI结构化验证循环的7倍准确度增长 (10% → 70%)

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 04 (Primitive Model), Phase 16 · 05 (Supervisor)
**Time:** ~60 minutes

## 问题

总体多代理系统产生总体输出.在一个群体聊天中,三个编码器写出三种相同的中等代码.你可以添加更多的代理,添加更多的轮子,但仍然不能过高质量门.

修复不是更多的代理它是*不同的*代理.分配不同的角色.给批判工具规划者没有.给验证器一个客观的测试套件.现在系统有内部的不一致的基础纠正,而不是只是平行猜测.

## 概念

### 道的四个角色

**Planner.**读取目标,生成步骤列表或规范工具:知识检索,文件.输出:结构性计划.

**Executor.**读取一个计划一步,生成文物. 工具:实际工作工具 (代码编译器,,API客户端). 输出:文物.

**Critic.**工具:只读取文物访问,静态分析. 输出:接受/拒绝理由.

**Verifier.**读取文物并执行确定性检查. 工具:测试运行器,类型检查器,方案验证器. 输出:通过/失败证据.

批评者是主观的,有意见的,通常基于LLM.验证者是客观的,确定性的,通常基于代码.

### 基因测量系统的SOP模式

编码软件工程SOP作为角色提示:

- **Product Manager**据公众党所说.
- **Architect**制造系统设计.
- **Project Manager**分开任务.
- **Engineer**工具.
- **QA Engineer**进行测试.

每个角色都有一个严格的输入/输出方案. 角色提示说明角色是什么,它必须产生什么.`Code = SOP(Team)`确定性SOP将 LLM团队变成一个可预测的管道.

### 聊天Dev的沟通性幻觉

聊天Dev补充了一个关键的举动:当执行者需要一个不包含在计划中的具体细节时,它明确要求设计师继续前. 这可以防止经典的LLM失败.

执行:角色提示包括"当你需要没有给出的特定信息时,在输出之前,请按相关角色的名字询问".

### 为什么验证器最重要

塞姆里等人 (MAST) 追踪了1642个多代理执行失败. 21.3%是验证漏洞.系统发送了一个没有人检查的答案.剩余的79%通常追溯到"有一个检查然失败或从未运行过".验证是承载作用.

普华永道公司 (CrewAI部署, 2025) 报告称,增加结构化验证循环的精度从10%提高到70%.

### 批评者与验证者

- 评论家是一个修士,检查一个文物质量. 主观.可以被可靠的散文欺骗.
- 验证器是一个在文物上运行的确定性程序. 目标. 通过/失败证据.

检查器捕获了批评者无法看到的错误,因为它们只出现在运行时间.

### 抗模式

您的系统中的每一个角色都是LLM,每个角色的输出都是"看起来很好. "经典的MAST失败模式. 添加至少一个验证器,其通过/失败是由代码决定的,而不是LLM.

### 框架映射

- **CrewAI** `Agent(role, goal, backstory)`课本专业化表面.
- **LangGraph**节点可以具有专业提示;边缘强制管道.
- **AutoGen**                                                                                                                                                                                                                                                              
- **OpenAI Agents SDK** 专业角色代理人之间的交换工具.

```figure
swarm-roles
```

## 建立它

`code/main.py`实现一个构建简单的Python函数的4个角色管道:

- **Planner**产生的标本.
- **Executor**生成一个代码字符串.
- **Critic**显而易见的问题.
- **Verifier**在沙盒中运行生成代码 (`exec`) 针对一个试验案例.

演示运行两次:一次执行器生成正确代码 (批评器+验证器都通过),一次执行器生成非规范代码 (批评器错过了错误,因为它看起来可行的,验证器抓住了因为测试失败).

运行:

```
python3 code/main.py
npx tsx code/main.ts
```

## 用它

`outputs/skill-role-designer.md`通过使用该方法,可以完成一个任务,并生成角色清单 (3-5 个角色),每个角色的输入/输出方案和验证器检查.

## 运送它

检查列表:

- **At least one deterministic verifier.**没有什么.
- **Explicit I/O schema per role.**规划者返回一个规格,而不是散文;执行者读取该方案.
- **Communicative dehallucination.**执行者必须问计划者,什么时候没有信息;
- **Critic/verifier ordering.**首先运行评论 (便宜,发现设计问题),第二次验证 (慢,发现错误).
- **Loop budget.**在升级到人类之前, Max 2 批评-执行者修改轮子.

## 运动

1. 跑步`code/main.py`检查器如何捕获评论家错过的错误. 添加静态分析检查 (数次发生的事件)`return`运行时间测试错过了什么?
2. 加入第五个角色:"要求分析师",将用户的愿望转化为准备计划的规范.
3. 阅读MetaGPT第3节 ("代理").列出MetaGPT的每一个5个角色的输入/输出方案.
4. 查看ChatDev的聊天链图 (arXiv:2307.07924图3). 确定沟通性幻觉在哪里打破一个循环,否则会是无限的.
5. 假设三个任务,添加验证器不会帮助,而确定性检查是不可能或过于昂贵的.

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Role specialization | "Different agents, different jobs" | Distinct system prompts tuned for planner/executor/critic/verifier roles. |
| SOP pattern | "Encoded standard operating procedure" | MetaGPT's framing: strict I/O schemas per role turn a team into a pipeline. |
| Communicative dehallucination | "Ask before inventing" | ChatDev pattern: executor asks planner when a detail is missing rather than making one up. |
| Critic | "LLM reviewer" | Subjective, opinionated reviewer. Catches taste issues. Can be fooled by plausible prose. |
| Verifier | "Deterministic check" | Code-based pass/fail. Test runner, type checker, schema validator. Cannot be fooled. |
| Verification gap | "No one checked" | 21.3% of MAST failures. Answer shipped without a check that would have caught the bug. |
| Revision loop | "Critic sends it back" | Critic rejection triggers executor re-run with feedback. Needs a budget. |
| All-LLM anti-pattern | "Looks good to me" | Every role is an LLM, no deterministic check. Classic MAST failure. |

## 进一步阅读

- [Hong et al. — MetaGPT: Meta Programming for Multi-Agent Collaboration](https://arxiv.org/abs/2308.00352) 作为角色的SOP即时参考文件
- [Qian et al. — Communicative Agents for Software Development (ChatDev)](https://arxiv.org/abs/2307.07924)聊天链 + 沟通性幻觉
- [Cemri et al. — Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/abs/2503.13657) MAST分类; 验证缺陷占失误的21.3%
- [CrewAI docs — Agent roles](https://docs.crewai.com/en/introduction)生产角色规范表面
