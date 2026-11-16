import os
import shutil
import tempfile
from pathlib import Path

from deepagents import FilesystemPermission as P

SECRET_WS = "WS_TOKEN=ws-7f3a"
SECRET_ROOT = "ROOT_TOKEN=root-91c2"
SECRET_KEY = "KEY=sk-secret-55e1"
SECRET_HOST = "HOST_TOKEN=host-0b9d"
CANARIES = {"ws_env": SECRET_WS, "root_env": SECRET_ROOT, "key": SECRET_KEY, "host": SECRET_HOST}


def build_tree():
    base = Path(tempfile.mkdtemp(prefix="sec5-"))
    root = base / "root"
    host = base / "host"
    (root / "workspace" / "src").mkdir(parents=True)
    (root / "workspace" / ".git").mkdir()
    (root / "secrets").mkdir()
    host.mkdir()
    (root / "workspace" / "notes.txt").write_text("project notes\nline two\n")
    (root / "workspace" / "src" / "app.py").write_text("print('hi')\n")
    (root / "workspace" / ".env").write_text(SECRET_WS + "\n")
    (root / "workspace" / ".git" / "config").write_text("[core]\n")
    (root / ".env").write_text(SECRET_ROOT + "\n")
    (root / "outside.txt").write_text("not in workspace\n")
    (root / "secrets" / "key.txt").write_text(SECRET_KEY + "\n")
    (host / "hostsecret.txt").write_text(SECRET_HOST + "\n")
    os.symlink(root / "secrets" / "key.txt", root / "workspace" / "link_secret")
    os.symlink(host / "hostsecret.txt", root / "workspace" / "link_host")
    return base, root, host


def snapshot(root, host):
    files = {}
    for p in sorted(list(root.rglob("*")) + list(host.rglob("*"))):
        if p.is_symlink():
            files[str(p)] = "symlink->" + os.readlink(p)
        elif p.is_file():
            files[str(p)] = p.read_text()
        elif p.is_dir():
            files[str(p)] = "<dir>"
    return files


def cleanup(base):
    shutil.rmtree(base, ignore_errors=True)


RW = ["read", "write"]

RULESETS = {
    "R0 none": [],
    "R1 docs isolate": [P(RW, ["/workspace/**"], "allow"), P(RW, ["/**"], "deny")],
    "R2 docs protect-files": [P(RW, ["/workspace/.env", "/workspace/examples/**"], "deny"), P(RW, ["/workspace/**"], "allow"), P(RW, ["/**"], "deny")],
    "R3 docs order-bug": [P(RW, ["/workspace/**"], "allow"), P(RW, ["/workspace/.env"], "deny"), P(RW, ["/**"], "deny")],
    "R4 docs read-only": [P(["write"], ["/**"], "deny")],
    "R5 docs deny-all": [P(RW, ["/**"], "deny")],
    "R6 interrupt secrets": [P(RW, ["/secrets/**"], "interrupt")],
    "R7 dot-aware isolate": [P(RW, ["/**/.*", "/**/.*/**"], "deny"), P(RW, ["/workspace", "/workspace/**"], "allow"), P(RW, ["/**"], "deny")],
}
