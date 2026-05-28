"""non-zero code で exit し、metrics を書かない mock experiment。

runner tests が crash terminal label を検証するために使います。
"""

from __future__ import annotations

import json
import sys


def main() -> int:
    print(json.dumps({"step": 0, "note": "まもなく失敗します"}))
    print("trace: simulated failure", file=sys.stderr)
    return 3


if __name__ == "__main__":
    sys.exit(main())
