import unittest, os, sys, json, subprocess, tempfile
from pathlib import Path

W = Path(os.environ["PROJECT_WORKSPACE"])
from cli import execute_jobs


class IntegrationTests(unittest.TestCase):
    def test_real_callback_reservation_and_release(self):
        calls = []
        jobs = [{"id": "a", "cost": 70}, {"id": "b", "cost": 70}]
        r = execute_jobs(jobs, 100, 1000, lambda j: (calls.append(j["id"]), 20))
        self.assertEqual(calls, ["a", "b"])
        self.assertEqual(r["ledger"]["spent"], 40)

    def test_denied_job_never_invokes(self):
        r = execute_jobs(
            [{"id": "a", "cost": 101}], 100, 1000, lambda j: self.fail("invoked")
        )
        self.assertEqual(r["events"][0]["status"], "rejected")

    def test_uncertain_receipt_retains_hold(self):
        def fail(j):
            raise TimeoutError("unknown completion")

        r = execute_jobs([{"id": "a", "cost": 70}], 100, 1000, fail)
        self.assertEqual(r["ledger"]["holds"], {"a": 70})

    def test_overrun_requires_reconciliation(self):
        r = execute_jobs([{"id": "a", "cost": 10}], 100, 1000, lambda j: (None, 11))
        self.assertEqual(r["events"][0]["status"], "needs_reconciliation")

    def test_deadline_before_dispatch(self):
        self.assertEqual(
            execute_jobs([{"id": "a", "cost": 1}], 100, 0, lambda j: self.fail())[
                "events"
            ][0]["reason"],
            "deadline",
        )
