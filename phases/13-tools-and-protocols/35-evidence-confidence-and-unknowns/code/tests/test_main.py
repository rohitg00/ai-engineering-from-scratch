import copy
import json
import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import main


FIXTURES = Path(__file__).resolve().parents[1] / "fixtures"
GRADE_ID = "ev_67b6d3f992eaf49a2e16de084b6ebfdd9884e8c5c7f75e175b7bb20f4f748ce1"
PERCENT_ID = "ev_e88b10dc0c6400e51bb6f7fdc3eaea8d2c97cc02463f0db3e6afeefc273197cd"
PROFILE_DIGEST = "9c7f6b24be69294e61da046e4583e3856cb9e40433b149c1bf8bb534d2fe03ef"
GRADE_QUERY = "query_26122aebe9d8abae8de7a5cc962bcdb70ede0d3ba52d28e471a1e1d6d7d83b41"
OBJECT_SHA256 = "9a4a8082ba5e285a732552981a6935e0c5255725664f380e37c44ebfb04d803f"
HOST_ENV = {"id": "host-process", "platform": "test", "architecture": "test", "isolation": "process"}
HARNESS = {"id": "course-harness", "name": "test harness", "version": "test"}


def subject(name: str = "ledger-x86_64-O1.o", path: str = "/a/ledger-x86_64-O1.o") -> dict:
    return {"name": name, "digest": {"sha256": OBJECT_SHA256}, "format": "elf", "architecture": "x86_64", "local_path": path}


def run_record(function: str, args: list, result, authority: str = "controlled-replay", confidence: str = "observed") -> dict:
    return main.create_evidence(
        subject("harness", "/a/harness"),
        HARNESS,
        operation="execute_function",
        parameters={"function": function, "args": args},
        normalized_result={"result": result, "stdout": f"{result}\n", "exit_code": 0},
        confidence=confidence,
        authority=authority,
        environment=HOST_ENV,
    )


def derived_record() -> dict:
    return main.create_evidence(
        subject(),
        main.MODEL_PROVIDER,
        operation="derive_switch_model",
        parameters={"function": "grade"},
        normalized_result={"table": [1, 2, 3, 4, 4]},
        confidence="derived",
    )


class EvidenceIdTests(unittest.TestCase):
    def test_rea_evidence_ids_recompute_from_content(self) -> None:
        for name, expected in (("rea-evidence-grade.json", GRADE_ID), ("rea-evidence-percent-change.json", PERCENT_ID)):
            record = json.loads((FIXTURES / name).read_text(encoding="utf-8"))
            self.assertEqual(main.compute_evidence_id(record), expected)
            self.assertEqual(main.validate_evidence(record)["evidence_id"], expected)
            profile = record["analysis_profile"]
            self.assertEqual(main.profile_digest(profile["provider"], profile["parameters"]), PROFILE_DIGEST)

    def test_id_excludes_name_and_local_path(self) -> None:
        first = main.create_evidence(subject(), main.ELF_READER_PROVIDER, operation="read_function_bytes", parameters={"function": "grade"}, normalized_result={"size": 46})
        second = main.create_evidence(subject("copy.o", "/elsewhere/copy.o"), main.ELF_READER_PROVIDER, operation="read_function_bytes", parameters={"function": "grade"}, normalized_result={"size": 46})
        self.assertEqual(first["evidence_id"], second["evidence_id"])
        rebound = main.rebind_subject_path(first, "/elsewhere/copy.o", OBJECT_SHA256, "elf", "x86_64")
        self.assertEqual(rebound["evidence_id"], first["evidence_id"])
        self.assertEqual(rebound["subject"]["local_path"], "/elsewhere/copy.o")

    def test_rebind_refuses_a_different_identity(self) -> None:
        record = main.create_evidence(subject(), main.ELF_READER_PROVIDER, operation="inspect_object", parameters={}, normalized_result={})
        with self.assertRaises(main.EvidenceIntegrityError):
            main.rebind_subject_path(record, "/b/other.o", "0" * 64, "elf", "x86_64")

    def test_limitation_changes_the_id(self) -> None:
        plain = main.create_evidence(subject(), main.ELF_READER_PROVIDER, operation="inspect_object", parameters={}, normalized_result={})
        limited = main.create_evidence(subject(), main.ELF_READER_PROVIDER, operation="inspect_object", parameters={}, normalized_result={}, limitations=["one more caveat"])
        self.assertNotEqual(plain["evidence_id"], limited["evidence_id"])

    def test_tampered_id_and_mismatched_profile_are_rejected(self) -> None:
        record = json.loads((FIXTURES / "rea-evidence-grade.json").read_text(encoding="utf-8"))
        tampered = copy.deepcopy(record)
        tampered["normalized_result"]["pseudocode"] = "int grade(int score) { return 4; }"
        with self.assertRaises(main.EvidenceIntegrityError):
            main.validate_evidence(tampered)
        mismatched = copy.deepcopy(record)
        mismatched["analysis_profile"]["provider"] = {"id": "hopper", "name": "Hopper", "version": "5"}
        mismatched["analysis_profile"]["digest"] = main.profile_digest(mismatched["analysis_profile"]["provider"], mismatched["analysis_profile"]["parameters"])
        mismatched["evidence_id"] = main.compute_evidence_id(mismatched)
        with self.assertRaises(main.EvidenceIntegrityError):
            main.validate_evidence(mismatched)

    def test_enums_and_floats_are_enforced(self) -> None:
        with self.assertRaises(main.EvidenceError):
            main.create_evidence(subject(), main.ELF_READER_PROVIDER, operation="x", parameters={}, normalized_result={}, confidence="guessed")
        with self.assertRaises(main.EvidenceError):
            main.create_evidence(subject(), main.ELF_READER_PROVIDER, operation="x", parameters={}, normalized_result={"ratio": 0.5})
        no_subject = main.create_evidence(None, main.REGISTRY_PROVIDER, operation="x", parameters={}, normalized_result={}, confidence="derived", authority="analyst-inference")
        self.assertIn(main.NO_SUBJECT_LIMITATION, no_subject["limitations"])


