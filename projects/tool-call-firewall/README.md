# Tool Call Firewall

An approval receipt proving exactly which operation was authorized and executed.

The caller application supplies identity; the model supplies only a proposed operation. The compact Rust envelope carries a stable request id, role, tool and relative argument without ambiguous delimiters or controls.

## Start with a learner workspace

[Tool schema design](../../phases/13-tools-and-protocols/05-tool-schema-design/docs/en.md), [Security and secrets audit](../../phases/17-infrastructure-and-production/25-security-secrets-audit/docs/en.md). Language foundation: [Rust ownership and Result](https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html).

Install Rust (`rustc`) and Python 3.10+. The core uses the Rust standard library; Python adapters compile into private temporary directories.

```bash
python3 scripts/project_test.py tool-call-firewall --init learning-artifacts/tool-call-firewall
python3 scripts/project_test.py tool-call-firewall --stage 1 --path learning-artifacts/tool-call-firewall
```

## Build route

1. [Validate an unambiguous call envelope](stages/01-validate-an-unambiguous-call-envelope/docs/en.md)
2. [Evaluate role and path policy](stages/02-evaluate-role-and-path-policy/docs/en.md)
3. [Consume a request-bound approval once](stages/03-consume-a-request-bound-approval-once/docs/en.md)
4. [Record bounded audit evidence](stages/04-record-bounded-audit-evidence/docs/en.md)

## Run with your own inputs

After completing the stages, these commands run your workspace code on the original Orchard examples. Replace the sample paths with your own files.

```bash
rustc --edition=2021 learning-artifacts/tool-call-firewall/cli.rs -o learning-artifacts/tool-call-firewall/firewall
learning-artifacts/tool-call-firewall/firewall projects/tool-call-firewall/examples/workspace reader r1 read notes.md
```

To inspect the complete reference first, replace `learning-artifacts/tool-call-firewall` with `projects/tool-call-firewall/solution` in the same command. JSON results use `schema_version: 1`; paths and argument examples are explicit so another tool can consume them.

## Integration boundary

The native CLI requires a trusted role from the invoking application. Reads and writes pass through dispatch, which validates canonical containment and binds writes to exact content. Approvals are single-use in memory within one invocation. The code is a file-tool enforcement example, not a persistent cross-process authority or OS sandbox.

```bash
python3 scripts/project_test.py tool-call-firewall --all --solution --strict
python3 scripts/project_test.py tool-call-firewall --all --path learning-artifacts/tool-call-firewall --strict
```

The first command checks the reference. The second checks your implementation. The published examples and tests are regression evidence, not a production certification or an unseen benchmark.

## Primary references

- [Official reference](https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices)
