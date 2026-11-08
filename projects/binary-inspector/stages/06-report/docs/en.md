# JSON report, HTML byte map, and build diff

Stage 6 of 6. This stage composes stages 1 to 5 into three artifacts: a versioned JSON report, a standalone HTML page, and a diff between two builds. Lessons [32](../../../../../phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch/docs/en.md) and [40](../../../../../phases/13-tools-and-protocols/40-linking-loading-and-stripped-binaries/docs/en.md) compare builds by hand in their labs. This stage makes that comparison one command.

## What you build

You write six functions in the `report` module:

- `byte_map(data, section_list, segment_list=(), cells=128)` divides the file into equal slices and labels each one.
- `build_report(data, name="input", truth=None, min_string=4, cells=128)` returns the full report.
- `validate_report(report)` returns a list of problems, empty when the report is valid.
- `render_html(report)` returns one standalone HTML page.
- `diff_reports(old, new)` compares two reports.
- `render_diff_text(diff)` prints the diff as lines.

The supplied CLI calls them:

```bash
python3 cli.py inspect FILE [--truth UNSTRIPPED] [--json PATH] [--html PATH] [--min-string N] [--cells N]
python3 cli.py diff OLD NEW [--json PATH]
```

It exits 0 on success and 2 with `error: ...` on standard error for an unreadable or unsupported file.

## Why it matters

A report that only prints to a terminal cannot go into CI or a review thread. The JSON report has a schema name, so a later script can refuse a report it does not understand. The HTML page shows where the bytes are. In a byte map, a large zero-filled segment, a high-entropy blob, or a code section that grew is visible at once. Every string in the page comes from the binary, so the page escapes all of them. A binary is input you do not control, even when you compiled it.

## Work through one concrete case

The stripped arm64 build is 50,264 bytes. With 128 cells, cell *i* covers `[i × 50264 // 128, (i + 1) × 50264 // 128)`:

| Cell | Range | Region | Entropy |
|---|---|---|---|
| 0 | 0 to 392 | `headers` | 2.1376 |
| 3 | 1178 to 1570 | `__text` | 3.4159 |
| 5 | 1963 to 2356 | `__text` | 5.9288 |
| 6 | 2356 to 2748 | `__cstring` | 2.4591 |
| 7 | 2748 to 3141 | `__TEXT` | 0.0 |
| 127 | 49871 to 50264 | `__LINKEDIT` | 5.9962 |

The region rule: the section with the largest overlap wins. Cell 3 overlaps `__text` (which starts at 1512) by 58 bytes and no other section, so it is `__text`. A cell with no section overlap that ends at or before the first section is `headers`. Otherwise the segment with the largest overlap names it, and with no segment it is `unmapped`. Cell 7 is the zero padding at the end of `__TEXT`. The lengths add up to the file size, and each cell starts where the previous one ends.

The HTML page draws one square per cell. The hue comes from the region name, and the opacity is `0.25 + 0.75 × entropy / 8`, so cell 7 is faint and cell 5 is bright.

The diff of the `-O0` and `-O2` builds:

```text
tally-arm64-O0 -> tally-arm64-O2
section __TEXT,__text: 848 -> 768 (-80)
section __TEXT,__unwind_info: 104 -> 96 (-8)
symbol _tally_sum: 0x10000075c -> 0x100000740
...
recovered function starts: 6 -> 6
```

The optimizer removed 80 bytes of code, so every function after `main` moved. The import list did not change. The diff of the unstripped and stripped builds lists eight removed exports: strip rewrote the exports trie of the executable down to `__mh_execute_header`.

```figure
pj-binary-inspector-6
```

In the lab, set the file size, the cell count, and a section range. The lab computes each cell range, the overlap, and the region the rule picks.

## Implement the contract

`byte_map(...) -> list[dict]`: raise `ValueError` when `cells` is below 1. Use `min(cells, len(data))` cells, at least 1. Each item is `{"index", "offset", "length", "region", "entropy"}`.

`build_report(...) -> dict` with exactly these top-level keys:

