<!-- vendored source: capability pages under docs/spec/capabilities/ of github.com/docker/sandbox-kit-spec at commit 4be7f4dff4d647f10c51dcdb392ce3fa18dc3e96 (main); latest tag at fetch time v3.0.0-m.8 (commit 129be2ff45e8f9463450eb3cf04ddcb52c2b76e5); fetched 2026-10-08; page text is verbatim, only the page marker lines are added -->

<!-- page: docs/spec/capabilities/com.docker.sandbox/agent-context@1.md of docker/sandbox-kit-spec @ 4be7f4dff4d6 fetched 2026-10-08 -->

# `com.docker.sandbox/agent-context@1`

Written instruction content the agent reads — the AGENTS.md family. A host
with no such concept skips an optional declaration or refuses a required
one.

- **Shape**: singleton — at most one entry per descriptor.
- **Permission surface**: **no** — instruction text the agent reads, on the
  entrypoint's trust plane.

## Config

```yaml
# A workload kit: owns the profile, ships its body as a staged file.
- type: com.docker.sandbox/agent-context@1
  config:
    filename: AGENTS.md
    directory: /home/agent/.codex    # explicit agent startup discovery
    contentFile: ./codex-context.md # authored path; staged + rewritten at publish

# A tool mixin: contributes content, owns no profile.
- type: com.docker.sandbox/agent-context@1
  config:
    contentFile: ./gh-context.md

# A content-free kit: small instructions inline.
- type: com.docker.sandbox/agent-context@1
  config:
    content: |
      Use `motd` to inspect the message of the day.
```

| Field | Type | Rules |
|---|---|---|
| `filename` | string | The context-file profile the agent reads (`CLAUDE.md`, `AGENTS.md`, …). Without `directory`, workload Kits only. An agent mixin may declare it together with an explicit `directory`. |
| `directory` | string | Optional absolute, canonical in-sandbox directory in which the runtime writes `filename`. Requires a single-component `filename` in the same entry. May reference a Kit argument or environment value. Omit it to keep the profile beside the workspace. |
| `contentFile` | string | Path to the context body. Authored as a path relative to the build context; the frontend stages the body into the image under `/usr/share/sandbox/kit/<stem>/` and **rewrites this field to the staged in-image path** in the published descriptor. Mutually exclusive with `content`. |
| `content` | string | The body inline, for content-free Kits with no layers to stage into. Mutually exclusive with `contentFile`. |

## Publish behavior

When `contentFile` is set, the frontend reads the authored file, stages it
into the Kit's image filesystem, and publishes the descriptor with
`contentFile` pointing at the staged path. The published artifact is
self-contained: consumers never resolve authored-relative paths.

## Runtime behavior

A conforming runtime:

- **MUST** treat the effective `filename` as the profile file it <!-- tck: agent-context@1/workload-filename-is-profile -->
  materializes for the agent, seeded with the runtime's own guidance. It
  is the workspace directory's sibling when `directory` is omitted,
  keeping the default profile outside the user's checkout.
- **MUST** materialize the profile in the effective `directory` when <!-- tck: agent-context@1/directory-honored -->
  stated, creating the directory when needed. An agent Kit chooses a
  directory its agent discovers at startup: Codex reads its global
  `AGENTS.md` from `CODEX_HOME` (normally `/home/agent/.codex`), while its
  project discovery stops at the repository root and can miss a
  workspace-sibling profile.
- **MUST** preserve existing content outside runtime-managed sections <!-- tck: agent-context@1/existing-content-preserved -->
  when updating a profile. This permits a project discovery location
  without replacing user-authored instructions.
- **MUST** surface each contributing Kit's context **progressively**: the <!-- tck: agent-context@1/progressive-surfacing -->
  profile carries a per-kit index (a "Kits" section) telling the agent
  which Kit contributed what and where to read it on demand — stacking
  mixins does not bloat the always-loaded profile.
- For **staged** content (`contentFile`, published form): the body already
  sits in the assembled image's filesystem, so the runtime **points** the
  agent at the staged path from the index. It does not copy the body.
- For **inline** content (`content`): the runtime writes a per-kit file
  (under a directory beside the profile) and points the index at it.
- **MUST NOT** treat context content as trusted input to the runtime <!-- tck: agent-context@1/content-untrusted -->
  itself: it is prose for the agent. Runtimes SHOULD neutralize any <!-- tck: agent-context@1/content-neutralized -->
  index-management sentinels appearing in kit-supplied text.

## Composition

A workload can provide a legacy profile with `filename` alone. An agent
workload, mixin, or set can provide an explicit profile with `filename`
and `directory` together; ordinary tool mixins contribute bodies alone.

A runtime **MUST** choose an explicit profile over a legacy workload <!-- tck: agent-context@1/explicit-profile-precedence -->
profile, independently of composition order. Multiple explicit profiles
with identical directory and filename describe one destination.

A runtime **MUST** refuse differing explicit profiles as a composition <!-- tck: agent-context@1/explicit-profile-conflict -->
error. Without an explicit profile, at most one contribution owns the
legacy filename, as before.

Each contributing body is indexed in the effective profile, including the
legacy workload's body. Per-kit attribution survives composition — the
index lists Kits individually, in composition order.

The optional `directory` field preserves existing descriptors and their
workspace-sibling default. Context bodies keep their staged paths; only
the profile containing runtime guidance and the per-kit index moves.
Older strict readers reject descriptors using the new field.

See [harness destinations](../../../agent-context-placement.md) for the
example Kits' discovery paths and loader constraints.

<!-- page: docs/spec/capabilities/com.docker.sandbox/agent-interactive-sessions@1.md of docker/sandbox-kit-spec @ 4be7f4dff4d6 fetched 2026-10-08 -->

# `com.docker.sandbox/agent-interactive-sessions@1`

The workload's interactive session control surface: the argv shapes a
human-facing host uses to put the agent's terminal UI in front of a
person — start a session, seed it with a prompt, reopen or pick a past
one. Not a grant: the host consumes it to operate the agent, the way it
consumes the image config's entrypoint.

These are the same verbs as [agent-sessions@1](agent-sessions@1.md),
launched with a terminal attached. An agent Kit whose CLI has both a
headless and an interactive mode declares **both** capabilities:
agent-sessions@1 for the headless verbs a harness drives,
agent-interactive-sessions@1 for the TUI verbs a human-facing host
launches. An agent with no interactive mode declares only
agent-sessions@1, and one with no headless mode only this capability.

A marker on agent-sessions@1 could not carry three things, which is why
this is its own capability:

- `newSession` and `sessionPicker` exist only interactively: a headless
  agent has no "open an empty session" or "show the picker".
  `newSession` is tied to the interactive launch of
  [lifecycle@1](lifecycle@1.md).
- An empty tail means the launch argv alone, because most TUIs start
  bare, which agent-sessions@1's shipped length-based reading cannot
  express.
- The interactive argv often differs from the headless one for the same
  verb (claude takes `-p X` headless and a bare `X` interactively, codex
  `exec X` and `X`, gemini `-p` and `-i`), so agent-sessions@1 has no
  place for the TUI argv.

- **Shape**: singleton. Workload Kits in practice — the agent the
  verbs drive is the workload's.
- **Permission surface**: **no** — a declaration about the workload's
  own CLI, on the entrypoint's trust plane.

## Config

```yaml
- type: com.docker.sandbox/agent-interactive-sessions@1
  config:
    prompt: ["{{.Prompt}}"]               # seeded with a prompt
    resume: [--resume, "{{.SessionID}}"]  # reopen a named session
    continue: [--continue]                # reopen the most recent one
    newSession: []                        # fresh: the launch argv alone
    sessionPicker: [--resume]             # the agent's session picker
    list:                                 # resumable session ids
      - sh
      - -c
      - claude-sessions --format ids
```

| Field | Type | Rules |
|---|---|---|
| `prompt` | list\<string\> | Argv **tail** appended to the workload's launch command; starts an interactive session seeded with the prompt. MUST reference `{{.Prompt}}`. | <!-- tck: agent-interactive-sessions@1/prompt-placeholder-required -->
| `resume` | list\<string\> | Argv tail; reopens a named session interactively. MUST reference `{{.SessionID}}`. | <!-- tck: agent-interactive-sessions@1/session-id-placeholder-required -->
| `continue` | list\<string\> | Argv tail; reopens the most recent session interactively. No placeholder. |
| `newSession` | list\<string\> | Argv tail; starts a fresh interactive session with no prompt. No placeholder. Often `[]`. **Omitted, it defaults to the [lifecycle@1](lifecycle@1.md) interactive launch**: the launch argv plus lifecycle's `interactive` tail when one is declared. Stated, it is authoritative for the new-session invocation. |
| `sessionPicker` | list\<string\> | Argv tail; starts the agent on its own session picker. No placeholder. |
| `list` | string \| list | A **complete command** (not a tail) whose stdout enumerates resumable session ids, one per line, most recent first. The same type and meaning as agent-sessions@1's `list`: every resumable session whichever mode opened it, and its ids feed `resume` of either capability verbatim. A Kit declaring it on both capabilities [states one command](#agreement-with-agent-sessions1). |

Every verb is optional, but a declaration with no keys at all says
nothing and is invalid. A present `list` must name a command: an empty
list or an empty string is invalid here. agent-sessions@1 is unchanged
(its grammar has shipped), and no Kit whose `list` names a command
differs between the two.

The *launch argv* on this page is the workload argv that the
[lifecycle@1](lifecycle@1.md) interactive launch appends its
`interactive` tail to; the page does not restate it.

### Presence

