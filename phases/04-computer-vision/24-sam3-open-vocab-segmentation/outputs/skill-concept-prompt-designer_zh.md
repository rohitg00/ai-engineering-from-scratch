---
name: skill-concept-prompt-designer
description: 将用户话语转化为格式良好的 SAM 3 概念提示，包括分割、消歧和回退
version: 1.0.0
phase: 4
lesson: 24
tags: [sam3, open-vocab, prompt-engineering, segmentation]
---

# 概念提示设计器

SAM 3 的准确性在很大程度上取决于概念提示的表述方式。本技能将自由形式的用户话语归一化为 SAM 3 能够良好处理的提示。

## 使用时机

- 构建接受自然语言物体查询的 UI。
- 通过 API 公开 SAM 3，上游调用者发送句子。
- 调试 SAM 3 匹配不佳的情况——通常是提示格式错误，而非模型问题。

## 输入

- `utterance`：原始用户字符串。
- `context`：可选的领域提示（如 "surveillance" 监控、"medical" 医疗、"retail" 零售）。
- `max_concepts`：每条话语最多提取的概念数；默认为 5。

## SAM 3 偏好的规则

- **短名词短语，而非句子。** `"cat"` 优于 `"there is a cat"`。
- **具体名词。** `"skateboard"` 优于 `"thing to ride on"`。
- **修饰语紧挨在名词前。** `"red car"` 优于 `"car that is red"`。
- **小写。** SAM 3 虽然鲁棒，但经验上在小写输入上略好。
- **单数或复数。** 两者都可用；期望多个实例时复数有帮助。

## 步骤

1. **按常见分隔符分词**——逗号、分号、"and"、"or"、"&"。
2. **删除填充前缀**——"find"、"show me"、"segment"、"detect"、"locate"、"a"、"an"、"the"。
3. **仅保留视觉上的介词修饰语**——`"striped red umbrella"` 保留，`"umbrella from yesterday"` 不保留（"from yesterday" 不在图像中）。
4. **使用可选的 `context` 消歧冲突**：
   - 监控上下文中的 `"window"` -> `"building window"`。
   - 医疗上下文中的 `"window"` -> 通常是错误；建议用户澄清。
5. **回退**到确切的字符串，如果分割产生零个概念 *且* 话语包含至少一个具体名词。如果无法提取具体名词，则不输出概念——仅返回警告并请用户澄清（见规则）。
6. **限制在 `max_concepts` 以内。** 如果提取的概念数超过调用者要求的数量，保留话语顺序中的前 `max_concepts` 个，将其余部分以 `dropped` 输出，原因标注为 `"exceeded max_concepts"`。这可以在用户粘贴长枚举时保持延迟有界。

## 输出格式

```
[designed prompts]
  utterance:    <原始文本>
  concepts:     ["concept_1", "concept_2", ...]
  dropped:      ["filler_1", ...]
  warnings:     ["概念太抽象", "可能匹配多个类别", ...]

[sam3 calls]
  对每个概念运行：sam3.detect(image, concept)
  使用不同的概念标签合并每个检测的输出。
```

## 示例

```
in:  "can you find me a cat or two dogs?"
out: ["cat", "dogs"]
dropped: ["can you find me", "a", "or two", "?"]
note: "dogs" 保留复数形式，因为话语中说 "two dogs" — 复数提示被保留。

in:  "segment the big red truck and the blue sedan"
out: ["big red truck", "blue sedan"]
dropped: ["segment", "the", "and"]

in:  "thing near the door"
out: ["door"]
warnings: ["'thing' 对 SAM 3 来说太抽象；回退到 'door'"]

in:  "striped red umbrella, green hat, pink balloon"
out: ["striped red umbrella", "green hat", "pink balloon"]
```

## 规则

- 绝不要向 SAM 3 传递超过 8 个单词的句子——超出此长度准确率会下降。
- 当话语中不包含可提取的具体名词时，不运行 SAM 3；返回警告并要求澄清。
- 不要在引号内的字符串中按标点分割；如果 `"black and white cat"` 被引号包围，则将其保持为一个概念。
- 始终记录原始话语和派生概念，用于生产调试。
