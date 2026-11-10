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

- `0`: Contracts are fully compatible or no breaking changes detected without override.
- `1`: Breaking changes detected when `--strict` is enabled.
