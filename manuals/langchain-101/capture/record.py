import dataclasses
import enum
import json
import os
import re
import tempfile
import traceback
import warnings
from contextlib import contextmanager

from langchain_core.messages import BaseMessage
from pydantic import BaseModel

TMP_ROOTS = sorted({os.path.realpath(tempfile.gettempdir()), tempfile.gettempdir(), "/private/tmp", "/tmp"}, key=len, reverse=True)
SITE = re.compile(r"/[^\s\"']*/site-packages/")
UUID = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
HEX32 = re.compile(r"(?<![0-9a-f])(?=[0-9]*[a-f])[0-9a-f]{32}(?![0-9a-f])")
CHANNEL_VERSION = re.compile(r"\b(\d{32})\.0\.\d+")
ISO = re.compile(r"\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:\+00:00|Z)?")
DOTTED = re.compile(r"\d{8}T\d{6,}Z")
ADDR = re.compile(r"0x[0-9a-f]{6,}")
ELAPSED = re.compile(r"(elapsed: )\d+\.\d+s")
MASK_TIME = "<epoch-ms>"
TIME_KEYS = {"timestamp","created_at", "updated_at", "start_time", "end_time", "ts", "time"}
MESSAGE_FIELDS = ("name", "id", "tool_calls", "invalid_tool_calls", "tool_call_chunks", "tool_call_id", "status", "artifact", "additional_kwargs", "response_metadata", "usage_metadata", "chunk_position")


def message(m):
    out = {"type": type(m).__name__, "content": plain(m.content)}
    for field in MESSAGE_FIELDS:
        value = getattr(m, field, None)
        if value not in (None, "", [], {}):
            out[field] = plain(value)
    return out


def plain(value):
    if isinstance(value, BaseMessage):
        return message(value)
    if isinstance(value, BaseModel):
        return plain(value.model_dump(mode="json"))
    if dataclasses.is_dataclass(value) and not isinstance(value, type):
        return {f.name: plain(getattr(value, f.name)) for f in dataclasses.fields(value)}
    if isinstance(value, dict):
        return {str(k): (MASK_TIME if k in TIME_KEYS and isinstance(v, (int, float)) and v > 1e9 else plain(v)) for k, v in value.items()}
    if all(hasattr(value, attr) for attr in ("namespace", "key", "value", "dict")):
        return {"__type__": type(value).__name__, **plain(value.dict())}
    if hasattr(value, "_asdict"):
        return {"__type__": type(value).__name__, **plain(value._asdict())}
    if isinstance(value, (list, tuple, set, frozenset)):
        items = sorted(value, key=repr) if isinstance(value, (set, frozenset)) else value
        return [plain(v) for v in items]
    if isinstance(value, enum.Enum):
        return value.value
    if isinstance(value, BaseException):
        return error_text(value)
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    if isinstance(value, type):
        return value.__name__
    return repr(value)


def error_text(exc):
    return f"{type(exc).__module__}.{type(exc).__qualname__}: {exc}"


class Masker:
    def __init__(self):
        self.seen = {}
        self.counts = {}

    def token(self, kind, raw):
        key = (kind, raw)
        if key not in self.seen:
            self.counts[kind] = self.counts.get(kind, 0) + 1
            self.seen[key] = f"<{kind}-{self.counts[kind]}>"
        return self.seen[key]

    def __call__(self, text):
        for root in TMP_ROOTS:
            text = text.replace(root, "<tmp>")
        text = re.sub(r"<tmp>/[A-Za-z0-9_.-]*m101[A-Za-z0-9_.-]*", "<tmp>/m101", text)
        text = SITE.sub("<site-packages>/", text)
        text = UUID.sub(lambda m: self.token("uuid", m.group(0)), text)
        text = CHANNEL_VERSION.sub(r"\1.<random>", text)
        text = HEX32.sub(lambda m: self.token("hex", m.group(0)), text)
        text = DOTTED.sub("<dotted-time>", text)
        text = ISO.sub("<time>", text)
        text = ADDR.sub("0x<addr>", text)
        text = ELAPSED.sub(r"\1<seconds>", text)
        return text


class Capture:
    def __init__(self, out_dir, stem, title):
        self.out_dir = out_dir
        self.stem = stem
        self.lines = [f"# {title}", ""]
        self.sidecars = []

    def section(self, title):
        self.lines += [f"## {title}", ""]

    def text(self, *rows):
        for row in rows:
            self.lines.extend(str(row).split("\n"))
        self.lines.append("")

    def json(self, value, label=None):
        if label:
            self.lines.append(f"{label}:")
        self.lines.extend(dumps(value).split("\n"))
        self.lines.append("")

    def messages(self, messages, label=None):
        self.json([message(m) for m in messages], label)

    def sidecar(self, suffix, value):
        name = f"{self.stem}.{suffix}"
        self.sidecars.append((name, dumps(value) + "\n"))
        self.text(f"full frames: {name}")

    def error(self, exc, frames=False):
        self.lines.append("raised " + error_text(exc))
        if frames:
            for frame in traceback.extract_tb(exc.__traceback__)[-3:]:
                self.lines.append(f"  at {frame.filename}:{frame.lineno} in {frame.name}")
        self.lines.append("")

    @contextmanager
    def warnings(self):
        with warnings.catch_warnings(record=True) as seen:
            warnings.simplefilter("always")
            yield
        rows = []
        for item in seen:
            if issubclass(item.category, ResourceWarning):
                continue
            row = f"warning {item.category.__name__}: {item.message}"
            if row not in rows:
                rows.append(row)
        if rows:
            self.text(*rows)

    def attempt(self, label, fn, frames=False):
        try:
            result = fn()
        except Exception as exc:
            self.text(f"{label}:")
            self.error(exc, frames)
            return None
        return result

    def finish(self):
        mask = Masker()
        files = [(f"{self.stem}.txt", "\n".join(self.lines).rstrip("\n") + "\n"), *self.sidecars]
        for name, body in files:
            with open(os.path.join(self.out_dir, name), "w", encoding="utf-8") as handle:
                handle.write(mask(body))
        return [name for name, _ in files]


def dumps(value):
    return json.dumps(plain(value), indent=2, ensure_ascii=False, default=repr)
