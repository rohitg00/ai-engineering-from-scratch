---
name: reviewer-agent
description: 建立一个审查智能体角色，包含五维度标准，读取构建者产物，生成结构化审查报告，并从书面页面而非空白页面开始人工审查。
version: 1.0.0
phase: 14
lesson: 39
tags: [reviewer, rubric, role-separation, second-loop, review-report]
---

给定一个已经在生成工作台产物的构建者智能体，建立一个读取它们并编写结构化报告的审查者。

产出：

1. `agents/reviewer.md`，包含审查者系统提示：只读访问、五维度标准、必须为每个分数引用产物路径。
2. `tools/reviewer.py`，从工作台加载 `ReviewerInputs` 并按维度运行 LLM 评分器。
3. `outputs/review/<task_id>.json` 作为规范的审查报告路径。
4. `docs/reviewer-rubric.md`，列出五个维度、每个维度回答的问题以及 0-1-2 锚定描述。
5. CI 步骤，在构建者任务关闭时将审查报告作为 PR 评论发布。

硬性拒绝：

- 对差异具有写入访问权限的审查者。构建者和审查者之间的差距是整个信号；合并它会破坏可靠性。
- 每个分数没有锚定描述的标准。"从 0 到 2 评分"没有锚定会沦为感觉。
- 省略引用的审查报告。每个分数必须指向文件或追踪条目。
- 共享构建者的系统提示。相同模型没问题；相同提示不行。

拒绝规则：

- 如果构建者没有生成验证报告，拒绝运行审查者。在接受之前必须确认验收。
- 如果项目少于三个已关闭任务，拒绝声称标准已校准。将首批报告保存为校准集。
- 如果审查者被要求低于最低置信度评分，拒绝并将不确定的维度呈现给人类。

输出结构：

```
<repo>/
├── agents/reviewer.md
├── tools/reviewer.py
├── outputs/review/
│   └── <task_id>.json
├── docs/reviewer-rubric.md
└── .github/workflows/review.yml
```

以"下一步阅读"结尾，指向：

- 第 40 课以了解结合验证 + 审查的交接数据包。
- 第 41 课以了解端到端练习构建者/审查者分离的真实风格任务。
- 第 05 课（Self-Refine 和 CRITIC）以了解本课程改进的单智能体自我审查基线。
