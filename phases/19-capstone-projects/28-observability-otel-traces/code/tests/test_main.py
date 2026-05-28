"""OTel GenAI span builder と Prometheus exposition の tests。"""

from __future__ import annotations

import json
import math
import os
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from main import (  # noqa: E402
    GEN_AI_REQUEST_MODEL,
    GEN_AI_RESPONSE_ID,
    GEN_AI_SYSTEM,
    GEN_AI_TOOL_NAME,
    GEN_AI_USAGE_INPUT_TOKENS,
    STATUS_ERROR,
    STATUS_OK,
    Counter,
    GenAISpan,
    Histogram,
    InMemoryExporter,
    JSONLExporter,
    MetricsRegistry,
    SpanBuilder,
    new_span_id,
    new_trace_id,
    prometheus_exposition,
    run_demo,
)


class IdTests(unittest.TestCase):
    def test_trace_id_is_32_hex(self) -> None:
        tid = new_trace_id()
        self.assertEqual(len(tid), 32)
        int(tid, 16)

    def test_span_id_is_16_hex(self) -> None:
        sid = new_span_id()
        self.assertEqual(len(sid), 16)
        int(sid, 16)


class SpanShapeTests(unittest.TestCase):
    def test_span_dict_contains_required_keys(self) -> None:
        span = GenAISpan(
            trace_id=new_trace_id(),
            span_id=new_span_id(),
            name="gen_ai.chat",
            start_unix_nano=10_000,
            end_unix_nano=15_000_000,
            attributes={GEN_AI_SYSTEM: "anthropic"},
        )
        d = span.to_dict()
        for key in (
            "trace_id",
            "span_id",
            "name",
            "kind",
            "start_unix_nano",
            "end_unix_nano",
            "duration_ms",
            "attributes",
            "events",
            "status",
        ):
            self.assertIn(key, d)
        self.assertEqual(d["attributes"][GEN_AI_SYSTEM], "anthropic")
        self.assertGreater(d["duration_ms"], 0.0)

    def test_duration_zero_when_not_ended(self) -> None:
        span = GenAISpan(
            trace_id=new_trace_id(),
            span_id=new_span_id(),
            name="x",
            start_unix_nano=100,
        )
        self.assertEqual(span.duration_ms, 0.0)


class CounterTests(unittest.TestCase):
    def test_increment_default(self) -> None:
        c = Counter(name="x_total")
        c.inc({"tool": "read_file"})
        c.inc({"tool": "read_file"})
        c.inc({"tool": "list_dir"})
        self.assertEqual(c.get({"tool": "read_file"}), 2)
        self.assertEqual(c.get({"tool": "list_dir"}), 1)
        self.assertEqual(c.get({"tool": "missing"}), 0)


class HistogramTests(unittest.TestCase):
    def test_bucket_counts_are_cumulative(self) -> None:
        h = Histogram(name="lat", buckets=(10.0, 100.0, 1000.0))
        for v in (1, 5, 20, 200, 2000):
            h.observe(v)
        counts = h.bucket_counts()
        self.assertEqual(counts[10.0], 2)
        self.assertEqual(counts[100.0], 3)
        self.assertEqual(counts[1000.0], 4)
        self.assertEqual(counts[math.inf], 5)
        self.assertEqual(h.total_count(), 5)
        self.assertEqual(h.total_sum(), 2226.0)


class PrometheusExpositionTests(unittest.TestCase):
    def test_counter_exposition(self) -> None:
        reg = MetricsRegistry()
        c = reg.counter("tools_called_total", help="tool call の総数")
        c.inc({"tool": "read_file"})
        c.inc({"tool": "list_dir"})
        text = prometheus_exposition(reg)
        self.assertIn("# HELP tools_called_total tool call の総数", text)
        self.assertIn("# TYPE tools_called_total counter", text)
        self.assertIn('tools_called_total{tool="read_file"} 1', text)
        self.assertIn('tools_called_total{tool="list_dir"} 1', text)

    def test_histogram_exposition_includes_buckets_sum_count(self) -> None:
        reg = MetricsRegistry()
        h = reg.histogram("lat_ms", help="latency")
        h.observe(7, {"tool": "x"})
        h.observe(300, {"tool": "x"})
        text = prometheus_exposition(reg)
        self.assertIn("# TYPE lat_ms histogram", text)
        self.assertIn('lat_ms_bucket{le="10",tool="x"} 1', text)
        self.assertIn('lat_ms_bucket{le="+Inf",tool="x"} 2', text)
        self.assertIn('lat_ms_sum{tool="x"} 307.0', text)
        self.assertIn('lat_ms_count{tool="x"} 2', text)


