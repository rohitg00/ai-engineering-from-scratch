import contextlib
import importlib.util
import io
import json
import math
import os
import sys
import time
import traceback
import types
import warnings

import numpy as np

LAYERS = ("examples", "properties", "edge", "reference")
LAYER_TITLES = {
    "examples": "Examples",
    "properties": "Properties",
    "edge": "Edge cases",
    "reference": "Reference",
}
MAX_TEXT = 1200
MAX_OUTPUT = 4000
MAX_PROGRESS = 5000
MAX_CURVE = 400
SUPPORT = "support"

_checks = []
_fixture_makers = {}
_fixture_data = {}
_progress = []
_sink = [None]
_problem_dir = [None]


class CheckFailed(Exception):
    def __init__(self, message, expected=None, actual=None):
        super().__init__(message)
        self.message = message
        self.expected = expected
        self.actual = actual


def reset():
    _checks.clear()
    _fixture_makers.clear()
    _fixture_data.clear()
    _progress.clear()


def set_sink(fn):
    _sink[0] = fn


def report(step, value, name="loss"):
    point = (int(step), float(value), str(name))
    if len(_progress) < MAX_PROGRESS:
        _progress.append(point)
    if _sink[0] is not None:
        _sink[0](point[0], point[1], point[2])


def clear_progress():
    _progress.clear()


def progress(name=None):
    return [point for point in _progress if name is None or point[2] == name]


def curve():
    points = [[step, value if math.isfinite(value) else None, name] for step, value, name in _progress]
    if len(points) <= MAX_CURVE:
        return points
    stride = len(points) / MAX_CURVE
    return [points[int(i * stride)] for i in range(MAX_CURVE)] + [points[-1]]


def use_problem_dir(path):
    path = os.path.abspath(path)
    if _problem_dir[0] and _problem_dir[0] in sys.path:
        sys.path.remove(_problem_dir[0])
    sys.path.insert(0, path)
    _problem_dir[0] = path
    sys.modules.pop(SUPPORT, None)


def load_tests(tests_path):
    use_problem_dir(os.path.dirname(tests_path))
    return load_module(tests_path, "practice_tests")


def check(layer, name, explain):
    if layer not in LAYERS:
        raise ValueError(f"unknown layer {layer!r}")

    def register(fn):
        _checks.append({"layer": layer, "name": name, "explain": explain, "fn": fn})
        return fn

    return register


def fixture(name):
    def register(fn):
        _fixture_makers[name] = fn
        return fn

    return register


def describe(value):
    if isinstance(value, np.ndarray) and value.ndim == 0:
        value = value.item()
    if isinstance(value, np.ndarray):
        body = np.array2string(value, precision=6, threshold=60, edgeitems=3, suppress_small=False, max_line_width=88)
        text = f"array shape {tuple(value.shape)} dtype {value.dtype}\n{body}"
    elif isinstance(value, float):
        text = repr(round(value, 10))
    elif isinstance(value, (list, tuple)) and len(value) > 40:
        text = repr(type(value)(value[:40]))[:-1] + ", ...]"
    else:
        text = repr(value)
    return text if len(text) <= MAX_TEXT else text[:MAX_TEXT] + " ..."


def fail(message, expected=None, actual=None):
    raise CheckFailed(message, expected, actual)


def true(condition, message, expected=None, actual=None):
    if not condition:
        raise CheckFailed(message, expected, actual)


def as_array(value, what):
    try:
        return np.asarray(value, dtype=float)
    except (TypeError, ValueError):
        raise CheckFailed(f"Wrong type for {what}: expected numbers, got {type(value).__name__}", None, value)


