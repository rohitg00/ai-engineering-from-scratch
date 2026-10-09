# sbx settings list

> Every setting has a default, a source, a user override, and a restart flag, some have an environment alias, and `sbx settings list --json` is the only complete list.

Your company routes every connection through a proxy, and your first `sbx run` cannot pull a template. The fix is a setting, `proxy`. The questions are where to set it, whether the daemon must restart, and which value wins when an environment variable disagrees. When you finish this section, you can read one record of `sbx settings list --json`, change a setting, and know when `sbx daemon restart` is needed.

## One record

**Setting:** a key such as `proxy` with a type, a default, an evaluated value, and a source. `sbx settings list --json` printed 31 records on the recording Mac, each with `key`, `type`, `default`, `value`, `source`, and `description`, and some with `env_var` or `requires_restart`. The source is one of three: "The SOURCE column shows where the value came from (default, envvar, or override)" {{help-sbx sbx settings list}}. The type is `bool`, `int`, `float`, `string`, or `json`, and `sbx settings set KEY VALUE` parses the value by that type {{help-sbx sbx settings set}}. Thirteen of the 31 keys have no `env_var`, among them `proxy`, `mcp.forceLocalGateway`, and `skills.defaultMode`, so the environment cannot set them and only an override can.

```listing
title: five of the 31 records
source: capture/out/02-settings.json
lang: json
note: Cut to kit.trustedSigners, proxy, proxy.sandbox, skills.defaultMode, and ssh.defaultAgent, in the order the file has them.
---
[
  …
  {
    "default": [
      {
        "identityRegexp": "^.*@docker\\.com$",
        "issuer": "https://accounts.google.com"
      }
    ],
    "description": "JSON array of trusted signer policies (key-based {\"key\":path} or keyless {\"issuer\":...,\"identity\":...}). Defaults to Docker employee identities (*@docker.com via https://accounts.google.com).",
    "env_var": "DOCKER_SANDBOXES_KIT_TRUSTED_SIGNERS",
    "key": "kit.trustedSigners",
    "source": "default",
    "type": "json",
    …
  },
  …
  {
    "default": "",
    "description": "Upstream proxy for sandbox, daemon, and supported CLI host egress (URL, PAC source, \"system\", or \"direct\"; empty = automatic: HTTP(S)_PROXY if set, otherwise the host OS proxy).",
    "key": "proxy",
    "requires_restart": true,
    "source": "default",
    "type": "string",
    "value": ""
  },
  …
  {
    "default": "",
    "description": "Upstream proxy for sandbox egress only (overrides proxy).",
    "env_var": "DOCKER_SANDBOXES_PROXY",
    "key": "proxy.sandbox",
    "requires_restart": true,
    "source": "default",
    "type": "string",
    "value": ""
  },
  …
  {
    "default": "readonly",
    "description": "Default for an omitted --skills flag or sbx.yaml `skills:` key: \"off\", \"readonly\", or \"readwrite\". Applies to sandboxes created after the change; existing sandboxes' mounts are never retroactively changed.",
    "key": "skills.defaultMode",
    "source": "default",
    "type": "string",
    "value": "readonly"
  },
  …
  {
    "default": "shell",
    "description": "Built-in agent used for SSH auto-created sandboxes.",
    "env_var": "DOCKER_SANDBOXES_SSH_DEFAULT_AGENT",
    "key": "ssh.defaultAgent",
    "requires_restart": true,
    "source": "default",
    "type": "string",
    "value": "shell"
  },
  …
]
```

The `proxy` record shows the shape of a value. It takes a URL, a PAC source, `system`, or `direct`, and an empty string means automatic: `HTTP(S)_PROXY` if set, otherwise the host OS proxy. `proxy.sandbox` narrows that to sandbox egress only, and it is the one with an environment alias, `DOCKER_SANDBOXES_PROXY`.

## Precedence and restart

"Environment variables take precedence over user overrides" {{help-sbx sbx settings set}}, so an exported `DOCKER_SANDBOXES_PROXY` beats `sbx settings set proxy.sandbox`. Above both sits the organization: "Administrator constraints apply to saved overrides. A conflicting value is rejected" {{help-sbx sbx settings set}}. `sbx settings unset KEY` removes the override, and "Administrator policy remains in effect" {{help-sbx sbx settings unset}}. After that "the setting evaluates from its environment variable, remote default, or built-in default" {{help-sbx sbx settings unset}}, and the remote default is a fourth origin that the SOURCE column does not name.

"Most changes take effect within about five seconds" {{help-sbx sbx settings}}, and the rest need `sbx daemon restart`. The table marks them in its RESTART column, and its footer says who needs the restart.

