---
id: guardrails-moderation
title: Guardrails, Moderation and Redaction
code: GM
subtitle: Check input and output, route classifier verdicts, redact spans and gate tool calls. Python and Rust from the lessons.
hue: 350
sources: phases/11-llm-engineering/12-guardrails, phases/15-autonomous-systems/18-llama-guard, phases/18-ethics-safety-alignment/29-moderation-systems-openai-perspective-llamaguard, phases/19-capstone-projects/85-content-classifier-integration, projects/sensitive-text-redaction-gate, projects/tool-call-firewall
source_hash: 085673fb0fa20fef
---

## Guardrail checks
type: task-table
span: 2
from: phases/11-llm-engineering/12-guardrails/code/guardrails.py

| Task | Code |
|---|---|
| Find injection patterns | `detect_injection(text)` |
| Find PII in input | `detect_pii(text)` |
| Cap prompt size | `check_length(text, max_chars=5000, max_words=1000)` |
| Block toxic output | `filter_toxicity(text)` |
| Redact PII in output | `scrubbed, result = scrub_pii_from_output(text)` |
| Check that output answers input | `check_relevance(input_text, output_text, threshold=0.15)` |
| Catch system prompt echo | `check_system_prompt_leak(output_text, system_prompt, threshold=0.4)` |
| Run all checks around a model | `pipeline.process(attack)` |

## The filter stack
type: flow
from: phases/11-llm-engineering/12-guardrails/docs/en.md

1. **Length check**: reject input over 5000 chars. Length checks are free.
2. **Rate limit**: allow 10 req/min for each user.
3. **Topic classifier**: reject off-topic input before the model.
4. **PII detector**: redact or reject personal data.
5. **Injection detector**: classifiers cost 5-20ms.
6. **LLM**: the call costs 200-2000ms.
7. **Toxicity filter**: classify every output.
8. **PII scrubber and relevance check**: redact, then check the answer fits the question.

## Moderation API call
type: annotated-code
lang: python
from: phases/11-llm-engineering/12-guardrails/docs/en.md, phases/18-ethics-safety-alignment/29-moderation-systems-openai-perspective-llamaguard/docs/en.md

```python
from openai import OpenAI
client = OpenAI()
response = client.moderations.create(
    model="omni-moderation-latest",  # text and images in one call
    input="<text>",
)
result = response.results[0]
print(result.flagged)  # True when a category fires
```

## Thresholds in the code
type: defaults
from: phases/11-llm-engineering/12-guardrails/code/guardrails.py, phases/18-ethics-safety-alignment/29-moderation-systems-openai-perspective-llamaguard/code/main.py, phases/19-capstone-projects/85-content-classifier-integration/code/classifiers.py

| Setting | Default | Note |
|---|---|---|
| `check_length` `max_chars` | 5000 | Also `max_words` 1000 |
| `detect_injection` block at | 0.75 | Max pattern confidence |
| `filter_toxicity` block at | 0.80 | Max category confidence |
| `check_relevance` `threshold` | 0.15 | Pass at or above |
| `check_system_prompt_leak` `threshold` | 0.4 | Pass below |
| `input_moderator` `threshold` | 0.5 | Same for `output_moderator` |
| `InstructionLeakageClassifier` `threshold` | 0.55 | Trigram cosine |
| `_NEGATION_WINDOW` | 20 | Chars checked for not, never, no |

## Moderation systems side by side
type: comparison
from: phases/18-ethics-safety-alignment/29-moderation-systems-openai-perspective-llamaguard/docs/en.md, phases/15-autonomous-systems/18-llama-guard/docs/en.md, phases/11-llm-engineering/12-guardrails/docs/en.md

| Factor | OpenAI Moderation | Llama Guard | Perspective API |
|---|---|---|---|
| Model | `omni-moderation-latest`, GPT-4o | Llama-3.1-8B base (v3) | Pre-LLM toxicity scoring |
| Categories | 13 booleans | S1 to S14 in v4 | TOXICITY and 5 variants |
| Input | Text and images | v4: image and text | Text |
| Languages | 42% better multilingual | 8 languages (v3) | Not stated |
| Cost | Free for most developers | Open weights | Research baseline |
| Use it when | You want a hosted API | You self-host, S14 code abuse | You compare to research |

## Severity rules
type: concepts
from: phases/19-capstone-projects/85-content-classifier-integration/docs/en.md, phases/19-capstone-projects/85-content-classifier-integration/code/classifiers.py

