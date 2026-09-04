# Order Status Assistant Runbook

## Service Objective

Return a verified order status or a clear escalation without exposing secrets, crossing tenant boundaries, or performing mutation.

## First Response

1. Identify the trace or request ID.
2. Classify the failure before retry.
3. Confirm whether any tool executed.
4. Inspect authoritative order state.
5. Contain affected capability when security or cross-tenant access is possible.

## Failure Classes

### Missing or malformed order ID

- Response: request an exact public ID.
- Retry: user-driven only.
- Verify: no lookup tool ran.

### Provider timeout before complete response

- Response: mark attempt incomplete.
- Retry: once with bounded backoff if no tool side effect occurred.
- Verify: inspect trace for complete terminal event and tool operations.

### Rate limit

- Response: queue or return a clear temporary-unavailability state within the service objective.
- Retry: follow provider guidance with bounded backoff.
- Verify: no duplicate tool operation.

### Protocol or schema error

- Response: do not display partial output as final.
- Retry: only after reconstructing valid message state or within the bounded structured-output repair policy.
- Verify: contract tests and wire trace identify the repaired boundary.

### Policy denial

- Response: preserve denial and explain the safe next step.
- Retry: only after valid external approval or corrected low-risk request.
- Verify: forbidden tool did not execute.

### Order not found

- Response: do not guess status; escalate to the approved support path.
- Retry: only with corrected authenticated identifier.
- Verify: lookup used current user's authorized order scope.

### Tool unavailable

- Response: state that status cannot currently be verified.
- Retry: one bounded read-only retry or queue according to service objective.
- Verify: no fabricated status appears.

### Security incident or secret exposure

- Contain: disable affected tool, MCP server, plugin, hook, or network path.
- Revoke: rotate any potentially exposed credential immediately.
- Investigate: preserve redacted traces and query authoritative access logs.
- Recover: fix the failed trust boundary and add the fixture to security evals.
- Restore: canary with least privilege and active monitoring.

### Regression after model or configuration change

- Contain: roll back model, prompt, schema, tool, Skill, hook, plugin, or server version.
- Diagnose: compare paired eval cases and traces.
- Recover: address the specific failing boundary.
- Verify: full required and safety suites pass before rollout resumes.

## Ambiguous Mutation Rule

The current application is read-only. If future versions add mutation, never retry an ambiguous timeout until a stable idempotency key and system-of-record reconciliation prove whether the first attempt completed.

## Escalation Evidence

Provide the operator with trace ID, failure class, order ID if permitted, component versions, policy decision, tool result class, and current authoritative state. Do not include raw credentials, full private content, or unrestricted prompts.

