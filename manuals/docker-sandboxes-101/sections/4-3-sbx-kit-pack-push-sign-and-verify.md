# `sbx kit pack`, `sbx kit push --sign`, and `sbx kit verify`

> The `sbx kit` commands package, sign, push, verify, and show provenance for v1 and v2 artifacts, and `kit add` appends a mixin to a running sandbox.

You wrote a v2 mixin that installs `tree` and drops a `HELLO.md` into the workspace. A colleague wants it without cloning your repository, and your security team wants to know who signed it. The `sbx kit` commands cover both, as long as the kit is v1 or v2.

When you finish this section, you can validate and pack a v2 kit, and describe what `push --sign` attaches to the manifest. You can also verify a signature and add a mixin to a running sandbox.

## spec.yaml and files/

**Mixin (v2):** a directory with a `spec.yaml` whose `schemaVersion` is `"2"` and `kind` is `mixin`, plus an optional `files/` tree {{docs-sbx Use existing kits}}. The capture kit wrote one:

```listing
title: the v2 mixin the capture kit wrote
source: capture/fixtures/kits/hello-mixin/spec.yaml
lang: yaml
---
schemaVersion: "2"
kind: mixin
name: hello-mixin
description: Installs tree and adds a greeting file to the workspace.
setup:
  install:
    - command: apt-get update && apt-get install -y tree
      user: "0"
      description: Install tree
permissions:
  network:
    allow:
      - example.com
```

`files/workspace/HELLO.md` holds one line, and `sbx kit inspect` reports it as a workspace file with mode 420 (`capture/out/12-inspect.json`). The v2 grammar is the one the built-in agents use, and its normative text lives in `SPEC-v2.md` of `docker/sbx-kits-contrib` {{docs-sbx Top-level fields}}.

## validate and pack

`sbx kit validate REFERENCE` accepts a directory, a ZIP, or a git reference, and `--json` reports a verdict and warnings {{help-sbx sbx kit validate}}:

```listing
title: validate, then pack
source: capture/out/12-validate.json
lang: json
---
{
  "reference": "./fixtures/kits/hello-mixin",
  "kind": "directory",
  "valid": true,
  "warnings": []
}
```

```listing
title: the ZIP that pack wrote
source: capture/out/12-pack.txt
lang: text
---
$ sbx kit pack ./fixtures/kits/hello-mixin -o $CAPTURE/work/hello-mixin.zip
Packed artifact to $CAPTURE/work/hello-mixin.zip
[exit 0]

$ zip listing of work/hello-mixin.zip (size, name)
       0  files/
       0  files/workspace/
      22  files/workspace/HELLO.md
     297  spec.yaml
```

