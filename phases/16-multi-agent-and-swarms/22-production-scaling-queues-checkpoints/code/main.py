"""Production scaling demo: checkpoints、queues、async vs threads。

すべて stdlib。CheckpointStore は SQLite を使う。AgentQueue は 3 states を持つ
per-agent state machine。async vs threads benchmark は 500 concurrent の
simulated LLM calls を走らせる。
"""
from __future__ import annotations

import asyncio
import enum
import json
import os
import sqlite3
import tempfile
import threading
import time
from dataclasses import dataclass, field


# ---------- CheckpointStore ----------

class CheckpointStore:
    def __init__(self, path: str) -> None:
        self.conn = sqlite3.connect(path)
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS checkpoints (
                thread_id TEXT NOT NULL,
                super_step INTEGER NOT NULL,
                state_json TEXT NOT NULL,
                PRIMARY KEY (thread_id, super_step)
            )
        """)

    def write(self, thread_id: str, super_step: int, state: dict) -> None:
        self.conn.execute(
            "INSERT OR REPLACE INTO checkpoints (thread_id, super_step, state_json) VALUES (?, ?, ?)",
            (thread_id, super_step, json.dumps(state)),
        )
        self.conn.commit()

    def latest(self, thread_id: str) -> tuple[int, dict] | None:
        row = self.conn.execute(
            "SELECT super_step, state_json FROM checkpoints WHERE thread_id = ? ORDER BY super_step DESC LIMIT 1",
            (thread_id,),
        ).fetchone()
        if row is None:
            return None
        return row[0], json.loads(row[1])


def run_agent_with_checkpoint(store: CheckpointStore, thread_id: str,
                              start: int = 0, crash_at: int | None = None, goal: int = 5) -> int:
    """小さな 5-step agent を走らせ、必要なら指定 step で crash させる。"""
    restored = store.latest(thread_id)
    if restored:
        super_step, state = restored
        super_step += 1
    else:
        super_step = 0
        state = {"counter": start}

    while state["counter"] < goal:
        if crash_at is not None and super_step == crash_at:
            print(f"    worker crashes at super_step={super_step}")
            raise RuntimeError("simulated crash")
        state["counter"] += 1
        store.write(thread_id, super_step, dict(state))
        super_step += 1
    return state["counter"]


# ---------- AgentQueue ----------

class AgentState(enum.Enum):
    IDLE = "idle"
    PROCESSING = "processing"
    RESPONSE = "response"


@dataclass
class AgentQueue:
    agent_id: str
    state: AgentState = AgentState.IDLE
    in_queue: list[dict] = field(default_factory=list)
    out_queue: list[dict] = field(default_factory=list)

    def enqueue(self, msg: dict) -> None:
        self.in_queue.append(msg)

    def step(self) -> None:
        if self.state == AgentState.IDLE and self.in_queue:
            self.state = AgentState.PROCESSING
        elif self.state == AgentState.PROCESSING:
            msg = self.in_queue.pop(0)
            self.out_queue.append({"reply_to": msg, "body": f"{self.agent_id} processed {msg}"})
            self.state = AgentState.RESPONSE
        elif self.state == AgentState.RESPONSE:
            self.state = AgentState.IDLE


def demo_queue() -> None:
    print("\n" + "=" * 72)
    print("PER-AGENT QUEUE — 3-state machine（idle / processing / response）")
    print("=" * 72)
    a = AgentQueue("agent-a")
    a.enqueue({"task": "compress logs"})
    a.enqueue({"task": "write summary"})
    print(f"  initial: {a.state.value}  in_queue={len(a.in_queue)}")
    for _ in range(7):
        a.step()
        print(f"  state={a.state.value:11s} in={len(a.in_queue)} out={len(a.out_queue)}")


# ---------- async vs threads ----------

async def sim_llm_call_async(delay: float = 0.05) -> None:
    await asyncio.sleep(delay)


def sim_llm_call_sync(delay: float = 0.05) -> None:
    time.sleep(delay)


async def bench_async(n: int) -> float:
    t0 = time.perf_counter()
    await asyncio.gather(*(sim_llm_call_async() for _ in range(n)))
    return time.perf_counter() - t0


def bench_threads(n: int) -> float:
    t0 = time.perf_counter()
    threads = [threading.Thread(target=sim_llm_call_sync) for _ in range(n)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    return time.perf_counter() - t0


def demo_async_vs_threads() -> None:
    print("\n" + "=" * 72)
    print("ASYNC vs THREADS — 500 concurrent 'LLM calls'（各 50ms）")
    print("=" * 72)

    async_elapsed = asyncio.run(bench_async(500))
    print(f"  async (asyncio):  {async_elapsed:.3f} s")

    thread_elapsed = bench_threads(500)
    print(f"  threads:          {thread_elapsed:.3f} s")

    print("  ratio: threads は {:.1f}x 遅い（かつ thread stack ごとに ~1MB 確保）".format(
        thread_elapsed / async_elapsed if async_elapsed > 0 else float("inf")
    ))


def demo_checkpoint_resume() -> None:
    print("=" * 72)
    print("CHECKPOINT RESUME — worker が mid-run で crash し、second worker が resume")
    print("=" * 72)
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = f.name
    try:
        store = CheckpointStore(db_path)

        print("  worker 1 が thread t-1 を開始し、counter=5 を target")
        try:
            run_agent_with_checkpoint(store, "t-1", crash_at=3, goal=5)
        except RuntimeError:
            pass

        last = store.latest("t-1")
        assert last is not None
        print(f"  last checkpoint: super_step={last[0]}, state={last[1]}")

        print("  worker 2 が thread t-1 を resume")
        final = run_agent_with_checkpoint(store, "t-1", goal=5)
        print(f"  worker 2 が完了。final counter = {final}")
    finally:
        os.unlink(db_path)


def main() -> None:
    demo_checkpoint_resume()
    demo_queue()
    demo_async_vs_threads()
    print("\n要点:")
    print("  durable execution = super-step ごとの state persist + idempotent resume。")
    print("  3-state machines を持つ per-agent queues は thousands of concurrent agents に scale します。")
    print("  async は I/O-bound LLM workloads にとって構造であり、単なる optimization ではありません。")
    print("  Bedi's rule: FastAPI + Postgres は多くの teams をカバーします。measured need で escalate します。")


if __name__ == "__main__":
    main()
