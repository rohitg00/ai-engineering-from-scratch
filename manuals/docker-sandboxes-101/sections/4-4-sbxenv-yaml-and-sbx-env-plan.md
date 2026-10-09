# sbxenv.yaml and `sbx env plan`

> An environment file declares the agent, kits, workspace, secrets, ports, MCP servers, and host commands, and `sbx env plan` prints every change before `create` or `run` applies it.

A new contributor clones your repository and needs the sandbox you use. That means the shell workload, the `hello-mixin`, one published port, a greeting variable, and a host command that prepares the workspace. You could send a list of flags. An environment file sends the same thing as one checked-in file, and the contributor sees a plan before anything runs.

When you finish this section, you can write an `sbxenv.yaml`, read its plan symbol by symbol, and say which edits wait for the next create.

## The file

**Environment file:** a `sbxenv.yaml` that declares one sandbox and the host resources around it, read by the five `sbx env` commands {{help-sbx sbx env}}. The capture kit wrote this one:

```listing
title: the environment file the capture kit wrote
source: capture/fixtures/env/sbxenv.yaml
lang: yaml
---
schemaVersion: "1"
name: m101-env
agent: shell
workspace: .
args:
  greeting:
    default: hello
    description: Greeting word
kits:
  - source: ../kits/hello-mixin
env:
  GREETING: ${{ env.args.greeting }}
lifecycle:
  initialize:
    - command: echo init
ports:
  - sandbox: 8080
    host: 18083
```

| Key | What it declares |
|---|---|
| `schemaVersion`, `name`, `agent` | the file version `"1"`, the sandbox name, the built-in agent or kit |
| `args` | inputs with `default` or `required: true`, read as `${{ env.args.NAME }}` |
| `kits` | mixins, as a reference or as `source` plus `args` |
| `workspace`, `additionalWorkspaces` | the host directories to mount, with an object form for clone mode |
| `env` | variables for the sandbox |
| `secrets`, `bindings`, `registries` | credentials with `value`, `ref`, or `command`, and the domains they reach |
| `mcp.servers` | MCP servers registered with the gateway |
| `ports` | published ports, `sandbox`, `host`, `protocol`, `hostIP` |
| `lifecycle` | host commands under `initialize`, `postCreate`, `preRemove` |
| `sandboxOptions` | `template`, `memory`, `cpus`, `skills`, `writableEnvFiles`, and more |

The keys come from the file reference {{docs-sbx Top-level fields}} and from the command's own help. Three placeholders expand, `${{ env.args.NAME }}`, `${{ env.projectDir }}`, and `${{ env.fileDir }}`, and a `$` anywhere else is literal text {{help-sbx sbx env create}}. A relative kit path or workspace resolves against the directory of the file that declares it, so `workspace: .` mounts the file's own directory {{help-sbx sbx env}}. A file with no `workspace` mounts nothing {{rel-sbx v0.42.0}}.

## The plan

`sbx env plan` reads the file and prints what applying it would set up. "Nothing is applied, approved, or recorded" {{help-sbx sbx env plan}}.

```listing
title: the first plan for m101-env
source: capture/out/14-env-plan.txt
lang: text
note: The LOAD ENVIRONMENT block is cut.
---
── ENVIRONMENT PLAN
   m101-env

   kits:
+    - source: $CAPTURE/fixtures/kits/hello-mixin

   workspace:  (present, not recorded as applied, needs your approval)
     path: $CAPTURE/fixtures/env

   env:
+    GREETING: hello

+  sandbox:
+    name: m101-env
+    agent: shell

   ports:
+    - sandbox: 8080
+      protocol: tcp4
+      host: 18083

   lifecycle:
     initialize:
+      - command: echo init
+        workdir: $CAPTURE/fixtures/env
+        envFiles:
+          - $CAPTURE/fixtures/env/sbxenv.yaml

   Plan: + 5 to add, ~ 0 to change, - 0 to destroy.

   this plan runs commands on this machine, outside the sandbox, with your own privileges
   ✓ not approved yet; applying asks once
```

The plan has the shape of your file, and the margin carries the verdict. Five symbols exist {{help-sbx sbx env}}. `+` adds, `~` changes, and `-` destroys. `>` marks a command that runs again, and `!` marks a resource the environment applied and no longer declares.

