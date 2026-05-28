# Dialogue State Tracking

> "I want a cheap restaurant in the north... actually make it moderate... and add Italian." 3 turns、3 state updates。DST は slot-value dict を同期し続け、booking が正しく動くようにする。

**種別:** 構築
**言語:** Python
**前提条件:** Phase 5 · 17 (Chatbots), Phase 5 · 20 (Structured Outputs)
**所要時間:** 約75分

## 問題

task-oriented dialogue system では、user の goal は slot-value pairs の集合として表現される: `{cuisine: italian, area: north, price: moderate}`。user turn ごとに slot が追加、変更、削除される可能性がある。system は会話全体を読み、現在の state を正しく出力しなければならない。

slot を 1 つ間違えるだけで、system は違う restaurant を予約し、違う flight を schedule し、違う card に請求してしまう。DST は user が言ったことと backend が実行することをつなぐ要だ。

LLM がある 2026 年でも重要な理由:

- compliance-sensitive domains（banking、healthcare、airline booking）では、free-form generation ではなく deterministic slot values が必要。
- Tool-use agents でも API を呼ぶ前に slot resolution が必要。
- multi-turn correction は見た目より難しい: "actually no, make it Thursday."

modern pipeline は、classical DST concepts + LLM extractors + structured-output guardrails で構成される。

## コンセプト

![DST: dialog history → slot-value state](../assets/dst.svg)

**Task structure.** schema は domains（restaurant、hotel、taxi）と slots（cuisine、area、price、people）を定義する。各 slot は empty、closed set の value（price: {cheap, moderate, expensive}）、または free-form value（name: "The Copper Kettle"）になりうる。

**2 つの DST formulations。**

- **Classification.** 各 (slot, candidate_value) pair について yes/no を予測する。closed-vocab slots に効く。pre-2020 の標準。
- **Generation.** dialogue を与えて slot values を free text として生成する。open-vocab slots に効く。modern default。

**Metric.** Joint Goal Accuracy (JGA) — *すべての* slot が正しい turn の割合。all-or-nothing。MultiWOZ 2.4 leaderboard の上位は 2026 年時点で約 83%。

**Architectures.**

1. **Rule-based (slot regex + keyword).** narrow domains では強い baseline。debuggable。
2. **TripPy / BERT-DST.** BERT encoding を使う copy-based generation。pre-LLM 標準。
3. **LDST (LLaMA + LoRA).** domain-slot prompting を使う instruction-tuned LLM。MultiWOZ 2.4 で ChatGPT-level quality に達する。
4. **Ontology-free (2024–26).** schema を使わず、slot names と values を直接生成する。open domains に対応。
5. **Prompt + structured output (2024–26).** Pydantic schema + constrained decoding を使う LLM。5 lines of code で production-ready。

### 古典的な failure modes

- **Co-reference across turns.** "Let's stay with the first option." どの option か解決する必要がある。
- **Over-write vs append.** user が "add Italian." と言う。cuisine を replace するのか append するのか。
- **Implicit confirmations.** "OK cool" — offered booking を accept したのか。
- **Correction.** "Actually make it 7 pm." 他の slots を消さずに time を update しなければならない。
- **Coreference to previous system utterance.** "Yes, that one." どの "that" か。

## 作ってみる

### Step 1: rule-based slot extractor

`code/main.py` を参照。Regex + synonym dictionaries は narrow domains の canonical utterances の 70% を cover する。

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

canonical vocabulary の外では brittle。deterministic slot confirmations には使える。

### Step 2: state update loop

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

3 つの invariants:

- user が触れていない slot は reset しない。
- 明示的な negation（"never mind the cuisine"）は clear する。
- user correction（"actually..."）は append ではなく overwrite する。

### Step 3: structured output による LLM-driven DST

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

Instructor + Pydantic は valid state object を保証する。regex なし、schema mismatches なし、hallucinated slots なし。

### Step 4: JGA evaluation

```python
def joint_goal_accuracy(predicted_states, gold_states):
    correct = sum(1 for p, g in zip(predicted_states, gold_states) if p == g)
    return correct / len(predicted_states)
```

