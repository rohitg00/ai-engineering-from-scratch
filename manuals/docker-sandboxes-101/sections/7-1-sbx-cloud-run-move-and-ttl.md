# sbx --cloud run, sbx move, and sbx ttl

> A cloud sandbox is the same microVM on Docker's compute, billed by the second in five shapes, with a 24 hour TTL ceiling and its own secrets and policies.

The agent in `m101-demo` is halfway through a long build, your laptop goes into a bag, and the sandbox stops with it. `sbx move m101-demo --to cloud` captures its filesystem and starts it again on Docker's compute, where a clock ends it and the lid does not. The build process does not move with it, so the agent runs the build again. When you finish this section, you can start a sandbox in the cloud, move one in either direction, and set the clock that ends it.

This edition recorded no cloud run, because a cloud sandbox costs money and that run was not approved. Every fact below comes from the help text and the documentation.

## The --cloud flag and what it hides

**Cloud sandbox:** a sandbox that `sbx` creates through the Cloud Sandboxes API instead of the local `sandboxd`, selected with the global `--cloud` flag {{help-sbx sbx}}.

```listing
title: the verbs that answer to --cloud
source: research/sources/help-sbx-cloud.md
lang: text
note: The output of sbx --cloud --help on 2026-10-08, cut to two groups. Absent are daemon, prune, settings, and skills. Only here are attach, ttl, and volume.
---
Sandbox Commands:
  attach      Attach to a cloud sandbox, starting it first if it is stopped
  cp          Copy files or directories between a sandbox and the host
  create      Create a sandbox for an agent
  exec        Execute a command inside a sandbox
  ls          List sandboxes
  move        Move a sandbox between local and cloud
  ports       Manage sandbox port publishing
  rm          Remove one or more sandboxes
  run         Run an agent in a sandbox
  stop        Stop one or more sandboxes without removing them
  ttl         Inspect or extend a cloud sandbox's TTL
…
  volume      Manage persistent volumes (cloud-only)
```

