# Evidence, Confidence, and Unknowns in Binary Analysis

> A finding about a compiled program is a record with a hash, a confidence, an authority, and a list of what it cannot show.

**Type:** Build
**Languages:** Python, C
**Prerequisites:** Phase 13 · 32 (ELF from scratch), Phase 13 · 33 (disassembly and control flow), Phase 13 · 34 (lifting to pseudocode)
**Time:** ~105 minutes

## Learning Objectives

- Build an evidence record modelled on rea's `Evidence` with observed, derived, and inferred confidence.
- Compute content-hash ids that stay the same when the file moves to another folder.
- Record what each provider cannot show as limitations that travel with the record.
- Refuse to state a result until an observed run of the function supports it.
- Keep residual unknowns as revisioned records joined by a hash chain.
- Cache provider answers under an exact key and refuse a stale replay.

## The Problem

You ask an agent what `grade` in `ledger-x86_64-O1.o` returns for a score of 55. The agent calls rea, reads the Ghidra pseudocode, and answers 0. A reviewer asks how the agent knows. The agent has a block of text that Ghidra printed. For the default path, that text reads `uVar1 = -(param_1 >> 0x1f) ^ (uint)((ulong)((long)param_1 * 0x66666667) >> 0x3f);`. The bytes at that point say `xor eax, eax`.

