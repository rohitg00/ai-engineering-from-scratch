# share push and share pull

> `share push` stores an agent file as an OCI artifact with docker-agent annotations, and `share pull` or `run` with the same reference reads it back from any registry.

A teammate asks for the agent you used yesterday. A YAML file in a chat message has no version and no record of who published it. A registry reference has both, and Docker Agent pushes agent files to OCI registries the way Docker pushes images.

When you finish this section, you can push an agent file, read its manifest, pull it back, and run it by reference.

## Push to a registry

**share push:** "Push an agent configuration file to an OCI registry" {{help-agent docker-agent share push}}. The capture pushed `files.yaml`, an agent with the `filesystem` and `shell` toolsets, to a `registry:2` container on `localhost:15000`:

```listing
title: one push to a local registry
source: capture/out/24-share-push.txt
lang: text
---
$ docker-agent share push fixtures/agents/files.yaml localhost:15000/m101/agent:v1
Pushing agent $CAPTURE/fixtures/agents/files.yaml to localhost:15000/m101/agent:v1
Successfully pushed artifact to localhost:15000/m101/agent:v1
[exit 0]
```

The registry speaks plain HTTP, and the push needed no insecure-registry setting (capture/README.md). Its catalog then listed `m101/agent` with the tag `v1`, served as `application/vnd.oci.image.manifest.v1+json` (capture/out/24-registry.txt).

## The manifest

```listing
title: the manifest of m101/agent:v1
source: capture/out/24-manifest.json
lang: json
---
{
  "annotations": {
    "io.docker.agent.version": "v1.149.0",
    "io.docker.cagent.version": "v1.149.0",
    "org.opencontainers.image.created": "<ts>",
    "org.opencontainers.image.description": "OCI artifact containing files.yaml"
  },
  "artifactType": "application/vnd.docker.agent.config.v1+json",
  "config": {
    "mediaType": "application/vnd.docker.container.image.v1+json",
    "size": "<n>",
    "digest": "sha256:<digest>"
  },
  "layers": [
    {
      "mediaType": "application/vnd.docker.image.rootfs.diff.tar.gzip",
      "size": "<n>",
      "digest": "sha256:<digest>"
    }
  ],
  "mediaType": "application/vnd.oci.image.manifest.v1+json",
  "schemaVersion": 2
}
```

**artifactType:** the field of an OCI manifest that names what the artifact is. Here it marks a Docker Agent config, while the config and the one layer keep Docker image media types. `io.docker.agent.version` records the release that pushed the file. `io.docker.cagent.version` repeats it, because v1.23.3 renamed the annotation "while maintaining backward compatibility with the old annotation" {{rel-agent v1.23.3}}.

A file that the agent reads through `instruction_file` travels inside the artifact. On push, "the file contents are inlined into the pushed artifact, so the published agent stays self-contained" {{docs-agent Agent Configuration}}. [Figure](#fig-6-4) shows the push, the manifest, and the two ways back.

```figure
id: fig-6-4
kind: structure
title: the agent file as an OCI artifact
claim: One share push stores files.yaml as an OCI manifest with four annotations, and share pull and run both read it back by the same reference.
caption: Read the top row left to right, then the manifest fields from top to bottom. Violet marks the agent file and the annotations docker-agent writes, and grey marks the registry and the manifest fields. The dashed box is the --key proof, which this capture did not record. From capture/out/24-share-push.txt, 24-registry.txt, 24-manifest.json, 24-share-pull.txt, and 24-run-ref.txt.
```

## --key and --encrypt

The capture pushed without `--key`, so its manifest carries no proof. The flag arrived in v1.132.0 {{rel-agent v1.132.0}}, and it takes a key inline or as a `file://` path {{help-agent docker-agent share push}}. With `--key`, the proof goes into manifest annotations, and "the YAML itself is always pushed in clear" {{help-agent docker-agent share push}}. A PEM or OpenSSH key (Ed25519, ECDSA, or RSA) records a signature. Any other value is a symmetric secret of at least 16 bytes and records a MAC {{help-agent docker-agent share push}}.

`--encrypt` also embeds an encrypted copy of the whole YAML, and Ed25519 keys cannot encrypt {{help-agent docker-agent share push}}. Since v1.138.1 the signature covers "a DSSE-wrapped in-toto statement instead of raw YAML bytes" {{rel-agent v1.138.1}}. Neither the help nor this capture names the proof annotations, so this manual does not print them.

On the other side, `share pull --key` checks the signature or the MAC, or decrypts the copy and compares it. "The pull fails if the artifact is unprotected or the check does not pass" {{help-agent docker-agent share pull}}. Both commands read `DOCKER_AGENT_ENCRYPT_KEY` in place of the flag.

## Pull and run by reference

```listing
title: pull into the current directory
source: capture/out/24-share-pull.txt
lang: text
---
$ docker-agent share pull localhost:15000/m101/agent:v1 --force  (in work/)
Pulling agent localhost:15000/m101/agent:v1
Agent saved to localhost:15000_m101_agent:v1.yaml
[exit 0]
```

`share pull` names the file after the reference, with `/` replaced by `_`, and `--force` overwrites an earlier copy. The pulled YAML is byte for byte the pushed `files.yaml` (capture/out/24-share-pull-agent.yaml). `run` takes the reference in place of a path, and the replayed run answered from the registry copy:

```listing
title: run straight from the reference
source: capture/out/24-run-ref.txt
lang: text
note: The command line is cut after the reference.
---
$ docker-agent run --exec --last --working-dir fixtures/repo --fake work/cassettes/18-files localhost:15000/m101/agent:v1 …
README.md has 1 line.
[exit 0]
```

A reference also works as a `sub_agents` entry. "Tag references are checked against the registry on every `docker agent run`" {{docs-agent Agent Distribution}}, so pin each one to a digest, `myorg/agent@sha256:…`, to start from cache. `serve api --pull-interval N` pulls a reference again every N minutes {{help-agent docker-agent serve api}}. For local work, `run` also takes a plain `http://localhost` URL to an agent file, with no registry at all {{docs-agent Agent Distribution}}.

A private repository needs `docker login` first. Docker Agent forwards a Docker token by itself only for HTTPS URLs under `docker.com`, and `docker.io` is not one of them {{docs-agent Agent Distribution}}. So a private Hub repository needs `docker login docker.io`. Older material points to the `agentcatalog` namespace on Docker Hub, and v1.116.0 removed the references to that "discontinued `agentcatalog` Docker Hub namespace" {{rel-agent v1.116.0}}.

```takeaways
- Push with `--key` whenever another person will run the agent.
- Pull with the matching `--key`, so that an unprotected artifact fails.
- Pin registry sub-agents to a digest for repeatable starts.
- Read `io.docker.agent.version` to learn which release pushed an artifact.
```

Sources: help-agent docker-agent share push, share pull, serve api (research/sources/help-docker-agent.md); docs-agent Agent Configuration, Agent Distribution (research/sources/docs-docker-agent.md); rel-agent v1.23.3, v1.116.0, v1.132.0, v1.138.1 (research/sources/docker-agent-CHANGELOG.md); research/plan.md, Part 6; capture/README.md; capture/fixtures/agents/files.yaml; capture/out/24-share-push.txt, 24-registry.txt, 24-manifest.json, 24-share-pull.txt, 24-share-pull-agent.yaml, 24-run-ref.txt
