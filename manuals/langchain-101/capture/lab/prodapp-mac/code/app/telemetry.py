import json
import logging
import sys
import time

from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter

tracer = trace.get_tracer("support-assistant")
log = logging.getLogger("support")


def setup_tracing(path):
    provider = TracerProvider(resource=Resource.create({"service.name": "support-assistant"}))
    out = open(path, "a", buffering=1) if path else sys.stdout
    exporter = ConsoleSpanExporter(out=out, formatter=lambda span: span.to_json(indent=None) + "\n")
    provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)
    return provider


class JsonFormatter(logging.Formatter):
    def format(self, record):
        span = trace.get_current_span().get_span_context()
        entry = {
            "ts": round(time.time(), 3),
            "level": record.levelname,
            "event": record.getMessage(),
            **getattr(record, "fields", {}),
        }
        if span.is_valid:
            entry["trace_id"] = f"{span.trace_id:032x}"
            entry["span_id"] = f"{span.span_id:016x}"
        return json.dumps(entry)


def setup_logging(path):
    handler = logging.FileHandler(path) if path else logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    log.handlers = [handler]
    log.setLevel(logging.INFO)
    log.propagate = False


def event(name, **fields):
    log.info(name, extra={"fields": fields})