The cloud tree drops `daemon`, `prune`, `settings`, and `skills`, and `rm --all` is refused with `--cloud` {{help-sbx sbx rm}} ([conflict C47](#s-ref-sources-and-the-conflicts-register)). Sandboxes, templates, secrets, volumes, and network policy live in a separate cloud store {{docs-sbx Compare local and cloud sandboxes}}.

You need `sbx` 0.45.1 or later and a pay-as-you-go plan on a Personal or Pro account. The docs page says 0.45.0 and the launch blog says 0.45.1 ([conflict C36](#s-ref-sources-and-the-conflicts-register)), and Team and Business accounts are not mentioned ([conflict C103](#s-ref-sources-and-the-conflicts-register)). `sbx --cloud diagnose` checks sign-in, the cloud API, and account access without a local daemon {{docs-sbx Use cloud sandboxes}}. Docker Offload, a remote daemon for Docker Desktop, is a different product with no sandbox path ([conflicts C98 and C99](#s-ref-sources-and-the-conflicts-register)).

## Shapes, prices, and quotas

Without `--cpus` and `--memory` a cloud sandbox gets 2 CPUs and 4 GiB {{help-sbx sbx create}}. The pair must name one of five billable shapes {{help-sbx sbx template load}}. Prices come from the launch blog of 2026-09-24, and the docs tree prints none ([conflict C101](#s-ref-sources-and-the-conflicts-register)).

| Shape | vCPU | Memory | Price per hour, blog of 2026-09-24 |
|---|---|---|---|
| `micro` | 1 | 2048 MiB | $0.07 |
| `small`, the default | 2 | 4096 MiB | $0.14 |
| `medium` | 4 | 8192 MiB | $0.28 |
| `large` | 8 | 16384 MiB | $0.56 |
| `xl` | 16 | 32768 MiB | $1.12 |

The blog meters compute per second, and the docs confirm half of that: "Compute isn't billed while it is stopped." {{docs-sbx Use cloud sandboxes}} The $250 credit in the same blog is promotional. An account starts with 10 concurrent sandboxes, 50 stored sandboxes, 100 volumes, 100 secrets, and 3 images in preparation {{docs-sbx-api Account quotas}}.

## sbx --cloud run and attach

`sbx --cloud run claude --name cloud-project` creates the sandbox and attaches to its agent, or restarts the named sandbox when it exists {{help-sbx sbx run}}. `Ctrl-\` detaches, and `sbx --cloud attach cloud-project` joins the session again {{help-sbx sbx attach}}. `sbx --cloud ports cloud-project --publish 8080` returns a public HTTPS URL, so the service behind it needs its own authentication {{docs-sbx Use cloud sandboxes}}. Secrets come from `sbx --cloud secret set anthropic`, and rules from `sbx --cloud policy init`, which can be run again {{help-sbx sbx policy init}}. HTTP method rules, `--protocol`, and governance profiles are refused in the cloud {{docs-sbx Manage cloud network policy}}.

## sbx ttl and --on-timeout

**TTL:** the time a cloud sandbox lives before its timeout action, one hour by default and at most 24 hours from creation {{help-sbx sbx ttl}}.

`sbx --cloud ttl +2h cloud-project` extends the expiration under that ceiling and never shortens it {{help-sbx sbx ttl}}. `--on-timeout` chooses `stop`, `restart`, or `delete` {{help-sbx sbx create}}. Omit it, and the server stops a sandbox it can resume and deletes the rest. `restart` needs a `--ttl` of at least one hour, and a volume-backed sandbox must use `delete` {{docs-sbx Use cloud sandboxes}}. Since v0.47.0 a stopped sandbox reports `stopped`, and its clock restarts on resume {{rel-sbx v0.47.0}}. A volume is a snapshot taken when the sandbox exits, and the last sandbox to exit overwrites it {{help-sbx sbx volume}}.

## sbx move

```figure
id: fig-7-1
kind: flow
title: what sbx move carries to the cloud
claim: sbx move copies the sandbox filesystem as one image and nothing else, so secrets, mounts, local rules, and processes stay behind while the destination starts a TTL clock.
caption: Read left to right along the top, then down. Green boxes travel inside the image, dashed grey boxes stay on the host, and the amber box is the destination's clock. From research/sources/help-sbx.md (sbx move) and docs-sandboxes.md (Move a sandbox), because no cloud run was recorded.
```

`sbx move m101-demo --to cloud` captures the filesystem as a template image, uploads it, and creates a sandbox with a new id, named `moved-m101-demo` plus a suffix {{help-sbx sbx move}}. Kit network rules and the local environment travel inside the image. The host bind mount, the secrets in the store, local policy rules, host port bindings, and running processes stay behind {{help-sbx sbx move}}. Credential files written by an interactive sign-in are ordinary files, so they travel unless you delete them first {{docs-sbx Move a sandbox}}.

HTTP method rules prompt before the move, because the cloud cannot apply them, and `--force` answers the prompt and keeps the warning. The destination expires after the server's default of one hour unless `--ttl` and `--on-timeout` say otherwise. Moving to local can stage up to 32 GiB in the host's temporary directory {{help-sbx sbx move}}. The docs also warn that `docker exec` inside a cloud sandbox can read the VM filesystem instead of the container's ([conflict C104](#s-ref-sources-and-the-conflicts-register)). This edition did not confirm it.

```takeaways
- Set `--ttl` and `--on-timeout stop` on every cloud create or move that holds work you want back.
- Configure `sbx --cloud secret` and `sbx --cloud policy` before the first cloud run, because the local stores do not apply.
- Treat a published cloud port as a public endpoint and unpublish it when the demo ends.
- Delete in-sandbox credential files before `sbx move` or `template save`, because snapshots copy them.
```

Sources: help-sbx sbx, sbx create, sbx run, sbx attach, sbx rm, sbx move, sbx ttl, sbx volume, sbx policy init, sbx template load (research/sources/help-sbx.md); research/sources/help-sbx-cloud.md; docs-sbx Cloud sandboxes, Authenticate cloud agents, Compare local and cloud sandboxes, Move a sandbox, Manage cloud network policy, Use cloud sandboxes (research/sources/docs-sandboxes.md); docs-sbx-api Compute sizes and limits, Account quotas (research/sources/docs-sandboxes-api.md); rel-sbx v0.45.0, v0.45.1, v0.47.0 (research/sources/sbx-releases.md); blog 2026-09-24 and research/conflicts-register.md rows C36, C47, C98, C99, C101, C103, C104; capture/out/01-help-sbx.txt
