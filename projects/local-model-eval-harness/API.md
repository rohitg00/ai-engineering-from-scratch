# Public implementation contract

record.py writes the same {manifest,source,labels,records} contract consumed by cli.py. --baseline compares only identical label fingerprints; --min-accuracy supplies a local CI gate.

Reported confidence is model self-report unless your adapter defines another method. ECE varies with bins and sample count. No model is downloaded or started, and the sample is not a hardware benchmark.

### main.py

```python
def validate(records)
def correct(record, labels)
def accuracy(records, labels)
def calibration(records, labels, bins=5)
def percentile(values, p)
def scorecard(records, labels, source)
```

The stage tests specify ordinary results and rejected inputs. Do not replace the learner imports with reference imports. The final stage also runs the supplied input driver against your cumulative implementation.
