---
id: error-paths-the-model-can-fix
title: Read the registry, what the model gets back on a bad call
card: agents
kind: code-reading
level: 2
roles: [agentic-ai-engineer, ai-developer-relations-engineer]
rounds: [coding, screen]
tags: [tool-registry, json-schema, validation, json-pointer, self-correction]
minutes: 10
lessons: [phases/19-capstone-projects/21-tool-registry-schema-validation]
manuals: []
practice: [tool-call-parser]
cheatsheet: [tool-calling]
related: [agents/five-parts-of-an-agent-loop]
updated: 2026-11-03
---

A tool is registered with this schema, and the model sends the four argument sets below. For each one, say what the registry returns and why the shape of the answer matters to the model.

```python
registry.register(
    name="db.get_user",
    schema={
        "type": "object",
        "required": ["id"],
        "properties": {
            "id": {"type": "integer"},
            "fields": {"type": "array", "items": {"type": "string", "enum": ["id", "name", "email"]}},
        },
    },
    handler=get_user,
)
cases = [
    {"id": 42, "fields": ["id", "name"]},
    {"id": "forty-two"},
    {"fields": ["id"]},
    {"id": 1, "fields": ["id", "phone"]},
]
```

## Short answer

The first case passes validation and returns an Ok result. The second returns one error at `/id` with keyword `type`, because a string is not an integer and the validator never coerces. The third returns one error at `/id` with keyword `required`, because the property is missing. The fourth returns one error at `/fields/1` with keyword `enum`, because `phone` is not an allowed value, and the path points at the exact element so the model can fix that one value in the next call.

## Full answer

### The walk

The validator dispatches on `type`. For an object it checks `required` first, then walks each property that has a schema. For an array it walks each element with the `items` schema and appends the index to the path. A type mismatch stops the walk at that node and reports one error, so a wrong type does not produce a cascade of nested errors underneath it.

| Case | Result | Path | Keyword |
|---|---|---|---|
| `{"id": 42, "fields": ["id", "name"]}` | `Ok` | | |
| `{"id": "forty-two"}` | one error | `/id` | `type` |
| `{"fields": ["id"]}` | one error | `/id` | `required` |
| `{"id": 1, "fields": ["id", "phone"]}` | one error | `/fields/1` | `enum` |

### Why the path is the product

The model reads a pointer better than a sentence. An error that says the email field expected a string, with the path `/user/email`, is fixed in one round trip. A prose message that says the arguments were invalid costs a turn of guessing. Paths follow the JSON pointer form: slash-separated property names and array indices, with `~` and `/` escaped inside a segment.

### What the validator refuses to do

- It does not coerce. The string `"42"` fails an integer or number schema. A model that learns that strings are accepted sends strings everywhere.
- It does not call the handler. The schema is data and the handler is code, and mixing them puts validation inside handlers where it drifts.
- It is not a security boundary. A handler can misbehave after validation passes. The dispatcher adds timeouts and sandboxing. The registry adds shape.

### Registration hygiene

`register` rejects a name that is already in the table unless the caller passes `override=True`. Two parts of a codebase registering the same name is a bug that takes a week to find in production, so the default is to raise.

## Follow-ups

- **Level 2:** The model sends `{"id": true}`. What happens? Expected: a type error at `/id`, because the validator treats a boolean as not an integer even though the language would accept it.
- **Level 2:** Why does a type mismatch stop the walk at that node? Expected: the children have no meaning when the parent is the wrong type, and one clear error beats a list of errors caused by the same mistake.
- **Level 3:** The schema uses `oneOf`. What does `register` do? Expected: it raises, because the registry supports eight keywords and rejects anything outside the subset at registration time.
- **Level 3:** The catalog passes fifty tools and schemas start to repeat. What two extensions do you add first? Expected: `$ref` against a local definitions block, and `additionalProperties: false` for a strict shape.

## Wrong answers

- "Return one message that says invalid arguments and let the model retry." A retry without a path is a guess, and a path fixes the call in one round trip.
- "Coerce the string to a number, because the intent is clear." Coercion teaches the model that the schema is advice, and the next call sends a string where no coercion exists.
- "Validation makes the tool safe to call." Validation checks shape, and the handler can still misbehave, so timeouts and sandboxing belong in the dispatcher.

## Taught in

The [tool registry lesson](../../../phases/19-capstone-projects/21-tool-registry-schema-validation/) builds the registry, the eight-keyword validator and the pointer paths.
