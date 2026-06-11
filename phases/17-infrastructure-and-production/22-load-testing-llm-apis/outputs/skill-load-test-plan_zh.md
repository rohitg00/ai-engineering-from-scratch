---
name: load-test-plan
description: 设计真实的 LLM 负载测试——选择工具（LLMPerf、k6、GenAI-Perf、guidellm）、构建四种模式（稳定、斜坡、尖峰、浸泡）并在 CI 中门控。
version: 1.0.0
phase: 17
lesson: 22
tags: [load-testing, llmperf, k6, genai-perf, guidellm, llm-locust, ci-gate]
---

给定工作负载（端点、TTFT/TPOT/错误的 SLA）、目标规模（并发、RPS）和 CI 态势（PR 门控或仅发布），生成负载测试计划。

生成：

1. 工具。基线运行用 LLMPerf；CI 门控用 k6 + 流式扩展；NVIDIA 参考运行用 GenAI-Perf；大型合成用 guidellm。仅当已在 Locust 上时用 LLM-Locust。
2. 提示分布。真实流量的输入 token 均值 + 标准差（如果可用）或已发布分布（ShareGPT / HumanEval）。禁止单提示循环。
3. 四种模式。Steady、ramp、spike、soak。对于每个：目标 RPS、持续时间、预期失败模式。
4. CI 门控。具体阈值：TTFT P95 < X、5xx < 5%、TPOT < Y。每次 PR 运行时间：3-5 分钟。
5. 指标对齐。注意报告工具是 GenAI-Perf 风格（ITL 排除 TTFT）还是 LLMPerf 风格（ITL 包含 TTFT）。选择一个并保持一致。
6. 输出。提交到仓库的脚本文件（k6 JS、LLMPerf CLI）。

硬性拒绝：
- 使用统一提示的负载测试。拒绝——数字会撒谎。
- 没有流式支持的负载测试。拒绝——LLM 端点默认是流式。
- 未承认指标定义差异就跨工具比较数字。拒绝。

拒绝规则：
- 如果团队打算在没有 LLM-Locust 扩展的情况下在 Locust 上运行，拒绝——GIL 陷阱。
- 如果 CI 门控预算 < 每次 PR 60 秒，拒绝完整 soak——提议快速稳态加单独夜间 soak。
- 如果提示分布数据不可用，要求记录的已发布分布（ShareGPT）并注明假设。

输出：一页计划，包含工具、提示分布、带目标的四种模式、CI 门控阈值、指标对齐。以单一 CI 输出结束：仅当所有阈值满足、3 次运行稳定时 PR 才通过。
