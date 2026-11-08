import json

import numpy as np

from practice_check import check, equal, fixture, fixtures, raises, true

WEATHER = {
    "type": "object",
    "properties": {
        "city": {"type": "string"},
        "units": {"type": "string", "enum": ["celsius", "fahrenheit"]},
    },
    "required": ["city", "units"],
    "additionalProperties": False,
}

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

ORDER = {
    "type": "object",
    "required": ["customer", "lines"],
    "properties": {
        "customer": {
            "type": "object",
            "required": ["name"],
            "properties": {"name": {"type": "string"}, "vip": {"type": "boolean"}},
            "additionalProperties": False,
        },
        "lines": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["sku", "qty"],
                "properties": {"sku": {"type": "string"}, "qty": {"type": "integer"}, "note": {"type": "string"}},
            },
        },
        "priority": {"type": "string", "enum": ["low", "high"]},
    },
    "additionalProperties": False,
}


def clone(value):
    return json.loads(json.dumps(value))


def reply(calls, content=None):
    message = {"role": "assistant", "content": content}
    if calls is not None:
        message["tool_calls"] = [{"id": cid, "type": "function", "function": {"name": name, "arguments": args}} for cid, name, args in calls]
    return json.dumps({"choices": [{"message": message, "finish_reason": "tool_calls"}]})


REPLY = reply([
    ("call_abc123", "get_weather", "{\"city\":\"Bengaluru\",\"units\":\"celsius\"}"),
    ("call_def456", "get_weather", "{\"city\":42,\"units\":\"kelvin\",\"days\":3}"),
])


def errors_of(sub, schema, args, what):
    result = sub.validate_args(schema, args)
    true(isinstance(result, list) and all(isinstance(e, str) for e in result), f"validate_args must return a list of strings for {what}", "a list of str", result)
    return result


@check("examples", "parse a reply with two tool calls", "Decode the reply body with json.loads. Each arguments field is a JSON string, so decode it a second time.")
def example_parse(sub):
    equal(sub.parse_tool_calls(REPLY), [
        {"id": "call_abc123", "name": "get_weather", "arguments": {"city": "Bengaluru", "units": "celsius"}},
        {"id": "call_def456", "name": "get_weather", "arguments": {"city": 42, "units": "kelvin", "days": 3}},
    ], what="the parsed calls")


@check("examples", "check every call of the reply", "check_reply validates each call against the schema of its tool and keeps the order of the calls.")
def example_check_reply(sub):
    equal(sub.check_reply(REPLY, {"get_weather": WEATHER}), [
        ("call_abc123", []),
        ("call_def456", ["/city: expected string, got integer", "/units: value \"kelvin\" is not in [\"celsius\", \"fahrenheit\"]", "/days: unexpected property"]),
    ], what="the result of check_reply")


@check("examples", "errors for a bad user record", "true is a boolean, not an integer. Array items get the index in the path. A slash in a key becomes ~1 in the path.")
def example_user(sub):
    args = {"id": True, "tags": ["a", "c", 3], "score": 1, "extra/x": 1, "active": 1}
    equal(errors_of(sub, USER, args, "the user record"), [
        "/id: expected integer, got boolean",
        "/tags/1: value \"c\" is not in [\"a\", \"b\"]",
        "/tags/2: expected string, got integer",
        "/extra~1x: unexpected property",
        "/active: expected boolean, got integer",
    ], what="the errors")


@check("properties", "valid arguments give no errors", "When every value has the right type and every rule holds, validate_args returns an empty list.")
def valid_args(sub):
    cases = [
        (WEATHER, {"city": "Pune", "units": "fahrenheit"}),
        (USER, {"id": 7, "tags": [], "score": 2.5, "active": False}),
        (USER, {"tags": ["b", "a"], "id": -3, "score": 4}),
        (ORDER, {"customer": {"name": "Ada", "vip": True}, "lines": [{"sku": "x1", "qty": 2, "note": "gift", "color": "red"}], "priority": "high"}),
    ]
    for schema, args in cases:
        equal(errors_of(sub, schema, args, json.dumps(args)), [], what=f"the errors for {json.dumps(args)}")


