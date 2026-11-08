# Evidence: cheatsheets/guardrails-moderation.md

Abbreviations: G = phases/11-llm-engineering/12-guardrails, LG = phases/15-autonomous-systems/18-llama-guard, MS = phases/18-ethics-safety-alignment/29-moderation-systems-openai-perspective-llamaguard, CC = phases/19-capstone-projects/85-content-classifier-integration, RG = projects/sensitive-text-redaction-gate, TF = projects/tool-call-firewall. d = docs/en.md.

## Guardrail checks (task-table, 8)
- detect_injection(text): G/code/guardrails.py:80
- detect_pii(text): G/code/guardrails.py:112
- check_length(text, max_chars=5000, max_words=1000): G/code/guardrails.py:157
- filter_toxicity(text): G/code/guardrails.py:173
- scrub_pii_from_output returns scrubbed text and result: G/code/guardrails.py:194, 221, 305
- check_relevance(input_text, output_text, threshold=0.15): G/code/guardrails.py:230
- check_system_prompt_leak(output_text, system_prompt, threshold=0.4): G/code/guardrails.py:263
- pipeline.process(attack): G/code/guardrails.py:523

## The filter stack (flow, 8)
1. Length check < 5000 chars, length checks are free: G/d:104, 116
2. Rate limit 10 req/min per user: G/d:105, 82
3. Topic classifier rejects off-topic before the model: G/d:106, 76
4. PII detector, redact or reject: G/d:107, 80
5. Injection detector, classifiers cost 5-20ms: G/d:108, 116
6. LLM call costs 200-2000ms: G/d:109, 116
7. Toxicity filter, run every output: G/d:110, 90
8. PII scrubber, relevance check: G/d:111-112

## Moderation API call (annotated-code, 8 lines)
- OpenAI(), client.moderations.create, model omni-moderation-latest, input: G/d:758-763
- response.results[0], result.flagged: G/d:765-766
- text and images in one call: MS/d:25, G/d:773
- True when a category fires: MS/d:27 (category booleans)

## Thresholds in the code (defaults, 8)
- check_length max_chars 5000, max_words 1000: G/code/guardrails.py:157
- detect_injection blocks at 0.75: G/code/guardrails.py:104
- filter_toxicity blocks at 0.80: G/code/guardrails.py:186
- check_relevance threshold 0.15, pass at or above: G/code/guardrails.py:230, 255
- check_system_prompt_leak threshold 0.4, pass below: G/code/guardrails.py:263, 278
- input_moderator and output_moderator threshold 0.5: MS/code/main.py:44, 50
- InstructionLeakageClassifier threshold 0.55: CC/code/classifiers.py:179
- _NEGATION_WINDOW 20, not|never|no: CC/code/classifiers.py:45, 58

## Moderation systems side by side (comparison, 6 rows)
- omni-moderation-latest, GPT-4o: MS/d:25. Llama-3.1-8B base: LG/d:22. Perspective pre-LLM: MS/d:49
- 13 booleans: MS/d:27. S1 to S14 in v4: LG/d:34. TOXICITY plus 5 variants: MS/d:49
- text and images: MS/d:25. v4 image and text: LG/d:33. Perspective text scoring: MS/d:49
- 42% better multilingual: MS/d:39. 8 languages v3: LG/d:26
- free for most developers: MS/d:25. open weights: LG/d:14. research baseline: MS/d:51
- hosted API: G/d:132. self-hosted: G/d:133. S14 code abuse: LG/d:34-37. research use: MS/d:51

## Output router (architecture, 6 nodes, 7 edges)
- model output feeds toxicity, pii, instruction-leakage, then router: CC/d:31-36
- toxicity slur and harassment: CC/d:16
- pii email, phone, ssn, card, ip: CC/d:16
- instruction-leakage trigram overlap: CC/d:16
- router max severity: CC/d:43
- actions block, redact, warn, log: CC/d:24-27

## Severity rules (concepts, 8)
- high block, policy refusal: CC/d:24
- medium redact per classifier: CC/d:25
- low warn, soft notice: CC/d:26
- none log, ship as is: CC/d:27
- max wins, redact plus warn gives redact: CC/d:43
- pii ssn or card high, 3 findings or email medium: CC/code/classifiers.py:127-130
- leakage 0.85 high, 0.70 medium, 0.55 low: CC/code/classifiers.py:179, 186-191
- toxicity 3 hits high, 2 medium, 1 low: CC/code/classifiers.py:71-76

## Troubleshooting (troubleshooting, 6)
- emoji smuggling, tokenizer coalesces differently, add normalization step: LG/d:51, 100
- homoglyph Cyrillic, classifier trained on English: LG/d:53. normalize(text) NFKC then homoglyph map: LG/code/main.py:58-65
- input only misses encoding attacks: MS/d:63
- output only lets any input reach the model: MS/d:64
- negation window: CC/d:47
- nested match exposes remainder, intersecting spans become one union: RG/API.md:21

## Tool call firewall (flow, 5)
1. call(line, max_bytes), control character, id|role|tool|argument: TF/solution/stage1.rs:2-11
2. read Allow, editor write ApprovalRequired, other roles Deny: TF/solution/stage2.rs:3-4, 14-17
3. approval must equal call and be unused, else Error::Conflict: TF/solution/stage3.rs:6-11
4. existing contained file, 16384 bytes: TF/solution/stage3.rs:39-45, 70
5. audit tab row, repeated id Error::Conflict: TF/solution/stage4.rs:11-15

## Redaction gate API (task-table, 5)
- detect(text, literals=()), EMAIL, IPV4, LITERAL: RG/API.md:8, 11, RG/solution/main.py:13
- merge_spans(spans, text_length), intersecting spans: RG/API.md:18, 21
- redact(text, literals=()), [REDACTED]: RG/API.md:28, 31
- process(records, literals=()), 10000 records: RG/API.md:38, 41, RG/solution/main.py:99-100
- render_html(report), offset ledger: RG/API.md:38, 41

## Run the projects (command-table, 5)
- --init learning-artifacts/<project>: RG/README.md:12, TF/README.md:14
- --all --solution --strict: RG/README.md:27, TF/README.md:41
- cli.py samples/input.jsonl --literals samples/literals.json --output demo-output, writes redacted.jsonl, receipt.json, review.html: RG/README.md:29, 38
- rustc --edition=2021 cli.rs -o firewall: TF/README.md:30
- firewall <root> reader r1 read notes.md: TF/README.md:31

## Q&A (qa, 4)
- check both input and output, attackers find ways around each layer: G/d:52
- Emoji Smuggling 100% ASR on six guard systems: LG/d:51
- caller application supplies identity, model supplies only the operation: TF/README.md:5
- run output classifiers in parallel with token streaming, buffer final chunk: CC/d:14
