# Z-bursts

Bursts of 150, 200, and 300 resumes at one time on one node, with the pool grown to 300 workers, the restore time inside each worker, the CPU of each component during a burst, and 1 to 4 replicas of `ate-api-server` and of `atenet-router`. The capture README describes each file.

Not valid, and not used by the summaries:

- `00-setup/20-growth-first-pass-invalid.tsv`: the first pass counted workers with a filter that counts hosted actors, so it read 0. The growth ran again, in `20-growth.tsv`.
- The `wall` and `rate` fields of `c150-p1-h2-r1`, `c200-p1-h2-r2`, and `c150-p4-h2-p4` in `10-run/20-concurrency.tsv`: each burst held one or two requests with no answer, so its wall time is the curl limit of 90 s. The summary uses the answered requests up to the slowest answer.
- The two `404` rows in `10-run/bursts/c150-p1-h2-router4-r*.tsv`: they are requests to `t-023`, which we deleted before that test because we wrongly thought that it had stayed in `ACTOR_STATE_RESUMING`. The actor lists show it `ACTOR_STATE_RUNNING` 4 minutes earlier and `ACTOR_STATE_SUSPENDED` in its record before the delete.
- Per-name sums of `kworker*` threads in `10-run/cpu/`: a kernel thread can change its name between two samples. A short-lived process, such as a Postgres backend, can give a negative value for one second.
- `NODE_IOWAIT` in `10-run/cpu/` exists only for bursts after 06:50:14 UTC.
