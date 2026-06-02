# Reflexion：以语言进行的强化学习（Verbal Reinforcement Learning）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 基于梯度的 RL 要修复一种失败模式，得跑上千次 trial、烧一整个 GPU 集群。Reflexion（Shinn 等人，NeurIPS 2023）改用自然语言来做这件事：每次失败的 trial 之后，agent 写一段反思（reflection），存进 episodic memory（情节式记忆），下一次 trial 在 prompt 里带上这段记忆。Letta 的 sleep-time compute、Claude Code 的 `CLAUDE.md` learnings、pro-workflow 的 learn-rule，背后都是同一个范式。

**Type:** Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 02 (ReWOO)
**Time:** ~60 minutes

## 学习目标（Learning Objectives）

- 说出 Reflexion 的三个组件（Actor、Evaluator、Self-Reflector），以及 episodic memory 的角色。
- 用 stdlib 实现一个 Reflexion 循环，包含二值 evaluator、reflection 缓冲区和重新开局的 re-attempts。
- 针对给定任务，在 scalar、heuristic、self-evaluated 三类反馈源之间做选择。
- 解释为什么 verbal reinforcement 能抓住那些梯度 RL 要跑上千次 trial 才能修好的错误。

## 问题（The Problem）

agent 把任务做砸了。在标准 RL 里，你会再跑上千次 trial、算梯度、更新权重。又贵又慢，而且大多数生产 agent 根本没有为每种失败都准备训练预算的奢侈。

Reflexion（Shinn 等人，arXiv:2303.11366）问了一个不一样的问题：要是 agent 只是想一想自己为什么失败，把这段思考写进 prompt 里再试一次呢？没有权重更新，没有梯度。只是把自然语言在 trial 之间存下来。

结果是：在 ALFWorld 上它打败了 ReAct 以及其他未微调的 baseline。在 HotpotQA 上它优于 ReAct。在代码生成（HumanEval / MBPP）上它一度刷到了 SOTA。全程没有走过一步梯度。

## 概念（The Concept）

### 三个组件（The three components）

```
Actor         : generates a trajectory (ReAct-style loop)
Evaluator     : scores the trajectory — binary, heuristic, or self-eval
Self-Reflector: writes a natural-language reflection on the failure
```

外加一个数据结构：

```
Episodic memory: list of prior reflections, prepended to the next trial's prompt
```

一次 trial 跑 Actor，Evaluator 给它打分。如果分数低，Self-Reflector 写一段反思（"我选错了工具，因为我把问题误读成在问 X，其实是在问 Y"）。这段反思进入 episodic memory。下一次 trial 重新开局，但能看到上一次的反思。

### 三类 evaluator（Three evaluator types）

1. **Scalar** —— 外部的二值信号。ALFWorld 要么成功要么失败。HumanEval 的测试要么过要么不过。最简单，信号最强。
2. **Heuristic** —— 预定义的失败签名。"如果 agent 连续两次产出相同 action，就标记为卡住。""如果轨迹超过 50 步，标记为低效。"
3. **Self-evaluated** —— 由 LLM 给自己的轨迹打分。在没有 ground truth 时不得不用。信号偏弱；和工具落地的验证（第 05 课 —— CRITIC）配合起来效果更好。

2026 年的默认配方是混着用：能拿到 scalar 就用 scalar，没有就用 self-eval，再用 heuristics 当安全栏。

### 为什么这套范式能泛化（Why this generalizes）

Reflexion 与其说是一种新算法，不如说是一种被命名的范式。几乎所有生产里的"自愈"agent 都在跑它的某种变体：

- Letta 的 sleep-time compute（第 08 课）：另起一个 agent 反思过往对话，写入 memory blocks。
- Claude Code 的 `CLAUDE.md` / "save memory" 范式：把反思捕捉为 learnings，预置到未来 session。
- pro-workflow 的 `/learn-rule` 命令：把更正捕捉为显式规则。
- LangGraph 的 reflection 节点：一个节点给输出打分，必要时路由到 refine 流程。

它们都源自同一个洞察：自然语言这个媒介足够丰富，可以承载"我从失败里学到了什么"，并在多次运行之间传递。

### 什么时候管用，什么时候不管用（When it works and when it does not）

Reflexion 管用的场景：

- 有清晰的失败信号（测试失败、工具报错、答案错误）。
- 任务类别可重现（同类问题可以再问一次）。
- 反思在轨迹里还有改进空间（action 预算够）。

Reflexion 帮不上忙的场景：

