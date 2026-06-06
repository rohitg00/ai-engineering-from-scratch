"""Swarm architecture demo: workers pull from a shared queue.

Compares three scheduling strategies on a variable-duration workload:
  - sequential (1 worker processes all tasks)
  - fixed assignment (each task pre-assigned to a specific worker)
  - swarm (4 workers pull from a shared queue)

Swarm balances load automatically; fixed assignment leaves fast workers idle.
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
    """Each task is pre-assigned to worker id. Worker processes its tasks serially."""
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
    """Workers pull from a shared queue."""
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
    """8 tasks: half fast (0.1s), half slow (0.4s). Pre-assignment is pessimal:
    worker 0 gets all slow tasks, others get fast ones."""
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
    print("Swarm architecture demo — variable-duration workload")
    print("-" * 56)
    n_workers = 4

    tasks = make_tasks(n_workers)
    total_work = sum(t.duration for t in tasks)
    print(f"{len(tasks)} tasks, 4 slow (0.4s) + 4 fast (0.1s)")
    print(f"Total work-seconds: {total_work:.2f}s")
    print(f"Ideal parallel time with {n_workers} workers: {total_work / n_workers:.2f}s")

    seq_time, seq_counts = run_sequential(tasks)
    print(f"\nSequential (1 worker):      wall={seq_time:.2f}s, counts={seq_counts}")

    fixed_time, fixed_counts = run_fixed_assignment(tasks, n_workers)
    print(f"Fixed assignment ({n_workers} workers): wall={fixed_time:.2f}s, counts={fixed_counts}")
    print("  worker 0 got all 4 slow tasks; other workers idle after their fast ones.")

    swarm_time, swarm_counts = run_swarm(tasks, n_workers)
    print(f"Swarm ({n_workers} workers):            wall={swarm_time:.2f}s, counts={swarm_counts}")
    print("  load balances automatically — slow workers finish first, fast pull next job.")

    speedup_vs_seq = seq_time / swarm_time if swarm_time > 0 else float("inf")
    speedup_vs_fixed = fixed_time / swarm_time if swarm_time > 0 else float("inf")
    print(f"\nSwarm speedup vs sequential: {speedup_vs_seq:.2f}x")
    print(f"Swarm speedup vs fixed:      {speedup_vs_fixed:.2f}x")
    print("\nTakeaway: swarm wins when duration varies and assignment is hard to predict.")
    print("Tradeoff: no central trace; debugging requires per-task IDs and durable logs.")


if __name__ == "__main__":
    main()
