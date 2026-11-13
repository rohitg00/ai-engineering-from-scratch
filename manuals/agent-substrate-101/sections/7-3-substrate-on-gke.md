# Substrate on GKE

> Agent Substrate on GKE is an installer and its documentation for a system that you operate in your own GKE Standard cluster, and Google does not run its control plane.

Your team runs GKE, and you read that Agent Substrate is generally available there. You open the cluster page and look for a checkbox. You find none, and `gcloud` has no command for it. This edition does not run Substrate on GKE. This section comes from the Google documentation and the installer code, both read on 2026-11-12, and it says so where that matters. A measured GKE run is the first item planned for the next edition, listed in [Coming in the next edition](#s-next-edition).

When you finish this section, you can say what the GKE installer creates and what it leaves for you to operate. You can also check a cluster against the requirements and find the quota that limits your resume rate.

## What "on GKE" means

Agent Substrate on GKE is open source software that you deploy onto your own GKE Standard cluster {{docs}}. Google gives you an installer, the documentation, and dashboards. Google does not operate the control plane or the database. Both run as pods in your cluster, and your team is on call for them.

| Google gives you | You operate |
|---|---|
| the installer, in the repository `ai-on-gke/substrate-gke` | `ate-api-server`, `ate-controller`, and `ate-idp-server` |
| the documentation and the sizing guidance | the PostgreSQL instance and its disk |
| Cloud Monitoring dashboards | the dataplane and `atelet` on every node |
| the Kubernetes control plane of the GKE cluster | suspend, scaling, upgrades, and every WorkerPool |

The product has no extra charge. You pay the normal GKE price for the cluster, the disks, the buckets, and the image repository that the installer creates {{docs}}.

So a statement that Substrate is a managed capability of Google Cloud goes further than the documentation does. The control plane failure modes in [When a dependency is down](#s-when-a-dependency-is-down) are yours on GKE too.

## What the installer creates

The installer is an interactive program that runs on your machine. It needs `git`, Go, `make`, `kubectl`, the `gcloud` CLI, and `gke-gcloud-auth-plugin`. It also needs Docker with the buildx plugin, because it builds the Substrate images from source and pushes them to your project. It cannot run in Cloud Shell, because the disk there is too small {{docs}}.

```figure
id: fig-7-3
kind: tree
title: what the GKE installer creates
claim: The installer creates cloud resources in your project and installs the same control plane in your cluster that ate-setup installs on kind.
caption: Read top to bottom. The left column is what the setup-gcp tool creates. The right column is what the ate-setup tool installs, and you operate all of it. From the Google Cloud documentation for Agent Substrate on GKE and the installer repository at v1.0.0-gke.0.
```

The installer asks for the image source, the project, the cluster, a bucket name, and the ingress clients. Then it runs two tools. The tool `setup-gcp` creates the cloud resources. The tool `ate-setup` installs the cluster components, and it is the same tool that [Install with ate-setup](#s-install-with-ate-setup) uses on kind.

Four details of the install will cost you time if you miss them.

- **Pass an explicit version.** One page of the documentation says that the installer builds the latest version, and a later paragraph says v1.0.0. Enter the tag `v1.0.0`.
- **Name your ingress clients.** The installer asks for the SPIFFE IDs of the clients that can call the router. The port-forward steps of the Counter demo do not work on such a cluster, because your laptop is not one of those clients.
- **Expect a control plane update on an existing cluster.** The installer enables the `podcertificaterequests` and `clustertrustbundles` APIs. The documentation gives about 10 minutes for that update.
- **Delete the database disk yourself.** The cleanup command does not remove the 500 GiB disk of PostgreSQL. You pay for it until you delete it.

## Requirements

| Subject | Requirement |
|---|---|
| Cluster mode | GKE Standard. Autopilot is not supported. |
| Version | Control plane and all node pools at 1.37 or later. The Extended release channel is not supported. |
| Cluster features | Dataplane V2, Workload Identity Federation for GKE, and Managed OpenTelemetry. The installer turns them on in a cluster that it creates. An existing cluster must already use Dataplane V2. |
| Worker nodes | x86 only, `c3-standard-4` or larger. E2 machine types are not supported. |
| GKE Sandbox | Must be off on the node pools that hold workers. |
| microVM class | Nested virtualization, or an x86 metal machine type. You can set nested virtualization only when you create the node pool. |
| Accelerators | No GPU and no TPU inside an actor. |
| More than about 800 sandboxes on a node | Raise the inotify limits and the neighbour table limits of the kernel. The installer does that only for clusters that it creates. |
| Your account | Seven IAM roles, from Service Usage Admin to Monitoring Editor. |

Two rows deserve a comment. The x86 rule comes from the GKE documentation. An older Google post names Arm machines, and that text does not agree with the documentation, so we follow the documentation. On our Apple silicon laptop the upstream release images ran on arm64, but that run says nothing about GKE.

The GPU row is a limit of Substrate, and GKE cannot remove it. [Limits at v1.0.0](#s-limits-at-v1-0-0) has the detail.

## The quotas and limits that bound your scale

The documentation names these numbers {{docs}}. The planned GKE run will test them.

| Limit | Value | Why you care |
|---|---|---|
| Security Token Service, token exchange | 6,000 requests each minute for a project, by default | Each actor needs a token for its snapshot. Plan for 60 times your peak resumes each second. |
| Actors on one worker | 1,000 by default, the `--max-actors` flag | The real number is lower when CPU or memory fills first. |
| PostgreSQL | one instance | It grows only when you give that instance a larger machine. |
| Boot disk of a node | 100 GiB, 3,600 IOPS, 290 MiB each second | Node copies of snapshots use this disk unless you mount another. |
| Snapshot upload delay, node copy | 5 minutes, 30 minutes | The same defaults that we measured on kind. |

The token quota is easy to miss. It is shared with every other workload in the project that uses Workload Identity Federation. At 200 resumes each second you need 12,000 requests each minute for Substrate alone, which is twice the default. Add the peak of the other workloads. Ask for more quota before the load test.

A pool of microVM workers has one more limit. A microVM worker pod requests the resource `ate.dev/kvm`, and node auto-provisioning cannot see that resource on a pool with zero nodes. Such a pool does not grow from zero. The documentation gives three patterns that keep a node or a buffer ready.

The GKE documentation also says that Substrate does not suspend an idle actor by itself. That agrees with our run on kind, where an idle actor stayed `ACTOR_STATE_RUNNING` for 900 s.

## The dates

| Date | Event |
|---|---|
| 2026-05-20 | Google announces Agent Substrate. |
| 2026-09-11 | GKE release note: available for evaluation and non-production use. Production needs an allowlist. |
| 2026-11-05 | Agent Substrate v1.0.0. |
| 2026-11-06 | The GKE installer has its only release, v1.0.0-gke.0. |
| 2026-11-09 | GKE release note: generally available for GKE Standard clusters at 1.37 or later. |

Text from September 2026 that calls Substrate on GKE a non-production feature is out of date. A Google post dated 2026-11-05 said generally available four days before the release note did. Use the release note date.

## What our runs say about GKE, and what they do not

The control plane on GKE is the same software that we ran on kind. Three of our results are properties of that software, so expect them on GKE. Substrate does not suspend an idle actor. A snapshot is durable only after the upload. PostgreSQL is on every request path.

Our times do not transfer. Our object store was in the cluster, on the same disk as the node. A Cloud Storage bucket is remote, so a resume from the object store on GKE needs a measurement of its own. Run the resume test from [SuspendActor and ResumeActor](#s-suspendactor-and-resumeactor) on your cluster before you promise a number.

```takeaways
- Plan staff for the control plane and PostgreSQL, because Google does not operate them.
- Check the cluster against the requirements table before you run the installer.
- Enter the tag v1.0.0 when the installer asks for a version.
- Raise the token exchange quota to 60 times your peak resumes each second, plus the use of other workloads.
- Delete the PostgreSQL disk yourself after a cleanup.
- Measure resume time on your own cluster, with your own bucket.
```

Sources: Google Cloud documentation, read 2026-11-12: "About Agent Substrate on GKE", "Install Agent Substrate on GKE", "Plan and design Agent Substrate on GKE", "Plan an architecture for AI agent workloads on GKE", and the GKE release notes of 2026-09-11 and 2026-11-09; the repository ai-on-gke/substrate-gke at v1.0.0-gke.0 (README and install.sh); Google Cloud blog posts of 2026-05-20, 2026-09-15 and 2026-11-05; Agent Substrate v1.0.0 release notes; capture/lab/B-lifecycle/10-trace.tsv, capture/lab/M-mac-arm64/80-local.tsv.