@check("properties", "required errors come first, then keys in input order", "For an object, report missing required properties in the order of the required list. Then walk the keys of the value in their input order.")
def error_order(sub):
    args = {"zeta": 1, "lines": [{"qty": "2"}, {"sku": "a", "qty": 1.5}], "alpha": 2}
    equal(errors_of(sub, ORDER, args, "an order"), [
        "/customer: missing required property",
        "/zeta: unexpected property",
        "/lines/0/sku: missing required property",
        "/lines/0/qty: expected integer, got string",
        "/lines/1/qty: expected integer, got number",
        "/alpha: unexpected property",
    ], what="the errors")


@check("properties", "the parsed arguments validate the same as the original dict", "parse_tool_calls must return the decoded arguments without a change, so validation of the parsed call equals validation of the dict.")
def roundtrip(sub):
    rng = np.random.default_rng(0)
    for _ in range(6):
        args = random_order_args(rng)
        parsed = sub.parse_tool_calls(reply([("call_1", "place_order", json.dumps(args))]))
        equal(parsed[0]["arguments"], args, what="the parsed arguments")
        equal(errors_of(sub, ORDER, parsed[0]["arguments"], "the parsed arguments"), errors_of(sub, ORDER, args, "the dict"), what="the errors of the parsed arguments")


@check("properties", "the inputs are not changed", "A validator that writes into the schema or the arguments breaks the code that calls it.")
def inputs_unchanged(sub):
    schema = clone(ORDER)
    args = {"customer": {"name": 3}, "lines": [{"sku": "a"}], "extra": None}
    saved_schema = clone(schema)
    saved_args = clone(args)
    sub.validate_args(schema, args)
    sub.check_reply(reply([("c", "place_order", json.dumps(args))]), {"place_order": schema})
    equal(schema, saved_schema, what="the schema after the calls")
    equal(args, saved_args, what="the arguments after the calls")


@check("edge", "no tool calls", "A reply with tool_calls missing or null holds no calls, so parse_tool_calls returns an empty list.")
def no_calls(sub):
    equal(sub.parse_tool_calls(reply(None, content="Hello")), [], what="the calls when tool_calls is missing")
    body = json.dumps({"choices": [{"message": {"role": "assistant", "content": "Hi", "tool_calls": None}}]})
    equal(sub.parse_tool_calls(body), [], what="the calls when tool_calls is null")


@check("edge", "empty arguments mean no arguments", "Some providers send an empty string for a call without arguments. Treat an empty or blank string as {}.")
def empty_arguments(sub):
    equal(sub.parse_tool_calls(reply([("call_1", "list_notes", ""), ("call_2", "list_notes", "  ")])), [
        {"id": "call_1", "name": "list_notes", "arguments": {}},
        {"id": "call_2", "name": "list_notes", "arguments": {}},
    ], what="the parsed calls")


@check("edge", "bad arguments raise ValueError", "Arguments that are not valid JSON, or that decode to something other than an object, raise ValueError.")
def bad_arguments(sub):
    raises(ValueError, sub.parse_tool_calls, reply([("call_1", "get_weather", "{\"city\": \"Pune\"")]))
    raises(ValueError, sub.parse_tool_calls, reply([("call_1", "get_weather", "[1, 2]")]))


@check("edge", "a type error at the root stops the walk", "When the type of a value is wrong, report one error for that value and do not check its children. The root path is a single slash.")
def root_type(sub):
    equal(errors_of(sub, ORDER, ["customer"], "a list at the root"), ["/: expected object, got array"], what="the errors")
    equal(errors_of(sub, ORDER, {"customer": "Ada", "lines": None}, "wrong child types"), ["/customer: expected object, got string", "/lines: expected array, got null"], what="the errors")


@check("edge", "integer and number rules", "integer accepts int values only, so 1.0 fails. number accepts int and float. Neither accepts true or false.")
def number_rules(sub):
    schema = {"type": "object", "properties": {"i": {"type": "integer"}, "n": {"type": "number"}}}
    equal(errors_of(sub, schema, {"i": 1.0, "n": 3}, "1.0 and 3"), ["/i: expected integer, got number"], what="the errors for i = 1.0 and n = 3")
    equal(errors_of(sub, schema, {"i": False, "n": True}, "booleans"), ["/i: expected integer, got boolean", "/n: expected number, got boolean"], what="the errors for booleans")


