import json
import re

from env import db_hash

NUM = re.compile(r"-?\d[\d,]*\.?\d*")
TOL = {"chain": 1e-2, "multiturn": 1e-2, "sql": 1e-3, "retrieval": 1e-3}
PARSE_ERRORS = ("JSONDecodeError", "OutputParserException", "error parsing tool call", "ValidationError", "invalid character")


def norm(s):
    return re.sub(r"\s+", " ", re.sub(r"[\"'`.]", "", str(s))).strip().casefold()


def to_num(s):
    m = NUM.search(str(s).replace(" ", ""))
    return float(m.group().replace(",", "")) if m else None


def answer_ok(task, ans):
    if ans is None:
        return False
    truth = task["answer"]
    if task.get("answer_kind") == "num":
        v, t = to_num(ans), float(truth)
        if v is None:
            return False
        return abs(v - t) <= max(TOL.get(task["family"], 1e-3) * abs(t), 0.006)
    a, t = norm(ans), norm(truth)
    return a == t or (t in a and len(a) <= len(t) + 15)


def text_answer_ok(task, text):
    if not text:
        return False
    if task.get("answer_kind") == "num":
        t = float(task["answer"])
        tol = max(TOL.get(task["family"], 1e-3) * abs(t), 0.006)
        return any(abs(float(m.replace(",", "")) - t) <= tol for m in NUM.findall(text.replace("\u00a0", "")) if m.replace(",", "").replace(".", "").lstrip("-"))
    return norm(task["answer"]) in norm(text)


def kv_ok(expected, actual, list_keys=()):
    if set(expected) != set(actual):
        return False
    for k, v in expected.items():
        got = actual[k]
        if k in list_keys:
            if sorted(x.strip().casefold() for x in v.split(",") if x.strip()) != sorted(x.strip().casefold() for x in re.split(r"[,\n;]", str(got)) if x.strip()):
                return False
        elif to_num(v) is not None and re.fullmatch(r"-?\d+(\.\d+)?", v):
            if to_num(got) is None or abs(to_num(got) - float(v)) > 1e-6 or not re.fullmatch(r"\s*-?[\d.,]+\s*\w{0,4}\s*", str(got)):
                return False
        elif norm(got) != norm(v):
            return False
    return True


def fs_norm(state):
    return {k: v.replace("\r\n", "\n").rstrip("\n") for k, v in state.items()}


def text_tool_call(messages):
    for m in messages:
        if getattr(m, "type", "") == "ai" and not getattr(m, "tool_calls", None):
            c = m.content if isinstance(m.content, str) else json.dumps(m.content)
            if re.search(r'"(name|function)"\s*:\s*"\w+"', c) or "<tool_call>" in c:
                return True
    return False


def attempted_calls(messages):
    out = []
    for m in messages:
        for tc in getattr(m, "tool_calls", None) or []:
            out.append(tc["name"])
    return out


def final_text(messages):
    for m in reversed(messages):
        if getattr(m, "type", "") == "ai":
            c = m.content
            if isinstance(c, list):
                c = " ".join(b.get("text", "") for b in c if isinstance(b, dict))
            return c or ""
    return ""


