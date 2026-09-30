# Report residual assumptions

**Stage 4 of 4.** Rust. Plan about 2 hours.

Return the selected fixture and state clearly that operating-system enforcement has not been performed. List shared-kernel and enabled-network residuals from the selected controls, and reject a profile that fails the original requirements. The report is an input to deployment review.

```figure
pj-sandbox-ladder-4
```

## Implementation boundary

```rust
pub fn plan(n:&Needs,p:&Profile)->Result<String,Error>
```

Primary reference: [Official reference](https://docs.docker.com/engine/security/).

## Worked Orchard case

Before coding, review [Rust ownership and Result](https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html) and [Docker for AI](../../../../../phases/00-setup-and-tooling/07-docker-for-ai/docs/en.md). Complete [stage 3](../../03-select-the-least-costly-sufficient-profile/docs/en.md) first.

The optional Docker adapter produces an inspectable argument list and only runs a caller-selected image already present locally. Its harmless probes test a denied root write and absence of a default route. No microVM implementation is included.

```text
--docker-image alpine:local -> command preview
--execute -> docker_probe with observed stdout
shared host kernel remains a residual
```

## Build and inspect

Keep policy_simulation and docker_probe results distinct. A successful probe is evidence for those checks only, not proof against container escape.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py sandbox-ladder --stage 4 --path learning-artifacts/sandbox-ladder
```

After the cumulative stages pass, run your artifact on the original sample input from the repository root:

```bash
python3 learning-artifacts/sandbox-ladder/cli.py untrusted=true,secrets=true,network=true,host_kernel=false --budget 3
```

Default output is a policy simulation. --docker-image previews an invocation; --execute requires an already available local image and Docker. Only root-write and default-route probes are tested. The adapter never implements or verifies a microVM boundary.

## Investigate next

If root_write becomes allowed, which runtime setting would you inspect first?
