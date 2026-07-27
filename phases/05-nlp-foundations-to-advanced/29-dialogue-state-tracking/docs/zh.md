# Dialogue State Tracking（对话状态跟踪）

> "我想在北边找一家便宜的餐厅……算了，中等价位吧……再加个意大利菜。" 三轮对话，三次状态更新。DST 维护槽值字典，确保预订系统正确执行。

**类型：** 动手实践（Build）
**编程语言：** Python
**前置条件：** 阶段5 · 17（聊天机器人），阶段5 · 20（结构化输出）
**预计时间：** ~75 分钟

## The Problem（问题描述）

在任务型对话系统中，用户的目标被编码为一组槽值对：`{cuisine: italian, area: north, price: moderate}`。每一轮用户对话都可能增加、修改或删除某个槽位。系统必须理解整个对话内容，并正确地输出当前状态。

只要一个槽位出错，系统就会订错餐厅、安排错航班，或扣错银行卡。DST 是用户说了什么和后端执行什么之间的关键枢纽。

为什么到了 2026 年，DST 仍然重要——即便有了 LLM：

- 合规敏感领域（银行、医疗、航班预订）需要确定性的槽值，而非自由文本生成。
- 工具调用代理在调用 API 之前仍然需要槽位解析。
- 多轮修正比看上去更难："不对，改成星期四。"

现代流水线：经典 DST 概念 + LLM 提取器 + 结构化输出护栏。

## The Concept（核心概念）

![DST：对话历史 → 槽值状态](../assets/dst.svg)

**任务结构。** 一个模式（schema）定义了领域（餐厅、酒店、出租车）及其槽位（菜系、区域、价格、人数）。每个槽位可以是空的、从封闭集合中填入一个值（价格：{便宜、中等、昂贵}），或者是一个自由形式的值（名称："The Copper Kettle"）。

**两种 DST 范式。**

- **分类（Classification）。** 对每个（槽位，候选值）对，预测是/否。适用于封闭词汇槽位。2020 年之前的标准做法。
- **生成（Generation）。** 根据对话，将槽值生成为自由文本。适用于开放词汇槽位。现代默认做法。

**评估指标。** 联合目标准确率（Joint Goal Accuracy, JGA）——*每个*槽位都正确的轮次占比。全对或全错。MultiWOZ 2.4 排行榜在 2026 年最高约为 83%。

**架构。**

1. **基于规则（槽位正则 + 关键词）。** 窄领域下的强基线。可调试。
2. **TripPy / BERT-DST。** 基于 BERT 编码的复制式生成。LLM 前的标准方案。
3. **LDST（LLaMA + LoRA）。** 使用领域-槽位提示的指令微调 LLM。在 MultiWOZ 2.4 上达到 ChatGPT 级别质量。
4. **免本体（Ontology-free，2024–26）。** 跳过模式定义，直接生成槽名和槽值。适用于开放领域。
5. **提示 + 结构化输出（2024–26）。** LLM + Pydantic 模式 + 约束解码。5 行代码，可直接用于生产。

### The classic failure modes（经典失败模式）

- **跨轮指代消解。** "我们选第一个选项吧。" 需要解析是哪个选项。
- **覆盖 vs 追加。** 用户说"加个意大利菜"。是替换菜系还是追加？
- **隐式确认。** "好的。"——这是接受了推荐的预订吗？
- **修正。** "改成 7 点。" 必须更新时间而不清空其他槽位。
- **指代上一轮系统话语。** "是的，那个。" 哪个"那个"？

## Build It（动手构建）

### Step 1: rule-based slot extractor（基于规则的槽位提取器）

参见 `code/main.py`。正则表达式 + 同义词词典在窄领域的标准表达中能覆盖 70% 的情况：

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

超出标准词汇表时较为脆弱。适用于确定性的槽位确认。

### Step 2: state update loop（状态更新循环）

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

三个不变性原则：

- 从不重置用户未触及的槽位。
- 显式否定（"菜系无所谓"）必须清空。
- 用户修正（"其实是……"）必须覆盖，而非追加。

### Step 3: LLM-driven DST with structured output（LLM 驱动的 DST + 结构化输出）

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

Instructor + Pydantic 保证返回有效的状态对象。无需正则、无模式不匹配、不会产生幻觉槽位。

### Step 4: JGA evaluation（JGA 评估）

```python
def joint_goal_accuracy(predicted_states, gold_states):
    correct = sum(1 for p, g in zip(predicted_states, gold_states) if p == g)
    return correct / len(predicted_states)
```