@check("edge", "extra keys are allowed without additionalProperties false", "Only additionalProperties set to false rejects keys that are not in properties.")
def additional_default(sub):
    equal(errors_of(sub, ORDER, {"customer": {"name": "Ada"}, "lines": [{"sku": "a", "qty": 1, "gift": True}]}, "an extra key in a line"), [], what="the errors")


@check("edge", "pointer escapes for ~ and /", "In a JSON pointer, ~ becomes ~0 and / becomes ~1. Replace ~ first.")
def pointer_escape(sub):
    schema = {"type": "object", "required": ["a/b", "c~d"], "properties": {}, "additionalProperties": False}
    equal(errors_of(sub, schema, {"x~/y": 1}, "escaped keys"), ["/a~1b: missing required property", "/c~0d: missing required property", "/x~0~1y: unexpected property"], what="the errors")


@check("edge", "an unknown tool name", "check_reply reports a call to a tool that is not in the schemas with the error /: unknown tool <name>.")
def unknown_tool(sub):
    equal(sub.check_reply(reply([("call_9", "delete_all", "{}")]), {"get_weather": WEATHER}), [("call_9", ["/: unknown tool delete_all"])], what="the result of check_reply")


POOL = [None, True, False, 0, 3, -2, 1.5, 2.0, "", "a", "low", "high", "x1", [], [1], {}, {"name": "Bo"}]


def random_value(rng):
    return clone(POOL[int(rng.integers(0, len(POOL)))])


def random_order_args(rng):
    args = {}
    if rng.random() < 0.8:
        customer = {"name": "Ada"} if rng.random() < 0.6 else {}
        if rng.random() < 0.5:
            customer["vip"] = random_value(rng)
        if rng.random() < 0.3:
            customer["name"] = random_value(rng)
        args["customer"] = customer if rng.random() < 0.9 else random_value(rng)
    if rng.random() < 0.8:
        lines = []
        for _ in range(int(rng.integers(0, 4))):
            line = {}
            for key in ["sku", "qty", "note", "gift"]:
                if rng.random() < 0.6:
                    line[key] = random_value(rng)
            lines.append(line)
        args["lines"] = lines
    if rng.random() < 0.5:
        args["priority"] = random_value(rng)
    if rng.random() < 0.3:
        args["k/" + str(int(rng.integers(0, 9)))] = random_value(rng)
    return args


@fixture("validate")
def validate_cases(ref):
    rng = np.random.default_rng(42)
    for _ in range(25):
        args = random_order_args(rng)
        yield {"args": args}, ref.validate_args(ORDER, args)


@fixture("replies")
def reply_cases(ref):
    rng = np.random.default_rng(7)
    for _ in range(5):
        calls = []
        for index in range(int(rng.integers(1, 4))):
            name = ["place_order", "get_weather", "refund"][int(rng.integers(0, 3))]
            args = random_order_args(rng) if name == "place_order" else {"city": random_value(rng), "units": ["celsius", "kelvin"][int(rng.integers(0, 2))]}
            calls.append((f"call_{index}", name, json.dumps(args)))
        text = reply(calls)
        yield {"reply": text}, ref.check_reply(text, {"place_order": ORDER, "get_weather": WEATHER})


@check("reference", "errors match the reference on 25 random orders", "Your error strings and their order agree with the reference solution on random nested arguments.")
def reference_validate(sub):
    for case, expected in fixtures("validate"):
        equal(errors_of(sub, ORDER, case["args"], json.dumps(case["args"])), expected, what=f"the errors for {json.dumps(case['args'])}")


@check("reference", "check_reply matches the reference on 5 random replies", "Your check_reply gives the same call ids and errors as the reference solution.")
def reference_replies(sub):
    for case, expected in fixtures("replies"):
        got = sub.check_reply(case["reply"], {"place_order": ORDER, "get_weather": WEATHER})
        equal([(cid, list(errs)) for cid, errs in got], [(cid, list(errs)) for cid, errs in expected], what="the result of check_reply")
