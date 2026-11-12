# Install with ate-setup

> Install from the release images: `deploy ate-system` took 162 s that way and 266 s from source, after a failure that the upstream quickstart does not mention.

You follow a quickstart on a clean machine. The third command runs for almost three minutes and then stops with an error from Docker about a flag you never typed. We hit that error on our first install, and you do not need to.

When you finish this section, you can install Agent Substrate v1.0.0 on a kind cluster from the release images. You can also say what the build from source needs, and fix the install errors we hit.

## What you need

- Linux or macOS with Docker. On Apple silicon we used Docker Desktop with 10 CPU and 8 GB.
- Go 1.27. The checkout asks for toolchain `go1.27.3`, and Go downloads kind for you {{code}}.
- `git` and `kubectl`.
- About 13 GB of disk. Our guest used 13 GB in all after this install, with the operating system.

**Installer:** `ate-setup` is the Go program in the checkout that installs and removes Agent Substrate. The release has no `ate-setup` binary, so you run it with `go run` from a checkout of the tag {{docs}}. The manifests also come from that checkout, so check out the tag that you install.

On Linux we raised two inotify limits before the install, because many pods on one node use many watches:

```bash
sudo sysctl -w fs.inotify.max_user_instances=8192 fs.inotify.max_user_watches=1048576
```

## Create the kind cluster

Clone the tag, then run the cluster script from the repository root:

```bash
git clone --branch v1.0.0 https://github.com/agent-substrate/substrate.git
cd substrate
hack/create-kind-cluster.sh
```

The script does more than `kind create cluster`. Substrate needs three settings that a plain kind cluster does not have {{code}}:

- It starts a local image registry named `kind-registry` on `127.0.0.1:5001`.
- It turns on three Kubernetes preview features: `ClusterTrustBundle`, `ClusterTrustBundleProjection`, and `PodCertificateRequest`. Substrate gives every pod its certificate through them.
- It looks for `/dev/kvm`. With KVM, the node can run the microVM sandbox class. Without KVM, only gVisor works.

The script deletes an existing kind cluster with the same name before it creates the new one. The default name is `kind`. Set `KIND_CLUSTER_NAME` if you already have a cluster with that name.

## Install the control plane from the release images

Tell `ate-setup` that the target is kind, then deploy:

```bash
export ATE_INSTALL_KIND=true
go run ./cmd/ate-setup deploy ate-system \
  --credential-provider='{"name":"k8s.io"}' \
  --ingress-allowed-spiffe-ids=spiffe://cluster.local/ns/ate-system/sa/atenet-client \
  --image-repo ghcr.io/agent-substrate/substrate --image-tag v1.0.0
```

Each flag has a reason {{docs}}:

