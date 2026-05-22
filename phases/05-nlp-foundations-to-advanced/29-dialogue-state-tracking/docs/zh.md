# 对话状态跟踪（Dialogue State Tracking）

> "我想在北边找一家便宜的餐厅……算了，改成中等价位……再加意大利菜。" 三轮对话，三次状态更新。DST 保持槽值字典同步，这样预订才能正常工作。

**类型：** 构建
**语言：** Python
**前置知识：** 阶段 5 · 17（聊天机器人），阶段 5 · 20（结构化输出）
**时间：** 约75分钟

## 问题

在面向任务的对话系统中，用户的目标被编码为一组槽值对：`{cuisine: italian, area: north, price: moderate}`。用户每轮对话都可能添加、修改或删除某个槽。系统必须阅读整个对话并正确输出当前状态。

只要搞错一个槽，系统就会订错餐厅、安排错航班、或扣错银行卡。DST 是用户所说内容与后端执行之间的关键环节。

为什么到了2026年它仍然重要，尽管有LLM：

- 合规敏感的领域（银行、医疗、航空订票）需要确定性的槽值，而不是自由形式的生成。
- 工具使用代理在调用API之前仍然需要槽解析。
- 多轮纠错比看起来难得多："实际上不，改成周四。"

现代流水线：经典 DST 概念 + LLM 提取器 + 结构化输出护栏（structured-output guardrails）。

## 概念

![DST: 对话历史 → 槽值状态](../assets/dst.svg)

**任务结构。** 一个模式定义了领域（餐厅、酒店、出租车）及其槽（菜系、地区、价格、人数）。每个槽可以是空值、填充一个来自封闭集合的值（价格：{cheap, moderate, expensive}），或自由形式的值（名称："The Copper Kettle"）。

**两种 DST 形式。**

- **分类。** 对每个（槽，候选值）对预测是/否。适用于封闭词汇的槽。2020年前的标准做法。
- **生成。** 给定对话，以自由文本形式生成槽值。适用于开放词汇的槽。现代默认做法。

**指标。** 联合目标准确率（Joint Goal Accuracy, JGA）——所有槽都正确的对话轮次比例。全有或全无。MultiWOZ 2.4 排行榜在2026年最高约83%。

**架构。**

1. **基于规则（槽正则表达式 + 关键词）。** 窄领域的强基线。可调试。
2. **TripPy / BERT-DST。** 基于拷贝的生成，使用 BERT 编码。LLM 前的标准做法。
3. **LDST（LLaMA + LoRA）。** 经过领域槽提示微调的 LLM。在 MultiWOZ 2.4 上达到 ChatGPT 级别质量。
4. **无需本体（2024–26）。** 跳过模式；直接生成槽名称和值。适用于开放领域。
5. **提示 + 结构化输出（2024–26）。** 使用 Pydantic 模式 + 约束解码的 LLM。5行代码，可投入生产。

### 经典的失败模式

- **跨轮指代。"我们选第一个选项。"** 需要解析是哪个选项。
- **覆盖 vs 追加。** 用户说"加意大利菜。"是替换菜系还是追加？
- **隐式确认。"OK 好的"** —— 是否接受了提供的预订？
- **纠错。"实际上改到晚上7点。"** 必须更新时间但不清除其他槽。
- **对先前系统话语的指代。"是的，那个。"** 哪个"那个"？

## 构建它

### 步骤 1: 基于规则的槽提取器

见 `code/main.py`。正则表达式 + 同义词词典在窄领域覆盖约70%的典型话语：

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

在标准词汇之外很脆弱。适用于确定性的槽确认。

### 步骤 2: 状态更新循环

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

三个不变量：

- 绝不重置用户没有触及的槽。
- 显式否定（"算了，不提菜系了"）必须清除。
- 用户纠错（"实际上……"）必须覆盖，而不是追加。

### 步骤 3: 基于 LLM 的结构化输出 DST

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

Instructor + Pydantic 保证了有效的状态对象。无需正则表达式、无需模式不匹配、无需虚构的槽。

### 步骤 4: JGA 评估

```python
def joint_goal_accuracy(predicted_states, gold_states):
    correct = sum(1 for p, g in zip(predicted_states, gold_states) if p == g)
    return correct / len(predicted_states)
```

校准：系统在多少比例的轮次中所有槽都正确？对于 MultiWOZ 2.4，2026年顶级系统达到80-83%。你的领域内系统在你的窄词汇上应该超过这个数字，否则 LLM 基线会打败你。

### 步骤 5: 处理纠错

```python
CORRECTION_CUES = {"actually", "no wait", "on second thought", "change that to"}


def is_correction(utterance):
    return any(cue in utterance.lower() for cue in CORRECTION_CUES)
```

