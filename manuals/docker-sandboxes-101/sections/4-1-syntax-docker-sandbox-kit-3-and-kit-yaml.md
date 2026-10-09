# `# syntax=docker/sandbox-kit:3` and kit.yaml

> A v3 kit is an ordinary OCI image whose manifest annotation carries a strict YAML descriptor, which sbx resolves when it creates the sandbox.

Your team wants every Codex sandbox to carry the same three tools, the same two allowed hosts, and the same instructions. A kit declares the tools, the hosts, and the credentials in one file, and the file travels as an image.

When you finish this section, you can read a v3 descriptor line by line and say what the frontend writes into the image. You can also tell which commands build, inspect, and run it.

## One image, one annotation

**Kit:** one OCI image whose manifest annotation `vnd.docker.sandbox.kit.descriptor` carries the kit's declarations, while its layers carry the content {{kitspec §1}}. "a Kit pulls, inspects, and `FROM`s with stock tooling, and an engine that does not read the annotation runs it as an ordinary image" {{kitspec §1}}.

**Workload:** a kit whose layers are a root filesystem and whose image config carries the launch command. A composition has exactly one {{kitspec §1}}.

**Mixin:** a kit whose layers are an overlay applied on a workload's filesystem, zero or more per composition {{kitspec §1}}. A third `kind`, `set`, exists only while authoring: "publishing derives `workload` or `mixin` from the Kits it lists" {{kitspec §4}}.

## The descriptor, line by line

The capture kit wrote one v3 descriptor, a shell workload with an inline recipe and a single network grant:

```listing
title: the v3 descriptor the capture kit wrote
source: capture/fixtures/kits/hello-kit/kit.yaml
lang: yaml
---
# syntax=docker/sandbox-kit:3
schemaVersion: "3"
kind: workload
displayName: hello-kit
description: A shell workload with one network grant, in the v3 descriptor form.
version: "1.0.0"
licenses: [Apache-2.0]
build: |
  FROM docker/sandbox-templates:shell
  COPY HELLO.md /home/agent/HELLO.md
capabilities:
  - type: com.docker.sandbox/network-policy@2
    config:
      runtime:
        allow:
          - example.com
```

The frontend is "dispatched by the descriptor's first line, `# syntax=docker/sandbox-kit:3`" {{kitspec §1.1}}. `schemaVersion` must be exactly the string `"3"`, and `kind` is `workload`, `mixin`, or `set` {{kitspec §4}}. `displayName`, `description`, `version`, and `licenses` are optional display metadata. No `name` field exists, because identity is the reference that a kit is consumed by {{kitspec §1}}.

The `build:` field "carries literal Dockerfile text" {{kitspec §3.2}}. `capabilities` is a list of entries with `type` and `config` {{kitspec §7}}. Here one `network-policy@2` entry allows `example.com` in the `runtime` phase, the agent's steady state {{kitcap network-policy@2}}.

