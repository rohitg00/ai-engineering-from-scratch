An agent sends tool schemas to a model and gets tool calls back. The arguments in a reply can have the wrong types, missing fields or extra keys. Before the agent runs a tool, it must parse each call and validate its arguments. Errors with exact paths let the model fix the call in one more turn.

## Task

Write three functions. Use the standard library `json` module only.

1. `parse_tool_calls(reply_text)` parses the raw JSON body of a chat completion reply. The calls are in `body["choices"][0]["message"]["tool_calls"]`. Each call has an `id` and a `function` with a `name` and an `arguments` field. The `arguments` field is a JSON string, not an object. Return one dict `{"id": ..., "name": ..., "arguments": ...}` for each call, in reply order, where `arguments` is the decoded dict.
   - If `tool_calls` is missing or `null`, return `[]`.
   - If `arguments` is an empty or blank string, the arguments are `{}`.
   - If `arguments` is not valid JSON, or does not decode to a JSON object, raise `ValueError`.
2. `validate_args(schema, args)` checks a value against a JSON Schema subset and returns a list of error strings. An empty list means the value is valid.
3. `check_reply(reply_text, schemas)` parses the reply and returns one pair `(id, errors)` for each call, in reply order. `schemas` maps a tool name to its schema. For a name that is not in `schemas`, the errors are `["/: unknown tool <name>"]`.

The schema subset has these keywords: `type`, `properties`, `required`, `enum`, `additionalProperties` and `items`. A type is one of `object`, `array`, `string`, `integer`, `number`, `boolean` and `null`. The JSON type of a Python value is:

| Python value | JSON type |
|---|---|
| `None` | `null` |
| `True`, `False` | `boolean` |
| `int` | `integer` |
| `float` | `number` |
| `str` | `string` |
| `list` | `array` |
| `dict` | `object` |

The type `integer` matches the JSON type `integer` only, so `1.0` does not match. The type `number` matches `integer` and `number`. A boolean never matches `integer` or `number`.

Check one value at a path with these steps, in this order:

1. If the schema has `type` and the value does not match it, add `<path>: expected <type>, got <json type>`. Stop. Do not check the children.
2. If the schema has `enum` and the value is not in the list (Python `==`), add `<path>: value <json.dumps(value)> is not in <json.dumps(enum)>`. Stop.
3. If the type is `object`:
   1. For each name in `required`, in list order, that is not a key of the value, add `<path>/<name>: missing required property`.
   2. Then for each key of the value, in its input order: if the key is in `properties`, check the child value at `<path>/<key>`. Else, if `additionalProperties` is `false`, add `<path>/<key>: unexpected property`. Without `additionalProperties: false`, extra keys are allowed.
4. If the type is `array` and the schema has `items`, check each element at `<path>/<index>`, in index order.

A path is a JSON pointer. The root value has the path `/`. A child path is the parent path, a slash and the segment. The child of the root `/` with key `city` is `/city`. In a segment, replace `~` with `~0` first, then replace `/` with `~1`.

## Input and output

| Name | Type | Meaning |
|---|---|---|
| `reply_text` | `str` | the raw JSON body of one reply |
| `schema` | `dict` | a schema in the subset above |
| `args` | any JSON value | the value to check, usually a dict |
| `schemas` | `dict` | a map from tool name to schema |

- `parse_tool_calls` returns a `list` of `dict`.
- `validate_args` returns a `list` of `str`.
- `check_reply` returns a `list` of `(str, list of str)` tuples.

## Constraints

- Schemas nest at most 5 levels deep.
- Do not change the schema or the arguments.
- Use the standard library only.

## Examples

```python
REPLY = '{"choices": [{"message": {"role": "assistant", "content": null, "tool_calls": [{"id": "call_abc123", "type": "function", "function": {"name": "get_weather", "arguments": "{\\"city\\":\\"Bengaluru\\",\\"units\\":\\"celsius\\"}"}}, {"id": "call_def456", "type": "function", "function": {"name": "get_weather", "arguments": "{\\"city\\":42,\\"units\\":\\"kelvin\\",\\"days\\":3}"}}]}, "finish_reason": "tool_calls"}]}'
WEATHER = {
    "type": "object",
    "properties": {
        "city": {"type": "string"},
        "units": {"type": "string", "enum": ["celsius", "fahrenheit"]},
    },
    "required": ["city", "units"],
    "additionalProperties": False,
}
parse_tool_calls(REPLY)
```

```text
[{'id': 'call_abc123', 'name': 'get_weather', 'arguments': {'city': 'Bengaluru', 'units': 'celsius'}}, {'id': 'call_def456', 'name': 'get_weather', 'arguments': {'city': 42, 'units': 'kelvin', 'days': 3}}]
```

```python
check_reply(REPLY, {"get_weather": WEATHER})
```

```text
[('call_abc123', []), ('call_def456', ['/city: expected string, got integer', '/units: value "kelvin" is not in ["celsius", "fahrenheit"]', '/days: unexpected property'])]
```

```python
USER = {
    "type": "object",
    "required": ["id", "tags"],
    "properties": {
        "id": {"type": "integer"},
        "tags": {"type": "array", "items": {"type": "string", "enum": ["a", "b"]}},
        "score": {"type": "number"},
        "active": {"type": "boolean"},
    },
    "additionalProperties": False,
}
validate_args(USER, {"id": True, "tags": ["a", "c", 3], "score": 1, "extra/x": 1, "active": 1})
```

```text
['/id: expected integer, got boolean', '/tags/1: value "c" is not in ["a", "b"]', '/tags/2: expected string, got integer', '/extra~1x: unexpected property', '/active: expected boolean, got integer']
```
