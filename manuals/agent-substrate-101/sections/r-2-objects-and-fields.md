# Objects and fields

> Three kinds are Kubernetes objects that describe worker capacity, and every other Substrate object is a record that only the Substrate API returns.

Field names appear here as `kubectl ate -o yaml` prints them, in camel case. The proto file has the same names in snake case. A field marked preview is rejected unless a preview feature is on, as [the flags reference](#s-ref-flags-and-gates) describes.

## Kubernetes kinds, group ate.dev/v1

You manage these three with `kubectl apply`.

### WorkerPool (namespaced)

| Field | Meaning |
|---|---|
| `spec.replicas` | the number of worker pods. Fixed until something changes it. |
| `spec.workerImage` | the worker image, which decides the sandbox runtime that the pod starts |
| `spec.sandboxClasses[].name` | `gvisor` or `microvm` |
| `spec.sandboxClasses[].configRef.name` | a SandboxConfig for that class. Without it the class default applies. |
| `metadata.labels` | the labels of the WorkerPool object. A template selects a pool by these, and each worker of the pool reports them. |
| `spec.template.labels` | labels added to the worker Deployment and its pods. No selector of Substrate reads them. |
| `spec.template.resources` | requests and limits of the worker container. The limits become the capacity that the worker reports. |
| `spec.template.nodeSelector`, `tolerations`, `nodeAffinity`, `priorityClassName`, `annotations`, `serviceAccountName` | passed to the worker pods |
| `status.replicas`, `status.readyReplicas` | observed pods |
| `status.sandboxClasses[].conditions` | a `Resolved` condition for each class, with a reason such as `SandboxConfigNotFound` |

```listing
title: the WorkerPool of the resume experiment
source: capture/lab/C-resume-vs-size/pool.yaml
lang: yaml
note: The WorkerPool document. The Namespace document before it is cut.
---
apiVersion: ate.dev/v1
kind: WorkerPool
metadata:
  name: ballast
  namespace: lab-c
  labels:
    workload: ballast
spec:
  replicas: 2
  workerImage: localhost:5001/ateworker-gvisor@sha256:ad6957f41bccaa8bb5f3eb5b34b7812babb862f1a3187a11578c21a7d799491c
  sandboxClasses:
  - name: gvisor
  template:
    resources:
      limits:
        cpu: "2"
        memory: 3Gi
      requests:
        cpu: 500m
        memory: 3Gi
```

A worker container without limits reports the whole node as its capacity. [Section 4.1](#s-workerpool) shows that case.

### SandboxConfig (cluster)

| Field | Meaning |
|---|---|
| `spec.sandboxClass` | `gvisor` or `microvm` |
| `spec.defaultVersion` | the version that new actors start on |
| `spec.versions[].name` | a version name |
| `spec.versions[].state` | `Enabled` or `Disabled` |
| `spec.versions[].assets` | for each architecture, the files of the runtime with a `url` and a `sha256` |

The annotation `sandboxconfig.ate.dev/is-class-default` marks the default configuration of a class.

### CSIDriverConfig (cluster, used by a preview feature)

| Field | Meaning |
|---|---|
| `spec.driverName` | the CSI driver |
| `spec.controllerEndpoint` | the address of the CSI controller |
| `spec.nodeSocketOverride` | another path for the node socket |
| `spec.tls.enabled`, `spec.tls.usePodIdentity`, `spec.tls.serverName` | TLS for the controller connection |

## Metadata of every API object

| Field | Meaning |
|---|---|
| `metadata.atespace` | the atespace. Empty for a worker and for an atespace. |
| `metadata.name` | the name, unique in its atespace |
| `metadata.uid` | assigned by the server. A new object with an old name gets a new uid. |
| `metadata.version` | grows with each write. An update must name the current value. |
| `metadata.createTime`, `updateTime`, `deleteTime` | timestamps |

## Actor

| Field | Meaning |
|---|---|
| `actorTemplate.atespace`, `actorTemplate.name` | the template of the actor |
| `sourceTag` | the tag that the actor started from, if any |
| `workerSelector.matchLabels` | narrows the selector of the template. A pool must match both selectors (logical AND). A change takes effect at the next resume. |
| `status.state` | one of seven states, as [the states reference](#s-ref-states) lists |
| `status.workerAssignment` | present while a worker holds the actor: `workerPod`, `workerPool`, `workerNamespace`, `workerPodIps`, `nodeName`, `workerEpoch`, `sandboxRuntime` |
| `status.assignedNode` | the node of the worker while the actor runs, or of the local snapshot after a suspend. It stays until the detach (default 30 minutes, `--snapshot-detach-delay`) or a revert. |
| `status.snapshots[]` | the snapshots of the actor, described below |
| `status.lastAssignedGeneration` | the last generation that a suspend assigned. A revert does not lower it, so it can be higher than the generation of the newest kept snapshot. |
| `status.crash.message`, `status.crash.crashTime` | set when the actor enters `ACTOR_STATE_CRASHED`, and cleared by a revert |
| `status.externalVolumes` | preview: the CSI volumes of the actor |

### One entry of status.snapshots

| Field | Meaning |
|---|---|
| `uuid` | the last part of the snapshot address |
| `generation` | a counter. Each suspend adds one. |
| `owner` | `SNAPSHOT_OWNER_ACTOR`, or `SNAPSHOT_OWNER_TAG` for a golden or tagged snapshot that the actor borrows |
| `fidelity` | `SNAPSHOT_FIDELITY_VOLUMES`, `SNAPSHOT_FIDELITY_ROOTFS`, or `SNAPSHOT_FIDELITY_MEMORY` |
| `locality` | the node that has a local copy. Absent after the node copy is removed. |
| `durableSnapshot.state` | `SNAPSHOT_STORAGE_STATE_PENDING` until the upload finishes, then `SNAPSHOT_STORAGE_STATE_COMPLETED` |
| `durableSnapshot.object.snapshotUri` | the address in the bucket |
| `sandboxRuntime` | the class and the version attributes: `architecture`, `cpu_features`, `sandbox_bundle_hash` |
| `actorTemplateUid` | the template that the snapshot was taken under |

After an asynchronous suspend an actor has two entries: the older completed one and the new pending one. [Section 3.4](#s-snapshot-fidelity-and-where-a-snapshot-lives) follows them.

## ActorTemplate

| Field | Meaning |
|---|---|
| `workerSelector.matchLabels` | selects worker pools by the `metadata.labels` of the WorkerPool object, in any namespace |
| `containers[]` | `name`, `image`, `command`, `args`, `env`, `volumeMounts`, `securityContext.capabilities`, `resources` |
| `containers[].wakeupProbe` | `httpGet.path`, `httpGet.port`, `timeoutSeconds`. The resume waits for one success. |
| `volumes[]` | a `name` and one source: `durableDir`, `image.reference`, `systemInfo`, or `external` (preview) |
| `volumes[].systemInfo` | one source: `actorMetadata.items[]` or `trustBundle`. An item has a `path` and a `field`: `ACTOR_METADATA_FIELD_NAME`, `ACTOR_METADATA_FIELD_ATESPACE`, or `ACTOR_METADATA_FIELD_UID`. |
| `resources.limits.cpuMillicores`, `resources.limits.memoryBytes` | required. The worker reserves both while the actor runs. |
| `snapshotConfig.preferredFidelity` | the fidelity of each suspend |
| `snapshotConfig.goldenSnapshotConfig.mode` | `GOLDEN_SNAPSHOT_MODE_ENABLED` or `GOLDEN_SNAPSHOT_MODE_DISABLED` |
| `snapshotConfig.storageLocation` | preview: a snapshot location for this template |
| `goldenEgressPolicy.rules` | preview: egress rules for the golden actor only |
| `status.goldenSnapshotStatus` | `goldenTag`, `snapshotTime`, `errorMessage` |

```listing
title: the template of the 50 MiB ballast actor
source: capture/lab/C-resume-vs-size/tmpl-50.yaml
lang: yaml
note: The whole file.
---
metadata:
  atespace: lab-c
  name: ballast-50
workerSelector:
  matchLabels:
    workload: ballast
containers:
- name: ballast
  image: localhost:5001/ballast@sha256:93dba82ad560e7fc4ccb2a33a63d64713b519a7895ba3fd98130ce789eab7fd3
  command:
  - /ballast
  - --mb=50
  wakeupProbe:
    httpGet:
      path: /readyz
      port: 80
resources:
  limits:
    cpuMillicores: 1000
    memoryBytes: 320864256
snapshotConfig:
  preferredFidelity: SNAPSHOT_FIDELITY_MEMORY
```

## EgressPolicy

One policy belongs to one actor. It has `metadata` and `rules[]`. Each rule has exactly one of three forms.

| Rule form | Fields | Meaning |
|---|---|---|
| `http` | `hostnames`, `ports`, `effects` | plain HTTP to the named hosts. The port defaults to 80. |
| `https` | `hostnames`, `ports`, `effects` | TLS that the gateway intercepts, so it can read and change the request |
| `tlsPassthrough` | `hostnames`, `ports` | TLS that the gateway forwards unread. `ports` is required. |

`ports` is either `all` or a list in `numbers`. `effects.replaceHeaders[]` has `header`, `prefix`, and one source: `credentialUri` for a stored secret, or `actorJwt` with `audiences` and `expirationSeconds`. [Section 6.5](#s-credential-injection) shows both sources.

## Tag, Atespace, Worker, AccessPolicy

| Object | Fields | Meaning |
|---|---|---|
| Tag | `sourceActor`, `scope`, `status.snapshot` | a named copy of a snapshot. `scope` is `TAG_SCOPE_ATESPACE` or `TAG_SCOPE_PUBLISHED`. |
| Atespace | `metadata.name` | a name that groups actors, templates, tags, and one access policy |
| Worker | `workerNamespace`, `workerPool`, `workerPod`, `nodeName`, `labels` | one registered worker pod. Its name is the pod uid. `labels` is a copy of the `metadata.labels` of its WorkerPool. |
| Worker | `status.ips` | the IP addresses of the worker pod, at most one for each IP family |
| Worker | `status.issuedEpoch`, `status.registeredEpoch`, `status.observedEpoch` | the epoch counters of the worker process. A rise of `registeredEpoch` means an earlier process exited, and the server then crashes its actors. |
| Worker | `status.state` | `WORKER_STATE_ACTIVE`, `WORKER_STATE_DRAINING`, or `WORKER_STATE_UNAVAILABLE` |
| Worker | `status.capacity`, `status.allocated` | `cpuMillicores`, `memoryBytes`, and `actors`, as `kubectl ate get worker` prints them |
| Worker | `status.sandboxClasses[]` | the classes and runtime versions that the worker runs and restores |
| AccessPolicy | `bindings[].role`, `bindings[].members` | grants of a role to identities, for one atespace or for the whole install |

Sources: api/infra/k8s/ate/v1/workerpool_types.go, sandboxconfig_types.go and csidriverconfig_types.go, api/ateapi/v1/ateapi.proto (messages ResourceMetadata, Actor, ActorStatus, Snapshot, WorkerAssignment, ActorTemplate, Container, Volume, SnapshotConfig, EgressPolicy, EgressRule, CredentialHeader, Tag, Atespace, Worker, WorkerStatus, AccessPolicy, Binding) at v1.0.0; capture/lab/C-resume-vs-size/pool.yaml, capture/lab/C-resume-vs-size/tmpl-50.yaml, capture/lab/B-lifecycle/22-actor-after-async-suspend.yaml, capture/lab/B-lifecycle/23-actor-after-sync-suspend.yaml, capture/lab/B-lifecycle/25-actor-crashed.yaml, capture/lab/D-durability/46-after-reboot-followup.txt, capture/lab/F-egress/envoy/19b-second-run-passthrough-ports-required.txt.
