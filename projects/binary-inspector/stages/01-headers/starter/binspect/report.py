import hashlib
import html

from .discovery import extract_strings, function_starts, score_starts
from .formats import parse_header
from .layout import sections, segments, shannon_entropy
from .linkage import chained_fixups, exports, imports, relocations
from .symbols import symbols


REPORT_SCHEMA = "binary-inspector/report/v1"
DIFF_SCHEMA = "binary-inspector/diff/v1"
REPORT_FIELDS = {
    "schema": str, "file": dict, "header": dict, "sections": list, "segments": list, "symbols": list,
    "imports": list, "exports": list, "relocations": list, "fixups": list, "strings": list,
    "function_starts": dict, "byte_map": list, "summary": dict,
}
ITEM_FIELDS = {
    "sections": ("name", "offset", "size", "file_size", "perms", "entropy"),
    "segments": ("name", "offset", "size", "file_size", "perms", "entropy"),
    "symbols": ("name", "value", "kind", "binding", "section", "defined"),
    "imports": ("name", "library", "slots"),
    "exports": ("name", "address"),
    "relocations": ("section", "offset", "type", "symbol"),
    "fixups": ("offset", "address", "kind", "raw"),
    "strings": ("offset", "text", "encoding", "section"),
    "byte_map": ("offset", "length", "region", "entropy"),
}


def byte_map(data, section_list, segment_list=(), cells=128):
    raise NotImplementedError("stage 6: implement byte_map")


def build_report(data, name="input", truth=None, min_string=4, cells=128):
    raise NotImplementedError("stage 6: implement build_report")


def validate_report(report):
    raise NotImplementedError("stage 6: implement validate_report")


def render_html(report):
    raise NotImplementedError("stage 6: implement render_html")


def diff_reports(old, new):
    raise NotImplementedError("stage 6: implement diff_reports")


def render_diff_text(diff):
    raise NotImplementedError("stage 6: implement render_diff_text")
