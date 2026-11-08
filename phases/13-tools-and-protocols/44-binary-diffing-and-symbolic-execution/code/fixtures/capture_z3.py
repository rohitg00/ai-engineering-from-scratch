import json
import sys
import time
from pathlib import Path

import z3

HERE = Path(__file__).resolve().parent
TABLE = [1, 2, 3, 4, 4]


def to_signed(model_value, width=32):
    value = model_value.as_long()
    return value - (1 << width) if value & (1 << (width - 1)) else value


def grade_listing(score):
    rax = z3.SignExt(32, score)
    rax = rax * z3.BitVecVal(0x66666667, 64)
    rcx = rax >> 34
    rax = z3.LShR(rax, 63)
    ecx = z3.Extract(31, 0, rcx) + z3.Extract(31, 0, rax)
    ecx = ecx - 6
    result = z3.BitVecVal(0, 32)
    for index in range(len(TABLE) - 1, -1, -1):
        result = z3.If(ecx == index, z3.BitVecVal(TABLE[index], 32), result)
    return z3.If(z3.UGT(ecx, 4), z3.BitVecVal(0, 32), result)


def grade_source(score):
    quotient = score / 10
    result = z3.BitVecVal(0, 32)
    for case, value in ((10, 4), (9, 4), (8, 3), (7, 2), (6, 1)):
        result = z3.If(quotient == case, z3.BitVecVal(value, 32), result)
    return result


def grade_thresholds(score):
    result = z3.BitVecVal(0, 32)
    for limit, value in ((60, 1), (70, 2), (80, 3), (90, 4)):
        result = z3.If(score >= limit, z3.BitVecVal(value, 32), result)
    return result


def percent_change_listing(before, after):
    return z3.If(before == 0, z3.BitVecVal(0, 32), ((after - before) * 100) / before)


def percent_change_long(before, after):
    wide_before = z3.SignExt(32, before)
    wide_after = z3.SignExt(32, after)
    quotient = ((wide_after - wide_before) * 100) / wide_before
    return z3.If(before == 0, z3.BitVecVal(0, 32), z3.Extract(31, 0, quotient))


def check(*constraints):
    solver = z3.Solver()
    solver.add(*constraints)
    start = time.perf_counter()
    verdict = solver.check()
    seconds = round(time.perf_counter() - start, 3)
    model = solver.model() if verdict == z3.sat else None
    return verdict, model, seconds


def signed_extreme(variable, constraints, lowest):
    low, high = -(1 << 31), (1 << 31) - 1
    best = None
    while low <= high:
        middle = (low + high) // 2
        bound = variable <= middle if lowest else variable >= middle
        verdict, _, _ = check(*constraints, bound)
        if verdict == z3.sat:
            best = middle
            if lowest:
                high = middle - 1
            else:
                low = middle + 1
        elif lowest:
            low = middle + 1
        else:
            high = middle - 1
    return best


def grade_report():
    score = z3.BitVec("score", 32)
    classes = {}
    for value in range(5):
        constraints = [grade_listing(score) == value]
        verdict, model, seconds = check(*constraints)
        entry = {"verdict": str(verdict), "seconds": seconds}
        if verdict == z3.sat:
            entry["sample"] = to_signed(model[score])
            entry["min"] = signed_extreme(score, constraints, True)
            entry["max"] = signed_extreme(score, constraints, False)
        classes[str(value)] = entry
    inside, _, _ = check(score >= 60, score <= 109, grade_listing(score) == 0)
    above, _, _ = check(score >= 110, grade_listing(score) != 0)
    same_as_source, _, source_seconds = check(grade_listing(score) != grade_source(score))
    differs, model, _ = check(grade_listing(score) != grade_thresholds(score))
    agrees, _, _ = check(grade_listing(score) != grade_thresholds(score), score >= 0, score <= 109)
    return {
        "returns": classes,
        "crossChecks": {"scoreIn60to109ReturnsZero": str(inside), "scoreAtLeast110ReturnsNonZero": str(above)},
        "listingDiffersFromSourceSwitch": {"verdict": str(same_as_source), "seconds": source_seconds},
        "listingDiffersFromThresholds": {"verdict": str(differs), "score": to_signed(model[score]) if model else None},
        "listingDiffersFromThresholdsOn0to109": str(agrees),
    }


def percent_change_report():
    before = z3.BitVec("before", 32)
    after = z3.BitVec("after", 32)
    result = percent_change_listing(before, after)
    verdict, model, seconds = check(before != 0, result == 50)
    returns50 = {"verdict": str(verdict), "seconds": seconds}
    if model:
        returns50["before"] = to_signed(model[before])
        returns50["after"] = to_signed(model[after])
    verdict, model, _ = check(before == 3, result == -133)
    minus133 = {"verdict": str(verdict), "after": to_signed(model[after]) if model else None}
    pair_verdict, _, _ = check(before == 3, after == 2147483647, result == -133)
    verdict, model, _ = check(result != percent_change_long(before, after))
    long_differs = {"verdict": str(verdict)}
    if model:
        long_differs["before"] = to_signed(model[before])
        long_differs["after"] = to_signed(model[after])
    verdict, model, _ = check(result != percent_change_long(before, after), before != -1, z3.Not(z3.And(before == -1, (after - before) * 100 == -2147483648)))
    long_differs["withoutMinusOneAndTrap"] = str(verdict)
    return {
        "returns50": returns50,
        "before3ReturnsMinus133": minus133,
        "pair3And2147483647ReturnsMinus133": str(pair_verdict),
        "longRebuildDiffers": long_differs,
    }


def main():
    report = {
        "z3": z3.get_version_string(),
        "python": sys.version.split()[0],
        "grade": grade_report(),
        "percent_change": percent_change_report(),
    }
    out = HERE / "z3-runs.json"
    out.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
