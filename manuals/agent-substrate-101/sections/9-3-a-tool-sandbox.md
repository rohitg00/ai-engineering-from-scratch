# A tool sandbox

> An actor with one egress rule, two resource limits, and a revert after each task runs commands that you do not trust, and returns clean in half a second.

Your agent writes a shell command, and something must run it. If that command runs beside your application, one bad line of model output can read your secrets or send them away. You want a place where the command can do its work and nothing else.

When you finish this section, you can run commands that you do not trust inside an actor. You can also prove what the actor can reach, and return it to a clean state after each task.

## The sandbox actor

**Tool sandbox:** an actor whose only job is to run commands for an agent. It has no credential, no route out except the ones you list, and no state that you keep.

The demo actor is 38 lines of Python. It accepts a command, runs it with `sh -c` in the directory `/work`, and returns the exit code and the output.

```python
task = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
done = subprocess.run(["sh", "-c", task["cmd"]], cwd=WORK,
                      capture_output=True, text=True, timeout=task.get("timeout", 20))
result = {"exit": done.returncode, "stdout": done.stdout[-2000:], "stderr": done.stderr[-1000:]}
```

Three things around that code make it a sandbox, and Substrate supplies all three. The full files are in [the tool sandbox folder](manuals/agent-substrate-101/capture/demos/tool-sandbox).

```figure
id: fig-9-3
kind: flow
title: six tasks in one sandbox actor, with a revert after each
claim: One download from the allowed mirror passed, three attempts to reach other hosts failed, and each revert returned an empty work directory.
caption: Read left to right. Each row is one task, the result the command saw, and the time of the revert that followed. Rose marks a refused or failed task. From capture/lab/N-demos/tool-sandbox/tasks.tsv.
```

The first is the egress policy. The actor has one rule, for one host, and Substrate denies every other destination. In this demo the host is a package mirror inside the cluster.

```listing
title: the egress policy of the sandbox actor
source: capture/lab/N-demos/tool-sandbox/egress-policy-live.yaml
lang: yaml
note: The rules. The metadata lines above them are cut.
---
…
rules:
- http:
    hostnames:
    - pkg-mirror.demo-tools.svc.cluster.local
    ports:
      numbers:
      - 80
```

The second is the pair of limits in the template: 500 millicores and 256 MiB. The third is the golden snapshot of the template. A new actor starts from it.

`RevertActor` returns an actor to its latest durable snapshot {{code}}. That snapshot is the golden snapshot only while the actor has never had a suspend of its own made durable. This demo never suspends the actor, so each revert here returns the golden state. An actor that something suspends, such as an idle suspender, gets its own durable snapshot, and a later revert returns to that one.

```bash
kubectl ate create actor task-1 -a demo-tools --template sandbox
kubectl ate create egress-policy task-1 -a demo-tools -f egress-policy.yaml
kubectl ate proxy actor task-1 -a demo-tools 8901:80 &
python3 client.py 8901 'wget -q -O hello.txt http://pkg-mirror.demo-tools.svc.cluster.local/hello-1.0.txt'
kubectl ate revert actor task-1 -a demo-tools
```

## Six tasks

We sent six commands to one actor. After each command the script reverted the actor, and then asked it how many files `/work` holds.

```listing
title: the allowed download, the revert, and the check
source: capture/lab/N-demos/tool-sandbox/tasks.tsv
lang: text
note: The header and the three lines of the first task.
---
label	phase	state	http	seconds	result
allowed download	task	RUNNING	200	0.54	{"exit": 0, "stdout": "hello package 1.0\nhello.txt\n", "stderr": "", "seconds": 0.17}
allowed download	revert	SUSPENDED	-	0.47	-
allowed download	clean-check	RUNNING	200	0.44	{"exit": 0, "stdout": "0\n", "stderr": "", "seconds": 0.16}
```

The download worked, and the command saw the file `hello.txt`. The revert took 0.47 seconds. The next request resumed the actor from the golden snapshot in 0.44 seconds, and `/work` held no file.

The next three commands try to reach a destination that the policy does not list.

```listing
title: three ways out, all refused
source: capture/lab/N-demos/tool-sandbox/tasks.tsv
lang: text
note: The task line of tasks 2, 3 and 4. The revert and check lines between them are cut.
---
send data out by name	task	RUNNING	200	0.20	{"exit": 0, "stdout": "** server can't find example.com: NXDOMAIN\n\nwget_exit=1\n", "stderr": "wget: bad address 'example.com'\n", "seconds": 0.11}
…
send data out by IP	task	RUNNING	200	0.15	{"exit": 0, "stdout": "wget_exit=1\n", "stderr": "wget: server returned error: HTTP/1.1 403 Forbidden\n", "seconds": 0.04}
…
reach the Kubernetes API	task	RUNNING	200	0.13	{"exit": 0, "stdout": "wget_exit=1\n", "stderr": "wget: bad address 'kubernetes.default.svc.cluster.local'\n", "seconds": 0.04}
```

A name outside the policy does not resolve. The command gets `NXDOMAIN`, and `wget` reports a bad address. That is also true for the Service name of the Kubernetes API. A request to an IP address reaches the egress gateway, and the gateway answers 403. The command had no way to learn if the address exists.

