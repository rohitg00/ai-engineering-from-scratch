# Discovery Brief: Billing Reply Pilot

## Outcome

Owner: support operations. Baseline median policy-correct first response is 11
minutes. Target is under 3 minutes during a six-week pilot, with zero
unsupported refund execution.

## Requirements

Draft a response from active policy and assigned account facts. Quality requires
valid policy support. Performance requires P95 below 8 seconds. Safety constraint:
refund execution remains outside the workflow.

## Data and Authority

Internal ticket and policy data are minimized. The support agent may read an
assigned case; only a finance-authorized human may approve a refund. No secrets
or unrelated customer records enter context.

## Measures

SLI: percentage of evaluated drafts supported by active policy. SLO: at least
98 percent over seven days. Also measure P95, cost per accepted draft, reviewer
minutes, stale-source rate, and unsafe-action count.

## Assumptions

Estimate: review time falls from four to two minutes; owner is support quality,
evidence is pilot timing, decision date is week two. Constraint: no customer
message is sent automatically. Preference: concise response format.

## Non-Goals

The first-release non-goal is autonomous sending, refunds, account closure,
employee ranking, and languages beyond English.
