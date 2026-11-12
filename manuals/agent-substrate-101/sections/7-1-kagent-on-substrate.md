# kagent 1.0 on Substrate

> kagent makes each Session one actor, resumes it for every turn, and suspends it after, so a turn pays about half a second and keeps only files.

You install kagent 1.0 and send your agent a message. The answer comes back in about a second. Then you run `kubectl get pods`, and you see one worker pod and no pod for your agent. The agent is an actor, and kagent suspended it again before you looked.

When you finish this section, you can install kagent 1.0, write the three objects that make an agent, and predict what one turn costs. You can also say what a kagent snapshot keeps and which hosts the agent can reach.

We ran kagent v1.0.0. kagent v1.0.1 came out on the day of our run, 2026-11-12, and we did not test it. The model was a mock server in the cluster, so every time in this section excludes model time.

## The install, as we ran it

The documented CLI path worked with no fix. It needs a kind cluster on Kubernetes 1.37 and one command.

| Step | Seconds |
|---|---|
| `kind create cluster --name kagent --image kindest/node:v1.37.0` | 26.1 |
| download the kagent CLI v1.0.0 | 5.5 |
| `kagent --config kagent-config.yaml install --namespace kagent` | 216.1 |

**We measured** each step once, on an x86 server guest with 16 vCPU and 31 GB. The install command took 216 s and ended with exit code 0.

kagent does not use a Substrate that you installed before. It installs its own distribution of Substrate, from images named `ghcr.io/kagent-dev/substrate/*:v1.0.0`. The install made six Helm releases: `kagent-crds`, `substrate-crds`, `substrate-podcert`, `substrate-atelet`, `substrate`, and `kagent`. In this distribution, `atenet-router` and `atenet-egress` each run one agentgateway v1.7.0 container. It has no Envoy.

The install created one WorkerPool, `kagent-default`, with one worker pod. It created no default Harness. Advice that tells you to select a Harness named `kagent-default` describes a later build. At v1.0.0 you write the Harness.

## The three objects you write

An agent at v1.0.0 is three Kubernetes objects in the group `api.kagent.dev/v1alpha3`. YAML with the group `kagent.dev` is older than 1.0 and does not apply.

```listing
title: the Harness, the AgentTemplate, and the Agent of our run
source: capture/lab/K-kagent/agent/lab-agent.yaml
lang: yaml
note: The ModelConfig above these three objects is cut. It names the mock model server.
---
…
apiVersion: api.kagent.dev/v1alpha3
kind: Harness
metadata:
  name: lab-harness
  namespace: kagent
spec:
  kagent: {}
  substrate:
    workerPoolRef:
      name: kagent-default
    snapshotPolicy:
      location: s3://ate-snapshots/kagent/
---
apiVersion: api.kagent.dev/v1alpha3
kind: AgentTemplate
metadata:
  name: lab-template
  namespace: kagent
spec:
  description: Lab agent that runs shell commands for the Substrate manual experiments
  modelConfig:
    name: mock-model
  systemPrompt: You are a lab agent. Use the bash tool when the user asks you to run a command.
---
apiVersion: api.kagent.dev/v1alpha3
kind: Agent
metadata:
  name: lab-agent
  namespace: kagent
spec:
  template:
    ref:
      name: lab-template
  harnessRef:
    name: lab-harness
```

**Harness:** the runtime that executes the agent, with the WorkerPool and the snapshot location that it uses. `kagent: {}` selects the engine of kagent. The other types are `codex`, `claude`, and `byo`, and we did not test them.

**AgentTemplate:** the model, the prompt, and the tools. It has no Substrate field.

**Agent:** the pair of one AgentTemplate and one Harness. kagent compiles each revision of that pair into one ActorTemplate through the Substrate API {{kagent}}. Ours was `lab-agent-7f643ac37f02`.

The Agent was `Ready` about 24 s after we applied it. The golden snapshot build used 9.84 s of that time. Substrate has no Actor CRD and no ActorTemplate CRD, so `kubectl get` shows neither object. Use `kubectl ate`.

## One Session is one Actor

**Session:** one conversation with an Agent. kagent creates one actor for it, named `session-<uuid>`, in the atespace `kagent`. The atespace has the name of the Kubernetes namespace of the Agent.

The actor is created in `ACTOR_STATE_SUSPENDED`, and kagent does not resume it. The first message does. A Session create took 0.39 s at the median over 20 creates.

```figure
id: fig-7-1
kind: sequence
title: one kagent turn, from the message to the answer
claim: Every turn resumes the Session actor through the router, and kagent suspends it again before the client has the answer.
caption: Read top to bottom. Amber arrows are state changes, with the median time of each. The model was a mock server. From capture/lab/summary/kagent-turns-x86.json and capture/lab/K-kagent/logs/actor-state-changes.tsv.
```