def close(actual, expected, rtol=1e-6, atol=1e-8, what="the output"):
    expected_array = np.asarray(expected, dtype=float)
    if actual is None:
        raise CheckFailed(f"No value for {what}. The function returned None.", expected_array, actual)
    actual_array = as_array(actual, what)
    if actual_array.shape != expected_array.shape:
        raise CheckFailed(f"Wrong shape for {what}: got {actual_array.shape}, expected {expected_array.shape}", expected_array, actual_array)
    if not np.all(np.isfinite(actual_array) == np.isfinite(expected_array)):
        raise CheckFailed(f"NaN or infinite values in {what} where the expected values are finite", expected_array, actual_array)
    if not np.allclose(actual_array, expected_array, rtol=rtol, atol=atol, equal_nan=True):
        diff = np.abs(np.nan_to_num(actual_array) - np.nan_to_num(expected_array))
        worst = float(np.max(diff)) if diff.size else 0.0
        raise CheckFailed(f"Not close to the expected value for {what}. Largest difference: {worst:.3g}", expected_array, actual_array)


def equal(actual, expected, what="the output"):
    if isinstance(expected, np.ndarray) or isinstance(actual, np.ndarray):
        same = np.array_equal(np.asarray(actual), np.asarray(expected))
    else:
        same = actual == expected
    if not same:
        raise CheckFailed(f"Not equal to the expected value for {what}", expected, actual)


def shape(actual, expected_shape, what="the output"):
    if actual is None:
        raise CheckFailed(f"No value for {what}. The function returned None.", expected_shape, None)
    got = tuple(np.shape(actual))
    if got != tuple(expected_shape):
        raise CheckFailed(f"Wrong shape for {what}: got {got}, expected {tuple(expected_shape)}", tuple(expected_shape), got)


def raises(error_type, fn, *args, **kwargs):
    try:
        fn(*args, **kwargs)
    except error_type:
        return
    except Exception as error:
        raise CheckFailed(f"expected {error_type.__name__}, the code raised {type(error).__name__}: {error}", error_type.__name__, type(error).__name__)
    raise CheckFailed(f"expected {error_type.__name__}, the code returned without an error", error_type.__name__, "no error")


def numeric_grad(f, x, eps=1e-6):
    x = np.array(x, dtype=float)
    grad = np.zeros_like(x)
    flat = x.reshape(-1)
    out = grad.reshape(-1)
    for i in range(flat.size):
        saved = flat[i]
        flat[i] = saved + eps
        plus = float(f(x))
        flat[i] = saved - eps
        minus = float(f(x))
        flat[i] = saved
        out[i] = (plus - minus) / (2 * eps)
    return grad


def encode(value):
    if isinstance(value, np.ndarray):
        if value.dtype.kind in "fc":
            data = value.astype(float).tolist()
        else:
            data = value.tolist()
        return {"__nd__": data, "dtype": str(value.dtype), "shape": list(value.shape)}
    if isinstance(value, np.generic):
        return value.item()
    if isinstance(value, dict):
        return {"__dict__": [[encode(k), encode(v)] for k, v in value.items()]}
    if isinstance(value, tuple):
        return {"__tuple__": [encode(v) for v in value]}
    if isinstance(value, list):
        return [encode(v) for v in value]
    return value


def decode(value):
    if isinstance(value, dict):
        if "__nd__" in value:
            return np.array(value["__nd__"], dtype=value["dtype"]).reshape(value["shape"])
        if "__tuple__" in value:
            return tuple(decode(v) for v in value["__tuple__"])
        if "__dict__" in value:
            return {decode(k): decode(v) for k, v in value["__dict__"]}
        return {k: decode(v) for k, v in value.items()}
    if isinstance(value, list):
        return [decode(v) for v in value]
    return value


def build_fixtures(reference):
    out = {}
    for name, maker in _fixture_makers.items():
        out[name] = [[encode(args), encode(result)] for args, result in maker(reference)]
    return out


def load_fixtures(data):
    _fixture_data.clear()
    _fixture_data.update(data or {})


def fixtures(name):
    if name not in _fixture_data:
        raise CheckFailed(f"the fixture file has no cases named {name!r}. Run the validator with --write.")
    return [(decode(args), decode(result)) for args, result in _fixture_data[name]]


