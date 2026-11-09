# 记忆阻碍和睡眠时间计算

> 模特可以直接编辑的功能性记忆区块,以及一个睡眠时间代理,在主要代理在置时,将记忆稳定成一致.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 07 (MemGPT)
**Time:** ~75 minutes

## 学习目标

- 列塔使用的三个内存层次 (核心,回忆,存档) 和每个层次的作用.
- 解释内存区块模式:人区块,人区块和用户定义的区块作为一级打字对象.
- 描述睡眠时间计算是什么,为什么它不处于关键路径,为什么它可以运行比主要代理更强的模型.
- 执行一个脚本式的两代理循环,其中一个主要代理提供响应,而一个睡眠时间代理在轮流之间巩固区块.

## 问题

解决了虚拟内存控制流程.

1. **Latency.**如果代理人必须在用户等待时剪切,总结或调整,
2. **Memory rot.**书籍积累,矛盾的事实仍然存在,检索却沉浸在陈旧的内容中.
3. **Structure loss.**一个平坦的档案存储器不能表达"人块总是在提示中;人块总是在提示中;任务块每次交换".

雷塔 (letta.com) 是原始MemGPT项目在2024年通过的平台名称. 纸质的模式保持了MemGPT名称. 2026年雷塔 V1重写是一个后来的,独立的步骤. 记忆区块使结构明确;睡眠时间计算将整合转移到关键路径.

## 概念

### 三个层

| Tier | Scope | Where it lives | Written by |
|------|-------|----------------|------------|
| Core | Always visible | Inside the main prompt | Agent tool call + sleep-time rewrites |
| Recall | Conversation history | Retrievable | Automatic turn logging |
| Archival | Arbitrary facts | Vector + KV + graph | Agent tool call + sleep-time ingest |

核心是MemGPT的核心. 记住是对话缓冲器,它被驱逐出后尾. 档案是外部商店. 分裂清除了MemGPT的两层过载.

### 记忆区块

一块是核心层面的打字,持久,可编辑的部分.原始的MemGPT论文定义了两个:

- **Human block**用户的事实 (姓名,角色,偏好,目标).
- **Persona block**代理人的自我概念 (身份,语调,限制).

列塔将其一般化为任意用户定义的区块:`Task`现在的目标是`Project`对于代码基础事实的区块,`Safety`对于硬约束,每个块都有一个`id`现在`label`现在`value`现在`limit`(字符封顶),`description`(所以模型知道何时编辑它).

通过工具表面可编辑块:

- `block_append(label, text)`
- `block_replace(label, old, new)`
- `block_read(label)`
- `block_summarize(label)`凝结一个接近其极限的块.

### 睡眠时间计算

拉特塔的2025年补充:在背景下运行第二个代理,离开关键路径.`learned_context`文件的存储记录,并将其整合或无效.

产品出炉:

- **No latency cost.**基本响应不会等待记忆操作.
- **Stronger model allowed.**睡眠时间代理可能更昂贵,更慢的模型,因为它没有延迟限制.
- **Natural consolidation window.**假定,总结,无效,当用户不等待时.

形状与人类的工作方式相匹配:你完成任务,你睡觉,长期记忆一夜之间就会稳定.

### 基于本地的推理

雷塔 V1 (`letta_v1_agent`美国国家`send_message`心跳和直线`Thought:`答案API (OpenAI) 和信息API (有扩展思维) 在单独的道上发射推理,通过轮流 (在生产中加密的供应商).控制循环仍然是ReAct.思维痕迹是结构性的,不是提示的.

### 在这个模式出现错误的地方

- **Block bloat.**无限`block_append`在写到字幕之前,请在字幕上按一下一个区块总结器.
- **Silent drift.**睡眠时代代理重写一个区块,而主要代理永远不会注意到.
- **Poisoned consolidation.**睡眠时间代理将攻击者可以进入的内容处理到核心.

```figure
memory-blocks
```

## 建立它

`code/main.py`执行:

- `Block` id,标签,值,限制,描述.
- `BlockStore`   `near_limit(label)`帮助人.
- 两名经纪人`PrimaryAgent`子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子`SleepTimeAgent`转折之间结合.
- 显示了与区块的三轮对话,加上一个睡眠时间的传递,

运行它:

```
python3 code/main.py
npx tsx code/main.ts
```

转录显示了分开:主要转折速度快,产生原始写作;睡眠通道紧,清洁.

## 用它

- **Letta**对于参考实现, (letta.com) 提供自主托管或管理云.
- **Claude Agent SDK skills**作为一个块形知识 一个技能是代理按要求加载的命名,版本,可检索的指令块.
- **Custom builds**对于想要控制存储后端的团队,使用Letta API合同,以便您稍后迁移.

## 运送它

`outputs/skill-memory-blocks.md`产生Letta形状的块系统,用于任何运行时间,包括安全规则和引用线.

## 运动

1. 添加一个`block_summarize`工具,以模型生成的总结取代区块值,`near_limit`什么触发门可以减少总结调用和区块过度?
2. 实现睡眠时间的减值在档案中:两个文本具有90%以上的标志性重叠的记录,将其崩成一个.
3. 在每一个写记录上,旧值和差异.`block_history(label)`操作员可以调试"为什么代理忘记X".
4. 让睡眠时间代理人看作是不值得信赖的作家.
5. 移植该例子使用Letta API (`letta_v1_agent`区块方案发生了什么变化,原生推理如何改变痕迹形状?

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Memory block | "Editable prompt section" | Typed, persistent, LLM-editable segment of core memory |
| Human block | "User memory" | Facts about the user, pinned in core |
| Persona block | "Agent identity" | Self-concept, tone, constraints, pinned in core |
| Sleep-time compute | "Async memory work" | Second agent doing consolidation off the critical path |
| Core / Recall / Archival | "Tiers" | Three-layer memory split: always-visible / conversation / external |
| Block limit | "Cap" | Character limit per block; forces summarization |
| Native reasoning | "Thinking channel" | Provider-level reasoning output, not prompt-level `Thought:` |
| Learned context | "Sleep output" | Facts the sleep-time agent writes into shared blocks |

## 进一步阅读

- [Letta, Memory Blocks blog](https://www.letta.com/blog/memory-blocks) 块图案
- [Letta, Sleep-time Compute blog](https://www.letta.com/blog/sleep-time-compute)同步整合
- [Letta, Rearchitecting the Agent Loop](https://www.letta.com/blog/letta-v1-agent)原生推理重写
- [Packer et al., MemGPT (arXiv:2310.08560)](https://arxiv.org/abs/2310.08560)来源