A row that is unchanged and already approved is left out. "Literal secret values appear as SHA-256 digests" {{docs-sbx Review an environment plan}}. The `tcp4` protocol was not in the file: published ports default to it since v0.42.0 {{rel-sbx v0.42.0}}. [Figure](#fig-4-4) follows the file through the plan to the state record.

```figure
id: fig-4-4
kind: flow
title: an environment file becomes a plan, an approval, and a state record
claim: sbx env plan turns the file into margin-marked rows, approval on create records them, and a later plan prints only the rows that moved.
caption: Read top down. The plan rows are capture/out/14-env-plan.txt, and the right branch is 14-env-plan-arg.txt with the greeting argument changed. The left branch after approval follows the help text of sbx env, because the kit never applied the plan.
```

## Host commands and approval

The `lifecycle` block runs on the host, outside the sandbox, with your own privileges. `initialize` runs on every `create` and every `run`, `postCreate` once the sandbox exists, and `preRemove` after you confirm `sbx env rm` {{help-sbx sbx env}}. Commands run through your shell from the project directory, with `workdir` and `timeout` per command. An environment with any of them "asks on every invocation, whether or not this one is what runs them" {{help-sbx sbx env}}, because approving a command also trusts the script it calls. `--skip-host-commands` runs none of them, `--auto-approve` answers yes once, and `sbx settings set env.rememberHostCommands true` asks again only when a command changes.

## The state record and the second plan

"What was approved is recorded per environment under sbx's state directory, not next to the file" {{help-sbx sbx env}}, "so a later invocation asks only about what moved" {{help-sbx sbx env}}. The exact path was not captured, because the kit ran `plan` and never `create`. The second capture changed one input instead:

```listing
title: the same file with one argument changed
source: capture/out/14-env-plan-arg.txt
lang: text
note: Only the changed row and the totals are shown.
---
$ sbx env plan --env-arg greeting=servus ./fixtures/env
…
+    GREETING: servus
…
   Plan: + 5 to add, ~ 0 to change, - 0 to destroy.
```

Every row is still `+`, because nothing was applied. After a `create`, the same edit prints `~ GREETING: hello -> servus` and nothing else, in the form the help text shows for a changed kit argument {{help-sbx sbx env}}. Changes to workspaces, kits, ports, secrets, bindings, and `sandboxOptions` wait for the next create. New `env` values reach the next session {{docs-sbx Update an environment}}.

Several `PATH` arguments deep-merge in order, "later files override earlier ones" {{help-sbx sbx env create}}, and lists such as `ports` concatenate rather than override. With no `PATH`, a `.sbxenv.yaml` in your home directory merges underneath as a base layer {{help-sbx sbx env create}}. A hidden `.sbxenv.yaml` in the project is no longer read.

## rm, the read-only file, and --cloud

`sbx env rm` removes the sandbox and the secrets provisioned at its scope. Bindings stay, since they are user-wide, so "pass --prune-bindings to also remove the bindings this environment declares" {{help-sbx sbx env rm}}. The file itself is bound read-only inside the sandbox, because an agent that can edit it decides what the next plan asks about. `sandboxOptions.writableEnvFiles: true` lifts that {{help-sbx sbx env}}.

With `--cloud`, "workspace, additionalWorkspaces and clone name host directories, which a cloud sandbox cannot mount" {{help-sbx sbx env}}, and host port bindings, MCP definitions, and dynamic secret sources are rejected before any host command runs. [The cloud section](#s-sbx-cloud-run-move-and-ttl) shows what remains.

```takeaways
- Expect `sbxenv.yaml` to be read-only inside the sandbox, and set `writableEnvFiles` only when an agent must edit it.
- Run `sbx env plan` before `create` or `run`, and read every `+`, `~`, `-`, `>`, and `!`.
- Expect a prompt on every invocation while the file declares host commands.
- Recreate the environment after a change to kits, ports, secrets, or `sandboxOptions`.
```

Sources: help-sbx sbx env, sbx env create, sbx env plan, sbx env rm (research/sources/help-sbx.md); docs-sbx Sandbox environment files (research/sources/docs-sandboxes.md); rel-sbx v0.42.0 (research/sources/sbx-releases.md); capture/fixtures/env/sbxenv.yaml; capture/out/14-env-plan.txt, 14-env-plan-arg.txt
