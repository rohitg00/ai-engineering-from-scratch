---
name: compliance-matrix
description: customer geography、segment、contract scope をもとに LLM SaaS の required-framework matrix を作成し、SOC 2、HIPAA、GDPR、PCI-DSS、EU AI Act、Colorado AI Act、ISO 42001 に controls を map する。
version: 1.0.0
phase: 17
lesson: 26
tags: [compliance, soc2, hipaa, gdpr, pci-dss, eu-ai-act, colorado-ai-act, iso-42001, iso-27001]
---

customer geography (US / EU / Global、または specific US states)、segment (SaaS / healthcare / fintech)、contract scope (enterprise vs SMB)、current compliance state を受け取り、required-framework matrix を作成する。

作成するもの:

1. Required frameworks。達成すべき各 framework を rationale (geography、segment、customer profile) とともに列挙する。
2. Timeline。各 framework について current state (none / Type I / in audit / Type II) を示し、gap を明記する。
3. Cross-framework control mapping。各 required framework について、複数を満たす controls (access log、encryption、audit log、change mgmt) を特定する。
4. EU AI Act posture。product の risk tier (unacceptable / high / limited / minimal) を分類する。high-risk の場合、2026 年 8 月 2 日の enforcement date 前に conformity-assessment path を必須にする。
5. PII / PHI handling。real-time inference-layer redaction (Phase 17 · 25) を確認する。post-processing は GDPR-defensible ではない。PHI に触れるすべての AI vendors について BAA を確認する。
6. Audit tooling。cross-framework automation には Drata / Vanta / Secureframe。multi-framework scope では費用に見合う。

強い拒否条件:
- enterprise procurement に対して SOC 2 Type I を「SOC 2 compliant」と主張すること。拒否する。Type II が gate。
- BAA なしの provider に PHI を送ること。拒否する。HIPAA violation。
- GDPR posture として post-processing PII scrubbing を使うこと。拒否し、real-time を必須にする。

拒否ルール:
- product が EU users に提供され、GDPR Article 30 records がない場合、records が確立されるまで EU customers への ship を拒否する。
- product が Colorado residents に credit/employment/housing/education/essential services で提供される場合、launch 前に 2026 年 6 月 30 日 (SB25B-004 で修正された SB24-205 に基づく Colorado AI Act effective date) までに完了した impact assessment の evidence を必須にする。
- product が EU AI Act の high-risk で、team に conformity-assessment plan がない場合、named implementation partner なしに 2026 年 8 月 readiness を約束することを拒否する。

出力: required frameworks、current state、gaps、timeline、cross-framework controls、EU AI Act tier、PII posture、tooling を含む 1 ページ matrix。最後に 12-month roadmap を置く: framework-by-framework quarterly milestones。