For every argv-tail verb here except `newSession`, a **present** key
means the agent supports the operation and an **absent** key means it
does not. A present empty list means the launch argv alone: for most
agents the bare interactive launch *is* the launch argv, so
`continue: []` or `sessionPicker: []` are as meaningful as any other
tail. `prompt` and `resume` are the exceptions, since each has to carry
its placeholder and so cannot be empty. This differs deliberately from
agent-sessions@1, where an empty tail reads as absent; agent-sessions@1
is unchanged. A consumer therefore tells `[]` from an
omitted key, and anything that re-renders the declaration between
authoring and consumption has to keep an empty list (see
[Composition](#composition)).

`newSession` is the one verb that is never unsupported: every agent can
start a session. Omitted, it names the lifecycle@1 interactive launch.
Present, it is authoritative for the new-session invocation, and a
present `[]` still means the launch argv alone. Omitting it does not
count as declaring a verb, so `newSession` alone (even `[]`) is a valid
declaration and an empty `config` is not.

### Agreement with lifecycle@1

[lifecycle@1](lifecycle@1.md)'s `interactive` field is the argv tail
for the engine's TTY launch mode, and `newSession` names the same
invocation.

A Kit declaring both `newSession` and lifecycle `interactive` **MUST** <!-- tck: agent-interactive-sessions@1/new-session-matches-lifecycle-interactive -->
give them the same argv, an explicit `[]` included: a `newSession` of
`[--tui]` beside an `interactive` of `[]` names two different launches.
Validation rejects a mismatch, both in one descriptor and when
composition brings the two from different Kits, so the default (omitted
`newSession`) and the explicit spelling can never disagree. A Kit
declaring only one is not in conflict: an omitted `newSession` takes the
lifecycle tail, and a stated one governs the new-session invocation on
its own.

### Agreement with agent-sessions@1

A session is the conversation and its state, not the mode that opened
it. `list` enumerates every resumable session whichever mode opened it,
and `resume` of either capability reopens any of them in that verb's
mode, so both capabilities' `list` is one command. A host that wants to
tell origins apart records the origin itself when it creates a session.

A Kit declaring `list` on both **MUST** give them the same command; <!-- tck: agent-interactive-sessions@1/list-matches-agent-sessions -->
validation rejects a mismatch, comparing the decoded argv, so a string
and its `[sh, -c, ...]` spelling are equal. A Kit may still declare
`list` on only one of them.

### Placeholders

`{{.Prompt}}` and `{{.SessionID}}` are substituted by the host before
execution, and may ride inside a larger token (`--prompt={{.Prompt}}`).
They are the same placeholders, with the same rules, as in
[agent-sessions@1](agent-sessions@1.md#placeholders): the placeholder is
the verb's whole point, so a verb that never receives the prompt or the
session id would run the agent with the caller's input silently
discarded, and the references are validation requirements.

## Runtime behavior

A conforming runtime (or host):

- **MUST** build each interactive invocation as the launch argv plus <!-- tck: agent-interactive-sessions@1/interactive-from-launch-argv -->
  the verb's tail, with placeholders substituted. Verb tails never
  replace the launch command.
- **MUST** start a new interactive session, when `newSession` is absent, <!-- tck: agent-interactive-sessions@1/absent-new-session-is-lifecycle-launch -->
  exactly as the [lifecycle@1](lifecycle@1.md) interactive launch mode
  does.
- **MUST** launch every interactive verb with a terminal attached, the <!-- tck: agent-interactive-sessions@1/terminal-attached -->
  same way as the lifecycle@1 interactive launch mode.
- **MUST** substitute the raw caller values (no shell re-quoting into the <!-- tck: agent-interactive-sessions@1/raw-value-substitution -->
  argv elements — the tail is exec argv, not a shell string).
- **MUST** run `list` as its own complete command and parse stdout as ids, <!-- tck: agent-interactive-sessions@1/list-parses-stdout -->
  one per line, most recent first, as every resumable session and not
  only those opened interactively; ids feed `resume` verbatim.
- **MUST** treat an absent verb other than `newSession` as "operation <!-- tck: agent-interactive-sessions@1/absent-verb-unsupported -->
  unsupported" and surface that, rather than improvising flags.
- **MUST NOT** treat the declaration as a permission: it grants nothing; <!-- tck: agent-interactive-sessions@1/declaration-grants-nothing -->
  it teaches the host how to drive what the workload already runs.

## Composition

At most one contribution may declare it: an identical restatement is
the same ask, and anything else is an error
([§9.5](../../SPEC-v3.md#95-merging-a-set)). The surviving entry is the
original declaration, not a re-rendering of it, so an empty tail
survives composition as the verb it is. A mixin has nothing to drive, so
the declaration belongs on the workload.

<!-- page: docs/spec/capabilities/com.docker.sandbox/agent-sessions@1.md of docker/sandbox-kit-spec @ 4be7f4dff4d6 fetched 2026-10-08 -->

# `com.docker.sandbox/agent-sessions@1`

The workload's session control surface: the argv shapes a harness uses to
drive the agent — run one prompt headlessly, list past sessions, resume or
continue one. Not a grant: the host consumes it to operate the agent, the
way it consumes the image config's entrypoint.

This is the headless side of an agent's session surface; its interactive
sibling is [agent-interactive-sessions@1](agent-interactive-sessions@1.md),
which carries the TUI verbs a human-facing host launches. An agent Kit
whose CLI has both a headless and an interactive mode declares **both**
capabilities: agent-sessions@1 for the headless verbs a harness drives,
agent-interactive-sessions@1 for the TUI verbs a human-facing host
launches. A non-interactive-only agent declares only agent-sessions@1.
A `list` declared on both capabilities is the same command in both, and
validation rejects a mismatch.

- **Shape**: singleton. Workload Kits in practice — the agent the verbs
  drive is the workload's.
- **Permission surface**: **no** — a declaration about the workload's own
  CLI, on the entrypoint's trust plane.

## Config

```yaml
- type: com.docker.sandbox/agent-sessions@1
  config:
    prompt: [-p, "{{.Prompt}}"]            # run one prompt non-interactively
    resume: [--resume, "{{.SessionID}}"]   # reopen a named session
    continue: [--continue]                 # reopen the most recent session
    list:                                  # enumerate resumable session ids
      - sh
      - -c
      - claude-sessions --format ids
```

| Field | Type | Rules |
|---|---|---|
| `prompt` | list\<string\> | Argv **tail** appended to the workload's launch command. MUST reference `{{.Prompt}}`. | <!-- tck: agent-sessions@1/prompt-placeholder-required -->
| `resume` | list\<string\> | Argv tail. MUST reference `{{.SessionID}}`. | <!-- tck: agent-sessions@1/session-id-placeholder-required -->
| `continue` | list\<string\> | Argv tail; no placeholder. |
| `list` | string \| list | A **complete command** (not a tail) whose stdout enumerates resumable session ids, one per line, most recent first. |

Every verb is optional — an absent verb means the agent has no such
operation — but a declaration with no verbs at all says nothing and is
invalid.

### Placeholders

`{{.Prompt}}` and `{{.SessionID}}` are substituted by the host before
execution, and may ride inside a larger token (`--prompt={{.Prompt}}`).
The `{{.X}}` shape matches the [credential-file](credential@1.md)
placeholders — one substitution vocabulary across the grammar. The
placeholder is the verb's whole point: a prompt verb that never receives
the prompt would run the agent with the caller's input silently discarded,
so the references are validation requirements.

## Runtime behavior

A conforming runtime (or harness):

- **MUST** build the headless invocation as the workload's launch argv <!-- tck: agent-sessions@1/headless-from-launch-argv -->
  (image `Entrypoint` + `Cmd`) plus the verb's tail, with placeholders
  substituted — the same way user-supplied args append. Verb tails never
  replace the launch command.
- **MUST** substitute the raw caller values (no shell re-quoting into the <!-- tck: agent-sessions@1/raw-value-substitution -->
  argv elements — the tail is exec argv, not a shell string).
- **MUST** run `list` as its own complete command and parse stdout as ids, <!-- tck: agent-sessions@1/list-parses-stdout -->
  one per line, most recent first; ids feed `resume` verbatim.
- **MUST** treat an absent verb as "operation unsupported" and surface <!-- tck: agent-sessions@1/absent-verb-unsupported -->
  that, rather than improvising flags.
- **MUST NOT** treat the declaration as a permission: it grants nothing; <!-- tck: agent-sessions@1/declaration-grants-nothing -->
  it teaches the host how to drive what the workload already runs.

## Composition

The workload Kit's declaration governs. A mixin declaring agent-sessions
has nothing to drive; composition keeps the workload's entry.

<!-- page: docs/spec/capabilities/com.docker.sandbox/agent-skill@1.md of docker/sandbox-kit-spec @ 4be7f4dff4d6 fetched 2026-10-08 -->

# `com.docker.sandbox/agent-skill@1`

One bundled agent skill, supplied by the Kit's image and exposed in the
composed agent's skill directories. A workload or a mixin can supply it.

- **Shape**: instance — keyed by effective skill name.
- **Permission surface**: no — image content on the entrypoint's trust
  plane. Host sharing is governed by the destination
  `agent-skills@1` declaration and host policy.

## Config

```yaml
- type: com.docker.sandbox/agent-skill@1
  name: Pull request review              # optional display label
  config:
    path: /usr/share/example-skills/pr-review
    name: review-pr                       # optional basename override
```

Here, `type` identifies the capability contract, the entry's `name`
labels the request in a UI, and `config.name` chooses the skill directory.
For a destination of `/home/agent/.claude/skills`, this skill appears at
`/home/agent/.claude/skills/review-pr`. Omitting `config.name` uses
`pr-review`, the source basename, even when the display label is present.
Only the effective skill directory name participates in skill identity
and collision checks; changing the display label has no such effect.

| Field | Type | Rules |
|---|---|---|
| `path` | string | REQUIRED. Absolute, canonical in-image directory path; not `/`, no trailing slash, repeated separator, or `.` or `..` segments. |
| `name` | string | optional. Directory name in the agent's skill store. Defaults to the last component of `path`. Distinct from the entry's display-only `name`. |

The published source `path` **MUST** be literal. <!-- tck: agent-skill@1/source-literal -->
Build-phase arguments may choose it while authoring; create-phase
arguments and `kit.env` references cannot, because artifact validation
checks the source before a sandbox exists. The destination name may still be chosen at create.

The effective name **MUST** match `[A-Za-z0-9][A-Za-z0-9._-]*` and be at most 255 bytes. <!-- tck: agent-skill@1/name-valid -->
This portable component cannot escape the discovery directory. An explicit
empty or null `name` is invalid; omit it to use the basename.

The Kit **MUST** ship a regular `SKILL.md` file at the root of `path`. <!-- tck: agent-skill@1/content-present -->
Supporting scripts and references travel in the same directory tree.
This capability does not rewrite skill content or frontmatter; authors
keep any frontmatter name aligned with the effective name their agent
expects. The source directory itself may have a different name.

## Runtime behavior

Agent-bearing Kits declare destinations with
[agent-skills@1](agent-skills@1.md). Selected paths
union across the composition, including agent mixins. A missing, empty,
or disabled host store does not prevent bundled content from being
exposed.

A conforming runtime:

- **MUST** expose the complete directory at `<destination>/<effective-name>` <!-- tck: agent-skill@1/exposed -->
  at every selected discovery destination, preserving file contents,
  executable permissions, and relative references within the tree.
- **MUST** make it readable by the agent before launching the workload. <!-- tck: agent-skill@1/before-launch -->
- **MUST** refuse an unsatisfiable required request, including one with <!-- tck: agent-skill@1/unavailable -->
  no selected destination; an unsatisfiable optional request is skipped
  and recorded under the ordinary capability selection rules.
- **MUST NOT** execute bundled scripts merely to register the skill. <!-- tck: agent-skill@1/no-execution -->
  Running a skill is the agent's decision; credentials and network
  access remain separate grants.
- **MUST NOT** overwrite an existing skill of the same effective name in <!-- tck: agent-skill@1/existing-conflict -->
  a destination. A conflicting existing entry makes the request
  unsatisfiable, whether it came from image content or a shared store.
  A runtime's own exposure from a previous start is not a new conflict.

Mounts, copies, links, and combining host-shared and bundled content are
runtime choices. The observable result above is the contract. Bundled
skills do not grant permission to modify the host's shared store.

## Composition

Within one declaration block, duplicate effective names are errors.
Across Kits, requests with the same source path and effective name
collapse; required wins over optional and the first nonempty display
label is retained. Different source paths under one effective name are
a composition error, even if either request is optional. This compares
published declarations, not the contents of their trees.

Source and destination paths are independent: a skill mixin need not know
which agents consume it. The image overlay still owns source-path
collisions under the ordinary layer composition rules; authors should
use a Kit-specific source prefix.

<!-- page: docs/spec/capabilities/com.docker.sandbox/agent-skills@1.md of docker/sandbox-kit-spec @ 4be7f4dff4d6 fetched 2026-10-08 -->

# `com.docker.sandbox/agent-skills@1`

A directory this Kit's agent scans for skills. It receives selected
Kit-bundled skills and, when available and enabled, the host's shared
skills store. Declare it on the Kit that supplies the agent, whether it
is a workload or a mixin.

- **Shape**: instance — one entry per path.
- **Permission surface**: the path permits host sharing, and write
  access separately when `mode` is `readwrite`. Bundled content itself
  grants no host access.

## Config

```yaml
- type: com.docker.sandbox/agent-skills@1
  config:
    path: /home/agent/.claude/skills   # REQUIRED, absolute
    mode: readonly                     # optional: "readonly" (default) | "readwrite"
```

| Field | Type | Rules |
|---|---|---|
| `path` | string | REQUIRED. Absolute, canonical in-container path where the agent reads skills: no `.` or `..` segments, no trailing slash, not `/` itself. An alias such as `/x/../skills` for a declared `/skills` would evade the duplicate check, so canonical form is validated rather than normalized in. |
| `mode` | string | optional. `readonly` (default) or `readwrite`. The most access the Kit is willing to take to the host store, not a demand. Does not constrain bundled content. |

Two entries naming one path are rejected: identical ones as a duplicate
request, differing ones as a contradiction about the same mount.

## Access

Host sharing is supplemental. A missing or empty store, or a host setting
of off, leaves the discovery destination available for bundled skills.
The entry does not require the user to have host skills, even when it is
required. Required/optional selection still governs runtime support for
the capability; it does not make host content a startup prerequisite.

Both sides bound the result, and neither can exceed the other. The host
decides how much access it is prepared to give, and the Kit declares how
much it is prepared to take:

| Host setting | Kit `mode` | Effective |
|---|---|---|
| off | anything | no host mount; bundled skills remain available |
| readonly | `readwrite` | read-only — the host withholds write |
| readwrite | `readonly` (or unset) | read-only — the Kit never asked for write |
| readwrite | `readwrite` | read-write |

The Kit's half matters as much as the host's. An agent that only reads
skills says so, and then a permissive host does not hand it the ability to
rewrite the user's shared store — which is why an omitted mode means
read-only rather than "whatever the host allows".

## Why the Kit declares the path

A runtime cannot know where an arbitrary agent reads skills. It can know
for the agents it ships, and a runtime **MAY** keep such a mapping for
them, but a Kit that runs an agent behind a wrapper — or one the runtime
has never heard of — reads from a path no host-side table predicts. The
declaration is what lets the store reach those Kits at all.

It also composes. A sandbox built from a shell workload plus two agent
mixins has two skills paths, one per mixin, which a single sandbox-wide
agent identity cannot express.

## Runtime behavior

A conforming runtime:

- **MUST** use every selected `path` as a destination for selected <!-- tck: agent-skills@1/destination -->
  [agent-skill@1](agent-skill@1.md) requests, independently of host sharing.
  This is where the runtime links or otherwise exposes each bundle at
  `<path>/<effective-name>`. Every selected directory receives every
  selected bundled skill. A destination with no skills requires no
  filesystem change.
- **MUST** mount the shared skills store at `path` when the store exists <!-- tck: agent-skills@1/store-mounted-at-declared-path -->
  and is nonempty and the host's skills setting is not off.
- **MUST** mount it before lifecycle hooks run, so an install hook can <!-- tck: agent-skills@1/mounted-before-hooks -->
  read what the user shared.
- **MUST** resolve access as the narrower of the host's setting and the <!-- tck: agent-skills@1/access-narrower-of-both -->
  Kit's `mode`, and **MUST NOT** exceed either. A host that withholds the
  mount withholds it; a Kit that asks for `readonly` gets read-only however
  permissive the host is.
- **MUST NOT** refuse or skip an entry merely because the host store is <!-- tck: agent-skills@1/host-store-optional -->
  missing, empty, or disabled, even when the entry is required. These
  conditions withhold host content, not the discovery destination.
- **MUST** default an omitted `mode` to `readonly`. Skills are input to <!-- tck: agent-skills@1/readonly-default-honored -->
  the agent, and a sandbox that can rewrite the user's shared store affects
  every later sandbox, so write access is something both sides opt into.
- **MUST NOT** treat the store's contents as trusted input to the runtime <!-- tck: agent-skills@1/store-untrusted -->
  itself. Like [agent-context](agent-context@1.md), this is material for
  the agent, not instructions for the host.

What the store contains, where it lives on the host, and how a user fills
it are runtime concerns outside this specification. The runtime chooses
how to combine host-shared and bundled content while honoring their
access and conflict rules. Exposing bundled content does not grant
permission to modify the host store.

## Composition

Paths union across the set, and every selected path receives the same
bundled skills and any shared host store. Required wins over optional.
Unlike [volume@1](volume@1.md), two Kits naming one path is **not** a
conflict: they are asking for the same content in the same place, which
is satisfied once.

When two Kits name one path with different modes, the composition resolves
to the **widest declared mode**, still bounded by the host. A single mount
cannot be read-only and writable at once, and the narrower declaration is
not an isolation boundary that widening would breach: a sandbox is one
filesystem and one process tree, so a Kit that declared `readonly` was
never protected from a mount another Kit legitimately obtained. `mode`
states what one Kit asks for; the union is what the composition asks for,
which is exactly what the gate shows — the merged request surfaces the
write grant, so raising a path to `readwrite` by composing is a widening
the user approves, never a silent escalation. Within a **single** Kit the
same situation is a contradiction and is rejected by validation.

## Gate

The path is permission surface, under its own `skills` category rather
than `storage`. The two grant different things — a volume is space the
sandbox is given, while this hands a Kit a host directory the user
populated — and a gate naming both the same would not say which was
gained.

A new path widens, and so does raising an existing path from `readonly` to
`readwrite`: reading the user's shared skills and being able to rewrite
them for every later sandbox are different grants. Write is the larger
grant and includes read, so a writable request surfaces as both entries
and giving write up is not a widening.

<!-- page: docs/spec/capabilities/com.docker.sandbox/credential@1.md of docker/sandbox-kit-spec @ 4be7f4dff4d6 fetched 2026-10-08 -->

# `com.docker.sandbox/credential@1`

One service the workload authenticates to, and how the runtime presents
proof — never where the secret lives. The host's credential store is the
sole source; a Kit declares the need, the user's bindings answer it.

- **Shape**: instance — one entry may name one or both phases; overlapping
  (service, phase) pairs in the same declaration block are rejected.
- **Permission surface**: yes — the service name, per phase.

## Config

```yaml
- type: com.docker.sandbox/credential@1
  optional: true                       # entry-level: skip when unbound
  description: GitHub API access for gh
  config:
    service: github                    # REQUIRED: identifier in the host credential store
    phase: [install, runtime]          # REQUIRED: one phase or a list
    apiKey:                            # api-key presentation
      name: GH_TOKEN
      proxyManaged: true
      inject:
        - {domain: api.github.com, header: Authorization, format: "Bearer %s"}
        - {domain: github.com, scheme: basic, username: x-access-token}
    oauth:                             # OAuth presentation
      tokenEndpoint: {host: platform.claude.com, path: /v1/oauth/token}
      resourceHosts: [api.anthropic.com]
      sentinels:
        accessToken: sk-ant-oat01-proxy-managed
        refreshToken: sk-ant-ort01-proxy-managed
      credentialFile:
        path: ~/.claude/.credentials.json
        structure:
          claudeAiOauth:
            accessToken: "{{.AccessToken}}"
      responseFields: {accessToken: access_token, refreshToken: refresh_token, expiresIn: expires_in}
      passthrough: false
```

| Field | Type | Rules |
|---|---|---|
| `service` | string | REQUIRED. Lowercase-kebab name in the host credential store. |
| `phase` | string or list\<string\> | REQUIRED. `install`, `runtime`, or a non-empty list of distinct phases. The same credential configuration applies to every listed phase. |
| `apiKey` | object | conditional. At least one of `apiKey`/`oauth` MUST be declared. | <!-- tck: credential@1/one-of-apikey-oauth -->
| `apiKey.name` | string | In-container env var name. Empty or omitted with `inject` rules present declares an inject-only credential: outbound rewrites with no environment presence, not even a sentinel. At least one of `name`/`inject` MUST be declared. | <!-- tck: credential@1/name-or-inject -->
| `apiKey.proxyManaged` | bool | The real value stays on the host. A named key's variable carries a sentinel; an inject-only key has no in-container presence, and the boundary presents the real value outbound either way. |
| `apiKey.inject[]` | list | Outbound rewrite rules. `domain` REQUIRED and MUST appear in the network policy's allow list for every declared phase, whether the Kit declares [`@1`](network-policy@1.md) or [`@2`](network-policy@2.md). | <!-- tck: credential@1/inject-domain-in-allow -->
| `apiKey.inject[].header` / `format` | string | Header to set; `format` renders the value (e.g. `"Bearer %s"`). |
| `apiKey.inject[].scheme` / `username` | string | Non-header presentation, e.g. `basic` with `username` (credential as password). |
| `oauth.tokenEndpoint` | object | `host` REQUIRED when `tokenEndpoint` is set. |
| `oauth.resourceHosts` | list\<string\> | API hosts where the bearer is used. |
| `oauth.sentinels` | object | The placeholder access/refresh tokens rendered in-container. |
| `oauth.credentialFile` | object | Renders sentinels into a file the agent reads. `structure` is a declarative nested map, encoded after substitution — output is well-formed regardless of values. |
| `oauth.credentialFile.format` | string | Encoding of the substituted structure: `json` (default) or `toml`, for agents that read TOML credential files. Nested maps become TOML tables. |
| `oauth.responseFields` | object | Maps a provider's nonstandard token-response field names: `accessToken`, `refreshToken`, `expiresIn`. The refresh mapping also covers providers that reuse one field for both tokens. |
| `oauth.passthrough` | bool | Returns the real token to the container: a downgrade. |

`credentialFile.structure` leaf strings may reference `{{.AccessToken}}`
and `{{.RefreshToken}}` (strings), `{{.ExpiresAt}}` (a number),
`{{.Scopes}}` (an array), and `{{.PrimaryApiKey}}` (a string whose
enclosing key is omitted when no key is captured). Unknown placeholders are
errors. Each placeholder renders in the target encoding's own type.

Scalar phase declarations remain valid. The list form requires a reader
implementing this extension; older readers reject it.

## Runtime behavior

A conforming runtime:

- **MUST** resolve the credential from the host-side store keyed by <!-- tck: credential@1/resolved-from-host-store -->
  `service`. Host environment variables never auto-inject; a Kit cannot
  name where a secret lives, only what it needs.
- **MUST NOT** place the real secret in the container when `proxyManaged` <!-- tck: credential@1/secret-absent-in-sandbox -->
  or OAuth sentinels are in play: where the Kit names a variable or file,
  the container sees sentinel values there, and the boundary (proxy)
  substitutes the real credential on outbound requests matching the
  `inject` rules or `resourceHosts`.
- **MUST** intercept the OAuth `tokenEndpoint` and serve sentinel tokens, <!-- tck: credential@1/oauth-token-endpoint-intercepted -->
  refreshing host-side; `passthrough: true` is the explicit opt-out and a
  security downgrade a runtime MAY refuse.
- **MUST** scope by phase: an install-only credential is injectable only while <!-- tck: credential@1/phase-scoped -->
  install hooks run and is revoked before the workload's entrypoint starts;
  a runtime-only credential is unavailable to install hooks and is the
  agent's steady state. When both phases are listed, the credential is
  available in both, with the same configuration.
- **MUST** scope a bound, named, proxy-managed API key's sentinel to its <!-- tck: credential@1/sentinel-phase-scoped -->
  declared phases. This includes install hooks that declare its
  variable in `env`, the workload's initial environment, and later runtime
  commands: each receives a sentinel in a granted phase and none outside
  the granted phases. This is the environment-visible part of the broader
  phase boundary above; outbound injection and OAuth presentations remain
  subject to that boundary independently.
- **MUST** fail resolution when a **required** entry has no binding; an <!-- tck: credential@1/required-without-binding-fails -->
  **optional** entry with no binding is skipped and recorded, and the Kit
  runs unauthenticated.
- **SHOULD** set the `apiKey.name` env var to a sentinel (not empty) when <!-- tck: credential@1/sentinel-not-empty -->
  the credential is wired and the Kit names one, so Kit content can detect
  wiring without seeing the secret.
- **MUST** give an inject-only credential (no `name`) no environment <!-- tck: credential@1/inject-only-no-env -->
  presence at all: composing it adds no variable, sentinel or otherwise.

## Composition

Each listed phase participates independently in composition. Entries
union across the set. Two Kits declaring the same (service, phase) is a
composition conflict — one credential, one owner — even when one entry
uses a scalar and the other lists both phases.

## Gate

The service name is permission surface, per phase. A new service, or a
service moving between phases, widens.

<!-- page: docs/spec/capabilities/com.docker.sandbox/git-identity@1.md of docker/sandbox-kit-spec @ 4be7f4dff4d6 fetched 2026-10-08 -->

# `com.docker.sandbox/git-identity@1`

The user's runtime-provided Git author identity, supplied as `user.name`
and `user.email` defaults inside the sandbox. This requests attribution,
not authentication, signing authority or evidence of user review.
Authentication uses separate grants such as `credential@1`.

- **Shape**: singleton, **config-less**.
- **Permission surface**: **yes** — presence discloses the selected name
  and email to the sandbox.

## Config

```yaml
capabilities:
  - type: com.docker.sandbox/git-identity@1
    description: Attribute commits to the user's Git identity
```

Use `optional: true` when the Kit can run without a runtime-provided
identity.

- The entry **MUST NOT** carry `config`, including empty or null. <!-- tck: git-identity@1/no-config -->

The Kit requests an identity, not a configuration source. The runtime
selects and provides the name/email pair according to the user's
settings and its own policy. How it obtains or stores that pair is an
implementation detail; this capability prescribes no files, services,
discovery mechanism or storage location.

## Runtime behavior

A conforming runtime:

- **MUST** provide a complete, nonempty name/email pair selected by the <!-- tck: git-identity@1/runtime-provided -->
  runtime, not supplied by the Kit. An unavailable identity cannot be
  substituted with an identity inferred by sandbox processes.
- **MUST** expose the pair as the workload user's global Git defaults <!-- tck: git-identity@1/global-defaults -->
  before its workload and exec sessions run. `git config --global --get
  user.name` and `user.email` report the selected values. Existing global
  values for these two keys are replaced; unrelated guest settings are
  preserved. Other guest users need not receive the identity.
- **MUST** make the same defaults available to lifecycle hooks running <!-- tck: git-identity@1/before-hooks -->
  as the workload user, before those hooks execute. A hook explicitly
  running as another user is outside this guarantee.
- **MUST** preserve normal repository-local identity precedence. <!-- tck: git-identity@1/local-precedence -->
  The grant does not force `GIT_AUTHOR_*` or `GIT_COMMITTER_*` overrides
  and does not overwrite repository-local configuration.
- **MUST NOT** import unrelated settings from the configuration <!-- tck: git-identity@1/identity-only -->
  sources used to obtain the identity. Credential helpers, HTTP headers,
  includes, aliases, hooks, filters, signing programs and external paths
  are outside the grant. The
  two values are data: serializing them cannot create additional keys
  or execute commands.
- **MUST NOT** expose the configuration sources used to obtain the <!-- tck: git-identity@1/source-private -->
  identity. Resolving a source does not grant access to that source from
  the sandbox.
- **MUST NOT** modify the identity source or allow sandbox edits to update <!-- tck: git-identity@1/source-unchanged -->
  that source through this capability. Materialize defaults in
  sandbox-owned storage.
- **MUST** retain the runtime-provided pair for that sandbox across <!-- tck: git-identity@1/pinned-selection -->
  stop/start and recreate. Later changes to the identity source affect new
  sandboxes, not an existing one's selected identity. Guest edits remain
  subject to the runtime's ordinary writable-layer lifecycle.
- **MUST NOT** disclose the runtime-provided identity through this feature <!-- tck: git-identity@1/absent-without-grant -->
  when the capability is absent or skipped. This does not hide identity
  already present in kit content, commit history or an independently
  shared repository.
- **MUST** refuse a required entry when the runtime withholds the identity or <!-- tck: git-identity@1/unavailable-refuses-required -->
  either value is unavailable. An optional entry is skipped and recorded,
  and the sandbox starts without the runtime-provided identity.

The pair is personal information visible to sandbox processes and to
recipients of commits they create. Granting it neither grants network
access nor permits private signing keys to enter the sandbox.
A runtime can offer an explicit identity override or an off switch.

## Composition

A workload, mixin or enclosing set can request the capability. Identical
requests collapse; a required declaration wins over optional declarations.
There is one runtime-provided pair per sandbox, not one per requesting
Kit.

## Gate

Adding the capability widens permission surface, even when optional.
It contributes its type to the runtime-service portion of the surface.
The name/email values are runtime bindings, not Kit permission
declarations; they do not enter the Kit descriptor or its
permission-surface digest.

<!-- page: docs/spec/capabilities/com.docker.sandbox/host-mount@1.md of docker/sandbox-kit-spec @ 4be7f4dff4d6 fetched 2026-10-08 -->

# `com.docker.sandbox/host-mount@1`

One host directory shared with the host and across sandboxes composing
the same Kit. The runtime chooses its location and mount mechanism;
Linux bind mounts and VM filesystem sharing can satisfy the same grant.
Use [volume@1](volume@1.md) for sandbox storage without this sharing
contract.

- **Shape**: instance — one entry per path; duplicates rejected.
- **Permission surface**: yes — the path, separately marked host-shared.

## Config

```yaml
- type: com.docker.sandbox/host-mount@1
  config:
    path: /home/agent/.cache/pip   # REQUIRED, absolute and canonical
    mode: "0755"                 # optional initial directory permissions
```

| Field | Type | Rules |
|---|---|---|
| `path` | string | REQUIRED. Absolute, canonical in-container path; no `.`, `..`, doubled separators, trailing slash, NUL, or root `/`. |
| `mode` | string | optional. Octal (`755`, `0755`, `1777`), applied when the runtime creates the directory. |

There is no host-path field. The Kit requests where storage appears
inside the sandbox, not which host files it can access.

## Runtime behavior

A conforming runtime:

- **MUST NOT** let the Kit choose the host directory's location. <!-- tck: host-mount@1/runtime-owned-location -->
  The runtime owns it; a user MAY explicitly choose a replacement.
- **MUST** key the directory on the declaring Kit's identity and the <!-- tck: host-mount@1/isolated-by-kit -->
  cleaned `path`, so sandboxes composing the same Kit share storage,
  while another Kit declaring that path does not inherit it.
- **MUST** keep distinct destinations of the same Kit in separate <!-- tck: host-mount@1/isolated-by-path -->
  directories. A Kit's identity alone is not the storage key.
- **MUST** use a Kit identity another Kit cannot claim. A published <!-- tck: host-mount@1/identity-not-self-declared -->
  repository can supply that identity; descriptor display metadata and
  `source` attribution cannot. Identity for unpublished Kits is
  runtime-owned.
- **MUST** reuse the directory across tag or digest updates within one <!-- tck: host-mount@1/survives-kit-update -->
  Kit identity. Updating a Kit does not allocate fresh storage.
- **MUST** mount the directory at `path` before lifecycle hooks run. <!-- tck: host-mount@1/mounted-before-hooks -->
- **MUST** allow concurrent sandboxes of the same Kit to read and write <!-- tck: host-mount@1/shared-concurrently -->
  the directory. Kits coordinate access; the grant promises no locking
  or transactional behavior.
- **MUST** keep the directory's contents independently of any sandbox, <!-- tck: host-mount@1/survives-sandbox-removal -->
  including after its last sandbox is removed.
- **MUST** let the user find and remove the directory and access its <!-- tck: host-mount@1/listed-and-removable -->
  contents from the host. Sandbox writes reach this directory.
- **SHOULD** make the mount root writable by the agent user (uid 1000). <!-- tck: host-mount@1/agent-writable-root -->
- **SHOULD** apply `mode` when creating the directory; reopening it <!-- tck: host-mount@1/initial-mode-applied -->
  preserves existing permissions and contents.

Filesystem semantics MAY be weaker than those of `volume@1`: ownership
may be mapped from the host and overlayfs upper layers or xattrs may be
unavailable. Kits requiring those semantics use `volume@1`.

A runtime without host-directory sharing does not advertise this type.
An unclaimed required entry **MUST** fail closed; an optional one <!-- tck: host-mount@1/unadvertised-is-unmet -->
**MUST** be skipped and recorded without a host-sharing grant.

## Composition

Paths union across the set. `host-mount@1` and `volume@1` share the
cleaned in-container path as their storage identity key.

Two Kits declaring the same path, whether both use `host-mount@1` or <!-- tck: host-mount@1/no-silent-merge -->
one uses `volume@1`, conflict. A runtime **MUST NOT** silently merge
them, even when their configs are identical: shared storage has one
declaring Kit identity.

## Gate

The permission surface **MUST** list host-shared paths separately from <!-- tck: host-mount@1/separate-permission-surface -->
`volume@1` storage paths. Data written here reaches the host and other
sandboxes of the same Kit. A new path widens the grant; moving a path
from `volume@1` to `host-mount@1` also widens it. `mode` changes do not.

<!-- page: docs/spec/capabilities/com.docker.sandbox/kit-registry@1.md of docker/sandbox-kit-spec @ 4be7f4dff4d6 fetched 2026-10-08 -->

# `com.docker.sandbox/kit-registry@1`

Access to the runtime's Kit registry — the runtime-hosted registry endpoint
over its own image store, where Kit builds push results and pull the Kit
frontend. Declaring this capability is the only thing that makes the
registry reachable: the typed request literally is the enforcement.

- **Shape**: singleton, **config-less** — any `config` value is a
  validation error.
- **Permission surface**: yes — as a service entry (the bare type).

## Config

```yaml
- type: com.docker.sandbox/kit-registry@1
  description: Pushes built kits into the runtime's image store
```

No `config`. Reaching the registry is the host's answer — routing, address,
transport — never an address the Kit guesses.

## Runtime behavior

A conforming runtime:

- **MUST NOT** route the sandbox to the registry unless the capability is <!-- tck: kit-registry@1/no-route-unless-requested -->
  declared and granted. Absent declaration, the route does not exist; a
  connection attempt fails at the boundary, not with a permission error
  from the registry.
- **MUST** announce the endpoint to the sandbox itself (an environment <!-- tck: kit-registry@1/endpoint-announced -->
  variable, a runtime-managed alias hostname) rather than requiring the
  Kit to know one. Kit content reads the announced address and MUST NOT <!-- tck: kit-registry@1/content-must-not-assume-address -->
  hardcode any.
- **MUST** scope the grant to the registry endpoint: it is image-store <!-- tck: kit-registry@1/grant-scoped-to-endpoint -->
  access, not general egress, and it does not widen the
  [network policy](network-policy@1.md).
- **SHOULD** enforce the registry's own namespace/tag discipline <!-- tck: kit-registry@1/namespace-discipline -->
  server-side; the capability grants reachability, not arbitrary writes.
- **MUST** scope what the registry serves to Kit content — the Kit <!-- tck: kit-registry@1/serves-kit-content-only -->
  namespace and the frontend — rather than the runtime's whole image
  store. Reads need this as much as writes do: a store-wide read path
  turns any name a sandbox guesses into a served image.
- **MAY** restrict which Kit images are allowed to hold the capability,
  keyed on the published repository the Kit was consumed by. Any Kit can
  write this request into its own descriptor, so declaring it is not
  standing to hold it; a runtime that refuses simply routes nothing, the
  same position as a Kit that never asked.

## Composition

One declaration anywhere in the set routes the sandbox; the grant is
per-sandbox.

## Gate

Surfaces as a service entry (`com.docker.sandbox/kit-registry@1`). Absent →
present widens: image-store access is a grant, not a side effect of
network egress.

<!-- page: docs/spec/capabilities/com.docker.sandbox/lifecycle@1.md of docker/sandbox-kit-spec @ 4be7f4dff4d6 fetched 2026-10-08 -->

# `com.docker.sandbox/lifecycle@1`

The Kit's setup and launch behavior, executed by the engine across the
sandbox's life: install hooks once at create, startup hooks every boot,
files written at start, and the interactive argv tail for TTY sessions. A
capability rather than grammar fields so a host that cannot execute them
refuses the Kit by name at preflight instead of silently never running its
setup.

- **Shape**: singleton — at most one entry per descriptor.
- **Permission surface**: **no** — hooks and files run inside the sandbox
  on the entrypoint's trust plane; nothing crosses the boundary the gate
  guards. What hooks can *reach* is bounded by the other capabilities
  ([network](network-policy@1.md), [credentials](credential@1.md),
  [SSH agent](ssh-agent@1.md)).

Background hooks detach from boot; they do not by themselves prevent
session-based sandbox auto-stop. A Kit that needs to survive its
last client disconnecting declares [long-running@1](long-running@1.md).

## Config

```yaml
- type: com.docker.sandbox/lifecycle@1
  config:
    install:                       # once per sandbox, at create
      - command:                   # string (run via `sh -c`) or argv list
          - sh
          - -c
          - printf '%s' "$WORKSPACE_DIR" > /home/agent/.claude.json
        user: "0"                  # optional execution user
        env: [WORKSPACE_DIR]       # env vars this hook may see — deny by default
        description: Seed trust flags
    startup:                       # every boot — MUST tolerate re-running
      - command: [sh, -c, "chown -R agent:agent /home/agent/.claude"]
        user: "0"
        background: false          # true detaches
        description: Re-own the volume mount root
    files:                         # written at start
      - path: /home/agent/.config/settings.json    # REQUIRED, absolute
        content: '{"timeout": ${{ kit.args.timeout }}}'
        mode: "0644"               # optional octal
        overwrite: false           # default true; false skips when the file exists
        description: Default settings
    interactive: []                # argv tail for an interactive (TTY) session
```

| Field | Type | Rules |
|---|---|---|
| `install[].command` | string \| list | REQUIRED. A string runs via `sh -c`; a list is exec argv. |
| `install[].user` | string | optional execution user (uid or name). |
| `install[].env` | list\<string\> | Env var names the hook consumes. **Deny by default**: a hook sees only what it declares, which is hygiene first and also makes its inputs enumerable. |
| `install[].description` | string | optional. |
| `startup[].command` | string \| list | REQUIRED. Same string-or-argv rule. |
| `startup[].user` | string | optional. |
| `startup[].background` | bool | Detach instead of blocking boot. |
| `startup[].env` | list\<string\> | Same deny-by-default rule. |
| `files[].path` | string | REQUIRED. Absolute after create-time expansion, including `${{ kit.env.HOME }}` from the final container environment ([§6.1](../../SPEC-v3.md#61-final-container-environment)). |
| `files[].content` | string | File body. `${{ kit.args.* }}` and `${{ kit.env.* }}` expand at create; `$VAR` remains literal in the file. |
| `files[].mode` | string | optional octal. |
| `files[].overwrite` | bool | Default **true**. `false` skips the write when the file exists (e.g. state on a persistent volume). |
| `interactive` | list\<string\> | Argv tail appended to the workload's launch command (image `Entrypoint` + `Cmd` is the headless mode) for an interactive (TTY) session. The image config's `Cmd` is single-valued, so the interactive variant has no native slot; it rides here because the engine consumes it like the hooks — behavior, not a grant. Meaningful on workload kits: the launch command it modifies is the workload's. |

A lifecycle entry declaring no hooks, no files, and no interactive tail is
invalid — drop the entry instead. An explicit `interactive: []` is a
stated empty tail, the launch argv with nothing appended, and
composition preserves it. It says nothing on its own, so it must sit
beside a hook or file.

`interactive` names the same launch as the `newSession` verb of
[agent-interactive-sessions@1](agent-interactive-sessions@1.md); a Kit
declaring both gives them the same argv (an explicit `[]` included), and
validation rejects a mismatch. `agent-interactive-sessions@1`
`newSession` defaults to this tail when omitted.

## Runtime behavior

A conforming runtime:

- **MUST** run `install` hooks exactly once per sandbox, at create. <!-- tck: lifecycle@1/install-once -->
- **MUST** finish `install` hooks before the workload's entrypoint first <!-- tck: lifecycle@1/install-before-entrypoint -->
  runs.
- **MUST** run one composition's hooks in **dependency order** (a <!-- tck: lifecycle@1/hooks-dependency-order -->
  provider's hooks before its requirers').
- **MUST** hold the [network policy's](network-policy@1.md) install phase <!-- tck: lifecycle@1/install-network-scope-held -->
  open while install hooks run and close it before the entrypoint starts.
- **MUST** end install-phase [credentials](credential@1.md) with the <!-- tck: lifecycle@1/install-credentials-end-with-phase -->
  install phase, exactly as the network scope ends.
- **MUST** restrict a hook's environment to its declared `env` names plus <!-- tck: lifecycle@1/hook-env-restricted -->
  the **platform baseline**: `PATH`, `HOME`, `HOSTNAME`, `TERM`, `PWD`,
  `OLDPWD`, `SHLVL`, and `_`. Hooks run through a shell, which needs the
  first two to run anything and introduces the rest itself; pretending
  they can be absent would make every conforming runtime non-conforming.
  Baseline values **MUST** derive from the image and the sandbox, never <!-- tck: lifecycle@1/baseline-values-sandbox-derived -->
  from the host's environment — the baseline names are a shape, not a
  tunnel.
- **MUST** run `startup` hooks on every boot (create, stop/start, daemon <!-- tck: lifecycle@1/startup-every-boot -->
  restart, host reboot).
- Hook authors MUST make `startup` hooks idempotent: every boot means <!-- tck: lifecycle@1/startup-idempotent-authors -->
  every boot.
- **MUST** write `files` at start, each one belonging to the agent, and <!-- tck: lifecycle@1/files-written -->
  writable by it where the entry declares no `mode`: a file entry
  carries no `user:`, and this capability grants no permission surface
  precisely because its writes stay on the entrypoint's trust plane. A
  declared `mode` is applied as the kit asked, to a file the agent owns
  — a read-only file its owner can still change is on that plane, one
  the agent does not own is not. Which user the runtime writes as stays
  `default-users` below, and a runtime writing as root satisfies this by
  leaving the result the agent's. A path only root can own is an install
  hook's job — what `install[].user` is for.
- **MUST** honor each file's `overwrite` declaration: an existing file <!-- tck: lifecycle@1/files-overwrite-honored -->
  stays unless the entry says otherwise.
- **MUST** write `files` before the entrypoint runs, so the agent never <!-- tck: lifecycle@1/files-before-entrypoint -->
  observes the sandbox without them.
- **MUST** expand `${{ kit.args.* }}` in commands and file contents with <!-- tck: lifecycle@1/args-expanded -->
  the create-phase arg values, leaving `$VAR` untouched for the shell.
- **SHOULD** default execution users to root for install and the agent <!-- tck: lifecycle@1/default-users -->
  user (uid 1000) for startup and files when `user:` is unset, matching
  the platform floor's write-surface expectations.
- **MUST** launch interactive (TTY) sessions with the workload's launch <!-- tck: lifecycle@1/interactive-launch -->
  argv plus the `interactive` tail, and headless runs with the image
  config's `Entrypoint` + `Cmd` as-is.
- **MUST** refuse a Kit whose **required** lifecycle entry it cannot <!-- tck: lifecycle@1/required-unsatisfiable-refused -->
  execute (a host with no hook execution), rather than composing the Kit
  and silently skipping its setup.
- **SHOULD** attribute a failing hook to its Kit in errors (which Kit, <!-- tck: lifecycle@1/failing-hook-attributed -->
  which hook index).

## Composition

Install and startup lists concatenate in dependency order across the set;
files likewise. Composition MUST reject duplicate file paths and multiple <!-- tck: lifecycle@1/shared-paths-avoided -->
`interactive` declarations, including contributions from selected groups.
Repeated hook commands remain separate hooks. Singleton arity applies per
declaration block; selected contributions produce one effective entry.

<!-- page: docs/spec/capabilities/com.docker.sandbox/long-running@1.md of docker/sandbox-kit-spec @ 4be7f4dff4d6 fetched 2026-10-08 -->

# `com.docker.sandbox/long-running@1`

The workload runs independently of client sessions. A background startup
hook or a published port alone does not request this behavior: on a
runtime with session-based auto-stop, the sandbox can otherwise stop when
its last client disconnects.

- **Shape**: singleton, **config-less**.
- **Permission surface**: **no** — it changes when the host stops the
  workload, without granting access across the sandbox boundary.

## Config

```yaml
capabilities:
  - type: com.docker.sandbox/long-running@1
```

The entry is required by default. Use `optional: true` only when the
workload can tolerate ordinary session-based auto-stop.

- The entry **MUST NOT** carry `config`, including an empty or null <!-- tck: long-running@1/no-config -->
  value.

## Runtime behavior

A conforming runtime:

- **MUST NOT** automatically stop a sandbox granted this capability <!-- tck: long-running@1/survives-session-disconnect -->
  solely because no interactive, agent, exec, or other client session
  remains attached. Background workload processes keep running across
  that disconnection, including beyond the normal auto-stop grace period.
- **MUST** honor explicit stop operations for that sandbox. <!-- tck: long-running@1/explicit-stop-honored -->
  The capability also leaves runtime shutdown and recovery, failure
  handling, and explicit removal subject to the runtime's normal policy.
- **MUST** refuse a required entry it cannot provide during capability <!-- tck: long-running@1/required-unsatisfiable-refused -->
  preflight, by type name, before starting the workload. An optional
  entry it cannot provide is skipped and recorded; ordinary session
  auto-stop may then apply.

A runtime without session-based auto-stop already supplies the behavior,
but still advertises the type before accepting it as required. Detached
mode, a durable lease, or a service manager can implement the contract;
the capability prescribes none of them. It does not request automatic
restart after a failure or promise uninterrupted availability.

## Composition

A workload, mixin, or enclosing set can request this capability. One
Kit requesting it applies the behavior to the whole sandbox: a service
supplied by a mixin may need to outlive client sessions just as the
workload does. Identical declarations collapse; a required declaration
wins over an optional one. A composition is optional only when every
requester can tolerate session-based auto-stop.

## Gate

Not permission surface. The host can refuse to supply the behavior, just
as it can refuse other engine-executed capabilities.

<!-- page: docs/spec/capabilities/com.docker.sandbox/network-policy@1.md of docker/sandbox-kit-spec @ 4be7f4dff4d6 fetched 2026-10-08 -->

# `com.docker.sandbox/network-policy@1`

Phase-scoped egress policy: what the sandbox may reach while the Kit's
install hooks run, and what the agent may reach in steady state.

- **Shape**: singleton — at most one entry per descriptor, and exclusive
  with [`network-policy@2`](network-policy@2.md).
- **Permission surface**: yes — all four lists, direction-aware
  ([SPEC-v3 §7.4](../../SPEC-v3.md#74-permission-surface-and-the-gate)).

This version remains valid and is what a Kit that gates egress by host
alone should state. [`@2`](network-policy@2.md) adds HTTP rules that
narrow method and path over the connections these lists permit.

## Config

```yaml
- type: com.docker.sandbox/network-policy@1
  config:
    install:                      # open only while install hooks run
      allow: [registry.npmjs.org]
    runtime:                      # the agent's steady state
      allow:
        - api.anthropic.com:443
        - "*.github.com"
      deny:
        - telemetry.example.com
```

| Field | Type | Rules |
|---|---|---|
| `install` | object | optional. `allow`/`deny` lists for the install phase. |
| `runtime` | object | optional. `allow`/`deny` lists for the runtime phase. |
| `*.allow` | list\<string\> | Egress patterns to permit. |
| `*.deny` | list\<string\> | Egress patterns to refuse. Deny wins. |

Entry patterns:

| Pattern | Example | Meaning |
|---|---|---|
| exact host | `api.example.com` | the host, any port unless one is stated |
| host + port | `api.example.com:443` | the host on that port |
| single-label wildcard | `*.example.com` | exactly one subdomain label |
| everything | `*` or `**` | all egress (typical only for install phases of build-heavy Kits) |

The precise wildcard matcher is runtime-owned; the patterns above are the
portable core. Port suffixes are ignored for allow-list membership checks
(`host:443` and `host` name the same host).

## Validation

- Strict config decode; unknown keys are errors.
- Cross-entry invariant: every
  [`credential@1`](credential@1.md) inject domain MUST appear in the <!-- tck: network-policy@1/inject-domain-in-allow -->
  **matching phase's** allow list (a bare `*`/`**` entry covers every
  domain). Injection sets the header; egress is gated separately — an
  inject domain outside the allow list would be a credential mapped onto a
  connection that can never occur.

## Runtime behavior

A conforming runtime:

- **MUST** enforce deny-by-default: egress not matched by an allow entry is <!-- tck: network-policy@1/deny-by-default -->
  refused. An absent phase block grants nothing for that phase.
- **MUST** apply deny precedence: a host matching both lists is refused. <!-- tck: network-policy@1/deny-precedence -->
- **MUST** scope the install lists to the install phase only — open while <!-- tck: network-policy@1/install-phase-scoped -->
  the composition's [lifecycle install hooks](lifecycle@1.md) run, and
  **closed before the workload's entrypoint starts**. Install-phase grants
  are unreachable from the running agent.
- **MUST** enforce at a boundary the sandbox cannot bypass (typically a <!-- tck: network-policy@1/unbypassable-boundary -->
  host-side proxy the container's egress is forced through), not by
  in-container configuration the workload could rewrite.
- **SHOULD** surface refused connections observably (logs, events) so a <!-- tck: network-policy@1/refusals-observable -->
  missing allow entry is diagnosable.

## Composition

Across the resolved set, allow lists union per phase and deny lists union
per phase; deny precedence applies to the merged result. One Kit's deny is
not defeated by another Kit's allow.

## Gate

All four lists are permission surface. A new allow entry widens; a
**removed deny entry also widens** — the deny was part of what made the
grant acceptable.

<!-- page: docs/spec/capabilities/com.docker.sandbox/network-policy@2.md of docker/sandbox-kit-spec @ 4be7f4dff4d6 fetched 2026-10-08 -->

# `com.docker.sandbox/network-policy@2`

Phase-scoped egress policy whose entries may bound a host to particular
HTTP requests: what the sandbox may reach while the Kit's install hooks
run, what the agent may reach in steady state, and what it may do there.

- **Shape**: singleton — at most one entry per descriptor, and exclusive
  with [`network-policy@1`](network-policy@1.md).
- **Permission surface**: yes — the hosts and the requests they admit,
  direction-aware
  ([SPEC-v3 §7.4](../../SPEC-v3.md#74-permission-surface-and-the-gate)).

`@2` keeps `@1`'s phases and its allow/deny pair, and lets an entry say
more than a host. A `@1` config is a `@2` whose entries are all bare,
which is what it means: every method and path on the hosts it allows.

## Config

```yaml
- type: com.docker.sandbox/network-policy@2
  config:
    install:                          # open only while install hooks run
      allow:
        - registry.npmjs.org
    runtime:                          # the agent's steady state
      allow:
        - github.com                  # bare: the connection, any protocol
        - hosts: [api.github.com]     # bounded: only these requests
          methods: [GET, HEAD]
          paths: [/repos/**]
      deny:
        - telemetry.example.com
        - hosts: [api.github.com]
          methods: [DELETE]
```

An entry is either a **host string** or an **object**. The string form is
shorthand for an object naming that one host and nothing else, so a Kit
that bounds nothing writes the list `@1` always wrote.

| Field | Type | Rules |
|---|---|---|
| `install` | object | optional. `allow`/`deny` entries for the install phase. |
| `runtime` | object | optional. `allow`/`deny` entries for the runtime phase. |
| `*.allow` | list\<entry\> | Entries to permit. |
| `*.deny` | list\<entry\> | Entries to refuse. Deny wins. |

### Entries

| Field | Type | Rules |
|---|---|---|
| `hosts` | list\<string\> | REQUIRED, non-empty. Domain patterns. Literal on a bounded allow entry. |
| `methods` | list\<string\> | optional. Uppercase HTTP method tokens, or the single entry `ANY`. Stating any of them bounds the entry. |
| `paths` | list\<string\> | optional. Path globs, each starting with `/`. Requires `methods`; omitted alongside them, it means every path. |

Host patterns are `@1`'s: exact host, `host:port`, `*.example.com`, and
`*` or `**` for everything. Port suffixes are ignored for allow-list
membership.

An entry stating neither `methods` nor `paths` is **unbounded**: it grants
the connection, for any protocol, exactly as `@1` did. An entry stating
either is **bounded**: it grants matching HTTP requests and nothing else,
so the same host carries no other traffic through that entry.

Stating `paths` requires stating `methods`. A path entry that did not say
which methods it bounds would read as a restriction while granting every
verb on that path, so `ANY` is spelled out where it is meant:

```yaml
- hosts: [api.example.com]
  methods: [ANY]
  paths: [/v1/**]
```

`ANY` is the only method when present — it already covers every method,
including extension methods no list names, so putting it beside `GET`
says nothing more and hides which was intended.

## Validation

- Strict config decode; unknown keys are errors.
- A descriptor declares one network-policy version. `@1` and `@2`
  together is an error: both describe the same grant, and merging them
  would mean guessing which bounds the other.
- Methods are canonical uppercase. `get` is an error rather than
  normalized in, so a published entry reads as the one enforcement
  matches.
- An empty `methods` or `paths` list is an error. Wildcard meaning
  belongs to an omitted field alone, or a generated document stating
  `methods: []` would silently grant every method.
- A bounded allow entry MUST name its hosts literally: no `*` in them. A <!-- tck: network-policy@2/bounded-allow-hosts-literal -->
  pattern cannot be bounded and unbounded at once — an entry bounding
  `*.example.com` to `GET` overlaps any entry naming a host inside it, and
  ranking the two needs the wildcard matcher, which is runtime-owned.
  Unbounded entries keep `@1`'s patterns, and so do deny entries however
  they are bounded: a deny wins outright, so an overlap between two of
  them decides the same way.
- Cross-entry invariant: every [`credential@1`](credential@1.md) inject
  domain MUST appear among the matching phase's allowed hosts. <!-- tck: network-policy@2/inject-domain-in-allow -->

## Runtime behavior

A conforming runtime implements every `@1` requirement, reading an
unbounded entry exactly as it reads an `@1` host. In addition:

- **MUST** refuse a request matching any bounded `deny` entry, whatever <!-- tck: network-policy@2/http-deny-precedence -->
  the allow entries say, and refuse every connection to a host a bare
  `deny` entry names. Deny wins as it does in `@1`.
- **MUST** treat a host granted only by bounded entries as deny-by-default: <!-- tck: network-policy@2/bounded-host-refused-outside-rules -->
  a request is refused unless some bounded entry admits it by both method
  and path, and non-HTTP traffic to that host is refused outright. The
  entry grants those requests, not the host.
- **MUST** apply an entry with no `methods` to every method, and one with <!-- tck: network-policy@2/omitted-methods-paths-are-every -->
  `methods` but no `paths` to every path.
- **MUST** fail closed for a bounded host whose traffic it cannot inspect. <!-- tck: network-policy@2/fail-closed-on-uninspectable -->
  A runtime that cannot see the method and path — an opaque tunnel it does
  not terminate — refuses rather than falling back to a connection-level
  verdict, which would grant everything the bound was written to withhold.
- **MUST** enforce at a boundary the sandbox cannot bypass, as in `@1`. <!-- tck: network-policy@2/unbypassable-boundary -->
- **MUST** answer a request these entries refuse with HTTP status `403`, <!-- tck: network-policy@2/refusal-is-403 -->
  rather than dropping the connection or letting the origin's own status
  stand. The refusal happens at the boundary and the origin never sees the
  request, so the status is the only thing distinguishing an enforced bound
  from the origin answering `404` or `405` on its own. A caller that cannot
  tell those apart cannot tell an enforcing runtime from one that ignored
  the entries.
- **SHOULD** surface a refused request's entry observably, so a missing <!-- tck: network-policy@2/refused-rule-observable -->
  method or path is diagnosable beyond the status.

## Composition

Across the resolved set, allow entries union per phase and deny entries
union per phase; deny precedence applies to the merged result.

Union widens, which is what it must do: a host one Kit grants unbounded
stays unbounded however narrowly another Kit bounds it, because no Kit
controls what its neighbours were granted. Narrowing what another Kit
reaches is `deny`'s job, and one Kit's deny is not defeated by another
Kit's allow.

A Kit on `@1` contributes bare entries, so mixing versions across Kits
composes without a conversion step.

## Gate

Both the hosts and the requests they admit are permission surface, and
the request projection carries one entry per method, host, and path so
the gate compares grants as a set. `ANY` and an omitted method list both
render as `ANY`, which is the wildcard they are.

A new allow entry widens; a **removed deny entry also widens**. Bounding a
host that was unbounded is a narrowing, and dropping the bound is the
widening — which the projection shows, because an unbounded entry renders
as every method on every path.

Newly allowed hosts report once, against the host list. Their breadth
follows from the grant the gate has just shown, so re-reporting it per
method would bury the case this category exists for: a host already
granted losing the entries that bounded it.

Dropping a bare deny reports once, against the host list, for the same
reason: an unbounded entry refuses every request as well as the
connection, so the loss is one loss however many ways it projects. A
bounded deny has no host-list counterpart and is reported on its own.

A bare `*` or `**` covers every host, so bounding one inside it adds
nothing and is not reported. Narrower globs are not expanded: whether
`*.example.com` covers `api.example.com` is the runtime's matcher to
decide, and the gate does not own it. Those read as widenings, which
over-prompts rather than granting silently.

<!-- page: docs/spec/capabilities/com.docker.sandbox/port@1.md of docker/sandbox-kit-spec @ 4be7f4dff4d6 fetched 2026-10-08 -->

# `com.docker.sandbox/port@1`

One in-container port the runtime should publish to the host. Inbound
service exposure — distinct from the outbound
[network policy](network-policy@1.md).

- **Shape**: instance — one entry per (container port, transport);
  duplicates rejected.
- **Permission surface**: yes — `port/transport`.

## Config

```yaml
- type: com.docker.sandbox/port@1
  config:
    name: devserver        # optional informational label
    container: 3000        # REQUIRED, 1..65535
    transport: tcp         # optional: "tcp" (default) | "udp"
```

| Field | Type | Rules |
|---|---|---|
| `name` | string | optional. Label surfaced in port listings. |
| `container` | int | REQUIRED. 1–65535. |
| `transport` | string | optional. `tcp` (default when empty) or `udp`. |

## Runtime behavior

A conforming runtime:

- **MUST** publish the container port to the host when the entry is <!-- tck: port@1/published-when-granted -->
  granted.
- **MUST** allocate the host side itself — a Kit cannot pin a host port <!-- tck: port@1/host-side-allocated-by-host -->
  (two Kits requesting the same one would collide). Host binding SHOULD be <!-- tck: port@1/host-binding-default -->
  loopback with an ephemeral port; users pin host ports through the
  runtime's own UX, not the descriptor.
- **SHOULD** surface `name` wherever published ports are listed. <!-- tck: port@1/name-surfaced -->

## Composition

Entries union across the set, deduplicated on (container, transport). Two
Kits publishing the same port is a single publication, not a conflict.

## Gate

`port/transport` is permission surface. A new port widens.

<!-- page: docs/spec/capabilities/com.docker.sandbox/privileged@1.md of docker/sandbox-kit-spec @ 4be7f4dff4d6 fetched 2026-10-08 -->

# `com.docker.sandbox/privileged@1`

A request for elevated privilege. Present or absent — there is nothing to
configure, and the host may refuse.

- **Shape**: singleton, **config-less** — any `config` value is a
  validation error.
- **Permission surface**: yes — the strongest single widening.

## Config

```yaml
- type: com.docker.sandbox/privileged@1
  description: Runs nested containers via the inner engine
```

No `config`. `description` SHOULD say why, because a human answers this <!-- tck: privileged@1/description-says-why -->
request.

## Runtime behavior

A conforming runtime:

- **MUST** run the sandbox with its platform's elevated-privilege mode when <!-- tck: privileged@1/elevation-granted -->
  granted (e.g. a privileged container).
- **MAY** refuse. Refusal fails resolution for a required entry; an
  optional entry is skipped and recorded, and the Kit runs unprivileged.
- **SHOULD** require explicit, non-default consent to grant — this is the <!-- tck: privileged@1/explicit-consent -->
  one request that dissolves most of the boundary the sandbox exists for.

## Composition

One Kit requesting it makes the composition privileged. There is no
narrower scope: privilege is per-sandbox.

## Gate

Boolean surface. Absent → present is a widening that MUST stop for <!-- tck: privileged@1/widening-gates -->
approval.

<!-- page: docs/spec/capabilities/com.docker.sandbox/resources@1.md of docker/sandbox-kit-spec @ 4be7f4dff4d6 fetched 2026-10-08 -->

# `com.docker.sandbox/resources@1`

The workload's compute: CPU, memory, GPU. A constraint on the Kit, not a
grant to it.

- **Shape**: singleton — at most one entry per descriptor.
- **Permission surface**: **no** — limits constrain the Kit rather than
  grant it anything, so changing them never stops for approval.

## Config

```yaml
- type: com.docker.sandbox/resources@1
  config:
    cpu: 4.0           # cores; MUST be >= 0
    memory: 8g         # byte-size string
    gpu: "1"           # runtime-defined selector ("1", "all", …)
```

| Field | Type | Rules |
|---|---|---|
| `cpu` | float | optional. Cores; non-negative. |
| `memory` | string | optional. Byte-size (`4096m`, `8g`, `2gib`). |
| `gpu` | string | optional. Runtime-defined selector. |

Any unset field means "no constraint from this Kit".

## Runtime behavior

A conforming runtime:

- **SHOULD** apply the declared values as the sandbox's resource limits. <!-- tck: resources@1/limit-applied -->
  Enforcement precision (cgroup limits, VM sizing) is runtime-owned.
- **MAY** let the operator override declared values (for example, a builder
  Kit's defaults raised via runtime configuration); the descriptor states
  what the Kit wants, the host owns what it gets.
- **MUST NOT** treat an unsatisfiable request as silent truncation when the <!-- tck: resources@1/no-silent-truncation -->
  entry is required: refuse, or degrade observably.
- GPU semantics (which devices, which driver stack) are runtime-defined;
  the field is a request selector, not a hardware contract.

## Composition

The workload Kit SHOULD own the composition's resource declaration. When <!-- tck: resources@1/workload-owns-declaration -->
mixins also declare, reconciliation is runtime-owned; a runtime SHOULD <!-- tck: resources@1/max-of-declarations -->
satisfy the maximum of the stated needs and MUST NOT undercut the workload's <!-- tck: resources@1/never-undercut-workload -->
declaration silently.

<!-- page: docs/spec/capabilities/com.docker.sandbox/sbx@1.md of docker/sandbox-kit-spec @ 4be7f4dff4d6 fetched 2026-10-08 -->

# `com.docker.sandbox/sbx@1`

A declaration that the workload targets the sandbox agent platform: the
host launches the agent rather than letting the image entrypoint be PID 1,
and it honors the identity the image config states instead of assuming one.

- **Shape**: singleton, **config-less** — any `config` value is a
  validation error.
- **Permission surface**: **no** — it asks the host to run the workload a
  particular way and to read what the image already declares. Nothing
  crosses the boundary the gate guards.

Declaring it is a claim in both directions, which is what makes it
checkable from both sides. The kit asserts its filesystem can be operated
this way; the host owes the duties below. A runtime that cannot perform
them refuses the type by name rather than approximating it.

## Config

```yaml
- type: com.docker.sandbox/sbx@1
```

No `config`. The identity the host must honor is the image config's
`user`, which images already express; restating it here would create two
answers to one question, and one of them would go stale.

## What the kit provides

A workload declaring this type:

- **MUST** ship a POSIX shell at `/bin/sh` that the declared user can <!-- tck: sbx@1/posix-shell-present -->
  execute. The host runs hooks, install steps, and its own idle process
  through it. Occupying the path is not enough: a FIFO, socket, or device
  node, or bits that leave the declared user out, resolve here and then
  fail at the first hook. A link counts when what it resolves to is an
  ordinary file that user can execute.
- **MUST** ship a `bash` at `/bin/bash` the declared user can execute. <!-- tck: sbx@1/bash-present -->
  The agent is launched under bash specifically, because bash is what
  sources `BASH_ENV`; a POSIX shell would start the agent without its
  persistent environment.
- **MUST** declare a non-empty `user` in its image config. An image that <!-- tck: sbx@1/image-declares-user -->
  declares none leaves the host nothing to honor, and the host would be
  back to assuming.
- **MUST** resolve that user in `/etc/passwd` to a uid, a gid, and a home <!-- tck: sbx@1/user-resolves-in-passwd -->
  path. The host reads all four out of the image: the uid before the
  container exists, since it lands in the container's environment; the
  name to run commands as a login user; the gid to own what it writes;
  and the home as the working directory it writes from. A user the image
  names but does not resolve leaves the host guessing the rest.
  Resolution follows what a runtime does with the spelling: a numeric
  user is a uid rather than a login name — and stays one, so a numeric
  spelling a host cannot hold resolves to nothing rather than falling
  back to a login name that reads the same — a non-empty `user:group`
  suffix is the gid that applies instead of the passwd primary and
  resolves against `/etc/group` when it is named, and comments and
  malformed records are passed over as any account resolver passes over
  them. A row with no login name, a uid or gid a host cannot hold —
  anything at or above `4294967295`, whose top value is the reserved
  "leave this one alone" sentinel rather than an identity — or a home
  that is not absolute resolves nothing.
- **SHOULD** name the file by absolute path in `BASH_ENV` and ship it. <!-- tck: sbx@1/bash-env-names-a-shipped-file -->
  Without it the agent starts with whatever the image config carries and
  nothing the sandbox adds later, and a relative value resolves against
  whatever directory the agent happens to run from rather than against
  the image.

A kit artifact is judged without being run, so what the two shells are held to
before publication is presence, kind, and permission for the declared
user — an ordinary file at the path with an execute bit that identity
can use. Whether what is there behaves as `sh` or as `bash` is not
something image metadata can state, and an image that puts something
else at either path fails wherever the host uses it: hooks, install
steps, and the agent's own launch.

## Runtime behavior

A conforming runtime:

- **MUST NOT** let the image's entrypoint become PID 1. The entrypoint <!-- tck: sbx@1/entrypoint-not-pid-one -->
  names the agent's launch command, which the host reads and runs later;
  left in place it would prepend itself to whatever the host runs as PID 1.
- **MUST** run the agent, hooks, and file writes as the user the image <!-- tck: sbx@1/honors-image-user -->
  config declares — resolving its uid, gid, name, and home from the
  image — rather than as a fixed identity of the runtime's choosing.
- **MUST** launch the agent under `bash` so the file named by `BASH_ENV` <!-- tck: sbx@1/agent-launched-under-bash -->
  is sourced. The agent is not started from a login or interactive shell,
  so profile and rc files never run; this is the only thing that loads it.
- **MUST** place the workspace at the image config's working directory <!-- tck: sbx@1/workspace-at-workdir -->
  when the image declares an absolute one, so the kit's paths and the
  host's agree. Observable wherever the host derives a path from the
  workspace, such as the `agent-context@1` profile it writes beside it.
- **MAY** refuse the type. Refusal fails resolution for a required entry;
  an optional entry is skipped and recorded, and the kit runs however the
  host runs an ordinary image.

## Composition

Singleton, and a workload concern: the kit whose layers are the root
filesystem is the one whose image config carries the identity. A mixin
declaring it says nothing a host can act on, because a mixin's image
config does not become the composed image's.

## Gate

Not permission surface, so declaring it is not a widening. What it changes
is how the host runs the workload, not what the workload may reach.

<!-- page: docs/spec/capabilities/com.docker.sandbox/ssh-agent@1.md of docker/sandbox-kit-spec @ 4be7f4dff4d6 fetched 2026-10-08 -->

# `com.docker.sandbox/ssh-agent@1`

An SSH agent the workload can use on the user's behalf. The workload can
list the agent's public keys and use them to authenticate to remote
machines or sign data, while private keys stay outside the sandbox.

The runtime exposes the agent inside the sandbox and relays to a
**backing agent**: the agent that holds the keys. Where the backing agent
runs and which keys it exposes are the runtime's and user's decisions.
For example, a runtime can forward a selected agent from the user's
workstation or manage one on the user's behalf. The Kit names neither a
socket nor a particular key.

- **Shape**: instance — one entry may name one or both phases; overlapping
  phases in the same declaration block are rejected (ordinary top-level
  entries or one capability group's members).
- **Permission surface**: yes — the phase, and what the entry lets the
  agent sign in each phase.

## Config

```yaml
- type: com.docker.sandbox/ssh-agent@1
  optional: true                       # entry-level: skip when no backing agent is available
  description: Use the user's SSH keys during install and runtime
  config:
    phase: [install, runtime]          # REQUIRED: one phase or a list
    unrestricted: false               # optional; defaults to true
    sign: [git]                        # namespaced signatures the agent may make
    authenticate: [git@github.com]     # servers the agent may log in to, as [user@]host
```

| Field | Type | Rules |
|---|---|---|
| `phase` | string or list\<string\> | REQUIRED. `install`, `runtime`, or a non-empty list of distinct phases. The same rules apply to every listed phase, with the same boundary as `credential@1`. |
| `unrestricted` | boolean | optional, defaults to `true`. When true, the agent may sign any request; when false, at least one of `sign` or `authenticate` is required. |
| `sign` | list\<string\> | optional. Namespaces of the namespaced signatures the agent may make, such as `git` for commits and tags or `file` for files. Each is printable ASCII without spaces. |
| `authenticate` | list\<string\> | optional. Servers the agent may log in to, each `host` or `user@host`: a literal lowercase DNS name — no wildcard, port, or IP address — optionally preceded by the account name the login must use. |

An **unrestricted** entry signs whatever the sandbox asks, with the keys
the user chose to expose. It cannot state `sign` or `authenticate`. A
**bounded** entry (`unrestricted: false`) signs only what its lists name;
with only `sign`, it makes no logins. Empty lists and duplicate values
are errors.

## What a signature is for

Every signature goes through one request, `SSH_AGENTC_SIGN_REQUEST`, and
the data it carries says what the signature is for. A runtime classifies
each request by that data:

- A **namespaced signature** is data beginning with the six-byte
  `SSHSIG` preamble of OpenSSH's `PROTOCOL.sshsig`, followed by its
  namespace. `ssh-keygen -Y sign` makes these, and git's SSH commit and
  tag signing uses the namespace `git`.
- A **login signature** is data that is the payload of an SSH public-key
  authentication request (RFC 4252 §7): a session identifier, then
  `SSH_MSG_USERAUTH_REQUEST` with the user name, the service, the method
  `publickey` or `publickey-hostbound-v00@openssh.com`, and the key.
- **Anything else** — a certificate signed with a CA key the agent
  holds, or bytes no protocol above describes — is neither.

A login signature does not name the server it logs in to. OpenSSH (8.9
and later) tells the agent through a **session binding**: the
`session-bind@openssh.com` extension of OpenSSH's `PROTOCOL.agent`, which
carries the server's host key, the session identifier, the host key's
signature over that identifier, and whether the binding is for a
forwarded agent rather than the connection itself.

## Runtime behavior

A conforming runtime:

- **MUST** expose the backing agent through a Unix socket inside the <!-- tck: ssh-agent@1/agent-reachable -->
  sandbox during the granted phase, and set `SSH_AUTH_SOCK` to that
  socket's path in the environment the granted phase's processes start
  with. For a `runtime` grant, those are the workload, the sessions and
  commands run in the sandbox, and `startup` hooks that declare
  `SSH_AUTH_SOCK` in `env`; for an `install` grant, `install` hooks that
  declare it. Listing identities returns the backing agent's public
  keys, and a sign request the entry admits is signed by the backing
  agent.
- **MUST** relay only the requests that list identities and sign data <!-- tck: ssh-agent@1/operations-restricted -->
  (`SSH_AGENTC_REQUEST_IDENTITIES` and `SSH_AGENTC_SIGN_REQUEST`), plus
  session bindings as the rules below allow, and answer every other
  request with `SSH_AGENT_FAILURE` without passing it to the backing
  agent: adding, removing, or locking keys, loading smartcard or PKCS#11
  providers, and every other extension. Each of those changes the agent
  for everything else that uses it, and loading a provider has been a
  path to running code on the machine that holds the backing agent.
- **MUST**, for a bounded entry, sign a namespaced signature only when <!-- tck: ssh-agent@1/signatures-bounded -->
  its namespace is listed in `sign`, and refuse, without passing it to
  the backing agent, every sign request that is neither such a
  signature nor a login signature `authenticate` admits. An unrestricted
  entry relays every sign request.
- **MUST**, for a bounded entry, sign a login signature only when every <!-- tck: ssh-agent@1/logins-bounded -->
  one of these holds, and otherwise refuse it without passing it to the
  backing agent: the same connection to the agent carries a session
  binding the runtime verified; the session identifier in the signed
  data is that binding's; the binding's host key is a host key of a
  server named in `authenticate`; where that `authenticate` entry names
  a user, the signed data's user name is that user; and, for the method
  `publickey-hostbound-v00@openssh.com`, the host key in the signed data
  is the binding's.
- **MUST** verify a session binding before it counts — the host key's <!-- tck: ssh-agent@1/binding-verified -->
  signature over the session identifier — and **MUST NOT** treat a
  binding marked as forwarding as the server a login is for.
- **MUST** obtain the host keys it matches against `authenticate` from <!-- tck: ssh-agent@1/destination-keys-outside-sandbox -->
  outside the sandbox — the user's known hosts, keys the server's
  operator publishes, or keys the runtime pins — never from anything the
  sandbox presents. A binding is the sandbox's word about which server
  it is talking to; the host key is what makes that word checkable.
- **MUST NOT** place private key material in the sandbox. <!-- tck: ssh-agent@1/key-material-outside-sandbox -->
- **MUST NOT** give a sandbox that was not granted this capability any <!-- tck: ssh-agent@1/absent-without-grant -->
  path to the backing agent, even when one is available. An agent the
  runtime itself happens to reach, such as an `SSH_AUTH_SOCK` in its own
  environment, is never passed into the sandbox that way.
- **MUST** scope by phase: an `install` grant is reachable only while <!-- tck: ssh-agent@1/phase-scoped -->
  install hooks run and closes before the workload's entrypoint starts; a
  `runtime` grant is the workload's steady state.
- **MUST** re-establish the agent on every boot, so a runtime grant <!-- tck: ssh-agent@1/every-boot -->
  survives stop and start.
- **MUST** refuse a **required** entry when no backing agent is <!-- tck: ssh-agent@1/unavailable-refuses-required -->
  available — the runtime has none to offer, or the user withheld it —
  by type name, before starting the workload.
- **MUST** skip an **optional** entry it cannot back, and <!-- tck: ssh-agent@1/unavailable-skips-optional -->
  start the sandbox without `SSH_AUTH_SOCK`.

What a Kit grants, the user can narrow further. A runtime:

- **SHOULD** let the user limit which of the backing agent's keys a <!-- tck: ssh-agent@1/keys-selectable -->
  sandbox can use: identities outside the selection are left out of the
  list, and sign requests naming them are refused.
- **SHOULD** offer to ask the user to confirm each signature before the <!-- tck: ssh-agent@1/confirmation-offered -->
  backing agent makes it.
- **SHOULD** offer to end a grant, at a time the user chooses, before <!-- tck: ssh-agent@1/grant-expiry-offered -->
  its phase ends.
- **SHOULD** record each sign request it relays or refuses — the key, <!-- tck: ssh-agent@1/signatures-observable -->
  what the signature was for (the namespace, or the login's user and
  server), and the outcome — where the user can see it.

A Kit cannot configure any of these: each narrows what the user granted,
and none can widen it.

### Compatibility

Git's SSH commit and tag signing makes only namespaced signatures in the
namespace `git`, so `sign: [git]` serves it with no login grant at all.
OpenSSH clients bind sessions before logging in. A client that does not
cannot log in through a bounded entry, because nothing tells the agent
which server it is talking to; such a workload needs an unrestricted entry,
or HTTPS with `credential@1` instead.

`authenticate` grants a signature, not a connection: reaching the server
is the network policy's business, and a login the policy does not let
the sandbox make never reaches the agent.

A backing agent forwarded over a client's connection can come and go
with that connection while the sandbox keeps running. This page judges
availability when the sandbox is created and asks nothing about the
backing agent staying reachable afterwards: while it is unreachable,
signing through the socket fails as it does with any unreachable agent.

## Composition

Each phase named by an entry participates independently in composition.
Entries for the same phase merge into one: it is unrestricted when any of
them is, and otherwise its `sign` and `authenticate` are the unions of
the entries' lists. A required entry wins over an optional one. The
sandbox gets one socket per phase, whichever Kits asked for it.

## Gate

Per phase, what the agent may sign is permission surface: everything,
for an unrestricted entry; otherwise each namespace and each destination.
Widening is a phase newly asking for the agent, an install-only ask
moving to `runtime`, a bounded entry becoming unrestricted, a new
namespace, or a new destination — where `host` already covers
`user@host`, and the reverse is a widening.

An unrestricted entry lets the agent sign with every key the user exposes, for
anything the sandbox asks: logins to any server the sandbox can reach,
signatures carrying the user's identity, such as commits a code host
shows as verified, and certificates, if the agent holds a certificate
authority's key.

A runtime **SHOULD** state what a grant allows when it asks the user to <!-- tck: ssh-agent@1/grant-names-scope -->
approve it — the namespaces and servers of a bounded entry, and every
exposed key for anything for an unrestricted one — rather than
presenting it like a single credential.

<!-- page: docs/spec/capabilities/com.docker.sandbox/usb-device@1.md of docker/sandbox-kit-spec @ 4be7f4dff4d6 fetched 2026-10-08 -->

# `com.docker.sandbox/usb-device@1`

One USB passthrough request, matched by vendor/product identity or by
device class. Hardware access is host-answerable and permission-gated like
any other grant.

- **Shape**: instance; exact-duplicate entries rejected.
- **Permission surface**: yes — `vendor:product` or `class:<class>`.

## Config

```yaml
- type: com.docker.sandbox/usb-device@1
  optional: true
  description: YubiKey for signing
  config:
    vendorId: "1050"       # with productId; exclusive with class
    productId: "0407"
```

```yaml
- type: com.docker.sandbox/usb-device@1
  config:
    class: smart-card      # exclusive with vendorId/productId
```

| Field | Type | Rules |
|---|---|---|
| `vendorId` | string | With `productId`. The pair goes together. |
| `productId` | string | With `vendorId`. |
| `class` | string | Device class match. Exclusive with the ID pair — declare exactly one form. |

## Validation

Exactly one of (`vendorId` + `productId`) or `class`; an ID without its
partner is an error.

## Runtime behavior

A conforming runtime:

- **MUST** pass matching devices through to the sandbox when granted, and <!-- tck: usb-device@1/matching-devices-passed -->
  refuse the Kit (required) or skip the entry (optional) when it cannot or
  will not.
- **MUST** treat the grant as scoped to the match: a `class` grant does not <!-- tck: usb-device@1/grant-scoped-to-match -->
  admit unrelated devices, an ID grant admits only that vendor/product.
- **MAY** prompt per attach. Hotplug behavior (devices appearing after
  create) is runtime-owned; a runtime that supports it applies the same
  match.
- Runtimes on hosts without USB brokering (e.g. remote VMs) refuse rather
  than emulate.

## Composition

Entries union across the set.

## Gate

Each match is permission surface. A new match widens; broadening an ID
match to a class match is a new entry and widens.

<!-- page: docs/spec/capabilities/com.docker.sandbox/volume@1.md of docker/sandbox-kit-spec @ 4be7f4dff4d6 fetched 2026-10-08 -->

# `com.docker.sandbox/volume@1`

One persistent (or tmpfs) path the workload needs backed by storage that
outlives the container.

- **Shape**: instance — one entry per path; duplicates rejected.
- **Permission surface**: yes — the path.

## Config

```yaml
- type: com.docker.sandbox/volume@1
  config:
    path: /home/agent/.claude/projects   # REQUIRED, absolute
    size: 2g                             # optional byte-size string
    tmpfs: false                         # optional; RAM-backed instead of block
    mode: "0755"                         # optional octal permissions
```

| Field | Type | Rules |
|---|---|---|
| `path` | string | REQUIRED. Absolute in-container path. |
| `size` | string | optional. Byte-size (`512m`, `2g`, `1gib`). |
| `tmpfs` | bool | optional. RAM-backed mount; contents do not survive a stop. |
| `mode` | string | optional. Octal (`755`, `0755`, `1777`). |

## Runtime behavior

A conforming runtime:

- **MUST** mount storage at `path` before lifecycle hooks run, so install <!-- tck: volume@1/mounted-before-hooks -->
  hooks can populate it.
- **MUST** make a block (non-tmpfs) volume persistent across container <!-- tck: volume@1/persists-across-restart -->
  restarts, and **SHOULD** make it survive sandbox recreate, so agent state <!-- tck: volume@1/should-survive-recreate -->
  (sessions, caches) outlives the container image. How volume identity is
  keyed (sandbox, Kit, path) is runtime-owned; a recreate under the same
  identity reattaches the same volume.
- **MUST** back a `tmpfs: true` entry with RAM; its contents are <!-- tck: volume@1/tmpfs-ram-backed -->
  scratch and vanish on stop.
- **SHOULD** apply `size` as a capacity limit and `mode` to the mount <!-- tck: volume@1/size-and-mode-applied -->
  root. A runtime that cannot enforce `size` MAY treat it as advisory.
- Ownership: the mount root **SHOULD** be writable by the agent user <!-- tck: volume@1/agent-writable-root -->
  (uid 1000); Kits that need different ownership fix it in a
  [lifecycle](lifecycle@1.md) startup hook (a fresh mount may come up
  root-owned).

Whether removing a sandbox and later creating one with the same name
counts as a recreate is runtime-owned. Removal may delete its storage
or retain it for a later sandbox.

A runtime reattaching storage across sandbox removal **MUST** check <!-- tck: volume@1/reattach-checks-kit-identity -->
the Kit identity before attaching it, so a different Kit cannot inherit
the data. Descriptor display metadata and `source` attribution are not
sufficient identity evidence.

## Composition

Paths union across the set. Two Kits declaring the same path is a
composition conflict — a runtime MUST NOT silently merge them. <!-- tck: volume@1/no-silent-merge -->

The cleaned path also conflicts with a
[host-mount@1](host-mount@1.md) declaration at that destination.

## Gate

The path is permission surface. A new path widens; `size`/`mode` changes do
not (they constrain, not grant).