The log of `ate-api-server` shows the cycle. These lines are one Session: the create, then two turns that were 4 s apart.

```listing
title: one Session in the state log, create and two turns
source: capture/lab/K-kagent/logs/actor-state-changes.tsv
lang: text
note: The columns are time, actor, operation, and new state.
---
2026-11-12T10:20:35.633350007Z	session-01a1cf46-0786-748f-ad16-cc3bb0e1f2e1	create	suspended
2026-11-12T10:20:36.067645235Z	session-01a1cf46-0786-748f-ad16-cc3bb0e1f2e1	resume	resuming
2026-11-12T10:20:36.485975028Z	session-01a1cf46-0786-748f-ad16-cc3bb0e1f2e1	resume	running
2026-11-12T10:20:36.862693911Z	session-01a1cf46-0786-748f-ad16-cc3bb0e1f2e1	suspend	suspending
2026-11-12T10:20:36.995534634Z	session-01a1cf46-0786-748f-ad16-cc3bb0e1f2e1	suspend	suspended
2026-11-12T10:20:41.387075902Z	session-01a1cf46-0786-748f-ad16-cc3bb0e1f2e1	resume	resuming
2026-11-12T10:20:41.796382831Z	session-01a1cf46-0786-748f-ad16-cc3bb0e1f2e1	resume	running
2026-11-12T10:20:42.143125306Z	session-01a1cf46-0786-748f-ad16-cc3bb0e1f2e1	suspend	suspending
2026-11-12T10:20:42.270402046Z	session-01a1cf46-0786-748f-ad16-cc3bb0e1f2e1	suspend	suspended
```

