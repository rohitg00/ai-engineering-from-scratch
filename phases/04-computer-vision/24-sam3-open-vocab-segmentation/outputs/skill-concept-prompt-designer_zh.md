---
name: skill-concept-prompt-designer
description: 将用户话语转换为格式良好的SAM 3概念提示，包含分割、消歧和回退机制
version: 1.0.0
phase: 4
lesson: 24
tags: [sam3, open-vocab, prompt-engineering, segmentation]
---

# 概念提示设计师

SAM 3的准确性很大程度上取决于概念提示的表述方式。此技能将自由形式的用户话语规范化为SAM 3能很好处理的提示。

## 使用场景

- 构建接受自然语言对象查询的UI。
- 通过API暴露SAM 3，上游调用者发送句子。
- 调试SAM 3匹配不佳的情况——通常提示格式错误，而非模型问题。

## 输入

- `utterance`: 原始用户字符串。
- `context`: 可选的领域提示（例如"surveillance"、"medical"、"retail"）。
- `max_concepts`: 每次话语提取的最大概念数；默认为5。

## SAM 3偏好的规则

- **短名词短语，而非句子。** `"cat"` 优于 `"there is a cat"`。
- **具体名词。** `"skateboard"` 优于 `"thing to ride on"`。
- **修饰语紧接在名词前。** `"red car"` 优于 `"car that is red"`。
- **小写。** SAM 3具有鲁棒性，但经验上对小写输入略好。
- **单数或复数。** 两者都有效；复数有助于预期多个实例时。

## 步骤

1. **按常见分隔符分词** —— 逗号、分号、"and"、"or"、"&"。
2. **删除填充前缀** —— "find"、"show me"、"segment"、"detect"、"locate"、"a"、"an"、"the"。
3. **仅保留视觉介词修饰语** —— `"striped red umbrella"` 可以， `"umbrella from yesterday"` 不行（"from yesterday"不在图像中）。
4. **使用可选的`context`消歧碰撞**：
   - `"window"` 在监控上下文中 -> `"building window"`。
   - `"window"` 在医疗上下文中 -> 通常是错误；建议用户澄清。
5. **回退** 到确切字符串，如果分割产生零个概念*且*话语包含至少一个具体名词。如果无法提取具体名词，不要输出概念——仅返回警告并要求用户澄清（见规则）。
6. **限制在`max_concepts`。** 如果提取的概念超过调用者要求的数量，按话语顺序保留前`max_concepts`个，其余在`dropped`中输出，原因为`"exceeded max_concepts"`。当用户粘贴长列表时，这可以保持延迟有界。

## 输出格式

```
[designed prompts]
  utterance:    <original>
  concepts:     ["concept_1", "concept_2", ...]
  dropped:      ["filler_1", ...]
  warnings:     ["concept too abstract", "may match many classes", ...]

[sam3 calls]
  For each concept run: sam3.detect(image, concept)
  Merge outputs with distinct concept tags per detection.
```

## 示例

```
in:  "can you find me a cat or two dogs?"
out: ["cat", "dogs"]
dropped: ["can you find me", "a", "or two", "?"]
note: "dogs" kept plural because the utterance says "two dogs" — plural hint preserved.

in:  "segment the big red truck and the blue sedan"
out: ["big red truck", "blue sedan"]
dropped: ["segment", "the", "and"]

in:  "thing near the door"
out: ["door"]
warnings: ["'thing' is too abstract for SAM 3; fell back to 'door'"]

in:  "striped red umbrella, green hat, pink balloon"
out: ["striped red umbrella", "green hat", "pink balloon"]
```

## 规则

- 永远不要将超过8个词的句子传递给SAM 3——超过此长度准确率会下降。
- 当话语不包含可提取的具体名词时，不要运行SAM 3；返回警告并要求澄清。
- 不要在被引号包围的字符串内按标点分割；如果`"black and white cat"`被引号包围，则保留为一个概念。
- 始终记录原始话语和派生概念，用于生产调试。
