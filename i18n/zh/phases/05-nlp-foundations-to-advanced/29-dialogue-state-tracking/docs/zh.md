# 对话状态跟踪

> "我想要一个北方的廉价餐厅... 让它适度... 加入意大利语". 三轮,三次状态更新.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 17 (Chatbots), Phase 5 · 20 (Structured Outputs)
**Time:** ~75 minutes

## 问题

在任务导向对话系统中,用户的目标是编码为一个插槽值对的集合: `{cuisine: italian, area: north, price: moderate}`每个用户转换可以添加,更改或删除一个插槽.系统必须正确读取整个对话并输出当前状态.

系统会预订错误的餐厅,安排错误的航班,或者收费错误的卡.

尽管在2026年,

- 符合性敏感领域 (银行,医疗保健,航空公司预订) 需要确定式插槽值,而不是自由形式生成.
- 工具使用代理人需要在调用API之前的插槽分辨率.
- 复制的修复比看起来更难: "实际上,不,

现代管道:经典的DST概念+LLM提取器+结构化输出防护.

## 概念

![DST: dialog history → slot-value state](../assets/dst.svg)

**Task structure.**方案定义域 (餐厅,酒店,出租车) 和它们的插槽 (厨房,区域,价格,人).每个插槽可以是空的,由一个封闭的集合 (价格: {廉价,中等,昂贵}) 填满的值,或是自由形式的值 (名称: "铜").

**Two DST formulations.**

- **Classification.**对于每个 (slot, candidate_value) 对,预测是/否. 适用于闭口音口音口音. 2020 年前标准.
- **Generation.**根据对话,生成空中值作为自由文本. 适用于开放语音空中. 现代默认.

**Metric.**合目标精度 (JGA) 是每个插槽都是正确的转折分数.所有或什么都不.MultiWOZ 2.4在2026年达到83%左右的排名.

**Architectures.**

1. **Rule-based (slot regex + keyword).**对于狭域来说,强基线.
2. **TripPy / BERT-DST.**基于BERT编码的复制生成,是LLM前标准.
3. **LDST (LLaMA + LoRA).**通过教学调整的LLM,具有域名插槽提示. 在MultiWOZ 2.4上达到ChatGPT水平的质量.
4. **Ontology-free (2024–26).**跳过方案,直接生成插槽名称和值. 处理开放域名.
5. **Prompt + structured output (2024–26).**具有Pydantic模式的LLM+限制式解码. 5行代码,准备生产.

### 经典的故障模式

- **Co-reference across turns.**"让我们留下第一种选择".需要解决哪种选择.
- **Over-write vs append.**用户说"添加意大利语".你替换厨房还是添加?
- **Implicit confirmations.**"好吧,好吧" ,这是否接受了预订?
- **Correction.**"实际上是晚上7点".必须更新时间,而不需要清除其他插槽.
- **Coreference to previous system utterance.**"是的,那个. "哪个"那"?

```figure
n5-slot-tracker
```

## 建立它

### 步骤1:基于规则的插槽提取器

看到`code/main.py`雷杰克斯+同义词典涵盖了70%的狭领域的正义语句:

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

除了法典词汇,可以确定分区确认.

### 步骤2:状态更新循环

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

其他类型:

- 永远不要重置用户未触及的插槽.
- 必须明确的否定 ("不管厨房如何")
- 用户纠正 ("实际上...") 必须重写,而不是添加.

### 步骤3:结构化输出的LLM驱动DST

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

导师+Pydantic保证一个有效状态对象.没有regex,没有方案不匹配,没有幻觉的插槽.

### 步骤4:JGA评估

```python
def joint_goal_accuracy(predicted_states, gold_states):
    correct = sum(1 for p, g in zip(predicted_states, gold_states) if p == g)
    return correct / len(predicted_states)
```

校准:系统的轮流中多少个分数能得到所有插槽?对于MultiWOZ 2.4,2026系统:80-83%.你的域内系统应该超过你的狭窄词汇,否则LLM基线比你更好.

### 步骤5:处理纠正

```python
CORRECTION_CUES = {"actually", "no wait", "on second thought", "change that to"}


def is_correction(utterance):
    return any(cue in utterance.lower() for cue in CORRECTION_CUES)
```

在检测到的纠正时,请重写最后更新的插槽,而不是添加.没有LLM帮助就很难得到正确.现代模式:总是让LLM从历史中再生整个状态,而不是逐步更新.

## 陷

- **Full-history regeneration cost.**让LLM重建状态每轮成本$O(n^2)$总代币. 值历史或总结较早的转折.
- **Schema drift.**增加新的插槽后,会打破旧的训练数据.
- **Case sensitivity.**意大利人对意大利人对意大利人,
- **Implicit inheritance.**如果用户之前指定了"为4人",则新的请求不应该清除人数.
- **Free-form vs closed-set.**需要自由形式的插槽,厨房和区域都关闭.

## 用它

现在,我们要做什么?

| Situation | Approach |
|-----------|----------|
| Narrow domain (one or two intents) | Rule-based + regex |
| Broad domain, labeled data available | LDST (LLaMA + LoRA on MultiWOZ-style data) |
| Broad domain, no labels, prod-ready | LLM + Instructor + Pydantic schema |
| Spoken / voice | ASR + normalizer + LLM-DST |
| Multi-domain booking flow | Schema-guided LLM with per-domain Pydantic models |
| Compliance-sensitive | Rule-based primary, LLM fallback with confirmation flow |

## 运送它

保存如`outputs/skill-dst-designer.md`其他:

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

## 运动

1. **Easy.**建立基于规则的状态追踪器`code/main.py`测试10个手工对话.测量JGA.
2. **Medium.**导师+Pydantic+一个小的LLM. 比较JGA.检查最难的转折.
3. **Hard.**执行既定路线:基于规则的初级,基于规则的LLM倒退时可放出<2个安全时段. 测量每轮的结合JGA和推断成本.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| DST | Dialogue state tracking | Maintain the slot-value dict across dialogue turns. |
| Slot | Unit of user intent | Named parameter the backend needs (cuisine, date). |
| Domain | The task area | Restaurant, hotel, taxi — sets of slots. |
| JGA | Joint Goal Accuracy | Fraction of turns where every slot is correct. All-or-nothing. |
| MultiWOZ | The benchmark | Multi-domain WOZ dataset; standard DST evaluation. |
| Ontology-free DST | No schema | Generate slot names and values directly, no fixed list. |
| Correction | "Actually..." | Turn that overwrites a previously-filled slot. |

## 进一步阅读

- [Budzianowski et al. (2018). MultiWOZ — A Large-Scale Multi-Domain Wizard-of-Oz](https://arxiv.org/abs/1810.00278)法典标准.
- [Feng et al. (2023). Towards LLM-driven Dialogue State Tracking (LDST)](https://arxiv.org/abs/2310.14970) DST 调节LLaMA + LoRA指令.
- [Heck et al. (2020). TripPy — A Triple Copy Strategy for Value Independent Neural Dialog State Tracking](https://arxiv.org/abs/2005.02877)基于复制的DST工作马.
- [King, Flanigan (2024). Unsupervised End-to-End Task-Oriented Dialogue with LLMs](https://arxiv.org/abs/2404.10753)基于EM的无监督死亡.
- [MultiWOZ leaderboard](https://github.com/budzianowski/multiwoz)可信的DST结果.
