from .formats import FormatError, load_commands, parse_header, unpack
from .layout import sections


ELF_BINDINGS = {0: "local", 1: "global", 2: "weak", 10: "unique"}
ELF_KINDS = {0: "notype", 1: "object", 2: "func", 3: "section", 4: "file", 5: "common", 6: "tls"}
BUILTINS = {
    "v": "void", "b": "bool", "c": "char", "a": "signed char", "h": "unsigned char", "s": "short",
    "t": "unsigned short", "i": "int", "j": "unsigned int", "l": "long", "m": "unsigned long",
    "x": "long long", "y": "unsigned long long", "f": "float", "d": "double", "e": "long double",
    "w": "wchar_t", "z": "...",
}


def read_cstring(data, offset, end=None):
    raise NotImplementedError("stage 3: implement read_cstring")


def demangle(name):
    raise NotImplementedError("stage 3: implement demangle")


def symbols(data):
    raise NotImplementedError("stage 3: implement symbols")