For `pack`, "The directory must contain a valid spec.yaml and an optional files/ directory" {{help-sbx sbx kit pack}}. The same ZIP validates with `kind: "zip"` (`capture/out/12-validate-zip.json`). A v3 directory fails both commands, as [the descriptor section](#s-syntax-docker-sandbox-kit-3-and-kit-yaml) showed. [Figure](#fig-4-3) draws the whole path, with the steps the capture kit did not run in dashed boxes.

```figure
id: fig-4-3
kind: flow
title: from spec.yaml to a signed artifact and into a sandbox
claim: A v2 kit is validated and packed on the host, signed and pushed with two referrers, verified from the registry, and consumed by create or kit add.
caption: Read row by row. Solid boxes are captured in capture/out/12-validate.txt, 12-pack.txt, 12-run-kit.txt, 12-kit-add.txt, and 12-kit-add-files.txt. Dashed boxes follow the help text of sbx kit sign, push, verify, and provenance, which were not run.
```

## sign, push --sign, and pull

The capture kit ran none of these three, because it has no registry and no signing identity. The help text is the source. `sbx kit sign` is keyless by default, with an OIDC token from the CI provider or a browser login. "A token is never read from SIGSTORE_ID_TOKEN, so it cannot be chosen by anything that can set an environment variable" {{help-sbx sbx kit sign}}. With `--key` it signs with an unencrypted PEM private key. "For a local directory, a detached signature bundle is written to kit.sig.bundle next to spec.yaml" {{help-sbx sbx kit sign}}.

`sbx kit push DIRECTORY REFERENCE` chooses the artifact form from `schemaVersion`: a ZIP for `"1"`, a tar+gzip layer with the spec in the config blob for `"2"` {{help-sbx sbx kit push}}. "With --sign, the pushed manifest is signed and the Sigstore bundle is attached to the kit as an OCI referrer" {{help-sbx sbx kit push}}. Signed or not, "Every push also attaches a SLSA provenance attestation as an OCI referrer" {{help-sbx sbx kit push}}, and "The provenance is unsigned unless --sign is given" {{help-sbx sbx kit push}}. `--tlog-upload=false` keeps a private kit out of the Rekor log. For `pull`, "The registry must support HTTPS" {{help-sbx sbx kit pull}}.

A published v3 image can be signed by reference with the same command, but "V3 kits shared as source directories or Git references can't be signed" {{docs-sbx Sign and verify kits}}.

## verify, provenance, and the settings that admit a kit

`sbx kit verify` takes `--key PUB` for a key, or `--certificate-identity` with `--certificate-oidc-issuer` for a keyless signature. `--insecure-ignore-tlog` accepts a private keyless signature, and "It has no effect on key-based verification" {{help-sbx sbx kit verify}}. `sbx kit provenance REFERENCE` prints the attestation, and "only attestations that verify and whose subject matches the kit's own digest are reported as VERIFIED" {{help-sbx sbx kit provenance}}.

Six settings decide what a sandbox accepts, all at their defaults on the recording host:

```listing
title: the kit settings at their defaults
source: capture/out/02-settings.txt
lang: text
note: The description column is cut.
---
kit.allowExtractedAgents             true                               bool     default             Admit the pinned kit references that replace fo…
kit.allowLocalKits                   true                               bool     default             Allow installing kits from local directories or…
kit.allowedSources                   ["docker.io/"]                     json     default             JSON array of allowed kit source prefixes (e.g.…
kit.ignoreTransparencyLog            false                              bool     default             Verify keyless kit signatures without requiring…
kit.requireSignature                 false                              bool     default             Require a valid signature from a trusted signer…
kit.trustedSigners                   [{"identityRegexp":"^.*@docker\…   json     default             JSON array of trusted signer policies (key-base…
```

"When `kit.requireSignature` is `true`, `sbx` rejects unsigned kits, signatures that don't match `kit.trustedSigners`, and ZIP kits" {{docs-sbx Require signed kits}}. For `kit.trustedSigners`, "The default policy trusts Docker employee identities ending in `@docker.com`, attested by Google's issuer" {{docs-sbx kit.trustedSigners}}. [The settings table](#s-ref-settings-keys-environment-variables-and-paths) lists the environment variable of each key.

## kit add and the builder

`sbx kit add SANDBOX REFERENCE` recreates the container with the mixin appended, "preserving kit-owned volumes (e.g. agent session state) across the swap" {{help-sbx sbx kit add}}. The capture shows the accepted case and the refused one:

```listing
title: kit add accepts env-mixin and refuses hello-mixin
source: capture/out/12-kit-add.txt
lang: text
---
$ sbx kit add m101-demo ./fixtures/kits/env-mixin
Recreating sandbox "m101-demo" to apply augmented kit list...
  Swap container m101-demo-swap-<id> started (id=<sha256>).
Kit "env-mixin" added to sandbox "m101-demo"
[exit 0]

$ sbx exec m101-demo sh -c 'env | grep M101_FROM_KIT'
M101_FROM_KIT=yes
[exit 0]
```

```listing
title: a mixin with files is refused
source: capture/out/12-kit-add-files.txt
lang: text
---
$ sbx kit add m101-demo ./fixtures/kits/hello-mixin
error: kit "hello-mixin" declares files, which the kit-add recreate flow does not yet apply; recreate the sandbox from scratch via `sbx rm` + `sbx create --kit` to use this kit
[exit 1]
```

Sandboxes created before the recreate-aware label are refused with an error {{help-sbx sbx kit add}}, and `long-running@1` cannot be added this way {{rel-sbx v0.47.0}}. `sbx create shell --kit ./fixtures/kits/hello-mixin` applied the same mixin in full: one install command, one workspace file, and one allow rule (`capture/out/12-run-kit.txt`, `12-policy-kit.txt`).

Source-form builds of v3 kits "run inside a shared builder sandbox named sbx-kit-builder, created on first use" {{help-sbx sbx kit builder}}. `sbx kit builder status` reports it, and `history` passes through to `docker buildx history`:

```listing
title: the builder before any build
source: capture/out/13-kit-builder-status.txt
lang: text
---
$ sbx kit builder status
Builder:      not created (the first source-form kit build creates it)
Builder kit:  docker.io/docker/sbx-kit-builder:1
Kit registry: 127.0.0.1:5411 — reachable
[exit 0]
```

```takeaways
- Run `sbx kit validate` before `pack` or `push`, with the same `--kit-arg` values you will use at create.
- Push with `--sign`, and verify with the key or the identity and issuer you expect.
- Set `kit.trustedSigners` before `kit.requireSignature`, or only Docker's own identities pass.
- Use `sbx kit add` for variables, commands, and allows, and recreate for a mixin that declares files.
```

Sources: help-sbx sbx kit add, builder, pack, provenance, pull, push, sign, validate, verify (research/sources/help-sbx.md); docs-sbx Kits v2, Build and distribute kits, kit settings (research/sources/docs-sandboxes.md); rel-sbx v0.47.0 (research/sources/sbx-releases.md); research/conflicts-register.md row C13; capture/fixtures/kits/hello-mixin/spec.yaml, capture/fixtures/kits/env-mixin/spec.yaml; capture/out/02-settings.txt, 12-inspect.json, 12-validate.json, 12-validate-zip.json, 12-pack.txt, 12-run-kit.txt, 12-policy-kit.txt, 12-kit-add.txt, 12-kit-add-files.txt, 13-kit-builder-status.txt