| Key | Value |
|---|---|
| `schema` | `"binary-inspector/report/v1"` (`REPORT_SCHEMA`) |
| `file` | `{"name", "size", "sha256"}` |
| `header` | `parse_header` |
| `sections`, `segments` | stage 2 |
| `symbols` | stage 3 |
| `imports`, `exports`, `relocations` | stage 4 |
| `fixups` | the `fixups` list of `chained_fixups` |
| `strings` | stage 5 with `min_string` |
| `function_starts` | stage 5. When `truth` bytes are given, add `truth` (the `symbols` method of the truth file) and `scores` (one `score_starts` per method). |
| `byte_map` | with `cells` |
| `summary` | counts: `format`, `arch`, `kind`, `sections`, `segments`, `symbols`, `defined_functions`, `imports`, `exports`, `relocations`, `fixups`, `strings`, `recovered_starts`, `file_entropy` |

The report must survive `json.dumps` with no custom encoder. The supplied JSON Schema file in the workspace documents the same shape for other tools.

`validate_report(report) -> list[str]`: return `["report must be an object"]` for a non-dictionary. Otherwise check each key in `REPORT_FIELDS` with the messages `missing key <key>` and `<key> must be <type>`, each list item in `ITEM_FIELDS` with `<key>[<i>] missing <field>`, the three `file` fields, and `format`, `arch`, `kind` in `header`.

`render_html(report) -> str`: start with `<!doctype html>`. Include the summary and the byte map, with exactly one element with `class="cell"` per cell. Add one table each for sections, segments, function starts and scores, symbols, imports, exports, relocations, fixups, and strings. Escape every value with `html.escape`. Load no external script, style, or font.

`diff_reports(old, new) -> dict`: raise `ValueError` when either report fails `validate_report`. Return:

```python
{"schema": "binary-inspector/diff/v1", "old": {...}, "new": {...}, "identical": bool,
 "header_changes": {key: [old, new]},
 "sections": {"added", "removed", "changed": [{"name", "old_size", "new_size", "delta", "old_entropy", "new_entropy"}]},
 "symbols": {"added", "removed", "moved": [{"name", "old", "new"}]},
 "imports": {"added", "removed"}, "exports": {"added", "removed"}, "strings": {"added", "removed"},
 "function_starts": {"old", "new"}}
```

Name a Mach-O section `segment,section`. Sum the sizes of sections with the same name, because a COFF object has six sections called `.rdata`. Compare defined symbols only, without section and file symbols.

`render_diff_text(diff) -> str`: first line `old -> new`, then `section NAME: OLD -> NEW (+/-DELTA)`, `symbol NAME: 0xOLD -> 0xNEW`, `+ kind name` and `- kind name` lines, and last `recovered function starts: OLD -> NEW`.

## Verify and inspect

```bash
python3 scripts/project_test.py binary-inspector --all --path learning-artifacts/binary-inspector --strict
cd learning-artifacts/binary-inspector
python3 cli.py inspect fixtures/tally-arm64-O2.stripped --truth fixtures/tally-arm64-O2 --json report.json --html report.html
python3 cli.py diff fixtures/tally-arm64-O0 fixtures/tally-arm64-O2 --json diff.json
```

The integration test runs your CLI on the held-out program and validates the JSON it writes. It also checks the exit code for a C source file.

## Investigate the failure boundary

- Replace the string `unknown bucket` in a copy of the executable with `<script>x</b>&` and render the page. The page must show the text and run nothing.
- Ask for more cells than the file has bytes. Each cell must still hold at least one byte.
- Pass a report with a missing key to `diff_reports`. It must refuse the report and name the first problem.
- Diff two files that are byte-identical. `identical` is true and every list is empty.

## Extensions

- Add `--fail-on` rules for CI, such as "no writable and executable section" or "no new imports".
- Render the diff as HTML with two byte maps side by side.
- Add an optional runner that compares your section table with `llvm-objdump -h` when that tool is installed, and skip when it is not.

## References

- [JSON Schema 2020-12](https://json-schema.org/draft/2020-12/json-schema-core)
- [Python html.escape](https://docs.python.org/3/library/html.html#html.escape) and [json](https://docs.python.org/3/library/json.html)
- [OWASP Cross Site Scripting Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
