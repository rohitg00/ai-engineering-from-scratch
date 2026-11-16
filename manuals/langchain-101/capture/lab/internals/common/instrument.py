import copy
import json
import platform
import sys
import time
from collections import defaultdict
from contextlib import contextmanager

from langchain_core.messages import BaseMessage
from langgraph.checkpoint.base import writes_sort_key
from langgraph.pregel import _algo, _loop
from langgraph.pregel._algo import task_path_str
from langgraph.types import Send, Command, Interrupt

PIN = {
    "langgraph": "1.2.22 (tag 08a20169)",
    "langchain": "1.5.0",
    "langchain-core": "1.8.0",
    "langgraph-checkpoint": "4.3.2",
    "langgraph-checkpoint-sqlite": "3.1.3",
}


def machine():
    return {
        "name": "the x86 server guest",
        "platform": platform.platform(),
        "machine": platform.machine(),
        "python": sys.version.split()[0],
    }


def short_version(v):
    if isinstance(v, str) and "." in v:
        try:
            return int(v.split(".")[0])
        except ValueError:
            return v
    return v


def short_versions(d):
    return {k: short_version(v) for k, v in sorted(d.items())}


def summarize(v, depth=0):
    if isinstance(v, BaseMessage):
        s = f"{type(v).__name__}(id={str(v.id)[:12]}"
        if getattr(v, "tool_calls", None):
            s += f", tool_calls={[tc['name'] + ':' + str(tc['id']) for tc in v.tool_calls]}"
        if getattr(v, "tool_call_id", None):
            s += f", tool_call_id={v.tool_call_id}"
        text = v.text if isinstance(v.text, str) else str(v.text)
        if text:
            s += f", text={text[:40]!r}"
        return s + ")"
    if isinstance(v, Send):
        return f"Send(node={v.node!r}, arg={summarize(v.arg, depth + 1)})"
    if isinstance(v, Command):
        return f"Command(goto={v.goto!r}, update={summarize(v.update, depth + 1)}, graph={v.graph!r}, resume={v.resume!r})"
    if isinstance(v, Interrupt):
        return f"Interrupt(id={v.id[:12]}, value={v.value!r})"
    if isinstance(v, (list, tuple)):
        if depth > 2:
            return f"[{len(v)} items]"
        return [summarize(x, depth + 1) for x in v]
    if isinstance(v, dict):
        if depth > 2:
            return f"{{{len(v)} keys}}"
        return {str(k): summarize(x, depth + 1) for k, x in v.items()}
    if isinstance(v, BaseException):
        return f"{type(v).__name__}({v})"
    if v is None or isinstance(v, (int, float, bool)):
        return v
    s = str(v)
    return s if len(s) < 80 else s[:77] + "..."


def task_info(t):
    return {
        "name": t.name,
        "id": t.id[:8],
        "path": str(t.path[:3]),
        "kind": t.path[0],
        "triggers": list(t.triggers),
    }


class Recorder:
    def __init__(self):
        self.events = []
        self.t0 = time.perf_counter()
        self.timings = defaultdict(list)
        self.current_step = None

    def add(self, kind, **kw):
        ev = {"seq": len(self.events), "t_ms": round((time.perf_counter() - self.t0) * 1000, 3), "event": kind}
        ev.update(kw)
        self.events.append(ev)
        return ev

    def dump(self, path):
        with open(path, "w") as f:
            for e in self.events:
                f.write(json.dumps(e, default=str) + "\n")