校准：系统在多大比例的轮次中*所有*槽位都正确？对于 MultiWOZ 2.4，2026 年顶级系统为 80-83%。你的领域内系统在你的窄词汇表上应该超过这个数字，否则 LLM 基线会超过你。

### Step 5: handling correction（处理修正）

```python
CORRECTION_CUES = {"actually", "no wait", "on second thought", "change that to"}


def is_correction(utterance):
    return any(cue in utterance.lower() for cue in CORRECTION_CUES)
```

检测到修正时，覆盖最近更新的槽位而非追加。没有 LLM 协助很难做好。现代模式：始终让 LLM 从完整历史中重新生成整个状态，而非增量更新——这样自然就能处理修正。

## Pitfalls（常见陷阱）

- **全历史重新生成的成本。** 每轮让 LLM 重新生成状态，总 token 消耗为 O(n²)。请限制历史长度或对较早的轮次进行摘要。
- **模式漂移。** 事后添加新槽位会破坏旧的训练数据。请对你的模式进行版本管理。
- **大小写敏感性。** "Italian" vs "italian" vs "ITALIAN"——在所有地方规范化处理。
- **隐式继承。** 如果用户之前指定了"4 个人"，新请求换个时间不应该清空人数。始终传递完整历史。
- **自由形式 vs 封闭集合。** 名称、时间和地址需要自由形式槽位；菜系和区域是封闭的。在模式中混合使用两者。

## Use It（实际运用）

2026 年的技术选型：

| 场景 | 方案 |
|----------|----------|
| 窄领域（一两个意图） | 基于规则 + 正则 |
| 宽领域，有标注数据 | LDST（LLaMA + LoRA 在 MultiWOZ 风格数据上微调） |
| 宽领域，无标注，可投产 | LLM + Instructor + Pydantic 模式 |
| 语音场景 | ASR + 归一化器 + LLM-DST |
| 多领域预订流程 | 模式引导的 LLM + 每领域 Pydantic 模型 |
| 合规敏感场景 | 基于规则为主，LLM 备选 + 确认流程 |

## Ship It（交付使用）

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

## Exercises（练习）

1. **简单。** 在 `code/main.py` 中为 3 个槽位（菜系、区域、价格）构建基于规则的状态跟踪器。在 10 个人工构造的对话上测试。计算 JGA。
2. **中等。** 使用 Instructor + Pydantic + 小型 LLM 处理同一数据集。对比 JGA。检查最难的轮次。
3. **困难。** 同时实现两种方案并进行路由：基于规则为主，当规则提取器对少于 2 个槽位置信度较低时回退到 LLM。计算组合后的 JGA 及每轮推理成本。

## Key Terms（关键术语）

| 术语 | 通常说法 | 实际含义 |
|------|-----------------|-----------------------|
| DST | Dialogue state tracking（对话状态跟踪） | 在对话轮次间维护槽值字典。 |
| 槽位（Slot） | 用户意图的单位 | 后端需要的命名参数（菜系、日期）。 |
| 领域（Domain） | 任务范围 | 餐厅、酒店、出租车——槽位的集合。 |
| JGA | Joint Goal Accuracy（联合目标准确率） | 每个槽位都正确的轮次占比。全对或全错。 |
| MultiWOZ | 标准基准数据集 | 多领域 Wizard-of-Oz 数据集；标准 DST 评估。 |
| 免本体 DST（Ontology-free DST） | 无需模式定义 | 直接生成槽名和槽值，无需固定列表。 |
| 修正（Correction） | "实际上是……" | 覆盖先前已填入槽位的轮次。 |

## Further Reading（延伸阅读）

- [Budzianowski et al. (2018). MultiWOZ — A Large-Scale Multi-Domain Wizard-of-Oz](https://arxiv.org/abs/1810.00278) — 标准基准数据集。
- [Feng et al. (2023). Towards LLM-driven Dialogue State Tracking (LDST)](https://arxiv.org/abs/2310.14970) — LLaMA + LoRA 指令微调用于 DST。
- [Heck et al. (2020). TripPy — A Triple Copy Strategy for Value Independent Neural Dialog State Tracking](https://arxiv.org/abs/2005.02877) — 基于复制的 DST 主力模型。
- [King, Flanigan (2024). Unsupervised End-to-End Task-Oriented Dialogue with LLMs](https://arxiv.org/abs/2404.10753) — 基于 EM 的无监督 TOD。
- [MultiWOZ leaderboard](https://github.com/budzianowski/multiwoz) — 标准 DST 结果排行榜。
