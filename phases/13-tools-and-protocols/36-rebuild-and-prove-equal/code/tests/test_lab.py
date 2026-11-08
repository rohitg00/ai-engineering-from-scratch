import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lab


class LabTest(unittest.TestCase):
    def test_the_reference_answers_pass(self):
        self.assertTrue(all(status == "PASS" for _, _, status in lab.grade(lab.expected())))

    def test_the_blank_sheet_has_every_task(self):
        blank = json.loads(lab.ANSWERS.read_text(encoding="utf-8"))
        self.assertEqual(sorted(blank), sorted(key for key, _, _ in lab.TASKS))
        self.assertTrue(all(status == "TODO" for _, _, status in lab.grade(blank)))

    def test_a_wrong_answer_fails(self):
        answers = lab.expected()
        first = lab.TASKS[0][0]
        answers[first] = "not the answer"
        self.assertEqual(dict((key, status) for key, _, status in lab.grade(answers))[first], "FAIL")

    def test_a_boolean_never_passes_for_a_number(self):
        answers = lab.expected()
        numbers = [key for key, value in answers.items() if isinstance(value, int) and not isinstance(value, bool) and value in (0, 1)]
        for key in numbers:
            answers[key] = bool(answers[key])
            self.assertEqual(dict((k, status) for k, _, status in lab.grade(answers))[key], "FAIL")


if __name__ == "__main__":
    unittest.main()
