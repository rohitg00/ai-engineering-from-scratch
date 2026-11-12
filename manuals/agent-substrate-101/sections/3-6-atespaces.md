# Atespaces and names

> An atespace groups actors, templates, and tags in the Substrate API, and it is not a Kubernetes namespace, although the two often share a name.

You ran `kubectl get ns` to find where your actors live. You found a namespace with the name of your demo, with worker pods in it and no actor. Then you created a second atespace for a new team, and its template still ran on the pool of the first team. Both results follow from one fact: Substrate keeps two lists of names, and it connects them with labels only.

When you finish this section, you can create an atespace and name an actor and a template in it. You can also select a worker pool from a template, and find a snapshot in the object store from its URI.

## An atespace is not a namespace

**Atespace:** the group that an actor, an ActorTemplate, and a tag belong to in the Substrate API. An atespace is a row in Postgres. It must exist before you create anything in it, and you can delete it only when it is empty {{docs}}.

| Object | Where it lives | How you list it |
|---|---|---|
| Atespace | Substrate API, global | `kubectl ate get atespaces` |
| ActorTemplate, Actor, Tag | Substrate API, in one atespace | `kubectl ate get actors -a <atespace>` |
| Access policy | Substrate API, one for each atespace | [section 5.2](#s-access-policies) |
| WorkerPool, worker pods | Kubernetes, in one namespace | `kubectl get workerpools -n <namespace>` |
| Worker record | Substrate API, global | `kubectl ate get workers` |

Our test setup made both kinds of object with one name. That is our choice, and Substrate did not ask for it.

```listing
title: one namespace, one WorkerPool, and one atespace, all named by us
source: capture/lab/_scripts/c1-ballast-setup.sh
lang: bash
note: Lines from the script that prepared the resume tests. The pool spec and the lines between the three parts are cut.
---
kind: Namespace
metadata:
  name: lab-c
…
kind: WorkerPool
metadata:
  name: ballast
  namespace: lab-c
  labels:
    workload: ballast
…
kubectl apply -f pool.yaml
kubectl ate create atespace lab-c 2>&1 | tail -1
```

`kubectl apply` wrote the namespace and the pool to Kubernetes. `kubectl ate create atespace` wrote one row through `ate-api-server`. The quickstart demo does the same with the name `ate-demo-counter`, so a new user sees one name and assumes one object.

```figure
id: fig-3-6
kind: tree
title: an atespace against a Kubernetes namespace
claim: An atespace holds templates, actors, and tags, a namespace holds worker pools, and only a label selector joins them.
caption: Read each tree from the top down. The left tree is in Postgres and the right tree is in Kubernetes. The dotted arrow is the workerSelector of the template. Names are from our resume tests. From capture/lab/_scripts/c1-ballast-setup.sh and capture/lab/C-resume-vs-size/tmpl-200.yaml.
```

The atespace is the boundary for access. A role in an atespace covers every actor and every template in it, and no grant exists for one actor {{docs}}. Do not use the name of a deleted atespace again. The documentation warns that a request authorized for the old atespace can reach the new one {{docs}}.

## Pool selection crosses namespaces

A template selects its workers with `workerSelector.matchLabels`. The scheduler compares those labels with the labels on the WorkerPool object. It does not read the labels of the pods, and it does not read the namespace of the pool {{docs}}.

Three rules follow from the code and the documentation.

- Only equal labels match. No set expressions exist {{code}}.
- An actor can add its own selector. The scheduler applies both selectors together {{code}}.
- A template with no selector can run on every pool {{docs}}.

So the namespace of a pool is not a fence. A template in any atespace can name the labels of any pool, and Kubernetes RBAC on that namespace does not stop it {{docs}}. We did not run a template against a pool in a different namespace. All our pools shared a name with their atespace.

kagent shows the convention that fills this gap. It writes the name and the namespace of the pool into two labels, and its templates select both.

```listing
title: the selector that kagent writes into its template
source: capture/lab/K-kagent/session1/actor-template.yaml
lang: yaml
note: The last four lines of the file.
---
workerSelector:
  matchLabels:
    kagent.dev/worker-pool-name: kagent-default
    kagent.dev/worker-pool-namespace: kagent
```

The second label looks like a namespace check, and it is a label like every other. A pool in another namespace with the same two labels would match.

The worker list has one filter for each list of names.

```listing
title: the filters of kubectl ate get workers
source: capture/lab/A-quickstart/60-state.log
lang: text
note: Four lines of the help text that the command printed.
---
-a, --atespace string        filter worker pods hosting actors in a specific atespace
…
-n, --namespace string       scope output to a specific Kubernetes namespace
--sandbox-class string   filter by sandbox class (e.g. gvisor, microvm)
-l, --selector string        filter by worker pool labels
```

## Names

Every name in the Substrate API is a DNS label: lowercase letters, digits, and hyphens, at most 63 characters {{code}}. A name is fixed at create time.

| What | Form | Example from our runs |
|---|---|---|
| Actor address | `<atespace>/<name>` | `ate-demo-counter/my-counter-1` |
| Template reference | `<atespace>/<name>` | `lab-c/ballast-200` |
| Actor uid | assigned by the server | `6f80f612-7547-4f5b-b3ab-831595621806` |
| Worker name | the uid of the worker pod | `c572e96d-dd9b-4500-b0e3-880a98d9f61d` |
| Golden tag name | the uid of the template | `b9f97b82-b187-419d-8789-6c8c7b8a6c8c` |
| kagent actor | `session-<session id>` | `session-01a1cf43-d760-747a-b907-5e0640126e4e` |

The actor address is the form that you will read most. Error texts use it, `kubectl ate` takes its two halves as `-a` and the name, and the router reads it from a request header. [Section 6.1](#s-the-router-and-ingress) covers that header.

The uid matters when you delete an actor and create it again with the same name. The new actor gets a new uid. Snapshot paths use the uid, so the new actor cannot resume from the state of the old one {{docs}}.

## The snapshot URI layout we saw

Each snapshot in an actor object has a `snapshotUri`. The atespace and the owner are part of the path.

```listing
title: the two snapshot URIs of my-counter-1 after its first suspend
source: capture/lab/B-lifecycle/22-actor-after-async-suspend.yaml
lang: yaml
note: Two lines of the file. The first is the golden snapshot, and the second is the snapshot of the actor.
---
snapshotUri: gs://ate-snapshots/atespaces/ate-demo-counter/tags/ad19ee28-1519-432a-bcc5-40cf99cce3ca
…
snapshotUri: gs://ate-snapshots/atespaces/ate-demo-counter/actors/6f80f612-7547-4f5b-b3ab-831595621806/snapshots/8faccdff-15cc-493d-8474-5ebcb1c18d56
```

| Owner | Layout |
|---|---|
| A tag | `<location>/atespaces/<atespace>/tags/<tag uid>` |
| An actor | `<location>/atespaces/<atespace>/actors/<actor uid>/snapshots/<snapshot uuid>` |
| An actor, on the node | `/var/lib/ate/snapshots/<actor uid>/local-checkpoint/<snapshot uuid>` |

We saw three details that the layout does not tell you.

- On a kind install the location is `gs://ate-snapshots/`, although the store is the rustfs pod in the cluster.
- kagent sets a location for each template, and its URIs start with `s3://ate-snapshots/kagent/`. That field is a preview feature in the upstream project {{docs}}.
- The last part of a golden URI is the uid of the tag. It is not the name of the tag, which is the uid of the template.

The atespace is in the path for a reason. An object store can grant access by path prefix, so you can give one team read access to the snapshots of one atespace {{docs}}. We did not test such a grant.

Our position: use one name for the atespace and the namespace when one team owns both, as the demos do. Then treat the labels of your pools as the real boundary. Choose them on purpose, and check which templates name them.

```takeaways
- Create the atespace before the first template, with kubectl ate create atespace.
- List actors with kubectl ate, because kubectl get shows pools and pods only.
- Label each WorkerPool on purpose, because any template can select it by label.
- Give every template a workerSelector, so that it cannot run on every pool.
- Read the atespace, the owner, and the uid of a snapshot from its URI.
- Do not use the name of a deleted atespace again.
```

Sources: capture/lab/_scripts/c1-ballast-setup.sh, capture/lab/C-resume-vs-size/tmpl-200.yaml, capture/lab/C-resume-vs-size/pool.yaml, capture/lab/C-resume-vs-size/02-templates.txt, capture/lab/C-resume-vs-size/actor-b200-1-suspended.json, capture/lab/C-resume-vs-size/snapdir-b200-1.txt, capture/lab/A-quickstart/60-state.log, capture/lab/A-quickstart/50-create-actor.log, capture/lab/B-lifecycle/22-actor-after-async-suspend.yaml, capture/lab/B-lifecycle/26-actor-after-revert.yaml, capture/lab/K-kagent/session1/actor-template.yaml, capture/lab/K-kagent/session1/actors-after-turn1.json, capture/lab/D-durability/46-after-reboot-followup.txt. Agent Substrate v1.0.0: api/ateapi/v1/ateapi.proto (ResourceMetadata, Selector, Actor.worker_selector, Worker), docs/reference/glossary.md (Atespace), docs/reference/resource-model.md, docs/reference/api-guide.md (Snapshot Storage Layout, Best Practices), docs/guides/authorization.md (roles and limits).
