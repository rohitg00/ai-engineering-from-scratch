# Public implementation contract

Pass {train,test} records to the CLI, or {records} with --split 0.25 --seed experiment-1. Add --check in CI to return exit 2 when the split is unusable.

Normalization finds exact normalized copies, not paraphrases. Stable group hashing does not guarantee balanced classes or time-aware evaluation. Source text remains present in exported partitions.

### main.py

```python
def fingerprint(text)
def validate(records)
def audit(train, test)
def split_groups(records, test_fraction=0.2, seed='course')
def summarize(train, test)
```

The stage tests specify ordinary results and rejected inputs. Do not replace the learner imports with reference imports. The final stage also runs the supplied input driver against your cumulative implementation.