检测到纠错时，覆盖最后更新的槽而不是追加。没有 LLM 帮助很难做对。现代模式：总是让 LLM 从历史中重新生成整个状态，而不是增量更新——这自然处理了纠错。

## 陷阱

- **全历史重新生成成本。** 每轮让 LLM 重新生成状态会导致总令牌数为 O(n²)。限制历史长度或总结较早的轮次。
- **模式漂移。** 事后添加新槽会破坏旧的训练数据。为你的模式打上版本号。
- **大小写敏感。"Italian" vs "italian" vs "ITALIAN"** —— 在所有地方进行规范化。
- **隐式继承。** 如果用户之前指定了"4个人"，新的请求改时间不应该清除人数。始终传递完整历史。
- **自由形式 vs 封闭集合。** 名称、时间和地址需要自由形式槽；菜系和地区是封闭的。在模式中混合两者。

## 使用它

2026年的技术栈：

| 场景 | 方法 |
|-----------|----------|
| 窄领域（一个或两个意图） | 基于规则 + 正则表达式 |
| 宽领域，有标注数据 | LDST（LLaMA + LoRA 在 MultiWOZ 风格数据上） |
| 宽领域，无标注，可投入生产 | LLM + Instructor + Pydantic 模式 |
| 语音/对话 | ASR + 规范化器 + LLM-DST |
| 多领域预订流程 | 模式引导的 LLM，每个领域有 Pydantic 模型 |
| 合规敏感 | 基于规则为主，LLM 备用并带确认流程 |

## 交付它

保存为 `outputs/skill-dst-designer.md`：

```markdown
---
name: dst-designer
description: 设计一个对话状态跟踪器——模式、提取器、更新策略、评估。
version: 1.0.0
phase: 5
lesson: 29
tags: [nlp, dialogue, task-oriented]
---

给定一个用例（领域、语言、词汇开放性、合规需求），输出：

1. 模式。领域列表，每个领域的槽，每个槽的开放 vs 封闭词汇。
2. 提取器。基于规则 / seq2seq / LLM-with-Pydantic。给出理由。
3. 更新策略。重新生成整个状态 / 增量更新；纠错处理；否定处理。
4. 评估。在预留的对话集上的联合目标准确率（Joint Goal Accuracy）、槽级别的精确率/召回率、最难槽的混淆情况。
5. 确认流程。何时明确要求用户确认（破坏性操作、低置信度提取）。

对于合规敏感的槽，拒绝仅依赖 LLM 的 DST，除非有基于规则的二次检查。拒绝任何无法在用户纠错时回滚槽的 DST。标记没有版本标签的模式。
```

## 练习

1. **简单。** 在 `code/main.py` 中为3个槽（菜系、地区、价格）构建基于规则的状态跟踪器。在10个手工编写的对话上测试。测量 JGA。
2. **中等。** 使用 Instructor + Pydantic + 小型 LLM 处理相同数据集。比较 JGA。检查最难的几轮对话。
3. **困难。** 实现两者并路由：基于规则为主，当基于规则提取的槽少于2个且置信度低时，启用 LLM 备用。测量组合 JGA 和每轮推理成本。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| DST | 对话状态跟踪 | 在对话轮次中维护槽值字典。 |
| Slot | 用户意图的单位 | 后端需要的命名参数（菜系、日期）。 |
| Domain | 任务领域 | 餐厅、酒店、出租车——槽的集合。 |
| JGA | 联合目标准确率 | 所有槽都正确的轮次比例。全有或全无。 |
| MultiWOZ | 基准测试集 | 多领域 Wizard-of-Oz 数据集；标准 DST 评估。 |
| Ontology-free DST | 无模式 | 直接生成槽名称和值，没有固定列表。 |
| Correction | "实际上……" | 覆盖先前已填充槽的轮次。 |

## 进一步阅读

- [Budzianowski et al. (2018). MultiWOZ — A Large-Scale Multi-Domain Wizard-of-Oz](https://arxiv.org/abs/1810.00278) —— 权威基准测试。
- [Feng et al. (2023). Towards LLM-driven Dialogue State Tracking (LDST)](https://arxiv.org/abs/2310.14970) —— LLaMA + LoRA 指令微调用于 DST。
- [Heck et al. (2020). TripPy — A Triple Copy Strategy for Value Independent Neural Dialog State Tracking](https://arxiv.org/abs/2005.02877) —— 基于拷贝的 DST 主力模型。
- [King, Flanigan (2024). Unsupervised End-to-End Task-Oriented Dialogue with LLMs](https://arxiv.org/abs/2404.10753) —— 基于 EM 的无监督 TOD。
- [MultiWOZ leaderboard](https://github.com/budzianowski/multiwoz) —— 权威 DST 结果。