import unittest
from main import classify_changes, load_contract


class TestStage02ClassifyChanges(unittest.TestCase):
    """Unit tests for Stage 2 schema change classification."""

    def setUp(self):
        """Set up standard fixture contract for change classification."""
        self.base_schema = {
            "title": "search_tool",
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "limit": {"type": "integer", "minimum": 1, "maximum": 100},
                "format": {"type": "string", "enum": ["json", "csv", "text"]},
            },
            "required": ["query"],
            "additionalProperties": True,
        }
        self.base_contract = load_contract(self.base_schema)

    def test_added_required_is_breaking(self):
        """Verify newly required properties are classified as breaking."""
        new_schema = dict(self.base_schema)
        new_schema["required"] = ["query", "token"]
        new_schema["properties"] = dict(self.base_schema["properties"], token={"type": "string"})
        changes = classify_changes(self.base_contract, load_contract(new_schema))
        breaking = [c for c in changes if c["type"] == "breaking" and c["category"] == "added_required"]
        self.assertEqual(len(breaking), 1)
        self.assertEqual(breaking[0]["property"], "token")

    def test_added_optional_is_compatible(self):
        """Verify newly added optional properties are classified as compatible."""
        new_schema = dict(self.base_schema)
        new_schema["properties"] = dict(self.base_schema["properties"], filter_by={"type": "string"})
        changes = classify_changes(self.base_contract, load_contract(new_schema))
        compatible = [c for c in changes if c["type"] == "compatible" and c["category"] == "added_optional"]
        self.assertEqual(len(compatible), 1)
        self.assertEqual(compatible[0]["property"], "filter_by")

    def test_removed_property_when_closed_is_breaking(self):
        """Verify property removal in closed schema is classified as breaking."""
        new_schema = dict(self.base_schema)
        props = dict(self.base_schema["properties"])
        del props["limit"]
        new_schema["properties"] = props
        new_schema["additionalProperties"] = False  # closed rejects removed prop
        changes = classify_changes(self.base_contract, load_contract(new_schema))
        breaking = [c for c in changes if c["type"] == "breaking" and c["category"] == "removed_property"]
        self.assertEqual(len(breaking), 1)
        self.assertEqual(breaking[0]["property"], "limit")

    def test_removed_property_when_permitted_is_compatible(self):
        """Verify property removal in open schema is classified as compatible."""
        new_schema = dict(self.base_schema)
        props = dict(self.base_schema["properties"])
        del props["limit"]
        new_schema["properties"] = props
        new_schema["additionalProperties"] = True  # permitted!
        changes = classify_changes(self.base_contract, load_contract(new_schema))
        comp = [c for c in changes if c["type"] == "compatible" and c["category"] == "removed_permitted_property"]
        self.assertEqual(len(comp), 1)
        self.assertEqual(comp[0]["property"], "limit")

    def test_enum_narrowed_with_complex_types(self):
        """Verify enum narrowing with structured and boolean elements."""
        old_s = {
            "title": "c",
            "type": "object",
            "properties": {"val": {"enum": [1, True, ["a", "b"], "text"]}},
        }
        new_s = {
            "title": "c",
            "type": "object",
            "properties": {"val": {"enum": [1, ["a", "b"]]}},
        }
        changes = classify_changes(load_contract(old_s), load_contract(new_s))
        breaking = [c for c in changes if c["type"] == "breaking" and c["category"] == "enum_narrowed"]
        self.assertEqual(len(breaking), 1)

    def test_enum_equivalent_numeric_types(self):
        """Verify integer and float equivalents in enums do not trigger false breaks."""
        old_s = {
            "title": "n",
            "type": "object",
            "properties": {"val": {"enum": [1, 2]}},
        }
        new_s = {
            "title": "n",
            "type": "object",
            "properties": {"val": {"enum": [1.0, 2.0]}},
        }
        changes = classify_changes(load_contract(old_s), load_contract(new_s))
        breaking = [c for c in changes if c["type"] == "breaking"]
        self.assertEqual(len(breaking), 0)

    def test_bound_tightened_is_breaking(self):
        """Verify tightened minimum and maximum bounds are classified as breaking."""
        new_schema = dict(self.base_schema)
        props = dict(self.base_schema["properties"])
        props["limit"] = {"type": "integer", "minimum": 5, "maximum": 50}  # min 1->5, max 100->50
        new_schema["properties"] = props
        changes = classify_changes(self.base_contract, load_contract(new_schema))
        breaking = [c for c in changes if c["type"] == "breaking" and c["category"] == "bound_narrowed"]
        self.assertEqual(len(breaking), 2)

    def test_closed_additional_properties_is_breaking(self):
        """Verify closing additionalProperties from True to False is breaking."""
        new_schema = dict(self.base_schema)
        new_schema["additionalProperties"] = False
        changes = classify_changes(self.base_contract, load_contract(new_schema))
        breaking = [c for c in changes if c["type"] == "breaking" and c["category"] == "closed_schema"]
        self.assertEqual(len(breaking), 1)

    def test_nested_restriction_marked_unresolved(self):
        """Verify nested schema properties outside flat subset are marked unresolved."""
        nested_schema = dict(self.base_schema)
        nested_schema["properties"] = {
            "metadata": {"type": "object", "properties": {"tag": {"type": "string"}}}
        }
        changes = classify_changes(self.base_contract, load_contract(nested_schema))
        unresolved = [c for c in changes if c["type"] == "unresolved" and c["category"] == "nested_restriction"]
        self.assertEqual(len(unresolved), 1)
        self.assertEqual(unresolved[0]["property"], "metadata")

    def test_unhandled_property_keywords_marked_unresolved(self):
        """Verify unhandled keywords in properties are reported as unresolved."""
        unhandled_cases = [
            {"pattern": "^[0-9]+$"},
            {"const": "x"},
            {"oneOf": [{"type": "integer"}]},
            {"exclusiveMaximum": 10},
            {"multipleOf": 5},
        ]
        for extra in unhandled_cases:
            new_s = dict(self.base_schema)
            new_s["properties"] = dict(self.base_schema["properties"], q={"type": "string", **extra})
            changes = classify_changes(self.base_contract, load_contract(new_s))
            unresolved = [c for c in changes if c["type"] == "unresolved" and c["category"] == "unresolved_keyword"]
            self.assertGreaterEqual(len(unresolved), 1)

    def test_unchanged_items_not_unresolved(self):
        """Verify identical nested items schema across contracts is not marked unresolved."""
        old_s = {
            "title": "arr_tool",
            "type": "object",
            "properties": {"tags": {"type": "array", "items": {"type": "string"}, "minItems": 1}},
        }
        new_s = {
            "title": "arr_tool",
            "type": "object",
            "properties": {"tags": {"type": "array", "items": {"type": "string"}, "minItems": 1}},
        }
        changes = classify_changes(load_contract(old_s), load_contract(new_s))
        unresolved = [c for c in changes if c["type"] == "unresolved"]
        self.assertEqual(len(unresolved), 0)

    def test_type_added_to_untyped_property_is_narrowed(self):
        """Verify adding a type constraint to an untyped property is classified as type_narrowed."""
        old_s = {"title": "t", "type": "object", "properties": {"val": {}}}
        new_s = {"title": "t", "type": "object", "properties": {"val": {"type": "string"}}}
        changes = classify_changes(load_contract(old_s), load_contract(new_s))
        breaking = [c for c in changes if c["type"] == "breaking" and c["category"] == "type_narrowed"]
        self.assertEqual(len(breaking), 1)

    def test_integer_to_number_or_null_is_widened(self):
        """Verify widening integer to number or null is compatible type_widened."""
        old_s = {"title": "t", "type": "object", "properties": {"val": {"type": "integer"}}}
        new_s = {"title": "t", "type": "object", "properties": {"val": {"type": ["number", "null"]}}}
        changes = classify_changes(load_contract(old_s), load_contract(new_s))
        breaking = [c for c in changes if c["type"] == "breaking"]
        compatible = [c for c in changes if c["type"] == "compatible" and c["category"] == "type_widened"]
        self.assertEqual(len(breaking), 0)
        self.assertEqual(len(compatible), 1)

    def test_unchanged_unsupported_keywords_are_not_unresolved(self):
        """Verify unsupported keywords and annotations that did not change produce no unresolved entry."""
        prop = {"type": "string", "format": "email", "pattern": "^.+@.+$", "default": "a@b.c", "examples": ["a@b.c"]}
        schema = {"title": "t", "type": "object", "properties": {"email": prop}, "$defs": {"x": {}}}
        changes = classify_changes(load_contract(schema), load_contract(schema))
        self.assertEqual(changes, [])

    def test_changed_unsupported_keyword_is_unresolved(self):
        """Verify a changed keyword outside the supported subset is reported as unresolved."""
        old_s = {"title": "t", "type": "object", "properties": {"code": {"type": "string"}}}
        new_s = {"title": "t", "type": "object", "properties": {"code": {"type": "string", "pattern": "^[0-9]+$"}}}
        changes = classify_changes(load_contract(old_s), load_contract(new_s))
        unresolved = [c for c in changes if c["type"] == "unresolved"]
        self.assertEqual([(c["property"], c["keyword"]) for c in unresolved], [("code", "pattern")])

    def test_nested_object_restriction_is_unresolved(self):
        """Verify nested required or additionalProperties changes are reported as unresolved."""
        nested = {"type": "object", "properties": {"x": {"type": "string"}}}
        old_s = {"title": "t", "type": "object", "properties": {"opts": nested}}
        for extra in ({"required": ["x"]}, {"additionalProperties": False}):
            new_s = {"title": "t", "type": "object", "properties": {"opts": dict(nested, **extra)}}
            changes = classify_changes(load_contract(old_s), load_contract(new_s))
            unresolved = [c for c in changes if c["category"] == "nested_restriction"]
            self.assertEqual(len(unresolved), 1)
            self.assertEqual(unresolved[0]["keywords"], sorted(extra))

    def test_explicit_nested_defaults_are_not_unresolved(self):
        """Verify spelling out nested defaults such as required [] is not reported as a change."""
        old_s = {"title": "t", "type": "object", "properties": {"opts": {"type": "object"}}}
        explicit = {"type": "object", "required": [], "additionalProperties": True, "properties": {}}
        new_s = {"title": "t", "type": "object", "properties": {"opts": explicit}}
        changes = classify_changes(load_contract(old_s), load_contract(new_s))
        self.assertEqual(changes, [])

    def test_malformed_nested_required_is_unresolved(self):
        """Verify a nested required list with non-string items is reported instead of raising."""
        old_s = {"title": "t", "type": "object", "properties": {"opts": {"required": [{"name": "x"}]}}}
        new_s = {"title": "t", "type": "object", "properties": {"opts": {}}}
        changes = classify_changes(load_contract(old_s), load_contract(new_s))
        nested = [c for c in changes if c["category"] == "nested_restriction"]
        self.assertEqual(len(nested), 1)
        self.assertEqual(nested[0]["keywords"], ["required"])


if __name__ == "__main__":
    unittest.main()
