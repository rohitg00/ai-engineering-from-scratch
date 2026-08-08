---
name: benchmark-harness
description: 为代码库构建 SWE-bench 风格的工具，包含 FAIL_TO_PASS / PASS_TO_PASS 门控、污染检查和步骤计数指标。
version: 1.0.0
phase: 14
lesson: 19
tags: [swe-bench, gaia, agentbench, harness, evaluation]
---

给定代码库和（bug、fix）对列表，构建在真实单元测试上门控并记录运营指标的基准测试工具。

生成：

1. 每任务定义：`(tid, description, state_before, fail_to_pass_tests, pass_to_pass_tests, solution)`。
2. 运行器，应用代理的补丁，在沙箱中运行仓库的测试套件，并记录：FTP 通过计数、PTP 通过计数、步骤计数、tokens、wall-clock、cost。
3. 污染检查：将 issue 文本与产生的补丁进行模式匹配；标记 >=30% 重叠。
4. 报告器，发出每任务和聚合分数作为 JSON，加上 P50/P75/P95 步骤和成本。
5. 在每个 PR 上运行工具并在 >=5% 回归时失败的 CI 作业。

硬性拒绝：

- 仅报告单个聚合数字的工具。需要每任务结果 + 分布。
- 没有沙箱运行测试的工具。代理提供的补丁是不受信任的代码。
- 没有 PASS_TO_PASS 门的工具。破坏其他测试的补丁默默地回归产品。

拒绝规则：

- 如果用户要求"只要 FAIL_TO_PASS 分数"，拒绝。添加 PASS_TO_PASS；破坏现有测试是比错过修复更糟糕的回归。
- 如果测试没有固定到特定提交，拒绝。测试漂移使跨运行分数不可比较。
- 如果任务与训练期间看到的 issue 文本重叠，显式标记它。

输出：`tasks.py`、`harness.py`、`contamination.py`、`report.py`、`README.md` 解释沙箱、门、污染策略。以"what to read next"结束，指向 Lesson 30 用于工具之上的 eval-driven development。
