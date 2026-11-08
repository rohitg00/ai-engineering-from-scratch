---
id: structured-outputs
title: Structured Outputs and Constrained Decoding
code: SO
subtitle: Get valid JSON every time. Schemas, strict mode, logit masks, validators, retries and the output guard project.
hue: 215
sources: phases/05-nlp-foundations-to-advanced/20-structured-outputs-constrained-decoding, phases/11-llm-engineering/03-structured-outputs, phases/13-tools-and-protocols/04-structured-output, projects/json-schema-output-guard
source_hash: 85ee821939cf37d5
---

## Output guard pipeline
type: architecture
from: projects/json-schema-output-guard/solution/main.ts, projects/json-schema-output-guard/README.md

```arch
node | gen | 1,1 | generate | feedback, attempt | model
node | parse | 2,1 | parseJSON | 100_000 byte cap | process
node | check | 2,2 | checkSchema | preflight, depth 32 | process
node | val | 3,1 | validate | Issue[] with paths | process
node | ok | 4,1 | accepted | value plus trace | client
node | rep | 3,2 | repair | maxAttempts budget | queue
node | out | 4,2 | exhausted | every attempt in trace | client
edge | gen | parse | raw string
edge | check | val | schema
edge | parse | val | value
edge | val | ok | no issues
edge | val | rep | issues
edge | rep | gen | Issue[]
edge | rep | out | budget spent
```

## One constrained decoding step
type: flow
from: phases/05-nlp-foundations-to-advanced/20-structured-outputs-constrained-decoding/docs/en.md, phases/05-nlp-foundations-to-advanced/20-structured-outputs-constrained-decoding/code/main.py

1. **Model**: emits a logit vector over the full vocabulary (~100k tokens).
2. **FSM**: `fsm.valid_tokens(state, tokenizer)` lists the tokens that keep an accepting path.
3. **Mask**: `mask_logits` sets every other logit to `float("-inf")`.
4. **Sample**: softmax puts all probability on valid tokens. Pick one.
5. **Advance**: `fsm.transition(state, tok)`. Stop when `fsm.is_accept(state)`.

## Run the output guard project
type: command-table
span: 2
from: projects/json-schema-output-guard/README.md, projects/json-schema-output-guard/stages/04-bounded-repair/docs/en.md

| Command | What it does |
|---|---|
| `python3 scripts/project_test.py json-schema-output-guard --init <ws>` | Creates your workspace once. A fresh starter fails |
| `python3 scripts/project_test.py json-schema-output-guard --stage 1 --path <ws> --strict` | Grades one stage, 1 to 4 |
| `python3 scripts/project_test.py json-schema-output-guard --all --solution --strict` | Grades the reference solution |
| `node cli.ts --schema samples/schema.json --attempts samples/attempts.json --output guard.json --html guard.html` | Recorded repair. Attempt 1 fails at `$/confidence` |

## Tasks in code
type: task-table
span: 2
from: phases/05-nlp-foundations-to-advanced/20-structured-outputs-constrained-decoding/docs/en.md, phases/11-llm-engineering/03-structured-outputs/docs/en.md, phases/13-tools-and-protocols/04-structured-output/code/main.py, projects/json-schema-output-guard/solution/main.ts

| Task | Code |
|---|---|
| Local JSON with an FSM | `generator = outlines.generate.json(model, Review)` |
| Pydantic plus retries, any provider | `client = instructor.from_anthropic(Anthropic())` |
| Vendor schema mode | `client.beta.chat.completions.parse(..., response_format=Product)` |
| Validate a dict | `validate_schema(data, schema)` returns a list of errors |
| Parse, validate, retry | `extract_with_retry(text, schema, max_retries=3)` |
| Three-branch handler | `process_model_output(raw, INVOICE_SCHEMA)` |
| Guard one raw string | `guard(raw, schema)` returns `ok`, `value`, `issues` |
| Bounded repair | `await repair(generate, schema, maxAttempts)` |

## Questions
type: qa
from: phases/05-nlp-foundations-to-advanced/20-structured-outputs-constrained-decoding/docs/en.md, phases/13-tools-and-protocols/04-structured-output/docs/en.md, projects/json-schema-output-guard/README.md, projects/json-schema-output-guard/stages/04-bounded-repair/docs/en.md

- **Should a refusal trigger a retry?** No. Log it and return a typed refusal.
- **Is constrained decoding slower?** Often faster. Forced tokens skip generation.
- **Does it need a big model?** No. A 3B model with grammar beats a 70B model with prompts.
- **Does acceptance prove the answer?** No. It does not establish factual correctness.
- **Why call checkSchema first?** A broken schema then cannot spend provider budget.

## Tips
type: tips
from: phases/05-nlp-foundations-to-advanced/20-structured-outputs-constrained-decoding/docs/en.md, phases/11-llm-engineering/03-structured-outputs/docs/en.md, projects/json-schema-output-guard/README.md, projects/json-schema-output-guard/stages/04-bounded-repair/docs/en.md

