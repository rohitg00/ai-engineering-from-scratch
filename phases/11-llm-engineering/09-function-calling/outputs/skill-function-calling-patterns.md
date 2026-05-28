---
name: skill-function-calling-patterns
description: production で function calling を実装するための decision framework -- tool design、error handling、security、provider patterns
version: 1.0.0
phase: 11
lesson: 09
tags: [function-calling, tool-use, agents, mcp, security, openai, anthropic]
---

# Function Calling Patterns

tools を使う LLM application を構築するときは、この decision framework を適用してください。

## Function calling を使うべき場合

**Function calling を使う場合:**
- model が real-time data を必要とする (weather、stock prices、database queries)
- task が side effects を必要とする (email 送信、record 作成、code deploy)
- model が user intent に基づいて複数 actions から選ぶ必要がある
- external systems とやり取りする agent を構築している

**代わりに structured outputs を使う場合:**
- text からの data extraction が必要で、external call が不要
- output が final product であり intermediate step ではない
- 複数 tools から選ぶのではなく、single schema がある

**両方を使う場合:**
- model が tool を呼び、その tool result を specific output format に構造化する

## Tool design guidelines

1. **1 tool、1 action。** query、insert、update、delete をすべて扱う `manage_database` という tool は広すぎます。`query_records`、`insert_record`、`update_record` に分けます。specific tools の方が model はうまく選択します。

2. **Descriptions は prompts。** model は tool descriptions を読んで選択を決めます。junior developer に指示を書くように書いてください。何をするかだけでなく、何を返すかを含めます。

3. **enums で制約する。** parameter に 3-10 個の valid values があるなら enum を使います。制約しないと model は "celsius"、"Celsius"、"C"、"metric" のような strings を発明します。

4. **tools は少ない方がよい。** GPT-4o は 5-10 tools をうまく扱います。20+ tools では selection accuracy が下がります。50+ tools では 10-15% の wrong tool selection を見込むべきです。related functionality を group 化するか routing layer を使います。

5. **Required は本当に required。** tool が文字通りそれなしで動かない場合だけ required にします。良い defaults を持つ optional parameters は tool call failures を減らします。

## Provider-specific patterns

### OpenAI (GPT-4o, o3, GPT-4o-mini)

```python
tools=[{"type": "function", "function": {"name": ..., "parameters": ...}}]
tool_choice="auto"       # model decides
tool_choice="required"   # must call at least one tool
tool_choice={"type": "function", "function": {"name": "specific_tool"}}
```

- parallel tool calls を support (1 response に複数の `tool_calls`)
- tool call IDs は results と一緒に戻す必要がある
- `gpt-4o-mini` は 10x 安く、simple tool routing をうまく扱う
- structured outputs mode は tool parameters と組み合わせて schema compliance を保証できる

### Anthropic (Claude 3.5 Sonnet, Claude 4 Opus)

```python
tools=[{"name": ..., "description": ..., "input_schema": ...}]
tool_choice={"type": "auto"}     # model decides
tool_choice={"type": "any"}      # must call at least one tool
tool_choice={"type": "tool", "name": "specific_tool"}
```

- tool calls は `type: "tool_use"` の content blocks として現れる
- results は `type: "tool_result"` の user messages に入れる
- field name は `parameters` ではなく `input_schema` (よくある migration bug)
- response ごとに multiple tool calls を support

### Google (Gemini 2.0 Flash, Gemini 2.0 Pro)

```python
function_declarations=[{"name": ..., "description": ..., "parameters": ...}]
function_calling_config={"mode": "AUTO"}   # or "ANY" or "NONE"
```

- top level で `function_declarations` を使う
- results は `function_response` parts 経由で返る
- parallel function calling を support

### Open-source models (Llama 3, Hermes, Qwen)

- standardized format はない。model と serving framework により異なる
- Hermes format (NousResearch) が最も一般的な fine-tuned convention
- vLLM は supported models で OpenAI-compatible tool calling を support
- Ollama は compatible models で basic tool calling を support
- production 前に tool selection accuracy を test する。Berkeley Function Calling Leaderboard では open models は GPT-4o より 15-30% accuracy が低い

## Error handling patterns

### Structured errors を返す

```json
{"error": true, "message": "City 'Toky' not found. Did you mean 'Tokyo'?", "code": "NOT_FOUND", "suggestions": ["Tokyo"]}
```

actionable information を含めます。"Not found" は悪い例です。"Not found, did you mean X?" は良い例です。model は error messages を使って self-correct します。

### Retry strategy

1. tool call が correctable error で失敗する (typo、wrong enum value)
2. error を tool result として model に戻す
3. model が調整して retry する
4. tool call ごとの retry は最大 3 回
5. 3 回失敗したら error を user に返す

### Timeout handling

すべての tool execution に timeout を設定します。30 秒は妥当な default です。tool が timeout したら structured timeout error を返し、model が hang するのではなく user に伝えられるようにします。

## Security checklist

| Check | 理由 | 方法 |
|-------|-----|-----|
| Allowlist functions | arbitrary code execution を防ぐ | user に必要な tools だけ register する |
| Validate argument types | type confusion attacks を防ぐ | execution 前に types を check する |
| Sanitize string arguments | injection を防ぐ | special characters を reject または escape する |
| Parameterize database queries | SQL injection を防ぐ | model-generated SQL を直接渡さない |
| Filter tool results | data leakage を防ぐ | API keys、PII、internal errors を削除する |
| Rate limit tool calls | runaway loops を防ぐ | conversation ごとに最大 10-20 calls |
| Log all tool calls | audit trail | tool name、arguments、result、timestamp を保存する |
| Block path traversal | file system access を防ぐ | file tools で `..` と absolute paths を reject する |
| Sandbox code execution | system access を防ぐ | containers または restricted builtins を使う |
| Validate return size | context stuffing を防ぐ | 10KB 超の results を truncate する |

## Performance optimization

- **Parallel calls:** model が multiple independent tools を要求したら、`asyncio.gather()` または `concurrent.futures` で concurrent に実行する
- **Caching:** same session 内で identical arguments の tool results を cache する (weather は 60 秒では変わらない)
- **Streaming:** tool results を取得している間に model の final response を stream する
- **Tool pruning:** context が厳しい場合、current query に関係する tool definitions だけを含める (classifier で filter)
- **Smaller models for routing:** tool selection には `gpt-4o-mini` や `claude-3-5-haiku` を使い、results を stronger model に渡して synthesis する

## Common failure patterns

| Failure | Cause | Fix |
|---------|-------|-----|
| Wrong tool selected | Ambiguous descriptions | specific trigger words で descriptions を書き直す |
| Missing required args | model が parameter を忘れた | parameter descriptions に明確な examples を追加する |
| Infinite tool loop | model が同じ tool を呼び続ける | max iterations (5-10) を設定し repeated calls を検出する |
| Hallucinated arguments | model が plausible だが wrong values を発明する | enums を使い、known values に対して validate する |
| Tool result too large | API が 100KB の data を返した | model に戻す前に truncate または summarize する |
| Model ignores tool result | result format が confusing | clear field names を持つ clean JSON を返す |
