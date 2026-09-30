"""Fill in the stage interfaces in your own workspace."""


def validate_cases(cases):
    raise NotImplementedError("validate_cases")


def score_response(response, checks):
    raise NotImplementedError("score_response")


def compare(cases, baseline, candidate):
    raise NotImplementedError("compare")


def release_gate(report, min_pass=1.0, max_regressions=0):
    raise NotImplementedError("release_gate")