class LedgerTests(unittest.TestCase):
    def test_duplicate_and_conflict(self) -> None:
        ledger = main.EvidenceLedger()
        record = derived_record()
        self.assertEqual(ledger.record(record), "recorded")
        self.assertEqual(ledger.record(copy.deepcopy(record)), "duplicate")
        forged = copy.deepcopy(record)
        forged["normalized_result"]["table"] = [0, 0, 0, 0, 0]
        with self.assertRaises(main.EvidenceIntegrityError):
            ledger.record(forged)

    def test_import_is_atomic(self) -> None:
        ledger = main.EvidenceLedger()
        good = derived_record()
        bad = run_record("grade", [95], 4)
        bad["normalized_result"]["result"] = 3
        with self.assertRaises(main.EvidenceIntegrityError):
            ledger.import_bundle({"records": [good, bad]})
        self.assertEqual(ledger.records, {})

    def test_recorded_run_bundle_imports_and_links_resolve(self) -> None:
        ledger = main.EvidenceLedger()
        counts = ledger.import_bundle(json.loads((FIXTURES / "run-evidence.json").read_text(encoding="utf-8")))
        self.assertEqual(counts["records"], 18)
        self.assertEqual(len(ledger.find(operation="execute_function")), 17)
        self.assertEqual(ledger.dangling_links(), [])
        for record in ledger.find(operation="execute_function"):
            self.assertEqual(record["authority"], "controlled-replay")
            self.assertEqual(record["environment"]["isolation"], "process")
            self.assertIn(main.HOST_BUILD_LIMITATION, record["limitations"])


