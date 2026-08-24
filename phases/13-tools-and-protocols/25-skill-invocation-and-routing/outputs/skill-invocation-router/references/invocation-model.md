# Invocation model

| Channel | Initiator | Selection | Typical use |
|---|---|---|---|
| Explicit human | User | Exact discovered name | Deliberate workflow choice |
| Implicit model or agent | Model or autonomous agent | Description relevance plus host policy | Context-sensitive routing |
| Programmatic application | Product runtime | Exact configured name and target allowlist | Deterministic product workflow |
| Skill composition | Another skill or subagent | Exact target, caller identity, and depth policy | Bounded workflow dependency |
| Programmatic harness | Evaluation runtime | Exact configured name and target allowlist | Deterministic evaluation |

Human and model activation form a 2x2: neither, human only, model only, or both. Application, composition, and harness activation are separate channels with their own target, caller, and depth policies.

For implicit routing, apply actor and host-extension eligibility before relevance ranking. A blocked high-scoring skill is not the winner; remove it from the selection set and evaluate the remaining eligible candidates. Abstain if the eligible set is empty or its best score misses the threshold.

Fields such as `user-invocable` or `disable-model-invocation` may be meaningful to a particular host. An adapter may enforce them, but portable documentation must not claim that every runtime recognizes the same fields or values.
