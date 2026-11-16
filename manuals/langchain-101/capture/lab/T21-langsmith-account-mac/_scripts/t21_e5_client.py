import asyncio, json, sys, time, os
from langgraph_sdk import get_client
QS = [("What is 17 + 25?", "42"), ("What is 8 + 13?", "21"), ("What is 120 + 45?", "165"), ("What is 9 + 91?", "100"), ("What is 33 + 67?", "100")]
async def main(out):
    c = get_client(url="http://127.0.0.1:2025")
    rows = []
    for q, exp in QS:
        th = await c.threads.create()
        t = time.perf_counter()
        r = await c.runs.wait(th["thread_id"], "agent", input={"messages": [{"role": "user", "content": q}]}, config={"recursion_limit": 25})
        runs = await c.runs.list(th["thread_id"])
        ans = r["messages"][-1]["content"]
        rows.append({"q": q, "answer": ans, "correct": ans.strip() == exp, "client_s": round(time.perf_counter() - t, 3), "thread_id": th["thread_id"],
                     "server_run_id": runs[0]["run_id"], "load1": os.getloadavg()[0]})
        print(json.dumps(rows[-1]), flush=True)
    open(out, "w").write("\n".join(json.dumps(r) for r in rows) + "\n")
asyncio.run(main(sys.argv[1]))