def check(task, env, messages, error, allowed_tools):
    checks = {}
    log = env.log
    called = [e["tool"] for e in log]
    attempted = attempted_calls(messages)
    fam = task["family"]
    for r in task.get("required", []):
        key = r["tool"] + (f"({r['value']})" if "value" in r else "")
        if "value" in r:
            checks[key] = any(e["tool"] == r["tool"] and e["ok"] and str(e["args"].get(r["arg"], "")).strip().casefold() == r["value"] for e in log)
        else:
            checks[key] = any(e["tool"] == r["tool"] and e["ok"] for e in log)
    if fam == "retrieval":
        d = task["support_doc"]
        checks["support_doc_seen"] = any((e["tool"] == "read_doc" and e["ok"] and e["args"].get("doc_id", "").strip() == d) or
                                         (e["tool"] == "search_docs" and f'"{d}"' in e["result"]) for e in log)
    if fam == "sql":
        checks["db_unchanged"] = db_hash() == env.db_hash_before
    if fam == "files":
        checks["fs_state"] = fs_norm(env.fs_state()) == fs_norm(task["fs_expected"])
    if fam == "multiturn":
        checks["kv_state"] = kv_ok(task["kv_expected"], env.kv, task.get("kv_list_keys", ()))
    needs_answer = task.get("answer") is not None
    ans = env.answers[-1] if env.answers else None
    answer_source = None
    ft_all = final_text(messages)
    if needs_answer:
        checks["answer_submitted"] = ans is not None
        if ans is not None:
            answer_source = "submit"
            checks["answer_correct"] = answer_ok(task, ans)
        else:
            looks_like_call = bool(re.search(r"\b(submit_answer|" + "|".join(map(re.escape, allowed_tools)) + r")\s*\(", ft_all)) or text_tool_call(messages[-1:])
            ok_text = (not looks_like_call) and error is None and text_answer_ok(task, ft_all)
            answer_source = "text" if ok_text else None
            checks["answer_correct"] = ok_text
    strict_checks = dict(checks)
    checks.pop("answer_submitted", None)
    passed = error is None and all(checks.values())
    passed_strict = error is None and all(strict_checks.values())
    category, detail = None, None
    if not passed:
        bad_names = [n for n in attempted if n not in allowed_tools]
        arg_errors = [e for e in log if not e["ok"]] + [m for m in messages if getattr(m, "type", "") == "tool" and str(m.content).startswith("Error invoking tool")]
        req_missing = [k for k, v in checks.items() if not v and k not in ("answer_submitted", "answer_correct", "fs_state", "kv_state", "db_unchanged")]
        if error is not None:
            en = type(error).__name__
            es = f"{en}: {error}"
            if en == "StepLimit" or en == "GraphRecursionError":
                category = "loop_step_limit"
            elif any(p in es for p in PARSE_ERRORS):
                category = "parse_error"
            else:
                category = "harness_error"
            detail = es[:300]
        elif text_tool_call(messages) and not log:
            category, detail = "malformed_output", "tool call emitted as text"
        elif bad_names and fam != "files":
            category, detail = "wrong_tool", f"called unknown tools {sorted(set(bad_names))}"
        elif req_missing:
            tools_missing = [k for k in req_missing if k.split("(")[0] not in called and k != "support_doc_seen"]
            if tools_missing:
                category, detail = "wrong_tool", f"never called {tools_missing}"
            else:
                category, detail = "wrong_args", f"required lookups failed {req_missing}"
        elif needs_answer and ans is None:
            if looks_like_call or text_tool_call(messages):
                category, detail = "malformed_output", "tool call emitted as text"
            elif not ft_all.strip() or re.search(r"\b(cannot|can't|unable|not able|don't have|do not have|no access|sorry|not available|not found|does not exist|could you|please provide)\b", ft_all, re.I):
                category, detail = "gave_up", ft_all[:200]
            else:
                category, detail = "wrong_final_state", "wrong answer in final text: " + ft_all[:160]
        else:
            category = "wrong_final_state"
            parts = [k for k, v in checks.items() if not v]
            if bad_names:
                parts.append(f"used tools outside the task set {sorted(set(bad_names))}")
            if arg_errors:
                parts.append(f"{len(arg_errors)} tool errors")
            detail = ", ".join(parts)
    return {"passed": passed, "passed_strict": passed_strict, "answer_source": answer_source, "checks": strict_checks, "category": category, "detail": detail,
            "answer": ans, "tool_calls_executed": len(log), "tool_calls_attempted": len(attempted),
            "tool_errors": sum(1 for e in log if not e["ok"]), "tool_seq": attempted[:40], "final_text": final_text(messages)[:300]}
