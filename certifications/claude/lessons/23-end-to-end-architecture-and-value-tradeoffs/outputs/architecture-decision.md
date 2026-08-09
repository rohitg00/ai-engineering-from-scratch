# ADR: Contract Review Pattern

## Decision

Select a deterministic workflow: intake, segmentation, versioned retrieval,
analysis, independent evidence review, redline generation, and counsel approval.
Owner: legal technology architecture.

## Candidate Scores

The augmented call is fastest but loses failure isolation. The workflow leads on
safety, auditability, and predictable latency. The adaptive agent leads only on
unmodeled branching. Multi-agent review adds independence but not write authority.

## Hard Gates

Authorization, tenant isolation, source provenance, and safety cannot be averaged
against convenience. Any unsupported material conclusion blocks the candidate.

## Failure Paths

Retrieval timeout returns partial evidence and no redline. Policy conflict routes
to counsel. Invalid schema receives one targeted repair. Tool outage uses the
manual review queue. Rollback restores the prior index and workflow version.

## Rejected Alternatives

Reject one giant augmented call because responsibilities and evidence collapse.
Reject an adaptive execution agent because the process is known and actions
require human authority.

## Reversal Condition

Reconsider the workflow if more than 20 percent of accepted cases require safe,
unmodeled evidence discovery and an evaluated agent improves success without
breaking cost, latency, or hard gates. The architecture owner approves reversal.
