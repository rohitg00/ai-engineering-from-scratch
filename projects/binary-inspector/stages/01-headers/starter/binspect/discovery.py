from .formats import FormatError, parse_header
from .layout import section_at_offset, sections, segments
from .linkage import uleb128
from .symbols import symbols


PRINTABLE = set(range(0x20, 0x7F)) | {0x09}
STUB_SECTIONS = {"__stubs", "__auth_stubs", "__stub_helper", ".plt", ".plt.sec"}


def extract_strings(data, section_list, segment_list=(), min_length=4):
    raise NotImplementedError("stage 5: implement extract_strings")


def function_starts(data):
    raise NotImplementedError("stage 5: implement function_starts")


def score_starts(found, truth):
    raise NotImplementedError("stage 5: implement score_starts")
