# `# syntax=docker/sandbox-kit:3` and kit.yaml

> A v3 kit is an ordinary OCI image whose manifest annotation carries a strict YAML descriptor, which sbx resolves when it creates the sandbox.

Your team wants every Codex sandbox to carry the same three tools, the same two allowed hosts, and the same instructions. A kit declares the tools, the hosts, and the credentials in one file, and the file travels as an image.

When you finish this section, you can read a v3 descriptor line by line and say what the frontend writes into the image. You can also tell which `sbx kit` commands accept it.

## One image, one annotation

**Kit:** one OCI image whose manifest annotation `vnd.docker.sandbox.kit.descriptor` carries the kit's declarations, while its layers carry the content {{kitspec §1}}. "a Kit pulls, inspects, and `FROM`s with stock tooling, and an engine that does not read the annotation runs it as an ordinary image" {{kitspec §1}}.

**Workload:** a kit whose layers are a root filesystem and whose image config carries the launch command. A composition has exactly one {{kitspec §1}}.

**Mixin:** a kit whose layers are an overlay applied on a workload's filesystem, zero or more per composition {{kitspec §1}}. A third `kind`, `set`, exists only while authoring: "publishing derives `workload` or `mixin` from the Kits it lists" {{kitspec §4}}.

## The descriptor, line by line

The capture kit wrote one v3 descriptor, a shell workload with a single network grant:

```listing
title: the v3 descriptor the capture kit wrote
source: capture/fixtures/kits/hello-kit/kit.yaml
lang: yaml
---
# syntax=docker/sandbox-kit:3
schemaVersion: "3"
kind: workload
name: hello-kit
description: A shell workload with one network grant, in the v3 descriptor form.
capabilities:
  com.docker.sandbox/network-policy@2:
    allow:
      - example.com
```

The frontend is "dispatched by the descriptor's first line, `# syntax=docker/sandbox-kit:3`" {{kitspec §1.1}}. `schemaVersion` must be exactly the string `"3"`, and `kind` is `workload`, `mixin`, or `set` {{kitspec §4}}.

Decoding is strict: "Any unrecognized field anywhere in the document is an error" {{kitspec §1.2}}. The reason is policy: "A misspelled key silently ignored would be a policy silently absent" {{kitspec §1.2}}. Read the file above against that rule and two lines fail.

