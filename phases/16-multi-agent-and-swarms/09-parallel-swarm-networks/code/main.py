"""Swarm architecture demo: worker が共有 queue から task を pull する。

所要時間がばらつく workload で、3つの scheduling strategy を比較する:
  - sequential (1 worker がすべての task を処理)
  - fixed assignment (各 task を特定 worker に事前割り当て)
  - swarm (4 workers が共有 queue から pull)

swarm は load を自動で balance する。fixed assignment では速い worker が idle になる。
"""
from __future__ import annotations

import queue
import threading
import time
from dataclasses import dataclass


@dataclass
class Task:
    task_id: int
    duration: float
    pre_assigned: int  # for the fixed-assignment baseline


def fake_work(task: Task) -> str:
    time.sleep(task.duration)
    return f"task-{task.task_id}-done"


def run_sequential(tasks: list[Task]) -> tuple[float, dict[int, int]]:
    t0 = time.time()
    counts: dict[int, int] = {0: 0}
    for t in tasks:
        fake_work(t)
        counts[0] += 1
    return time.time() - t0, counts


def run_fixed_assignment(tasks: list[Task], n_workers: int) -> tuple[float, dict[int, int]]:
    """各 task は worker id に事前割り当てされる。worker は自分の task を直列処理する。"""
    per_worker: dict[int, list[Task]] = {i: [] for i in range(n_workers)}
    for t in tasks:
        per_worker[t.pre_assigned].append(t)
    counts: dict[int, int] = {i: 0 for i in range(n_workers)}

    def worker(wid: int) -> None:
        for t in per_worker[wid]:
            fake_work(t)
            counts[wid] += 1

    t0 = time.time()
    threads = [threading.Thread(target=worker, args=(i,)) for i in range(n_workers)]
    for th in threads:
        th.start()
    for th in threads:
        th.join()
    return time.time() - t0, counts


def run_swarm(tasks: list[Task], n_workers: int) -> tuple[float, dict[int, int]]:
    """worker が共有 queue から pull する。"""
    q: queue.Queue = queue.Queue()
    for t in tasks:
        q.put(t)
    counts: dict[int, int] = {i: 0 for i in range(n_workers)}
    lock = threading.Lock()

    def worker(wid: int) -> None:
        while True:
            try:
                task = q.get_nowait()
            except queue.Empty:
                return
            fake_work(task)
            with lock:
                counts[wid] += 1
            q.task_done()

    t0 = time.time()
    threads = [threading.Thread(target=worker, args=(i,)) for i in range(n_workers)]
    for th in threads:
        th.start()
    for th in threads:
        th.join()
    return time.time() - t0, counts


def make_tasks(n_workers: int = 4) -> list[Task]:
    """8 task: 半分は fast (0.1s)、半分は slow (0.4s)。
    事前割り当ては最悪ケースで、worker 0 がすべての slow task を取り、他は fast task を取る。"""
    tasks: list[Task] = []
    for i in range(8):
        is_slow = i < 4
        tasks.append(
            Task(
                task_id=i,
                duration=0.4 if is_slow else 0.1,
                pre_assigned=0 if is_slow else (i - 3) % n_workers,
            )
        )
    return tasks


def main() -> None:
    print("Swarm architecture demo - 所要時間がばらつく workload")
    print("-" * 56)
    n_workers = 4

    tasks = make_tasks(n_workers)
    total_work = sum(t.duration for t in tasks)
    print(f"{len(tasks)} tasks, 4 slow (0.4s) + 4 fast (0.1s)")
    print(f"総 work-seconds: {total_work:.2f}s")
    print(f"{n_workers} workers での理想 parallel time: {total_work / n_workers:.2f}s")

    seq_time, seq_counts = run_sequential(tasks)
    print(f"\nSequential (1 worker):      wall={seq_time:.2f}s, counts={seq_counts}")

    fixed_time, fixed_counts = run_fixed_assignment(tasks, n_workers)
    print(f"Fixed assignment ({n_workers} workers): wall={fixed_time:.2f}s, counts={fixed_counts}")
    print("  worker 0 が 4 つの slow task をすべて取得。他 worker は fast task 後に idle。")

    swarm_time, swarm_counts = run_swarm(tasks, n_workers)
    print(f"Swarm ({n_workers} workers):            wall={swarm_time:.2f}s, counts={swarm_counts}")
    print("  load は自動で balance される。slow task を終えた worker から、fast worker が次の job を pull。")

    speedup_vs_seq = seq_time / swarm_time if swarm_time > 0 else float("inf")
    speedup_vs_fixed = fixed_time / swarm_time if swarm_time > 0 else float("inf")
    print(f"\nSwarm speedup vs sequential: {speedup_vs_seq:.2f}x")
    print(f"Swarm speedup vs fixed:      {speedup_vs_fixed:.2f}x")
    print("\nTakeaway: duration がばらつき、assignment 予測が難しいとき swarm は勝つ。")
    print("Tradeoff: central trace がないため、debug には task ごとの ID と durable log が必要。")


if __name__ == "__main__":
    main()