class UnknownTests(unittest.TestCase):
    def setUp(self) -> None:
        self.ledger = main.EvidenceLedger()
        self.derived = derived_record()
        self.ledger.record(self.derived)
        self.unknown = self.ledger.open_unknown(
            "Does grade(95) == 4 hold when the compiled function runs?",
            domain="function-behaviour",
            scope_digest=OBJECT_SHA256,
            severity="medium",
            required_authority="controlled-replay",
            supporting_evidence_ids=[self.derived["evidence_id"]],
        )

    def test_first_revision_and_mutation_evidence(self) -> None:
        self.assertEqual(self.unknown["revision"], 1)
        self.assertIsNone(self.unknown["previous_revision_digest"])
        self.assertEqual(self.unknown["unknown_id"], main.unknown_id_for("Does grade(95) == 4  hold when the compiled function runs?", "function-behaviour", OBJECT_SHA256))
        mutation = self.ledger.get(self.unknown["mutation_evidence_ids"][0])
        self.assertEqual((mutation["confidence"], mutation["authority"]), ("derived", "analyst-inference"))
        with self.assertRaises(main.EvidenceError):
            self.ledger.open_unknown("Does grade(95) == 4 hold when the compiled function runs?", domain="function-behaviour", scope_digest=OBJECT_SHA256, severity="low")

    def test_stale_revision_is_refused(self) -> None:
        with self.assertRaisesRegex(main.EvidenceError, "revision-conflict"):
            self.ledger.update_unknown(self.unknown["unknown_id"], 7, status="investigating")

    def test_resolution_needs_observed_evidence_with_the_required_authority(self) -> None:
        with self.assertRaises(main.EvidenceError):
            self.ledger.resolve_unknown(self.unknown["unknown_id"], 1, [self.derived["evidence_id"]], "derived is not enough")
        wrong_authority = run_record("grade", [95], 4, authority="shipped-artifact")
        self.ledger.record(wrong_authority)
        with self.assertRaises(main.EvidenceError):
            self.ledger.resolve_unknown(self.unknown["unknown_id"], 1, [wrong_authority["evidence_id"]], "wrong authority")
        observed = run_record("grade", [95], 4)
        self.ledger.record(observed)
        resolved = self.ledger.resolve_unknown(self.unknown["unknown_id"], 1, [observed["evidence_id"]], "one run agrees")
        self.assertEqual((resolved["status"], resolved["revision"]), ("resolved", 2))
        self.assertEqual(resolved["previous_revision_digest"], self.unknown["revision_digest"])
        self.assertEqual(self.ledger.verify_unknown_chain(self.unknown["unknown_id"]), 2)

    def test_tampered_chain_is_detected(self) -> None:
        observed = run_record("grade", [95], 4)
        self.ledger.record(observed)
        self.ledger.resolve_unknown(self.unknown["unknown_id"], 1, [observed["evidence_id"]], "one run agrees")
        self.ledger.unknowns[self.unknown["unknown_id"]][0]["severity"] = "critical"
        with self.assertRaises(main.EvidenceIntegrityError):
            self.ledger.verify_unknown_chain(self.unknown["unknown_id"])

    def test_contradicted_requires_contradicting_evidence(self) -> None:
        with self.assertRaises(main.EvidenceIntegrityError):
            self.ledger.update_unknown(self.unknown["unknown_id"], 1, status="contradicted")


class ClaimTests(unittest.TestCase):
    def setUp(self) -> None:
        self.ledger = main.EvidenceLedger()
        self.derived = derived_record()
        self.ledger.record(self.derived)
        self.claim = main.Claim("grade(95)", "grade(95) == 4", "grade", [([95], 4)], [self.derived["evidence_id"]])
        main.record_prediction(self.ledger, self.claim, subject())

    def test_promotion_refuses_inferred_derived_empty_and_unrelated(self) -> None:
        with self.assertRaisesRegex(main.ClaimError, "inferred"):
            main.promote_claim(self.ledger, self.claim, [self.claim.prediction_id])
        with self.assertRaisesRegex(main.ClaimError, "derived"):
            main.promote_claim(self.ledger, self.claim, [self.derived["evidence_id"]])
        with self.assertRaises(main.ClaimError):
            main.promote_claim(self.ledger, self.claim, [])
        other = run_record("grade", [55], 0)
        self.ledger.record(other)
        with self.assertRaisesRegex(main.ClaimError, "does not state"):
            main.promote_claim(self.ledger, self.claim, [other["evidence_id"]])

    def test_promotion_passes_with_an_agreeing_observed_run(self) -> None:
        observed = run_record("grade", [95], 4)
        self.ledger.record(observed)
        promoted = main.promote_claim(self.ledger, self.claim, [observed["evidence_id"]])
        self.assertEqual(promoted["status"], "pass")
        self.assertEqual(promoted["evidence_ids"], [observed["evidence_id"]])

    def test_check_claim_statuses(self) -> None:
        self.assertEqual(main.check_claim(self.ledger, self.claim)["status"], "unsupported")
        disagreeing = run_record("grade", [95], 3)
        self.ledger.record(disagreeing)
        failed = main.check_claim(self.ledger, self.claim)
        self.assertEqual(failed["status"], "fail")
        self.assertEqual(failed["contradicting_evidence_ids"], [disagreeing["evidence_id"]])
        ledger = main.EvidenceLedger()
        ledger.record(run_record("grade", [95], 4))
        partial = main.Claim("grade(90..100)", "grade(score) == 4 for 90..100", "grade", [([score], 4) for score in range(90, 101)])
        result = main.check_claim(ledger, partial)
        self.assertEqual((result["status"], result["covered"], result["total"]), ("unknown", 1, 11))
        with self.assertRaisesRegex(main.ClaimError, "1 of 11"):
            main.promote_claim(ledger, partial, result["evidence_ids"])

    def test_completion_ledger_counts(self) -> None:
        results = [
            {"claim_id": "a", "status": "pass", "evidence_ids": ["ev_" + "a" * 64], "contradicting_evidence_ids": [], "basis": []},
            {"claim_id": "b", "status": "unknown", "evidence_ids": [], "contradicting_evidence_ids": [], "basis": ["ev_" + "b" * 64]},
        ]
        ledger = main.completion_ledger(results)
        self.assertTrue(ledger["ledger_id"].startswith("ecl_"))
        self.assertEqual(ledger["summary"]["pass"], 1)
        self.assertFalse(ledger["summary"]["complete"])


