# Public implementation contract

Run `python3 cli.py /absolute/inventory.json --serve` as a stdio server. tools/call catalog_search takes query, max_chars and k; the response returns selected public schemas and their character count.

The stdio transport implements the documented 2025-06-18 and 2025-11-25 initialization/tools subset. It is not a claim of full current MCP conformance. Inventory reads are local recordings; the generated tool count is not 250 distinct integrations.

### audit.py

```python
def audit_catalog(inventory=None)
```

### discovery.py

```python
def discover(tools, query, max_chars=1500, k=5)
```

### protocol.py

```python
def handle(request, state, inventory)
def serve(lines, output, inventory, tools=None)
```

### registry.py

```python
def catalog()
def execute(tool, arguments, inventory)
```

### client.ts

```typescript
export function exchange(server: string, requests: Request[], timeout = 3000): Promise<Response[]>
```

Record and class interfaces are supplied in the starter. Methods deliberately throw until implemented.

The stage tests specify ordinary results and rejected inputs. Do not replace the learner imports with reference imports. The final stage also runs the supplied input driver against your cumulative implementation.