- `ATE_INSTALL_KIND=true` selects the kind profile: the kind overlays, the local registry, and the object store in the cluster. Export it in every shell that runs `ate-setup`.
- `--credential-provider` is required. The value `{"name":"k8s.io"}` deploys the bundled provider that reads Kubernetes Secrets. [Section 6.5](#s-credential-injection) uses it.
- `--ingress-allowed-spiffe-ids` lists the clients that the router lets through. With no value, no client reaches any actor. The identity in this command is the one that `kubectl ate proxy` presents.
- `--image-repo` and `--image-tag` install published images. Each of the two needs the other.

The installer prints every setting first, and then one line for each step. These lines tell you that the images came from the registry and that the install is complete:

```listing
title: the install from the release images
source: capture/lab/G-dataplane/00-install/20-deploy-ate-system-prebuilt.log
lang: text
note: Seven lines from 140. The settings table, the secrets, and the other rollout lines are cut.
---
>> Downloading kata-static 4.3.1 (amd64)...
>> Downloading cloud-hypervisor v53.0 (cloud-hypervisor-static)...
…
[step]: images: pre-built from ghcr.io/agent-substrate/substrate, tag v1.0.0
…
[step]: Waiting for ATE system components to be ready...
  (rollout status deployment/ate-api-server took 0.005s)
…
  (rollout status daemonset/atelet took 0.003s)
  (rollout status deployment/k8s-credential-provider took 0.003s)
```

The first two lines show a download that the release images do not remove. The installer fetches the guest files of the microVM class from GitHub on every install. The installer documents `--sandbox-classes=gvisor` to install gVisor only {{docs}}. We did not run that flag.

## Deploy the counter demo

The demo gives you a WorkerPool, a template, and an atespace to test with:

```bash
go run ./cmd/ate-setup deploy demo counter
```

This step builds two images with ko and pushes them to `kind-registry`, also on the release path. The release images leave out the demos {{docs}}. The step ends when the golden snapshot of the `counter` template is ready.

## What we measured

[Figure 2.1](#fig-2-1) shows the steps of both x86 installs.

```figure
id: fig-2-1
kind: chart
title: install steps from the release images and from source
claim: From the release images deploy ate-system took 162 s, and from source it failed after 163 s and then took 266 s.
caption: Each bar is one step of one install. The two installs ran on two x86 guests of different sizes. The rose bar is the failed step. From capture/lab/summary/install-steps.json.
```

**We measured** the release-image install once on an x86 server guest with 16 vCPU and 23 GB. The kind cluster took 55 s, `deploy ate-system` took 162 s, and `deploy demo counter` took 94 s. The disk held 13 GB afterwards.

**We measured** the build from source once on an x86 server guest with 24 vCPU and 47 GB. The first `deploy ate-system` failed after 163 s. After we installed one package, the same command took 266 s, and the demo took 47 s. The disk held 18 GB afterwards.

**We measured** the release-image install once on an Apple silicon laptop under Docker Desktop. The kind cluster took 119 s, and `deploy ate-system` took 702 s. The longest wait in its log was 178 s for the object store pod. The kind node held 2.7 GiB of memory after the install.

The two x86 guests differ in size, and the smaller one ran the faster install. So the difference comes from the path. The laptop is another machine on another network, so keep its seconds apart from the seconds of the guests.

## What the build from source costs

Leave out `--image-repo` and `--image-tag`, and `ate-setup` builds every image from the checkout. The upstream quickstart shows that form. It lists Go, `kubectl`, and Docker as the things you need {{docs}}. On Ubuntu 24.04 with the stock Docker package, that list is one item short:

```listing
title: the source install without the Docker buildx plugin
source: capture/lab/A-quickstart/20-deploy-ate-system.FAILED-no-buildx.log
lang: text
note: The docker usage text between the two lines is cut.
---
unknown flag: --platform
…
Error: while building the envoy-dataplane image: exit status 125
```

The Envoy dataplane image is built from a Dockerfile with `docker buildx`. The other images are built with ko. On Ubuntu the fix is one package:

```bash
sudo apt-get install -y docker-buildx
```

The second cost is a Rust compile. The Envoy image contains a Rust module for the egress policy. The build clones the Envoy repository and compiles that module:

```listing
title: the Rust module in the source build
source: capture/lab/A-quickstart/22-deploy-ate-system-retry.log
lang: text
note: Four lines from the build of the Envoy dataplane image. About 90 dependency lines are cut.
---
#11 0.323     Updating git repository `https://github.com/envoyproxy/envoy`
…
#11 53.04    Compiling proc-macro2 v1.0.107
…
#11 91.89     Finished `release` profile [optimized] target(s) in 1m 31s
…
#11 DONE 92.2s
```

That one build step took 92 s of the 266 s. You pay it again when the build cache is empty. Build from source when you change Substrate itself. For every other install, use the release images.

## Change the dataplane later

The same command switches a running cluster from Envoy to agentgateway. Add one flag and run it again:

```bash
go run ./cmd/ate-setup deploy ate-system \
  --credential-provider='{"name":"k8s.io"}' \
  --ingress-allowed-spiffe-ids=spiffe://cluster.local/ns/ate-system/sa/atenet-client \
  --image-repo ghcr.io/agent-substrate/substrate --image-tag v1.0.0 \
  --atenet-dataplane=agentgateway
```

**We measured** this switch once on the x86 server guest with 16 vCPU. It took 32 s and needed no new cluster. [Section 6.6](#s-the-dataplane-choice) compares the two dataplanes.

## If the install fails

| What you see | Cause | Fix |
|---|---|---|
| `unknown flag: --platform`, then `exit status 125` | A build from source without the Docker buildx plugin | Install the plugin, or install from the release images |
| The installer stops and prints `retry with: ate-setup deploy ate-system --config` and a file | A step failed, and the installer saved the settings of the run | Fix the cause, then run the printed command |
| `kubectl` shows pods you do not know | The kubeconfig context is not `kind-kind` | Run `kubectl config use-context kind-kind` |

The last row happened to us on the laptop. After a restart of Docker Desktop, `kubectl` pointed at the cluster that Docker Desktop includes, and our first test ran there.

To remove everything, delete the cluster and the registry:

```bash
./hack/delete-kind-cluster.sh
```

Old guides for v0.x use install scripts that no longer exist. [Section 8.4](#s-upgrade-and-stale-advice) lists what changed.

```takeaways
- Check out the v1.0.0 tag before you run ate-setup, because the manifests come from the checkout.
- Pass --image-repo and --image-tag together to install the release images.
- Export ATE_INSTALL_KIND=true in every shell that runs ate-setup.
- Install the Docker buildx plugin before you build from source.
- Pin the kubectl context to kind-kind before you test.
```

Sources: capture/lab/summary/install-steps.json, capture/lab/G-dataplane/00-install/steps.tsv, capture/lab/G-dataplane/00-install/20-deploy-ate-system-prebuilt.log, capture/lab/G-dataplane/00-install/60-state.log, capture/lab/G-dataplane/01-switch-in-place/11-timing.txt, capture/lab/A-quickstart/02-steps.tsv, capture/lab/A-quickstart/20-deploy-ate-system.FAILED-no-buildx.log, capture/lab/A-quickstart/21-install-buildx.log, capture/lab/A-quickstart/22-deploy-ate-system-retry.log, capture/lab/A-quickstart/30-deploy-counter.log, capture/lab/A-quickstart/60-state.log, capture/lab/M-mac-arm64/02-steps.tsv, capture/lab/M-mac-arm64/20-deploy-ate-system.log, capture/lab/M-mac-arm64/60-state.log, capture/lab/_scripts/a1-provision.sh, capture/lab/_scripts/a2-quickstart.sh, capture/lab/_scripts/a3-retry.sh, capture/lab/_scripts/g2-install-envoy.sh, capture/lab/_scripts/g6-switch-agw.sh, capture/lab/_scripts/m2-install.sh; docs/get-started/quickstart.md, cmd/ate-setup/README.md, cmd/ate-setup/commands.md, hack/create-kind-cluster.sh, and go.mod at v1.0.0.
