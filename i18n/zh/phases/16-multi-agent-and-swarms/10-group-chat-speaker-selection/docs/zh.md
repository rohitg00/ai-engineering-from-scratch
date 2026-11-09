# 集团聊天和演讲者选择

> 交谈配套将N代理放在一个对话中;选项函数 (LLM,圆或定制) 选择下一个说话者. 这就是新兴多代理对话的原型. 代理人不知道他们在静态图表中的作用,他们只是对共享池进行反应. 根据AutoGen v0.2的GroupeChat语义在AG2叉子中保存下来;AutoGen v0.4将其重写为以事件为导向的演员模型. 微软于2026年2月将AutoGen放入维护模式,并将其与语义内核合并到微软代理框架中 (RC 2026年2月). 群众聊天原始的存活在AG2和微软代理框架中 学会一次,在任何地方使用它.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 04 (Primitive Model)
**Time:** ~60 minutes

## 问题

静态图表 (长图) 当工作流程已知时很好.真正的对话不是静态:有时编码器会问评论员,有时研究员,有时作家.硬码每次可能交给产生边缘爆炸.你想要*代理对共享池进行反应*,有功能决定谁接下来说话.

这就是AutoGen集团聊天所做的.

## 概念

### 形状

```
              ┌─── shared pool ────┐
              │   m1  m2  m3  ...  │
              └─────────┬──────────┘
                        │ (everyone reads all)
      ┌───────┬─────────┼─────────┬───────┐
      ▼       ▼         ▼         ▼       ▼
    Agent A  Agent B  Agent C  Agent D  Selector
                                           │
                                           ▼
                                  "next speaker = C"
```

每个代理都会看到每一个消息,每一个转折都会调用一个选号函数来选择接下来说谁.

### 选用三种口味

**Round-robin.**定制周期. 确定性. 标量线性在N,但忽略文本一个编码器即使是法律审查的主题得到了轮回.

**LLM-selected.**电话给一个LLM,读取最近的库,并返回最好的下一个演讲者. 意识到环境,但慢:每轮都增加一个LLM电话.

**Custom.**典型:LLM选择后退规则 (例如",总是给验证器后代码器").

### 可交谈的代理API

```
agent = ConversableAgent(
    name="coder",
    system_message="You write Python.",
    llm_config={...},
)
chat = GroupChat(agents=[coder, reviewer, tester], messages=[])
manager = GroupChatManager(groupchat=chat, llm_config={...})
```

`GroupChatManager`经理打电话给选手,然后再送下一个选手. 循环持续到终止条件.

### 终止

现在,我们有三种常见模式:

- **Max rounds.**完全转的硬帽子.
- **"TERMINATE" token.**代理人可以发出哨兵信息; 经理在出现时停止.
- **Goal-reached check.**通过轻量级验证器,每次转换都会进行,

### 血统:叉子和合并

在2025年初,微软开始围绕事件驱动的演员模型重写AutoGen (v0.4).社区将AutoGen v0.2的GroupeChat语义作为AG2,保留了早期采用者集成的API.

2026年2月,微软宣布,AutoGen将进入维护模式,以事件驱动的演员模式合并到**Microsoft Agent Framework**集团Chat概念在两条轨道中存活下来;实现细节不同. AG2是v0.2兼容代码的首选上游.

### 当集团聊天适合时

- **Emergent conversations.**你不想预先连接每一个可能的下一个扬声器.
- **Role-mixing tasks.**编码器问研究员,研究员问档案员,档案员问编码器回来.流量不是DAG.
- **Exploratory problem-solving.**想"大脑风暴会议",而不是"集线".

### 当它失败时

- **Strict determinism.**选择法师可能不一致,相同的提示,不同的运行,不同的下一个扬声器.
- **Sycophancy cascades.**警方将会对那些最自信的说话做出回应.
- **Context bloat.**每个代理都会读取每一个信息; 10 轮后,文本是巨大的.
- **Hot speakers.**选择者喜欢他的专业,所以一个代理主导对话.

### 集团聊天与监督者

它们是原始的,不同默认的:

- 监督者:一个代理计划,其他人执行. 选手是"问计划者要做什么".
- 集团聊天:所有代理人都是同行;选择器是共享池的函数.

两个都使用了04课程的四个原始方法. 群体聊天默认到LLM选择的管弦乐和全池共享状态.

```figure
swarm-speaker
```

## 建立它

`code/main.py`执行一个从头开始的集团聊天. 三个代理 (编码器,审查员,经理),轮和LLM选择的变体,并终止一个`TERMINATE`标志.

演示程序将打印对话转录以及选手的决定记录.

运行:

```
python3 code/main.py
npx tsx code/main.ts
```

## 用它

`outputs/skill-groupchat-selector.md`配置一个 GroupChat 选项选项为给定的任务 圆比LLLM-选择对定制,以及选项选项输入 (最近的消息,代理专业,转数) 进行使用.

## 运送它

检查列表:

- **Max rounds cap.**常常. 10-20个用于典型的任务.
- **Speaker-balance metric.**轨道转向每位代理;当失衡超过门时,应警报.
- **Termination token.** `TERMINATE`或是专门的验证代理.
- **Projection or scoped memory.**在10个消息之后,考虑给每个代理只提供一个范围的视图,以防止文本膨胀.
- **Selector logging.**对于选择的LLM变体,记录选项输入和选择.否则无法调试.

## 运动

1. 跑步`code/main.py`根据"轮"和"士"的选择,哪个代理主导?
2. 在选择器中添加"每代理最高说话"规则.
3. 执行目标终止:当审查员回来时停止.
4. 在 GroupChat 上阅读AutoGen稳定文件 (https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/design-patterns/group-chat.html确定使用的默认选择器`GroupChatManager`现在,我们要去.
5. 阅读AG2备忘录 (https://github.com/ag2ai/ag2根据v0.4的具体特性 (吞吐量,故障耐受性,可编译性)

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| GroupChat | "Agents in one chat room" | Shared message pool + selector function. AutoGen / AG2 primitive. |
| Speaker selection | "Who talks next" | The function that picks the next agent. Round-robin, LLM-selected, or custom. |
| GroupChatManager | "The meeting host" | AutoGen component that owns the selector and loops over turns. |
| ConversableAgent | "The base agent" | AutoGen base class; an agent that can send and receive messages. |
| Termination token | "The 'stop' word" | Sentinel string (usually `TERMINATE`) that ends the chat. |
| Hot speaker | "One agent dominates" | Failure mode where the selector keeps picking the same agent. |
| Context bloat | "Pool grows unbounded" | Each agent reads every prior message; context grows with turns. |
| Projection | "Scoped view" | Role-specific view into the shared pool to prevent context bloat. |

## 进一步阅读

- [AutoGen group chat docs](https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/design-patterns/group-chat.html)参考实施
- [AG2 repo](https://github.com/ag2ai/ag2)社区AutoGen v0.2延续
- [Microsoft Agent Framework docs](https://learn.microsoft.com/en-us/agent-framework/)合并后继者,RC 2026年2月
- [AutoGen v0.4 release notes](https://microsoft.github.io/autogen/stable/)事件驱动演员模型重写详情
