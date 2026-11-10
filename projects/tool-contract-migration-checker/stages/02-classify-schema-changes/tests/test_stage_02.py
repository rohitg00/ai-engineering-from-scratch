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

    def test_removed_property_is_breaking(self):
        new_schema = dict(self.base_schema)
        props = dict(self.base_schema["properties"])
        del props["limit"]
        new_schema["properties"] = props
        changes = classify_changes(self.base_contract, load_contract(new_schema))
        breaking = [c for c in changes if c["type"] == "breaking" and c["category"] == "removed_property"]
        self.assertEqual(len(breaking), 1)
        self.assertEqual(breaking[0]["property"], "limit")

    def test_enum_narrowed_is_breaking(self):
        new_schema = dict(self.base_schema)
        props = dict(self.base_schema["properties"])
        props["format"] = {"type": "string", "enum": ["json", "csv"]}  # removed 'text'
        new_schema["properties"] = props
        changes = classify_changes(self.base_contract, load_contract(new_schema))
        breaking = [c for c in changes if c["type"] == "breaking" and c["category"] == "enum_narrowed"]
        self.assertEqual(len(breaking), 1)
        self.assertEqual(breaking[0]["property"], "format")

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

    def test_unresolved_keyword_detected(self):
        schema_with_ref = dict(self.base_schema)
        schema_with_ref["$ref"] = "#/definitions/Something"
        changes = classify_changes(load_contract(schema_with_ref), self.base_contract)
        unresolved = [c for c in changes if c["type"] == "unresolved"]
        self.assertEqual(len(unresolved), 1)
        self.assertEqual(unresolved[0]["property"], "$ref")


if __name__ == "__main__":
    unittest.main()
