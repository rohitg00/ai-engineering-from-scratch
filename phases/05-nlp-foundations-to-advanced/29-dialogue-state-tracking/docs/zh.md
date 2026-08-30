# 29 · 对话状态追踪

> “我想在北区找一家便宜的餐厅……其实改成中等价位吧……再加上意大利菜。”三轮对话，三次状态更新。「对话状态追踪（Dialogue State Tracking，DST）」负责让槽位-值字典保持同步，从而让预订得以正确执行。

**类型：** 实战构建
**语言：** Python
**前置：** 阶段 5 · 17（聊天机器人）、阶段 5 · 20（结构化输出）
**时长：** 约 75 分钟

## 问题所在

在面向任务的对话系统中，用户的目标被编码为一组「槽位-值（slot-value）」对：`{cuisine: italian, area: north, price: moderate}`。用户的每一轮发言都可能新增、修改或删除某个槽位。系统必须读取整段对话，并正确输出当前状态。

只要有一个槽位出错，系统就会预订错餐厅、订错航班，或者刷错信用卡。DST 是连接「用户所说」与「后端所执行」之间的枢纽。

为什么在 2026 年、即便有了大语言模型（LLM），它依然重要：

- 合规敏感领域（银行、医疗、航空预订）要求确定性的槽位值，而非自由生成的文本。
- 「工具使用（tool-use）」型智能体在调用 API 之前仍然需要做槽位解析。
- 多轮纠正比看起来更难：“其实不对，改成周四。”

现代流水线：经典 DST 概念 + LLM 抽取器 + 结构化输出护栏。

## 核心概念

〔图：DST——对话历史到槽位-值状态〕

**任务结构。** 一个「模式（schema）」定义了若干领域（餐厅、酒店、出租车）及其槽位（cuisine、area、price、people）。每个槽位可以为空、填入来自封闭集合的值（price: {cheap, moderate, expensive}），或填入自由形式的值（name: "The Copper Kettle"）。

**两种 DST 建模方式。**

- **分类（Classification）。** 对每个 (slot, candidate_value) 对预测是/否。适用于封闭词表槽位。2020 年之前的标准做法。
- **生成（Generation）。** 给定对话，将槽位值作为自由文本生成。适用于开放词表槽位。现代默认做法。

**评估指标。** 「联合目标准确率（Joint Goal Accuracy，JGA）」——*所有*槽位都正确的轮次所占的比例。全对或全错。2026 年 MultiWOZ 2.4 排行榜的最高分约为 83%。

**架构。**

1. **基于规则（槽位正则 + 关键词）。** 在窄领域中是强力基线，且可调试。
2. **TripPy / BERT-DST。** 基于复制（copy-based）的生成，配合 BERT 编码。LLM 之前的标准做法。
3. **LDST（LLaMA + LoRA）。** 经过指令微调的 LLM，采用领域-槽位提示。在 MultiWOZ 2.4 上达到 ChatGPT 级别的质量。
4. **无本体（Ontology-free，2024–26）。** 跳过模式，直接生成槽位名和值。可处理开放领域。
5. **提示 + 结构化输出（2024–26）。** 配合 Pydantic 模式与「受约束解码（constrained decoding）」的 LLM。5 行代码即可投入生产。

### 经典的失败模式

- **跨轮共指（Co-reference）。** “就选第一个吧。”需要解析出指的是哪个选项。
- **覆盖还是追加。** 用户说“加上意大利菜”。你应该替换 cuisine 还是追加？
- **隐式确认。** “好的，可以”——这到底有没有接受所提供的预订？
- **纠正（Correction）。** “其实改成晚上 7 点。”必须在不清空其他槽位的情况下更新时间。
- **对前一句系统话语的共指。** “对，就那个。”这里的“那个”指什么？

## 动手构建

### 第 1 步：基于规则的槽位抽取器

参见 `code/main.py`。正则 + 同义词词典可以覆盖窄领域中 70% 的规范化（canonical）发言：

```python
CUISINE_SYNONYMS = {
    "italian": ["italian", "pasta", "pizza", "italy"],
    "chinese": ["chinese", "chow mein", "noodles"],
}


def extract_cuisine(utterance):
    for canonical, synonyms in CUISINE_SYNONYMS.items():
        if any(syn in utterance.lower() for syn in synonyms):
            return canonical
    return None
```

一旦超出规范化词表就会很脆弱。适用于确定性的槽位确认场景。

### 第 2 步：状态更新循环

```python
def update_state(state, utterance):
    new_state = dict(state)
    for slot, extractor in SLOT_EXTRACTORS.items():
        value = extractor(utterance)
        if value is not None:
            new_state[slot] = value
    for slot in NEGATION_CLEARS:
        if is_negated(utterance, slot):
            new_state[slot] = None
    return new_state
```

三条不变量：

- 绝不重置用户未触碰的槽位。
- 显式否定（“算了，不要那个菜系”）必须清空。
- 用户纠正（“其实……”）必须覆盖，而非追加。

### 第 3 步：基于 LLM 且带结构化输出的 DST

```python
from pydantic import BaseModel
from typing import Literal, Optional
import instructor

class RestaurantState(BaseModel):
    cuisine: Optional[Literal["italian", "chinese", "indian", "thai", "any"]] = None
    area: Optional[Literal["north", "south", "east", "west", "center"]] = None
    price: Optional[Literal["cheap", "moderate", "expensive"]] = None
    people: Optional[int] = None
    day: Optional[str] = None


def llm_dst(history, llm):
    prompt = f"""You track the slot values of a restaurant booking across turns.
Dialogue so far:
{render(history)}

Update the state based on the latest user turn. Output only the JSON state."""
    return llm(prompt, response_model=RestaurantState)
```

