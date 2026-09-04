# Tool Catalog Review: Support Evidence

## Catalog Boundary

The policy role receives active-policy search and source lookup. It receives no
account tool or write capability. Every tool has a tenant-aware execution scope.

## Tool Contracts

`search_active_policy`: use when a support policy governs the answer; do not use
for account facts or public research. `read_assigned_account`: use when the
authenticated case needs account facts; do not use for policy or other tenants.

## Error Matrix

Validation is retryable only after changed input. Authorization is non-retryable
until access or approval changes. A dependency timeout is retryable once and
preserves any partial result plus trace ID.

## Progressive Discovery

The starting surface exposes search for capability names allowed to the role.
Specialized definitions load only after scoped discovery; restricted names are
not revealed.

## Authorization

Discovery never grants execution. The service checks principal, tenant, current
scope, object ownership, and bound approval for every call.

## Selection Fixtures

Twelve fixtures cover policy versus account questions, public research, no-tool
answers, validation, authorization, conflict, timeout, and partial results.
