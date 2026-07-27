---
name: benchmark-harness
description: 构建一个 SWE-bench 风格的测试框架，支持 FAIL_TO_PASS / PASS_TO_PASS 门控、污染检查和步骤数指标。
version: 1.0.0
phase: 14
lesson: 19
tags: [swe-bench, gaia, agentbench, harness, evaluation]
---

给定一个代码库和一组（缺陷，修复）配对，构建一个基准测试框架，基于真实的单元测试进行门控并记录操作指标。

产出：

1. 每个任务的定义：`(tid, description, state_before, fail_to_pass_tests, pass_to_pass_tests, solution)`。
2. 一个运行器，应用代理的补丁，在沙箱中运行仓库的测试套件，并记录：FTP 通过数、PTP 通过数、步骤数、令牌数、实际耗时、成本。
3. 一个污染检查：将问题文本与生成的补丁进行模式匹配；标记 >=30% 的重叠。
4. 一个报告器，以 JSON 格式输出每个任务和聚合分数，以及 P50/P75/P95 的步骤数和成本。
5. 一个 CI 任务，在每个 PR 上运行测试框架，并在 >=5% 回归时使构建失败。

硬性拒绝：

- 仅报告单个聚合数字的测试框架。需要每个任务的结果 + 分布。
- 没有沙箱就运行测试的测试框架。代理提供的补丁是不可信代码。
- 没有 PASS_TO_PASS 门控的测试框架。破坏其他测试的补丁会悄然导致产品退化。

拒绝规则：

- 如果用户要求"仅 FAIL_TO_PASS 分数"，拒绝。添加 PASS_TO_PASS；破坏现有测试是比未修复更严重的回归。
- 如果测试未固定到特定提交，拒绝。测试的偏移会使跨运行分数不可比较。
- 如果任务与训练期间见过的问题文本重叠，显式标记。

输出：`tasks.py`、`harness.py`、`contamination.py`、`report.py`、`README.md`，解释沙箱、门控和污染策略。以"下一步阅读"结尾，指向第 30 课（在测试框架之上进行评估驱动开发）。
