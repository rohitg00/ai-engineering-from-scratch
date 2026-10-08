# sbx template save and sbx template load

> A template is a snapshot in the sandbox runtime's image store, reused with `--pull never -t TAG`, exported as a tar, and loaded on another host.

You spent an hour inside `m101-demo` installing a toolchain, and tomorrow a second sandbox needs the same tools without the hour. The capture leaves a marker file at `/opt/marker-from-demo`, saves the sandbox as `m101-tpl:v1`, and creates `m101-from-tpl` from it. When you finish this section, you can save a template, start a sandbox from it, and carry it to another host as a tar.

## What a template holds

**Template:** a saved snapshot of a sandbox's container filesystem, stored as an image: "Templates are saved snapshots of sandboxes that can be reused to create new sandboxes with: sbx run --pull never -t TAG AGENT [WORKSPACE]" {{help-sbx sbx template}}. The docs draw the line between image and kit: "A template contains image content; the agent kit still supplies runtime settings such as credentials and network rules" {{docs-sbx Saving a sandbox as a template}}. Mounted filesystems are not in it, because "A saved template isn't a backup of the whole sandbox" {{docs-sbx Saving a sandbox as a template}}, and that excludes host workspaces and the Docker store at `/var/lib/docker`. Everything else in the container filesystem is in it, including any key an agent wrote to a file. Keep credentials in [sbx secret](#s-sbx-secret-set-import-and-set-custom) and the proxy instead. Agent configuration files such as `/home/agent/.claude/settings.json` "are always recreated when a sandbox is created" {{docs-sbx Limitations}}, so a change there does not survive either.

Every built-in agent starts from `docker/sandbox-templates:<variant>`, and `m101-demo` pulled `docker/sandbox-templates:shell-docker`. Variants with a `-docker` suffix "include Docker Engine for building and running containers inside the sandbox" {{docs-sbx Choose a template}}, which is why `docker version` answers inside `m101-demo`. With `platform.images.useDHI` set, "the default template docker/sandbox-templates:claude-code-docker becomes dhi/sbx-templates:claude-code-docker" {{docs-sbx platform.images.useDHI}}, and the tag stays the same.

## sbx template save

`sbx template save SANDBOX TAG` needs a stopped sandbox. The capture tries it on the running `m101-demo`, reads `cannot save a running sandbox`, stops it, and saves `m101-tpl:v1`. The image "is stored in the sandbox runtime's image store" {{help-sbx sbx template save}}, and that store is separate from the image store of the Docker daemon on the host {{docs-sbx Load a template}}. The 2025 plugin's `docker sandbox save` loaded the image into the host daemon by default, and `--output` was the way to a file, as [conflict C32](#s-ref-sources-and-the-conflicts-register) records.

```listing
title: a save refused, a stop, and a save
source: capture/out/07-template-save.txt
lang: text
note: The exec that creates the marker file is cut. The capture directory is masked as $CAPTURE.
---
$ sbx template save m101-demo m101-tpl:v1 --output $CAPTURE/work/m101-tpl.tar
Sandbox m101-demo is running and must be stopped before saving. Stop it now? (y/N): error: cannot save a running sandbox; stop it first with:
  try: sbx stop m101-demo
[exit 1]

$ sbx stop m101-demo
Sandbox 'm101-demo' stopped; state preserved. Restart with: sbx run --name m101-demo
[exit 0]

$ sbx template save m101-demo m101-tpl:v1 --output $CAPTURE/work/m101-tpl.tar
Snapshotting image in sandbox ...
Exporting image to $CAPTURE/work/m101-tpl.tar ...
Exported to $CAPTURE/work/m101-tpl.tar

Save complete. To use the image as a template:
    sbx run --pull never -t docker.io/library/m101-tpl:v1 AGENT [WORKSPACE]
[exit 0]
```

`sbx template ls --json` then lists three images: the base `docker.io/docker/sandbox-templates:shell-docker`, the new `docker.io/library/m101-tpl:v1` with flavor `shell`, and `docker.io/sandboxes-swap/m101-demo:bf19e491`. The last one is an image the runtime keeps for the stopped sandbox, and it is gone once every sandbox is removed. Each record has `id`, `repository`, `tag`, `flavor`, `created_at`, and `size`, and the capture masks the id, so this manual does not state its format.

```listing
title: the template in the image store
source: capture/out/07-template-ls.json
lang: json
note: Cut to the record of m101-tpl:v1.
---
{
  "images": [
    …
    {
      "id": "<id>",
      "repository": "docker.io/library/m101-tpl",
      "tag": "v1",
      "flavor": "shell",
      "created_at": "<ts>",
      "size": "<n>"
    },
    …
  ]
}
```

