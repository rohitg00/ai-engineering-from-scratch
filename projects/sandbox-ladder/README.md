# Sandbox Policy Planner

A sandbox evidence planner mapping requested capabilities to observed runtime probes.

Write the threat requirement as booleans before selecting a runtime. Here network=true means network denial is required, and host_kernel=true means a separate kernel is required. Neither name grants access.

## Start with a learner workspace

[Docker for AI](../../phases/00-setup-and-tooling/07-docker-for-ai/docs/en.md), [Security and secrets audit](../../phases/17-infrastructure-and-production/25-security-secrets-audit/docs/en.md). Language foundation: [Rust ownership and Result](https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html).

Install Rust (`rustc`) and Python 3.10+. The core uses the Rust standard library; Python adapters compile into private temporary directories.

```bash
python3 scripts/project_test.py sandbox-ladder --init learning-artifacts/sandbox-ladder
python3 scripts/project_test.py sandbox-ladder --stage 1 --path learning-artifacts/sandbox-ladder
```

## Build route

1. [Parse the capability request](stages/01-parse-the-capability-request/docs/en.md)
2. [Define modeled control profiles](stages/02-define-modeled-control-profiles/docs/en.md)
3. [Select the least costly sufficient profile](stages/03-select-the-least-costly-sufficient-profile/docs/en.md)
4. [Report residual assumptions](stages/04-report-residual-assumptions/docs/en.md)

## Run with your own inputs

After completing the stages, these commands run your workspace code on the original Orchard examples. Replace the sample paths with your own files.

```bash
python3 learning-artifacts/sandbox-ladder/cli.py untrusted=true,secrets=true,network=true,host_kernel=false --budget 3
```

To inspect the complete reference first, replace `learning-artifacts/sandbox-ladder` with `projects/sandbox-ladder/solution` in the same command. JSON results use `schema_version: 1`; paths and argument examples are explicit so another tool can consume them.

## Integration boundary

Default output is a policy simulation. --docker-image previews an invocation; --execute requires an already available local image and Docker. Only root-write and default-route probes are tested. The adapter never implements or verifies a microVM boundary.

```bash
python3 scripts/project_test.py sandbox-ladder --all --solution --strict
python3 scripts/project_test.py sandbox-ladder --all --path learning-artifacts/sandbox-ladder --strict
```

The first command checks the reference. The second checks your implementation. The published examples and tests are regression evidence, not a production certification or an unseen benchmark.

## Primary references

- [Official reference](https://docs.docker.com/engine/security/)
