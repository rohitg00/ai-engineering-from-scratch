---
id: kit-from-a-local-registry
title: A kit from a local registry, three refusals
card: scenarios
kind: incident
level: 2
roles: [agentic-ai-engineer, forward-deployed-ai-engineer]
rounds: [debugging, design-review]
tags: [sandbox, kits, oci, buildx, allowlist]
minutes: 20
lessons: []
manuals: [docker-sandboxes-101#s-syntax-docker-sandbox-kit-3-and-kit-yaml, docker-sandboxes-101#s-sbx-kit-pack-push-sign-and-verify, docker-sandboxes-101#s-ref-sources-and-the-conflicts-register]
practice: []
cheatsheet: []
related: []
updated: 2026-11-03
system:
  version: sbx v0.47.0
  model: none; shell commands inside the sandbox
  hardware: one Mac with the microVM runtime
source:
  - manuals/docker-sandboxes-101/capture/out/28-kit-inspect.txt
  - manuals/docker-sandboxes-101/capture/out/28-kit-inspect-source.txt
  - manuals/docker-sandboxes-101/capture/out/28-buildx.txt
  - manuals/docker-sandboxes-101/capture/out/28-buildx-docker-driver.txt
  - manuals/docker-sandboxes-101/capture/out/13-kit-v3-validate.txt
  - manuals/docker-sandboxes-101/capture/out/12-validate.txt
  - manuals/docker-sandboxes-101/sections/4-1-syntax-docker-sandbox-kit-3-and-kit-yaml.md
  - manuals/docker-sandboxes-101/sections/4-3-sbx-kit-pack-push-sign-and-verify.md
  - manuals/docker-sandboxes-101/sections/r-7-sources-and-the-conflicts-register.md
---

## Situation

A platform team writes its first v3 kit, a shell workload with one allowed host, and pushes it to the team's own registry. In the capture a local registry at `localhost:15000` stands in for it. Three commands then fail in a row. `sbx kit inspect` on the pushed reference says the kit cannot be installed because its source is not in the allowlist. `sbx kit inspect` on the source directory tries to build it and stops with an exporter error. `sbx kit validate` on the same directory says the kit is a v3 source kit and the load path has no kit builder. An engineer concludes that v3 kits do not work in this release and proposes to rewrite the kit as a v2 mixin.

You have the three failures, the build logs of two pushes made with two different builders, and the validate output for a v2 mixin from the same tree.

## Evidence

- [the two settings that the refused inspect suggests, and its exit code](evidence/the-refused-inspect.txt)
- [sbx kit inspect on the v3 source directory](evidence/inspect-of-the-source-directory.txt)
- [the start of the build with a docker-container builder](evidence/the-driver-that-worked.txt)
- [the export and push steps of the docker-container build](evidence/what-the-container-driver-exported.txt)
- [the same build with the default driver of the host daemon](evidence/what-the-default-driver-exported.txt)
- [sbx kit validate on the v3 source kit](evidence/validate-on-the-v3-directory.txt)
- [sbx kit validate on the v2 mixin](evidence/validate-on-the-v2-mixin.txt)

## Questions

1. Three failures, one conclusion. Group the failures by the component that produced each message before you read the build logs.
2. Which sbx kit commands accept a v3 kit, and which do not?
3. The two builds used different drivers. What did each export, and which result is a kit?
4. What does the allowlist refusal protect, and which of the two suggested settings would you apply?
5. How does the kit reach a sandbox once the three causes are fixed, and what does the manual admit it did not capture?

## Walkthrough

1. **Separate the generations.** `sbx kit validate` passes the v2 mixin with `VALID` and refuses the v3 directory as a v3 source kit with no builder. The manual's ruling on conflict C13 is that `validate`, `pack`, `push` and `pull` are v1 and v2 tooling. A v3 kit is an OCI image, built and pushed with Docker tooling. So the validate failure is not a defect: the command was never meant for this kit.
2. **Read the two build logs for the driver.** The build that worked ran on a `docker-container` builder. Its export step wrote layers, a manifest, a config, an attestation manifest and a manifest list, then pushed the manifest. The other build ran on the `docker` driver of the host daemon; its export wrote an image, named it, and pushed it with docker, with no manifest list and no attestation. The manual read the registry afterwards: the default driver pushed a Docker schema 2 manifest with no annotations, and an image without the descriptor annotation is not a kit to any consumer. The second push looked successful and produced something no sandbox can use.
3. **Read the source inspect failure in that light.** `sbx kit inspect` on the directory tried to build the kit with the host daemon, and the OCI exporter is not supported for the `docker` driver. The fix is the same as in step 2: a `docker-container` builder, or the containerd image store that the error names.
4. **Read the admission rule.** The refusal of the pushed reference comes from `kit.allowedSources`, which defaults to `docker.io/` since v0.34.0, as conflict C40 records. The error suggests two values. Add the registry prefix `localhost:15000/m101/`, and do not set `*`: the error itself says that allowing any remote source is not recommended. The descriptor line of the good build names the frontend `3.0.0-m.8`, a milestone, so the pinned frontend version belongs in the ticket too.
5. **Run it by reference.** A v3 workload is consumed by `sbx run` or `sbx create` with the reference in place of the agent name, and a sandbox cannot mix v3 kits with v1 or v2 kits. The manual says plainly that no capture shows sbx running a v3 kit, because the capture kit never changes `sbx settings`. Say so when you report.

## Resolution

Three causes, and none of them is a broken release. The `sbx kit` artifact commands are v1 and v2 tooling, so `validate` on a v3 directory is the wrong command. The default `docker` build driver cannot export an OCI image, so the push it made is not a kit, and the source inspect fails for the same reason; a `docker-container` builder exported the manifest list with the descriptor annotations. The daemon admits kits only from the prefixes in `kit.allowedSources`, which is `docker.io/` by default, so the team's registry prefix must be added. With the builder changed and the prefix added, the kit runs by reference. The rewrite to a v2 mixin is withdrawn, and the team records that its own run of the kit is the first measurement, because the manual has none.

## Wrong turns

- "Set kit.allowedSources to * so every registry works." The error names that option and advises against it. The allowlist is the only check between a typed reference and a kit that configures a sandbox.
- "The push with the default driver succeeded, so the registry copy is fine." It pushed an image with no descriptor annotation. A consumer sees an ordinary image, not a kit.
- "Rewrite the kit as a v2 mixin because validate passes on that." The v2 tooling passed because that kit was v2. The v3 kit needs Buildx, not a different format.
- "Create the kit builder sandbox and run validate again." In the capture the source build ran in the host daemon, and the builder status read not created after it. The validate path still names only v1 and v2 artifacts.

## Generalize

When one new thing fails three ways, name the component behind each message before you judge the thing. A format check, a build exporter and an admission list are three systems, and each has its own fix. A push that returns success is not proof that the artifact has the shape its consumer needs. Read the manifest back.

## Taught in

[The descriptor page](../../../manuals/docker-sandboxes-101/sections/4-1-syntax-docker-sandbox-kit-3-and-kit-yaml.md) records the two builds and the allowlist refusal, [the kit commands page](../../../manuals/docker-sandboxes-101/sections/4-3-sbx-kit-pack-push-sign-and-verify.md) gives the v2 tooling and the kit settings, and [the conflicts register](../../../manuals/docker-sandboxes-101/sections/r-7-sources-and-the-conflicts-register.md) rules on C13 and C40.
