# Public implementation contract

Import run(payload, provider). The provider receives only a validated operation and scoped resource. The optional Strands model proposes a plan; it never bypasses the deterministic validator.

Default mode reads the supplied recording. --mode aws is an opt-in AWS CLI adapter for ECS services, CloudWatch CPU and bounded log reads; it requires caller configuration, credentials and AWS permissions. No deployment or live verification is implied.

### executor.py

```python
def execute(plan, provider, max_steps=5, max_chars=4000)
```

### plan.py

```python
def validate_plan(raw, scope)
```

### retry.py

```python
def request_key(operation, resource)
def cached_read(operation, resource, provider, cache, retries=2)
```

### strands_adapter.py

```python
def parse_model_plan(text, scope)
def run_strands(prompt, reply)
def bedrock_agent(model_id, region)
```

The stage tests specify ordinary results and rejected inputs. Do not replace the learner imports with reference imports. The final stage also runs the supplied input driver against your cumulative implementation.
