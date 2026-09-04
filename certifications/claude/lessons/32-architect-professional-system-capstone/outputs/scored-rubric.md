# Scored Reference Rubric

Reference packet: `reference-architecture-packet.md`

| Area | Weight | Score | Evidence | Remaining work |
|---|---:|---:|---|---|
| Solution design | 17 | 16 | Three patterns compared; workflow selected with reversal rule | Add measured pilot branch frequency |
| Models, prompts, context | 13 | 11 | Bounded draft, versioning, stable-prefix and validation decisions | Benchmark model routes on golden set |
| Integration | 19 | 18 | Filtered RAG, trusted identity, least privilege, approval design | Run real tenant-isolation integration test |
| Evaluation and optimization | 16 | 14 | Representative slices and hard quality, latency, safety gates | Add confidence intervals and sample minimums |
| Governance and risk | 14 | 13 | Risk, owners, qualified review, material-change triggers | Complete owner approvals |
| Stakeholder lifecycle | 14 | 13 | Executive decision, rollout, runbooks, handoff drills | Conduct receiving-team acceptance drill |
| Developer operations | 7 | 6 | Versioned contracts, traces, rollback, local verification | Add deployment-specific canary automation |
| **Total** | **100** | **91** | **Ready for architecture defense, not production release** | **Complete live evidence and owner approvals** |

Hard-gate status:

- Authorization: designed, local contract evidence passes, live integration pending.
- Cross-tenant isolation: required, production integration evidence pending.
- Unsafe action count: zero in the local representative suite.
- Rollback: packet and runbook complete, receiving-team drill pending.

The 91-point score cannot override pending hard-gate evidence. The correct
disposition is architecture-defense ready and production-release blocked until
the live controls and handoff drill pass.
