# 对话状态跟踪（Dialogue State Tracking）

> "我要一家北边便宜的餐厅……其实改成中等价位的……再加个意大利菜。”三轮对话，三次状态更新。DST 保持槽位-值字典的同步，使预订能正常进行。

**Type:** Build
**Languages:** Python
**Prerequisites:** 阶段 5 · 17（聊天机器人），阶段 5 · 20（结构化输出）
**Time:** 约 75 分钟

## 问题所在

在面向任务的对话系统中，用户目标被编码为一组槽位-值对：`{cuisine: italian, area: north, price: moderate}`。用户的每一轮对话都可能添加、修改或删除一个槽位。系统必须读取整个对话，并正确输出当前状态。

只要弄错一个槽位，系统就可能订错餐厅、订错航班，或扣错卡。DST 是用户所说内容与后端所执行内容之间的关键枢纽。

尽管有 LLM，它为何在 2026 年仍然重要：

- 合规敏感领域（银行、医疗、航空订票）需要确定性的槽位值，而不是自由格式的生成结果。
- 工具调用型智能体在调用 API 之前仍需要进行槽位解析。
- 多轮纠错比看上去更难：“不对，改到周四。”

现代流水线：经典 DST 概念 + LLM 抽取器 + 结构化输出防护。

## 核心概念

![DST: dialog history → slot-value state](../assets/dst.svg)

**任务结构。** 一个模式（schema）定义了领域（餐厅、酒店、出租车）及其槽位（菜系、区域、价格、人数）。每个槽位可以为空、填充来自封闭集合的值（price: {cheap, moderate, expensive}），或填充自由格式的值（name: "The Copper Kettle"）。

**两种 DST 建模方式。**

- **分类。** 对每个（槽位，候选值）对，预测是/否。适用于封闭词表槽位。2020 年之前的标准做法。
- **生成。** 给定对话，将槽位值生成为自由文本。适用于开放词表槽位。现代的默认选择。

**指标。** Joint Goal Accuracy（JGA）——即*所有*槽位都正确的轮次所占比例。要么全对，要么全错。2026 年 MultiWOZ 2.4 榜单最高约为 83%。

**架构。**

1. **基于规则（槽位正则 + 关键词）。** 窄领域的强基线。可调试。
2. **TripPy / BERT-DST。** 基于 BERT 编码的复制式生成。LLM 出现之前的标准。
3. **LDST（LLaMA + LoRA）。** 经指令微调、采用领域-槽位提示的 LLM。在 MultiWOZ 2.4 上达到 ChatGPT 级别的质量。
4. **免本体（2024–26）。** 跳过模式；直接生成槽位名和值。可处理开放领域。
5. **提示 + 结构化输出（2024–26）。** LLM 配合 Pydantic 模式 + 受约束解码。5 行代码，即可用于生产环境。

### 经典失败模式

- **跨轮共指。** “就用第一个选项吧。”需要解析出是哪个选项。
- **覆盖还是追加。** 用户说“加个意大利菜”。你该替换 cuisine 还是追加？
- **隐式确认。** "OK cool"——这算接受了所提供的预订吗？
- **纠正。** “其实改成晚上 7 点。”必须更新时间且不清除其他槽位。
- **对上一轮系统话语的共指。** “对，就是那个。”哪个“那个”？

```figure
n5-slot-tracker
```

## 动手构建

### 第 1 步：基于规则的槽位抽取器

见 `code/main.py`。正则 + 同义词词典可以覆盖窄领域中 70% 的规范话语：

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

在规范词表之外非常脆弱。适用于确定性的槽位确认。

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

三条不变式：

- 绝不重置用户未触碰的槽位。
- 显式否定（“菜系就算了”）必须清除。
- 用户纠正（“其实……”）必须覆盖，而不是追加。

### 第 3 步：基于结构化输出的 LLM 驱动 DST

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

Instructor + Pydantic 保证得到合法的状态对象。无需正则，无模式不匹配，无幻觉槽位。

### 第 4 步：JGA 评估

```python
def joint_goal_accuracy(predicted_states, gold_states):
    correct = sum(1 for p, g in zip(predicted_states, gold_states) if p == g)
    return correct / len(predicted_states)
```

