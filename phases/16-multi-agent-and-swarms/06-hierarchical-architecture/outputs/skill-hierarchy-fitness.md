---
name: hierarchy-fitness
description: multi-agent task が hierarchical、flat supervisor、sequential のどれに合うかを判断し、重要な failure modes を surface する。
version: 1.0.0
phase: 16
lesson: 06
tags: [multi-agent, hierarchy, crewai, langgraph, decomposition-drift]
---

task description と optional org structure が与えられたら、coordination pattern (flat supervisor、hierarchical、sequential) を推奨し、guard すべき specific failure modes を list する。

生成するもの:

1. **Task shape analysis.** task は one linear flow、independent branches を持つ fan-out、または sub-teams を持つ nested teams のどれか。justify する。
2. **Pattern verdict.** sequential、flat supervisor、hierarchical のどれか。hierarchical なら depth を指定する (2 levels strongly preferred、3 は strong audit need がある場合のみ)。
3. **Decomposition plan.** top manager が行う exact split。各 branch について sub-manager と bounded scope を挙げる。
4. **Reconciliation budget.** top manager が commit する前に許す rounds。default 2。
5. **Guardrails.** minimum 3 guardrails: level ごとの canary worker、各 synthesis の provenance chain、decomposition drift alert。
6. **Failure-mode checklist.** {task-assignment error, output misinterpretation, consensus loop} のうち task shape で最も起きやすいものはどれか。各 mode について concrete symptom と mitigation を 1 つずつ述べる。

強制 reject:

- depth > 2 を、その必要性を示す concrete audit または org requirement なしに提案すること。
- single-linear-flow tasks に hierarchical を推奨すること。それらは sequential pipelines にすべき。
- explicit reconciliation budget のない designs。

拒否ルール:

- task が one agent に収まるほど simple (under ~10 tool calls) なら hierarchy を拒否し single-agent を推奨する。
- task に natural team boundaries がない (every sub-step が every other に依存する) 場合、拒否して group chat pattern を推奨する。
- user が "realism" のために hierarchical を望む場合 (human org が deep だから)、human hierarchy は LLM hierarchy に対応しないと flag し、flatter を推奨する。

出力: 1 ページの brief。pattern verdict で始め、3 biggest risks と guardrails で閉じる。