system が ALL slots を正しく取れた turn の割合を calibrate する。MultiWOZ 2.4 では 2026 年の top systems が 80-83%。narrow vocabulary の in-domain system なら、それを超えないと LLM baseline に負ける。

### Step 5: correction handling

```python
CORRECTION_CUES = {"actually", "no wait", "on second thought", "change that to"}


def is_correction(utterance):
    return any(cue in utterance.lower() for cue in CORRECTION_CUES)
```

correction を検出したら append ではなく last-updated slot を overwrite する。LLM の助けなしに正しく扱うのは難しい。modern pattern は、incremental update ではなく毎回 full history から whole state を regenerate すること。これにより corrections を自然に扱える。

## 落とし穴

- **Full-history regeneration cost.** LLM に毎 turn state を regenerate させると total tokens は O(n²) になる。history を cap するか、古い turns を summarize する。
- **Schema drift.** 後から new slots を追加すると old training data が壊れる。schema を version 管理する。
- **Case sensitivity.** "Italian" vs "italian" vs "ITALIAN" — すべて normalize する。
- **Implicit inheritance.** user が以前に "for 4 people" と指定しているなら、別の time への new request で people を clear してはいけない。必ず full history を渡す。
- **Free-form vs closed-set.** names、times、addresses には free-form slots が必要。cuisines と areas は closed。schema では両方を混ぜる。

## 使いどころ

2026 年の stack:

| Situation | Approach |
|-----------|----------|
| Narrow domain (one or two intents) | Rule-based + regex |
| Broad domain, labeled data available | LDST (LLaMA + LoRA on MultiWOZ-style data) |
| Broad domain, no labels, prod-ready | LLM + Instructor + Pydantic schema |
| Spoken / voice | ASR + normalizer + LLM-DST |
| Multi-domain booking flow | Schema-guided LLM with per-domain Pydantic models |
| Compliance-sensitive | Rule-based primary, LLM fallback with confirmation flow |

## Ship It

`outputs/skill-dst-designer.md` として保存する。

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

## 演習

1. **Easy.** `code/main.py` で 3 slots（cuisine、area、price）の rule-based state tracker を作る。10 個の hand-crafted dialogues で test する。JGA を測る。
2. **Medium.** 同じ dataset を Instructor + Pydantic + small LLM で扱う。JGA を比較する。最も難しい turns を調べる。
3. **Hard.** 両方を実装し、rule-based を primary、rule-based が confidence 付きで <2 slots しか出さない場合に LLM fallback へ route する。combined JGA と inference cost per turn を測る。

## 重要用語

| Term | よくある言い方 | 実際の意味 |
|------|-----------------|------------|
| DST | Dialogue state tracking | dialogue turns をまたいで slot-value dict を維持する。 |
| Slot | user intent の単位 | backend が必要とする named parameter（cuisine、date）。 |
| Domain | task area | Restaurant、hotel、taxi — slots の集合。 |
| JGA | Joint Goal Accuracy | every slot が正しい turn の割合。all-or-nothing。 |
| MultiWOZ | benchmark | Multi-domain WOZ dataset。DST evaluation の標準。 |
| Ontology-free DST | schema なし | fixed list なしで slot names と values を直接生成する。 |
| Correction | "Actually..." | 以前埋めた slot を overwrite する turn。 |

## 参考資料

- [Budzianowski et al. (2018). MultiWOZ — A Large-Scale Multi-Domain Wizard-of-Oz](https://arxiv.org/abs/1810.00278) — canonical benchmark。
- [Feng et al. (2023). Towards LLM-driven Dialogue State Tracking (LDST)](https://arxiv.org/abs/2310.14970) — DST 向けの LLaMA + LoRA instruction tuning。
- [Heck et al. (2020). TripPy — A Triple Copy Strategy for Value Independent Neural Dialog State Tracking](https://arxiv.org/abs/2005.02877) — copy-based DST workhorse。
- [King, Flanigan (2024). Unsupervised End-to-End Task-Oriented Dialogue with LLMs](https://arxiv.org/abs/2404.10753) — EM-based unsupervised TOD。
- [MultiWOZ leaderboard](https://github.com/budzianowski/multiwoz) — canonical DST results。
