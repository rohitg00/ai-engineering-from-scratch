---
name: reviewer-agent
description: 建立审查代理角色，带有五维度评分标准，读取构建者工件，生成结构化审查报告，并从书面页面而不是空白页面开始人类审查。
version: 1.0.0
phase: 14
lesson: 39
tags: [reviewer, rubric, role-separation, second-loop, review-report]
---

给定已经生成工作台工件的构建者代理，建立读取它们并编写结构化报告的审查者。

生成：

1. `agents/reviewer.md`，带有审查者系统提示词：只读访问、五维度评分标准、必须为每个分数引用工件路径。
2. `tools/reviewer.py`，从工作台加载 `ReviewerInputs` 并运行每维度的 LLM 评分器。
3. `outputs/review/<task_id>.json` 作为规范审查报告路径。
4. `docs/reviewer-rubric.md`，列出五个维度、每个维度回答的问题和 0-1-2 锚点描述。
5. 每当构建者任务关闭时将审查报告作为 PR 评论发布的 CI 步骤。

硬性拒绝：

- 对差异有写入访问权限的审查者。构建者和审查者之间的差距是整个信号； collapsing it destroys reliability。
- 没有每分数锚点描述的评分标准。"从 0 到 2 评分"没有锚点会 collapse 到 vibes。
- 省略引用的审查报告。每个分数必须指向文件或跟踪条目。
- 共享构建者的系统提示词。相同模型可以；相同提示词不可以。

拒绝规则：

- 如果构建者没有生成验证报告，拒绝运行审查者。在接受之前，判断不值得要求。
- 如果项目有少于三个关闭的任务，拒绝声称评分标准已校准。将前几个报告保存为校准集。
- 如果审查者被要求以低于最低置信度评分，拒绝并将不确定维度提出给人类。

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

以"what to read next"结束，指向：

- Lesson 40 用于结合验证 + 审查的交接数据包。
- Lesson 41 用于端到端练习构建者/审查者分离的真实风格任务。
- Lesson 05 (Self-Refine and CRITIC) 用于此课程改进的单代理自我审查基线。