@contextmanager
def instrument(rec, *, capture=True):
    saved = {}

    def patch(obj, name, new):
        saved[(obj, name)] = getattr(obj, name)
        setattr(obj, name, new)

    orig_prepare = _loop.prepare_next_tasks

    def prepare_next_tasks(checkpoint, pending_writes, processes, channels, managed, config, step, stop, **kw):
        t = time.perf_counter()
        r = orig_prepare(checkpoint, pending_writes, processes, channels, managed, config, step, stop, **kw)
        dt = time.perf_counter() - t
        rec.timings["prepare_next_tasks"].append(dt)
        if capture:
            rec.add(
                "prepare_next_tasks",
                step=step,
                stop=stop,
                for_execution=kw.get("for_execution"),
                updated_channels=sorted(kw.get("updated_channels") or []),
                pending_writes=[(tid[:8], ch, summarize(v)) for tid, ch, v in pending_writes],
                tasks=[task_info(x) for x in r.values()],
                versions_seen={k: short_versions(v) for k, v in checkpoint["versions_seen"].items()},
                dt_us=round(dt * 1e6, 1),
            )
        return r

    patch(_loop, "prepare_next_tasks", prepare_next_tasks)

    orig_apply = _loop.apply_writes

    def apply_writes(checkpoint, channels, tasks, get_next_version, trigger_to_nodes):
        tasks = list(tasks)
        before = dict(checkpoint["channel_versions"])
        seen_before = copy.deepcopy(checkpoint["versions_seen"])
        order = sorted(tasks, key=lambda t: writes_sort_key(task_path_str(t.path)))
        writes = [
            {"task": t.name, "path": str(t.path[:3]), "channel": ch, "value": summarize(v)}
            for t in order
            for ch, v in t.writes
        ]
        t = time.perf_counter()
        r = orig_apply(checkpoint, channels, tasks, get_next_version, trigger_to_nodes)
        dt = time.perf_counter() - t
        rec.timings["apply_writes"].append(dt)
        if capture:
            after = checkpoint["channel_versions"]
            changed = {
                k: [short_version(before.get(k)), short_version(after[k])]
                for k in sorted(after)
                if before.get(k) != after[k]
            }
            seen_after = checkpoint["versions_seen"]
            seen_changed = {
                n: short_versions(seen_after[n])
                for n in seen_after
                if seen_after[n] != seen_before.get(n)
            }
            rec.add(
                "apply_writes",
                task_order=[f"{x.name}@{x.path[:3]}" for x in order],
                writes_in_apply_order=writes,
                versions_changed=changed,
                versions_seen_updated=seen_changed,
                updated_channels=sorted(r),
                channels_available=sorted(k for k, c in channels.items() if c.is_available()),
                dt_us=round(dt * 1e6, 1),
            )
        return r

    patch(_loop, "apply_writes", apply_writes)

    PL = _loop.PregelLoop
    orig_tick = PL.tick

    def tick(self):
        t = time.perf_counter()
        r = orig_tick(self)
        dt = time.perf_counter() - t
        rec.timings["tick"].append(dt)
        if capture:
            rec.add(
                "tick",
                step=self.step,
                status=self.status,
                returns=r,
                tasks_to_run=[task_info(x) for x in self.tasks.values() if not x.writes],
                tasks_with_reapplied_writes=[task_info(x) for x in self.tasks.values() if x.writes],
                channel_versions=short_versions(self.checkpoint["channel_versions"]),
                dt_us=round(dt * 1e6, 1),
            )
        return r

    patch(PL, "tick", tick)

    orig_after = PL.after_tick

    def after_tick(self):
        step = self.step
        t = time.perf_counter()
        try:
            return orig_after(self)
        finally:
            dt = time.perf_counter() - t
            rec.timings["after_tick"].append(dt)
            if capture:
                rec.add(
                    "after_tick",
                    step_ran=step,
                    next_step=self.step,
                    checkpoint_id=self.checkpoint["id"][-12:],
                    channel_versions=short_versions(self.checkpoint["channel_versions"]),
                    updated_channels=self.checkpoint.get("updated_channels"),
                    dt_us=round(dt * 1e6, 1),
                )

    patch(PL, "after_tick", after_tick)

    orig_put_writes = PL.put_writes

    def put_writes(self, task_id, writes, *, cached=False):
        if capture:
            task = getattr(self, "tasks", {}).get(task_id)
            rec.add(
                "loop.put_writes",
                step=self.step,
                task=task.name if task else task_id[:8],
                task_id=task_id[:8],
                writes=[(c, summarize(v)) for c, v in writes],
                durability=self.durability,
            )
        t = time.perf_counter()
        r = orig_put_writes(self, task_id, writes, cached=cached)
        rec.timings["loop.put_writes"].append(time.perf_counter() - t)
        return r

    patch(PL, "put_writes", put_writes)

    orig_put_ckpt = PL._put_checkpoint

    def _put_checkpoint(self, metadata):
        exiting = metadata is self.checkpoint_metadata
        t = time.perf_counter()
        r = orig_put_ckpt(self, metadata)
        dt = time.perf_counter() - t
        rec.timings["loop._put_checkpoint"].append(dt)
        if capture:
            rec.add(
                "loop._put_checkpoint",
                source=metadata.get("source"),
                exiting=exiting,
                step_after=self.step,
                checkpoint_id=self.checkpoint["id"][-12:],
                durability=self.durability,
                dt_us=round(dt * 1e6, 1),
            )
        return r

    patch(PL, "_put_checkpoint", _put_checkpoint)

    try:
        yield rec
    finally:
        for (obj, name), v in saved.items():
            setattr(obj, name, v)


def logging_saver(base_cls, rec, *, capture=True, **kwargs):
    class LoggingSaver(base_cls):
        def put(self, config, checkpoint, metadata, new_versions):
            t = time.perf_counter()
            r = super().put(config, checkpoint, metadata, new_versions)
            dt = time.perf_counter() - t
            rec.timings["saver.put"].append(dt)
            if capture:
                rec.add(
                    "saver.put",
                    checkpoint_id=checkpoint["id"][-12:],
                    parent_id=(config["configurable"].get("checkpoint_id") or "")[-12:] or None,
                    source=metadata.get("source"),
                    step=metadata.get("step"),
                    new_versions=sorted(new_versions),
                    channel_values_keys=sorted(checkpoint["channel_values"]),
                    dt_us=round(dt * 1e6, 1),
                )
            return r

        def put_writes(self, config, writes, task_id, task_path=""):
            t = time.perf_counter()
            r = super().put_writes(config, writes, task_id, task_path)
            dt = time.perf_counter() - t
            rec.timings["saver.put_writes"].append(dt)
            if capture:
                rec.add(
                    "saver.put_writes",
                    against_checkpoint=config["configurable"]["checkpoint_id"][-12:],
                    task_id=task_id[:8],
                    task_path=task_path,
                    channels=[c for c, _ in writes],
                    dt_us=round(dt * 1e6, 1),
                )
            return r

    LoggingSaver.__name__ = "Logging" + base_cls.__name__
    return LoggingSaver(**kwargs)
