import unittest
from main import classify_changes, load_contract


class TestStage02ClassifyChanges(unittest.TestCase):
    def setUp(self):
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
        new_schema = dict(self.base_schema)
        new_schema["required"] = ["query", "token"]
        new_schema["properties"] = dict(self.base_schema["properties"], token={"type": "string"})
        changes = classify_changes(self.base_contract, load_contract(new_schema))
        breaking = [c for c in changes if c["type"] == "breaking" and c["category"] == "added_required"]
        self.assertEqual(len(breaking), 1)
        self.assertEqual(breaking[0]["property"], "token")

    def test_added_optional_is_compatible(self):
        new_schema = dict(self.base_schema)
        new_schema["properties"] = dict(self.base_schema["properties"], filter_by={"type": "string"})
        changes = classify_changes(self.base_contract, load_contract(new_schema))
        compatible = [c for c in changes if c["type"] == "compatible" and c["category"] == "added_optional"]
        self.assertEqual(len(compatible), 1)
        self.assertEqual(compatible[0]["property"], "filter_by")

    def test_removed_property_when_closed_is_breaking(self):
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
        # tests json array/nested/bool enum elements without crashing
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

    def test_bound_tightened_is_breaking(self):
        new_schema = dict(self.base_schema)
        props = dict(self.base_schema["properties"])
        props["limit"] = {"type": "integer", "minimum": 5, "maximum": 50}  # min 1->5, max 100->50
        new_schema["properties"] = props
        changes = classify_changes(self.base_contract, load_contract(new_schema))
        breaking = [c for c in changes if c["type"] == "breaking" and c["category"] == "bound_narrowed"]
        self.assertEqual(len(breaking), 2)

    def test_closed_additional_properties_is_breaking(self):
        new_schema = dict(self.base_schema)
        new_schema["additionalProperties"] = False
        changes = classify_changes(self.base_contract, load_contract(new_schema))
        breaking = [c for c in changes if c["type"] == "breaking" and c["category"] == "closed_schema"]
        self.assertEqual(len(breaking), 1)

    def test_nested_restriction_marked_unresolved(self):
        nested_schema = dict(self.base_schema)
        nested_schema["properties"] = {
            "metadata": {"type": "object", "properties": {"tag": {"type": "string"}}}
        }
        changes = classify_changes(self.base_contract, load_contract(nested_schema))
        unresolved = [c for c in changes if c["type"] == "unresolved" and c["category"] == "nested_restriction"]
        self.assertEqual(len(unresolved), 1)
        self.assertEqual(unresolved[0]["property"], "metadata")


if __name__ == "__main__":
    unittest.main()
