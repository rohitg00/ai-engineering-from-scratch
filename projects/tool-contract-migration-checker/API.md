# Public implementation contract

Tool Contract Migration Checker evaluates before-and-after JSON schemas for callable tools and checks backwards compatibility against recorded calls.

### main.py

```python
def load_contract(raw: Any) -> Dict[str, Any]
def load_calls(raw: Any) -> List[Dict[str, Any]]
def validate_call(contract: Dict[str, Any], args: Any) -> Tuple[bool, List[str]]
def classify_changes(old_contract: Dict[str, Any], new_contract: Dict[str, Any]) -> List[Dict[str, Any]]
def generate_counterexamples(old_contract: Dict[str, Any], new_contract: Dict[str, Any]) -> List[Dict[str, Any]]
def replay_calls(old_contract: Dict[str, Any], new_contract: Dict[str, Any], calls: List[Dict[str, Any]]) -> Dict[str, Any]
def build_report(old_contract: Dict[str, Any], new_contract: Dict[str, Any], changes: List[Dict[str, Any]], counterexamples: List[Dict[str, Any]], replay_result: Dict[str, Any]) -> Dict[str, Any]
def export_fixtures(output_path: str, counterexamples: List[Dict[str, Any]], broken_calls: List[Dict[str, Any]]) -> Dict[str, Any]
```

### CLI invocation

```bash
python3 cli.py --old samples/catalog_v1.json --new samples/catalog_v2.json --calls samples/saved_calls.json --output report.json --strict
```

### Exit codes

- `0`: The report is compatible: no breaking changes, no unresolved changes, and every saved call that was valid under the old contract still passes. Calls that were already invalid under the old contract are listed separately and do not affect the result. The CLI also exits 0 when `--strict` was not passed.
- `1`: When `--strict` is enabled and `report["compatible"]` is `False` (due to breaking changes, unresolved keywords, or broken historical calls).
