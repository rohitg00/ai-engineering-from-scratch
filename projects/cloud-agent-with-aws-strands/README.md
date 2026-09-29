# Cloud Agent With AWS Strands

A scoped cloud incident reader with an execution receipt for every cache hit and retry.

Python 3.10+; JSON, sets, exceptions, callbacks and environment configuration. Optional SDK comparisons use requirements-framework.txt. The core uses standard libraries. The grader checks your selected workspace; it never fills in missing behavior from the reference.

## Build and run your version

From the repository root, initialize once. A fresh starter fails intentionally.

```bash
python3 scripts/project_test.py cloud-agent-with-aws-strands --init learning-artifacts/cloud-agent-with-aws-strands
python3 scripts/project_test.py cloud-agent-with-aws-strands --stage 1 --path learning-artifacts/cloud-agent-with-aws-strands --strict
```

Implement each stage, then run the cumulative grader and the supplied input driver:

```bash
python3 scripts/project_test.py cloud-agent-with-aws-strands --all --path learning-artifacts/cloud-agent-with-aws-strands --strict
cd learning-artifacts/cloud-agent-with-aws-strands
python3 cli.py samples/input.json --output incident.json
```

The driver and offline samples are provided scaffolding. Its imports resolve to your implementation. Public input types and function signatures live in the starter and [API contract](API.md).

## Inspect the reference separately

From the repository root:

```bash
python3 scripts/project_test.py cloud-agent-with-aws-strands --all --solution --strict
cd projects/cloud-agent-with-aws-strands/solution
python3 cli.py samples/input.json --output incident.json
```

## Observe the change

Three planned reads produce three retained results but only two provider reads because repeated metrics.read uses the request-local cache. The receipt exposes both calls and reuse.

Edit a copy of the sample and rerun the command. Keep the input beside the output so someone else can reproduce the result; the supplied samples are authored teaching data.

## Integration and limits

Import run(payload, provider). The provider receives only a validated operation and scoped resource. The optional Strands model proposes a plan; it never bypasses the deterministic validator.

Default mode reads the supplied recording. --mode aws is an opt-in AWS CLI adapter for ECS services, CloudWatch CPU and bounded log reads; it requires caller configuration, credentials and AWS permissions. No deployment or live verification is implied.

## Stages

1. [Validate a scoped cloud inspection plan](stages/01-plan/docs/en.md)
2. [Execute reads within step and response budgets](stages/02-executor/docs/en.md)
3. [Retry transient reads and reuse completed requests](stages/03-retry/docs/en.md)
4. [Drive the actual Strands loop with a local model](stages/04-strands-adapter/docs/en.md)

## Optional framework integration

The baseline stages use only the standard library. The framework adapter is implemented and has a separate smoke test that uses the real installed SDK with a local fake model. It never contacts a cloud service.

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r projects/cloud-agent-with-aws-strands/requirements-framework.txt
.venv/bin/python scripts/project_test.py cloud-agent-with-aws-strands --solution --optional --strict
.venv/bin/python projects/cloud-agent-with-aws-strands/solution/framework_demo.py
```

The integration was verified against `strands-agents==1.57.1`. The cloud-provider path, where present, remains opt-in and requires your own environment credentials; no cloud deployment is performed.

The default grader covers the offline core and input integration. `--optional` adds 5 tests that use the real SDK and a deterministic local model. A missing SDK is reported as SKIP with an install hint; `--optional --strict` fails when the dependency is missing. Passing only the default tests does not claim framework verification.

## Primary references

[Strands custom model providers](https://strandsagents.com/docs/user-guide/concepts/model-providers/custom_model_provider/) explains the optional deterministic model adapter.

## Configure the optional AWS reader

Before --mode aws, add an aws object keyed by each scoped service. Every entry needs region. inventory.list and metrics.read also need cluster; logs.read needs log_group. metrics.read requires start and end as timezone-aware ISO timestamps, such as 2026-01-01T00:00:00Z and 2026-01-01T01:00:00Z. logs.read accepts the same optional pair, converted to epoch milliseconds for --start-time and --end-time. Omitting both preserves an unwindowed log read; supplying only one is an error. Both operations reject invalid, timezone-free, pre-epoch or non-increasing windows. The adapter issues ECS describe-services, CloudWatch get-metric-statistics for CPUUtilization and Logs filter-log-events with limit 20.

Credentials come from the AWS CLI's environment or configured credential chain. Scope validation does not replace IAM: configure permission for only the intended reads and service resources. Region and time window are caller configuration, not model-supplied executable arguments. Each CLI call has a ten-second timeout; only timeout errors are retried.