## Reuse with --pull never -t

Reuse is `sbx run --pull never -t TAG AGENT [WORKSPACE]`, and the help explains the flag: "Use --pull never to use the saved image without trying to pull it from a registry" {{help-sbx sbx template save}}. The capture uses `sbx create --pull never -t m101-tpl:v1 shell --name m101-from-tpl`, reads `Checking image` instead of `Pulling image`, and finds `/opt/marker-from-demo` inside the new sandbox. Name the agent the template was built for, because a Claude template run with `codex` prints a warning that the sandbox "may not work correctly" {{docs-sbx Limitations}}.

```listing
title: a sandbox from the template, with the marker file
source: capture/out/07-template-run.txt
lang: text
note: The sbx ls between the two commands is cut.
---
$ sbx create --pull never -t m101-tpl:v1 shell --name m101-from-tpl

sandbox    m101-from-tpl
agent      shell
workspace  none · no workspace bind mount
image      m101-tpl:v1
cpu        10
memory     32 GiB

Checking image
✓ Image ready
✓ Created sandbox m101-from-tpl
…
$ sbx exec m101-from-tpl sh -c 'ls -l /opt/marker-from-demo'
-rw-r--r-- 1 root root 0 <date> /opt/marker-from-demo
[exit 0]
```

`sbx template inspect` is "Cloud-only in v1: requires --cloud" {{help-sbx sbx template inspect}}. The local attempt in the capture exits 1 with a hint to run `docker image inspect -- m101-tpl:v1`. That command reads the host daemon's store, which the runtime does not share, so use `sbx template ls` for a local template. `sbx template rm m101-tpl:v1 --force` prints `Removed: m101-tpl:v1`, and `sbx reset` clears the cached images too.

## Export and load

`--output FILE` on save also writes a tar. `work/m101-tpl.tar` has 24 entries and starts with `blobs/sha256/`, the layout of an OCI image. On the other host, `sbx template load FILE` loads "an image from a tar file into the sandbox runtime's image store" {{help-sbx sbx template load}}, and `sbx run --pull never -t m101-tpl:v1 shell` starts from it. The capture did not load the tar on a second machine, so [figure](#fig-2-2) draws that step from the help text. The same path imports an image you built yourself: `docker image save` writes the tar and `sbx template load` imports it, so the image "doesn't need to be reachable from a registry at sandbox creation time" {{docs-sbx Load a template}}.

```figure
id: fig-2-2
kind: flow
title: from a stopped sandbox to a template, a tar, and a new sandbox
claim: A template moves from a stopped sandbox into the runtime image store, out as a tar, and into a new sandbox with --pull never -t.
caption: Read left to right, then down. Solid teal arrows are durable writes into a store or a file. The solid ink arrow is the create call, and the dashed olive arrow is a copy you make outside sbx. From capture/out/07-template-save.txt, 07-template-ls.json, 07-template-tar-head.txt, and 07-template-run.txt. The load on another host is not recorded and follows the help text of sbx template load.
```

In the cloud, `sbx --cloud template load FILE NAME` needs `--cpus` and `--memory-mib` that together name a billable shape {{help-sbx sbx template load}}. The shapes run from micro, 1 vCPU and 2048 MiB, to xl, 16 vCPU and 32768 MiB. `--capture-mode all` adds memory and a microVM checkpoint to the disk capture. Tier C was not recorded, so this manual shows no cloud listing, and [sbx --cloud](#s-sbx-cloud-run-move-and-ttl) cites the help text instead.

```takeaways
- Stop the sandbox, then run `sbx template save SANDBOX TAG --output FILE`.
- Start from a template with `--pull never -t TAG` and the agent the template was built for.
- Keep secrets in `sbx secret set`, because a template copies every file in the container filesystem.
- Load a tar with `sbx template load`, since the runtime store is separate from the host daemon.
```

Sources: help-sbx sbx template, sbx template save, sbx template load, sbx template inspect, sbx template rm (research/sources/help-sbx.md); docs-sbx usage, Saving a sandbox as a template, Load a template, Template caching, Choose a template, platform.images.useDHI (research/sources/docs-sandboxes.md); conflict C32 (research/conflicts-register.md); capture/out/04-create.txt, 04-guest.txt, 07-template-save.txt, 07-template-ls.json, 07-template-ls.txt, 07-template-run.txt, 07-template-inspect.txt, 07-template-rm.txt, 07-template-tar-head.txt, 99-final-state.txt
