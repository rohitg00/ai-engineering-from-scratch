# 对话状态跟踪（Dialogue State Tracking）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> "我想在城北找一家便宜的餐厅……算了，改成中等价位吧……再加一个意大利菜。" 三轮对话，三次状态更新。DST 让 slot-value 字典始终保持同步，预订才不会出错。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 17 (Chatbots), Phase 5 · 20 (Structured Outputs)
**Time:** ~75 minutes

## 问题（The Problem）

在面向任务的对话系统中，用户的意图被编码成一组 slot-value 对：`{cuisine: italian, area: north, price: moderate}`。每一轮用户发话都可能新增、修改或删除某个 slot。系统必须读完整段对话，再正确地输出当前状态。

只要任何一个 slot 错了，系统就会订错餐厅、订错航班，或者刷错卡。DST 就是用户说的话与后端实际执行之间的那道关键铰链。

为什么 2026 年有 LLM 之后它依然重要：

- 合规敏感领域（银行、医疗、机票预订）需要确定性的 slot 值，而不是自由生成的文本。
- 工具调用 agent 在调 API 之前仍然需要先解析 slot。
- 多轮纠正比看起来要难："不对不对，改成周四。"

现代流水线：经典 DST 概念 + LLM 抽取器 + 结构化输出 guardrail（护栏）。

## 概念（The Concept）

![DST：对话历史 → slot-value 状态](../assets/dst.svg)

**任务结构。** schema 定义若干 domain（餐厅、酒店、出租车）以及它们的 slot（cuisine、area、price、people）。每个 slot 可以为空，也可以填一个来自封闭集合的值（price: {cheap, moderate, expensive}），或是一个自由格式的值（name: "The Copper Kettle"）。

**两种 DST 形式化方式。**

- **分类（Classification）。** 对每一个 (slot, candidate_value) 对预测 yes/no。适用于封闭词表的 slot。2020 年前的标准做法。
- **生成（Generation）。** 给定对话，把 slot 值当作自由文本生成。适用于开放词表的 slot。现代默认方案。

**指标。** Joint Goal Accuracy（JGA，联合目标准确率）—— 所有 slot *全部*正确的轮次占比。全有或全无。MultiWOZ 2.4 排行榜在 2026 年大约停在 83%。

**架构。**

1. **基于规则（slot 正则 + 关键词）。** 在窄领域里是很强的 baseline。可调试。
2. **TripPy / BERT-DST。** 基于复制（copy-based）的生成 + BERT 编码。LLM 之前的标配。
3. **LDST（LLaMA + LoRA）。** 用 domain-slot 指令调过的 LLM。在 MultiWOZ 2.4 上能达到 ChatGPT 级别质量。
4. **Ontology-free（2024–26）。** 抛掉 schema，直接生成 slot 名和值。能处理开放领域。
5. **Prompt + 结构化输出（2024–26）。** LLM + Pydantic schema + 受限解码（constrained decoding）。5 行代码就能上生产。

### 经典失败模式

- **跨轮共指（co-reference）。** "就用第一个吧。" 必须解析出"第一个"是哪个。
- **覆盖 vs 追加。** 用户说 "add Italian"。是要替换 cuisine 还是追加？
- **隐式确认。** "OK cool" —— 这算接受了刚才的预订吗？
- **纠正。** "Actually make it 7 pm." 必须更新时间，但不能清掉其他 slot。
- **指代之前系统说的话。** "Yes, that one." 那个"that"是哪一个？

## 动手实现（Build It）

### Step 1：基于规则的 slot 抽取器

参见 `code/main.py`。正则 + 同义词词典在窄领域里能覆盖 70% 的标准说法：

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

一旦超出标准词表就脆弱。但对于确定性的 slot 确认场景够用。

### Step 2：状态更新循环

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

- 永远不要重置用户没碰过的 slot。
- 显式否定（"never mind the cuisine"）必须清空。
- 用户纠正（"actually..."）必须覆盖，不能追加。

### Step 3：LLM 驱动的 DST + 结构化输出

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

Instructor + Pydantic 保证你拿到一个合法的 state 对象。没有正则，没有 schema 不匹配，也不会幻觉出新 slot。

### Step 4：JGA 评估

```python
def joint_goal_accuracy(predicted_states, gold_states):
    correct = sum(1 for p, g in zip(predicted_states, gold_states) if p == g)
    return correct / len(predicted_states)
```