class SpanBuilderTests(unittest.TestCase):
    def test_successful_span_status_ok(self) -> None:
        exp = InMemoryExporter()
        builder = SpanBuilder(exporters=[exp])
        with builder.span("op") as span:
            span.attributes[GEN_AI_USAGE_INPUT_TOKENS] = 100
        self.assertEqual(len(exp.spans), 1)
        self.assertEqual(exp.spans[0].status, STATUS_OK)
        self.assertGreater(exp.spans[0].end_unix_nano, 0)

    def test_exception_records_status_error(self) -> None:
        exp = InMemoryExporter()
        builder = SpanBuilder(exporters=[exp])
        with self.assertRaises(ValueError):
            with builder.span("op"):
                raise ValueError("boom")
        self.assertEqual(exp.spans[0].status, STATUS_ERROR)
        self.assertIn("ValueError", exp.spans[0].status_message)
        names = [e.name for e in exp.spans[0].events]
        self.assertIn("exception", names)

    def test_parent_child_relationship(self) -> None:
        exp = InMemoryExporter()
        builder = SpanBuilder(exporters=[exp])
        with builder.span("parent") as parent:
            with builder.span("child", parent=parent) as child:
                self.assertEqual(child.parent_span_id, parent.span_id)
                self.assertEqual(child.trace_id, parent.trace_id)
        child_span = next(s for s in exp.spans if s.name == "child")
        parent_span = next(s for s in exp.spans if s.name == "parent")
        self.assertEqual(child_span.parent_span_id, parent_span.span_id)

    def test_tool_span_drives_counter_and_histogram(self) -> None:
        exp = InMemoryExporter()
        metrics = MetricsRegistry()
        builder = SpanBuilder(exporters=[exp], metrics=metrics)
        for _ in range(3):
            with builder.span(
                "gen_ai.tool.execution",
                attributes={GEN_AI_TOOL_NAME: "read_file"},
            ):
                pass
        self.assertEqual(
            metrics.counter("tools_called_total").get({"tool": "read_file"}), 3
        )
        self.assertEqual(
            metrics.histogram("tool_latency_ms").total_count({"tool": "read_file"}),
            3,
        )


class JSONLRoundtripTests(unittest.TestCase):
    def test_jsonl_roundtrip(self) -> None:
        tmp = tempfile.mkdtemp(prefix="jsonl-test-")
        path = os.path.join(tmp, "traces.jsonl")
        exporter = JSONLExporter(path=path)
        builder = SpanBuilder(exporters=[exporter])
        with builder.span(
            "gen_ai.chat",
            attributes={
                GEN_AI_SYSTEM: "anthropic",
                GEN_AI_REQUEST_MODEL: "claude-track-a",
            },
        ) as span:
            span.attributes[GEN_AI_RESPONSE_ID] = "msg_abc"
        exporter.close()
        with open(path, "r", encoding="utf-8") as fh:
            lines = [json.loads(line) for line in fh if line.strip()]
        self.assertEqual(len(lines), 1)
        d = lines[0]
        self.assertEqual(d["name"], "gen_ai.chat")
        self.assertEqual(d["attributes"][GEN_AI_SYSTEM], "anthropic")
        self.assertEqual(d["attributes"][GEN_AI_REQUEST_MODEL], "claude-track-a")
        self.assertEqual(d["status"]["code"], STATUS_OK)


class DemoTests(unittest.TestCase):
    def test_demo_main_exits_zero(self) -> None:
        self.assertEqual(run_demo(), 0)


if __name__ == "__main__":
    unittest.main()
