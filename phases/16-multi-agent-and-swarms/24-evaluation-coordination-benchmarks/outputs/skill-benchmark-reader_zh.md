---
name: benchmark-reader
description: 怀疑地阅读多代理基准声明。在基准选择、污染、基线、统计显著性、任务多样性和成本披露上为声明评分。
version: 1.0.0
phase: 16
lesson: 24
tags: [multi-agent, benchmarks, evaluation, SWE-bench, MARBLE]
---

给定已发布或内部的多代理基准性能声明，为声明评分并提出注意事项。

生成：

1. **基准 + 拆分识别。** 哪个基准（MARBLE、COMMA、MedAgentBoard、AgentArch、SWE-bench Pro、SWE-bench Verified、custom）？哪个拆分（full、held-out、contamination-cleaned）？未知拆分是取消资格。
2. **污染状态。** 基准是否在测试模型的训练截止后？如果基准早于训练截止，标记污染风险并折扣声明。
3. **基线质量。** Vs single-LLM、vs random、vs 先前的多代理工作。Vs untuned-same-system 不算数；它是消融，不是基线。
4. **统计显著性。** N 次试验、confidence interval 或 standard error、p-value 或等效。N < 50 次试验上没有统计数据的声明支持不足。
5. **任务多样性。** 一个任务、一个领域还是许多？单任务声明不意味着泛化。
6. **成本披露。** 每任务 token、每任务 wall-clock、每任务美元成本。20 倍成本的 90% 解决方案是商业决策；没有成本，声明不完整。
7. **字母等级 + 单句裁决。**

   - **A：** 所有六个检查通过；声明可能稳健。
   - **B：** 一个弱点；声明是合理的，带有注意事项。
   - **C：** 两个弱点；声明是提示性的，但需要复现。
   - **D：** 三个或更多弱点；声明不是证据。
   - **F：** 取消资格的问题（未披露拆分上的污染、没有统计数据、没有基线）。

硬性拒绝：

- 引用"SWE-bench"而不指定 Verified vs Pro 的声明。40+ 点的差距使这种模糊报告不可接受。
- 没有基线比较的声明。"我们的系统做 X%"是数字，不是结果。
- 基于少于 20 次试验的多代理系统声明。Variance 太高。
- 多代理系统的未报告成本声明。Coordination tax 是实质性的。

拒绝规则：

- 如果基准不公开可用且用户没有内部审计跟踪，无法分配等级。推荐发布评估工件。
- 如果声明来自当前正在同行评审的论文（arXiv preprint、未提交），作为预防措施降级一个字母等级，直到复现。
- 如果用户是要求审计的声明人自己，直接运行审计；标记声明何时尚未准备好发布。

输出：一页成绩卡。以单句摘要开头（"Grade: C — good benchmark choice, adequate baselines, but no contamination check and no cost disclosure."），然后是上述七个部分。以"如何提高等级"的优先列表结束。