class CacheTests(unittest.TestCase):
    def setUp(self) -> None:
        self.snapshot = json.loads((FIXTURES / "rea-snapshot.json").read_text(encoding="utf-8"))
        self.target, self.binding = main.rea_snapshot_binding(self.snapshot)

    def test_rea_query_ids_recompute(self) -> None:
        cache = main.AnswerCache(self.target, self.binding)
        self.assertEqual(cache.import_snapshot(self.snapshot), 2)
        self.assertEqual(cache.query_id("analyze_function", {"procedure": "grade"}), GRADE_QUERY)
        replay = cache.lookup("analyze_function", {"procedure": "grade"})
        self.assertIsNotNone(replay)
        self.assertEqual(replay["limitations"][-1], main.REPLAY_LIMITATION)
        self.assertEqual(replay["result"]["procedure"]["name"], "grade")
        self.assertIsNone(cache.lookup("analyze_function", {"procedure": "total"}))
        self.assertIsNone(cache.lookup("procedure_assembly", {"procedure": "grade"}))

    def test_stale_profile_version_is_refused(self) -> None:
        parameters = dict(self.binding["analysis_profile"]["parameters"], jump_table_evidence="typed-case-default-blocks-v2")
        stale = {"provider": self.binding["provider"], "analysis_profile": main.make_profile(self.binding["provider"], parameters)}
        cache = main.AnswerCache(self.target, stale)
        with self.assertRaisesRegex(main.CacheError, "profile_mismatch"):
            cache.import_snapshot(self.snapshot)
        other_target = dict(self.target, sha256="0" * 64)
        with self.assertRaisesRegex(main.CacheError, "profile_mismatch"):
            main.AnswerCache(other_target, self.binding).import_snapshot(self.snapshot)

    def test_format_version_and_tampered_query_ids_are_refused(self) -> None:
        cache = main.AnswerCache(self.target, self.binding)
        with self.assertRaisesRegex(main.CacheError, "format_mismatch"):
            cache.import_snapshot(dict(self.snapshot, format_version="course-answer-cache-0"))
        tampered = copy.deepcopy(self.snapshot)
        tampered["entries"][0]["parameters"] = {"procedure": "total"}
        with self.assertRaisesRegex(main.CacheError, "query_id"):
            cache.import_snapshot(tampered)
        self.assertEqual(cache.entries, {})

    def test_roundtrip_and_invalidation(self) -> None:
        cache = main.AnswerCache(self.target, self.binding)
        cache.store("procedure_assembly", {"procedure": "grade"}, {"result": ["MOVSXD RAX, EDI"], "limitations": []})
        exported = cache.export_snapshot()
        self.assertEqual(exported["format_version"], main.CACHE_FORMAT_VERSION)
        again = main.AnswerCache(self.target, self.binding)
        self.assertEqual(again.import_snapshot(exported), 1)
        self.assertEqual(again.lookup("procedure_assembly", {"procedure": "grade"})["result"], ["MOVSXD RAX, EDI"])
        cache.invalidate("set_address_name dispatched")
        self.assertIsNone(cache.lookup("procedure_assembly", {"procedure": "grade"}))
        with self.assertRaisesRegex(main.CacheError, "unavailable"):
            cache.export_snapshot()

    def test_binding_provider_must_match_profile(self) -> None:
        bad = {"provider": {"id": "hopper", "name": "Hopper", "version": "5"}, "analysis_profile": self.binding["analysis_profile"]}
        with self.assertRaises(main.CacheError):
            main.AnswerCache(self.target, bad)