The expression and the instruction both produce 0 for every input. The agent did not know that. It trusted the text because a tool produced it. A 2026 study ran three agents on 24 reverse engineering tasks ([NDSS BAR 2026](https://www.ndss-symposium.org/wp-content/uploads/bar2026-58.pdf)). It named four recurring weaknesses: training bias, over-trust in observations, context limits, and plan persistence. Another 2026 study planted text inside binaries and found that models proposed the planted unsafe action in 35 of 40 cases ([arXiv 2607.12507](https://arxiv.org/abs/2607.12507)).

rea 6.5.0 gives the agent a vocabulary for this. Every successful tool call produces one `Evidence` record with a `confidence` of `observed`, `derived`, or `inferred`, an `authority`, and a list of `limitations`. The packaged skill tells the agent: "Every conclusion must distinguish observations, inferences, and unknowns. Cite Evidence IDs, preserve limitations and incomplete coverage, and never imply that static analysis observed execution.".

Three things rea leaves to you. Its snapshots cache exact query results, not analysis. Its verification passes a claim when a comparison dimension is unchanged, and its own comment says that a pass "does not establish global implementation equivalence.". Its obligation ledger takes candidates only from JavaScript and managed graphs, so a native function never reaches `verified` through it.

This lesson builds the missing piece in plain Python. You write a ledger that stores every fact about the fixture as a record with a content hash. You make predictions about `percent_change` and `grade`, mark them inferred, and check them against runs of a test program you compile yourself. You import two real rea records and the snapshot they came from, and your ledger recomputes every hash rea wrote.

```figure
re-evidence-ledger
```

## Three Words for Confidence, Five for Authority

`confidence` is an enum with three values, never a number. `authority` has five values. When a producer says nothing, rea uses `shipped-artifact` with `observed`.

| Value | Meaning on the fixture | Records in this lesson |
|---|---|---|
| `observed` | A fact read from bytes or from a run | the ELF reader's section and symbol reads, the two Ghidra records, 17 host runs |
| `derived` | A fact computed from observed records | the switch table model, the division model, every unknown mutation |
| `inferred` | An expectation that no observation states yet | 18 predictions |
| `shipped-artifact` | The file on disk was the source | every read of `ledger-x86_64-O1.o` |
| `controlled-replay` | A run you controlled produced the fact | the host runs of `harness.c` |
| `analyst-inference` | Your own judgement | predictions and unknown mutations |
| `historical-reference` | An older source tree or document | none here |
| `external-service` | A service outside the file and the host | none here |

Two confusions cost the most time. The first treats pseudocode as an observation of behaviour. It is an observation of what Ghidra printed. The second treats an empty list as proof of absence. rea's design note is strict: "Missing coverage is unknown, not absence.". The ledger in `code/main.py` encodes both rules.

## The Record

A record has exactly sixteen fields, and rea 6.5.0 rejects any other field. `code/main.py` keeps the same names as rea, so a record from either side validates on the other. The sixteenth field, `relationship_coverage`, says how complete a list of callers or callees is. Its value is `complete`, `partial`, or `unknown`, or `null` when the operation reports no call relationships.

| Field | What it holds |
| --- | --- |
| `evidence_id` | `ev_` and 64 hex digits, a hash of the content |
| `subject` | `name`, `digest.sha256`, `format`, `architecture`, `local_path`, or `null` |
| `provider` | `id`, `name`, `version` or `null` |
| `analysis_profile` | the provider's settings and their digest, or `null`, always present |
| `predicate_type` | a tag, `rea.analysis` by default |
| `operation`, `parameters` | the tool and its input |
| `raw_result`, `normalized_result` | provider output and the canonical result |
| `confidence`, `authority` | the enums above |
| `environment` | `id`, `platform`, `architecture`, `isolation`, or `null` |
| `limitations` | plain sentences |
| `relationship_coverage` | `status` `complete`, `partial`, or `unknown` with diagnostics, or `null` |
| `locations` | `address`, `address-range`, `artifact-path`, `file-offset`, `file-offset-range` |
| `evidence_links` | the `ev_` ids this record rests on |

This is the real record rea wrote for `grade`, cut to the fields that matter here. The full file is `code/fixtures/rea-evidence-grade.json`, 37,573 bytes.

```json
{
  "evidence_id": "ev_67b6d3f992eaf49a2e16de084b6ebfdd9884e8c5c7f75e175b7bb20f4f748ce1",
  "subject": {
    "name": "ledger-x86_64-O1.o",
    "digest": { "sha256": "9a4a8082ba5e285a732552981a6935e0c5255725664f380e37c44ebfb04d803f" },
    "format": "elf",
    "architecture": "x86_64",
    "local_path": "/private/tmp/aiefs-re/phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns/code/fixtures/ledger-x86_64-O1.o"
  },
  "provider": { "id": "ghidra", "name": "Ghidra", "version": "12.1.4" },
  "analysis_profile": {
    "provider": { "id": "ghidra", "name": "Ghidra", "version": "12.1.4" },
    "parameters": { "jump_table_evidence": "typed-case-default-blocks-v1", "import_mode": "ephemeral-source-immutable" },
    "digest": "9c7f6b24be69294e61da046e4583e3856cb9e40433b149c1bf8bb534d2fe03ef"
  },
  "operation": "analyze_function",
  "parameters": { "procedure": "grade" },
  "confidence": "observed",
  "authority": "shipped-artifact",
  "environment": null,
  "limitations": [
    "Default-space addresses use lowercase 0x-prefixed hexadecimal; other address spaces use <percent-encoded-space>:0x<hex>.",
    "Resolved reference metadata identifies computed, indirect, external, call, jump, and data edges; unresolved targetless flows remain unknown, and function classifications distinguish thunks and externals."
  ],
  "relationship_coverage": {
    "status": "complete",
    "diagnostics": [
      "Only resolved Ghidra call references are returned; unresolved computed or indirect calls remain unknown, while function classifications distinguish thunks and externals."
    ]
  },
  "locations": [],
  "evidence_links": []
}
```

The real `parameters` object of the profile has 25 keys. The real `limitations` list has ten sentences. Keep them. A limitation is part of the content, so dropping one changes the id, and your ledger would then reject the record.

Note what the record does not say. `environment` is `null` because Ghidra read a file and ran nothing. `locations` is empty because this operation reports addresses inside `normalized_result`. `relationship_coverage` has the status `complete`. Its diagnostic says that only resolved Ghidra call references are returned, and that unresolved computed or indirect calls stay unknown. So the caller and callee lists are complete for resolved calls only.

## The Id Is a Hash of Content, and the Path Is Not in It

rea computes `evidence_id` as `ev_` plus SHA-256 over the RFC 8785 canonical JSON of a projection of the record. The projection keeps the subject's `digest`, `format`, and `architecture` and drops `name` and `local_path`. It drops `relationship_coverage` when its value is `null`, so a record without call relationships keeps the same id as before the field existed. Everything else, including `raw_result` and every limitation, is hashed.

RFC 8785 sorts object keys, removes whitespace, and fixes the number and string forms. For records whose numbers are integers, Python's standard library produces the same bytes:

```python
def canonical_json(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)
```

`code/main.py` refuses floats before it hashes, because RFC 8785 and Python print some floats differently. The two rea records and the snapshot hold no floats, so the recipe reproduces every rea hash:

| rea value | Recomputed by `code/main.py` |
|---|---|
| `ev_67b6d3f992eaf49a…` for `grade` | equal |
| `ev_e88b10dc0c6400e5…` for `percent_change` | equal |
| profile digest `9c7f6b24be69294e…` over `{provider, parameters}` | equal |
| `query_26122aebe9d8abae…` for the `grade` snapshot entry | equal |
| `query_0f95ef38038d3666…` for the `percent_change` entry | equal |

Why exclude the path? The same observation of the same bytes gets the same id on any machine and in any folder. The `local_path` in the listing above names a folder on one Mac. The id does not change when you copy the fixture to `/home/you/re`. `rebind_subject_path()` lets you show a record under a new path. It refuses when `sha256`, `format`, or `architecture` differ. rea 6.5.0 does the same with `rebindEvidenceToTargetPath` when it replays a snapshot record for a target at a new path.

`validate_evidence()` recomputes the id and rejects a mismatch with rea's sentence, "Evidence semantic identifier does not match its record". It also rejects a record whose `analysis_profile.provider` differs from its `provider`. The test `test_tampered_id_and_mismatched_profile_are_rejected` edits one line of pseudocode inside the real `grade` record and watches the ledger refuse it.

## Observe the Object Yourself

Before any provider, the ledger reads the file. `observe_object()` parses the ELF64 section headers, `.symtab`, `.strtab`, and `.rela.text` with `struct.unpack_from`. It writes one `inspect_object` record and one `read_function_bytes` record per function symbol. All five are `observed` with authority `shipped-artifact`, because the source was the file on disk.

| Record | Content | Id |
|---|---|---|
| `inspect_object` | five sections with offsets, sizes, and hashes, four functions, three relocations | `ev_645e0a145f28bd5c…` |
| `read_function_bytes percent_change` | 16 bytes at `.text+0x00` | `ev_2572a7d254ad15cb…` |
| `read_function_bytes grade` | 46 bytes at `.text+0x10`, SHA-256 `ffcb75c2a7bb1104…` | `ev_a467c2427bfc0c56…` |
| `read_function_bytes total` | 31 bytes at `.text+0x40` | `ev_b1e845cea2543073…` |
| `read_function_bytes grade_label` | 63 bytes at `.text+0x60` | `ev_c50041be26e6b7f4…` |

`llvm-objdump -t` agrees: `grade` at `0000000000000010` with size `2e`. The three relocations in `.rela.text` are `R_X86_64_PC32` against `.rodata` at offsets `0x36`, `0x84`, and `0x93`, with addends `0x10`, `0x24`, and `-0x4`. Each record carries a `file-offset-range` location and one limitation: "Section bytes are read from the file on disk. The reader applies no relocation and runs no code."

Lesson 32 builds this reader in full. Here it is 60 lines, because this lesson is about what you record about the read.

## Derive the Table, and Say That You Derived It

The 46 bytes of `grade` contain four patterns that lesson 33 decoded:

| Bytes | Instruction | Offset in `grade` |
|---|---|---|
| `48 69 c0 67 66 66 66` | `imul rax, rax, 0x66666667` | 3 |
| `48 c1 f9 22` | `sar rcx, 34` | 13 |
| `83 c1 fa` | `add ecx, -6` | 23 |
| `83 f9 04 77 0c` | `cmp ecx, 4` then `ja` | 28 |

A multiply by `0x66666667` followed by a shift of 34 is a signed division by 10. The file holds no 10. `derive_grade_model()` writes that fact as a limitation: "The divisor 10 is a derivation from the multiplier 0x66666667 and the shift 34. The file holds no 10."

The `add ecx, -6` sets the first case to 6. The `cmp ecx, 4` with an unsigned jump admits five cases, 6 to 10.

The `lea` at `.text+0x33` carries the relocation with addend `0x10`. A PC32 relocation measures from the end of the 4-byte displacement, so the table starts at `.rodata+0x14`. Five little-endian words there read `1, 2, 3, 4, 4`. The switch in `ledger.c` returns 1 for 60 to 69, 2 for the seventies, 3 for the eighties, and 4 for 90 to 100. The compiler turned the switch into a lookup table of return values.

The resulting record `ev_605106bff2d9998f…` has `confidence` `derived`, and its `evidence_links` name the two observed records it rests on. Remove the bytes record from the ledger and the derived record has a dangling link. The figure above shows that state when you turn off `ev_a467c242…`.

Now compare with Ghidra. Its pseudocode for the same bytes:

```c
uint grade(int param_1)
{
  uint uVar1;
  uint uVar2;

  uVar2 = param_1 / 10 - 6;
  uVar1 = -(param_1 >> 0x1f) ^ (uint)((ulong)((long)param_1 * 0x66666667) >> 0x3f);
  if (uVar2 < 5) {
    uVar1 = *(uint *)(&DAT_001000b4 + (ulong)uVar2 * 4);
  }
  return uVar1;
}
```

Ghidra applied the relocation and named the table `DAT_001000b4`, which is `.rodata+0x14` after it placed `.text` at `0x100000`. It recovered the division by 10 and the five cases. For the default value it printed an expression that is always 0 and never says 0. The p-code in `native_value_flow` marks those operations `is_dead: true`. The record is a faithful observation of Ghidra. The meaning you read from it is derived, and the value you expect from a run is inferred.

The `percent_change` record shows the other failure. Ghidra's signature reads `undefined1 [16] percent_change(int param_1,int param_2,ulong param_3)`. The source says `int percent_change(int before, int after)`. `idiv` writes `EDX:EAX`, and the zero path leaves `EDX` untouched, so the decompiler inferred a 16-byte return and a third parameter. Its own `native_api.return_type.confidence` for `grade` is `"low"`. Treat a recovered signature as the provider's inference, and record it that way.

## Predictions Are Inferred Records

A prediction is a claim about behaviour that no observation has stated. `claim_suite()` builds eighteen of them from the derived models and from the source. `record_prediction()` stores each one as a record with `confidence` `inferred` and `authority` `analyst-inference`, linked to the records it rests on.

| Claim | Predicted value | Rests on |
|---|---|---|
| `percent_change(12400, 15500)` | 25, from 310000 / 12400 | division model `ev_076a9167…` |
| `percent_change(0, 5)` | 0, the zero guard | division model |
| `percent_change(100, 50)` | -50 | division model |
| `percent_change(-7, 3)` | -142, because `idiv` truncates toward zero | division model |
| `grade(55)` | 0, index -1 fails the unsigned compare | table model `ev_605106bf…` |
| `grade(60)`, `grade(69)` | 1, 1 | table model |
| `grade(70)`, `grade(85)` | 2, 3 | table model |
| `grade(95)`, `grade(100)`, `grade(105)` | 4, 4, 4 | table model |
| `grade(110)`, `grade(-5)` | 0, 0 | table model |
| `total(1, 2, 3)`, `total()` | 6, 0 | source record `ev_2f1e6d25…` |
| `grade_label(85)` | `"B"` | source record and table model |
| `grade(score)` for 90 to 100 | 4 for all eleven inputs | table model |

`predict()` uses C semantics, not Python semantics. `c_div()` truncates toward zero, and `wrap32()` folds every intermediate into 32 bits. Python's `//` rounds toward negative infinity, so `(3 - -7) * 100 // -7` gives -143 and the C program gives -142. Lesson 36 makes this grid much larger.

Each prediction opens one residual unknown. The unknown asks for `observed` evidence with authority `controlled-replay` and recommends one probe: `execute_function` on the host build. The next section produces that evidence. The question for the first grade claim reads "Does grade(95) == 4 hold when the compiled function runs?"

## Check Them Against a Run

`code/fixtures/harness.c` includes `ledger.c` and prints one result per invocation. `observe_runs()` compiles it with the first of `clang`, `cc`, or `gcc` on your PATH and runs every input in the grid once. Each run becomes one record:

```json
{
  "operation": "execute_function",
  "parameters": { "function": "grade", "args": [95] },
  "normalized_result": { "result": 4, "stdout": "4\n", "exit_code": 0 },
  "confidence": "observed",
  "authority": "controlled-replay",
  "environment": { "id": "host-process", "platform": "darwin", "architecture": "arm64", "isolation": "process" },
  "limitations": [
    "The run executed a host build of ledger.c, not the x86-64 object. The claim about the object rests on the shared source and on the compiler.",
    "One run observes one input. It proves nothing about other inputs."
  ]
}
```

The subject of a run record is the harness binary, a Mach-O arm64 file on this Mac, with its own SHA-256. The provider is `course-harness` with the compiler's version line, here `Apple clang version 17.0.0 (clang-1700.6.3.2)`. The `evidence_links` name the source record `ev_2f1e6d251543d017…`, because the run and the object share `ledger.c` and nothing else.

Read the first limitation twice. The x86-64 object never ran on this machine. What ran was a second build of the same source for another architecture. That is still an observation, and it is the strongest one available without an emulator, so the claim passes with that sentence attached. A report that omits it has lost information the reader needs.

The 17 single-input runs all agreed with the predictions. `code/fixtures/run-evidence.json` holds those 17 records and the source record, exported with `--record` on 2026-10-13. When no compiler is present, `build_ledger()` imports that bundle instead of running, and the report says so in its `runs` field.

## Promotion Rules

A claim moves from inferred to supported only through observed runs. `check_claim()` looks for `execute_function` records with the same function and arguments, compares each result with the prediction, and counts the covered inputs:

| Status | Condition | rea's completion ledger |
|---|---|---|
| `pass` | every input has an agreeing run and none disagrees | `pass` |
| `fail` | any run disagrees | `fail` |
| `unknown` | some inputs have runs, others have none | `unknown` |
| `unsupported` | no input has a run | `unsupported` |

`promote_claim()` is the strict form. It raises `ClaimError` when any id is `inferred` or `derived`. It raises when an id names a run of another function or of other arguments. It raises when the list is empty, and when the runs cover fewer inputs than the claim. The Ghidra pseudocode record and the table model both exist for `grade(55)`, and neither can promote it. Turn off `ev_7be90c0c…` in the figure and watch the claim fall to `unsupported` while two records about `grade` remain.

The range claim shows the partial case. Only two of its eleven inputs, 95 and 100, appear in the run grid. `check_claim()` returns `unknown` with `covered` 2 of 11, and `promote_claim()` refuses with "2 of 11 inputs have observed runs". The ledger does not round that up.

`completion_ledger()` mirrors rea's `EvidenceCompletionLedger`. Its id is `ecl_` plus the hash of its records, and `complete` is true only when `pass` equals `total`. The demo prints `ecl_da64933ea13befed…` with `complete: false`, because of that one range claim.

## Unknowns Are Records with a Hash Chain

rea stores a residual unknown as a strict record. `code/main.py` keeps the same fields and the same invariants.

The id is `unk_` plus SHA-256 over `{domain, question, scope_digest}`, with the question's whitespace collapsed to single spaces. Two analysts who ask the same question about the same file get the same id. The `scope_digest` is the SHA-256 of the object.

Every change is a new revision. Revision 1 has `previous_revision_digest` `null`. Every later revision names the `revision_digest` of the one before it, and the digest covers every field except itself. `verify_unknown_chain()` walks the list and recomputes each digest. It checks that each link points at the previous revision. It checks that the mutation evidence each revision names is in the ledger.

Each mutation is itself an evidence record, as rea does with provider `rea-unknown-registry`. Ours carries `confidence` `derived`, `authority` `analyst-inference`, and no subject. Its limitation reads "A registry mutation records what the analyst decided. It is not proof of the answer."

That is why the demo's 81 records include 36 derived mutation records: 18 openings and 18 updates.

Three invariants are enforced on every revision:

- Only a `resolved` unknown carries a `resolution`, and only revision 1 has no predecessor.
- A `contradicted` unknown names at least one contradicting id, and no id appears in both lists.
- A `verified` resolution names at least one evidence id with the required confidence and authority.

The third rule is where the ledger refuses most often. rea's workflow notes say "Only qualifying observed evidence can verify a resolution.". `resolve_unknown()` therefore rejects the table model, rejects an observed record with authority `shipped-artifact`, and accepts the run record `ev_f4ffbe8f922ec7fe…`. The resolved revision for `grade(95)` is revision 2, and its `previous_revision_digest` is `ffca840b55a8a188…`, the digest of revision 1.

`update_unknown()` takes `expected_revision` and raises `revision-conflict` when it is stale, as rea's `update_unknown` tool does. The right reaction is the one rea's notes give: reread the current revision and decide again.

One unknown stays open after the demo: `unk_f2eb0d7f84c80a19…`, "Does grade(score) == 4 for every score from 90 to 100 hold when the compiled function runs?". Its status is `investigating`, its supporting ids include the two runs, and its probe still names the nine inputs without a run.

## A Cache of Answers Is Not a Database of Analysis

rea has three things that look like a cache. The Ghidra target snapshot is a private copy of the input, imported with `-readOnly -deleteProject` and deleted on close. The in-memory `AnalysisSnapshotCache` holds up to 10,000 entries for one binary identity. The snapshot file holds `target`, `binding`, `entries`, `workflow_entries`, and an `evidence_bundle`.

The cache key is `query_` plus SHA-256 over `{target, binding, operation, parameters}`. `target` is `{sha256, kind, format, architecture}`, and a `raw-binary` target also has `entry_point`. `binding` is the provider and the whole analysis profile, digest included. Change any of the 25 profile parameters, for example `jump_table_evidence` from `typed-case-default-blocks-v1` to a `v2`, and the digest changes, so every key changes.

`code/fixtures/rea-snapshot.json` is the file rea wrote during the two runs, 142,690 bytes. rea wrote it with owner-only permissions, and the committed copy is readable by everyone. It has two entries and an evidence bundle with the same two records. `AnswerCache.import_snapshot()` recomputes each `query_id` and refuses the file when any differs. It refuses a snapshot whose `target` or `binding` differs from the active one, with rea's wording `profile_mismatch`. It refuses a snapshot whose `format_version` is not `course-answer-cache-1`.

Three measurements from this machine. The first `grade` query took 8.6 s, with a fresh Ghidra import. The `percent_change` query against the same snapshot took 8.5 s, because a different query is a cache miss. A third `grade` query took 2.1 s and returned the identical record with the identical `evidence_id`. The in-memory replay in rea adds the limitation "Loaded from a local REA analysis snapshot; this call did not re-run the provider.". Our `lookup()` adds a sentence of the same kind, so a reader can tell a replay from a fresh answer.

A mutation ends the cache. In rea 6.5.0, a rename or a comment clears the snapshot cache before rea sends the call to the provider. A failed reply cannot prove that the write rolled back, so a failed write also stops replay. A metadata import that changes the database does the same.

## Why an Agent Needs This

An agent that drives rea through MCP sees the full record on every call and can cite `evidence_id` in its report. The research from 2026 says where that goes wrong. Over-trust in tool output was one of the four weaknesses in the NDSS BAR study. In the planted-text study, showing binary content as data alone still left 15 unsafe proposals of 40, and provenance checks with tool authorization removed them. A third study watched an agent drive Ghidra through MCP ([arXiv 2606.06838](https://arxiv.org/abs/2606.06838)). In binaries with hundreds of functions, only 10 to 15 percent received real analysis before the agent produced stubs.

The ledger answers each of these with a record, and the agent reports only what the ledger holds. A claim without an observed run is `unsupported`. A claim with some runs is `unknown`. A provider text is `observed` about the provider and nothing more. Give the agent the skill file in `outputs/` and make the ledger the only place it writes conclusions. That holds for Claude, Cursor, Codex, OpenClaw, Hermes, or any agent that reads SKILL.md.

## Build It

Run the standard-library demo:

```bash
cd phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns
python3 code/main.py
```

The demo reads the object, imports the two rea records, verifies the rea snapshot, and derives the two models. It then records 18 predictions, opens 18 unknowns, compiles and runs the harness, checks every claim, and resolves 17 unknowns. Expected shape:

```json
{
  "records": 81,
  "by_confidence": { "observed": 25, "derived": 38, "inferred": 18 },
  "rea_snapshot": { "entries": 2, "replay_hit": true, "stale_profile_refused": true },
  "grade_table": [1, 2, 3, 4, 4],
  "runs": "live: Apple clang version 17.0.0 (clang-1700.6.3.2)",
  "claims": [ { "claim_id": "grade(95)", "status": "pass", "covered": "1/1" }, { "claim_id": "grade(90..100)", "status": "unknown", "covered": "2/11" } ],
  "completion_ledger_id": "ecl_da64933ea13befed9483f8b00447bb3f4ceb74324c01e2515eff03f3af3ca750",
  "complete": false,
  "unknowns": { "resolved": 17, "investigating": 1 }
}
```

Without a C compiler, `runs` reads `imported 17 recorded run records from run-evidence.json` and the rest is the same.

Read `code/main.py` in this order:

1. `canonical_json()` and `compute_evidence_id()` hold the hash recipe and the semantic projection.
2. `create_evidence()` and `validate_evidence()` build and check a record.
3. `EvidenceLedger.record()` and `import_bundle()` store records and refuse conflicts.
4. `open_unknown()`, `update_unknown()`, and `resolve_unknown()` keep the revision chain.
5. `observe_object()` reads the ELF, and `derive_grade_model()` reads the table.
6. `claim_suite()`, `predict()`, and `record_prediction()` write the inferred tier.
7. `observe_runs()` turns each harness run into an observed record.
8. `check_claim()`, `promote_claim()`, and `completion_ledger()` apply the promotion rules.
9. `AnswerCache` keys answers like rea's snapshots and refuses stale ones.

## Use It

Keep one ledger per target and per investigation. Put the target's SHA-256 in every subject and the question's scope digest in every unknown. When you change tools, change the `provider` and let the ids diverge. When you rebuild the fixture, the subject digest changes and every old record becomes evidence about another file.

Write limitations at the moment you know them. The reader that applies no relocation says so. The run of a host build says so. The model that infers a divisor says so. A record written without its limitations looks stronger than the facts allow, and a later reader cannot repair that.

Treat every provider text as data. Strings and pseudocode from the target are text that the target controls. They never become instructions, and they never become observations of behaviour. rea 6.5.0 marks such results with `_meta.provenance.untrusted_content: true`. Its server instructions tell the model to treat target content as data and to report any request in it to run, install, download, or send something as a prompt-injection attempt. The marker helps, but your ledger must still keep target text out of the instructions.

## Interactive Lab

### Lab A: recompute a rea id

From the `code` directory, open Python:

```bash
cd phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns/code
python3 -q
```

Run:

```python
from main import *
record = load_evidence_file(FIXTURES / "rea-evidence-grade.json")
record["evidence_id"] == compute_evidence_id(record)
record["subject"]["local_path"] = "/home/you/re/ledger-x86_64-O1.o"
record["evidence_id"] == compute_evidence_id(record)
record["limitations"].pop()
record["evidence_id"] == compute_evidence_id(record)
```

The first two comparisons are true. The path is not in the hash. The third is false, because a limitation is content.

### Lab B: refuse a promotion

```python
ledger, report = build_ledger(live_runs=False)
claim = [c for c in claim_suite(ledger.find(operation="derive_switch_model")[0], ledger.find(operation="derive_arithmetic_model")[0], ledger.find(operation="read_source")[0]) if c.claim_id == "grade(55)"][0]
promote_claim(ledger, claim, [ledger.find(operation="derive_switch_model")[0]["evidence_id"]])
```

The call raises `ClaimError` and names the derived id. Now pass the run id:

```python
run = run_records_for(ledger, "grade", [55])[0]
promote_claim(ledger, claim, [run["evidence_id"]])["status"]
```

The status is `pass`, and the returned `limitations` carry the host-build sentence.

### Lab C: refuse a stale snapshot

```python
import json
snapshot = json.loads(REA_SNAPSHOT_PATH.read_text())
target, binding = rea_snapshot_binding(snapshot)
AnswerCache(target, binding).import_snapshot(snapshot)
stale = dict(binding["analysis_profile"]["parameters"], jump_table_evidence="typed-case-default-blocks-v2")
AnswerCache(target, {"provider": binding["provider"], "analysis_profile": make_profile(binding["provider"], stale)}).import_snapshot(snapshot)
```

The first import returns 2. The second raises `CacheError` with `profile_mismatch`. One version string changed, and the whole snapshot is refused.

### Lab D: break the chain

```python
unknown_id = [u for u, r in ledger.unknowns.items() if r[-1]["status"] == "investigating"][0]
ledger.verify_unknown_chain(unknown_id)
ledger.unknowns[unknown_id][0]["severity"] = "critical"
ledger.verify_unknown_chain(unknown_id)
```

The first call returns 2. The second raises `EvidenceIntegrityError`, because revision 1 no longer matches its own digest and revision 2 points at a digest that no longer exists.

## Practice Lab

Close the open unknown and add a second provider.

Requirements:

- Extend `run_grid()` so the range claim's nine missing inputs run, then confirm the unknown moves to `resolved` at revision 3.
- Add `llvm-objdump -d` as a second provider with its own `provider` object and record its listing of `grade` as `observed`.
- Write a `derived` record that states the two listings, Ghidra's and llvm-objdump's, decode the same 14 instructions, and link both.
- Open an unknown for `grade_label(105)` with severity `high`, since the table index 4 reads `labels[4]`, and resolve it with a run.
- Export the ledger with `export_bundle()`, import it into a fresh ledger, and prove every chain still verifies.

Success means a report in which every sentence cites an id from the bundle and the one `unknown` claim is gone.

## Graded Lab

Five questions about the fixtures of this lesson. Find each answer with the code you built, then write it into `code/lab_answers.json`. Write numbers as numbers or as hex strings such as `"0x40"`, and lists as JSON lists.

1. `t1`: the evidence id that compute_evidence_id gives for rea-evidence-grade.json.
2. `t2`: the number of limitations in the grade record.
3. `t3`: the relationship_coverage status of the grade record.
4. `t4`: the confidence and the authority of the grade record, as a list of two strings.
5. `t5`: the SHA-256 of the subject of the grade record.

Check your answers:

```bash
cd phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns
python3 code/lab.py
```

The checker computes each expected value from `code/main.py` on the committed fixtures. It prints `PASS`, `FAIL` or `TODO` for each task and a score, and it exits 0 only when all five pass. `python3 code/lab.py my-answers.json` checks another file. `code/tests/test_lab.py` proves that the checker accepts the right answers and rejects a wrong one.

### See it run

The [Inside a Decompiler](https://aiengineeringfromscratch.com/inside-a-decompiler?symbols=off) machine keeps an evidence ledger with four trays: observed, derived, inferred and unknown. This link opens the run with the symbol table switched off, so the name and the end of the function file as unknowns and the start files as inferred.

## Lesson Artifact

This lesson produces `outputs/skill-evidence-ledger.md`. It tells an agent how to write every finding as a record with confidence, authority, limitations, and links. It tells the agent how to keep unknowns as revisions, and when a claim is `pass`, `fail`, `unknown`, or `unsupported`.

## Verify It

Run the demo and the deterministic suite:

```bash
cd phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns
python3 code/main.py
python3 -m unittest discover -s code/tests -v
```

The 28 tests prove:

- both rea `evidence_id` values, the profile digest, and both snapshot `query_id` values recompute from content
- a changed path keeps the id and a changed limitation changes it
- a tampered record, a mismatched profile provider, a float, and an unknown enum value are rejected
- a duplicate record returns `duplicate`, a conflicting record raises, and a bundle import is atomic
- the recorded run bundle imports with 18 records and no dangling links
- an unknown opens at revision 1, refuses a stale `expected_revision`, and resolves only with observed `controlled-replay` evidence
- an edited revision breaks the chain
- promotion refuses inferred, derived, empty, and unrelated evidence, and passes with an agreeing run
- partial coverage is `unknown` and a disagreeing run is `fail`
- the cache hits on the exact key and misses on other parameters
- the cache refuses a bumped profile version, a wrong target, a wrong format version, and a tampered key
- the ELF reader agrees with `llvm-objdump` on offsets, sizes, bytes, and relocations, and the table reads `1, 2, 3, 4, 4`
- the predictions use C division, and the recorded runs agree with all 17 single-input claims
- with a compiler present, the live runs agree too

## Production Failure Modes

| Failure | What the weak report says | What the ledger requires |
|---|---|---|
| Pseudocode read as behaviour | "grade returns 0 for failing scores" | an `execute_function` record for that input, or `unsupported` |
| Decompiler signature trusted | "percent_change returns 16 bytes" | the signature marked as the provider's inference with its `low` confidence |
| Empty list read as absence | "the function has no callers" | an `unknown` status, or a coverage field when the tool provides one |
| Path hashed into the id | "the record changed" after a copy | the semantic projection without `name` and `local_path` |
| Limitation dropped from a copy | a record that looks stronger than the source | id mismatch and rejection on import |
| Partial grid rounded up | "all scores from 90 pass" | `unknown` with `covered` 2 of 11 |
| Host run presented as the object's run | "the x86-64 object returned 25" | the host-build limitation carried on the claim |
| Unknown closed by a sentence | "resolved, see above" | a `verified` resolution with observed ids of the required authority |
| Stale revision overwritten | two analysts' edits collide | `revision-conflict` and a reread |
| Old snapshot replayed after a release | answers from a changed contract | `profile_mismatch` on import |
| Cache kept after a rename | a replay that hides a metadata write | invalidation before dispatch and a failed export |

## Operational Rule

Record what you read, what you computed, and what you expect as three kinds of record with three words. Close an unknown with an id, never with a sentence. Replay an answer only under the exact key it was stored with, and refuse it when one version string differs.

## Further Reading

- [rea 6.5.0 source, `src/domain/evidence.ts` and `src/domain/residualUnknown.ts`](https://github.com/morluto/rea)
- [RFC 8785, JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785)
- [Ghidra 12.1.4 release](https://github.com/NationalSecurityAgency/ghidra/releases)
- [Agent Failure Patterns in CTF Reverse Engineering, NDSS BAR 2026](https://www.ndss-symposium.org/wp-content/uploads/bar2026-58.pdf)
- [When Binaries Talk Back: Representation-Confusion Attacks on LLM-Assisted Reverse Engineering, arXiv 2607.12507](https://arxiv.org/abs/2607.12507)
- [Agentic decompilation study, arXiv 2606.06838](https://arxiv.org/abs/2606.06838)
- [When LLM Decompilers Recompile More and Preserve Less, arXiv 2609.05370](https://arxiv.org/abs/2609.05370)
- rea 6.5.0 source at tag `3b79af2` that this lesson describes: `src/domain/evidence.ts`, `.agents/skills/reverse-engineer-anything/SKILL.md`, `docs/cli.md`, `src/domain/reconstructionVerification.ts`, `src/application/ReconstructionObligationCandidates.ts`, `docs/tool-design.md`, `src/domain/evidenceCompletionLedger.ts`, `src/domain/residualUnknown.ts`, `src/application/investigation/UnknownEvidence.ts`, `.agents/skills/reverse-engineer-anything/references/evidence-workflows.md`, `src/application/binary/AnalysisSnapshotCache.ts`, `src/domain/analysisSnapshot.ts`, `src/application/binary/BinarySession.ts`, `src/application/binary/BinarySessionRecords.ts`, `docs/mcp-contracts.md`.
