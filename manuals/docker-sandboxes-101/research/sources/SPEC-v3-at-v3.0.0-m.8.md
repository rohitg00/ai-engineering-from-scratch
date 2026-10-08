# Docker Sandbox Kit Specification — v3

Normative reference for the Kit descriptor at `schemaVersion: "3"` and for
the OCI artifact a published Kit takes. The authoritative implementation is
the Go package at [`spec/`](../../spec/) ([`types.go`](../../spec/types.go),
[`validate.go`](../../spec/validate.go), [`version.go`](../../spec/version.go));
where this document and the code disagree, the code wins.

Each well-known capability type has its own page under
[`capabilities/`](capabilities/com.docker.sandbox/), specifying the config
schema and the runtime behavior a conforming runtime implements. This
document covers the grammar those entries plug into.

For how an implementation demonstrates it satisfies this document, see
[conformance.md](conformance.md). For an introduction to the model, see
[kit-intro.md](../kit-intro.md). For
the v2 `spec.yaml` grammar this format succeeds, see
[SPEC-v2.md](https://github.com/docker/sbx-kits-contrib/blob/main/spec/SPEC-v2.md).

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHOULD**, and **MAY**
are used as described in RFC 2119.

---

## 1. Overview

A **Kit** is one OCI image. Its manifest annotation
`vnd.docker.sandbox.kit.descriptor` carries the Kit's declarations — the
**descriptor** this document specifies — and its layers carry the Kit's
content. There is no kit-specific media type or artifactType: a Kit pulls,
inspects, and `FROM`s with stock tooling, and an engine that does not read
the annotation runs it as an ordinary image.

There are exactly two kinds of Kit, distinguished by the `kind:` field:

| Kind | Layers are | Count per composition |
|---|---|---|
| **`workload`** | A root filesystem; the image config carries entrypoint, cmd, env, user, workdir. | Exactly one |
| **`mixin`** | An overlay that lands on a workload's filesystem. May be declaration-only (a single descriptor-file layer). | Zero or more |

A descriptor deliberately carries **no top-level identity name, image
reference, or runtime config**: identity is the reference a Kit is consumed
by, matchable identity is what
[`provides`](#5-provides-requires-integrates-conflicts) states, and runtime
config lives in the image config where images already carry it.
Capability-entry names are display labels, not Kit identity. A `version:`
field exists only as a fallback for consumption references that carry no
version of their own ([§4](#4-top-level-fields)).

### 1.1 Descriptor and content

The descriptor is authored as YAML. The Kit's content recipe is ordinary
Dockerfile text — or, for a set, a list of other Kits — connected to the
descriptor by one of four authoring
forms ([§3](#3-authoring-forms)). At build time a BuildKit frontend —
dispatched by the descriptor's first line, `# syntax=docker/sandbox-kit:3` —
validates the descriptor, builds the content, and publishes both as one
image ([§9](#9-publishing)).

### 1.2 Strict decoding

Decoding uses strict field checking (`KnownFields(true)`). **Any
unrecognized field anywhere in the document is an error.** A misspelled key
silently ignored would be a policy silently absent.

### 1.3 Where behavior is specified

This grammar declares; runtimes behave. Descriptor-level rules (field
shapes, arity, cross-entry invariants) are enforced by the spec library and
restated in [§11](#11-validation-summary). Runtime behavior — what granting
a capability obligates a runtime to do — is specified per capability type on
the [capability pages](#7-capabilities), which are normative for runtimes
claiming support for that type.

---

## 2. Example

```yaml
# syntax=docker/sandbox-kit:3
schemaVersion: "3"
displayName: GitHub CLI
description: gh, installed from the official release tarball
sourceUrl: https://github.com/cli/cli
licenses: [MIT]

kind: mixin

args:
  version:
    default: "2.98.0"
    pattern: '^[0-9]+\.[0-9]+\.[0-9]+$'
    description: GitHub CLI release to install
    buildArg: GH_VERSION

provides: ["gh@${{ kit.args.version }}"]

capabilities:
  - type: com.docker.sandbox/network-policy@1
    config:
      runtime:
        allow: [github.com, api.github.com, uploads.github.com]

  - type: com.docker.sandbox/credential@1
    optional: true
    description: GitHub API access for gh
    config:
      service: github
      phase: runtime
      apiKey:
        name: GH_TOKEN
        proxyManaged: true
        inject:
          - {domain: api.github.com, header: Authorization, format: "Bearer %s"}

  - type: com.docker.sandbox/agent-context@1
    config:
      contentFile: ./gh-context.md
```

The content recipe lives in a companion `gh.dockerfile` beside this
descriptor ([§3.1](#31-companion-pair)).

---

## 3. Authoring forms

A Kit's declarations and its content recipe pair in one of four ways.
All four produce the same kind of artifact — an ordinary OCI image, read
the same way — so the first three are an authoring choice and nothing
more. The fourth is visible in one respect: a merged set keeps the
`kits:` record of what it was built from ([§3.4](#34-kit-set)), the way
an inline recipe keeps its `build:` block.

### 3.1 Companion pair

The default form: `<stem>.yaml` holds the descriptor, `<stem>.dockerfile`
beside it holds the recipe. The frontend finds the companion by the
filename-stem convention, or by an explicit `dockerfile:` field naming a
path relative to the descriptor's directory (which then frees the recipe's
name from the stem). A named recipe that does not exist is an **error**; a
missing conventional companion just means a declaration-only kit.

### 3.2 Inline `build:` block

The descriptor's `build:` field carries literal Dockerfile text — the
single-file form. Full Dockerfile semantics apply, including a foreign
`# syntax=` first line, because the frontend hands the block to the
Dockerfile frontend verbatim. Mutually exclusive with `dockerfile:`.

### 3.3 Comment descriptor

A valid Dockerfile carrying its descriptor in a `# kit:` comment block —
the file is simultaneously its own descriptor and its own recipe:

```dockerfile
# syntax=docker/sandbox-kit:3
# kit:
#   schemaVersion: "3"
#   kind: mixin
#   provides: ["gh@${{ kit.args.version }}"]
#   ...
# syntax=docker/dockerfile:1
FROM scratch AS content
...
```

The block is extracted byte-faithfully (dedent only); the rest of the file
is the recipe. A second `# syntax=` stanza after the block declares the
content's own frontend. A comment-descriptor file **MUST NOT** also declare <!-- tck: SPEC-v3 §3.3/comment-descriptor-no-content -->
`build:` or `dockerfile:` — the file already is the recipe.

### 3.4 Kit set

A `kind: set` descriptor's content is the Kits it lists in `kits:` —
the one authoring form whose recipe is not Dockerfile text. It exists so
a working environment can be shared as one reference instead of a command
line someone has to retype.

```yaml
# syntax=docker/sandbox-kit:3
schemaVersion: "3"
kind: set
displayName: Team Claude environment
version: "1.0.0"

kits:
  - ref: docker.io/dockerdev/sbx-kit-shell:1.0.0
  - ref: docker.io/dockerdev/sbx-kit-claude-mixin:2.1.6
    args:
      version: "2.1.6"
  - ref: docker.io/dockerdev/sbx-kit-gh:2.72.0
```

| Field | Type | Rules |
|---|---|---|
| `ref` | string | REQUIRED. The registry reference the Kit is consumed by. A local path or a git URL is refused: a set's Kits MUST be resolvable from the manifest alone, or the set could only be reproduced from the directory it was written in. | <!-- tck: SPEC-v3 §3.4/kit-published-reference -->
| `digest` | string | optional when authored, REQUIRED when published. `sha256:<64 hex>`, pinning that Kit's manifest. |
| `args` | map\<string,string\> | That Kit's create-phase args, keyed by its own arg names. |

- `kits:` is mutually exclusive with `build:` and `dockerfile:`, and a <!-- tck: SPEC-v3 §3.4/set-declares-no-recipe -->
  comment-descriptor file cannot declare it: a Kit's content recipe lives
  in exactly one place.
- A `kind: set` descriptor **MUST** list at least one kit. <!-- tck: SPEC-v3 §3.4/set-has-kits -->
- The order of the list carries no meaning. The set is resolved by
  [§5.3](#53-resolution-semantics-consumer-contract), which derives
  composition order from the listed Kits' own declarations — with the
  one difference that a set **MAY** have no workload among them,
  producing a merged mixin that composes onto a workload later exactly as
  those Kits would have.
- A set **MAY** declare anything a Kit declares — capabilities, provides,
  lifecycle hooks, its own args. Those declarations merge with the
  listed Kits' as one more contribution ([§9.5](#95-merging-a-set)).
- `kind: set` is an authoring kind and **MUST NOT** appear in a published <!-- tck: SPEC-v3 §3.4/set-kind-never-published -->
  descriptor: publishing derives `workload` or `mixin` from the listed
  Kits ([§9.5](#95-merging-a-set)). Stating the derived kind beside `kits:`
  is equivalent and legal.

### 3.5 Content rules by kind

- A `kind: workload` Kit **MUST** have content: its layers are the root <!-- tck: SPEC-v3 §3.5/workload-has-content -->
  filesystem. A workload with no recipe and no Kits list is rejected at build.
- A `kind: mixin` Kit **MAY** have no recipe, producing a declaration-only image (one descriptor-file layer; see §10).
- A workload's recipe **SHOULD** build on a base providing the runtime's <!-- tck: SPEC-v3 §3.5/workload-base-should-match-runtime -->
  platform floor — `bash`, the `agent` user (uid 1000), `git`, a CA store —
  or the Kit builds fine and fails at agent launch.

---

## 4. Top-level fields

Every key in the grammar — here and in capability configs — is
`lowerCamelCase`, and an acronym is title-cased rather than capitalized:
`sourceUrl`, `iconUrl`, `productId`, `apiKey`. The alternative rule,
capitalizing acronyms except when they lead, requires deciding for each
new field what counts as one; this rule has no such judgment, which is
what keeps a grammar meant to grow from drifting into two conventions.

```yaml
schemaVersion: "3"          # REQUIRED. Exactly the string "3".
kind: workload              # REQUIRED. "workload" | "mixin".
displayName: Claude Code    # optional. Human-readable label.
author: "Name <a@b.com>"    # optional. Publisher display string.
description: "..."          # optional. Short summary.
sourceUrl: https://…        # optional. Source repository or documentation.
iconUrl: https://…          # optional. Image shown in catalogs and pickers.
version: "1.4.2"            # optional. Fallback version; see below.
licenses: [Apache-2.0]      # optional. SPDX identifiers.
provides: []                # optional. §5.
requires: []                # optional. §5.
integrates: []              # optional. §5.
conflicts: []               # optional. §5.
capabilities: []            # optional. §7.
args: {}                    # optional. §6.
build: |                    # optional. §3.2. Exclusive with dockerfile, kits.
dockerfile: path            # optional. §3.1. Exclusive with build, kits.
kits: []                    # optional. §3.4. Exclusive with build, dockerfile.
```

| Field | Type | Rules |
|---|---|---|
| `schemaVersion` | string | REQUIRED. MUST be `"3"`. | <!-- tck: SPEC-v3 §4/schema-version-3 -->
| `kind` | string | REQUIRED. `workload`, `mixin`, or `set`. `set` is an authoring kind only — publishing derives `workload` or `mixin` from the Kits it lists ([§3.4](#34-kit-set)). (`sandbox` is the pre-rename spelling of `workload`; consumers MAY accept it on published Kits, authors MUST NOT write it.) | <!-- tck: SPEC-v3 §4/sandbox-spelling-not-written -->
| `displayName` | string | optional. |
| `author` | string | optional. Who published the Kit, in the `org.opencontainers.image.authors` convention (`Name <email>`, commas for multiples). **Display metadata only**: a self-asserted claim, never identity and never a trust input — publisher identity lives in the reference's registry namespace and the signature. |
| `description` | string | optional. |
| `sourceUrl` | string | optional. |
| `iconUrl` | string | optional. Absolute **https** URL to an image representing the Kit in catalogs and pickers. Display metadata, self-asserted like `displayName`. The scheme is constrained because a consumer fetches and renders this rather than merely displaying it: `javascript:`, `data:`, and `file:` are refused, and plain `http:` is refused so a rendered icon is not attacker-swappable in transit. Referenced rather than staged into a layer, because the surfaces that want an icon hold the manifest and not the layers — an icon a consumer had to pull the Kit to see would arrive after the moment it existed to inform. No `org.opencontainers.image.*` annotation is emitted for it: OCI defines no icon key, and the descriptor annotation already carries the field. |
| `version` | string | optional. Version-shaped ([§5.2](#52-versions)), or a build-phase arg reference expanded at publish. See below. |
| `licenses` | list\<string\> | optional. SHOULD be SPDX identifiers. | <!-- tck: SPEC-v3 §4/licenses-spdx -->
| `build` | string | optional. Literal Dockerfile text. Exclusive with `dockerfile` and `kits`. |
| `dockerfile` | string | optional. Relative path inside the descriptor's directory; MUST NOT escape it (that directory is the build context's root). Exclusive with `build` and `kits`. | <!-- tck: SPEC-v3 §4/dockerfile-inside-context -->
| `kits` | list\<kit\> | optional. The Kits this Kit's content is merged from ([§3.4](#34-kit-set)). Exclusive with `build` and `dockerfile`. |

**`version` is a fallback, never an override.** It supplies the version for
unversioned `provides` entries when the Kit is consumed by a reference that
carries no version of its own — a local directory, a git branch or commit.
A version-shaped consumption reference (an OCI tag, a version-shaped git
ref) always wins over it, so a stale `version:` cannot lie to the resolver;
an explicit `provides: [name@version]` outranks both.

---

## 5. `provides`, `requires`, `integrates`, `conflicts`

Kit-to-Kit capabilities: free-form names a Kit offers or constrains, matched
at resolution. Distinct from [§7 `capabilities`](#7-capabilities), which are
typed requests answered by the **host**.

```yaml
provides: ["gh@2.98.0"]                         # what this kit offers
requires: ["node >= 20.0.0, < 21.0.0"]          # must be satisfied by the resolved set
integrates: ["docker-engine >= 25.0.0"]          # works with when present
conflicts: ["podman"]                           # must be absent from the resolved set
```

- `provides` entries are `name` or `name@version`.
- `requires` and `integrates` entries are `name` or
  `name <op> version` with optional further `, <op> version` constraints
  ANDed together. `<op>` is one of `>=`, `>`, `<=`, `<`, `=`. The legacy
  form `name >= version` is unchanged. An unsatisfiable constraint set
  (conflicting pins, inverted or exclusively-touching bounds) is rejected
  at parse. Ranges and pins change only the `Satisfies` predicate:
  resolution stays a **closed-set check** (the set already names its
  providers; at most one provider per capability name), never a
  backtracking solver that picks versions from a registry.
- `conflicts` entries are bare names.
- Nothing an author offers is provided implicitly: a Kit that wants to be
  requirable by a name of its own states so in `provides`. The one
  exception is not an author's claim at all — publishing derives an entry
  per installed distribution package, in namespaces reserved for it
  ([§9.6](#96-derived-provides)).
- Arg references are permitted in `provides` (and `version`) only — they are
  expanded at publish ([§9.1](#91-expansion)). `requires`, `integrates`, and
  `conflicts` MUST stay literal: they are what the resolver judges, and a <!-- tck: SPEC-v3 §5/requires-literal -->
  parameterized constraint would make the judgment depend on caller input.

### 5.1 Names and namespaces

A capability name is bare (`gh`) or namespace-qualified
(`com.example/gh`). Bare names normalize to the default namespace
`com.docker.kit/` — `gh` and `com.docker.kit/gh` are the same capability,
while a third party's `com.example/gh` never matches either, the way
`docker.io/library/` qualifies bare image names. Matching, locks, and
surfaces speak normalized names; the short form is display sugar.

The base name is lowercase alphanumeric with hyphens, dots and pluses,
starting alphanumeric and never ending on a hyphen or dot. Dots and
pluses are there because a distribution package name is a capability name
under [§9.6](#96-derived-provides): Debian ships `libstdc++6`,
`python-3.14` and `containerd.io` — around one package in twenty on a
typical rootfs, and none of them nameable without.

`com.docker.kit/` (vocabulary Kits provide) is deliberately a sibling of
`com.docker.sandbox/` (contracts the runtime answers, [§7](#7-capabilities)).

A namespace anyone defines for themselves **MUST** be reverse-DNS: two <!-- tck: SPEC-v3 §5.1/namespace-reverse-dns -->
labels or more, each one a domain could carry — alphanumeric at both
ends, hyphens inside, at most 63 characters, and 253 for the whole.
`com.example/gh` is theirs because the domain is, and that is the whole
of what makes it never match `gh`. A string no domain could be is nobody's
to own, so `com..example` does not qualify for having a dot in it. A
single label is backed by no domain,
so that flat space is this specification's to hand out rather than
first-come: reserving it is what keeps a name this specification has not
defined yet — `rpm`, say — available to define, instead of already taken
by whoever shipped first.

`deb/` and `apk/` are the single labels defined so far, both for
[§9.6](#96-derived-provides), and both **MUST NOT** be authored: an entry <!-- tck: SPEC-v3 §5.1/derived-namespaces-reserved -->
under either is evidence publishing read out of a filesystem, and an
author writing one by hand would be asserting a fact about content rather
than offering a capability. They are short on purpose — a package
ecosystem is not an organization, so `com.docker.*` would attribute
`deb/bash` to Docker rather than to the dpkg database it came out of, and
these are the names [purl](https://github.com/package-url/purl-spec)
already uses for the same ecosystems.

### 5.2 Versions

A version is `[0-9]+(\.[0-9A-Za-z-]+)*` — dotted segments, **no `v`
prefix**: a version names a point in an order, and two spellings of the
same point would make equality depend on normalization every consumer has
to remember. Comparison is per-segment: numeric segments compare
numerically, non-numeric lexically. `Satisfies` holds when names match
(after normalization) and the provided version holds **every** stated
constraint; an **unversioned provide satisfies only an unconstrained
require**, so a constraint never silently matches a capability that
declared no version.

### 5.3 Resolution semantics (consumer contract)

A conforming runtime resolving a Kit set:

- **MUST** treat the set as closed: every `requires` is satisfied by the <!-- tck: SPEC-v3 §5.3/closed-set -->
  set itself or resolution fails. Capability names resolve to nothing and
  validate against something.
- **MUST** fail when any `conflicts` name is provided by the set. <!-- tck: SPEC-v3 §5.3/conflicts-fail -->
- **MUST** fail when a **present** provider violates an `integrates` <!-- tck: SPEC-v3 §5.3/integrates-violation-fails -->
  constraint — an integration that would break is incoherence, not an
  option. An absent provider is fine.
- **MUST** order composition by the dependency graph (providers before <!-- tck: SPEC-v3 §5.3/dependency-order -->
  requirers; met `integrates` entries order like requires), never by flag
  order.
- **MUST** include exactly one `workload` Kit per composition. <!-- tck: SPEC-v3 §5.3/one-workload -->
- **MUST** fail when two Kits provide the same normalized name, at any <!-- tck: SPEC-v3 §5.3/one-provider-per-name -->
  versions. Only one provider's content is reachable after composition,
  so a second provide vouches for shadowed content; one name has one
  owner. Composing `claude` with `claude-mixin` is the canonical mistake
  this refuses — the workload already carries the agent the mixin
  installs.

---

## 6. `args`

Named values the installer supplies, referenced anywhere in the descriptor
as `${{ kit.args.<name> }}`. The `${{` opener is not valid shell, so the
vocabulary can never collide with `$VAR` or `${VAR}`, which pass through
untouched for the shell at run time.

```yaml
args:
  version:
    default: "2.98.0"
    pattern: '^[0-9]+\.[0-9]+\.[0-9]+$'
    description: Release to install
    buildArg: GH_VERSION        # resolves at BUILD; expanded into the published descriptor
  timeout:
    default: "30000"
    pattern: '^[0-9]+$'
    env: BROWSER_TIMEOUT        # resolves at CREATE; exported to the container
  team:
    required: true
    enum: [alpha, beta]
```

| Field | Type | Rules |
|---|---|---|
| *the key* | string | MUST match `^[A-Za-z_][A-Za-z0-9_]*$`. | <!-- tck: SPEC-v3 §6/arg-key-grammar -->
| `default` | string | Used when the installer supplies nothing. `default: ""` is a real default. Mutually exclusive with `required`. |
| `required` | bool | The installer MUST supply a value. | <!-- tck: SPEC-v3 §6/required-arg-supplied -->
| `description` | string | optional. Shown wherever a Kit's inputs are listed. |
| `enum` | list\<string\> | Exact accepted set. Mutually exclusive with `pattern`. |
| `pattern` | string | RE2 regexp matched against the **whole** value. Mutually exclusive with `enum`. |
| `env` | string | Opts the resolved value into the container environment under this name. Mutually exclusive with `buildArg` — an arg resolves in one phase. |
| `buildArg` | string | Resolves the arg at build: validated, handed to the recipe as `--build-arg <buildArg>=<value>`, and every `${{ kit.args.<name> }}` reference is expanded into the published descriptor. |

- **Private by default.** An arg reaches the running container only via
  `env:`, and the build only via `buildArg:`.
- **Every reference MUST be declared.** A `${{ kit.args.x }}` with no <!-- tck: SPEC-v3 §6/references-declared -->
  `args.x` is an error.
- **Two phases.** Build-phase args (`buildArg:`) are baked into the
  published descriptor before signing. Create-phase args expand at sandbox
  create, across the whole descriptor — capability configs included —
  producing the **effective descriptor**: the document enforcement, the
  lock, and the permission gate judge
  ([§7.4](#74-permission-surface-and-the-gate)). The published descriptor
  is never rewritten; the effective form is derived per installation, and
  the recorded arg values reproduce it exactly on recreate.
- **Expansion is structural.** A conforming implementation substitutes
  into the *decoded* document — every string value and every map key — and
  re-serializes. A value is therefore carried verbatim whatever it
  contains: quotes and backslashes cannot terminate or re-escape the
  scalar they land in. Substituting into serialized bytes is not
  conforming. Two keys in one mapping that expand onto the same key
  **MUST** be an error: dropping one silently would make the effective <!-- tck: SPEC-v3 §6/expanded-key-collision-rejected -->
  descriptor depend on iteration order.
- **A whole-value reference adopts its type.** When a string is nothing
  but a reference, the resolved value takes the type its spelling names,
  so a numeric arg reaches a numeric field (`container: ${{ kit.args.port
  }}`). Only a spelling that survives a round trip converts: `8080` is an
  integer and `1.5` a float, while `1.0`, `007`, and `1e5` re-render
  differently and stay strings — the shape a version or a zero-padded code
  wears. `NaN` and `±Inf` stay strings too, having no JSON spelling. A
  reference embedded in a larger string, or standing in a map key, is
  always text.
- **Parameterized entries validate twice.** At build and load, a
  capability entry whose config references an arg passes leniently — type
  grammar and arity hold, typed config checks defer. At create, after
  expansion resolves every placeholder, the effective descriptor is
  validated strictly; nothing malformed reaches enforcement. The declared
  `enum`/`pattern` constraints ride in the signed descriptor, so the
  published artifact bounds what values an installer can materialize into
  policy.
- A supplied value failing its `enum`/`pattern`, a missing `required`
  value, and a supplied name the Kit never declared are all errors.

### 6.1. Final container environment

Capability configuration string values may reference `${{ kit.env.NAME }}`.
`NAME` follows `[A-Za-z_][A-Za-z0-9_]*`; whitespace inside the braces is
optional.
This is the final **container** environment, not the host process's
`os.Environ` and not only the values declared by Kits. Image defaults are
composed first, create-argument `env` exports replace them, and explicit
runtime environment overrides win last.

Runtimes **MUST** expand these references at create, before strict <!-- tck: SPEC-v3 §6/env-expanded -->
validation, capability selection, reconciliation, and the permission
gate. It covers every configuration string value, including group members, but never map keys,
capability types, source attribution, display metadata, or argument
export names. Build inputs such as authored `contentFile` paths still
resolve at publish; file bodies are not descriptor strings and are not
expanded. The published descriptor remains unchanged. Persist the
expanded descriptor and selection for restart; recreate resolves afresh.

Environment values stay strings, including a whole-value reference such
as `${{ kit.env.HOME }}`. Missing names are errors; an explicitly empty
value is present. `$NAME`, `${NAME}`, and `~/` are literal to this pass.
Expansion neither invokes a shell nor reads host environment variables.
Inserted values are not templates: create-argument values and referenced
environment values containing Kit placeholders are refused rather than
recursively evaluated. Argument substitution cannot introduce an
environment reference, including by joining fragments or substituting
its variable name. Referenced environment values containing NUL are
errors. Missing-name and expansion errors identify the
variable or field without printing environment values.

For example, a lifecycle file can use
`path: "${{ kit.env.HOME }}/.config/tool/settings.json"`. The resolved
path still has to satisfy the capability's absolute-path rule, and two
paths that become identical still conflict. All declarations validate
after expansion, including optional entries a selector would reject.

---

## 7. `capabilities`

Everything the Kit needs but cannot supply itself: a list of **typed,
versioned capability requests**, each answered — granted, refused, or
prompted — by the host. One model for every ask: resource grants and
engine-executed behaviors alike go through this list, so a host answers the
whole ask through one mechanism or refuses the parts it does not know.

```yaml
capabilities:
  - type: com.docker.sandbox/credential@1    # REQUIRED: <namespace>/<name>@<version>
    name: GitHub access                      # optional display label
    optional: true                           # default false
    description: GitHub API access           # shown wherever the request is listed
    config:                                  # type-specific payload
      service: github
      phase: runtime
```

| Field | Type | Rules |
|---|---|---|
| `type` | string | REQUIRED. `<namespace>/<name>@<version>`: dotted lowercase namespace, hyphenated lowercase name, integer config-schema version. The version moves when the type's config schema does — capability types evolve without a descriptor schema-major bump. |
| `name` | string | optional. Human-readable display label; spaces and duplicate names are allowed. |
| `optional` | bool | The Kit degrades gracefully without it: an unknown or unprovidable optional entry is skipped and recorded; a required one fails resolution closed. |
| `config` | map | Type-specific request payload. Strictly decoded for well-known types (unknown config keys are errors); carried opaquely for unknown types. |
| `description` | string | optional. |
| `source` | object | optional diagnostic provenance: original `kit` and field `path`; not a trust input. |

A capability's `name` labels the request; `description` explains it.
Neither is an identifier. The name is separate from names inside config,
such as `credential@1`'s `apiKey.name`, which names an environment variable,
or `agent-skill@1`'s `config.name`, which chooses a skill directory name.
A runtime MAY use the label in selection UIs and derive one from the type
and instance key when the label is absent or empty.

Capability-entry names **MUST NOT** affect capability identity, arity, merge compatibility, <!-- tck: SPEC-v3 §7/name-display-only -->
permission surface, or execution behavior. Changing only a name does not
widen permissions.

Names **MUST NOT** be the sole identifier in selection <!-- tck: SPEC-v3 §7/name-not-identity -->
records or diagnostics; the source Kit and descriptor location distinguish
requests with the same label.

A stated name **MUST** be a string and survive descriptor decoding and <!-- tck: SPEC-v3 §7/name-round-trip -->
serialization. An empty string is equivalent to an omitted label.

### 7.1 Arity

**Policy-shaped types are singletons** — at most one entry each per
declaration block (ordinary top-level entries or one group), and in the
effective merged descriptor:
`network-policy@1`, `network-policy@2`, `resources@1`, `privileged@1`,
`kit-registry@1`, `agent-sessions@1`, `lifecycle@1`, `agent-context@1`,
`sbx@1`, `long-running@1`, `git-identity@1`.

The two `network-policy` versions are additionally **exclusive of each
other**: a descriptor states one of them, never both. They describe the
same grant, so a host given both would have to guess which bounds the
other.

**Instance-shaped types appear once per thing requested**, deduplicated on
their own key: `credential@1` on (service, phase), with each listed phase
participating independently, `volume@1` and `host-mount@1` on a shared
cleaned storage path key,
`agent-skills@1` on path,
`agent-skill@1` on effective name, `port@1` on (container, transport),
`ssh-agent@1` on each phase it names.
`usb-device@1` is instance-shaped with no dedup key beyond the exact
entry.

Exact-duplicate entries of any type are rejected.

### 7.1.1 Capability groups

A `capabilities` item is an ordinary request or a `group` containing
ordinary requests. Groups couple one feature's requests without adding
a capability type. Names and descriptions remain display metadata.

```yaml
capabilities:
  - group:
      name: Shared skills
      optional: true
      capabilities:
        - type: com.docker.sandbox/agent-skills@1
          config: {path: /home/agent/.local/skills}
        - type: com.docker.sandbox/lifecycle@1
          config:
            startup:
              - command: [sh, -c, 'echo skills available']
```

The grammar MUST reject mixed ordinary/group items, empty or nested <!-- tck: SPEC-v3 §7.1.1/group-grammar -->
groups, and member-level `optional`, even as false.
The group's `optional` defaults to false. Required and one-member groups
are valid. Singleton and duplicate constraints apply separately to the
ordinary top-level entries and to each group's members.

All declarations MUST validate before selection, including skipped <!-- tck: SPEC-v3 §7.1.1/validate-declarations -->
groups and every member.

All declarations MUST validate again after argument and environment expansion, <!-- tck: SPEC-v3 §7.1.1/validate-expanded-declarations -->
including members of groups that selection would skip. Cross-entry
constraints dependent on selection, including credential ownership and
injection domains, are checked on the selected contributions and merged
result. Selection does not bypass validation.

The runtime supplies a selection function over expanded ordinary
entries. The reference implementation passes the operation context and
the owning Kit's expanded descriptor, including its `displayName` and
all declarations before selection. The descriptor and capability are
passed by value. A static list of supported types is sufficient; host
policy, credential availability, and approval can further constrain the
answer.

The callback returns a decision with an acceptance flag and an optional
message. The zero value rejects the entry. Selection records retain
each member's decision in declaration order, including messages for
accepted members of a skipped group. Required-rejection diagnostics
include the rejecting member's message when supplied. Cancellation
returns no partial selection.

The selection API MUST include a group only when every member is <!-- tck: SPEC-v3 §7.1.1/atomic-selection -->
accepted. Otherwise it skips and records an optional group in full, or
refuses a required group, identifying rejected members. Ordinary entries
follow the same required/optional rule.

Members MUST NOT be applied before selection finishes. <!-- tck: SPEC-v3 §7.1.1/selection-before-application -->

The selection API MUST flatten accepted constructs at their declaration <!-- tck: SPEC-v3 §7.1.1/order -->
positions, preserving member order and existing Kit dependency order.
Only selected contributions merge; groups never merge by name. Lifecycle
hooks concatenate without deduplicating repeated commands. Conflicting
file paths or multiple interactive declarations are composition errors.

Selected composition conflicts MUST fail; optional <!-- tck: SPEC-v3 §7.1.1/conflicts -->
groups cannot be silently dropped to repair them. The effective
permission surface contains only selected, merged contributions; groups
add no grants of their own.

Conflict refusal MUST occur before any selected contribution is applied. <!-- tck: SPEC-v3 §7.1.1/conflicts-before-application -->

Publishing MUST preserve conditional boundaries, relative declaration <!-- tck: SPEC-v3 §7.1.1/publishing -->
order, referenced content, and source attribution. Publishing does not
select against build-host availability. A publisher may represent an
ordinary contribution as a one-member group with the same optionality
to preserve its position beside conditional contributions. An item's
optional `source` object records its original `kit` and field `path`;
this is diagnostic metadata, never an authority or permission input.
The consumer's actual artifact reference remains the source of trust.

Selection records and composition diagnostics MUST retain original <!-- tck: SPEC-v3 §7.1.1/provenance -->
item/member locations and source Kits; labels alone are not identities.
The resolution APIs return selected per-Kit declarations separately
from original declarations and selection records. Image assembly does
not select again or omit Kit layers. Argument environment exports are
independent of selection.

The runtime MUST retain selection and skip records for the sandbox's <!-- tck: SPEC-v3 §7.1.1/lifetime -->
lifetime, use the same selection on restart, and select afresh only on
recreation. Loss of a selected resource follows that capability's own
contract, not group reselection.

The runtime MUST NOT apply skipped files or hooks, or reinterpret a <!-- tck: SPEC-v3 §7.1.1/execution -->
selected hook's execution failure as an optional-group rejection.
Selection atomicity promises neither hook rollback nor cleanup of files
already present on reused volumes.

### 7.2 Well-known types

Each page specifies the config schema and the **normative runtime
behavior** for a runtime supporting the type:

| Type | Page | Shape |
|---|---|---|
| `com.docker.sandbox/network-policy@1` | [network-policy@1](capabilities/com.docker.sandbox/network-policy@1.md) | singleton |
| `com.docker.sandbox/network-policy@2` | [network-policy@2](capabilities/com.docker.sandbox/network-policy@2.md) | singleton, exclusive with `@1` |
| `com.docker.sandbox/credential@1` | [credential@1](capabilities/com.docker.sandbox/credential@1.md) | per (service, phase) |
| `com.docker.sandbox/ssh-agent@1` | [ssh-agent@1](capabilities/com.docker.sandbox/ssh-agent@1.md) | per phase (one entry may name both) |
| `com.docker.sandbox/volume@1` | [volume@1](capabilities/com.docker.sandbox/volume@1.md) | per path |
| `com.docker.sandbox/host-mount@1` | [host-mount@1](capabilities/com.docker.sandbox/host-mount@1.md) | per path; shared storage key with volume@1 |
| `com.docker.sandbox/port@1` | [port@1](capabilities/com.docker.sandbox/port@1.md) | per (container, transport) |
| `com.docker.sandbox/usb-device@1` | [usb-device@1](capabilities/com.docker.sandbox/usb-device@1.md) | instance |
| `com.docker.sandbox/resources@1` | [resources@1](capabilities/com.docker.sandbox/resources@1.md) | singleton |
| `com.docker.sandbox/privileged@1` | [privileged@1](capabilities/com.docker.sandbox/privileged@1.md) | singleton, config-less |
| `com.docker.sandbox/long-running@1` | [long-running@1](capabilities/com.docker.sandbox/long-running@1.md) | singleton, config-less |
| `com.docker.sandbox/lifecycle@1` | [lifecycle@1](capabilities/com.docker.sandbox/lifecycle@1.md) | singleton |
| `com.docker.sandbox/agent-context@1` | [agent-context@1](capabilities/com.docker.sandbox/agent-context@1.md) | singleton |
| `com.docker.sandbox/agent-sessions@1` | [agent-sessions@1](capabilities/com.docker.sandbox/agent-sessions@1.md) | singleton |
| `com.docker.sandbox/agent-skills@1` | [agent-skills@1](capabilities/com.docker.sandbox/agent-skills@1.md) | per path |
| `com.docker.sandbox/agent-skill@1` | [agent-skill@1](capabilities/com.docker.sandbox/agent-skill@1.md) | per effective name |
| `com.docker.sandbox/git-identity@1` | [git-identity@1](capabilities/com.docker.sandbox/git-identity@1.md) | singleton, config-less |
| `com.docker.sandbox/kit-registry@1` | [kit-registry@1](capabilities/com.docker.sandbox/kit-registry@1.md) | singleton, config-less |
| `com.docker.sandbox/sbx@1` | [sbx@1](capabilities/com.docker.sandbox/sbx@1.md) | singleton, config-less |

### 7.3 Unknown types

An unknown type is the extension point working as designed. The spec
library validates only the type-name grammar and arity; the config rides
opaquely. At resolution, a host that does not recognize a **required**
type MUST refuse the Kit by that type's name; <!-- tck: SPEC-v3 §7.3/unknown-required-refused --> an **optional** unknown type
MUST be skipped and recorded. <!-- tck: SPEC-v3 §7.3/unknown-optional-skipped --> A host-specific capability's author publishes
its contract under their own namespace, following the structure of the
pages above.

### 7.4 Permission surface and the gate

A descriptor projects onto a **permission surface**: the normalized
(sorted, deduplicated) set of everything the host must grant — phased
network allow/deny lists, credentials by phase, what the SSH agent may
sign by phase, storage paths, skills
paths, ports, USB matches, privileged, plus one `type+config-digest` entry
for every other request. The projection input is the **effective descriptor** — published
declarations with this installation's create-phase arg values expanded
([§6](#6-args)) — so the surface describes the policy actually enforced,
and an arg value that widens policy gates like any widening. Consumers
that gate updates store a Kit's surface in the lock and diff a
candidate's against it:

- Version movement whose surface stays within the granted one **MAY** apply
  silently.
- Any **widening** — a new allow entry, a **removed deny entry** (the deny
  was part of what made the grant acceptable), a new credential, a wider
  SSH agent grant, path,
  port, USB match, privileged, write access over a skills path already
  granted read, or any config change on an other-typed request — **MUST** <!-- tck: SPEC-v3 §7.4/widenings-gate -->
  stop for approval.
- `optional` does not change the surface: it changes what happens when the
  host cannot provide, not what is granted when it can.
- `resources@1`, `lifecycle@1`, `agent-context@1`, `agent-sessions@1`, and
  `sbx@1` contribute nothing to the surface: resource limits constrain the
  Kit rather than grant it anything, the next three run inside the sandbox
  on the entrypoint's trust plane, and `sbx@1` asks the host to launch the
  workload a particular way and to read an identity the image already
  states (see their pages). `long-running@1` likewise grants no access;
  it keeps the workload running independently of attached sessions.
- `git-identity@1` contributes its type to the service surface: it
  discloses runtime-provided name/email values, unlike the image-defined
  process identity honored by `sbx@1`.

---

## 8. Launch modes

The image config carries the runtime contract (entrypoint, cmd, env, user,
workdir) — the descriptor duplicates none of it. The one piece the image
config has no native slot for is the **interactive argument tail**, which
lives in the [lifecycle@1](capabilities/com.docker.sandbox/lifecycle@1.md)
capability's `interactive` field. The effective argv per mode:

| Mode | Argv |
|---|---|
| Default (headless / task) | image `Entrypoint` + image `Cmd` |
| Interactive (TTY) | image `Entrypoint` + lifecycle `interactive` |

With no `interactive` declared, both modes run the image config as-is. See
[agent-sessions@1](capabilities/com.docker.sandbox/agent-sessions@1.md) for
the headless prompt/resume verbs, which append after the launch argv the
same way user-supplied args do.

---

## 9. Publishing

### 9.1 Expansion

The frontend validates the authored descriptor, resolves build-phase args,
and expands every `${{ kit.args.<name> }}` reference to a build-phase arg
into the **published descriptor**. Create-phase references (in lifecycle
hooks and file contents) legitimately remain. The published descriptor is
what signatures cover, what the resolver and the gate judge, and what the
lock records — one caller's substitution never rewrites it.

### 9.2 Versioned provides

At publish, every `provides` entry **MUST** carry a version — its own <!-- tck: SPEC-v3 §9.2/versioned-provides -->
`@version` or the descriptor's `version:` fallback. A published Kit with an
unversioned provide would satisfy only unconstrained requires and silently
defeat version-constraint resolution. Kits with no provides publish fine.

### 9.3 Annotations

The frontend sets four manifest annotations, and promotes all four onto
the image index whenever the export produces one (multi-platform builds,
single-platform builds with attestation manifests):

| Annotation | Value |
|---|---|
| `vnd.docker.sandbox.kit.descriptor` | The published descriptor as **compact JSON** — `json.Marshal` of the decoded, expanded document. Authoring is YAML; the published form is a derived artifact, and JSON matches the manifest it rides in and is byte-deterministic. Consumers decode with a YAML parser (YAML accepts JSON), so YAML-valued annotations from Kits published before the switch keep decoding. |
| `vnd.docker.sandbox.kit.schema-version` | The descriptor's `schemaVersion`, so tooling dispatches on the grammar version without parsing the descriptor. Always equal to the field inside. |
| `vnd.docker.sandbox.kit.capabilities` | The requested capability types — deduplicated, sorted, comma-joined. An **index, never a second source**: existence checks and policy filters read one small canonical value; the descriptor stays authoritative. Omitted when the Kit requests nothing, so absence means "none requested". Commas cannot appear in a type string, so splitting is unambiguous. |
| `vnd.docker.sandbox.kit.built-by` | Which frontend build published the Kit, as compact JSON: `{"name":"docker/sandbox-kit","version":"3.0.0","revision":"<commit>"}`. `version` is `dev` for a frontend no release stamped, and `revision` is omitted where the build recorded none. Absent on Kits published before this annotation existed, so readers tolerate it missing. |

The frontend also derives the standard `org.opencontainers.image.*`
annotations from the descriptor, so registry tooling that knows nothing
about Kits displays a Kit's metadata: `title` ← `displayName`,
`description` ← `description`, `authors` ← `author`, `source` ←
`sourceUrl`, `licenses` ← the comma-joined `licenses` list, and `version`
← `version:` or the one version every versioned `provides` entry agrees
on (disagreement emits nothing — an ambiguous version is worse than
none). Empty fields emit no key. `revision` and `base.*` are deliberately
not emitted: VCS and base-image state are the builder's knowledge (buildx
provenance already records them), not the descriptor's. These carry the
descriptor fields' authority — self-asserted display metadata, never
trust inputs.

The frontend **MUST NOT** emit `org.opencontainers.image.created` from <!-- tck: SPEC-v3 §9.3/created-not-wall-clock -->
the wall clock: that would break build reproducibility. A builder **MAY**
emit it when derived from `SOURCE_DATE_EPOCH`, a timestamp fixed by the
source, so the same build inputs keep the same bytes. The descriptor
does not supply this value. An artifact alone cannot show where a
timestamp came from; conformance checks judge its format, not its origin.

When present, `org.opencontainers.image.created` **MUST** be an RFC 3339 <!-- tck: SPEC-v3 §9.3/created-rfc3339 -->
timestamp, as required by the OCI annotation definition.

`built-by` records the tool that produced the artifact, not the source
the artifact was produced from:
`revision` would name the Kit author's tree, which the frontend cannot
see and provenance already records, whereas `built-by` names the frontend
itself, which nothing else in the artifact does. It is deterministic —
the same frontend build gives the same annotation bytes. Like a
`created` value derived from `SOURCE_DATE_EPOCH`, it introduces no
wall-clock variation across rebuilds. And it is self-asserted
like every other annotation here: it answers "what claims to have built
this", never "what is this allowed to do". A consumer deciding whether to
trust a build reads provenance, which is signed; this value is a label.

Index annotations are an optimization, not the contract: a multi-node
builder merges per-node results into a fresh index client-side, dissolving
the per-node annotations. Consumers **MUST** fall back to a platform <!-- tck: SPEC-v3 §9.3/manifest-fallback -->
manifest when index annotations are absent.

### 9.4 Size budget

The descriptor rides in the manifest, and manifests meet practical
registry ceilings (~4 MB). The grammar exiles bulk by construction —
guidance bodies stage into layers, content lives in layers — and the
frontend enforces a budget: a warning above 64 KiB, an error above
512 KiB.

### 9.5 Merging a set

Publishing a `kind: set` descriptor ([§3.4](#34-kit-set)) resolves the
Kits it lists and merges them into one ordinary kit. Their roles — and
the fact that there were several — survive only as the pinned `kits:`
record in the published descriptor.

**Resolution.** Every listed Kit is resolved to a manifest digest and
its published descriptor read. The set is then judged by
[§5.3](#53-resolution-semantics-consumer-contract), with a workload
among them optional; failure is a build failure, so an incoherent set
cannot be published. Each one's create-phase args are resolved from its
`args:` map and expanded into its declarations. A literal value is
resolved away; a value that is itself one `${{ kit.args.* }}` reference
re-exports the input under the set's own name, and that reference
survives into the merged descriptor for the set's declaration to bound
and create to resolve. The Kit's own declaration is answered and gone,
so the set's is the only one an installer can read.

A re-exported arg's declaration on the set **MUST** say at least what the Kit's said: required where the Kit required it, defaulted where the Kit defaulted it, its `enum` restated or narrowed, its `pattern` restated. <!-- tck: SPEC-v3 §9.5/re-export-restates-contract -->

Without that, an installer supplying nothing to an optional re-export
of a required arg leaves the reference unresolved, and a value the Kit
would have refused reaches it with nothing left to refuse it. A
reference can only survive where the config field holds text, so a set
pins rather than re-exports an arg its Kit reads as a number.

**Derived kind.** `workload` when one of them is a workload, `mixin`
when they all are mixins. Two workloads is an error.

**Content.** Their layers are merged in composition order, later over
earlier.
Merging **MUST** preserve those Kits' own layers rather than repacking <!-- tck: SPEC-v3 §9.5/layers-preserved -->
their content, so the merged Kit's blobs stay shared with the Kits it was
built from.

Two Kits contributing the same file resolve by that order, rather than
failing the way the same two would when a runtime composes them at
create. The rule is not relaxed, only unenforceable where the merge
happens: deciding it needs every Kit's layer inventory, and a build
frontend reaches neither the layer blobs nor a filesystem listing
cheaper than one round trip per directory. A merged set is therefore
judged for collisions where its layers can be read — from the published
artifact.

**Declarations.** Every contribution — the listed Kits and the set's
own declarations alike — is ordered by the same dependency graph
[§5.3](#53-resolution-semantics-consumer-contract) derives, providers
before the Kits that require or integrate with them. The set's own
declarations come last among equals, being the statement made with the
whole composition in view; a Kit that integrates with something the set
provides puts the set ahead of it, and a circle between them is an
error. In that order they reconcile into one descriptor:

| Declaration | Rule |
|---|---|
| `provides` | Union. They are facts about content that travelled in. |
| `requires`, `integrates` | Union **minus** entries the set satisfies itself — a Kit cannot satisfy its own requirement ([§5.3](#53-resolution-semantics-consumer-contract)), so a retained one could never resolve. | <!-- tck: SPEC-v3 §9.5/internal-requires-dropped -->
| `conflicts` | Union. |
| `licenses` | Union. The artifact ships every one of their layers, so a narrower list would misreport it — and §9.3 derives an annotation from it. | <!-- tck: SPEC-v3 §9.5/licenses-union -->
| `args` | The set's own. The listed Kits' are answered at publish, pinned or re-exported. |
| Display fields | The set's own: the artifact is a new thing with its own name, publisher, and documentation. |
| Instance-shaped capabilities | Union, deduplicated on the type's own key ([§7.1](#71-arity)). Two different configs under one key is an error. |
| `network-policy` | Allow and deny union per phase. The output states one version: `@2` when any of them uses it, with `@1` hosts joining as the unbounded entries they already are. An allow entry bounded to methods or paths is dropped when another entry grants its host outright — the union of the two grants *is* the unbounded one. |
| `lifecycle@1` | Install hooks, startup hooks, and files concatenate in composition order. Two of them writing one file path is an error; so is two declaring `interactive`, which replaces the launch argv rather than adding to it. |
| `resources@1`, `agent-sessions@1` | At most one of them may declare each; an identical restatement is the same ask, anything else is an error. They describe the whole sandbox, not a grant to it. |
| `agent-context@1` | An explicit profile (`directory` plus `filename`) takes precedence over a legacy workload filename; differing explicit profiles conflict. Without one, at most one contribution owns the legacy filename. The bodies concatenate into one staged file, since the type is a singleton and a sandbox surfaces one profile. |
| Config-less and unknown types | Presence is the union; unknown types deduplicate on type plus config, as the permission surface does. |
| `optional` | An entry any of them requires is required in the merged kit: `optional` says its asker degrades without it, and one that does not degrade decides for the set. |
| Capability `name` | When contributions merge into one entry, the first nonempty name in contribution order **MUST** be retained. Labels do not prevent merging. | <!-- tck: SPEC-v3 §9.5/capability-name-first -->

A merged descriptor **MUST** be identical across every platform a <!-- tck: SPEC-v3 §9.5/declarations-platform-independent -->
multi-platform set builds for: the annotation is written once per
platform manifest, and a descriptor describes the Kit rather than one of
its platforms.

### 9.6 Derived provides

A `version:` fallback answers for names an author chose. It cannot answer
for the software a Kit inherited: a base image ships hundreds of packages
at versions its author never saw, and `provides: [bash]` under
`version: "1.0.0"` publishes `bash@1.0.0` — a statement about the Kit's
release number wearing the name of a shell. What `bash` is at is a fact,
and the filesystem already records it.

So publishing reads the package databases out of the content and states
one entry per installed package:

| Namespace | Database |
|---|---|
| `deb/` | `/var/lib/dpkg/status` |
| `apk/` | `/lib/apk/db/installed` |

- Derivation applies to `kind: workload` only. A workload's layers are a <!-- tck: SPEC-v3 §9.6/workload-only -->
  root filesystem, so its database is an inventory; a mixin's are a
  delta, where a database is whatever its recipe happened to rewrite.
  This is also what keeps [§5.3](#53-resolution-semantics-consumer-contract)'s
  one-provider rule satisfiable — a composition has exactly one workload,
  so a derived name has exactly one owner by construction.
- Only packages a database records as **installed**. dpkg keeps a stanza <!-- tck: SPEC-v3 §9.6/installed-only -->
  for a package whose files are gone, and publishing software a Kit no
  longer carries is the opposite of reading the filesystem for the truth.
- The version is the leading dotted-numeric core of what the database <!-- tck: SPEC-v3 §9.6/version-is-upstream-core -->
  records, at most three parts, and **MUST NOT** carry what the
  distribution wrapped around it: an epoch, a Debian revision, a binNMU,
  a backport suffix, an apk release. `1:2.5.2-3+dhi1` publishes as
  `2.5.2`. Those are packaging bookkeeping rather than points in the
  upstream order, and a consumer writing `deb/openssl >= 3.5` cannot be
  asked to know about them. Fewer than three parts is published as it
  stands and never padded — `binutils` really is `2.44`.
- A tilde in the **upstream** half is the exception, and such a package <!-- tck: SPEC-v3 §9.6/prerelease-dropped -->
  is dropped rather than published. dpkg sorts a tilde before everything,
  end of string included, so `1.69~deb13u1` is older than `1.69` and
  `2.0~rc1` is the candidate rather than the release: truncating there
  would state a version the content has not reached, and
  `deb/pkg >= 2.0` would be satisfied by something below it. Carrying it
  is no better, since [§5.2](#52-versions) compares a non-numeric segment
  lexically and would order `2.0-rc1` *above* `2.0`. The point is not
  expressible here, so nothing is stated. A tilde in the Debian revision
  is the ordinary rebuild marker and strips like the rest —
  `9.20.26-1~deb13u1` really is `9.20.26`.
- An entry is stated only where every platform the Kit publishes agrees <!-- tck: SPEC-v3 §9.6/agreed-across-platforms -->
  on the package and its version. One descriptor serves them all
  ([§9.5](#95-merging-a-set)), so it may state only what holds for all of
  them; an architecture-specific package is ordinary rather than an
  error, and is dropped. A package whose name is not a capability name,
  or whose record yields no version, is dropped for the same reason —
  never published under the `version:` fallback, which is the thing this
  section exists to stop.
- A set does not re-derive. Its merged descriptor carries its Kits'
  entries through the `provides` union, and the workload among them
  already read its own filesystem.

Derived entries do not vote on
`org.opencontainers.image.version` ([§9.3](#93-annotations)): a Debian
archive never agrees on one version, and counting it would leave every
Kit that named no `version:` with no version annotation at all.

---

## 10. The OCI layout

One shape for every Kit — an ordinary OCI image:

```text
manifest  oci.image.manifest.v1+json
  annotations:
    vnd.docker.sandbox.kit.descriptor:     <published descriptor, compact JSON>
    vnd.docker.sandbox.kit.schema-version: "3"
    vnd.docker.sandbox.kit.capabilities:   <requested types, comma-joined>
  config   oci.image.config.v1+json     entrypoint, cmd, env, user, workdir
  layers   1..n                         rootfs (workload) / overlay (mixin)
                                        + the staged kit sources
```

- **Every Kit stages its sources**: the published descriptor at
  `/usr/share/sandbox/kit/<stem>/kit.yaml` and, when the Kit has a content
  recipe, its Dockerfile text at `…/kit.dockerfile`. A published Kit is
  self-describing — inside any sandbox that composes it, the declarations
  and the recipe are readable in place — and every manifest carries at
  least one layer, which the OCI image-manifest schema requires
  (`layers` has `minItems: 1`).
- A **workload** carries a full root filesystem and real launch config; it
  runs under a bare `docker run`, minus everything the descriptor declares
  (no confinement, no credentials, no hooks). Degradation, never breakage.
- A **mixin** carries its overlay delta as layers, and its image config
  records only what its recipe explicitly stated over its base — ENV (PATH
  reduced to the elements the recipe added), LABEL, EXPOSE, VOLUME, and,
  when set, ENTRYPOINT/CMD/USER/WORKDIR — never the base image's config.
  At assembly the additive fields (env, labels, ports, volumes) merge into
  the composed image, PATH by appending elements; the contract fields are
  ignored — they exist so a standalone `docker run` of the mixin behaves
  as authored. `requires` states what the mixin can sit on, because
  nothing else can check.
- A mixin's **directory entries replace the base's** at the paths they
  name, owner included, so the home levels §12 lays out are the overlay's
  to keep. A mixin **MUST NOT** ship `/home` owned by anyone but root, or `/home/agent` by anyone but uid `1000`. <!-- tck: SPEC-v3 §10/overlay-home-ownership -->
  Either inversion takes the home from the user who needs it — `/home`
  handed to the agent, or `$HOME` taken from it — whatever the base had.
  A mixin that ships neither leaves the base's in place.
- A mixin **SHOULD NOT** ship a symlink its own layers do not resolve. <!-- tck: SPEC-v3 §10/overlay-links-resolve -->
  The base it lands on is unknown, so a link into it resolves only where
  a base happens to supply the target — and a link whose target existed
  only in the stage that built the overlay resolves nowhere.
- A **merged set** is an ordinary workload or mixin: its layers are its
  listed Kits' layers, and the `kits:` record in its descriptor names
  those Kits with their digests, one manifest GET away.
  A merged Kit **MUST** carry the staged sources of every Kit it lists, <!-- tck: SPEC-v3 §10/merged-set-carries-sources -->
  beside its own, so that `ls /usr/share/sandbox/kit/` inside it
  enumerates what it was built from. The record says what was merged;
  these are the declarations that came with it, and a consumer that
  cannot read them has only the set author's word for what the artifact
  contains.
- A **content-free mixin** is the staged descriptor alone: one layer. The
  OCI **empty descriptor** is deliberately not used for this case — it is
  the artifact pattern, and an empty-JSON blob under an image-config
  manifest is not a filesystem layer and breaks the ordinary
  pullable-image property Kits are built on.

Consumers recognize a v3 Kit by: a plain image manifest (no artifactType,
image-config media type) carrying the descriptor annotation. Preflight is
one manifest GET — the descriptor comes from the annotation, the runtime
contract from the config blob; layers are never fetched until the runtime
pulls the image itself.

What runs is never a published artifact: at create, a resolver produces a
locked set and an assembler emits an ordinary image — config synthesized
from the merged declarations, layers concatenated in dependency order —
identified by the lock, which is what makes recreate exact. Local handles,
state keying, and lock formats are runtime concerns outside this
specification; the descriptor carries no top-level identity name on purpose.

---

## 11. Validation summary

The spec library enforces, beyond per-field rules stated above:

- **Top level**: `kind` is `workload`, `mixin`, or `set`; `version` is
  version-shaped (or a build-phase arg reference in the authored form);
  `build:`, `dockerfile:`, and `kits:` mutually exclusive;
  `dockerfile:` relative and non-escaping.
- **Kits**: a `kind: set` descriptor lists at least one; every entry
  names a published Kit by a registry reference (no path, no git URL),
  with a well-formed `sha256:` digest when pinned; no two entries name
  one kit.
- **provides/requires/integrates/conflicts**: entries parse under the
  grammar of [§5](#5-provides-requires-integrates-conflicts); arg
  references only in `provides` (and `version`).
- **capabilities**: type matches
  `^[a-z0-9]([a-z0-9.-]*[a-z0-9])?/[a-z0-9]([a-z0-9-]*[a-z0-9])?@[1-9][0-9]*$`;
  singleton and dedup arity per [§7.1](#71-arity); config-less types
  (`privileged@1`, `kit-registry@1`, `sbx@1`, `long-running@1`,
  `git-identity@1`) reject any
  config; well-known configs decode strictly (unknown keys are errors)
  and pass their per-type rules
  (see the capability pages); **cross-entry**: every credential inject
  domain appears in the matching phase of the network policy's allow list
  (a bare `*`/`**` allow entry covers every domain). Entries whose config
  references a Kit arg defer their typed and cross-entry checks to the
  **effective form** ([§6](#6-args)), where every placeholder is resolved.
- **args**: name and env/buildArg charsets; `default`/`required`,
  `enum`/`pattern`, and `env`/`buildArg` mutually exclusive; `pattern`
  compiles.
- **raw form**: size budget ([§9.4](#94-size-budget)); every
  `${{ kit.args.* }}` reference names a declared arg.
- **published form**: no build-phase references remain; provides are
  literal and ([§9.2](#92-versioned-provides)) versioned; `kind` is the
  derived `workload` or `mixin`, never `set`; every listed Kit carries
  a digest.

Validation collects independent failures in a `ValidationErrors`
collection, preserving warnings alongside errors. A failed config decode
skips that entry's value checks while other entries are still judged;
strict descriptor decoding remains a separate gate.

Errors carry the offending element's dotted path. `WithSource` adds the
filename, line, and column computed against the authored bytes, followed
by the source line and a caret at the offending value. Multiple errors
are separated by a blank line. A missing field points at its nearest
containing element. Callers that render source themselves, such as the
BuildKit frontend, attach source positions to the plain errors instead
of using `WithSource`, so each error has one source renderer. The error
collection preserves validation order, sorting map keys so repeated runs
produce the same diagnostics. Registry fetches, create-phase expansion,
and conformance findings use the excerpt formatter, labeling registry
content by its Kit reference or descriptor annotation rather than a local
filename.

Runtimes revalidate published descriptors on load (`ValidatePublished`), so
a hand-crafted annotation that never went through the frontend cannot
smuggle a malformed declaration past a conforming consumer.

---

## 12. Runtime environment

Kit content (recipes, lifecycle hooks, staged files) MAY assume the
platform floor of a conforming runtime: `bash` and `sh`, `curl`, `git`, a
populated CA store, and a non-root default user named `agent`, uid `1000`,
home `/home/agent`. Everything else a Kit needs, it installs or ships.

Phase-scoped enforcement is the load-bearing runtime behavior: the
**install phase** (once, at sandbox create, while
[lifecycle@1](capabilities/com.docker.sandbox/lifecycle@1.md) install hooks
run) and the **runtime phase** (the agent's steady state) carry separately
declared [network egress](capabilities/com.docker.sandbox/network-policy@1.md)
and [credentials](capabilities/com.docker.sandbox/credential@1.md), and a
conforming runtime closes the install grants before the agent starts. The
per-capability pages state each obligation precisely.
