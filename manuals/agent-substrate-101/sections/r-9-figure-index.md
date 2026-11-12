# Index of figures

> Every figure of this manual, in order, by the one claim that its caption makes.

Each row links to its figure, and the claim is the `claim:` field of the figure block. A measured number in a figure comes from [our recorded runs](manuals/agent-substrate-101/capture/lab), and the chart figures read [the summary files](manuals/agent-substrate-101/capture/lab/summary) directly. The colours follow the palette of the front matter:

- blue is the Substrate control plane: `ate-api-server`, `ate-controller`, and `ate-idp-server`
- violet is workers and sandboxes: `atelet`, worker pods, gVisor, and microVM
- green is the actor, the workload that you run
- plum is the agent harness and its model calls: kagent and the model
- olive is the client and hosts outside the cluster
- indigo is the dataplane: `atenet-router`, `atenet-egress`, Envoy, and agentgateway
- amber is a lifecycle state or a step between two states
- teal is durable state: Postgres, the object store, and snapshots
- rose is a failure: a crashed actor, a 500, a 503, or lost calls
- grey is outside Substrate: Kubernetes, the node, and the operator

```figure-index
```

Sources: the figure blocks of front.md and of every file under sections/; manual.json (palette)
