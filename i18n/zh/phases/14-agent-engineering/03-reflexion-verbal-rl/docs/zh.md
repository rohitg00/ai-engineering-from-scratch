# 思考:口头增强学习

> 基于基梯的RL需要数千次试验和GPU集群来修复故障模式. 反思 (Shinn et al., NeurIPS 2023) 用自然语言进行:每次失败试验后,代理人写出反思,存储在情节记忆中,并将下一次试验定制在那个记忆上. 这就是莱塔的睡眠时间计算,克劳德·科德的CLAUDE.md学习和工作流动的学习规则背后的模式.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 02 (ReWOO)
**Time:** ~60 minutes

## 学习目标

- 描述反思的三个组成部分 (演员,评估者,自我反射者) 和情节记忆的作用.
- 执行一个与二进制评估器,反射缓冲器,和新的重试的 stdlib 反射循环.
- 选择一个特定任务的尺度,论和自我评估反来源.
- 解释为什么口头强化会发现基于梯度的RL需要数千次试验来修复的错误.

## 问题

经纪人失败任务. 在标准RL中,你会运行数千个更多的试验,计算梯度,更新权重.昂贵,缓慢,大多数生产经纪人没有每次失败的训练预算.

思考 (Shinn et al., arXiv:2303.11366) 提出了一个不同的问题:如果代理人只是想知道为什么它失败了,然后再试试一次?没有重量更新.没有梯度.

结果:在ALFWorld上,它超过了ReAct和其他非精细调节的基线.在HotpotQA上,它在ReAct上改进.在代码生成 (HumanEval/MBPP) 上,它设置了当时的最先进状态.所有这些都没有单个梯度步骤.

## 概念

### 三个组成部分

```
Actor         : generates a trajectory (ReAct-style loop)
Evaluator     : scores the trajectory — binary, heuristic, or self-eval
Self-Reflector: writes a natural-language reflection on the failure
```

另外一个数据结构:

```
Episodic memory: list of prior reflections, prepended to the next trial's prompt
```

一次试验是演员.评价者评分.如果得分低,自反射器产生反射 ("我选择错误的工具,因为我读错了问题,因为问X,问Y").反射进入剧情记忆.下一次试验开始新鲜,但看到反射.

### 三种评估者类型

1. **Scalar**外部二进制信号.ALFWorld成功或失败.HumanEval测试通过或失败.最简单,最高信号.
2. **Heuristic**预定义失败签名. "如果代理在连续两次执行相同的操作,标记为被困. " "如果轨迹超过50步,标记为不有效. "
3. **Self-evaluated**法学士的轨迹是自有的. 需要在没有基础真理时. 信号较弱;与工具基础验证 (课05  关键) 很好.

默认的2026是混合的:可用时的尺度,不用时的自行,

### 为什么这将普遍化

反思不是一个新的算法,而是一个命名的模式.几乎每个生产"自我治疗"代理运行某种变体:

- 雷塔的睡眠时间计算 (课程 08):一个独立的代理反思过去的对话,并写入记忆区块.
- 克劳德·科德的`CLAUDE.md`记忆存储模式:作为学习的反射,预备未来的会议.
- 支持工作流程`/learn-rule`命令:作为明确的规则所捕获的修正.
- 兰格拉夫的反射节点:一个节点,以分出口和路线进行调整,如果需要.

所有这些都源于同一个见解:自然语言是足够丰富的媒介,

### 什么时候有效,什么时候不有效

反思作用在:

- 存在明显的故障信号 (测试故障,工具错误,错误答案).
- 任务类可复制 (可以再次提出相同类型的问题).
- 反映了这一趋势的改善 (足够的行动预算).

如果:

- 经纪人已经在第一次尝试中成功了.
- "网络故障"的反思不会帮助未来运行.
- 反映变成了迷信, 保存了关于一次性滑的故事.

2026 陷:记忆腐烂.反射积累;有些是过时或错误的;随着事件缓冲器的增长,重启变得慢.减轻:周期性紧缩 (课06),反射的TTL,或单独的睡眠时间清洁剂 (Letta).

```figure
react-trace
```

## 建立它

`code/main.py`演员发出候选人名单;评价者检查了数量;自我反射者写了一行关于错误的内容.反射进入下一次试验的节目记忆.

组件:

- `Actor`一个有脚本的政策,
- `Evaluator.binary()` 通过/失败目标金额.
- `SelfReflector`产生了单线诊断失败.
- `EpisodicMemory`一个含有TL语义的有限列表.

运行它:

```
python3 code/main.py
npx tsx code/main.ts
```

测试显示了三个试验.试验1失败,一个反射被存储,试验2看到反射并改善,但仍然失败,试验3成功.与基线运行 (没有反射) 进行比较它在试验1的答案中留下来.

## 用它

长度图像将反射作为一个节点模式.`/memory`管理和支持工作流程`/learn-rule`通过Letta的睡眠时间计算,在停机时间内运行自反射器,因此主要代理保持延迟.OpenAI Agents SDK不会直接运送反射;您使用一个自定义的 Guardrail 构建它,它会根据分数和内存拒绝轨迹`Session`它们可以在其他地区生存.

## 运送它

`outputs/skill-reflexion-buffer.md`创建和维护一个以反射捕捉,TTL和减倍的节奏缓冲器. 考虑到任务类和失败,它会发出一个反射,实际上帮助下一个试验 (不是一个通用"要更加小心").

## 运动

1. 转换从二进制到规模评估器,返回距离指标 (距离目标是多远). 它是否更快地收缩?
2. 增加10次试验的TTL. 旧的反思是否会伤害或帮助?
3. 执行论评估器:如果同样的操作重复,标记试验为被固.
4. 试着与一个不愿意反射的演员进行反射.
5. 阅读AlfWorld的反思论文第4节. 概念上复制130%的成功率改善:什么是Delta与尼拉 ReAct的关键?

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Reflexion | "Self-correction" | Shinn et al. 2023 — Actor, Evaluator, Self-Reflector plus episodic memory |
| Verbal reinforcement | "Learning without gradients" | Natural-language reflection prepended to the next trial's prompt |
| Episodic memory | "Per-task reflections" | Bounded buffer of prior reflections for one task class |
| Scalar evaluator | "Binary success signal" | Pass/fail or numeric score from ground truth |
| Heuristic evaluator | "Pattern-based detector" | Predefined failure signatures (e.g. stuck-loop, too-many-steps) |
| Self-evaluator | "LLM-as-judge on own trace" | Lower-signal fallback when no ground truth — pair with tool-grounded verification |
| Memory rot | "Stale reflections" | Episodic buffer fills with obsolete entries; fix with compaction/TTL |
| Sleep-time reflection | "Async self-reflection" | Run Self-Reflector off the hot path so primary agent stays fast |

## 进一步阅读

- [Shinn et al., Reflexion: Language Agents with Verbal Reinforcement Learning (arXiv:2303.11366)](https://arxiv.org/abs/2303.11366)法典论文
- [Letta, Sleep-time Compute](https://www.letta.com/blog/sleep-time-compute)生产中的异步反射
- [Anthropic, Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)作为环境的一部分管理事件缓冲
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview)反射节点模式