Decoding is strict: "Any unrecognized field anywhere in the document is an error" {{kitspec §1.2}}. The reason is policy: "A misspelled key silently ignored would be a policy silently absent" {{kitspec §1.2}}. [Figure](#fig-4-1) puts the file beside the manifest that the build pushed.

```figure
id: fig-4-1
kind: structure
title: a v3 descriptor and the image manifest that carries it
claim: The frontend copies the hello-kit descriptor into one manifest annotation, derives six more annotations from its fields, and records its own release in built-by.
caption: Read left to right. The left column is capture/fixtures/kits/hello-kit/kit.yaml, and each note says what the row becomes. The right column is the index and the arm64 manifest that the local registry returned, from capture/out/28-index.json and 28-manifest.json. Teal lines are the writes of the frontend.
```

## What the frontend publishes

`docker buildx build ./my-kit -f ./my-kit/my-kit.yaml -t docker.io/<NAMESPACE>/my-kit:1.0.0 --push` builds and publishes a kit {{docs-sbx Publish an image}}. The capture kit ran it against a local registry with a `docker-container` builder (`28-builder.txt`, `28-buildx.txt`), and the registry returned this manifest:

```listing
title: the annotations of the hello-kit manifest
source: capture/out/28-manifest.json
lang: json
note: The config, the layers, and most of the descriptor are cut. The registry stores the descriptor as one JSON string, and the capture kit decodes it and keeps five of its 402 provides entries.
---
  "mediaType": "application/vnd.oci.image.manifest.v1+json",
…
  "annotations": {
    "org.opencontainers.image.description": "A shell workload with one network grant, in the v3 descriptor form.",
    "org.opencontainers.image.licenses": "Apache-2.0",
    "org.opencontainers.image.title": "hello-kit",
    "org.opencontainers.image.version": "1.0.0",
    "vnd.docker.sandbox.kit.built-by": "{\"name\":\"docker/sandbox-kit\",\"version\":\"3.0.0-m.8\",\"revision\":\"129be2ff45e8f9463450eb3cf04ddcb52c2b76e5\"}",
    "vnd.docker.sandbox.kit.capabilities": "com.docker.sandbox/network-policy@2",
    "vnd.docker.sandbox.kit.descriptor": {
      "schemaVersion": "3",
…
      "provides": [
        "deb/adduser@3.153",
…
        "... 397 more derived provides entries"
      ],
…
    "vnd.docker.sandbox.kit.schema-version": "3"
```

The descriptor annotation is "The published descriptor as compact JSON" {{kitspec §9.3}}, with the `build:` text kept. For a workload, the frontend also reads the package database and adds one `deb/` entry per installed package {{kitspec §9.6}}. `schema-version` and `capabilities` repeat two fields, and the `org.opencontainers.image.*` keys copy the display fields {{kitspec §9.3}}. The build staged the sources at `/usr/share/sandbox/kit/kit`, after the stem of `kit.yaml` {{kitspec §10}}.

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
title: inspect builds a v3 source with the host Docker daemon
source: capture/out/13-kit-v3-inspect.txt
lang: text
note: The documentation link at the end of the error is cut. 28-kit-inspect-source.txt repeats the same error.
---
$ sbx kit inspect ./fixtures/kits/hello-kit --json
   → build kit ./fixtures/kits/hello-kit (sbx-kit-src:kit-<id>)
error: build kit ./fixtures/kits/hello-kit: exit status 1 ERROR: failed to build: OCI exporter is not supported for the docker driver. Switch to a different driver, or turn on the containerd image store, and try again. …
[exit 1]
```

The ruling: `sbx kit validate`, `pack`, `push`, and `pull` are v1 and v2 tooling. `pack` refused the directory too, for lack of a `spec.yaml` (`13-kit-v3-pack.txt`). The documentation agrees: "Use Buildx for v3 kits. The `sbx kit pack`, `push`, and `pull` commands are for v1 and v2 kits" {{docs-sbx Publish an image}}.

A v3 kit is consumed by `sbx run` and `--kit`, since "`sbx run` and `sbx create` now accept sandbox kit references as the agent positional" {{rel-sbx v0.42.0}}. The pushed hello-kit still never reached a sandbox, because `kit.allowedSources` defaults to `["docker.io/"]` ([C40](#s-ref-sources-and-the-conflicts-register), `02-settings.txt`) {{rel-sbx v0.34.0}}:

```listing
title: sbx refuses a kit from outside docker.io
source: capture/out/28-run-kit.txt
lang: text
note: The advice after the allowlist value and the second suggestion are cut. 28-kit-inspect.txt shows the same refusal for sbx kit inspect.
---
$ sbx create localhost:15000/m101/hello-kit:v1 fixtures/repo-kit --name m101-v3
error: resolve kits: kit "localhost:15000/m101/hello-kit:v1": kit "localhost:15000/m101/hello-kit:v1" cannot be installed — its source is not in your allowlist; current kit.allowedSources: docker.io/; …
  try: sbx settings set kit.allowedSources '["docker.io/","localhost:15000/m101/"]'
…
[exit 1]
```

The capture kit never changes `sbx settings`, so no capture shows sbx running a v3 kit. Two rules bound the mix. "V3 kits cannot be combined with v1 or v2 kits in the same sandbox" {{docs-sbx Version compatibility}}. And "The built-in agent names, such as `claude` and `codex`, select v2 kits" {{docs-sbx Version compatibility}}. Docker publishes its v3 workloads as `docker/sbx-kit-*`, such as `docker.io/docker/sbx-kit-codex:0.155.1` {{docs-sbx Run a kit}}.

## Where the run and the pages disagree

Five results of the run contradict the specification or the documentation, and rows [C113 to C117](#s-ref-sources-and-the-conflicts-register) of the register cover them. The table prints both sides:

| The page says | The capture shows | Files |
|---|---|---|
| `docker buildx build -f kit.yaml --push` publishes the kit {{docs-sbx Publish an image}} | the default `docker` driver of Desktop 4.94.0 pushed a Docker schema 2 manifest with no annotations | `28-buildx-docker-driver.txt`, `28-manifest-docker-driver.json` |
| the frontend "promotes all four onto the image index whenever the export produces one" {{kitspec §9.3}} | the index has an attestation manifest and no annotations, and the arm64 manifest carries all eight | `28-index.json`, `28-manifest.json` |
| the floating `docker/sandbox-kit:3` never moves for a milestone (the README of the specification) | `:3` resolved to the milestone `3.0.0-m.8` of 2026-10-02 | `28-buildx.txt` |
| "During development, you can pass a local source directory to `sbx` instead" {{docs-sbx Publish an image}} | `sbx kit inspect` of the directory failed: the OCI exporter is not supported for the `docker` driver | `13-kit-v3-inspect.txt`, `28-kit-inspect-source.txt` |
| source-form builds "run inside a shared builder sandbox named sbx-kit-builder" {{help-sbx sbx kit builder}} | that build ran in the host Docker daemon, and the builder status recorded after it reads "not created" | `13-kit-v3-inspect.txt`, `13-kit-builder-status.txt` |

An image without the descriptor annotation is not a kit to any consumer {{kitspec §10}}, so build with a `docker-container` builder. A consumer that finds no annotation on the index reads the platform manifest {{kitspec §9.3}}. The specification calls itself experimental, with a final version targeted for Q4 2026.

The default size of a kit volume stays in dispute ([C12](#s-ref-sources-and-the-conflicts-register)). The v0.39.0 notes say 512 MB {{rel-sbx v0.39.0}}, the research notes say 20 GiB, and this manual prints both. `kit-tck validate` judges a published artifact, `kit-tck inspect` reads it back, and this manual ran neither. [Section 7.4](#s-kit-tck-diagnose-and-the-claims-this-manual-checked) lists the claims it checked instead.

```takeaways
- Start every v3 descriptor with the syntax line and `schemaVersion: "3"`, and write capabilities as a list.
- Build v3 kits with a `docker-container` builder, because the default `docker` driver drops the annotations.
- Add the registry prefix to `kit.allowedSources` before you run a kit from outside Docker Hub.
- Run a v3 workload by its reference, add v3 mixins with `--kit`, and never mix generations.
```

Sources: kitspec §1, §1.1, §1.2, §3.2, §4, §7, §9.3, §9.6, §10 (research/sources/SPEC-v3-at-v3.0.0-m.8.md); kitcap network-policy@2 (research/sources/kit-capabilities.md); research/sources/kit-spec-extras.md (README and RELEASES.md of docker/sandbox-kit-spec, for the frontend tag and the milestone dates); docs-sbx Kits, Use kits, Build and distribute kits (research/sources/docs-sandboxes.md); help-sbx sbx kit builder (research/sources/help-sbx.md); rel-sbx v0.34.0, v0.39.0, v0.42.0 (research/sources/sbx-releases.md); research/conflicts-register.md rows C12, C13, C40, and C113 to C117; capture/README.md (the findings of K28); capture/fixtures/kits/hello-kit/kit.yaml; capture/out/02-settings.txt, 13-kit-v3-validate.txt, 13-kit-v3-pack.txt, 13-kit-v3-inspect.txt, 13-kit-builder-status.txt, 28-builder.txt, 28-buildx.txt, 28-buildx-docker-driver.txt, 28-manifest.json, 28-manifest-docker-driver.json, 28-index.json, 28-kit-inspect-source.txt, 28-kit-inspect.txt, 28-run-kit.txt
