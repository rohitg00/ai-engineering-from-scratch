# Y-reruns-rollback-scale

Second runs of the three dependency outages, a second upgrade from v1.0.0-rc.3 to v1.0.0 with a rollback, an install of v0.6.0 with a direct upgrade and a reinstall, and the release v0.3.1 of Agent Executor on v0.6.0. The capture README describes each file.

Not valid, and not used by the summaries:

- `10-outages/30-k8s-run1/10-probe.tsv`, the stream `suspended`: every failure is `no worker has room for the actor`, because running actors from the earlier runs filled the pool.
- `10-outages/*/19-summary.txt`: the counts cover the whole window of a run, from 30 s before the outage to 120 s after it.
- `10-outages/*/18-states-after-cleanup.txt`: the cleanup step did not suspend the running actors, so the file repeats `17-states-after.txt`.
- `20-upgrade/40-rollback/00-manual-revert-a-cyc.txt` says that `a-cyc` was crashed since step 2. The cycle stream shows that it crashed in step 3.
- `30-scale/`: the bursts produced no data. The pool reached 443 of 520 workers in 1,748 s, and then the Kubernetes API server of that cluster stopped answering.
