import argparse
import json
import time
import uuid

from pydantic import BaseModel, Field

from checks import NUM, answer_ok, final_text, norm, text_answer_ok
from env import BENCH, FAMILY_TOOLS, Env, build_tools
from harnesses import SYSTEM_PROMPT, CreateAgent
from models import BudgetExceeded, Meter, make_model
from run import load_tasks, uptime

SO_PROMPT = SYSTEM_PROMPT.replace(
    "When the user asks a question, call submit_answer exactly once with only the final answer value. ",
    "When the user asks a question, finish with the final answer value. ")
assert SO_PROMPT != SYSTEM_PROMPT


class FinalAnswer(BaseModel):
    answer: str = Field(description="Only the final answer value: a number or a name, with no units and no explanation.")


def extract_last(task, text):
    if task["answer_kind"] == "num":
        nums = [m for m in NUM.findall(text) if m.replace(",", "").replace(".", "").lstrip("-")]
        return nums[-1] if nums else None
    return text


def strategy(name):
    from langchain.agents.structured_output import ProviderStrategy, ToolStrategy
    return {"none": None, "extract": None, "tool": ToolStrategy(FinalAnswer), "provider": ProviderStrategy(FinalAnswer)}[name]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", required=True)
    ap.add_argument("--tasks", default="chain,sql")
    ap.add_argument("--variants", default="none,extract,tool,provider")
    ap.add_argument("--out", default="structured.jsonl")
    ap.add_argument("--max-tokens", type=int, default=1024)
    ap.add_argument("--run-token-cap", type=int, default=None)
    a = ap.parse_args()
    out = BENCH / "runs" / a.out
    done = set()
    if out.exists():
        for l in out.read_text().splitlines():
            r = json.loads(l)
            done.add((r["task_id"], r["model"], r["variant"]))
    tasks = load_tasks(a.tasks)
    log = open(BENCH / "logs" / "loads.log", "a")
    run_id = uuid.uuid4().hex[:8]
    for spec in a.models.split(","):
        model, meta = make_model(spec, a.max_tokens)
        tagname = meta.get("tag") or meta.get("model")
        if meta["provider"] == "ollama":
            model.invoke("Say ok.")
        run_tokens = 0
        for var in a.variants.split(","):
            up = uptime()
            log.write(f"{time.strftime('%H:%M:%S')} structured block model={spec} variant={var} :: {up}\n")
            log.flush()
            print(f"== {spec} {var} {up}", flush=True)
            for t in tasks:
                if (t["id"], tagname, var) in done:
                    continue
                env = Env(t)
                tools = build_tools(env, [n for n in FAMILY_TOOLS[t["family"]] if n != "submit_answer"])
                meter = Meter(10, provider=meta["provider"], model_name=meta.get("model"), cell=f"structured-{var}|{tagname}",
                              cell_token_cap=200000, run_token_cap=a.run_token_cap, run_tokens_so_far=run_tokens)
                err, msgs, sr, h = None, [], None, None
                t0 = time.perf_counter()
                try:
                    h = CreateAgent(model, tools, meter, response_format=strategy(var), system_prompt=SO_PROMPT)
                    res = h.graph.invoke({"messages": [{"role": "user", "content": t["turns"][0]}]}, h.cfg)
                    msgs = res["messages"]
                    sr = res.get("structured_response")
                except BudgetExceeded as e:
                    print("BUDGET STOP:", e, flush=True)
                    return
                except Exception as e:
                    err = e
                    msgs = h.state_messages() if h is not None else []
                wall = time.perf_counter() - t0
                ft = final_text(msgs)
                if var == "none":
                    value = extract_last(t, ft)
                    present = bool(ft.strip())
                elif var == "extract":
                    value, present = None, False
                    if err is None and ft.strip():
                        try:
                            ex = model.with_structured_output(FinalAnswer).invoke(
                                [{"role": "system", "content": "Extract the final answer value from the assistant reply. Return only the value."},
                                 {"role": "user", "content": f"Question: {t['turns'][0]}\n\nAssistant reply: {ft}"}], config={"callbacks": [meter]})
                            value = ex.answer if isinstance(ex, FinalAnswer) else (ex or {}).get("answer")
                            present = value is not None
                        except Exception as e:
                            err = e
                else:
                    value = sr.answer if isinstance(sr, FinalAnswer) else (sr.get("answer") if isinstance(sr, dict) else None)
                    present = value is not None
                lookups_ok = all(any(e["tool"] == r["tool"] and e["ok"] and ("value" not in r or str(e["args"].get(r["arg"], "")).strip().casefold() == r["value"]) for e in env.log) for r in t.get("required", []))
                row = {"run_id": run_id, "ts": time.strftime("%Y-%m-%dT%H:%M:%S"), "task_id": t["id"], "family": t["family"], "model": tagname, "variant": var, "cost_usd": round(sum(c.get("cost", 0) for c in meter.calls), 6),
                       "answer_present": present, "value": None if value is None else str(value)[:200], "truth": t["answer"],
                       "correct": err is None and lookups_ok and value is not None and answer_ok(t, value),
                       "correct_any_number_in_text": err is None and lookups_ok and text_answer_ok(t, ft if var == "none" else str(value)),
                       "value_is_bare": value is not None and (norm(value) == norm(t["answer"]) if t["answer_kind"] == "str" else bool(__import__("re").fullmatch(r"\s*-?[\d,]*\.?\d+\s*", str(value)))),
                       "lookups_ok": lookups_ok, "model_calls": len(meter.calls), "tool_calls": len(env.log),
                       "in_tokens": sum(c.get("in", 0) for c in meter.calls), "out_tokens": sum(c.get("out", 0) for c in meter.calls),
                       "wall_s": round(wall, 3), "model_s": round(sum(c["dt"] for c in meter.calls), 3),
                       "tool_seq": [tc["name"] for m in msgs for tc in (getattr(m, "tool_calls", None) or [])][:30],
                       "final_text": ft[:300], "error": None if err is None else f"{type(err).__name__}: {str(err)[:300]}"}
                env.close()
                run_tokens += row["in_tokens"] + row["out_tokens"]
                with open(out, "a") as f:
                    f.write(json.dumps(row, default=str) + "\n")
                print(f"{t['id']} {var} {'OK ' if row['correct'] else 'bad'} present={present} value={row['value']!r:.40} truth={t['answer']} calls={row['model_calls']} {row['error'] or ''}"[:220], flush=True)


if __name__ == "__main__":
    main()
