# Agent Executor on Substrate

> Agent Executor runs each task as one Substrate actor with a files-only snapshot, and you still send every suspend yourself.

The project site names two systems that are built on Agent Substrate. One is kagent, which [kagent 1.0 on Substrate](#s-kagent-on-substrate) covers from our own run. The other is Agent Executor, and your team asks if it is the better base for coding agents. We did not run Agent Executor. This section comes from its documentation and its code, both read on 2026-11-12 at one commit. Each statement says which of the two it comes from.

When you finish this section, you can map each Agent Executor object to the Substrate object behind it. You can also list what to test before you depend on it.

## What it is

Agent Executor, short name AX, is an open-source orchestrator from Google for agent tasks. Its license is Apache-2.0. Its documentation says that every task runs as a sandboxed actor on Agent Substrate, so you install Substrate first.

Check the version before anything else. The latest release is v0.3.1, from 2026-09-25, which is six weeks older than Substrate v1.0.0. The code at the commit we read requires Substrate v1.0.0 in its module file. The README warns that large changes are likely before a stable release. Test the commit that you install, and not the release notes.

You write four kinds of object, all in the API group `ax.io/v1alpha1`.

| You write | What it holds |
|---|---|
| `Task` | one container image and command, CPU and memory limits, environment, and an optional workspace |
| `Workspace` | Git repositories, MCP servers, and skill registries that a task finds ready |
| `Model` | a model provider, a model name, and the Kubernetes Secret with its key |
| `Gateway` | egress rules for the tasks that use it |

Agent Executor has its own control plane. The documentation installs a server and a PostgreSQL database in the namespace `ax-system`, and a command line tool named `ax`. That database is a second one, next to the Postgres that Substrate needs.

## How a task becomes an actor

The code creates one actor for each task. The actor has the name of the task and lives in the atespace of the task.

```figure
id: fig-7-5
kind: flow
title: what each Agent Executor object becomes on Agent Substrate
claim: Agent Executor turns one task into one actor with a files-only snapshot, and it leaves the suspend call and the WorkerPool to you.
caption: Read each row left to right. The left column is what you write, and the right column is what exists on Substrate after it. The rose arrow marks work that no component does for you. From the Agent Executor code and documentation at the commit read on 2026-11-12, not from a run.
```

Four details in the code decide how a task behaves on Substrate.

- **The snapshot is files-only.** The template that the code builds asks for the fidelity `SNAPSHOT_FIDELITY_VOLUMES`, with one durable directory. Process memory does not survive a suspend.
- **A runner is process 1.** The program `ax-task-runner` starts first in every sandbox. It prepares the workspace on the first run, starts your command, and answers the wakeup probe on `/readyz`.
- **The template names no pool.** The code sets no worker selector. The installation page says the same: a task is not limited to one sandbox class or to the pools of its atespace.
- **Egress rules are copied once.** The rules of a `Gateway` are Substrate egress rules. The API definition says that they are copied into the policy of the actor when the task is created.

The files-only snapshot matters most. [Snapshot fidelity, and where a snapshot lives](#s-snapshot-fidelity-and-where-a-snapshot-lives) shows what that fidelity keeps. Each resume starts the runner and your command again, so the cost of a resume is the start time of your image.

## Who sends the suspend

You do. A new task starts in the suspended phase, and `ax resume task` starts it. The command `ax suspend task` checkpoints it. In the code, the only call to `SuspendActor` is in the path that serves that request. We found no idle timer.

The roadmap of the project lists the detection of idle tasks and an automatic suspend as future work. So our first position holds here too. Substrate does not suspend an idle actor, and Agent Executor does not do it yet. kagent differs, because it suspends the actor after every turn.

| | kagent 1.0 | Agent Executor |
|---|---|---|
| One actor is | one Session | one Task |
| Who sends the suspend | kagent, after each turn | you, with `ax suspend task` |
| Snapshot fidelity | files-only | files-only |
| Substrate that it uses | its own distribution, installed with it | the Substrate that you installed |
| Its own database | PostgreSQL | PostgreSQL |
| In this manual | run on our cluster | read, not run |

## What to test first

Each item is a place where the Agent Executor pages meet something that we measured on Substrate v1.0.0.

1. **The route to a task.** The networking page shows plain HTTP to the router Service on port 80. In our installs nothing listened on port 80 of the router, on either dataplane, as [The router and ingress](#s-the-router-and-ingress) shows. The code also has a path that uses a client certificate. Find out which one your build uses.
2. **The cost of a resume.** A files-only resume is a cold start. Our kagent harness resumed in about 0.38 s, and the Python agent of [A stateful agent actor](#s-a-stateful-agent-actor) took 4.5 to 5.1 s. Measure your task image.
3. **The first resume.** The README says that the first resume waits for the workspace, and that the command line tool can stop waiting before the task is ready. Time it with your largest repository.
4. **Placement.** With no worker selector, a task can go to any pool that has room. Check this on a cluster that has more than one pool or sandbox class.
5. **The install.** The installation page needs a WorkerPool that you create. It needs a grant for the server identity in the Substrate access policy, and that identity in the ingress allowlist of the router. It also needs Linux on amd64 and a worker kernel at version 6.8 or newer.

The first failure that the README names is a missing pool. The first resume then fails with the text `ResourceExhausted: no free workers available`.

## Our position

Agent Executor is early. Its release is older than the Substrate version that its code requires, and its own pages say that the API can change. Its shape is right for coding tasks: a task, a prepared workspace, and a way to open a shell in the sandbox. If you need chat sessions on Substrate today, kagent 1.0 is the one that we ran. If you need task runs with prepared repositories, read the Agent Executor code at the commit you install, and run the five tests first.

```takeaways
- Install the Agent Executor commit that requires your Substrate version, and check its module file.
- Send the suspend yourself, or write the idle suspender of section 9.1.
- Measure a files-only resume with your own task image before you promise a response time.
- Create the WorkerPool and the access grants before the first resume.
- Test the route to a task on port 443 and on port 80 of the router.
```

Sources: the Agent Executor repository github.com/google/ax at commit a72b8ca46cb54a6f9bd53c8bb349d3a2089e7735, read 2026-11-12: README.md, docs/concepts.md, docs/installation.md, docs/networking.md, docs/sandbox.md, docs/roadmap.md, go.mod, internal/substrate/client.go, internal/controller/reconciler.go, internal/tunnel/router_tls.go, pkg/apis/v1alpha1/gateway.proto, and its release list; site/layouts/_shortcodes/home.html and README.md of Agent Substrate at v1.0.0; capture/lab/summary/kagent-turns-x86.json; capture/lab/summary/demos-x86.json.
