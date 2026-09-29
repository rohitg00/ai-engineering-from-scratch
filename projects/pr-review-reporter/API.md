# Public implementation contract

Use --diff - for stdin, --repo /path --base REF --head REF for a read-only Git diff, or --candidates recorded-findings.json to validate another reviewer's findings against the supplied patch.

Four lexical detectors are narrow review candidates, not an exploit verdict. Binary and combined diffs are outside scope. Quoted Git paths are decoded before validating traversal and anchoring. No remote PR comment is posted.

### diff_parser.py

```python
def decode_path(raw)
def parse(raw)
```

### main.ts

```typescript
export function parseDiff(raw: string): AddedLine[]
export function inspect(lines: AddedLine[]): Finding[]
export function verify(findings: unknown[], lines: AddedLine[]): { accepted: Finding[]; rejected: unknown[] }
export function merge(findings: Finding[]): Finding[]
export function escapeHTML(value: string): string
export function render(findings: Finding[], rejected = 0): string
```

Record and class interfaces are supplied in the starter. Methods deliberately throw until implemented.

The candidates input must be an array. Keep malformed entries unchanged in `rejected`: reject nulls, arrays, non-object values, non-string `file`, `quote`, `rule` or `message`, and non-positive or non-integer line numbers before reading source evidence. Require nonempty trimmed quote, rule and message, a supported severity, and the existing exact location and quote match. Only accepted findings reach rendering or SARIF export.

The stage tests specify ordinary results and rejected inputs. Do not replace the learner imports with reference imports. The final stage also runs the supplied input driver against your cumulative implementation.
