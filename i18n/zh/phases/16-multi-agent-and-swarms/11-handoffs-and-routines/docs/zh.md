# 无国籍乐团

> 开通AI的Swarm (2024年10月) 将多代理管弦乐器成两个原始:**routines**(指令+工具作为系统提示) 和 **handoffs**(一个工具可以返回另一个代理人). 没有国家机器,没有分支的DSL 通过调用正确的交付工具来LLM路线. 产品后代是OpenAI代理SDK (2025年3月). 群本身仍然是最清洁的概念参考其整个来源适合几百条线. 模式是病毒的,因为API表面大致是"代理 =提示 +工具;交付 =函数返回代理".限制:无状态,因此内存是调用者的问题.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 04 (Primitive Model)
**Time:** ~60 minutes

## 问题

每个多代理框架都希望你学习其DSL: 兰格拉夫节点和边缘,CrewAI团队和任务,AutoGen GroupChat和管理者.

群众推向相反的方向:使用模型已经拥有的工具调用功能.交付成为工具调用.调音器是目前进行对话的任何代理.状态机器隐含于代理系统的提示.

## 概念

### 两个原始人

**Routine.**系统提示,定义代理人的角色和可用的工具. 想象它像一个有范围的指令集:"你是一个分类代理;如果用户询问退款,请交给退款代理.

**Handoff.**群运行时间检测到代理返回值,并将活跃代理转换为下一个轮.

这就是整个抽象.

```
def transfer_to_refunds():
    return refund_agent  # Swarm sees Agent return → switch active agent

triage_agent = Agent(
    name="triage",
    instructions="Route the user to the right specialist.",
    functions=[transfer_to_refunds, transfer_to_sales, transfer_to_support],
)
```

根据用户的信息,分类代理的系统提示使其选择正确的交付.

### 为什么它是病毒的

- **Small API.**需要学习的两个概念.
- **Uses what the model already does.**工具调用已经在供应商中达到生产级.
- **No state-machine burden.**你不描述图表; 代理人的提示描述他们交给谁.

### 无国籍贸易

运行期间,该框架保留了消息历史,但它没有保留任何东西.内存,连续性,长时间运行任务所有电话调用者的问题.

在生产中 (OpenAI Agents SDK,2025年3月) 这是一个主要的变化:SDK添加了内置的会议管理,防护窗和追踪,同时保持了原始的交付.

### /合时

- **Triage patterns.**前线代理将用户送到专家那里.
- **Skill-based handoffs.**"如果任务需要代码,请打电话给编码师;如果需要研究,请打电话给研究人员".
- **Short, bounded conversations.**客户支持,常见问题,简单的工作流程.

### 当群众扎时

- **Long sessions with shared memory.**交换将对话状态重置为新代理的提示加上历史.
- **Parallel execution.**交换是一次性  活动代理交换.平行需要调用者调用多个Swarm运行.
- **Audit and replay.**无国籍的运行很难完全重复;LLM的交付选择不是确定性的.

### 开放AI代理 SDK (2025年3月)

生产继任者补充说:

- **Session state.**连续的线程.
- **Guardrails.**输入/输出验证.
- **Tracing.**任何工具的通话和交付都记录下来.
- **Handoff filters.**控制在传递中转移的背景.

交付原始品存活下来; 生产 ergonomics 加入了它.

### 群众与群众聊天

两者都使用了LLM驱动的路由,但它们在**who picks next**其他:

- 集团聊天:选手 (函数或LLM) 从外部选择下一个扬声器.
- 现在的代理人通过传递工具来选择继任者.

群众是"代理决定下一步";群众聊天是"管理者决定下一步".群众的决定生活在活跃的代理工具调用;群众聊天生活在 `GroupChatManager`现在,我们要去.

```figure
sw-handoff-routing
```

## 建立它

`code/main.py`实现从零开始的Swarm:一个代理数据类,一个转移机制 (工具返回代理),以及一个检测代理开关的运行循环.

演示:一个分类代理向退款,销售或支持专家提供路线.每个专家都有自己的工具.运行循环打印每一个交付.

运行:

```
python3 code/main.py
npx tsx code/main.ts
```

## 用它

`outputs/skill-handoff-designer.md`设计一个给定任务的交付拓:哪些代理存在,哪些交付可以调用,哪些背景转移.

## 运送它

检查列表:

- **Handoff logging.**每次交付都会记录一个事件,从代理到代理,
- **Context transfer rules.**决定什么是转发:完整的历史 (昂贵),最后的N消息,或总结.
- **Guardrail on handoff.**必须验证向不同工具权限的专家交付的信息 否则即时注射可能会导致不必要的交付.
- **Loop detection.**两位代理交往往往是常见的失败; 通过简单的最后K环检查检测.
- **Fallback agent.**如果没有转移目标, 返回安全默认状态.

## 运动

1. 跑步`code/main.py`确认第二轮的活跃代理是退款的.
2. 添加一个循环检测规则:如果同样的两个代理连续3次交出,强迫出口.
3. 阅读OpenAI Agents SDK文件. 执行"总结在总结"版本:前入代理接管之前,退出代理将文本压缩到一个子弹总结.
4. 如何将Swarm传递与GroupeChatManager选项进行比较.
5. 阅读Swarm的厨师书 (https://developers.openai.com/cookbook/examples/orchestrating_agents确定一个明确的设计决定,Swarm将OpenAI Agents SDK更改或保留.

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Routine | "The agent prompt" | System prompt + tool list. Defines role and available handoffs. |
| Handoff | "Transfer to another agent" | A tool the active agent can call that returns a new Agent. The runtime switches active agent. |
| Stateless | "No memory between runs" | Swarm does not persist anything; memory is the caller's responsibility. |
| Active agent | "Who's speaking now" | The agent currently holding the conversation. Handoff changes this. |
| Context transfer | "What moves on handoff" | Policy for what history the incoming agent sees: full, last N, or summarized. |
| Handoff loop | "Agents ping-pong" | Failure mode where two agents keep handing back to each other. |
| OpenAI Agents SDK | "Production Swarm" | March 2025 successor; adds sessions, guardrails, tracing on top of the handoff primitive. |
| Handoff filter | "Gate on transfer" | SDK feature to inspect and modify context at the handoff boundary. |

## 进一步阅读

- [OpenAI cookbook — Orchestrating Agents: Routines and Handoffs](https://developers.openai.com/cookbook/examples/orchestrating_agents)参考文献
- [OpenAI Swarm repo](https://github.com/openai/swarm)原始实施,作为概念参考
- [OpenAI Agents SDK docs](https://openai.github.io/openai-agents-python/)生产继任者,会议和追踪
- [Anthropic handoff-in-Claude notes](https://docs.anthropic.com/en/docs/claude-code)如何使用类似交付模式的Cloed Code子代码`Task`
