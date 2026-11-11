# Classify supported schema changes

Stage 2 of 4. Read [Stage 1](../../01-load-contracts-and-calls/docs/en.md) before starting; this stage compares two loaded contracts.

## What changes

When modifying an AI agent's tool interface, not all changes have the same impact. Adding an optional argument allows existing callers to continue operating unmodified. In contrast, adding a required field, removing a field, tightening allowed bounds, or narrowing allowed enum variants immediately breaks deployed agents.

The boundary for this stage is `classify_changes`.

## Work through one concrete case

Consider evolving a database search tool:

```figure
pj-tool-contract-migration-checker-2
```

If version 2 introduces a required `auth_token` or restricts `max_results` from 100 to 50, all historical agent plans relying on the broader contract will be rejected.

## Implement the contract

Implement `classify_changes(old_contract, new_contract)` in your workspace `main.py`.

Categorize each detected change into:
- `breaking`: added required property, removed property, narrowed type, narrowed enum, tightened minimum/maximum/minLength/maxLength, or changed `additionalProperties` from `True` to `False`.
- `compatible`: added optional property, widened type, widened enum, relaxed bounds, or enabled `additionalProperties`.
- `unresolved`: a keyword outside the supported subset, such as `$ref`, `oneOf`, `pattern` or `format`, whose value differs between the two versions, or a changed nested `properties`, `required`, `additionalProperties` or `items` inside a property. Annotations (`title`, `description`, `default`, `examples`) are ignored, and an unsupported keyword that did not change is not reported.

Each change object must include:
```python
{
    "type": "breaking" | "compatible" | "unresolved",
    "category": str,
    "property": str,
    "description": str
}
```

## Verify and inspect

```bash
python3 scripts/project_test.py tool-contract-migration-checker --stage 2 --path learning-artifacts/tool-contract-migration-checker --strict
```

## References

[Semantic Versioning 2.0.0](https://semver.org/)
