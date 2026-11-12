# Sources

> The manual ranks its sources by authority, with our own recorded runs first, and this page lists each kind and what the sections take from it.

The ranks match [how this manual was made](#s-ref-how-this-manual-was-made). When two sources disagree, the higher one wins and the section says so. Every source was read or recorded on 2026-11-12, one week after the release of Agent Substrate v1.0.0.

## The ranked sources

| Rank | Source | What the manual takes from it |
|---|---|---|
| 1 | our recorded runs on six clusters on four machines: five with Agent Substrate v1.0.0 and one with the Substrate distribution of kagent v1.0.0. Two of the six ran agentgateway v1.7.0 | every listing, and every number in a paragraph that starts with "We measured" |
| 2 | the Agent Substrate source code at the release tag v1.0.0 | every default, state, flag, and mechanism, and the reference tables |
| 3 | the Agent Substrate documentation at the same tag | install steps, the upgrade order, and documented behaviour that we did not run |
| 4 | Agent Substrate issues and pull requests on GitHub | known failures, limits, and the history of a feature |
| 5 | the kagent source code at its tag v1.0.0 | how a session becomes an actor, and the egress policy that kagent writes |
| 6 | the agentgateway source code at its tag v1.7.0 | the Substrate policies of the agentgateway dataplane |
| 7 | the Agent Executor code and documentation at one commit, built and run with no model | how a task becomes an actor in [7.5](#s-agent-executor) |

Our runs rank above the code on purpose. The code says what the system is built to do. A run says what it did on a real cluster, with the timers, the images, and the installer of the release. Where a run contradicts the documentation, the section reports both.

## Rank 1: our recorded runs

Sixteen experiments, each with its scripts and raw output in [the capture folder](manuals/agent-substrate-101/capture/lab). [How this manual was made](#s-ref-how-this-manual-was-made) describes the machines and the method.

| Experiment | What it recorded | Used in |
|---|---|---|
| A, the quickstart from source | each install step with its seconds, and the buildx failure | Part 2, [8.3](#s-symptom-cause-fix) |
| B, the lifecycle | 900 s with no request, then suspend, resume, crash, and revert | Part 1, Part 3 |
| C, resume against memory | resume and suspend times for actors that hold 0 to 1,000 MiB, from the node and from the bucket, and the disk use | Part 3, [8.1](#s-postgres-and-the-object-store) |
| D, durability | the snapshot timers, a lost node copy, an `atelet` restart, and a node restart | Part 3, [8.2](#s-when-a-dependency-is-down) |
| E, dependency loss | one request each second while Postgres, `ate-api-server`, and the Kubernetes API server were away | [1.2](#s-one-request-from-client-to-actor), [8.2](#s-when-a-dependency-is-down) |
| F, egress | default deny, allowed hosts, interception, pass-through, and credential injection on both dataplanes | Part 6 |
| G, the dataplanes | the install from release images, and the same inventory for Envoy and for agentgateway | Part 2, Part 6, [7.2](#s-agentgateway) |
| I, capacity | a full pool, and the request parking demo | Part 4 |
| J, death in a sandbox | a process that exits, and one that the kernel kills for memory | [3.5](#s-crashed-and-revertactor), [8.3](#s-symptom-cause-fix) |
| K, kagent | the documented kagent install, 98 turns, parallel turns, and what a files-only snapshot keeps | [7.1](#s-kagent-on-substrate) |
| L, the gaps | the microVM class on the first guest, node stops on a cluster with two worker nodes on the second guest (16 vCPU, 23 GB), and worker recovery after a node restart | [4.2](#s-sandbox-classes), [4.3](#s-placement), [3.5](#s-crashed-and-revertactor), [8.2](#s-when-a-dependency-is-down) |
| M, Apple silicon | the install from release images and three actor sizes on a laptop | Part 2, Part 3 |
| N, the demos | an idle suspender, a stateful agent, a tool sandbox, and a failure drill, on their own install on the second guest with 16 vCPU and 31 GB | Part 9 |
| P, a node that stops | 13 cases on the cluster with two worker nodes: reverts during and after the outage, a rescue from a tag, an async-suspended actor, a running actor, and the return of the node | [3.4](#s-snapshot-fidelity-and-where-a-snapshot-lives), [3.5](#s-crashed-and-revertactor), [4.3](#s-placement), [8.2](#s-when-a-dependency-is-down) |
| Q, network checks | eight checks on the second guest (16 vCPU, 23 GB): dependency loss on agentgateway, a reused connection after a rule removal, a model gateway behind egress over TLS, the egress log level, a suspend as a cut-off, a changed Secret, the router ports, and the CPU limit | [4.1](#s-workerpool), Part 6, [7.2](#s-agentgateway), [8.2](#s-when-a-dependency-is-down) |
| V, validation | twelve checks on the first guest: memory that holds no data, a Python runtime, resumes at the same instant, fidelity, templates, access policies, actor JWTs, a preview feature, a process exit, and a suspend during a request | Part 3, [4.4](#s-request-parking), [4.5](#s-sizing-a-pool), Part 5, [8.5](#s-limits-at-v1-0-0) |

## Rank 2: the code

| Source | Used in |
|---|---|
| Agent Substrate, tag `v1.0.0`, commit `b34fbee742906494b5eb4f1f36987176bf8770a4`, released 2026-11-05, [github.com/agent-substrate/substrate](https://github.com/agent-substrate/substrate) | every section |
| The same repository at tag `v0.1.0`, for the comparison of old and new instructions | [8.4](#s-upgrade-and-stale-advice) |
| kagent, tag `v1.0.0`, released 2026-11-09, [github.com/kagent-dev/kagent](https://github.com/kagent-dev/kagent) | [7.1](#s-kagent-on-substrate), [8.1](#s-postgres-and-the-object-store) |
| agentgateway, tag `v1.7.0`, [github.com/agentgateway/agentgateway](https://github.com/agentgateway/agentgateway) | [6.6](#s-the-dataplane-choice), [7.2](#s-agentgateway) |

The manual reads seven parts of the Substrate code most. They are the API definition, the lifecycle workflows of the API server, the snapshot tracker of `atelet`, and the request parking code of the router. The others are the database migration, the install manifests, and the command-line plugin. The manual source records the files that each section used, and the audit checks that record.

## Rank 3: documentation at the tag

These pages of the Agent Substrate documentation are cited by their titles. We checked each statement that we repeat against the code, and against a run where we had one.

The project site, ate.dev, serves the same pages at version 1.0. We read all 48 pages of the site on 2026-11-12 and compared the 38 that have a file at the tag with that file. We found differences in rendering only, such as link text and placeholders, and no difference in content. The first page of the site is a source of its own, because it states results with no conditions. [What Substrate does, and what it leaves to you](#s-what-substrate-does-and-what-it-leaves-to-you) sets each of those statements beside our runs.

| Page | Used in |
|---|---|
| the quickstart | Part 2, [8.4](#s-upgrade-and-stale-advice) |
| the architecture page | Part 1 |
| the API guide | Part 3, Part 4, [8.1](#s-postgres-and-the-object-store) |
| the resource model and the glossary | Part 3, [the glossary](#s-ref-glossary) |
| the request parking page | [4.4](#s-request-parking) |
| the sandbox classes page | [4.2](#s-sandbox-classes) |
| the guides for authentication, authorization, and actor JWTs | Part 5 |
| the guides for network egress, the trust bundle, and credential injection | Part 6 |
| the PostgreSQL guide and the node storage guide | [8.1](#s-postgres-and-the-object-store) |
| the upgrade runbook and the version skew policy | [8.4](#s-upgrade-and-stale-advice) |
| the page on preview features | [8.5](#s-limits-at-v1-0-0), [the flags reference](#s-ref-flags-and-gates) |
| the key rotation guide for actor JWTs | [8.5](#s-limits-at-v1-0-0) |
| the installer command reference and the operator install guide | Part 2, [the flags reference](#s-ref-flags-and-gates) |
| the `kubectl ate` reference | [2.2](#s-kubectl-ate), [the command reference](#s-ref-kubectl-ate) |

Three statements in these pages do not match the release. The quickstart says that Substrate suspends an idle actor, and our run and the code show that it does not. The upgrade runbook gives an example version that does not exist. The help text of one installer flag says that a credential provider requires Envoy, and the provider worked with agentgateway.

## Rank 4: issues

The issues are reports by users and maintainers. We name an issue where it explains a limit that we did not run, and we say so in the text.

| Issue | What it reports | Used in |
|---|---|---|
| [#3101](https://github.com/agent-substrate/substrate/issues/3101) | node-local snapshots filled a node disk, and the kubelet evicted the workers | [8.1](#s-postgres-and-the-object-store) |
| [#3775](https://github.com/agent-substrate/substrate/issues/3775), [#2972](https://github.com/agent-substrate/substrate/issues/2972) | the design for detecting a dead process inside a living sandbox | [8.5](#s-limits-at-v1-0-0) |
| [#3441](https://github.com/agent-substrate/substrate/issues/3441) | a proposal to reserve less than the declared limit for each actor | [8.5](#s-limits-at-v1-0-0) |
| [#3589](https://github.com/agent-substrate/substrate/issues/3589) | ingress authorization is the same for every atespace | [8.5](#s-limits-at-v1-0-0) |
| [#3203](https://github.com/agent-substrate/substrate/issues/3203) | a proposal for other storage backends, which the maintainers declined before the release | [8.5](#s-limits-at-v1-0-0) |
| [#3602](https://github.com/agent-substrate/substrate/issues/3602) | a durable directory has no size limit | [8.5](#s-limits-at-v1-0-0) |
| [#3347](https://github.com/agent-substrate/substrate/issues/3347) | the reuse of a name is not safe | [8.5](#s-limits-at-v1-0-0) |
| [#3285](https://github.com/agent-substrate/substrate/issues/3285) | a change of egress policy does not close open connections, which our run confirmed | [6.6](#s-the-dataplane-choice), [8.5](#s-limits-at-v1-0-0) |

Other sections cite more issues, and each names them in its own text.

The project marks in the figures belong to their owners, and we use them only to identify the projects.

Sources: front.md; manual.json (sources and pin); the Sources line and the citations of every file under sections/; capture/README.md.
