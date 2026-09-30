# Define modeled control profiles

**Stage 2 of 4.** Rust. Plan about 2 hours.

Model process, filesystem, container-network and microVM boundaries as data. A profile name alone proves nothing; match each required control against its boolean capability. The profiles deliberately assume correct operator configuration and leave deployment verification to a real runtime.

```figure
pj-sandbox-ladder-2
```

## Implementation boundary

```rust
pub fn profiles()->Vec<Profile>
pub fn satisfies(n:&Needs,p:&Profile)->bool
```

Primary reference: [Official reference](https://docs.docker.com/engine/security/).

## Worked Orchard case

Before coding, review [Rust ownership and Result](https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html) and [Docker for AI](../../../../../phases/00-setup-and-tooling/07-docker-for-ai/docs/en.md). Complete [stage 1](../../01-parse-the-capability-request/docs/en.md) first.

Profiles are modeled capabilities with illustrative costs. A process boundary has no filesystem or network isolation in this model; the container profile models both but shares its host kernel.

```text
process: filesystem=false, network=false, kernel=false
container: filesystem=true, network=true, kernel=false
```

## Build and inspect

Test requirements independently. A low cost is irrelevant when one required capability is absent.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py sandbox-ladder --stage 2 --path learning-artifacts/sandbox-ladder
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

Why is the model not evidence that a running container has these settings?