Instructor + Pydantic 保证返回一个合法的状态对象。无需正则、不会出现模式不匹配，也不会有臆造的槽位。

### 第 4 步：JGA 评估

```python
def joint_goal_accuracy(predicted_states, gold_states):
    correct = sum(1 for p, g in zip(predicted_states, gold_states) if p == g)
    return correct / len(predicted_states)
```

校准：系统在多大比例的轮次中把所有槽位都答对了？对于 MultiWOZ 2.4，2026 年顶尖系统为 80-83%。你的领域内系统在自己的窄词表上理应超过这一水平，否则 LLM 基线就会赢过你。

### 第 5 步：处理纠正

```python
CORRECTION_CUES = {"actually", "no wait", "on second thought", "change that to"}


def is_correction(utterance):
    return any(cue in utterance.lower() for cue in CORRECTION_CUES)
```

一旦检测到纠正，就覆盖最近更新的那个槽位，而不是追加。没有 LLM 的帮助很难做对。现代模式是：始终让 LLM 从历史中重新生成整个状态，而非增量更新——这样能自然地处理纠正。

## 陷阱

- **全历史重新生成的成本。** 每一轮都让 LLM 重新生成状态，总计会消耗 O(n²) 的 token。要给历史设上限，或对较早的轮次做摘要。
- **模式漂移（Schema drift）。** 事后新增槽位会破坏旧的训练数据。为你的模式做版本管理。
- **大小写敏感。** "Italian" 与 "italian" 与 "ITALIAN"——在所有地方都要做归一化。
- **隐式继承。** 如果用户之前已经指定了“4 个人”，那么一次针对不同时间的新请求不应清空 people。永远要传入完整历史。
- **自由形式 vs 封闭集合。** 名称、时间和地址需要自由形式槽位；菜系和区域是封闭的。在模式中混合使用两者。

## 实际运用

2026 年的技术栈：

| 场景 | 方案 |
|-----------|----------|
| 窄领域（一两个意图） | 基于规则 + 正则 |
| 宽领域、有标注数据 | LDST（在 MultiWOZ 风格数据上做 LLaMA + LoRA） |
| 宽领域、无标注、可投产 | LLM + Instructor + Pydantic 模式 |
| 口语 / 语音 | ASR + 归一化器 + LLM-DST |
| 多领域预订流程 | 模式引导的 LLM，每个领域配一个 Pydantic 模型 |
| 合规敏感 | 以规则为主，LLM 作为兜底，并配合确认流程 |

## 交付物

保存为 `outputs/skill-dst-designer.md`：

```markdown
---
name: dst-designer
description: Design a dialogue state tracker — schema, extractor, update policy, evaluation.
version: 1.0.0
phase: 5
lesson: 29
tags: [nlp, dialogue, task-oriented]
---

Given a use case (domain, languages, vocab openness, compliance needs), output:

1. Schema. Domain list, slots per domain, open vs closed vocabulary per slot.
2. Extractor. Rule-based / seq2seq / LLM-with-Pydantic. Reason.
3. Update policy. Regenerate-whole-state / incremental; correction handling; negation handling.
4. Evaluation. Joint Goal Accuracy on a held-out dialogue set, slot-level precision/recall, confusion on the hardest slot.
5. Confirmation flow. When to explicitly ask the user to confirm (destructive actions, low-confidence extractions).

Refuse LLM-only DST for compliance-sensitive slots without a rule-based secondary check. Refuse any DST that cannot roll back a slot on user correction. Flag schemas without version tags.
```

## 练习

1. **简单。** 在 `code/main.py` 中为 3 个槽位（cuisine、area、price）构建基于规则的状态追踪器。在 10 段手工编写的对话上测试。测量 JGA。
2. **中等。** 使用相同数据集，配合 Instructor + Pydantic + 一个小型 LLM。对比 JGA。检查最难的那些轮次。
3. **困难。** 同时实现两者并做路由：以规则为主，当基于规则的方法只输出少于 2 个有把握的槽位时回退到 LLM。测量合并后的 JGA 以及每轮的推理成本。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|-----------------------|
| DST | 对话状态追踪 | 在对话各轮之间维护槽位-值字典。 |
| Slot（槽位） | 用户意图的单元 | 后端所需的具名参数（cuisine、date）。 |
| Domain（领域） | 任务领域 | 餐厅、酒店、出租车——一组组槽位。 |
| JGA | 联合目标准确率 | 每个槽位都正确的轮次所占比例。全对或全错。 |
| MultiWOZ | 基准数据集 | 多领域 WOZ 数据集；标准的 DST 评估基准。 |
| Ontology-free DST（无本体 DST） | 无模式 | 直接生成槽位名和值，没有固定列表。 |
| Correction（纠正） | “其实……” | 覆盖此前已填槽位的那一轮发言。 |

## 延伸阅读

- [Budzianowski et al. (2018). MultiWOZ — A Large-Scale Multi-Domain Wizard-of-Oz](https://arxiv.org/abs/1810.00278) —— 经典基准数据集。
- [Feng et al. (2023). Towards LLM-driven Dialogue State Tracking (LDST)](https://arxiv.org/abs/2310.14970) —— 面向 DST 的 LLaMA + LoRA 指令微调。
- [Heck et al. (2020). TripPy — A Triple Copy Strategy for Value Independent Neural Dialog State Tracking](https://arxiv.org/abs/2005.02877) —— 基于复制的 DST 主力方法。
- [King, Flanigan (2024). Unsupervised End-to-End Task-Oriented Dialogue with LLMs](https://arxiv.org/abs/2404.10753) —— 基于 EM 的无监督 TOD。
- [MultiWOZ leaderboard](https://github.com/budzianowski/multiwoz) —— 经典的 DST 结果。
