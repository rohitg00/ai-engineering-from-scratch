import atexit
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import t21_reqlog


def _dump():
    path = os.environ.get("T21_REQLOG")
    if path:
        with open(path, "w") as f:
            for r in t21_reqlog.REQS:
                f.write(json.dumps(r) + "\n")


atexit.register(_dump)
