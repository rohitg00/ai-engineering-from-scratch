<!-- vendored source (extra, not in the capture list): supporting documents of github.com/docker/sandbox-kit-spec at commit 4be7f4dff4d647f10c51dcdb392ce3fa18dc3e96 (main); fetched 2026-10-08; file text is verbatim, only the file marker lines are added -->

<!-- file: README.md of docker/sandbox-kit-spec @ 4be7f4dff4d6 fetched 2026-10-08 -->

![Docker Sandbox Kit Specification](docs/assets/banner.png)

# Docker Sandbox Kit Specification v3

The Kit v3 descriptor specification, its BuildKit frontend, and the
conformance suites that judge both a published Kit and a runtime that
claims to support one.

## From Dockerfile to Kit

A Dockerfile answers everything about the software itself: how it is
built, what gets packaged, and how it starts — entrypoint, command, user,
environment. That answer was worth a decade of tooling, because the same
bits build, pull, and run the same way on every machine that has ever
heard of an OCI image.

Then we started shipping agents, and an agent is not a static application
workload. A container isolates an application: a thing that runs, does its
job, and touches only what it was handed. An agent is an actor. It decides
what to do next and then does it — to your filesystem, your network, your
databases, your cloud account — with authority you granted on purpose.

That authority is not a flaw to be closed off; it is the point. An agent
that cannot install a dependency, reach an API, or hold a credential
cannot do the job. But every grant trades away a piece of the isolation
you were counting on, which is how the capabilities that make an agent
useful end up dissolving the walls around it.

So the boundary has to move out: from the container to the
**containment** — the machine, the filesystem, the network, the
credentials, everything the agent can reach or change. A sandbox supplies
the part of that a model cannot argue with: its own kernel, a boundary
that is enforced rather than agreed to. But an empty sandbox is not an
environment. Something still has to say which harness runs, which tools
and MCP servers it gets, which skills and instructions shape it, and
exactly what it is allowed to touch.

None of that is a Dockerfile's question. It specifies the inside of the
image completely and the outside not at all, so the other half has lived
in `docker run` flags, a Compose file, a CI config, an onboarding doc, and
whatever the person who set it up still remembers — outside the artifact,
unversioned, and unreviewable. A Kit brings it in: the content and the
authority it asks for, in one image, under one digest.

Which makes authority **diffable**. When the next version of an agent asks
for another credential or another network destination, that is not a
software update — it is a change in authority. It shows up in the diff, it
can stop for approval, and it travels with the thing it describes wherever
that thing runs. Which is also why this is a specification and not a
product feature: a Kit that stops being useful because you ran it
somewhere else is not a trust boundary, it is a lock-in.

**Dockerfiles made software reproducible. Kits make authority reproducible.**

> [!IMPORTANT]
> **This specification is experimental.** It is published to be used and
> argued with, and it will keep moving as implementers find gaps.
>
> Moving is meant to stay additive. Capability types carry their own
> version for exactly this reason: a contract that has to change ships as
> `@2` alongside the `@1` it joins, both stay published, and a descriptor
> names the one it was written against — so Kits that resolve today are
> expected to keep resolving. A descriptor-wide `schemaVersion` bump is
> the last resort for what that lever cannot express.
>
> A final version is targeted for **Q4 2026**, after community feedback.
> That feedback is the point — if a Kit you want to write cannot be
> expressed, or a runtime duty is stated in a way you cannot implement or
> check, please
> [open an issue](https://github.com/docker/sandbox-kit-spec/issues/new/choose).

## What a Kit is

A Kit packages a piece of a working environment — a tool, an agent, a
service — so that a runtime can install it, grant it what it needs, and
combine it with other Kits without knowing anything about it in advance.

There is no Kit media type, no artifact type, no sidecar file. A Kit is one
OCI image where the manifest annotation
`vnd.docker.sandbox.kit.descriptor` carries the Kit's **declarations** and
the layers carry its **content**.

Everything follows from that. A Kit pulls with `docker pull`, gets
inspected with `regctl`, and can be `FROM`ed like any other image. A
registry that has never heard of Kits stores one correctly, and an engine
that ignores the annotation still runs it as an ordinary image. The
declarations travel *with* the content, in the same artifact, under the
same digest: there is no second place to look and nothing to keep in sync.

### Two kinds

| Kind | Its layers are | Per composition |
|---|---|---|
| `workload` | A root filesystem. The image config supplies entrypoint, cmd, env, user, workdir. | Exactly one |
| `mixin` | An overlay that lands on the workload's filesystem. May carry no content at all and only declare. | Zero or more |

A workload is the thing that runs. Mixins add to it — a CLI, a credential
binding, a network rule, a piece of context for an agent.

## Tenets

A few principles decided most of the design. They are worth reading before
the details, because nearly every rule in the specification is one of these
applied to a specific case.

**Ride the ecosystem, don't extend it.** A Kit introduces no new media type,
no artifact type, and no sidecar file, so every registry, scanner, signer,
and mirror already handles one correctly. The cost of a new artifact format
is not writing it — it is the decade of tooling that does not know about it.

**One artifact, one digest.** Declarations live in the manifest of the image
they describe, so a Kit cannot be half-updated: pinning the digest pins the
policy, the content, and the metadata together. A separate file describing
an image is a second source of truth, and second sources drift.

**Declare only what images cannot already express.** The descriptor carries
no top-level identity name, no image reference, no entrypoint or env.
Identity is the reference you consume the Kit by; capability-entry names
are display labels. The runtime contract is the image config. Restating
identity or runtime config would create two answers to one question, and
one of them would be stale.

**One model for every ask.** Resource grants and engine-executed behaviors
are the same kind of request — a typed, versioned entry in `capabilities`.
A host reviews one list to decide what a Kit may do, and a Kit has one way
to ask, so support is a question with a single answer rather than a
patchwork of unrelated fields.

**Fail closed, and fail early.** Unknown descriptor fields are errors rather
than ignored, an unsatisfied requirement stops resolution, and a required
capability the host cannot grant refuses the launch. A permission silently
dropped is indistinguishable from one never requested, and the failure would
surface as behavior instead of an error.

**Composition is a function, not a sequence.** A resolved Kit set is ordered
by its dependency graph rather than by the order arguments were typed, so
the same set always composes to the same image. That is what makes a
composition lockable, reproducible, and worth caching.

**The grammar declares; runtimes behave.** The descriptor states what is
wanted and never how a host provides it, which is why the capability pages —
not the grammar — are normative for runtime behavior. A host that cannot
implement a capability refuses it honestly instead of approximating it.

**Let types evolve on their own clock.** The `@1` in a capability type
versions that type's config schema, so a capability can change shape without
a descriptor grammar bump and hosts can support types the grammar has never
heard of.

For a worked tour — a real Kit, its capabilities, and how a set composes —
see [docs/kit-intro.md](docs/kit-intro.md).

## Layout

- `docs/spec/SPEC-v3.md` — the normative specification: the descriptor
  grammar, the OCI layout, and one page per well-known capability type
  detailing the runtime behavior a supporting runtime implements.
- `spec/` — descriptor types, strict decoding, validation, arg expansion, and
  capability/version parsing. Import as
  `github.com/docker/sandbox-kit-spec/v3/spec`; this package is the single
  source of truth for the grammar, and the Docker Sandboxes runtime imports
  it to read published Kits.
- `schema/kit.schema.json` — the descriptor grammar as a JSON Schema, for
  editor validation and completion. Point the yaml-language-server at it
  with a modeline on the descriptor's second line (the `# syntax=` line
  must stay first):

  ```yaml
  # syntax=docker/sandbox-kit:3
  # yaml-language-server: $schema=https://raw.githubusercontent.com/docker/sandbox-kit-spec/main/schema/kit.schema.json
  ```

  The Go validator remains the validator of record; `spec/schema_test.go`
  pins the schema's constants (need types, enums, field regexes) to the
  spec package so the two cannot drift silently.
