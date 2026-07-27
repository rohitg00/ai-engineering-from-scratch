---
name: load-test-plan
description: 设计真实的 LLM 负载测试——选择工具（LLMPerf、k6、GenAI-Perf、guidellm），构建四种模式（稳定、斜坡、尖峰、浸泡），并在 CI 中门控。
version: 1.0.0
phase: 17
lesson: 22
tags: [load-testing, llmperf, k6, genai-perf, guidellm, llm-locust, ci-gate]
---

给定工作负载（端点、TTFT/TPOT/错误的 SLA）、目标规模（并发数、RPS）和 CI 姿态（PR 门控或仅发布），生成负载测试方案。

输出：

1. **工具**。基线运行使用 LLMPerf；CI 门控使用 k6 + 流扩展；NVIDIA 参考运行使用 GenAI-Perf；大规模合成使用 guidellm。仅当已在用 Locust 时使用 LLM-Locust。
2. **提示分布**。输入 Token 的均值 + 标准差（如果可用，来自真实流量）或已发布的分布（ShareGPT / HumanEval）。禁止单提示循环。
3. **四种模式**。稳定、斜坡、尖峰、浸泡。每种：目标 RPS、持续时间、预期故障模式。
4. **CI 门控**。具体阈值：TTFT P95 < X、5xx < 5%、TPOT < Y。每次 PR 运行时间：3-5 分钟。
5. **指标对齐**。说明报告工具是 GenAI-Perf 风格（ITL 排除 TTFT）还是 LLMPerf 风格（ITL 包含 TTFT）。选择一种并保持一致。
6. **输出**。提交到仓库的脚本文件（k6 JS、LLMPerf CLI）。

**硬性拒绝条件：**
- 使用统一提示的负载测试。拒绝——数字说谎。
- 没有流支持的负载测试。拒绝——LLM 端点默认流式传输。
- 比较不同工具的数字而不承认指标定义差异。拒绝。

**拒绝规则：**
- 如果团队打算在没有 LLM-Locust 扩展的情况下使用 Locust 原版，拒绝——GIL 陷阱。
- 如果每次 PR 的 CI 门控预算 < 60 秒，拒绝完整浸泡——建议快速稳态加单独的夜间浸泡。
- 如果提示分布数据不可用，要求使用记录的已发布分布（ShareGPT）并说明该假设。

**输出**：一页方案，包含工具、提示分布、四种模式及目标、CI 门控阈值、指标对齐。最后给出单一 CI 输出：仅当所有阈值满足且 3 次运行稳定时 PR 为绿色。