The last two commands test the limits.

```listing
title: CPU work and memory above the limit
source: capture/lab/N-demos/tool-sandbox/tasks.tsv
lang: text
note: The task line of task 5 and the three lines of task 6.
---
2 s of CPU work on a 500m limit	task	RUNNING	200	2.63	{"exit": 0, "stdout": "wall_seconds 2.38\n", "stderr": "", "seconds": 2.54}
…
memory hog on a 256 MiB limit	task	CRASHED	503	4.52	upstream connect error or disconnect/reset before headers. reset reason: connection termination
memory hog on a 256 MiB limit	revert	SUSPENDED	-	0.43	-
memory hog on a 256 MiB limit	clean-check	RUNNING	200	0.44	{"exit": 0, "stdout": "0\n", "stderr": "", "seconds": 0.11}
```

The memory limit works as a hard stop. A command that allocated 640 MiB ended the whole sandbox. The client got a 503 after 4.52 seconds, the actor was `CRASHED`, and one revert returned a clean actor.

The CPU line of this demo does not show what it seems to show. The command runs a loop until the process has used 2.0 seconds of CPU time, and it reads that time inside the sandbox. It finished in 2.38 seconds on a limit of 500 millicores. Our first reading was that the limit did not slow the command. That reading was wrong, and a later test supersedes it.

The CPU limit is a hard cap. The worker writes a CPU quota from `cpuMillicores` into a cgroup for the actor. For this template the quota is 50 ms of CPU time in each 100 ms period {{code}}. CPU time that a program reads inside a throttled sandbox is too high. So the loop of the demo stopped early, after less real work than 2.0 seconds of one core.

**We measured** the cap on a second x86 server guest (16 vCPU, 23 GB), with fixed work and three runs for each limit. Work that took 4.9 to 5.4 seconds at 1000 millicores took 12.7 to 13.1 seconds at 500 and 27.1 to 27.6 seconds at 250. The actor used 0.50 host cores at 500 millicores, with 1 thread and with 4. At 250 millicores the program reported 22 to 24 seconds of CPU time for a run that used 6.9 seconds on the host. [WorkerPool](#s-workerpool) has the table and the chart.

For a tool sandbox this is the result that you want. A busy command cannot take more CPU than its limit, and it cannot starve the next actor on the worker. Measure work in a sandbox with a fixed task and a wall clock, and never with the CPU time that the task reports.

## What a revert costs

**We measured** six reverts on a second x86 server guest (16 vCPU, 31 GB). Each took 0.43 to 0.51 seconds at the CLI. The first request after each revert took 0.44 to 0.46 seconds, which includes the resume from the golden snapshot. A clean sandbox for the next task costs about one second in total.

That number depends on the golden snapshot. This actor holds a Python process and no data. [SuspendActor and ResumeActor](#s-suspendactor-and-resumeactor) shows how the time grows with memory.

## Limits of the demo

- The actor has no authentication. A caller that can reach it can run commands. Put it behind your agent, and give the router a strict allow list.
- We did not run a command that starts processes without end.
- The mirror is one in-cluster server over HTTP. A public package index needs a `tlsPassthrough` rule, which needs no trust bundle. Use an `https` rule and the trust bundle only if the gateway must read the request or inject a credential.
- gVisor is the isolation here. We did not run this demo on the microVM class.
- A command can fill `/work` and the root file system up to the memory and disk that the worker allows. We did not test a disk limit.

## What to change for production

Use one actor for each task or each user, and delete it at the end. Only a new actor is certain to start from the golden snapshot. A revert returns to the latest durable snapshot of the actor, and a suspend during a task can make the state of that task durable. If anything in your system can suspend a sandbox actor, delete it and create a new one after each task. A new name also leaves no doubt about old state. We did not time a revert against a delete and a create.

Write the egress policy before the first command runs. An actor with no policy can reach nothing, which is the safe default. List package hosts by full name, and never add a rule for a host that also holds your data.

```takeaways
- Give a sandbox actor one egress rule for each host it needs, and nothing else.
- Revert the actor after each task, and check that the work directory is empty.
- Delete and recreate the actor when a suspend could have made the state of a task durable.
- Set a memory limit that fits the largest tool, and expect a crash above it.
- Count on `cpuMillicores` as a hard cap, and time sandbox work with a wall clock on a fixed task.
```

Sources: capture/lab/N-demos/tool-sandbox/tasks.tsv, capture/lab/N-demos/tool-sandbox/egress-policy-live.yaml, capture/lab/N-demos/tool-sandbox/lifecycle.log, capture/lab/summary/demos-x86.json, capture/lab/Q-network/n-cpu-limit/40-work.tsv, capture/lab/summary/cpu-limit-x86.json, capture/demos/tool-sandbox/sandbox.py, capture/demos/tool-sandbox/template.yaml, capture/demos/tool-sandbox/run.sh; api/ateapi/v1/ateapi.proto (RevertActor, EgressRule), internal/ocispec/ocispec.go (the CPU quota), docs/reference/sandbox-classes.md and docs/guides/egress-trust-bundle.md at v1.0.0