- `schema/capabilities/` — one schema file per well-known capability type, named by the
  type (`com.docker.sandbox/volume@1.schema.json`): the `@version` in a
  need type names an addressable config schema, and these are those
  documents — each type owns its config shape, and `kit.schema.json`
  composes them by reference. Config-less types (`privileged@1`,
  `kit-registry@1`) reject every config value. A host-specific type's
  author publishes the equivalent under their own namespace.
- `cmd/frontend/` — the BuildKit gateway frontend dispatched by the
  descriptor's first line, `# syntax=docker/sandbox-kit:3`.
- `skills/` — tool-agnostic agent skills for authoring a v3 Kit and
  migrating a v2 one; [skills/README.md](skills/README.md) says how to
  wire them into an agent.

## How to get started

A guided tour from a published Kit to the local edit-and-run loop. Running
Kits takes the `sbx` CLI (public install via
[Docker Docs](https://docs.docker.com/ai/sandboxes/install/) /
[sbx-releases](https://github.com/docker/sbx-releases)). The current stable
`sbx` release supports Kits v3 in both local and cloud mode (`sbx run …`
and `sbx --cloud …`). Cloud sandboxes use the same Kit references; they do
not mount a host workspace.

Published Kits live as ordinary images on registries. Browse Verified
Publisher Sandbox Kits on
[Docker Hub](https://hub.docker.com/search?type=sbx_kit&badges=verified_publisher).
The `docker` org publishes **v3** Kits (this specification); the `sbx` org
still carries the older **v2** line — do not mix the two. Or author your
own from this checkout.

**1. Install `sbx`.**

```sh
# macOS
brew trust docker/tap
brew install docker/tap/sbx

# Windows
winget install -h Docker.sbx

# Ubuntu (sbx only; or use SBX=1 with get.docker.com for Engine + sbx)
curl -fsSL https://get.docker.com | sudo REPO_ONLY=1 sh
sudo apt install docker-sbx
sudo usermod -aG kvm $USER
# re-login (or: newgrp kvm) so /dev/kvm is usable before sbx run

# Or download platform artifacts from
# https://github.com/docker/sbx-releases/releases
sbx login
```

There is nothing to install for the frontend itself:
[`docker/sandbox-kit:3`](https://hub.docker.com/r/docker/sandbox-kit) is
on Docker Hub, and BuildKit pulls it when it reads the `# syntax=` line.

**2. Run a published Kit.** No build, no push — compose a workload with a
mixin from the `docker` org:

```sh
sbx run docker/sbx-kit-shell:1.0.0 --kit docker/sbx-kit-claude-mixin:2.1.281 .
# same references in cloud (no local workspace path):
# sbx --cloud run docker/sbx-kit-shell:1.0.0 --kit docker/sbx-kit-claude-mixin:2.1.281
```

`shell` is a minimal workload; `claude-mixin` overlays Claude Code onto it.
More v3 Kits from the `docker` org are on
[Docker Hub](https://hub.docker.com/search?type=sbx_kit&badges=verified_publisher)
(filter to that org — `sbx/*` there is still v2).

**3. Push the hello Kit and run it.** From here on you will build Kits from
this checkout. The sandbox runtime resolves Kit *images* from registries, so
an image that only exists in Docker Desktop's local store cannot run — push
to a namespace you own (Docker Hub works), or use Kit *directories* (step 6),
which need no registry at all.

Set your registry namespace once and log in:

```sh
export KIT_REGISTRY=docker.io/<your-hub-username>
docker login
```

`hello` is the smallest workload Kit: a full agent environment with a
startup hook, guidance, and a network policy. `task kit:push` builds
`examples/hello` with the Kit frontend and pushes it as an ordinary image:

```sh
task kit:push KIT=hello TAG=1.0.0 REGISTRY=$KIT_REGISTRY
sbx run $KIT_REGISTRY/sbx-kit-hello:1.0.0 .
```

Inside the sandbox, the Kit is self-describing: `cat
/usr/share/sandbox/kit/hello/kit.yaml` shows the published descriptor,
`kit.dockerfile` the recipe that produced the content, and
`cat /var/log/sbx-kit-startup.log` shows the startup hook's run.
(`task kit:build KIT=hello` builds without pushing — useful for iterating
on a descriptor until it validates, but the result can't run in `sbx`
until it is pushed or consumed as a directory.)

**4. Add the tool Kit — composition.** `tool` is a content-bearing mixin
that `requires` hello: the resolver validates the set is coherent, orders
provider before requirer, and the assembler merges the layers into one
image (cached by the lock — the second run reuses it).

```sh
task kit:push KIT=tool TAG=1.0.0 REGISTRY=$KIT_REGISTRY
sbx run $KIT_REGISTRY/sbx-kit-hello:1.0.0 --kit $KIT_REGISTRY/sbx-kit-tool:1.0.0 .
```

`cat /time.txt` inside the sandbox shows tool's startup hook ran on
hello's filesystem.

**5. Add the gh Kit — binary content.** `gh` is a mixin whose overlay
carries the GitHub CLI as a pinned Nix closure, plus a phased network
policy and a proxy-managed credential. Composing it drops a real binary
into the workload's filesystem:

```sh
task kit:push KIT=gh TAG=2.72.0 REGISTRY=$KIT_REGISTRY
sbx run $KIT_REGISTRY/sbx-kit-hello:1.0.0 --kit $KIT_REGISTRY/sbx-kit-gh:2.72.0 .
```

Inside: `gh --version` works (`/usr/local/bin/gh` resolves into the
overlay's `/nix/store`), and with a `github` secret bound on the host
(`sbx secret set github`), `gh api user` authenticates through the
proxy — the container only ever sees a sentinel token.

**6. The local loop — no registry, no push.** Point `sbx run` at the Kit
directories and the runtime builds them on demand, keyed by source hash,
and loads the results straight into the sandbox runtime:

```sh
cd examples
sbx run ./hello --kit ./gh .
```

Edit `hello/hello.yaml` (say, add an allow entry) and re-run: only hello
rebuilds; unchanged Kits reuse the cache. `SBX_KIT_BUILDER=sandbox` moves
these builds into a dedicated builder sandbox (`sbx kit builder status`
shows it) instead of the host engine. Created with
`--kit-arg buildkitExpose=true`, that sandbox also publishes BuildKit so
the host's own `docker buildx` can attach to it:

```sh
# After the builder sandbox is up, read the published buildkit port from
# `sbx kit builder status`, then:
docker buildx create --name sbx-remote --driver remote \
  tcp://127.0.0.1:<host-port> --use
cd claude && docker buildx build --builder sbx-remote . -f claude.yaml \
  --output type=cacheonly
```

That endpoint builds as root and takes no credential, and `port@1` only
says a host binding *should* be loopback — so it stays off unless asked
for, and is worth turning on only where you know the runtime binds
loopback.

The in-sandbox BuildKit port is 3330 and the engine-store
volume defaults to 20 GiB (`--kit-arg volumeSize=…`);
`--kit-arg buildkitPort=…` moves the port. Raising size does not grow
an already-formatted volume —
recreate the builder sandbox once after changing it. When a Kit is ready
to share, step 3's `task kit:push` is the whole publishing story.

## Building a Kit

```sh
docker buildx build . -f claude.yaml -t docker.io/me/claude-kit:2.1.0
```

A workload Kit's companion must build on a base that provides the runtime's
platform floor — bash, the `agent` user (uid 1000), git, a CA store — which
the hardened `dhi.io/sbx-templates:*` images carry; the workloads under
`examples/` build on them, except `devin` and `wordpress`, whose recipes
say why. A Kit built on a bare distro image builds fine
but fails at agent launch.

A Kit's content recipe lives in one of three places: a companion
`<stem>.dockerfile` next to the descriptor, an inline `build:` block in
the descriptor carrying literal Dockerfile text (see `examples/motd` for
the single-file form), or a `kits:` list naming other Kits (see
`examples/team` — `kind: set`, below). They are mutually exclusive; a
`kind: mixin` Kit with none of them is declaration-only.

The frontend finds the companion `claude.dockerfile` by naming convention,
builds it through `dockerfile.v0` (honoring the companion's own `# syntax=`
directive if it names a foreign frontend), validates the descriptor against
the resulting image, stages guidance content into the image, and attaches the
published descriptor as a manifest annotation. A `kind: mixin` descriptor
with no companion produces a declaration-only image whose single layer carries the published descriptor.

Build-phase args are passed by their Kit-arg name and validated before the
Dockerfile sees them under the declared `buildArg` name:

```sh
docker buildx build . -f gh.yaml --build-arg version=2.99.0 -t gh-kit:2.99.0
```

## Publishing a set as one Kit

A composition worth sharing does not have to stay a command line. A
`kind: set` descriptor names other Kits in `kits:`, and the frontend
resolves them, checks the set is coherent, and merges their layers and
declarations into one ordinary Kit:

```yaml
# syntax=docker/sandbox-kit:3
schemaVersion: "3"
kind: set
displayName: Team environment
version: "1.0.0"
kits:
  - ref: docker.io/me/sbx-kit-shell:1.0.0
  - ref: docker.io/me/sbx-kit-gh:2.72.0
```

```sh
# The registry the set is pushed to and the one it resolves its Kits
# from are separate answers: the first names where this artifact goes,
# the second is baked into the references it merges.
task kit:push KIT=team TAG=1.0.0 REGISTRY=$KIT_REGISTRY \
  BUILD_ARGS="--build-arg registry=$KIT_REGISTRY"
sbx run $KIT_REGISTRY/sbx-kit-team:1.0.0 .
```

The result is a Kit like any other — nothing in the runtime knows it was a
set — and `kind: set` never reaches consumers: publishing derives
`workload` or `mixin` from the Kits it lists. The `kits:` list survives in
the published descriptor, pinned by digest, so the artifact records what it
was built from; inside the sandbox, `ls /usr/share/sandbox/kit/` enumerates
each of their staged sources. They must be published references: the set
has to be resolvable from its manifest alone, not from the directory it was
written in. See [§3.4](docs/spec/SPEC-v3.md#34-kit-set) for the
grammar and [§9.5](docs/spec/SPEC-v3.md#95-merging-a-set) for what the
merge does with each declaration.

Multi-platform builds produce an image index with the descriptor annotation
on every platform manifest:

```sh
docker buildx build . -f claude.yaml --platform linux/amd64,linux/arm64 --push \
  -t docker.io/me/claude-kit:2.1.0
```

## The frontend image

`# syntax=docker/sandbox-kit:3` resolves to
[`docker/sandbox-kit`](https://hub.docker.com/r/docker/sandbox-kit) on
Docker Hub, which BuildKit pulls and caches on the first build that names
it.

Every release also publishes its exact version — `docker/sandbox-kit:3.0.0-m.3`
— which is what a build names when it must resolve the same frontend
every time. The floating `3` moves only when a stable `3.X.Y` is
released, never for a milestone, so until v3 has one the two tags can
name different builds.

Building it yourself is for working on the frontend, not for using it. An
image under that tag in the local store is what a local build resolves,
without a registry pull, which is what makes an unreleased change
testable:

```sh
docker build -t docker/sandbox-kit:3 .
```

While iterating, `task frontend:dev` builds under a fresh tag and prints
the `# syntax=` line to paste, because BuildKit caches frontend
resolution per reference and a reused tag can keep dispatching the
previous binary. `task frontend:push` publishes, guarded.

## Conformance

Two suites judge conformance, and [`docs/spec/conformance.md`](docs/spec/conformance.md)
specifies what each one means. From this checkout, `task` runs the TCK via
`go run`. Released `kit-tck` binaries are attached to each
[GitHub Release](https://github.com/docker/sandbox-kit-spec/releases)
(linux/darwin/windows, amd64/arm64).

```sh
task tck:kit REF=docker.io/me/sbx-kit-gh:1.0.0   # is this artifact a conforming Kit?
task tck:runtime ADAPTER=./my-adapter            # does this runtime behave as the pages require?
```

The Kit checks also run inside the frontend during `docker buildx build`,
so a Kit built here cannot be published malformed. Running them against a
published artifact catches what only the exporter and the registry can do
to it — and judges Kits this frontend did not build.

A registry on loopback is reached over plain HTTP without asking, so a
throwaway `registry:2` works as a target while iterating; `kit-tck validate
--plain-http <ref>` says so explicitly for a TLS-less registry anywhere
else. An artifact that never reached a registry is judged in place from
the `--output type=oci` directory:

```sh
task tck:kit:layout DIR=/tmp/out TAG=sha256:...
```

A runtime is tested through an adapter: an executable implementing seven
verbs. Any language will do.

Both suites report the same way: every finding names the statement it
judged and links to where the specification says it, and the run ends in
a tally of what was checked. Nothing is printed for a check that passed —
`--verbose` lists those too — and `--format json` is the same run as data,
each finding carrying its spec link, for a pipeline that annotates rather
than reads. Color follows the terminal and `NO_COLOR`; `--color` settles
it either way.

```sh
kit-tck validate docker.io/me/sbx-kit-gh:1.0.0 --verbose
kit-tck validate docker.io/me/sbx-kit-gh:1.0.0 --format json
```

`kit-tck inspect` reads a Kit without judging it: the descriptor from its
manifest annotation, and the content recipe it staged at
`/usr/share/sandbox/kit/<stem>/kit.dockerfile` — whichever way that recipe
was authored. It takes the same `--layout` and `--plain-http` as `validate`.

```sh
kit-tck inspect docker.io/me/sbx-kit-gh:1.0.0                  # both, as YAML and Dockerfile
kit-tck inspect docker.io/me/sbx-kit-gh:1.0.0 --dockerfile > gh.dockerfile
kit-tck inspect docker.io/me/sbx-kit-gh:1.0.0 --format json
```

## Development

```sh
task validate   # gofmt + go vet
task test       # all Go tests
```

See [CONTRIBUTING.md](.github/CONTRIBUTING.md) — in particular the note on changing
the grammar, which spans the Go types, the JSON Schema, the normative spec,
and the examples together.

## License

Licensed under the [Apache License, Version 2.0](LICENSE).

<!-- file: docs/kit-intro.md of docker/sandbox-kit-spec @ 4be7f4dff4d6 fetched 2026-10-08 -->

# Introducing Kits

A Kit packages a piece of a working environment — a tool, an agent, a
service — so that a runtime can install it, grant it what it needs, and
combine it with other Kits without knowing anything about it in advance.

This is the worked tour: a real Kit, what its capabilities ask for, and
how a set composes. The concepts behind it — what a Kit is, the two kinds,
and the tenets that decided the design — are on the
[README](../README.md), and the normative rules are in
[SPEC-v3.md](spec/SPEC-v3.md).

## What a Kit looks like

A Kit is two files: the declarations and the recipe that produces the
content. Here is a mixin that adds the GitHub CLI to whatever workload it
lands on.

```yaml
# gh.yaml
# syntax=docker/sandbox-kit:3
schemaVersion: "3"
displayName: GitHub CLI
description: gh from nixpkgs, pinned by commit, as a self-contained overlay
sourceUrl: https://github.com/cli/cli
licenses: [MIT]

kind: mixin

provides: ["gh@2.72.0"]

capabilities:
  - type: com.docker.sandbox/network-policy@1
    config:
      runtime:
        allow: [github.com, api.github.com, uploads.github.com]

  - type: com.docker.sandbox/credential@1
    optional: true
    description: GitHub API access for gh
    config:
      service: github
      phase: runtime
      apiKey:
        name: GH_TOKEN
        proxyManaged: true
        inject:
          - {domain: api.github.com, header: Authorization, format: "Bearer %s"}

  - type: com.docker.sandbox/agent-context@1
    config:
      contentFile: ./gh-context.md
```

Note what is *absent*: no top-level identity name, no image reference, no
entrypoint, no env. A Kit's identity is the reference you consume it by,
and its runtime contract is the image config — where images already keep
those things. Capability-entry names are display labels, not Kit identity.
`provides` states matchable identity, which is a different question from
"what is this file called".

Decoding is strict: any unrecognized field is an error. A misspelled key
would otherwise be a policy silently absent.

The content is an ordinary Dockerfile, named by the same filename stem. It
builds `gh` from a pinned nixpkgs commit and copies the result — the binary
plus its complete closure — into an empty image:

```dockerfile
# gh.dockerfile
FROM nixos/nix:2.35.2 AS build
WORKDIR /src
COPY <<'EOF' flake.nix
{
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/ac62194c3917d5f474c1a844b6fd6da2db95077d";
  outputs = { self, nixpkgs }:
    let
      forAll = f: nixpkgs.lib.genAttrs [ "x86_64-linux" "aarch64-linux" ]
        (system: f nixpkgs.legacyPackages.${system});
    in {
      packages = forAll (pkgs: { default = pkgs.gh; });
    };
}
EOF
RUN nix --extra-experimental-features 'nix-command flakes' build .
RUN mkdir -p /out/nix/store /out/usr/local/bin \
 && cp -a $(nix-store --query --requisites result) /out/nix/store/ \
 && ln -s "$(readlink -f result)/bin/gh" /out/usr/local/bin/gh

# The overlay: gh plus its pinned closure, landing on any base.
FROM scratch
COPY --from=build /out /
ENTRYPOINT ["gh"]
CMD ["--help"]
```

Three things about this recipe are worth copying. It ends at `FROM scratch`,
so the layers are purely the overlay — nothing from the build stage travels,
and the mixin composes onto any workload without dragging a second base
filesystem behind it. It depends on nothing in that workload: the nix
closure carries every library `gh` needs, so the mixin cannot be broken by
the distribution underneath it.

And it sets an entrypoint despite being an overlay, because a Kit is still
an image: `docker run` on this mixin alone runs `gh --help`. Composition
ignores those fields — the workload anchors the runtime contract — so
declaring them costs nothing and makes the artifact useful on its own.

The pinned commit is also why the descriptor declares no version argument.
That pin is the version authority — bumping `gh` means editing it — and
`provides: ["gh@2.72.0"]` reports the result. Kits that *are* configurable
declare `args`, which can be exposed to the build and expanded into fields
like `provides`; see [§6](spec/SPEC-v3.md#6-args).

## Capabilities: one list for everything the Kit cannot supply

A Kit declares what it needs from its host as typed, versioned requests:

```yaml
capabilities:
  - type: com.docker.sandbox/credential@1
    optional: true
    description: GitHub API access for gh
    config:
      service: github
      phase: runtime
```

Resource grants (volumes, ports, devices) and engine-executed behaviors
(lifecycle hooks, agent context) go through the same list, so a host answers
the whole ask through one mechanism — or refuses the parts it does not
understand. A `required` request that cannot be met fails resolution closed;
an `optional` one is skipped and recorded.

The `@1` names the version of that type's *config schema*, so capability
types can evolve without a descriptor grammar bump. Well-known types are
strictly decoded and documented one page each under
[spec/capabilities/](spec/capabilities/com.docker.sandbox); unknown types are
carried opaquely so a host can support its own.

## Composing Kits

You launch a set: one workload plus any number of mixins. A conforming
runtime treats that set as **closed** — every `requires` must be satisfied
from within the set or resolution fails, nothing is fetched implicitly. It
fails on `conflicts`, orders composition by the dependency graph rather than
the order you happened to pass flags in, and insists on exactly one
workload.

Because the result is a pure function of the resolved set, it can be locked,
reproduced, and cached as a single assembled image — and a set worth keeping
can be published as one Kit instead of a command line (below).

## Sharing a whole set

A set you have to retype is not really shareable, so a Kit can take its
content from other Kits instead of from a Dockerfile:

```yaml
# team-claude.yaml
# syntax=docker/sandbox-kit:3
schemaVersion: "3"
kind: set
displayName: Team Claude environment
version: "1.0.0"

kits:
  - ref: docker.io/dockerdev/sbx-kit-shell:1.0.0
  - ref: docker.io/dockerdev/sbx-kit-claude-mixin:2.1.6
    args:
      version: "2.1.6"
  - ref: docker.io/dockerdev/sbx-kit-gh:2.72.0
```

Building this resolves each one, checks the set is coherent, and merges
their layers and declarations into **one ordinary Kit** — so what you
publish is a Kit like any other, and `sbx run <your-set> .` needs no new
machinery to run it. Their network rules union, their hooks concatenate in
dependency order, and their guidance becomes one document. Two of them
asking for incompatible things fails the build rather than picking a
winner.

`kind: set` never reaches a consumer: publishing derives `workload` or
`mixin` from the Kits it lists, because a merged set really is one or the
other. What survives is the `kits:` list, pinned by digest — the record of
how the content was produced, the way an inline `build:` block is.

The trade is worth knowing. A merged set is a *pinned artifact*: one
reference, one digest, one pull, and bumping one of its Kits means
republishing it. A set is also not a way to hide what is inside — each of
their staged sources rides along in the filesystem, and the permission
surface is the union of what they ask for, gated as usual.

## Ways to author one

The descriptor is YAML; the content recipe is ordinary Dockerfile text —
or, for a set, a list of kits. How you connect them is your choice:

1. **Companion pair** — `gh.yaml` beside `gh.dockerfile`, matched by filename
   stem. Dockerfile tooling keeps working on a file that is still just a
   Dockerfile.
2. **Inline `build:` block** — the Dockerfile text embedded in the
   descriptor, so a Kit is a single file.
3. **Comment descriptor** — a Dockerfile carrying its declarations in a
   `# kit:` comment block, so the file is both.
4. **Kit set** — `kits:`, above.

All of them produce ordinary Kit images. A BuildKit frontend, dispatched by
the `# syntax=docker/sandbox-kit:3` line, validates the descriptor, builds
the content, and publishes both as one image.

## Where to go next

- [SPEC-v3.md](spec/SPEC-v3.md) — the normative specification.
- [spec/capabilities/](spec/capabilities/com.docker.sandbox) — one page per
  well-known capability type, normative for runtimes implementing it.
- [`examples/`](../examples) — working Kits, from `hello` (the smallest
  possible workload) through `shell` plus agent mixins.
- [README](../README.md) — building and running Kits locally.

<!-- file: docs/spec/conformance.md of docker/sandbox-kit-spec @ 4be7f4dff4d6 fetched 2026-10-08 -->

# Conformance

This document specifies how a runtime demonstrates that it implements
[SPEC-v3](SPEC-v3.md) and the [capability pages](capabilities/com.docker.sandbox/).

The key words **MUST**, **MUST NOT**, **SHOULD**, and **MAY** are to be
interpreted as in RFC 2119.

Conformance has two halves, and they are independent. A Kit is judged
against the artifact rules; a runtime is judged against the behavior its
capability pages require. A runtime that consumes Kits it did not build is
still responsible only for the second.

## 1. Kit conformance

An artifact conforms when it satisfies [§9](SPEC-v3.md#9-publishing) and
[§10](SPEC-v3.md#10-the-oci-layout). `kit-tck validate <reference>` judges a
published artifact; the reference implementation's BuildKit frontend runs
the same checks before it exports, so a Kit built by it cannot be
published malformed.

Running both matters. Build-time checks see the descriptor, the recipe,
and the filesystem about to be exported, and can point at the authored
line that is wrong. Only a published artifact shows what the exporter and
the registry did with it — and an artifact from a different producer has
no build to check.

## 2. Runtime conformance

A runtime demonstrates conformance by supplying an **adapter**: an
executable implementing the verbs below. The suite drives the adapter and
asserts observable behavior, so a runtime conforms by what it does, not by
how it is written. An adapter **MAY** be a shell script.

```sh
kit-tck runtime --adapter ./my-runtime-adapter
```

### 2.1 Invocation

The suite invokes the adapter as `<adapter> <verb> [arguments…]`. An
adapter **MUST** write diagnostics to stderr so a failure is attributable,
and anything a verb is specified to return to stdout.

Exit status carries meaning beyond success and failure:

| Exit | Means |
|---|---|
| `0` | The verb succeeded |
| `2` | The runtime **refused** the request, deliberately and by policy |
| any other non-zero | The verb failed |

The distinction is load-bearing. Several requirements are satisfied only
by refusing something — a Kit requiring a capability the runtime does not
implement, most importantly — and a suite that accepted any non-zero exit
as a refusal would pass an adapter that fails at everything, including one
that cannot find its fixtures. An adapter **MUST** exit `2` when it
declines a request it understood, and **MUST NOT** exit `2` for an error.

An adapter **MUST NOT** require interactive input.

### 2.2 Verbs

| Verb | Arguments | stdout | Purpose |
|---|---|---|---|
| `capabilities` | — | one capability type per line | What the runtime claims to implement |
| `create` | `<kit-ref>…`, zero or more `--arg name=value` and `--env name=value`, at most one `--skills-host-mode readonly\|off`, at most one `--skills-host-store missing\|empty`, at most one `--ssh-agent <socket>`, at most one `--ssh-known-hosts <file>`, at most one `--git-identity-config <absolute-path>\|off` | one sandbox id | Compose the Kit set and start it |
| `exec` | `<id> -- <argv>…` | the command's stdout | Run a command inside |
| `stop` | `<id>` | — | Stop without discarding state |
| `start` | `<id>` | — | Start a stopped sandbox |
| `recreate` | `<id>` | — | Replace the sandbox's container with a fresh writable layer, preserving only declared volume state |
| `rm` | `<id>` | — | Discard the sandbox |
| `wait-idle` | `<id>` | — | Disconnect the final client session and wait beyond the normal auto-stop grace period |
| `status` | `<id>` | `running` or `stopped` | Observe sandbox state without starting it or attaching a session |
| `host-mounts` | `<kit-ref>` | JSON array of `{id, path, hostPath}` | List retained host directories for the resolved Kit identity |
| `host-mount-read` | `<mount-id> <relative-path>` | the file's bytes | Observe sandbox writes from the host |
| `host-mount-rm` | `<mount-id>` | — | Remove a runtime-owned directory by its opaque listing handle |

`create --env name=value` supplies a container environment override.
Adapters **MUST** apply it after image defaults and Kit argument exports,
before expanding `${{ kit.env.NAME }}` references. An empty value is a
present override; values are literal and are not shell-expanded. These
flags do not change the adapter process's own environment. The
`SPEC-v3 §6/env-expanded` check compares a declared file's content with
its final environment value: an image default without any argument
exports, a distinct argument export, a distinct runtime override, and
an empty override.

`capabilities` is what makes a partial implementation testable: the suite
skips the types a runtime does not claim, and asserts that a Kit
**requiring** an unclaimed type is refused rather than silently
under-provisioned.

`exec` **MUST** proxy the command's exit status as its own, and **MUST
NOT** allocate a TTY. The argv after `--` is passed through unmodified.
It **MUST** run the command as the sandbox's agent identity: several
requirements are about who the sandbox does things as, and an `exec` of
the runtime's choosing would answer for a user the agent never is.

`stop` followed by `start` **MUST** preserve the sandbox's filesystem.
This pair is what separates the lifecycle phases: `install` hooks run once
at create, `startup` hooks on every boot.

`recreate` **MUST** replace the container — discarding the writable layer —
while preserving declared volume state. Because stop/start preserves
everything, it cannot distinguish a volume from an ordinary directory;
recreate is the observation that can, and the suite verifies the layer was
really discarded before crediting anything to the volume.

`wait-idle` and `status` are required only for adapters claiming
`com.docker.sandbox/long-running@1`. `wait-idle` **MUST** exercise a real
client session's connection and disconnection, leave no client sessions
attached, and return only after the runtime's ordinary session auto-stop
grace period has elapsed, with a margin for scheduling. The adapter knows
that period; a fixed suite delay cannot bound every runtime's policy.
A runtime with no session-based auto-stop needs no grace-period wait.

While waiting, the adapter **MUST NOT** use exec, attach, keepalives, or
other operations that reset the idle timer or restart the sandbox. It
**MUST NOT** disable auto-stop or force detached mode to make the check
pass: the runtime under test decides from the descriptor whether to keep
the workload running. Session types with different disconnect paths
**MUST** each be exercised before `wait-idle` returns, with a full idle
interval after each final disconnection.

`status` **MUST** read host-side state without starting, resuming, or
attaching to the sandbox. It reports `stopped` only when the sandbox has
finished stopping; a missing sandbox or a failed observation is an error,
not a stopped state. The suite reads status before probing the background
process, so an exec that implicitly starts a stopped sandbox cannot hide
auto-stop, and reads it again after explicit stop.

### Host-shared directory observation

The `host-mount-*` verbs are required only for adapters claiming
`com.docker.sandbox/host-mount@1`. They use the runtime's ordinary user
interfaces for discovering, reading, and removing host directories.
Adapters **MUST NOT** manufacture storage outside the runtime's
provisioning path to satisfy these checks.

`host-mounts` resolves the Kit reference to the same identity used by
`create`, and returns its retained directories even with no live sandbox.
Each record **MUST** contain a nonempty opaque `id`, its canonical
in-container `path`, and the host location `hostPath` a user can find.
There is one record per path; an empty listing is `[]`, not `null`.
Listing is an observation and **MUST NOT** allocate storage.

The `host-mount-version-v1` and `host-mount-version-v2` fixtures exercise
updates within one published Kit identity. Adapters claiming
`host-mount@1` **MUST** publish or import them as distinct versions of one
suite-owned repository, resolving their supplied fixture references to
those versions for `create` and `host-mounts`. Distinct tags or digests
identify the versions; neither version may be substituted with the
other. The suite writes through the first version, removes its sandbox,
and reads through the second, then verifies writes from the second are
visible when reopening the first. Testing two unrelated local Kit
identities cannot establish this repository identity guarantee.

`host-mount-read` **MUST** read from the host directory independently of
sandbox exec. The suite passes only a relative fixture filename; an
absent file returns a nonzero status. `host-mount-rm` **MUST** remove the
listed directory and its contents so a later create starts empty.

The suite uses fresh in-container paths for each check. It removes only
directories at those paths for the fixture Kits, after removing their
sandboxes; adapters **MUST NOT** interpret cleanup as a request to remove
other Kit directories or user content.

### Git identity binding

An adapter claiming `com.docker.sandbox/git-identity@1` **MUST** accept
`create --git-identity-config <absolute-path>|off`. The suite-owned file
is a transport for a test binding, not a requirement that the runtime
store or discover identity in files. It carries a known name/email pair
in Git config syntax, alongside unrelated settings used as leak probes.

The adapter **MUST** arrange for the runtime to provide that binding for
this create using its normal identity-provisioning interface. It can
translate the test input into runtime settings, an API request or another
binding mechanism. Incomplete values are unavailable, not filled from
other sources; `off` withholds the identity. The option does not grant
the capability: only a Kit requesting it receives the pair.

The adapter **MUST NOT** write a sandbox gitconfig itself to bypass the
runtime's materialization path, or alter the user's real settings. The
suite changes its input between create and restart/recreate; the adapter
**MUST** reflect that change in the runtime binding before those verbs,
so the suite can check that existing sandboxes retain their selection.
Sandbox edits **MUST** remain observable if they incorrectly write back
to that binding: an adapter translating the input into another store
reflects such writes in the suite-owned file before returning from exec.
Otherwise the adapter **MUST NOT** delete or rewrite the suite's input.

The fixture workload ships Git and `kit-tck-git-identity`, with distinct
image identity defaults and an unrelated sandbox alias. Its probe checks
global values, repository-local precedence through a real commit,
preservation of sandbox settings, exclusion of unrelated source settings,
and hook-time captures at creation, stop/start and recreation. Repeated
hook checks clear the startup capture first so an old observation cannot
hide a missing hook. Required and optional fixtures exercise missing
values and withheld identity. The suite never needs the user's real name,
email or signing keys.

After recreation, the hook check reads only the new startup capture:
install hooks do not repeat, and their writable-layer output is discarded.
Workload entrypoint captures are also checked after restart and recreation.
Identity and source-setting leak probes inspect effective Git behavior,
including environment and system configuration, not only global files.

The separate `git-identity@1/source-private` requirement is waived by the
suite: the adapter does not identify every guest path or backend through
which a runtime could expose its identity source. Effective Git probes
cannot detect an unconfigured readable copy at an arbitrary path. The
runtime prohibition still applies; passing these probes does not certify
source confidentiality.

An adapter claiming this capability also supports `selection <id>` using
the record format below. The suite checks that an unavailable optional
identity is recorded as skipped, with its rejected member, and is absent
from selected records.

### 2.3 Known values the suite arranges

Several requirements are about what must **not** appear, and absence
cannot be judged against an unknown value. The suite therefore places
three known values in the adapter's environment before it judges
anything:

| Variable | Meaning for the adapter |
|---|---|
| `KIT_TCK_HOST_SENTINEL` | A host-side value. A runtime that leaks its own environment into a lifecycle hook leaks this with it, which is how "a hook sees only its declared env" is judged. The adapter does nothing with it beyond letting it be inherited. The suite also decorates baseline variables in the adapter's environment — `TERM`, `HOSTNAME`, `OLDPWD`, `SHLVL`, and `_` carry the sentinel, and `PATH` gains a sentinel component — so a runtime copying a host baseline value into a hook is caught by the same scan; baseline values must derive from the image and sandbox. `HOME` and `PWD` are both: they point through a sentinel-named symlink to the real home, functional for credential helpers and relative paths while still betraying host provenance when copied. |
| `KIT_TCK_BOUND_SECRET` | The secret the adapter **MUST** bind for the fixture credential service `kit-tck`. The container **MUST NOT** see this value; a proxy-managed credential with a declared name presents a sentinel in that variable, and an inject-only credential (no name) presents nothing at all. |
| `KIT_TCK_SKILL_NAME` | A skill the adapter **MUST** place in the host's shared skills store for each `create` without `--skills-host-store`, when it claims `com.docker.sandbox/agent-skills@1`. The capability permits no mount when the store is empty or skills are off, so without a known entry the suite cannot tell a mounted store from an empty directory. Before the create rather than before the claim: `capabilities` observes nothing and writes nothing, and a query that seeded a user's store would leave an entry behind on every run that asked what a runtime implements. |

An adapter claiming `com.docker.sandbox/agent-skills@1` **MUST** default
skills to their **most permissive** setting. Access is the narrower of the
host's setting and the Kit's, so a restrictive default makes the Kit's
half unobservable: a read-only mount would prove nothing about whether the
runtime honored a Kit asking for read-only, or merely never offered write
to anyone.

The host's half is judged separately: when `create` carries
`--skills-host-mode`, the adapter **MUST** arrange that host setting for
that sandbox — `readonly` withholds write however much a Kit asked for,
and `off` withholds only the host store. Required and optional
`agent-skills@1` destinations remain selected, and the sandbox starts
without the host mount. Selected `agent-skill@1` bundles still appear at
those paths. Without this input the suite could never observe host-side
narrowing at all. The store the suite uses is its own; a
runtime **SHOULD NOT** point these fixtures at a store a user depends on.

Store availability is independent of sharing policy. For a `create` with
`--skills-host-store missing`, the adapter **MUST** arrange a nonexistent
host store directory; `empty` **MUST** arrange an existing directory with
no entries. These overrides suppress the marker seeding for that create,
not host sharing: the suite leaves sharing enabled to exercise the
runtime's missing/empty-store handling separately from its off setting.
The adapter **MUST** use isolated test state and preserve existing host
content, keep the isolated store until that sandbox is removed, and
restore the ordinary seeded store for subsequent creates without the
flag. Both required and optional discovery destinations remain selected,
and selected bundled skills remain available in either scenario.

The workload fixture declares its working directory as
`/home/agent/workspace`, and the suite reads the agent-context profile
beside it, at `/home/agent/AGENTS.md`. A runtime is free to place
workspaces wherever it likes for its own workloads; for THIS workload, the
declared workdir is the workspace, so the profile's place beside it is a
path the suite can name. The `context-workload` fixture instead declares
an explicit profile directory; the suite passes its `directory` argument
to test both `/home/agent/.codex/AGENTS.md` and
`/home/agent/.kit-tck/context/AGENTS.md`. The adapter passes that argument
through rather than assuming every profile is beside the workspace.
The fixture seeds existing instructions at both destinations; the runtime
preserves them while adding its guidance and Kit index. The
`context-profile` mixin declares an explicit `CLAUDE.md` destination
against the legacy workload, testing directory and filename precedence in
both input orders. The `context-conflict`
mixin declares a differing explicit profile, which composition refuses.

An adapter that cannot bind credentials **SHOULD NOT** claim
`com.docker.sandbox/credential@1`, in which case its checks are skipped.

When `create` carries `--ssh-agent <socket>`, the adapter **MUST** make
the SSH agent listening on that Unix socket the backing agent available
to that sandbox, and only to that sandbox. Without it, no backing agent is
available: a Kit requiring `com.docker.sandbox/ssh-agent@1` is then
refused, and an optional entry is skipped. How the adapter hands the
socket to its runtime is its own business — as the agent a client
forwards, or as the one a managed runtime would supply — so long as the
sandbox relays to this agent and no other. The agent is the suite's,
holding a key generated for the check, so the suite can inspect what
reached it; an adapter **MUST NOT** substitute an agent of its own, or
the user's. An adapter whose runtime cannot be pointed at a given agent
**SHOULD NOT** claim the type.

When `create` carries `--ssh-known-hosts <file>`, a file in OpenSSH's
`known_hosts` format, the adapter **MUST** make those the host keys the
runtime matches `authenticate` destinations against for that sandbox, and
trust no other keys for the names it lists. The suite generates them for a
test server under the reserved name `kit-tck.example`: nothing listens
there, and none is needed, because a session binding is a host key's
signature the suite can make itself. The page requires those keys to come
from outside the sandbox, which is where this file is.

The workload fixture's `kit-tck-ssh-agent` probe speaks the agent
protocol itself and needs `python3` in the image, which the fixture's base
provides.

### 2.4 What the suite guarantees

The suite **MUST** `rm` every sandbox it creates, including after a
failure. It **MUST NOT** assume any state carries between test cases, and
addresses sandboxes only by the ids `create` returned.

### 2.5 Kit references

The suite builds its fixture Kits through the runtime under test, because
a runtime that consumes Kits necessarily has a way to obtain them. A
`create` argument is therefore whatever reference form the runtime accepts
— a local directory, an image reference — and an adapter **MAY** pass it
through unchanged.

## 3. Reporting conformance

A runtime claiming conformance **SHOULD** state which capability types it
implements and publish the suite's output. A runtime implementing a subset
is conforming for the types it claims, provided it refuses what it cannot
provide: silently ignoring a required capability is the one failure the
model cannot tolerate, because the Kit's author declared it precisely
because the Kit does not work without it.

## Capability-group selection controls

Capability groups are descriptor grammar, not an independently claimed
capability. Group checks run when the runtime claims their member types.
The adapter provides these controls without prescribing host approval UI:

- `create ... --reject-capability <type>` arranges a false selection
  answer for that type; repeat the flag for multiple types. Other
  satisfiable claimed types are accepted for the fixture.
- `selection <id>` returns JSON with `selection` (`selected` and
  `skipped` records) and `surface` (the actual effective `spec.Surface`).
  Records carry `path`, `source` (`kit` and original `path`), `members`,
  aligned `memberSources` (each member's original `kit` and `path`), and
  `rejected` member paths. `members` and `rejected` locate entries in the
  consumed descriptor; `memberSources` retains original locations through
  set publication. Names alone are not identities. Paths use
  the descriptor's zero-based `capabilities[i].group.capabilities[j]`
  vocabulary. The adapter translates retained runtime records; it MUST
  NOT recompute selection to answer the observation.
- `selection-policy <id> --reject-capability <type>` changes the
  selection answer for the next recreation of this sandbox, without
  revoking its current grants. Stop/start MUST retain the original
  decision; `recreate` makes a fresh selection using the new answer.

The `groups` fixture distinguishes an optional volume-plus-lifecycle
feature from an independent group with the same label. The checks observe
files, hook ordering, skip attribution, and the effective storage grant.
`groups-required` checks refusal diagnostics; `groups-conflict` checks
that optional groups cannot be discarded to repair a selected conflict;
`groups-failure` checks that an accepted hook's exit is an execution
error, not a skip or preflight refusal.

The conflict checks observe refusal and its source diagnostics. A refused
`create` returns no sandbox ID, and the adapter exposes no effect trace
for a failed create. The suite therefore cannot inspect whether files or
hooks were applied before refusal. The before-application duty remains
required by the specification, with an explicit TCK coverage waiver until
the adapter can expose those effects.

Atomic-selection checks observe final state, so they cannot detect effects
applied during selection and rolled back before observation. The separate
`selection-before-application` duty has an explicit coverage waiver until
an adapter effect trace can judge it. `groups-expanded` checks validation
after create-time argument and environment expansion, including when
policy would reject the optional member. Lifetime checks exercise both initial acceptance and
initial rejection: restart retains the decision and recreation uses the
new policy. Calling `selection-policy <id>` without rejection flags clears
future rejections, allowing the inverse transition.

<!-- file: docs/agent-context-placement.md of docker/sandbox-kit-spec @ 4be7f4dff4d6 fetched 2026-10-08 -->

# Agent context discovery destinations

The example agent workloads and mixins declare explicit
`agent-context@1` profiles so runtime guidance and the Kit index reach the
files their harnesses discover. Staged Kit bodies remain under
`/usr/share/sandbox/kit/`; the discovery profile points at those bodies.

| Harness | Example profile | Discovery constraints |
|---|---|---|
| Codex | `/home/agent/.codex/AGENTS.md` | Global instructions live in `CODEX_HOME`. Project discovery stops at the repository root. `AGENTS.override.md` takes precedence over `AGENTS.md`. |
| Claude Code | `/home/agent/.claude/CLAUDE.md` | User instructions use the Claude configuration directory. ACP enables user, project, and local setting sources. |
| Gemini CLI | `/home/agent/.gemini/GEMINI.md` | Global instructions use the agent home directory; `context.fileName` can change the filename. |
| OpenCode | `/home/agent/.config/opencode/AGENTS.md` | The default global configuration directory is separate from project discovery. `XDG_CONFIG_HOME` and `OPENCODE_CONFIG_DIR` can change it. |
| Docker Agent | `/home/agent/AGENTS.md` | The selected agent needs `add_prompt_files` enabled. Home instructions supplement the nearest project file; `DOCKER_AGENT_KIT_DIR` replaces the home source with its `prompt_files/AGENTS.md`. |
| Cursor CLI | `/home/agent/workspace/AGENTS.md` | Instructions are discovered at the project root. The example declares its image workdir; a runtime using another checkout root needs to configure that destination. |
| Devin CLI | Legacy workspace-sibling `AGENTS.md` | Its configuration directory is known, but an instruction discovery destination has not been verified. Both examples retain their legacy declarations. |

These are the example images' defaults. If a runtime changes an agent's
home, configuration directory, instruction filename, or project root, it
also needs to select a matching profile destination. Absolute directory
configuration does not automatically derive the root of an arbitrary
checkout. Existing user instructions outside runtime-managed sections
are preserved, including a Cursor project's authored `AGENTS.md`.

An agent mixin declares both directory and filename; a tool mixin
contributes only a body. An explicit agent profile takes precedence over
a generic workload's legacy filename, regardless of input order. This
also fixes the shell-based Codex and Claude ACP sets, which declare their
agent profiles explicitly even when composed from older published mixins. Conflicting explicit profiles
are refused: this singleton capability does not express several harness
profiles in one sandbox.

The optional directory extends `agent-context@1` in place. Descriptors
that omit it retain their default placement. Older strict readers reject
new declarations, and a runtime needs to implement the destination,
precedence, and preservation duties before using the updated examples.
This repository defines and tests that contract; it does not contain the
`sbx` runtime handler.

## Sources

- [Codex instruction discovery](https://developers.openai.com/codex/guides/agents-md/).
- [Claude Code memory](https://code.claude.com/docs/en/memory) and
  [Claude ACP user-setting sources](https://github.com/zed-industries/claude-agent-acp/blob/v0.84.0/src/acp-agent.ts).
- [Codex ACP thread startup](https://github.com/zed-industries/codex-acp/blob/v2.0.1/src/CodexAcpClient.ts).
- [Gemini instruction discovery](https://github.com/google-gemini/gemini-cli/blob/c6bccb7ecbf6d8368d995455dd725ed34466faad/docs/cli/gemini-md.md).
- [OpenCode global and project instruction discovery](https://github.com/anomalyco/opencode/blob/v1.18.33/packages/opencode/src/session/instruction.ts).
- [Docker Agent prompt-file lookup](https://github.com/docker/docker-agent/blob/967131349e0ae618bc513815c8560b62e0c0c977/pkg/promptfiles/lookup.go).
- [Cursor CLI instruction files](https://cursor.com/docs/cli/using).
- [Devin CLI public repository](https://github.com/CognitionAI/devin-cli).

The Codex and OpenCode findings match the versions pinned by the examples
(0.159.2 and 1.18.33). Claude ACP and Codex ACP findings match their pinned
adapters (0.84.0 and 2.0.1). Gemini, Docker Agent, and Cursor findings come
from public docs or the source snapshots above; their example templates
do not pin a CLI version. Devin's official docs were unavailable during
verification, so no global destination is inferred from its config path.

<!-- file: RELEASES.md of docker/sandbox-kit-spec @ 4be7f4dff4d6 fetched 2026-10-08 -->

# Releases

Several version axes move independently in this repository; confusing them
is the main hazard. This page says what each one means and what forces it
to change. Schema-3 frontend releases and the Go module major share the
`v3.*` git tag namespace: the module path is
`github.com/docker/sandbox-kit-spec/v3`.

## Version axes

| Axis | Where it lives | Moves when |
|---|---|---|
| Module / schema-3 release | git tags `v3.X.Y` (+ Hub `docker/sandbox-kit:3.X.Y`) | A publish of the Go packages (`spec`, `resolve`, `assemble`, `fetch`, `tck`), the schema-3 BuildKit frontend, and `kit-tck` binaries |
| Schema version | `spec.SchemaVersion`, the descriptor's `schemaVersion: "3"` | The descriptor grammar changes shape incompatibly |
| Capability version | the `@N` in `com.docker.sandbox/<name>@N` | That capability's config schema changes after it has shipped |
| Frontend floating tag | `docker/sandbox-kit:3` | Tracks the highest stable schema-3 frontend release |

A kit's own `version:` and its `provides` entries are a further axis, but
they belong to kit authors rather than to this repository;
[SPEC-v3 §5.2](docs/spec/SPEC-v3.md#52-versions) governs them.

`v3.*` git tags **are** Go module versions for
`github.com/docker/sandbox-kit-spec/v3`. Consumers import packages as
`github.com/docker/sandbox-kit-spec/v3/spec` (and siblings) and resolve
them with `go get github.com/docker/sandbox-kit-spec/v3@v3.X.Y`. The same
tag also publishes the frontend image and attaches `kit-tck` release
assets.

## Module tags

Tag when the Go packages (and the matching frontend / `kit-tck` release)
should be consumable at a new version:
`git tag -a v3.X.Y && git push origin v3.X.Y`. Prefer annotated tags.
Pre-release suffixes (`v3.0.0-m.2`, `v3.0.0-rc.1`) are valid module
versions and trigger the release workflow without moving floating Hub
`:3`.

## Schema version

`schemaVersion: "3"` names the generation of the descriptor grammar.
Decoding is strict ([SPEC-v3 §1.2](docs/spec/SPEC-v3.md#12-strict-decoding)),
in two passes with two mechanisms. The descriptor itself is YAML-decoded
with `KnownFields(true)` (`spec.Decode`), which rejects an unrecognized
top-level field. A capability's `config` survives that pass as a plain
map and is decoded per type later, with `DisallowUnknownFields`
(`spec.DecodeCapabilityConfig`), which rejects an unrecognized key in a
well-known type's config. Config for a type the reader does not know is
the exception at both steps — it stays an opaque map, which is what lets
third-party types travel.

For anything the grammar defines, then, the compatibility question is not
"would an old reader ignore this?" — it would not; it would refuse the
document.

What that buys is a grammar where a descriptor is either understood
completely or rejected loudly. What it costs is that **adding a field is
not free**: a descriptor using one cannot be read by a frontend or
runtime built before it. Adding a field to a capability's config moves
that capability's version, which is the fine-grained lever; moving
`schemaVersion` is for changes that lever cannot express — a top-level
field added, renamed, or removed, or a different meaning for one that
stays. An addition counts: strict decoding means an older reader refuses
a descriptor that uses it.

Moving it is expensive: the frontend image tag follows, every `#
syntax=docker/sandbox-kit:N` line in the wild points at the old one, and
`spec.SchemaVersion` gates decoding. Treat it as a new specification
document (`docs/spec/SPEC-v4.md`) rather than an edit to the current one.

## Capability versions

Each capability type addresses its own config schema by version, so
**the version moves when that config schema changes** — the rule
[SPEC-v3 §7](docs/spec/SPEC-v3.md#7-capabilities) states — and the old
version stays published: `network-policy@1` and `@2` both exist, and a
descriptor states one of them.

"Changes" is not only "gains a field an old runtime would reject on
decode". A field whose meaning, default, or permitted values change is
worse, because an old runtime accepts it and then enforces the wrong
policy — a silent misreading of a permission grant rather than a loud
failure. Both move the version.

The rule has one carve-out worth stating plainly, because it recurs in
review: a capability that has never appeared in a tagged release has no
runtime built against it, so its schema may still change in place. The
moment it ships, that freedom ends.

Adding a whole new capability type is additive and moves nothing.

## Frontend image

Pushing a `v3.X.Y` (or `v3.X.Y-rc.N`) tag runs the release workflow, which
publishes `docker/sandbox-kit:3.X.Y` and, when that tag is the highest
stable `v3.*.*` on the remote, also moves floating `docker/sandbox-kit:3`.
Main commits publish `docker/sandbox-kit:<short-sha>` only.

To publish by hand:

```sh
FRONTEND_PUSH_OK=1 task frontend:push FRONTEND_VERSION=3.0.0
# also move floating :3 (only when this is the intended tip):
FRONTEND_PUSH_OK=1 FRONTEND_PROMOTE_MAJOR=1 \
  task frontend:push FRONTEND_VERSION=3.0.0
```

`FRONTEND_PUSH_OK` is a precondition, not decoration: these tags are the
syntax references descriptors resolve, so publishing is never one
forgotten flag away. Kits name the floating major in their `# syntax=`
line, so `:3` must keep building every descriptor of that generation —
rebuild and promote it whenever the grammar gains something kits may
use, and never repoint it at a frontend that would reject an older v3
descriptor.

## Build stamps

Both binaries carry the tag they were built from and the commit beside
it, in `internal/version`. Neither can read git for itself — GoReleaser
links `kit-tck` from a tagged checkout, and the frontend is linked inside
a Docker build whose context excludes `.git` — so the values are handed
down as linker flags, from `{{.Version}}`/`{{.FullCommit}}` in
[.goreleaser.yaml](.goreleaser.yaml) and from the `VERSION` / `REVISION`
build args in [Dockerfile](Dockerfile). A build nobody stamped says
`dev`, which is what a local `docker build` or `task kit:dev` produces.

The stamp is a reflection of the module tag, not a fourth axis: nothing
here moves on its own. Where it shows up:

| Surface | Form |
|---|---|
| `kit-tck version`, report header, `--format json` | `3.0.0-m.5 (2f9a1c4e)`; the JSON envelope keeps `version` and `revision` apart |
| Frontend build progress | `[internal] load kit descriptor <file> · sandbox-kit 3.0.0-m.5 (2f9a1c4e)` |
| Every kit the frontend publishes | the `vnd.docker.sandbox.kit.built-by` annotation ([SPEC-v3 §9.3](docs/spec/SPEC-v3.md#93-annotations)) |

`frontend:push` stamps the same string it tags the image with, so a
frontend can never report a release it was not published as — the rule
kit tags already follow. Only `kit-tck` feeds its version to spec links,
and it passes the tag alone: a revision is not a ref, and a URL built
from one resolves to nothing.

## Conformance suites and releases

`task tck:runtime ADAPTER=<path>` judges a runtime through its adapter,
and `task tck:kit REF=<ref>` judges a published artifact; `task test:tck`
runs the same runtime suite against the repository's fake adapter, which
is how the suite itself is kept honest. All are versioned with the module
rather than separately — a release of the Go packages is also the release of the
conformance suites, and a suite that gains a check can fail a runtime
that passed the previous tag. That is intended: the check reflects a duty
the specification already stated.

<!-- file: GOVERNANCE.md of docker/sandbox-kit-spec @ 4be7f4dff4d6 fetched 2026-10-08 -->

# Governance

Docker maintains this specification. The people accountable for it are in
[MAINTAINERS](MAINTAINERS); GitHub routes review to them through
[CODEOWNERS](.github/CODEOWNERS).

## How decisions are made

Changes land by pull request with a maintainer's approval. Discussion
belongs in the issue or the pull request, so the reasoning stays next to
the change that carries it.

Anyone may propose a change. A proposal that alters the grammar, a
capability contract, or a conformance duty is judged on whether it can be
stated normatively and checked mechanically — see the rules below — not
on who proposed it.

## What a specification change must carry

The specification is not prose alone: in SPEC-v3 and the capability
pages, every normative statement is anchored and then accounted for — by
a check that judges it or by a recorded waiver saying why it cannot be
judged yet — and the suites fail when that accounting slips. A change to
SPEC-v3 or a capability page therefore arrives with:

- when the change touches the grammar — a descriptor field, a capability
  config — the JSON Schema and the Go types in `spec/` updated together,
  since `spec/schema_test.go` pins one against the other. A page that
  only changes a runtime duty needs neither;
- a `<!-- tck: <id> -->` anchor on every new
  **MUST**/**MUST NOT**/**SHOULD**/**SHOULD NOT**, the four keywords the
  guard reads, and either a check that judges it or a recorded waiver
  explaining what cannot be observed yet;
- for an **observable** runtime duty, a fixture and a fake-adapter
  mutation, so the suite proves the check fails when the behavior is
  absent. A duty the suite cannot observe records a waiver instead, and
  several do.

`docs/spec/conformance.md` is outside that accounting by design: it binds
adapters and the suite itself, which the harness enforces by
construction rather than by anchor.

A change that cannot be checked is not rejected for that reason alone,
but it must say so in its waiver rather than appear covered.

## Versioning

[RELEASES.md](RELEASES.md) describes the version axes and when each one
moves.

## Conduct

Participation is governed by the [Code of Conduct](.github/CODE_OF_CONDUCT.md).
Security reports follow [SECURITY.md](.github/SECURITY.md) rather than public
issues.

<!-- file: NOTICE of docker/sandbox-kit-spec @ 4be7f4dff4d6 fetched 2026-10-08 -->

~~~~
Docker Sandbox Kit Specification
Copyright 2026 Docker, Inc.

This product includes software developed at Docker, Inc.
(https://www.docker.com).
~~~~

<!-- file: MAINTAINERS of docker/sandbox-kit-spec @ 4be7f4dff4d6 fetched 2026-10-08 -->

~~~~
Christian Dupuis <cd@docker.com> (@cdupuis)
~~~~

