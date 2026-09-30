import json
import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class RolesAndAdoptionTests(unittest.TestCase):
    def test_every_deployment_shape_has_at_least_one_requirement(self) -> None:
        for shape in main.DEPLOYMENT_SHAPES:
            matrix = main.build_responsibility_matrix(shape)
            self.assertGreater(len(matrix["assignments"]), 0)

    def test_stdio_assigns_environment_credentials_to_the_operator(self) -> None:
        matrix = main.build_responsibility_matrix("stdio")
        self.assertEqual(matrix["assignments"]["stdio-env-credentials"], "platform_gateway_operator")

    def test_http_assigns_protected_resource_metadata_to_the_server_author(self) -> None:
        matrix = main.build_responsibility_matrix("http")
        self.assertEqual(matrix["assignments"]["prm-implemented"], "server_author")

    def test_gateway_shape_moves_origin_validation_to_the_platform_operator(self) -> None:
        matrix = main.build_responsibility_matrix("gateway")
        self.assertEqual(matrix["assignments"]["origin-validation"], "platform_gateway_operator")

    def test_http_shape_without_a_gateway_keeps_origin_validation_on_the_server_author(self) -> None:
        matrix = main.build_responsibility_matrix("http")
        self.assertEqual(matrix["assignments"]["origin-validation"], "server_author")

    def test_unowned_must_is_reported_as_a_gap(self) -> None:
        matrix = main.build_responsibility_matrix("http")
        self.assertIsNone(matrix["assignments"]["error-code-allocation"])
        self.assertIn("error-code-allocation", matrix["gaps"])

    def test_an_unowned_should_does_not_force_a_gap(self) -> None:
        requirement = next(item for item in main.REQUIREMENTS if item.id == "human-can-deny-invocation")
        self.assertEqual(requirement.keyword, "SHOULD")
        matrix = main.build_responsibility_matrix("stdio")
        self.assertNotIn("human-can-deny-invocation", matrix["gaps"])

    def test_every_applicable_requirement_is_assigned_exactly_once(self) -> None:
        for shape in main.DEPLOYMENT_SHAPES:
            applicable_ids = sorted(item.id for item in main.requirements_for_shape(shape))
            matrix = main.build_responsibility_matrix(shape)
            self.assertEqual(sorted(matrix["assignments"]), applicable_ids)
            self.assertEqual(len(matrix["assignments"]), len(applicable_ids))

    def test_all_six_roles_are_used_somewhere_in_the_catalog(self) -> None:
        covered: set[str] = set()
        for shape in main.DEPLOYMENT_SHAPES:
            covered |= main.roles_covered(shape)
        self.assertEqual(covered, set(main.ROLES))

    def test_unknown_deployment_shape_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            main.build_responsibility_matrix("carrier-pigeon")

    def test_illustrative_exchange_never_carries_a_credential_on_the_wire(self) -> None:
        blob = json.dumps(main.transcript()).lower()
        for forbidden in ("password", "secret", "api_key", "bearer"):
            self.assertNotIn(forbidden, blob)

    def test_transcript_requests_carry_protocol_version_and_capabilities(self) -> None:
        for message in main.transcript():
            if "method" in message:
                meta = message["params"]["_meta"]
                self.assertEqual(meta[main.PV_KEY], main.PROTOCOL_VERSION)
                self.assertIsInstance(meta[main.CAPS_KEY], dict)

    def test_every_requirement_statement_names_its_keyword(self) -> None:
        for requirement in main.REQUIREMENTS:
            self.assertIn(requirement.keyword, requirement.statement)


if __name__ == "__main__":
    unittest.main()
