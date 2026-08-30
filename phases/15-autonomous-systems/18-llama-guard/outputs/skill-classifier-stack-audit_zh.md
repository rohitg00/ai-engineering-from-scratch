---
name: classifier-stack-audit
description: 审计部署的输入/输出分类器栈（model、taxonomy、input rails、output rails、dialog rails），并标记对抗性攻击差距。
version: 1.0.0
phase: 15
lesson: 18
tags: [llama-guard, nemo-guardrails, input-rails, output-rails, colang, adversarial-attacks]
---

给定部署的分类器栈（Llama Guard version、NeMo Guardrails config、custom classifiers、normalization steps），针对 2026 参考进行审计，并标记栈未覆盖的攻击面。

生成：

1. **模型清单。** 列出使用的分类器。Llama Guard 3 (8B / 1B-INT4) 与 Llama Guard 4 (multimodal、S1–S14)。NeMo Guardrails version。任何 custom classifiers。如果部署接受图像，确认分类器是 multimodal。
2. **分类法映射。** 将声明的业务类别映射到分类器的分类法。Operator 关心的每个类别必须映射到分类器类别；未映射的类别不受保护。
3. **Rail 覆盖。** 确认 input rails 在模型轮次之前触发，output rails 在响应发出之前触发。Dialog rails（NeMo 中的 Colang）强制执行跨轮次约束。单轮分类器无法捕获多轮攻击。
4. **规范化。** 确认输入在分类之前是 NFKC-normalized、homoglyph-mapped，并剥离 zero-width / variation-selector 字符。Raw-byte 分类是 Emoji Smuggling (Huang et al. 2025) 的 100% ASR 目标。
5. **攻击语料库覆盖。** 对于每个记录的攻击（emoji smuggling、homoglyph、in-context redirection、semantic paraphrase），命名栈中的特定防御。仅分类器防御未通过此审计；与 Constitution（Lesson 17）和运行时（Lessons 10、13、14）的分层是必需的。

硬性拒绝：
- 在 multimodal 输入上使用仅文本分类器的部署。
- 没有规范化步骤的部署。
- 仅有 input rails 的部署（敏感类别输出上没有 output rails）。
- 将分类器视为单一安全层的栈。
- Operator 无法在其自己的分布上重现的 ASR 声明。

拒绝规则：
- 如果用户声明的类别未映射到分类器的分类法，拒绝并要求先进行映射。Unmapped = unguarded。
- 如果部署在 multimodal 输入表面上引用 Llama Guard 3 ASR 数字，拒绝并要求 Llama Guard 4 或 multimodal 分类器。
- 如果用户将分类器层视为高风险设置中足够的，拒绝。EU AI Act Article 14（Lesson 15）期望人类监督之上。

输出格式：

返回分类器审计，包含：
- **模型清单**（name、version、modality）
- **分类法映射**（operator category → classifier category）
- **Rail 覆盖**（input / output / dialog；在模型之前/之后触发）
- **规范化注释**（NFKC y/n、homoglyph y/n、zero-width strip y/n）
- **攻击语料库覆盖**（attack → defense）
- **层完整性**（classifier + constitution + runtime；三个必需）
- **准备度**（production / staging / research-only）
