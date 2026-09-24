# Before / After: Agent Workbench on a Real Repo

Same task. Same sample app. Two pipelines.

| Outcome | Prompt only | Workbench |
|---------|-------------|-----------|
| tests_actually_run | False | True |
| acceptance_met | False | True |
| files_outside_scope | 2 | 0 |
| handoff_quality | missing | full packet |
| reviewer_total (/10) | 3 | 9 |

## Read

Prompt only writes outside scope, claims done without running the acceptance command, leaves no handoff, and scores low on review. Workbench keeps writes in scope, runs the acceptance command through the feedback runner, passes the verification gate, and ships a handoff packet the next session loads on startup.
