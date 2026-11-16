import asyncio, json, os, sys, time, warnings
warnings.filterwarnings("ignore")
os.environ["LANGSMITH_TRACING"] = "false"
from langchain.agents import create_agent
from langchain_ollama import ChatOllama

async def one(agent, order):
    t0 = time.time_ns()
    ev = {"reasoning": [], "text": []}
    stream = await agent.astream_events({"messages": [{"role": "user", "content": "What is 17*23? Then count from 1 to 20."}]}, version="v3")
    async for m in stream.messages:
        for proj in order:
            async for d in getattr(m, proj):
                if d:
                    ev[proj].append((time.time_ns() - t0) / 1e6)
    await stream.output()
    return ev

def stats(ts):
    if len(ts) < 2:
        return {"n": len(ts)}
    g = [ts[i] - ts[i - 1] for i in range(1, len(ts))]
    return {"n": len(ts), "first_ms": round(ts[0]), "last_ms": round(ts[-1]), "burst_frac": round(sum(1 for x in g if x < 2) / len(g), 3)}

async def main():
    agent = create_agent(model=ChatOllama(model="qwen3:4b", reasoning=True, temperature=0, seed=42, num_predict=600), tools=[])
    out = open(sys.argv[1], "a")
    for rep in range(-1, int(sys.argv[2])):
        for order in (["reasoning", "text"], ["text", "reasoning"]):
            ev = await one(agent, order)
            r = {"rep": rep, "warmup": rep < 0, "order": order, "load": os.getloadavg(), "reasoning": stats(ev["reasoning"]), "text": stats(ev["text"])}
            out.write(json.dumps(r) + "\n"); out.flush(); print(json.dumps(r), flush=True)

asyncio.run(main())
