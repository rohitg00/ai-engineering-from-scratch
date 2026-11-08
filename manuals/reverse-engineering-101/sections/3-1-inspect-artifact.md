# inspect-artifact

> inspect-artifact reads the file as a container, hashes it, names its format, and returns one Evidence record that tells you which tool to run next.

You built `ledger-arm64-O1` from `ledger.c` and `ledger-main.c` with clang. An agent is about to analyze it, and you want the first call to be cheap, offline, and honest about what it did not do. `inspect-artifact` is that call. It needs no Ghidra, it returns in about a second, and its record ends with the name of the next tool.

When you finish this section, you can run `inspect-artifact` on a file you built and read its manifest and its one occurrence. You can also say why the record names `open_binary` as the next probe.

## One command, one record

```listing
title: the command and its exit
source: capture/out/00-commands.txt
lang: text
note: Two lines from the command index. The time in parentheses changes on every run and is cut.
---
$ rea inspect-artifact fixtures/ledger-arm64-O1 --format json
[exit 0] (…) -> 03-inspect-artifact.json
```

The record comes from the provider `rea-artifact-graph`, named "REA safe artifact graph provider", version 1. No analysis engine runs. The tool opens the file, hashes it, names the format from the header, and builds an inventory of the file as a container.

**Artifact graph:** the inventory rea builds of one file and the files inside it. A node is one distinct content, identified by its SHA-256. An occurrence is one place where that content appears, with a logical path. An edge joins a container to a member.

```listing
title: the head of the record
source: capture/out/03-inspect-artifact.json
lang: json
note: The substeps array and everything after it are cut. The capture kit masks local_path.
---
{
  "evidence_id": "ev_0e878985…",
  "subject": {
    "name": "ledger-arm64-O1",
    "digest": {
      "sha256": "01b5d08b…"
    },
    "local_path": "$CAPTURE/fixtures/ledger-arm64-O1",
    "format": "mach-o",
    "architecture": null
  },
  "provider": {
    "id": "rea-artifact-graph",
    "name": "REA safe artifact graph provider",
    "version": "1"
  },
  …
  "operation": "inspect_artifact",
  "parameters": {
    "integrity_policy": "fail"
  },
  …
}
```

The SHA-256 is the one `00-fixtures.txt` lists for the file, and every later record about this file carries the same digest. The `format` is `mach-o`, read from the magic bytes. The `architecture` is `null`. This provider does not read `cputype`, and [the next section](#s-inspect-binary-layout-and-the-load-image) shows the tool that does. The one parameter is `integrity_policy`, set to `fail`.

## The manifest and the occurrence

The record has one substep, `inventory_artifact`, with `status: "completed"` and its own Evidence record nested inside. Its manifest counts the graph.

```listing
title: the manifest, the node, and the occurrence
source: capture/out/03-inspect-artifact.json
lang: json
note: Cut from the inventory substep to the manifest counts, the one node, and the one occurrence.
---
"manifest": {
  "manifest_id": "agm_8e2e5c4c…",
  …
  "graph_sha256": "b6c8ab6f…",
  "node_count": 1,
  "occurrence_count": 1,
  "edge_count": 0
},
"nodes": [
  {
    "artifact_id": "art_8906b5a7…",
    "format": "mach-o",
    "sha256": "01b5d08b…",
    "size": 33872,
    …
    "content_state": "materialized",
    "limitations": []
  }
],
"occurrences": [
  {
    "occurrence_id": "occ_35a9bb48…",
    …
    "logical_path": ".",
    "entry_kind": "file",
    "artifact_kind": "executable",
    "artifact_format": "mach-o",
    "declared_size": 33872,
    …
    "executable": true,
    "encrypted": false,
    "hash_status": "verified",
    …
  }
],
```

One node, one occurrence, no edges. The executable is its own container and has no members. The limitation "Artifact has no child container entries." says the same in words. The node reports `size: 33872`, the byte count in `00-fixtures.txt`, and `content_state: "materialized"`. The occurrence has `logical_path: "."`, the root, and `artifact_kind: "executable"`. For an `.asar` or a `.zip`, this is where every member file would appear with its own node and path.

## Branches and the next probe

```listing
title: what the inspection did not do
source: capture/out/03-inspect-artifact.json
lang: json
note: The hypotheses and contradictions arrays are empty and are cut with the coverage block.
---
"unexplored_branches": [
  {
    "branch_id": "aib_ff20889e…",
    "reason": "format-specific-analysis-required",
    "detail": "open_binary was not run by provider-neutral artifact inspection.",
    "next_probe": {
      "operation": "open_binary",
      "rationale": "Bind one deep native provider before function-level analysis.",
      "authority": "native-analysis-provider"
    },
    …
  }
],
…
"confidence": "observed",
"authority": "shipped-artifact",
"environment": null,
"limitations": [
  "Artifact has no child container entries.",
  "Inspection derives bounded static hypotheses and next probes; it does not execute the artifact or claim format-specific semantics."
],
```

rea builds one unexplored branch for every next probe it lists, with the reason `format-specific-analysis-required`. The second limitation is a constant in the same file. The record is `observed` with authority `shipped-artifact`: rea read the bytes of the file you gave it and derived nothing from another record. The `coverage` block reports `complete-within-substeps` with one substep, one observation, one branch, one probe, and nothing omitted.

```figure
id: fig-3-1
kind: tree
title: the inspect-artifact record for ledger-arm64-O1
claim: One cheap read gives a hashed subject, a one-node inventory, and an explicit branch that names open_binary as the next probe.
caption: Read from the top. The teal box is the record, the green boxes are what it saw, and the amber box is what it left for a later tool. From capture/out/03-inspect-artifact.json.
```

## What the record is not

The record is not a format parse. It holds no load commands, no sections, no symbols, and no entry point. For those, [the next section](#s-inspect-binary-layout-and-the-load-image) runs `inspect-macho`. For a function, [Part 4](#s-open-binary-and-the-headless-bridge) binds Ghidra with `open_binary`, the tool the branch names. The whole record is 198 lines, and most of them repeat the subject digest. That repetition is the point: every nested record can stand alone and still name the same bytes.

```takeaways
- Run `inspect-artifact` first: it needs no engine and returns in about a second.
- Read `node_count`, `occurrence_count`, and `edge_count` before you treat a container as flat.
- Treat `unexplored_branches` as the list of tools the record did not run.
- Carry the subject `sha256` into every later record about the same file.
```

Sources: capture/out/00-commands.txt, capture/out/00-fixtures.txt, capture/out/03-inspect-artifact.json; rea 6.7.0 at 27dc42d: src/application/InvestigationProviders.ts, src/domain/artifactInspection.ts, src/artifacts/inventory/reader.ts