- Local model, flat schema: Outlines. Recursive schema: XGrammar or llguidance.
- Self-hosted server: vLLM `guided_json`, `guided_regex`, `guided_choice`.
- Use tool use when the model must pick one of many schemas.
- Send structured `Issue[]` back to the model, not free text.
- Keep every attempt in the trace. A late success does not hide earlier failures.
- The guard rejects `$ref`, format and combinators.
- In the project commands, `<ws>` is `learning-artifacts/json-schema-output-guard`.

## Pydantic schema with Instructor
type: annotated-code
lang: python
from: phases/05-nlp-foundations-to-advanced/20-structured-outputs-constrained-decoding/docs/en.md

```python
class Invoice(BaseModel):
    vendor: str
    total_usd: float = Field(ge=0)       # numeric bound
    line_items: list[str]

client = instructor.from_anthropic(Anthropic())
invoice = client.messages.create(
    model="claude-opus-4-7",
    max_tokens=1024,
    response_model=Invoice,              # retries on validation failure
    messages=[{"role": "user", "content": "<text>"}],
)
```

## Bounded repair in TypeScript
type: annotated-code
lang: typescript
from: projects/json-schema-output-guard/solution/main.ts

```typescript
const schema: Schema = {
  type: "object",
  properties: {
    answer: { type: "string", minLength: 1 },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["answer", "confidence"],
  additionalProperties: false,         // unknown property is an issue
};
await repair(async (_, i) => outputs[i - 1], schema)  // status and trace
```

## Control levels
type: concepts
from: phases/11-llm-engineering/03-structured-outputs/docs/en.md, phases/05-nlp-foundations-to-advanced/20-structured-outputs-constrained-decoding/docs/en.md, phases/13-tools-and-protocols/04-structured-output/docs/en.md

- **Prompt-based**: "Respond in valid JSON". About 90% valid. No enforcement.
- **JSON mode**: valid JSON syntax. No schema guarantee.
- **Schema mode**: output matches the JSON Schema. Native in every major provider.
- **Constrained decoding**: masks invalid tokens. 100% valid by construction.
- **Instructor**: does not touch logits. It parses, validates and retries.
- **Outlines**: compiles schema or regex to an FSM. Recursion needs flattening.
- **XGrammar, llguidance**: CFG engines. They handle recursive schemas.
- **Strict mode**: all properties in `required`, `additionalProperties: false`, no `$ref`.

## Defaults and numbers
type: defaults
from: phases/11-llm-engineering/03-structured-outputs/docs/en.md, phases/05-nlp-foundations-to-advanced/20-structured-outputs-constrained-decoding/docs/en.md, phases/13-tools-and-protocols/04-structured-output/docs/en.md, projects/json-schema-output-guard/solution/main.ts, projects/json-schema-output-guard/solution/cli.ts

| Setting | Default | Note |
|---|---|---|
| `max_retries` | 3 | In `extract_with_retry` |
| Instructor retries | 3 | On validation failure |
| Retry limit | 3x | More retries point to a bad schema |
| `maxAttempts` | 3 | Budget must be 1..10 |
| Depth limit | 32 | `checkSchema` and `validate` |
| Output size cap | 100_000 | Bytes, checked before `JSON.parse` |
| CLI exit code | 2 | Rejected or exhausted result |
| Prompt-only JSON | 85 to 95 percent | Success rate on frontier models |

## Troubleshooting
type: troubleshooting
from: phases/05-nlp-foundations-to-advanced/20-structured-outputs-constrained-decoding/docs/en.md, phases/11-llm-engineering/03-structured-outputs/docs/en.md, phases/13-tools-and-protocols/04-structured-output/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Valid JSON, wrong answer | `answer` before `reasoning` | Put reasoning fields first |
| Model invents a date | Grammar too strict | Allow `null` or a sentinel |
| 10,000-option enum times out | Huge enum | Retrieve top-k, constrain to those |
| Tree output fails in Outlines | FSM flattens recursion | Use XGrammar or llguidance |
| Valid JSON, wrong shape | JSON mode without a schema | Always send a full schema |
| API returns 400 | Strict mode rule broken | Fix `required`, extras, `$ref` |
| Right type, invented value | Hallucinated value | Schema cannot catch it. Check values |
| Optional field left out | Field not required | Make it required, allow `null` |

## Abbreviations
type: glossary
from: phases/05-nlp-foundations-to-advanced/20-structured-outputs-constrained-decoding/docs/en.md, phases/13-tools-and-protocols/04-structured-output/docs/en.md, projects/json-schema-output-guard/solution/main.ts

- **FSM**: finite-state machine. $O(1)$ valid-next-token lookup.
- **CFG**: context-free grammar. Handles recursion.
- **Logit processor**: `(logits, state) -> masked_logits`.
- **Guided decoding**: the same idea inside an inference server.
- **Refusal**: a typed outcome when the input cannot fit the schema.
- **Parse error**: output is not JSON. Impossible under strict mode.
- **Schema violation**: output parses but breaks the schema.
- **Issue**: `{ path: string; message: string }` in the guard project.