All 98 turns of our run had this shape: resume, run, suspend. Substrate does not suspend an idle actor, as [SuspendActor and ResumeActor](#s-suspendactor-and-resumeactor) shows. kagent does that work for you, after every turn.

## What one turn costs

```figure
id: fig-7-1b
kind: chart
title: resume, suspend, and turn times with kagent
claim: A turn that follows the last one with no pause costs the same as a turn 4 s later, because every turn resumes the actor.
caption: Each bar is a median. Amber bars are the two state changes inside a turn. Plum bars are the whole turn as kagent reports it. From capture/lab/summary/kagent-turns-x86.json.
```

**We measured** 98 turns on an x86 server guest with 16 vCPU and 31 GB, with a mock model. The resume took 0.380 s at the median, from 0.216 to 0.542 s. The suspend took 0.142 s at the median over 99 suspends, from 0.120 to 0.398 s. A whole turn took 0.726 s in the cluster and 1.224 s at the client, over 20 turns spaced 4 s apart.

No warm turn exists. Twenty turns with no pause took 0.738 s at the median, against 0.726 s for the spaced turns. The uptime inside the sandbox read 0.6 to 0.9 s on every turn. So you pay about 0.52 s of resume and suspend on each turn, and a real model adds its own time to that.

One turn of about 130 took 6.56 s, with a gap of 5.5 s before the resume. We did not find the cause.

## What the snapshot keeps

kagent asks Substrate for the files-only fidelity, `SNAPSHOT_FIDELITY_VOLUMES`, and it suspends in the synchronous mode {{kagent}}. The snapshot is in the object store before the turn ends. It holds the directory `/data` and nothing else.

In turn 1 our agent wrote one file under `/data`, wrote one file under `/tmp`, and started a background `sleep`. Turn 2 looked for all three.

```listing
title: what turn 2 found after one suspend and one resume
source: capture/lab/K-kagent/session1/turn2.out
lang: text
note: The rest of the output, the environment and the mounts, is cut.
---
note=hello-from-turn1
scratch=cat: can't open '/tmp/scratch.txt': No such file or directory
bg=
uptime=0.74
PID   ELAPSED COMMAND
    1  0:01   /app
…
```

The file under `/data` survived. The file under `/tmp` and the background process did not, and PID 1 was a new process. Write to `/data` everything that the next turn needs. [Snapshot fidelity](#s-snapshot-fidelity-and-where-a-snapshot-lives) compares this mode with a memory snapshot.

## The three egress rules that kagent writes

kagent writes one egress policy for each actor through the Substrate API. Our cluster had no Kubernetes `EgressPolicy` object at all.

```listing
title: the egress policy of one Session actor
source: capture/lab/K-kagent/session1/egress-policy-actor.yaml
lang: yaml
note: The CLI warning and the metadata above the rules are cut.
---
…
rules:
- http:
    effects:
      replaceHeaders:
      - actorJwt:
          audiences:
          - kagent-runtime
          expirationSeconds: "300"
        header: authorization
        prefix: 'Bearer '
    hostnames:
    - kagent-controller.kagent.svc.cluster.local
    ports:
      numbers:
      - 8083
- http:
    effects:
      replaceHeaders:
      - credentialUri: ate-secret://k8s.io/default/kagent/kagent-openai/OPENAI_API_KEY
        header: authorization
        prefix: 'Bearer '
    hostnames:
    - mock-llm.kagent.svc.cluster.local
    ports:
      numbers:
      - 8080
- https:
    hostnames:
    - api.openai.com
    ports:
      numbers:
      - 443
```

1. The kagent controller on port 8083. The gateway replaces the `authorization` header with an [Actor JWT](#s-actor-jwts) for the audience `kagent-runtime`.
2. The model host of the ModelConfig. The gateway replaces the `authorization` header with the value of a Kubernetes Secret. [Credential injection](#s-credential-injection) explains the mechanism.
3. `api.openai.com` on port 443. kagent adds this rule for every OpenAI ModelConfig, also when the model is at another host {{kagent}}.

The actor never had the key. Its environment held `OPENAI_API_KEY=kagent-credential-injected`, and the mock model received the real value on all 10 calls.

Everything else was denied. A request to `example.com` failed in DNS. A request to the IP address `1.1.1.1` returned 403. The short name `mock-llm.kagent` also returned 403, and only the full name `mock-llm.kagent.svc.cluster.local` returned 200. Give kagent full DNS names for model and tool hosts.

## Parallel turns on one worker

The worker pod of the install has no resource limits, so it reports the whole node: 16,000 millicores. Each actor reserves 1 CPU. The worker therefore ran at most 16 actors at one time.

**We measured** this on the same x86 server guest with one worker. Eight turns that started together all completed, in 2.47 to 3.57 s. Twenty-four turns that started together all completed, in 4.25 to 7.85 s. The worker showed 16 running actors, and the other 8 turns waited. [Sizing a pool](#s-sizing-a-pool) gives the arithmetic.

## The CLI port-forward collision

The kagent CLI opens its own port-forward to port 8083 for each call. Five of eight CLI calls that we started together failed.

```listing
title: a kagent CLI call that lost the port
source: capture/lab/K-kagent/latency/D-par-2.err
lang: text
note: The second listener error and two more lines are cut.
---
Error: connect to kagent gateway: kubectl port-forward exited before the server became ready (kubectl: Unable to listen on port 8083: … bind: address already in use …
```

Start one `kubectl port-forward` to the controller yourself, and point every CLI call at it. With a standing port-forward, a Session create took 0.17 s at the median in place of 0.39 s.

```takeaways
- Install kagent on a new cluster, because it installs its own Substrate distribution.
- Write the Harness yourself at v1.0.0.
- Write every file that the next turn needs under /data.
- Add about 0.5 s of resume and suspend to the model time of each turn.
- Use full DNS names for model and tool hosts.
- Keep one standing port-forward for parallel CLI calls.
```

Sources: capture/lab/K-kagent/install/steps.tsv, capture/lab/K-kagent/install/commands.log, capture/lab/K-kagent/install/40-kagent-install.log, capture/lab/K-kagent/inventory/images.tsv, capture/lab/K-kagent/inventory/helm-list.yaml, capture/lab/K-kagent/inventory/workerpools.yaml, capture/lab/K-kagent/agent/lab-agent.yaml, capture/lab/K-kagent/agent/objects.txt, capture/lab/K-kagent/agent/agent-conditions.trace, capture/lab/K-kagent/logs/actor-state-changes.tsv, capture/lab/summary/kagent-turns-x86.json, capture/lab/summary/install-steps.json, capture/lab/K-kagent/latency/timings.tsv, capture/lab/K-kagent/latency/server-times.tsv, capture/lab/K-kagent/latency/D-par-2.err, capture/lab/K-kagent/session1/turn2.out, capture/lab/K-kagent/session1/timings.tsv, capture/lab/K-kagent/session1/egress-policy-actor.yaml, capture/lab/K-kagent/session1/k8s-egresspolicies.yaml, capture/lab/K-kagent/session1/turn5-egress.out, capture/lab/K-kagent/session1/mock.log, capture/lab/K-kagent/parallel/timings.tsv, capture/lab/K-kagent/parallel/workers-during.txt; kagent v1.0.0 source: go/api/v1alpha3 (Harness, AgentTemplate, Agent), go/core/internal/substrate (client.go, actor_template.go), go/core/internal/controller/translator; kagent docs/architecture/runtime-and-lifecycle.md at v1.0.0.