class FixtureTests(unittest.TestCase):
    def test_object_observation_matches_llvm_objdump_facts(self) -> None:
        inspection, functions = main.observe_object()
        self.assertEqual(inspection["subject"]["digest"]["sha256"], OBJECT_SHA256)
        names = {item["name"]: item for item in inspection["normalized_result"]["functions"]}
        self.assertEqual({name: (item["offset"], item["size"]) for name, item in names.items()}, {"percent_change": (0, 16), "grade": (16, 46), "total": (64, 31), "grade_label": (96, 63)})
        self.assertTrue(functions["grade"]["normalized_result"]["bytes_hex"].startswith("4863c74869c067666666"))
        self.assertEqual(functions["percent_change"]["normalized_result"]["bytes_hex"], "85ff740929fe6bc66499f7ffc331c0c3")
        relocations = inspection["normalized_result"]["text_relocations"]
        self.assertEqual([(item["offset"], item["symbol"], item["addend"]) for item in relocations], [(54, ".rodata", 16), (132, ".rodata", 36), (147, ".rodata", -4)])

    def test_derived_models_read_the_table(self) -> None:
        ledger = main.EvidenceLedger()
        inspection, functions = main.observe_object()
        model = main.derive_grade_model(ledger, functions["grade"], inspection)
        self.assertEqual(model["confidence"], "derived")
        self.assertEqual(model["normalized_result"]["table"], [1, 2, 3, 4, 4])
        self.assertEqual(model["normalized_result"]["table_offset_in_rodata"], 20)
        self.assertEqual(sorted(model["evidence_links"]), sorted([functions["grade"]["evidence_id"], inspection["evidence_id"]]))
        percent = main.derive_percent_change_model(ledger, functions["percent_change"])
        self.assertTrue(percent["normalized_result"]["zero_guard"])

    def test_predictions_use_c_semantics(self) -> None:
        grade_model = {"divisor": 10, "first_case": 6, "case_count": 5, "table": [1, 2, 3, 4, 4], "default": 0}
        labels = ["F", "D", "C", "B", "A"]
        self.assertEqual(main.predict("percent_change", [12400, 15500], grade_model, labels), 25)
        self.assertEqual(main.predict("percent_change", [-7, 3], grade_model, labels), -142)
        self.assertEqual(main.predict("percent_change", [0, 5], grade_model, labels), 0)
        self.assertEqual([main.predict("grade", [score], grade_model, labels) for score in (55, 60, 69, 70, 85, 95, 100, 105, 110, -5)], [0, 1, 1, 2, 3, 4, 4, 4, 0, 0])
        self.assertEqual(main.predict("grade_label", [85], grade_model, labels), "B")
        self.assertEqual(main.predict("total", [2147483647, 1], grade_model, labels), -2147483648)

    def test_ledger_from_recorded_runs(self) -> None:
        ledger, report = main.build_ledger(live_runs=False)
        self.assertTrue(report["runs"].startswith("imported 17"))
        statuses = {item["claim_id"]: item["status"] for item in report["claims"]}
        self.assertEqual(statuses.pop("grade(90..100)"), "unknown")
        self.assertEqual(set(statuses.values()), {"pass"})
        self.assertEqual(report["by_confidence"]["inferred"], 18)
        self.assertEqual(report["unknowns"], {"resolved": 17, "investigating": 1})
        self.assertEqual(report["rea_records_imported"], [PERCENT_ID, GRADE_ID])
        self.assertTrue(report["rea_snapshot"]["stale_profile_refused"])
        for unknown_id in ledger.unknowns:
            ledger.verify_unknown_chain(unknown_id)
        self.assertEqual(report["dangling_links"], [])

    @unittest.skipUnless(main.find_compiler(), "no host C compiler on PATH")
    def test_live_runs_agree_with_predictions(self) -> None:
        _ledger, report = main.build_ledger(live_runs=True)
        self.assertTrue(report["runs"].startswith("live:"))
        self.assertEqual([item["status"] for item in report["claims"] if item["claim_id"] != "grade(90..100)"], ["pass"] * 17)


if __name__ == "__main__":
    unittest.main()