校准：系统在多大比例的轮次上所有槽位全对？对于 MultiWOZ 2.4，2026 年顶级系统：80–83%。你的领域内系统应当在你的窄词表上超过这一水平，否则 LLM 基线会胜过你。

### 第 5 步：处理纠正

```python
CORRECTION_CUES = {"actually", "no wait", "on second thought", "change that to"}


def is_correction(utterance):
    return any(cue in utterance.lower() for cue in CORRECTION_CUES)
```

检测到纠正时，覆盖最近更新的槽位，而不是追加。在没有 LLM 帮助的情况下很难做对。现代做法：始终让 LLM 从历史中重新生成整个状态，而不是增量更新——这天然能处理纠正。

## 常见陷阱

- **全历史重新生成的成本。** 让 LLM 每轮重新生成状态，总 token 成本为 O(n²)。限制历史长度或摘要较早的轮次。
- **模式漂移。** 事后添加新槽位会破坏旧的训练数据。为你的模式做版本管理。
- **大小写敏感。** "Italian"、"italian"、"ITALIAN"——到处都要归一化。
- **隐式继承。** 如果用户之前已说明“4 个人”，一个新的不同时间的请求不应清除 people。始终传入完整历史。
- **自由格式 vs 封闭集合。** 名称、时间、地址需要自由格式槽位；菜系和区域是封闭的。在模式中两者混用。

## 应用场景

2026 年的技术栈：

| 场景 | 方法 |
|-----------|----------|
| 窄领域（一两个意图） | 基于规则 + 正则 |
| 宽领域，有标注数据 | LDST（在 MultiWOZ 风格数据上用 LLaMA + LoRA） |
| 宽领域，无标注，可直接上线 | LLM + Instructor + Pydantic 模式 |
| 口语 / 语音 | ASR + 归一化器 + LLM-DST |
| 多领域预订流程 | 基于模式引导的 LLM，每个领域一个 Pydantic 模型 |
| 合规敏感 | 以规则为主，LLM 兜底并加确认流程 |

## 上线部署

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

1. **简单。** 在 `code/main.py` 中为 3 个槽位（cuisine、area、price）构建基于规则的状态跟踪器。在 10 个手工编写的对话上测试。计算 JGA。
2. **中等。** 使用 Instructor + Pydantic + 一个小型 LLM 处理相同数据集。比较 JGA。检查最难的那些轮次。
3. **困难。** 同时实现两者并进行路由：以规则为主，当规则输出的槽位少于 2 个且无置信度时回退到 LLM。测量组合后的 JGA 和每轮推理成本。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|-----------------------|
| DST | 对话状态跟踪 | 在对话轮次间维护槽位-值字典。 |
| Slot（槽位） | 用户意图单元 | 后端所需的命名参数（菜系、日期）。 |
| Domain（领域） | 任务范围 | 餐厅、酒店、出租车——一组槽位。 |
| JGA | Joint Goal Accuracy | 所有槽位都正确的轮次比例。要么全对，要么全错。 |
| MultiWOZ | 基准数据集 | 多领域 WOZ 数据集；DST 的标准评测。 |
| 免本体 DST | 无模式 | 直接生成槽位名和值，没有固定列表。 |
| Correction（纠正） | “其实……” | 覆盖之前已填槽位的轮次。 |

## 延伸阅读

- [Budzianowski et al. (2018). MultiWOZ — A Large-Scale Multi-Domain Wizard-of-Oz](https://arxiv.org/abs/1810.00278) — 经典基准。
- [Feng et al. (2023). Towards LLM-driven Dialogue State Tracking (LDST)](https://arxiv.org/abs/2310.14970) — 用于 DST 的 LLaMA + LoRA 指令微调。
- [Heck et al. (2020). TripPy — A Triple Copy Strategy for Value Independent Neural Dialog State Tracking](https://arxiv.org/abs/2005.02877) — 基于复制的 DST 主力工作。
- [King, Flanigan (2024). Unsupervised End-to-End Task-Oriented Dialogue with LLMs](https://arxiv.org/abs/2404.10753) — 基于 EM 的无监督 TOD。
- [MultiWOZ leaderboard](https://github.com/budzianowski/multiwoz) — 经典 DST 结果。