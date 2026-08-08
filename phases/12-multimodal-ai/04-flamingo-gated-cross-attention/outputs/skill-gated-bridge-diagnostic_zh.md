---
name: gated-bridge-diagnostic
description: 识别开放 VLM 配置中的 Flamingo 血统设计元素并诊断冻结/门控问题。
version: 1.0.0
phase: 12
lesson: 04
tags: [flamingo, idefics, openflamingo, gated-cross-attention, interleaved-inputs]
---

给定一个开放 VLM 检查点及其配置（层结构、交叉注意力计划、门控参数化、训练配方），识别它使用哪些 Flamingo 血统元素并诊断门控设置错误的常见症状。

生成：

1. 血统清单。标记 (Perceiver resampler Y/N、门控交叉注意力频率 M、tanh vs sigmoid 门控、alpha 初始值、LLM 冻结深度) 的存在。
2. 交错输入支持。解析模型期望的提示词格式；确认或否认对多图像、视频和 few-shot 上下文提示的支持。
3. 视觉 token 预算。计算每张图像成本：K 个潜在向量 x N 个交叉注意力插入点。与相同图像数下的 BLIP-2 风格单输入桥比较。
4. 门控诊断。给定训练损失曲线或基准退化，建议门控是否打开太快（失去文本能力）、太慢（未能使用视觉输入）或校准错误（视觉 token 竞争而非增强）。
5. 修复配方。具体参数修复：如果文本退化将 alpha 初始化更接近 0，提高门控参数的学习率，或在前 N 步冻结门控。

硬性拒绝：
- 在未检查 resampler 和门控计划的情况下将任何开放 VLM 视为"Flamingo"。Idefics2 放弃了 resampler；无限定地将其标记为 Flamingo 血统是错误的。
- 假设零初始化总能度过训练。一些开放复现使用小的非零初始化，以初始稳定性换取更快收敛。
- 声称门控交叉注意力严格优于单 BLIP-2 桥用于所有任务。在单图像 VQA 且小 LLM 上，额外的交叉注意力层是纯成本。

拒绝规则：
- 如果检查点的训练配方不公开，拒绝并解释为什么门控诊断需要知道门控计划。
- 如果调用者要求与 Gemini 或 Claude（专有）比较，拒绝——它们的门控机制未公开。
- 如果范围内的 VLM 是 early-fusion 模型（Chameleon、Emu3），拒绝——门控仅适用于 adapter 风格 VLM。

输出：一页诊断，包含血统清单、交错输入能力矩阵、token 预算、门控诊断和具体修复配方。以"接下来阅读什么"段落结尾，指向 Lesson 12.05 (LLaVA) 了解替代 projector 方法或 Lesson 12.11 (Chameleon) 了解 early-fusion 逃生舱。
