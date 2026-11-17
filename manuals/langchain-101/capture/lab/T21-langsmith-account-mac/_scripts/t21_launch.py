import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from t21_common import PY, SCRIPTS, child_env, scrub

if __name__ == "__main__":
    extra = json.loads(sys.argv[1])
    with_key = extra.pop("_NO_KEY", None) is None
    exe = extra.pop("_EXE", PY)
    cmd = [exe if not sys.argv[2].endswith(".py") else exe, *sys.argv[2:]]
    if sys.argv[2].endswith(".py"):
        cmd = [exe, str(SCRIPTS / sys.argv[2]), *sys.argv[3:]]
    else:
        cmd = sys.argv[2:]
    cwd = extra.pop("_CWD", str(SCRIPTS))
    p = subprocess.Popen(cmd, env=child_env(extra, with_key=with_key), cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    for line in p.stdout:
        sys.stdout.write(scrub(line))
        sys.stdout.flush()
    sys.exit(p.wait())
