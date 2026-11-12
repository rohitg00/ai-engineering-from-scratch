# How to read this manual

> Install Agent Substrate on a kind cluster from the release images, wake one actor with a request, and then learn each part with the number we measured for it.

This manual is for the engineer who runs agents on Kubernetes and must decide if Agent Substrate fits. It starts with a cluster that answers a request. It ends with a table that takes you from an error text to its cause.

These commands create a kind cluster, install Agent Substrate v1.0.0 from the release images, and create one actor:

```bash
git clone --branch v1.0.0 https://github.com/agent-substrate/substrate.git
cd substrate
hack/create-kind-cluster.sh
export ATE_INSTALL_KIND=true
go run ./cmd/ate-setup deploy ate-system \
  --credential-provider='{"name":"k8s.io"}' \
  --ingress-allowed-spiffe-ids=spiffe://cluster.local/ns/ate-system/sa/atenet-client \
  --image-repo ghcr.io/agent-substrate/substrate --image-tag v1.0.0
go run ./cmd/ate-setup deploy demo counter
go install ./cmd/kubectl-ate
export PATH="$(go env GOPATH)/bin:$PATH"
kubectl ate create actor my-counter-1 -a ate-demo-counter --template counter
kubectl ate proxy actor my-counter-1 -a ate-demo-counter
```

The last command stays in the foreground and listens on port 8000. In a second terminal, send the actor a request:

```bash
curl -X POST http://localhost:8000/
```

The actor answers with a count, and each new request adds one. [Section 2.1](#s-install-with-ate-setup) runs the install step by step, with the output to expect and the fix for each error we hit. [Section 2.3](#s-your-first-actor-and-the-proxy) explains the actor and the proxy.

You need Go 1.27, Docker, `git`, and `kubectl`. The release has no `ate-setup` binary, so the installer runs with `go run` from the checkout. The release does have `kubectl-ate` binaries, and [section 2.2](#s-kubectl-ate) installs one without Go.

**We measured** this install once on a second x86 server guest (16 vCPU, 23 GB). The kind cluster took 55 s, `deploy ate-system` took 162 s, and `deploy demo counter` took 94 s. The whole path took about five minutes.

**We measured** the same install once on an Apple silicon laptop under Docker Desktop, with 10 CPU and 8 GB for Docker. The kind cluster took 119 s, and `deploy ate-system` took 702 s. Suspend and resume worked there with the gVisor sandbox class. The laptop and the server guest are different machines, so do not compare their seconds.

Do not build from source for a first install. The command without `--image-repo` and `--image-tag` builds every image, and it needs the Docker buildx plugin and a Rust compile. On the x86 server guest (24 vCPU, 47 GB, nested KVM) it failed once and then took 266 s. That guest is another machine than the one above, so the difference in seconds is indicative only.

## What you can do after this manual

- Install Agent Substrate on a kind cluster from the release images, create an actor, and send it a request.
- Predict how long an actor takes to resume from the memory that holds data in it, and choose between an asynchronous and a synchronous suspend.
- Size a WorkerPool, and say what a client sees when the pool is full.
- Write an egress policy, inject a credential, and choose between the Envoy and the agentgateway dataplane.
- Find the cause of a 500 or a 503 from its text, and bring a crashed actor back with `RevertActor`.

## Who this manual is for

You run agents on Kubernetes, or you plan to. You know pods, Services, and `kubectl`. You have not used Agent Substrate, and you want to know what it does and what it costs before you depend on it.

The Agent Substrate documentation describes each object and each flag. This manual tells you what happened when we ran them. We installed v1.0.0 on our own clusters, broke it on purpose, and timed it. Where our run disagrees with a page of the documentation, we say so and we show the recording.

We hold eight positions, and each one comes from a run. [Section 1.1](#s-what-substrate-does-and-what-it-leaves-to-you) lists them with the number behind each one. The first position matters most: Substrate does not suspend an idle actor, so something that you run must do it.

## What we did not test

All our clusters but one had one kind node, and the sandbox class was gVisor in every run behind Parts 1 and 2. We did not run Agent Substrate on GKE. Our one object store outside the cluster ran on the same guest, with an emulated delay. We did not use a cloud bucket.

The only real model in our runs was a small open model on CPU, behind kagent and behind Agent Executor. So no model time in this manual is the time of a GPU or of a hosted model.

Each section says so where one of those limits applies. [How this manual was made](#s-ref-how-this-manual-was-made) describes the machines, the method, and the full list.

## How the parts are ordered

Part 1 is Substrate on one page: what it does, and one request from the client to the actor. Part 2 installs it and creates your first actor. Part 3 is the actor: its template, its states, suspend, resume, and what a snapshot keeps.

Part 4 is capacity: worker pools, sandbox classes, and a full pool. Part 5 is identity, and Part 6 is the network in both directions. Part 7 connects kagent and agentgateway, and it says when Substrate is the wrong choice. Part 8 operates and debugs a cluster. The Reference holds the lookup tables:

```parts
```

Each section ends with a short list of actions. Read those first when you need an answer today. Read the rest when you want the reason.

Four lessons go deeper into the ideas that this manual applies. [The production runtimes lesson](phases/14-agent-engineering/29-production-runtimes) compares the ways to run an agent in production. [The durable execution lesson](phases/15-autonomous-systems/12-durable-execution) and [the checkpoints and rollback lesson](phases/15-autonomous-systems/16-checkpoints-rollback) build the ideas behind suspend, resume, and revert. [The AI gateways lesson](phases/17-infrastructure-and-production/19-ai-gateways) covers the gateway in front of a model. This manual stays with Agent Substrate.

## Colour in figures

Each hue keeps one meaning in every figure:

```palette
```

[Figure 0.1](#fig-0-1) teaches the arrow styles with exchanges from our recordings. A solid arrow is a call, and a dashed arrow in the same ink is its reply. The other six styles each mark one kind of event, and the colour of the arrow matches the table above.

```figure
id: fig-0-1
kind: sequence
title: reading a sequence figure in this manual
claim: Each arrow style marks one kind of exchange, and every label is a real name, message, or number from our recorded runs.
caption: Read each numbered row from the tail of the arrow to its head. The note under each label names the style. From capture/lab/B-lifecycle/10-trace.tsv, capture/lab/I-capacity/01-unplanned-full-pool-503.tsv, capture/lab/F-egress/envoy/20-results.txt, and capture/lab/K-kagent/session1/egress-policy-actor.yaml.
```

Sources: manual.json; capture/lab/summary/install-steps.json, capture/lab/G-dataplane/00-install/steps.tsv, capture/lab/M-mac-arm64/02-steps.tsv, capture/lab/A-quickstart/02-steps.tsv, capture/lab/A-quickstart/20-deploy-ate-system.FAILED-no-buildx.log, capture/lab/_scripts/g2-install-envoy.sh, capture/lab/_scripts/m2-install.sh, capture/lab/B-lifecycle/10-trace.tsv; docs/get-started/quickstart.md, cmd/ate-setup/README.md, and cmd/ate-setup/commands.md at v1.0.0.
