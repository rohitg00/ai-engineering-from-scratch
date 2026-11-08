import json


def parse_tool_calls(reply_text):
    body = json.loads(reply_text)
    message = body["choices"][0]["message"]
    calls = []
    for tc in message.get("tool_calls") or []:
        fn = tc["function"]
        raw = fn.get("arguments") or ""
        args = json.loads(raw) if raw.strip() else {}
        if not isinstance(args, dict):
            raise ValueError(f"arguments of call {tc['id']} must be a JSON object")
        calls.append({"id": tc["id"], "name": fn["name"], "arguments": args})
    return calls


def json_type(value):
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, int):
        return "integer"
    if isinstance(value, float):
        return "number"
    if isinstance(value, str):
        return "string"
    if isinstance(value, list):
        return "array"
    return "object"


def type_matches(value, expected):
    actual = json_type(value)
    if expected == "number":
        return actual in ("integer", "number")
    return actual == expected


def child_path(path, segment):
    seg = str(segment).replace("~", "~0").replace("/", "~1")
    return f"{path}/{seg}"


def walk(schema, value, path, errors):
    shown = path or "/"
    expected = schema.get("type")
    if expected is not None and not type_matches(value, expected):
        errors.append(f"{shown}: expected {expected}, got {json_type(value)}")
        return
    if "enum" in schema and value not in schema["enum"]:
        errors.append(f"{shown}: value {json.dumps(value)} is not in {json.dumps(schema['enum'])}")
        return
    if expected == "object":
        for name in schema.get("required", []):
            if name not in value:
                errors.append(f"{child_path(path, name)}: missing required property")
        props = schema.get("properties", {})
        for key, item in value.items():
            if key in props:
                walk(props[key], item, child_path(path, key), errors)
            elif not schema.get("additionalProperties", False):
                errors.append(f"{child_path(path, key)}: unexpected property")
    elif expected == "array" and "items" in schema:
        for index, item in enumerate(value):
            walk(schema["items"], item, child_path(path, index), errors)


def validate_args(schema, args):
    errors = []
    walk(schema, args, "", errors)
    return errors


def check_reply(reply_text, schemas):
    results = []
    for call in parse_tool_calls(reply_text):
        if call["name"] not in schemas:
            results.append((call["id"], [f"/: unknown tool {call['name']}"]))
        else:
            results.append((call["id"], validate_args(schemas[call["name"]], call["arguments"])))
    return results
