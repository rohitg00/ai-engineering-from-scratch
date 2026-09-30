# Public implementation contract

Import execute_jobs and provide invoke(job) -> (value, actual_cost). Use unit=nano_dollars only when rates and receipts have actually been converted to that unit.

Costs are caller-supplied integer receipts. A monotonic deadline gates dispatch but cannot interrupt a synchronous callback. The ledger is single-process and in-memory.

Both replay (`schedule`) and execution (`execute_jobs`) emit `events[].status`. Replay outcomes are `completed` or `rejected`; rejected events include a `reason` of `deadline` or `budget exceeded`. Execution may also return `needs_reconciliation` when actual usage is unknown or exceeds the reservation. Mode-specific cost and timing fields retain their distinct meanings.

### main.py

```python
def nonnegative(value)
def estimate(input_tokens, output_limit, input_rate, output_rate)
def ledger(limit)
def reserve(state, request_id, amount)
def settle(state, request_id, actual)
def schedule(jobs, limit, deadline_ms)
```

The stage tests specify ordinary results and rejected inputs. Do not replace the learner imports with reference imports. The final stage also runs the supplied input driver against your cumulative implementation.
