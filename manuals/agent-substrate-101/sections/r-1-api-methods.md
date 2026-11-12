# API methods

> The Substrate API at v1.0.0 is two gRPC services with 50 methods, and four plugin services that a third party can implement.

`ate-api-server` serves both services on one port, 443 in the Service named `api` in `ate-system`. The proto package is `substrate.ateapi.v1`, so the full name of a method is `/substrate.ateapi.v1.Control/GetActor`. The Go package is `go.ate.dev/substrate/api/ateapi/v1`. A client authenticates as [section 5.1](#s-client-authentication) describes, and each `Control` method is checked against the access policies of [section 5.2](#s-access-policies).

The tables give each method, what it does at v1.0.0, and the `kubectl ate` command that calls it. A dash means that the CLI has no command for it. Our runs called every actor method, the egress policy methods, and the create, get, and list methods for templates, atespaces, and workers. `UpdateActor` ran in the template move of [section 3.1](#s-actortemplate-and-the-golden-snapshot). Our runs also created, replaced, and deleted an atespace access policy and read the global one, in [section 5.2](#s-access-policies). Our runs created no tag.

## Control: actors

| Method | What it does | `kubectl ate` |
|---|---|---|
| `CreateActor` | Creates an actor from a template or a tag. The new actor is `ACTOR_STATE_SUSPENDED`. | `create actor` |
| `GetActor` | Returns one actor with its state and snapshots. | `get actor <name>` |
| `ListActors` | Lists actors in one atespace or in all. | `get actor` |
| `UpdateActor` | Changes the template or the worker selector of an actor. Needs the `uid` and the `version`. | `update actor` |
| `SuspendActor` | Checkpoints a running actor to a new snapshot. A suspended actor is returned unchanged. `options.mode` is asynchronous by default. | `suspend actor` |
| `ResumeActor` | Resumes a suspended actor from its latest snapshot. A running actor is returned unchanged, with `resumed=false`. The router calls it for every request and relies on that reply. | `resume actor` |
| `RevertActor` | Returns an actor to `ACTOR_STATE_SUSPENDED` at its durable snapshot. Accepts a crashed actor, a running actor, and a suspended actor with a node-local snapshot. Also accepts an actor already in `ACTOR_STATE_REVERTING`, for a retry. That last case is from the code, and a run is in progress. | `revert actor` |
| `DeleteActor` | Stops the workload, releases the worker, and removes the record. Accepts any state. | `delete actor` |
| `MintActorJwt` | Issues a token that states the identity of an actor. Only the egress gateway is allowed to call it. | - |

## Control: egress policies

An egress policy is one object under one actor. [Section 6.2](#s-egresspolicy-and-default-deny) explains its rules.

| Method | What it does | `kubectl ate` |
|---|---|---|
| `CreateActorEgressPolicy` | Creates the policy of an actor. | `create egress-policy <actor> -f` |
| `GetActorEgressPolicy` | Returns the policy. | `get egress-policy <actor>` |
| `UpdateActorEgressPolicy` | Replaces the policy. Needs `metadata.uid` and `metadata.version`. | `update egress-policy <actor> -f` |
| `DeleteActorEgressPolicy` | Deletes the policy. The actor returns to default deny. | `delete egress-policy <actor>` |

## Control: templates, tags, and atespaces

| Method | What it does | `kubectl ate` |
|---|---|---|
| `CreateActorTemplate` | Creates a template. A reconciler then builds its golden snapshot. | `create actor-template -f` |
| `GetActorTemplate` | Returns one template with the status of its golden snapshot. | `get actor-template <name>` |
| `ListActorTemplates` | Lists templates. | `get actor-template` |
| `DeleteActorTemplate` | Deletes a template, its golden actor, and its golden tag. | `delete actor-template` |
| `CreateTag` | Gives a name to a copy of the durable snapshot of a suspended actor. Uploads the snapshot first if it is not uploaded. | `create tag --actor` |
| `GetTag` | Returns one tag. | `get tag <name>` |
| `ListTags` | Lists tags. | `get tag` |
| `UpdateTag` | Changes the scope of a tag between `atespace` and `published`. | `update tag --scope` |
| `DeleteTag` | Deletes a tag and its snapshot. Actors that still start from the tag cannot resume afterwards. | `delete tag` |
| `CreateAtespace` | Creates an atespace. | `create atespace` |
| `GetAtespace` | Returns one atespace. | `get atespace <name>` |
| `ListAtespaces` | Lists atespaces. | `get atespace` |
| `DeleteAtespace` | Deletes an empty atespace. Fails while an actor or a tag remains. | `delete atespace` |

## Control: workers

`ate-controller` and `atelet` call most of these. An operator reads workers and rarely writes them.

| Method | What it does | `kubectl ate` |
|---|---|---|
| `ListWorkers` | Lists workers with capacity and reserved resources. | `get worker`, `top worker` |
| `GetWorker` | Returns one worker. | `get worker <name>` |
| `ListWorkerActorAssignments` | Lists the actors on one worker. | - |
| `CreateWorker` | Registers a worker when its pod has an address. The worker starts as unavailable. | - |
| `UpdateWorker` | Updates the pool state that the controller observed. | - |
| `DeleteWorker` | Removes a worker record. | - |
| `DrainWorker` | Marks a worker as terminating. The scheduler places no new actor on it. One-way. | - |
| `MarkWorkerAvailable` | Moves an unavailable worker to active. | - |
| `MarkWorkerUnavailable` | Moves an active worker to unavailable, for example while its pod is not ready. | - |

## Control: access policies

| Method | What it does | `kubectl ate` |
|---|---|---|
| `GetGlobalAccessPolicy` | Returns the one policy for the whole install. | `get access-policy --global` |
| `CreateGlobalAccessPolicy` | Creates it. The owners named at install can always do this. | `create access-policy --global -f` |
| `UpdateGlobalAccessPolicy` | Replaces it. Empty bindings remove every grant except those of the install owners. | `update access-policy --global -f` |
| `GetAtespaceAccessPolicy` | Returns the policy of one atespace. | `get access-policy -a` |
| `CreateAtespaceAccessPolicy` | Creates it. | `create access-policy -a -f` |
| `UpdateAtespaceAccessPolicy` | Replaces it. | `update access-policy -a -f` |
| `DeleteAtespaceAccessPolicy` | Deletes it. | `delete access-policy -a` |

The global policy has no delete method.

## WorkerService: for atelet only

`atelet` on each node calls these eight methods. A client of yours never does. They explain log lines and states that you see.

| Method | What it does |
|---|---|
| `AcquireWorkerEpoch` | Gives a worker process a new epoch number when it starts. |
| `RegisterWorker` | Records that the worker process runs under that epoch. Actors from an older epoch become crashed. |
| `SetWorkerSandboxRuntimes` | Reports which sandbox classes and versions the worker can run and restore. |
| `MintWorkerActorCertificate` | Issues the certificate that an actor shows to the dataplane. |
| `MintWorkerActorJwt` | Issues an actor token for the worker. |
| `RequestActorSuspend` | Asks the control plane to suspend an actor on behalf of the worker. `atelet` forwards the call from a worker-side library, and no binary at v1.0.0 imports that library. So nothing triggers it. |
| `ReportActorSnapshotState` | Reports that a pending snapshot reached the bucket, or that the actor left the node. |
| `ReportActorCrashed` | Reports that a sandbox died. The actor moves from running to crashed. |

## Plugin services

Substrate calls these services over gRPC. The repository includes one implementation of each, and another party can supply its own.

| Service | Methods | Who calls it | Purpose |
|---|---|---|---|
| `NodeProvider` | `FetchSnapshot`, `UploadSnapshot` | `atelet` | moves snapshot files between a node and the bucket |
| `ControlProvider` | `CleanupSnapshot`, `CopySnapshot` | `ate-api-server` | deletes a snapshot, and copies one for a tag |
| `AssetProvider` | `FetchAsset` | `atelet` | downloads sandbox runtime files |
| `CredentialProvider` | `FetchSecret` | the egress gateway | returns the secret that replaces a header, as [section 6.5](#s-credential-injection) shows |

## Conventions that every method shares

- **Names:** an object is addressed by an atespace and a name. Workers and atespaces have a name only.
- **Preconditions:** each object has `metadata.uid` and `metadata.version`. An update or a guarded delete that names an old version fails with `ABORTED`.
- **Wrong state:** a lifecycle call from a state that it does not accept fails with `FAILED_PRECONDITION`. A resume of a crashed actor is the case that we recorded.
- **Lists:** list methods take `page_size` and `page_token`.
- **Deadline:** the server ends any call after 10 minutes.
- **Preview fields:** a field behind a preview feature is rejected unless the server enables it and the client sends the header `Ate-Preview-Allowed: true`.

Sources: api/ateapi/v1/ateapi.proto (services Control and WorkerService, and the request messages), api/objectstore/v1/objectstore.proto, api/credprovider/v1/credprovider.proto, cmd/ateapi/main.go (the port and the deadline), cmd/kubectl-ate/internal/cmd/ (the command for each method) and docs/dev/preview-gates.md at v1.0.0; capture/lab/B-lifecycle/20-trace-ops.tsv, capture/lab/F-egress/envoy/20-results.txt, capture/lab/A-quickstart/60-state.log, capture/lab/K-kagent/session1/ (the methods that our runs called).
