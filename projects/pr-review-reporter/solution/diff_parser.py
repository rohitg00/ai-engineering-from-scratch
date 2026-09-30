"""Parse ordinary textual Git unified diffs; retain physical new-file line numbers."""

import ast
import json
import re
import sys


def decode_path(raw):
    if raw.startswith('"'):
        try:
            value = ast.literal_eval(raw)
            if not isinstance(value, str):
                raise ValueError("bad quoted path")
            if re.search(r"\\[0-7]{3}", raw):
                value = value.encode("latin1").decode("utf-8")
        except (ValueError, SyntaxError, UnicodeError) as error:
            raise ValueError("bad quoted path") from error
    else:
        value = raw.split("\t", 1)[0]
    if value == "/dev/null":
        return None
    if value.startswith("b/"):
        value = value[2:]
    if (
        not value
        or value.startswith("/")
        or ".." in value.split("/")
        or any(ord(c) < 32 for c in value)
    ):
        raise ValueError("unsafe file")
    return value


def parse(raw):
    out, file, line, old_left, new_left = [], None, 0, 0, 0
    for text in raw.splitlines():
        if old_left or new_left:
            if text.startswith("\\"):
                continue
            if text.startswith("+"):
                out.append({"file": file, "line": line, "text": text[1:]})
                line += 1
                new_left -= 1
            elif text.startswith("-"):
                old_left -= 1
            elif text.startswith(" "):
                line += 1
                old_left -= 1
                new_left -= 1
            else:
                raise ValueError("bad or truncated hunk")
            if min(old_left, new_left) < 0:
                raise ValueError("hunk count mismatch")
        elif text.startswith("diff --git "):
            file = None
        elif text.startswith("+++ "):
            file = decode_path(text[4:])
        elif text.startswith("@@ "):
            match = re.match(r"^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@", text)
            if not match or file is None:
                raise ValueError("bad hunk")
            old_left = int(match[2]) if match[2] is not None else 1
            line = int(match[3])
            new_left = int(match[4]) if match[4] is not None else 1
    if old_left or new_left:
        raise ValueError("truncated hunk")
    return out


if __name__ == "__main__":
    try:
        print(json.dumps(parse(sys.stdin.read())))
    except ValueError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