`name` is not a top-level field, because a descriptor carries no identity name {{kitspec §1}}. The `capabilities` block is a list of entries with `type` and `config`, never a map keyed by type {{kitspec §7}}. The frontend never reported either fault, because the recording host could not build the kit. Copy the grammar from `kitspec §2`. [Figure](#fig-4-1) puts the file beside the manifest it would become.

```figure
id: fig-4-1
kind: structure
title: a v3 descriptor and the image manifest that carries it
claim: The frontend copies the descriptor into one manifest annotation, and strict decoding refuses the two lines of hello-kit that the grammar does not define.
caption: Read left to right. The left column is capture/fixtures/kits/hello-kit/kit.yaml, with the two refused rows in rose. The right column is the manifest of kitspec §9.3 and §10, drawn from the specification because the build did not run (capture/out/13-kit-v3-inspect.txt).
```

## What the frontend publishes

`docker buildx build ./my-kit -f ./my-kit/my-kit.yaml -t docker.io/<NAMESPACE>/my-kit:1.0.0 --push` builds and publishes a kit {{docs-sbx Publish an image}}. The frontend sets four manifest annotations {{kitspec §9.3}}:

| Annotation | Value |
|---|---|
| `vnd.docker.sandbox.kit.descriptor` | "The published descriptor as compact JSON" {{kitspec §9.3}} |
| `vnd.docker.sandbox.kit.schema-version` | the `schemaVersion`, always equal to the field inside |
| `vnd.docker.sandbox.kit.capabilities` | the requested types, sorted and comma-joined, an index only |
| `vnd.docker.sandbox.kit.built-by` | "Which frontend build published the Kit, as compact JSON" {{kitspec §9.3}} |

Every kit also stages "the published descriptor at `/usr/share/sandbox/kit/<stem>/kit.yaml`" in a layer {{kitspec §10}}. A consumer reads one manifest and knows a v3 kit by the annotation alone {{kitspec §10}}.

The tag `docker/sandbox-kit:3` moves only to a stable `v3.X.Y` release. At the pin the newest tag is `v3.0.0-m.8` of 2026-10-02, and the specification calls itself experimental, with a final version targeted for Q4 2026. The capability versions move apart from the grammar version: "capability types evolve without a descriptor schema-major bump" {{kitspec §7}}.

## Which commands accept a v3 kit

Conflict [C13](#s-ref-sources-and-the-conflicts-register) asks which generation each command accepts, and the captures settle it:

```listing
title: the v2 tooling refuses the v3 directory
source: capture/out/13-kit-v3-validate.txt
lang: text
---
$ sbx kit validate ./fixtures/kits/hello-kit
error: kit ./fixtures/kits/hello-kit is a v3 source kit and this load path has no kit builder configured; artifact validation failed
[exit 1]
```

```listing
title: inspect routes a v3 source through a Docker build
source: capture/out/13-kit-v3-inspect.txt
lang: text
note: The Docker socket path in the error is cut after the first occurrence.
---
$ sbx kit inspect ./fixtures/kits/hello-kit --json
   → build kit ./fixtures/kits/hello-kit (sbx-kit-src:kit-<id>)
error: build kit ./fixtures/kits/hello-kit: exit status 1 ERROR: failed to connect to the docker API at unix://$HOME/.docker/run/docker.sock…
[exit 1]
```

The ruling: `sbx kit validate`, `pack`, `push`, and `pull` are v1 and v2 tooling. `pack` refused it too, for lack of a `spec.yaml` (`13-kit-v3-pack.txt`). The documentation agrees: "Use Buildx for v3 kits. The `sbx kit pack`, `push`, and `pull` commands are for v1 and v2 kits" {{docs-sbx Publish an image}}. A v3 kit is consumed by `sbx run` and `--kit`, since "`sbx run` and `sbx create` now accept sandbox kit references as the agent positional" {{rel-sbx v0.42.0}}. A v3 source directory is built first, inside the `sbx-kit-builder` sandbox that [the next section](#s-sbx-kit-pack-push-sign-and-verify) describes.

Two rules bound the mix. "V3 kits cannot be combined with v1 or v2 kits in the same sandbox" {{docs-sbx Version compatibility}}. And "The built-in agent names, such as `claude` and `codex`, select v2 kits" {{docs-sbx Version compatibility}}. Docker publishes its v3 workloads as `docker/sbx-kit-*`, such as `docker.io/docker/sbx-kit-codex:0.155.1` {{docs-sbx Run a kit}}. Since v0.34.0 a kit source must match `kit.allowedSources`, whose default is `["docker.io/"]` (`capture/out/02-settings.txt`) {{rel-sbx v0.34.0}}.

One default stays in dispute ([C12](#s-ref-sources-and-the-conflicts-register)). The v0.39.0 notes say "Agent kits that declare a persistent volume without a size now get a 512 MB volume instead of a 50 GB one" {{rel-sbx v0.39.0}}. The research notes recorded 20 GiB from the kit documentation, the vendored `volume@1` page states no default, and this manual prints both.

`kit-tck validate` judges a published artifact, `kit-tck inspect` reads it back, and this manual ran neither. [Section 7.4](#s-kit-tck-diagnose-and-the-claims-this-manual-checked) lists the claims it checked instead.

```takeaways
- Start every v3 descriptor with the syntax line and `schemaVersion: "3"`, and write capabilities as a list.
- Build and push v3 kits with `docker buildx build -f`, and keep `sbx kit pack` for v2.
- Run a v3 workload by its reference, add v3 mixins with `--kit`, and never mix generations.
```

Sources: kitspec §1, §1.1, §1.2, §2, §4, §7, §9.3, §10 (research/sources/SPEC-v3-at-v3.0.0-m.8.md); research/sources/kit-spec-extras.md (README and RELEASES.md of docker/sandbox-kit-spec, for the frontend tag and the milestone dates); docs-sbx Kits, Use kits, Build and distribute kits (research/sources/docs-sandboxes.md); rel-sbx v0.34.0, v0.39.0, v0.42.0 (research/sources/sbx-releases.md); research/conflicts-register.md rows C12 and C13; capture/fixtures/kits/hello-kit/kit.yaml; capture/out/02-settings.txt, 13-kit-v3-validate.txt, 13-kit-v3-pack.txt, 13-kit-v3-inspect.txt