校准一下：系统在多少比例的轮次里能把*所有* slot 都答对？MultiWOZ 2.4 上 2026 年顶级系统在 80–83%。你的 in-domain 系统在自己窄词表上应当超过这个数字，否则 LLM baseline 会直接打败你。

### Step 5：处理纠正

```python
CORRECTION_CUES = {"actually", "no wait", "on second thought", "change that to"}


def is_correction(utterance):
    return any(cue in utterance.lower() for cue in CORRECTION_CUES)
```

一旦检测到纠正，就覆盖最近一次更新过的 slot，而不是追加。没有 LLM 帮忙很难做对。现代套路是：每一轮都让 LLM 从完整历史里重新生成整个 state，而不是增量更新 —— 这样自然就能处理纠正。

## 坑（Pitfalls）

- **完整历史重生成的成本。** 让 LLM 每轮都从头生成 state，总 token 是 O(n²)。要么截断历史，要么把更早的轮次摘要掉。
- **Schema drift（schema 漂移）。** 事后加新 slot 会让旧的训练数据失效。给你的 schema 打版本号。
- **大小写敏感。** "Italian" vs "italian" vs "ITALIAN" —— 所有地方都要做归一化。
- **隐式继承。** 如果用户之前说了 "for 4 people"，后续换时间的请求不能把 people 清掉。永远把完整历史传进去。
- **自由格式 vs 封闭集合。** 名字、时间、地址要自由格式 slot；菜系和区域是封闭集合。在 schema 里两种都要混用。

## 用起来（Use It）

2026 年的技术栈：

| 场景 | 方案 |
|-----------|----------|
| 窄领域（一两个 intent） | 规则 + 正则 |
| 宽领域，有标注数据 | LDST（LLaMA + LoRA，跑在 MultiWOZ 风格数据上） |
| 宽领域，没标注，要上生产 | LLM + Instructor + Pydantic schema |
| 语音 / spoken | ASR + 归一化器 + LLM-DST |
| 多 domain 预订流程 | schema-guided LLM，每个 domain 一个 Pydantic 模型 |
| 合规敏感 | 规则为主，LLM 兜底，再加确认流 |

## 上线部署（Ship It）

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

## 练习（Exercises）

1. **简单。** 在 `code/main.py` 里为 3 个 slot（cuisine、area、price）实现一个基于规则的状态跟踪器。在 10 段手写对话上测一下，量出 JGA。
2. **中等。** 用同一个数据集，换成 Instructor + Pydantic + 一个小 LLM。对比 JGA。把最难的那几轮拉出来看看。
3. **困难。** 两套都实现并做路由：规则为主，当规则抽出 <2 个 slot 或置信度低时切换到 LLM 兜底。量一下组合后的 JGA 与每轮推理成本。

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| DST | 对话状态跟踪 | 跨对话轮次维护 slot-value 字典。 |
| Slot | 用户意图的最小单元 | 后端需要的具名参数（cuisine、date）。 |
| Domain | 任务领域 | 餐厅、酒店、出租车 —— 各自的一组 slot。 |
| JGA | Joint Goal Accuracy | 所有 slot 都正确的轮次占比。全有或全无。 |
| MultiWOZ | 那个 benchmark | Multi-domain WOZ 数据集；DST 评估的标准。 |
| Ontology-free DST | 没有 schema | 直接生成 slot 名和值，没有固定列表。 |
| Correction | "Actually..." | 覆盖之前已填 slot 的那一轮。 |

## 延伸阅读（Further Reading）

- [Budzianowski et al. (2018). MultiWOZ — A Large-Scale Multi-Domain Wizard-of-Oz](https://arxiv.org/abs/1810.00278) —— 经典 benchmark。
- [Feng et al. (2023). Towards LLM-driven Dialogue State Tracking (LDST)](https://arxiv.org/abs/2310.14970) —— LLaMA + LoRA 指令微调做 DST。
- [Heck et al. (2020). TripPy — A Triple Copy Strategy for Value Independent Neural Dialog State Tracking](https://arxiv.org/abs/2005.02877) —— 基于复制的 DST 主力方案。
- [King, Flanigan (2024). Unsupervised End-to-End Task-Oriented Dialogue with LLMs](https://arxiv.org/abs/2404.10753) —— 基于 EM 的无监督 TOD。
- [MultiWOZ leaderboard](https://github.com/budzianowski/multiwoz) —— 经典 DST 结果。
