# Public implementation contract

The `binspect` package has one module per stage. Every function takes the raw file bytes or values that earlier functions returned. No function prints. All addresses and offsets are Python integers. Every malformed table raises `FormatError`, a subclass of `ValueError`, with a message that names the offset or the field.

The starter supplies `FormatError`, `unpack(fmt, data, offset)`, the name tables, and the CLI. The stage documents give the worked examples and the full field rules.

### formats (stage 1)

```python
def detect_format(data: bytes) -> str
def parse_header(data: bytes) -> dict
def load_commands(data: bytes) -> list[dict]
```

`detect_format` returns `"elf64"`, `"coff"`, `"pe"`, or `"macho64"`. `parse_header` returns `{"format", "arch", "bits", "endian", "kind", "entry", "fields"}`. `load_commands` returns `{"cmd", "name", "offset", "size"}` per Mach-O load command.

### layout (stage 2)

```python
def shannon_entropy(data: bytes) -> float
def sections(data: bytes) -> list[dict]
def segments(data: bytes) -> list[dict]
def section_at_offset(section_list: list[dict], offset: int) -> dict | None
def section_at_address(section_list: list[dict], address: int) -> dict | None
```

A section is `{"index", "name", "segment", "type", "addr", "offset", "size", "file_size", "perms", "code", "entropy"}`. A segment is `{"name", "addr", "size", "offset", "file_size", "perms", "max_perms", "entropy"}`. `perms` is three characters from `r`, `w`, `x`, and `-`.

### symbols (stage 3)

```python
def read_cstring(data: bytes, offset: int, end: int | None = None) -> str
def demangle(name: str) -> str | None
def symbols(data: bytes) -> list[dict]
```

A symbol is `{"index", "name", "demangled", "value", "size", "kind", "binding", "section", "defined", "table"}`. Undefined Mach-O symbols add `library_ordinal`.

### linkage (stage 4)

```python
def uleb128(data: bytes, offset: int) -> tuple[int, int]
def relocations(data: bytes) -> list[dict]
def imports(data: bytes) -> list[dict]
def exports(data: bytes) -> list[dict]
def chained_fixups(data: bytes) -> dict
```

A relocation is `{"section", "offset", "type", "symbol", "addend"}`. An import is `{"name", "library", "slots", "hint", "ordinal"}`. An export is `{"name", "address", "ordinal", "forwarder"}`. `chained_fixups` returns `{"header", "imports", "fixups"}`, and each fixup is `{"offset", "address", "section", "raw", "next", "kind"}` plus bind or rebase fields.

### discovery (stage 5)

```python
def extract_strings(data: bytes, section_list: list[dict], segment_list=(), min_length: int = 4) -> list[dict]
def function_starts(data: bytes) -> dict
def score_starts(found, truth) -> dict
```

A string is `{"offset", "text", "encoding", "section", "segment"}`. `function_starts` returns sorted address lists under `symbols`, `function_starts_table`, `prologues`, `call_targets`, `entry`, and `recovered`. `score_starts` returns `{"found", "truth", "true_positives", "false_positives", "missed", "precision", "recall"}`.

### report (stage 6)

```python
def byte_map(data: bytes, section_list: list[dict], segment_list=(), cells: int = 128) -> list[dict]
def build_report(data: bytes, name: str = "input", truth: bytes | None = None, min_string: int = 4, cells: int = 128) -> dict
def validate_report(report) -> list[str]
def render_html(report: dict) -> str
def diff_reports(old: dict, new: dict) -> dict
def render_diff_text(diff: dict) -> str
```

The report schema name is `binary-inspector/report/v1` and the diff schema name is `binary-inspector/diff/v1`. The JSON Schema file in the workspace describes the report for other tools.

## CLI

```bash
python3 cli.py inspect FILE [--truth UNSTRIPPED] [--json PATH] [--html PATH] [--min-string N] [--cells N]
python3 cli.py diff OLD NEW [--json PATH]
```

Exit status 0 on success. Exit status 2 with `error: <message>` on standard error when a file is missing, unsupported, or malformed. The `inspect` command validates the report before it writes anything.

## Integration

Run `inspect` in CI on each release build and keep the JSON report beside the build artifact. Run `diff` against the previous release to review section growth, moved and removed symbols, and new imports. A script that reads the report checks `schema` first and refuses a version it does not know.
