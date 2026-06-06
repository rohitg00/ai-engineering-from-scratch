"""Tests for ToolRegistry and JSON Schema subset validator."""

from __future__ import annotations

import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from main import (  # noqa: E402
    Ok,
    ToolRecord,
    ToolRegistry,
    ValidationError,
    validate_schema_shape,
)


class TestRegistration(unittest.TestCase):
    def test_register_returns_record(self) -> None:
        r = ToolRegistry()
        rec = r.register(
            "fs.read",
            schema={"type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"]},
            handler=lambda path: open(path).read(),
            description="Read file",
        )
        self.assertIsInstance(rec, ToolRecord)
        self.assertEqual(rec.name, "fs.read")
        self.assertEqual(r.names(), ["fs.read"])

    def test_duplicate_rejected_without_override(self) -> None:
        r = ToolRegistry()
        r.register("a", schema={"type": "string"}, handler=lambda x: x)
        with self.assertRaises(ValueError):
            r.register("a", schema={"type": "integer"}, handler=lambda x: x)

    def test_override_replaces(self) -> None:
        r = ToolRegistry()
        r.register("a", schema={"type": "string"}, handler=lambda x: x)
        r.register("a", schema={"type": "integer"}, handler=lambda x: x, override=True)
        self.assertEqual(r.get("a").schema["type"], "integer")
        self.assertEqual(r.names(), ["a"])

    def test_invalid_name_rejected(self) -> None:
        r = ToolRegistry()
        with self.assertRaises(ValueError):
            r.register("Bad-Name", schema={"type": "string"}, handler=lambda x: x)
        with self.assertRaises(ValueError):
            r.register("1starts-with-digit", schema={"type": "string"}, handler=lambda x: x)

    def test_unknown_keyword_rejected(self) -> None:
        with self.assertRaises(ValueError):
            validate_schema_shape({"type": "object", "oneOf": []})

    def test_unknown_type_rejected(self) -> None:
        with self.assertRaises(ValueError):
            validate_schema_shape({"type": "tuple"})

    def test_get_unknown_raises(self) -> None:
        r = ToolRegistry()
        with self.assertRaises(KeyError):
            r.get("nope")


class TestValidatorTypes(unittest.TestCase):
    def setUp(self) -> None:
        self.r = ToolRegistry()

    def test_string_ok(self) -> None:
        self.r.register("s", schema={"type": "string"}, handler=lambda x: x)
        self.assertIsInstance(self.r.validate("s", "hi"), Ok)

    def test_string_wrong_type(self) -> None:
        self.r.register("s", schema={"type": "string"}, handler=lambda x: x)
        errs = self.r.validate("s", 42)
        self.assertIsInstance(errs, list)
        self.assertEqual(errs[0].keyword, "type")
        self.assertEqual(errs[0].path, "/")

    def test_integer_vs_boolean(self) -> None:
        self.r.register("n", schema={"type": "integer"}, handler=lambda x: x)
        errs = self.r.validate("n", True)
        self.assertIsInstance(errs, list)
        self.assertEqual(errs[0].keyword, "type")

    def test_number_accepts_int_and_float(self) -> None:
        self.r.register("n", schema={"type": "number"}, handler=lambda x: x)
        self.assertIsInstance(self.r.validate("n", 1), Ok)
        self.assertIsInstance(self.r.validate("n", 1.5), Ok)

    def test_null_type(self) -> None:
        self.r.register("z", schema={"type": "null"}, handler=lambda x: x)
        self.assertIsInstance(self.r.validate("z", None), Ok)
        errs = self.r.validate("z", 0)
        self.assertIsInstance(errs, list)


class TestValidatorKeywords(unittest.TestCase):
    def setUp(self) -> None:
        self.r = ToolRegistry()

    def test_min_max_length(self) -> None:
        self.r.register("s", schema={"type": "string", "minLength": 2, "maxLength": 4},
                        handler=lambda x: x)
        self.assertIsInstance(self.r.validate("s", "abc"), Ok)
        e1 = self.r.validate("s", "a")
        self.assertIsInstance(e1, list)
        self.assertEqual(e1[0].keyword, "minLength")
        e2 = self.r.validate("s", "abcde")
        self.assertIsInstance(e2, list)
        self.assertEqual(e2[0].keyword, "maxLength")

    def test_pattern(self) -> None:
        self.r.register("s", schema={"type": "string", "pattern": r"^[a-z]+$"},
                        handler=lambda x: x)
        self.assertIsInstance(self.r.validate("s", "abc"), Ok)
        errs = self.r.validate("s", "abc1")
        self.assertIsInstance(errs, list)
        self.assertEqual(errs[0].keyword, "pattern")

    def test_enum(self) -> None:
        self.r.register("s", schema={"type": "string", "enum": ["a", "b"]},
                        handler=lambda x: x)
        self.assertIsInstance(self.r.validate("s", "a"), Ok)
        errs = self.r.validate("s", "c")
        self.assertIsInstance(errs, list)
        self.assertEqual(errs[0].keyword, "enum")

    def test_required_missing(self) -> None:
        self.r.register("o", schema={
            "type": "object",
            "properties": {"id": {"type": "integer"}},
            "required": ["id"],
        }, handler=lambda **kw: kw)
        errs = self.r.validate("o", {})
        self.assertIsInstance(errs, list)
        self.assertEqual(errs[0].keyword, "required")
        self.assertEqual(errs[0].path, "/id")

    def test_nested_path(self) -> None:
        self.r.register("o", schema={
            "type": "object",
            "properties": {
                "user": {
                    "type": "object",
                    "properties": {"email": {"type": "string"}},
                    "required": ["email"],
                },
            },
            "required": ["user"],
        }, handler=lambda **kw: kw)
        errs = self.r.validate("o", {"user": {"email": 0}})
        self.assertIsInstance(errs, list)
        self.assertEqual(errs[0].path, "/user/email")

    def test_array_items(self) -> None:
        self.r.register("a", schema={
            "type": "array",
            "items": {"type": "integer"},
        }, handler=lambda x: x)
        self.assertIsInstance(self.r.validate("a", [1, 2, 3]), Ok)
        errs = self.r.validate("a", [1, "x", 3])
        self.assertIsInstance(errs, list)
        self.assertEqual(errs[0].path, "/1")

    def test_multiple_errors_collected(self) -> None:
        self.r.register("o", schema={
            "type": "object",
            "properties": {
                "a": {"type": "string"},
                "b": {"type": "integer"},
            },
            "required": ["a", "b"],
        }, handler=lambda **kw: kw)
        errs = self.r.validate("o", {})
        self.assertIsInstance(errs, list)
        self.assertEqual(len(errs), 2)
        paths = {e.path for e in errs}
        self.assertEqual(paths, {"/a", "/b"})


if __name__ == "__main__":
    unittest.main()
