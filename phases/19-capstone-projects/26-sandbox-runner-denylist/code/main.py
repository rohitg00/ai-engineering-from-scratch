"""
Sandbox runner with denylist, path jail, and timeout.

See: phases/19-capstone-projects/26-sandbox-runner-denylist/docs/en.md
Concept refs:
  - POSIX subprocess semantics (wall-clock timeout, return codes).
  - Symlink-safe path jail via realpath prefix check.
The demo at the bottom runs a battery of allow/deny calls and exits zero.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass, field
from typing import Iterable, Sequence


DENIED_EXIT_CODE = -100
TIMED_OUT_EXIT_CODE = -101

DEFAULT_DENYLIST: frozenset[str] = frozenset(
    {
        "rm",
        "sudo",
        "mkfs",
        "mkfs.ext4",
        "mkfs.fat",
        "curl",
        "wget",
        "chmod",
        "dd",
        "kill",
        "pkill",
        "shutdown",
        "reboot",
        "halt",
        "poweroff",
        "eval",
        "exec",
        "base64",
        "nc",
        "ncat",
        "telnet",
        "su",
        "iptables",
        "ufw",
    }
)

DEFAULT_INTERPRETER_BLOCK: frozenset[str] = frozenset(
    {
        "python",
        "python3",
        "bash",
        "sh",
        "zsh",
        "fish",
        "node",
        "deno",
        "perl",
        "ruby",
        "lua",
        "awk",
        "tclsh",
        "php",
    }
)

INTERPRETER_FLAG_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"^-c$"),
    re.compile(r"^-e$"),
    re.compile(r"^--eval$"),
    re.compile(r"^--exec$"),
    re.compile(r"^-cu$"),
    re.compile(r"^-ce$"),
)

SHELL_METACHARS: tuple[str, ...] = (";", "|", "&", ">", "<", "`", "$(", "${", ")")

DEFAULT_MAX_OUTPUT_BYTES: int = 64 * 1024
DEFAULT_TIMEOUT_SECONDS: float = 30.0
TRUNCATION_MARKER: bytes = b"\n[sandbox: output truncated]\n"


# ---------------------------------------------------------------------------
# Result and configuration
# ---------------------------------------------------------------------------


@dataclass
class SandboxResult:
    """Structured outcome of a sandbox.run call."""

    argv: list[str]
    exit_code: int
    stdout: bytes = b""
    stderr: bytes = b""
    truncated: bool = False
    timed_out: bool = False
    denied: bool = False
    reason: str = ""
    duration_ms: float = 0.0

    @property
    def ok(self) -> bool:
        return self.exit_code == 0 and not self.denied and not self.timed_out

    def to_dict(self) -> dict:
        return {
            "argv": self.argv,
            "exit_code": self.exit_code,
            "stdout_bytes": len(self.stdout),
            "stderr_bytes": len(self.stderr),
            "truncated": self.truncated,
            "timed_out": self.timed_out,
            "denied": self.denied,
            "reason": self.reason,
            "duration_ms": round(self.duration_ms, 2),
        }


@dataclass
class SandboxConfig:
    """All knobs the sandbox accepts."""

    project_root: str
    max_output_bytes: int = DEFAULT_MAX_OUTPUT_BYTES
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS
    denylist: frozenset[str] = field(default_factory=lambda: DEFAULT_DENYLIST)
    interpreter_block: frozenset[str] = field(
        default_factory=lambda: DEFAULT_INTERPRETER_BLOCK
    )
    env_allowlist: tuple[str, ...] = ("PATH", "HOME", "LANG", "LC_ALL", "TERM")

    def __post_init__(self) -> None:
        # Resolve once and cache. The sandbox compares argument realpaths
        # against this value, so any later symlink resolution is consistent.
        self.project_root = os.path.realpath(self.project_root)


# ---------------------------------------------------------------------------
# Refusal helpers
# ---------------------------------------------------------------------------


def _basename(executable: str) -> str:
    return os.path.basename(executable.strip())


def _check_executable_denylist(argv: Sequence[str], cfg: SandboxConfig) -> str | None:
    if not argv:
        return "empty argv"
    name = _basename(argv[0])
    if not name:
        return f"executable {argv[0]!r} has no basename"
    if name in cfg.denylist:
        return f"executable {name!r} is on the denylist"
    return None


def _check_argv_interpreter(argv: Sequence[str], cfg: SandboxConfig) -> str | None:
    if not argv:
        return None
    name = _basename(argv[0])
    if name not in cfg.interpreter_block:
        return None
    for arg in argv[1:]:
        for pat in INTERPRETER_FLAG_PATTERNS:
            if pat.match(arg):
                return (
                    f"interpreter {name!r} invoked with refused flag {arg!r}; "
                    "use a script file instead of -c/-e"
                )
    return None


def _check_shell_metachars(argv: Sequence[str], shell: bool) -> str | None:
    if shell:
        return None
    for arg in argv:
        for meta in SHELL_METACHARS:
            if meta in arg:
                return (
                    f"argv contains shell metachar {meta!r} in {arg!r}; "
                    "set shell=True to opt in"
                )
    return None


_PATH_HINT = re.compile(r"[/\\]|^\.{1,2}$")


def _looks_like_path(arg: str) -> bool:
    """Conservative path-like detector.

    Returns True for arguments that look like file paths: contain a slash,
    are exactly . or .., or end in a common path-y suffix. The sandbox does
    not need to be exhaustive: any false negative just means the path is not
    jail-checked, which is fine for non-path arguments.
    """

    if not arg:
        return False
    if _PATH_HINT.search(arg):
        return True
    return False


def _check_path_jail(argv: Sequence[str], cfg: SandboxConfig) -> str | None:
    root = cfg.project_root
    for arg in argv[1:]:
        if not arg or arg.startswith("-"):
            continue
        # Also jail-check slashless names that exist under root: a symlink like
        # `link.txt` -> /etc/passwd has no path separator, so _looks_like_path
        # misses it, yet realpath still escapes the jail. lexists() catches the
        # symlink even when its target is missing.
        if not _looks_like_path(arg) and not os.path.lexists(os.path.join(root, arg)):
            continue
        # Resolve against root if arg is relative; let absolute paths stay absolute.
        candidate = arg
        if not os.path.isabs(candidate):
            candidate = os.path.join(root, candidate)
        resolved = os.path.realpath(candidate)
        if resolved != root and not resolved.startswith(root + os.sep):
            return (
                f"path argument {arg!r} resolves outside project root "
                f"({resolved!r} not under {root!r})"
            )
    return None


# ---------------------------------------------------------------------------
# Output truncation
# ---------------------------------------------------------------------------


def truncate_stream(buf: bytes, max_bytes: int) -> tuple[bytes, bool]:
    if len(buf) <= max_bytes:
        return buf, False
    head = buf[:max_bytes]
    return head + TRUNCATION_MARKER, True


# ---------------------------------------------------------------------------
# The sandbox
# ---------------------------------------------------------------------------


@dataclass
class Sandbox:
    """A subprocess runner that refuses dangerous calls and jails paths."""

    config: SandboxConfig

    def run(
        self,
        argv: Sequence[str],
        *,
        shell: bool = False,
        cwd: str | None = None,
        stdin: bytes | None = None,
    ) -> SandboxResult:
        argv_list = list(argv)
        result = SandboxResult(argv=argv_list, exit_code=DENIED_EXIT_CODE)

        for check in (
            _check_executable_denylist,
            _check_argv_interpreter,
        ):
            reason = check(argv_list, self.config)
            if reason is not None:
                result.denied = True
                result.reason = reason
                return result

        shell_reason = _check_shell_metachars(argv_list, shell=shell)
        if shell_reason is not None:
            result.denied = True
            result.reason = shell_reason
            return result

        path_reason = _check_path_jail(argv_list, self.config)
        if path_reason is not None:
            result.denied = True
            result.reason = path_reason
            return result

        work_cwd = cwd or self.config.project_root
        real_cwd = os.path.realpath(work_cwd)
        if real_cwd != self.config.project_root and not real_cwd.startswith(
            self.config.project_root + os.sep
        ):
            result.denied = True
            result.reason = f"cwd {work_cwd!r} not under project root"
            return result

        env: dict[str, str] = {}
        parent_env = os.environ
        for key in self.config.env_allowlist:
            if key in parent_env:
                env[key] = parent_env[key]

        started = time.perf_counter()
        try:
            proc = subprocess.run(
                argv_list,
                shell=shell,
                cwd=real_cwd,
                env=env,
                capture_output=True,
                timeout=self.config.timeout_seconds,
                input=stdin,
                check=False,
            )
        except subprocess.TimeoutExpired as exc:
            elapsed = (time.perf_counter() - started) * 1000.0
            stdout_raw = exc.stdout or b""
            stderr_raw = exc.stderr or b""
            stdout_buf, stdout_truncated = truncate_stream(
                stdout_raw, self.config.max_output_bytes
            )
            stderr_buf, stderr_truncated = truncate_stream(
                stderr_raw, self.config.max_output_bytes
            )
            return SandboxResult(
                argv=argv_list,
                exit_code=TIMED_OUT_EXIT_CODE,
                stdout=stdout_buf,
                stderr=stderr_buf,
                truncated=stdout_truncated or stderr_truncated,
                timed_out=True,
                denied=False,
                reason=f"wall-clock timeout after {self.config.timeout_seconds}s",
                duration_ms=elapsed,
            )
        except FileNotFoundError as exc:
            elapsed = (time.perf_counter() - started) * 1000.0
            return SandboxResult(
                argv=argv_list,
                exit_code=DENIED_EXIT_CODE,
                stdout=b"",
                stderr=str(exc).encode("utf-8"),
                truncated=False,
                timed_out=False,
                denied=True,
                reason=f"executable not found: {exc}",
                duration_ms=elapsed,
            )

        elapsed = (time.perf_counter() - started) * 1000.0
        stdout_buf, stdout_truncated = truncate_stream(
            proc.stdout or b"", self.config.max_output_bytes
        )
        stderr_buf, stderr_truncated = truncate_stream(
            proc.stderr or b"", self.config.max_output_bytes
        )
        return SandboxResult(
            argv=argv_list,
            exit_code=proc.returncode,
            stdout=stdout_buf,
            stderr=stderr_buf,
            truncated=stdout_truncated or stderr_truncated,
            timed_out=False,
            denied=False,
            reason="",
            duration_ms=elapsed,
        )


# ---------------------------------------------------------------------------
# Helpers for the demo (cross-platform tool selection)
# ---------------------------------------------------------------------------


def find_executable(candidates: Iterable[str]) -> str | None:
    for name in candidates:
        path = _which(name)
        if path is not None:
            return path
    return None


def _which(name: str) -> str | None:
    for entry in os.environ.get("PATH", "").split(os.pathsep):
        candidate = os.path.join(entry, name)
        if os.path.isfile(candidate) and os.access(candidate, os.X_OK):
            return candidate
    return None


# ---------------------------------------------------------------------------
# Demo
# ---------------------------------------------------------------------------


def _seed_project_root() -> str:
    """Create a temp project root with a single tracked file."""

    root = tempfile.mkdtemp(prefix="sandbox-demo-")
    with open(os.path.join(root, "hello.txt"), "w", encoding="utf-8") as fh:
        fh.write("hello from inside the sandbox\n")
    sub = os.path.join(root, "src")
    os.makedirs(sub, exist_ok=True)
    with open(os.path.join(sub, "main.py"), "w", encoding="utf-8") as fh:
        fh.write("print('main')\n")
    return root


def _print_outcome(label: str, result: SandboxResult) -> None:
    badge = (
        "OK"
        if result.ok
        else "DENIED"
        if result.denied
        else "TIMEOUT"
        if result.timed_out
        else f"EXIT {result.exit_code}"
    )
    print(f"  - {label:38s} -> {badge}")
    if result.denied or result.timed_out:
        print(f"      reason: {result.reason}")


def run_demo() -> int:
    """Self-terminating demo. Returns 0 on success."""

    root = _seed_project_root()
    config = SandboxConfig(
        project_root=root,
        max_output_bytes=512,
        timeout_seconds=2.0,
    )
    sandbox = Sandbox(config=config)

    echo = find_executable(("echo",)) or "echo"
    cat = find_executable(("cat",))
    yes = find_executable(("yes",))
    sleep = find_executable(("sleep",))
    ls = find_executable(("ls",))

    print("SANDBOX DEMO")
    print(f"project_root={root}")
    print("")

    print("legal calls:")
    if ls:
        _print_outcome("ls .", sandbox.run([ls, "."]))
    _print_outcome("echo hello", sandbox.run([echo, "hello", "from", "sandbox"]))
    if cat:
        _print_outcome("cat hello.txt", sandbox.run([cat, "hello.txt"]))
        _print_outcome("cat src/main.py", sandbox.run([cat, "src/main.py"]))

    print("")
    print("denied by name:")
    _print_outcome("rm -rf .", sandbox.run(["rm", "-rf", "."]))
    _print_outcome("sudo apt update", sandbox.run(["sudo", "apt", "update"]))
    _print_outcome("curl http://x", sandbox.run(["curl", "http://example.com"]))

    print("")
    print("denied by argv interpreter:")
    _print_outcome(
        "python3 -c '...'",
        sandbox.run(["python3", "-c", "print('hi')"]),
    )
    _print_outcome(
        "bash -c '...'",
        sandbox.run(["bash", "-c", "echo pwned"]),
    )

    print("")
    print("denied by shell metachar:")
    _print_outcome(
        "echo a ; rm -rf",
        sandbox.run([echo, "a", ";", "rm", "-rf"]),
    )

    print("")
    print("denied by path jail:")
    if cat:
        _print_outcome("cat ../../etc/passwd", sandbox.run([cat, "../../etc/passwd"]))
        _print_outcome("cat /etc/passwd", sandbox.run([cat, "/etc/passwd"]))

    print("")
    print("timeout / truncation:")
    if sleep:
        _print_outcome("sleep 5 (cap 2)", sandbox.run([sleep, "5"]))
    if yes:
        big = sandbox.run([yes, "y"])
        _print_outcome("yes y (truncated)", big)
    if echo:
        loud = sandbox.run([echo, "x" * 4096])
        _print_outcome("echo big (truncated)", loud)

    print("")
    print(
        json.dumps(
            {"project_root": root, "sandbox_ok": True},
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(run_demo())