- **high**: block. Drop the output and return a policy refusal.
- **medium**: redact. Apply each classifier redactor.
- **low**: warn. Log and append a soft notice.
- **none**: log. Ship the output as is.
- **Max wins**: redact plus warn gives redact.
- **pii**: ssn or card is high. Three findings or an email is medium.
- **instruction-leakage**: 0.85 high, 0.70 medium, 0.55 low.
- **toxicity**: 3 hits high, 2 medium, 1 low.

## Output router
type: architecture
from: phases/19-capstone-projects/85-content-classifier-integration/docs/en.md, phases/19-capstone-projects/85-content-classifier-integration/code/main.py

```arch
node | out | 1,2 | Model output | | model
node | tox | 2,1 | toxicity | slur and harassment | process
node | pii | 2,2 | pii | email, phone, ssn, card, ip | process
node | leak | 2,3 | instruction-leakage | trigram overlap | process
node | router | 3,2 | Router | max severity | process
node | act | 4,2 | Action | block, redact, warn, log | store
edge | out | tox |
edge | out | pii |
edge | out | leak |
edge | tox | router | verdict
edge | pii | router | verdict
edge | leak | router | verdict
edge | router | act |
```

## Troubleshooting
type: troubleshooting
from: phases/15-autonomous-systems/18-llama-guard/docs/en.md, phases/15-autonomous-systems/18-llama-guard/code/main.py, phases/18-ethics-safety-alignment/29-moderation-systems-openai-perspective-llamaguard/docs/en.md, phases/19-capstone-projects/85-content-classifier-integration/docs/en.md, projects/sensitive-text-redaction-gate/API.md

| Symptom | Cause | Fix |
|---|---|---|
| Emoji smuggled request passes | Tokenizer coalesces emoji differently | Add a normalization step |
| Cyrillic lookalike letters pass | Classifier trained on English | `normalize(text)`: NFKC, homoglyph map |
| Encoding attack gets through | Input moderation only | Add output moderation |
| Every input reaches the model | Output moderation only | Add input moderation |
| "you are not a slur" trips the rule | No negation check | Negation window before the match |
| Rest of a large span shows | Small nested match removed | Merge intersecting spans to one union |

## Tool call firewall
type: flow
from: projects/tool-call-firewall/solution/stage1.rs, projects/tool-call-firewall/solution/stage2.rs, projects/tool-call-firewall/solution/stage3.rs, projects/tool-call-firewall/solution/stage4.rs, projects/tool-call-firewall/README.md

1. **call**: `call(line, max_bytes)` splits `id|role|tool|argument` and rejects control characters.
2. **decide**: `read` is `Allow`. Editor `write` is `ApprovalRequired`. Other roles are `Deny`.
3. **authorize**: the approval must equal the full call and be unused, else `Error::Conflict`.
4. **dispatch**: the target must be an existing contained file. Content is 16384 bytes at most.
5. **audit**: one tab row per request id. A repeated id is `Error::Conflict`.

## Redaction gate API
type: task-table
from: projects/sensitive-text-redaction-gate/API.md, projects/sensitive-text-redaction-gate/solution/main.py

| Task | Code |
|---|---|
| Find EMAIL, IPV4, LITERAL spans | `detect(text, literals=())` |
| Join intersecting spans | `merge_spans(spans, text_length)` |
| Replace with `[REDACTED]` | `redact(text, literals=())` |
| Check up to 10000 records | `process(records, literals=())` |
| Render the offset ledger | `render_html(report)` |

## Run the projects
type: command-table
span: 2
from: projects/sensitive-text-redaction-gate/README.md, projects/tool-call-firewall/README.md

| Command | What it does |
|---|---|
| `python3 scripts/project_test.py <project> --init learning-artifacts/<project>` | Makes a learner workspace |
| `python3 scripts/project_test.py <project> --all --solution --strict` | Tests the reference |
| `python3 cli.py samples/input.jsonl --literals samples/literals.json --output demo-output` | Writes redacted.jsonl, receipt.json and review.html |
| `rustc --edition=2021 <dir>/cli.rs -o <dir>/firewall` | Builds the firewall CLI |
| `<dir>/firewall <root> reader r1 read notes.md` | Reads a file through the gate |

## Q&A
type: qa
from: phases/11-llm-engineering/12-guardrails/docs/en.md, phases/15-autonomous-systems/18-llama-guard/docs/en.md, projects/sensitive-text-redaction-gate/API.md, projects/tool-call-firewall/README.md, phases/19-capstone-projects/85-content-classifier-integration/docs/en.md

- **Why check input and output?** Attackers find ways around each layer alone.
- **Is a guard classifier enough?** No. Emoji Smuggling hit 100% ASR on six guard systems.
- **Who supplies the role?** The caller application. The model supplies only the operation.
- **Output checks add latency?** Run them in parallel with token streaming. Buffer the final chunk.