- agent 第一次就成功了。
- 失败是外部因素（网断了、工具坏了）—— 反思"网当时断了"对未来运行没用。
- 反思变成了迷信 —— 给一次抽风的 flaky 运行编造叙事并存下来。

2026 年的坑：memory rot（记忆腐败）。反思越攒越多；有些过时、有些根本是错的；episodic 缓冲区一胀，重跑就越来越慢。缓解办法：周期性 compaction（压缩，第 06 课）、给反思设 TTL，或者另起一个 sleep-time 清理 agent（Letta）。

## 动手实现（Build It）

`code/main.py` 在一个玩具谜题上实现 Reflexion：产出一个三元素列表，使其和等于目标值。Actor 给出候选列表；Evaluator 检查总和；Self-Reflector 写一行说明哪儿出了问题。这条反思进入 episodic memory，留给下一次 trial。

组件：

- `Actor` —— 一个脚本化的策略，看到反思后会变好。
- `Evaluator.binary()` —— 对目标和做 pass / fail 判断。
- `SelfReflector` —— 给失败生成一行诊断。
- `EpisodicMemory` —— 一个带 TTL 语义的有界列表。

跑起来：

```
python3 code/main.py
```

trace 会显示三次 trial。第 1 次失败，存下一段反思；第 2 次能看到反思，有所改进但仍然失败；第 3 次成功。和 baseline（不带反思）比较 —— baseline 卡死在第 1 次的答案上。

## 用起来（Use It）

LangGraph 把 reflection 作为一种节点范式自带。Claude Code 的 `/memory` 命令和 pro-workflow 的 `/learn-rule` 把 episodic 缓冲区外化为一个 markdown 文件。Letta 的 sleep-time compute 在闲时运行 Self-Reflector，让主 agent 始终被延迟约束（latency-bound）。OpenAI Agents SDK 没有直接内置 Reflexion；你得自己用一个按分数拒绝轨迹的自定义 Guardrail（护栏），加上能跨运行存活的 memory `Session` 来搭。

## 上线部署（Ship It）

`outputs/skill-reflexion-buffer.md` 负责创建并维护一个 episodic 缓冲区，包含 reflection 捕获、TTL 和去重。给定任务类别和一次失败，它产出的反思要真能帮到下一次 trial（而不是泛泛的"下次小心点"）。

## 练习（Exercises）

1. 把二值 evaluator 换成返回距离指标（离目标多远）的 scalar evaluator。收敛会更快吗？
2. 给反思加一个 10 次 trial 的 TTL。过了那一点之后，更老的反思是有害还是有帮助？
3. 实现 heuristic evaluator：如果同一个 action 重复出现就把这次 trial 标记为卡住。它和 Self-Reflector 怎么互动？
4. 跑一遍带 adversarial Actor 的 Reflexion，这个 Actor 故意忽略反思。要让 Actor 注意到反思，最少需要做哪些 prompt 工程？
5. 读 Reflexion 论文 ALfWorld 那一节（Section 4）。在概念层复现那个 130% 的成功率提升：相对原版 ReAct，关键差量是什么？

## 关键术语（Key Terms）

| 术语 | 一般人怎么说 | 真正的含义 |
|------|----------------|------------------------|
| Reflexion | "自我纠错" | Shinn 等人 2023 —— Actor、Evaluator、Self-Reflector 加上 episodic memory |
| Verbal reinforcement | "不用梯度的学习" | 把自然语言反思预置到下一次 trial 的 prompt |
| Episodic memory | "按任务的反思" | 同一类任务的有界反思缓冲区 |
| Scalar evaluator | "二值成功信号" | 来自 ground truth 的 pass / fail 或数值分数 |
| Heuristic evaluator | "基于模式的检测器" | 预定义的失败签名（如 stuck-loop、步数过多） |
| Self-evaluator | "LLM 当自己 trace 的法官" | 没有 ground truth 时的弱信号 fallback —— 与工具落地验证配合 |
| Memory rot | "陈旧反思" | episodic 缓冲区被过时条目塞满；用 compaction / TTL 修 |
| Sleep-time reflection | "异步自我反思" | 把 Self-Reflector 跑在热路径之外，让主 agent 保持快 |

## 延伸阅读（Further Reading）

- [Shinn et al., Reflexion: Language Agents with Verbal Reinforcement Learning (arXiv:2303.11366)](https://arxiv.org/abs/2303.11366) —— 原始论文
- [Letta, Sleep-time Compute](https://www.letta.com/blog/sleep-time-compute) —— 生产中的异步反思
- [Anthropic, Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) —— 把 episodic 缓冲区作为 context 的一部分来管
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) —— reflection 节点范式
