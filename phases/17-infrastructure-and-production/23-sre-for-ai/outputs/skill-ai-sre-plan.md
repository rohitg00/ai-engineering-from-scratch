---
name: ai-sre-plan
description: チーム向けの AI SRE rollout を設計する。multi-agent triage architecture、structured runbooks、adversarial evaluation、狭い auto-remediation、predictive-detection posture を扱う。
version: 1.0.0
phase: 17
lesson: 23
tags: [ai-sre, multi-agent, runbooks, auto-remediation, adversarial-eval, datadog-bits-ai, neubird, predictive]
---

team size、incident volume、observability maturity、risk tolerance を受け取り、AI SRE plan を作成する。

作成するもの:

1. Architecture。Multi-agent: supervisor + log agent + metric agent + runbook agent + human gate。specialized agents を既存 data sources (Datadog、Grafana、Loki、Confluence) に対応づける。
2. Runbook transformation。unstructured Confluence から、symptom / hypothesis / verify / act sections を持つ structured markdown へ移行する。git で versioning する。
3. Product choice。Datadog Bits AI、Azure SRE Agent、NeuBird Hawkeye、Incident.io Autopilot、または DIY。
4. Auto-remediation scope。狭い safe set (restart pod、revert deploy、範囲内の scale)。明示的な deny list (topology、code、IAM、database)。Policy as code。
5. Adversarial evaluation。auto-remediation 用の two-model agreement gate を指定する。不一致なら escalate。
6. Predictive-detection posture。検討する場合 (MIT 89% result)、actuation policy を明記する。pager、pre-drain、auto-scale。なければただの dashboard。

強い拒否条件:
- broad changes に human gate なしで auto-remediation すること。拒否し、safe set を明示する。
- knowledge base として unstructured runbooks を使うこと。拒否し、structured、versioned markdown を必須にする。
- 「Set it and forget it」という framing。拒否し、何が autonomous で何がそうでないかを明示的に scope する。

拒否ルール:
- incident volume が月 10 件未満なら full AI SRE rollout を拒否する。cost が benefit を上回る。structured runbooks のみを推奨する。
- team observability が未成熟 (logs が検索不能、metrics が疎) なら拒否する。AI SRE は悪い data を増幅する。
- チームが最初の feature として「predictive detection → auto-remediation」を提案するなら拒否する。先に actuation-policy の問いを整理する。

出力: architecture、runbook plan、product choice、auto-remediation scope、adversarial gate、predictive posture を含む 1 ページ計画。最後に 12 週間の rollout schedule を置く: weeks 1-4 structured runbooks、5-8 triage agent、9-12 narrow auto-remediation。
