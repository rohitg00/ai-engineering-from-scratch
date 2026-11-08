# Sources

> This page ranks the sources of the manual by authority.

Use this page to judge how much weight a statement in the manual carries.

When two sources disagree, the higher one wins, and the page says so.

| Rank | Source | What the manual takes from it |
|---|---|---|
| 1 | the vLLM source at release 0.31.0 | every default, every flag name, and every mechanism in Part 8 |
| 2 | our own runs on an NVIDIA L4 and a DGX Spark | every number marked as measured |
| 3 | vLLM issues and pull requests | known failures and the history of each feature |
| 4 | the vLLM release notes | what each release added, changed, or removed |
| 5 | the vLLM documentation at release 0.31.0 | documented behavior, checked against the source |
| 6 | papers | the original design of PagedAttention and speculative decoding |
| 7 | blog posts and talks by the vLLM team and others | context and history, never a default or a number |

## What we did not use

We did not use benchmark numbers from vendors or from other teams as evidence for a decision. Where the manual reports a result from another team, it names the team once and says that the number is theirs.

Sources: this manual.