def load_module(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def load_source(source, name="submission", filename="submission.py"):
    module = types.ModuleType(name)
    module.__file__ = filename
    sys.modules[name] = module
    code = compile(source, filename, "exec")
    exec(code, module.__dict__)
    return module


def user_trace(error, filename="submission.py"):
    frames = [frame for frame in traceback.extract_tb(error.__traceback__) if frame.filename.endswith(filename)]
    where = f" (line {frames[-1].lineno} of your code)" if frames else ""
    return f"{type(error).__name__}: {error}{where}"


def selected(layers):
    wanted = set(layers) if layers else set(LAYERS)
    order = {layer: index for index, layer in enumerate(LAYERS)}
    return sorted([item for item in _checks if item["layer"] in wanted], key=lambda item: order[item["layer"]])


def run_checks(submission, layers=None, deadline=None):
    results = []
    for item in selected(layers):
        result = {"layer": item["layer"], "name": item["name"], "explain": item["explain"], "status": "pass", "message": "", "expected": None, "actual": None}
        if deadline is not None and time.monotonic() > deadline:
            result["status"] = "skip"
            result["message"] = "Not run. The time limit ended before this check."
            results.append(result)
            continue
        started = time.monotonic()
        try:
            item["fn"](submission)
        except CheckFailed as failed:
            result["status"] = "fail"
            result["message"] = failed.message
            result["expected"] = None if failed.expected is None else describe(failed.expected)
            result["actual"] = None if failed.actual is None else describe(failed.actual)
        except NotImplementedError:
            result["status"] = "fail"
            result["message"] = "Not implemented yet. Replace the raise NotImplementedError line with your code."
        except BaseException as error:
            result["status"] = "error"
            result["message"] = user_trace(error)
        result["ms"] = round((time.monotonic() - started) * 1000, 1)
        results.append(result)
    return results


def load_failure(error):
    if isinstance(error, SyntaxError):
        return f"SyntaxError: {error.msg} (line {error.lineno} of your code)"
    return f"Your code did not load. {user_trace(error)}"


def summary(results):
    counts = {"pass": 0, "fail": 0, "error": 0, "skip": 0}
    for result in results:
        counts[result["status"]] += 1
    return {"total": len(results), "passed": counts["pass"], "failed": counts["fail"] + counts["error"] + counts["skip"], "ok": bool(results) and counts["pass"] == len(results)}


def evaluate(source, tests_path, fixtures_data, layers=None, limit_s=None):
    reset()
    load_tests(tests_path)
    load_fixtures(fixtures_data)
    deadline = time.monotonic() + limit_s if limit_s else None
    output = io.StringIO()
    with contextlib.redirect_stdout(output), warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        load_error = ""
        try:
            submission = load_source(source)
        except BaseException as error:
            load_error = load_failure(error)
            results = [{"layer": item["layer"], "name": item["name"], "explain": item["explain"], "status": "error", "message": load_error, "expected": None, "actual": None} for item in selected(layers)]
        else:
            results = run_checks(submission, layers, deadline)
    return {"results": results, "summary": summary(results), "load_error": load_error, "stdout": clip(output.getvalue()), "warnings": warning_list(caught), "curve": curve()}


def warning_list(caught):
    seen = []
    for item in caught:
        text = f"{item.category.__name__}: {item.message}"
        if text not in seen:
            seen.append(text)
    return seen[:10]


def clip(text):
    return text if len(text) <= MAX_OUTPUT else text[:MAX_OUTPUT] + "\n..."


def evaluate_json(source, tests_path, fixtures_text, layers_text="", limit_s=0):
    layers = [layer for layer in layers_text.split(",") if layer] or None
    data = json.loads(fixtures_text) if fixtures_text else {}
    return json.dumps(evaluate(source, tests_path, data, layers, limit_s or None), allow_nan=False)

