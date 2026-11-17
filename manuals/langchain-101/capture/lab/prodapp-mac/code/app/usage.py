import json
import time

from langchain_core.callbacks import BaseCallbackHandler
from opentelemetry import trace


class UsageLog(BaseCallbackHandler):
    def __init__(self, path, model):
        self.path, self.model = path, model

    def on_llm_end(self, response, **kwargs):
        message = response.generations[0][0].message
        usage = message.usage_metadata or {}
        meta = message.response_metadata or {}
        row = {"ts": round(time.time(), 3), "model": self.model, "input_tokens": usage.get("input_tokens", 0),
               "output_tokens": usage.get("output_tokens", 0), "tool_calls": len(getattr(message, "tool_calls", [])),
               "total_duration_ms": round((meta.get("total_duration") or 0) / 1e6, 1),
               "load_duration_ms": round((meta.get("load_duration") or 0) / 1e6, 1),
               "span": getattr(trace.get_current_span(), "name", None),
               "trace_id": f"{trace.get_current_span().get_span_context().trace_id:032x}"}
        with open(self.path, "a") as out:
            out.write(json.dumps(row) + "\n")
