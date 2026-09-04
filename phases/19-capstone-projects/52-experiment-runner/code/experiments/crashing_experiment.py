"""Mock experiment that exits with a non zero code and writes no metrics.

Used by the runner tests to verify the crash terminal label.
"""

from __future__ import annotations

import json
import sys


def main() -> int:
    print(json.dumps({"step": 0, "note": "about to fail"}))
    print("trace: simulated failure", file=sys.stderr)
    return 3


if __name__ == "__main__":
    sys.exit(main())