```listing
title: the two notes under the settings table
source: capture/out/02-settings.txt
lang: text
note: Cut to the two lines after the table.
---
Some fields were truncated; use --no-trunc or --json to see them in full.

RESTART=yes: existing daemon-side consumers require `sbx daemon restart`. Supported CLI clients and new sandboxes use their current proxy settings immediately.
```

Fifteen keys carry `"requires_restart": true` on the recording Mac: the four `proxy*` keys, the three `no_proxy*` keys, the six `ssh.*` keys, `tls.allowNegativeSerial`, and `mcp.forceLocalGateway`. The other sixteen apply within the five seconds. Some of them, such as `skills.defaultMode` and `sandbox.disk.dockerVolume`, say in their description that only sandboxes created after the change see the new value.

## Where the CLI and the docs disagree

The docs settings page and the CLI list different keys, and [the settings table](#s-ref-settings-keys-environment-variables-and-paths) prints only the keys the CLI returned. Four keys are in the CLI and not in the docs: `ssh.autoCreate`, `ssh.defaultAgent` with default `shell`, `ssh.defaultTemplate`, and `ssh.workspaceRoot`, as [conflict C20](#s-ref-sources-and-the-conflicts-register) records. Four keys are in the docs and not in the CLI output: `feature.model`, `feature.sandbox-gpu`, `feature.udp-egress`, and `diagnostics.autoUploadErrorCooldownInDays`, as [conflict C19](#s-ref-sources-and-the-conflicts-register) records. The last one has a documented default of 1 {{docs-sbx diagnostics.autoUploadErrorCooldownInDays}}. The capture ran `sbx settings get` only on `skills.defaultMode` and `kit.allowedSources`, so what `get` answers for a `feature.*` key is open.

One default disagrees. The docs tell you to run `sbx settings set platform.allowExperimentalFeatures true` before `feature.model` {{docs-sbx Enable model selection}}, which implies `false`. The capture prints `true` with source `default`, as [conflict C18](#s-ref-sources-and-the-conflicts-register) records.

```listing
title: the experimental flag as the CLI reports it
source: capture/out/02-settings-experimental.json
lang: json
note: Nothing is cut.
---
{
  "default": true,
  "description": "Allow experimental features.",
  "env_var": "DOCKER_SANDBOXES_ALLOW_EXPERIMENTAL_FEATURES",
  "key": "platform.allowExperimentalFeatures",
  "source": "default",
  "type": "bool",
  "value": true
}
```

The same gap covers commands. The `model.providers` description names `sbx run --model <model> --provider <id>`, and the docs show `sbx run --name <SANDBOX_NAME> --model <MODEL_NAME> --provider <PROVIDER_ID>` {{docs-sbx configuration/models}}, but `sbx run --help` in v0.47.0 lists neither flag. The secret help text names "mounts added later with sbx mount" {{help-sbx sbx secret set}}, and the help tree has no `sbx mount` page. `sbx ssh proxy`, `sbx policy approval`, and `--usb` are named in the sources that [conflict C16](#s-ref-sources-and-the-conflicts-register) lists, and none of them has a help page either. This manual documents what `--help` prints, and [the command table](#s-ref-sbx-commands) is that list.

## The kit defaults

Six `kit.*` keys decide which kits a sandbox accepts, and all six print `default` as their source. `kit.allowedSources` is `["docker.io/"]`, and `kit.allowLocalKits` and `kit.allowExtractedAgents` are `true`. `kit.requireSignature` and `kit.ignoreTransparencyLog` are `false`, and `kit.trustedSigners` trusts any `@docker.com` identity through `https://accounts.google.com`. [Kit signing](#s-sbx-kit-pack-push-sign-and-verify) shows what a signature check does with them.

```takeaways
- Read `sbx settings list --json`, because the table truncates values and the docs list a different set of keys.
- Export an environment alias only when it must win over every `sbx settings set`.
- Run `sbx daemon restart` after any `proxy*`, `no_proxy*`, `ssh.*`, `tls.*`, or `mcp.forceLocalGateway` change.
- Check `sbx settings get --json KEY` before you trust a documented default.
```

Sources: help-sbx sbx settings, sbx settings list, sbx settings set, sbx settings unset, sbx secret set (research/sources/help-sbx.md); docs-sbx configuration/settings, configuration/models (research/sources/docs-sandboxes.md); conflicts C16, C18, C19, C20 (research/conflicts-register.md); research/sources/probes/sbx-settings-list.txt; capture/out/02-settings.json, 02-settings.txt, 02-settings-get.txt, 02-settings-experimental.json
