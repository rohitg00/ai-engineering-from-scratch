"""Tests for the sandbox runner."""

from __future__ import annotations

import os
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from main import (  # noqa: E402
    DEFAULT_INTERPRETER_BLOCK,
    DENIED_EXIT_CODE,
    TIMED_OUT_EXIT_CODE,
    Sandbox,
    SandboxConfig,
    _check_argv_interpreter,
    _check_executable_denylist,
    _check_path_jail,
    _check_shell_metachars,
    find_executable,
    run_demo,
    truncate_stream,
)


def _make_root() -> tuple[str, SandboxConfig]:
    root = tempfile.mkdtemp(prefix="sandbox-test-")
    with open(os.path.join(root, "f.txt"), "w", encoding="utf-8") as fh:
        fh.write("hello\n")
    cfg = SandboxConfig(
        project_root=root, max_output_bytes=256, timeout_seconds=2.0
    )
    return root, cfg


class DenylistPureChecks(unittest.TestCase):
    def setUp(self) -> None:
        _, self.cfg = _make_root()

    def test_denies_rm(self) -> None:
        reason = _check_executable_denylist(["rm", "-rf", "."], self.cfg)
        self.assertIsNotNone(reason)
        self.assertIn("denylist", reason)

    def test_denies_full_path_rm(self) -> None:
        reason = _check_executable_denylist(["/bin/rm", "-rf", "x"], self.cfg)
        self.assertIsNotNone(reason)

    def test_allows_echo(self) -> None:
        reason = _check_executable_denylist(["echo", "hi"], self.cfg)
        self.assertIsNone(reason)


class InterpreterChecks(unittest.TestCase):
    def setUp(self) -> None:
        _, self.cfg = _make_root()

    def test_python_c_denied(self) -> None:
        reason = _check_argv_interpreter(["python3", "-c", "print('hi')"], self.cfg)
        self.assertIsNotNone(reason)
        self.assertIn("python3", reason)

    def test_bash_c_denied(self) -> None:
        reason = _check_argv_interpreter(["bash", "-c", "echo hi"], self.cfg)
        self.assertIsNotNone(reason)

    def test_node_e_denied(self) -> None:
        reason = _check_argv_interpreter(["node", "-e", "console.log('x')"], self.cfg)
        self.assertIsNotNone(reason)

    def test_python_script_allowed(self) -> None:
        reason = _check_argv_interpreter(["python3", "script.py"], self.cfg)
        self.assertIsNone(reason)


class ShellMetacharChecks(unittest.TestCase):
    def test_semicolon_denied(self) -> None:
        reason = _check_shell_metachars(["echo", "a;", "b"], shell=False)
        self.assertIsNotNone(reason)

    def test_pipe_denied(self) -> None:
        reason = _check_shell_metachars(["echo", "a|grep"], shell=False)
        self.assertIsNotNone(reason)

    def test_shell_true_skips_check(self) -> None:
        reason = _check_shell_metachars(["echo", "a;b"], shell=True)
        self.assertIsNone(reason)

    def test_clean_argv_passes(self) -> None:
        reason = _check_shell_metachars(["echo", "hello"], shell=False)
        self.assertIsNone(reason)


class PathJailChecks(unittest.TestCase):
    def test_relative_inside_root_allowed(self) -> None:
        _, cfg = _make_root()
        reason = _check_path_jail(["cat", "f.txt"], cfg)
        self.assertIsNone(reason)

    def test_traversal_outside_root_denied(self) -> None:
        _, cfg = _make_root()
        reason = _check_path_jail(["cat", "../../etc/passwd"], cfg)
        self.assertIsNotNone(reason)
        self.assertIn("outside project root", reason)

    def test_absolute_outside_root_denied(self) -> None:
        _, cfg = _make_root()
        reason = _check_path_jail(["cat", "/etc/passwd"], cfg)
        self.assertIsNotNone(reason)

    def test_flag_arg_skipped(self) -> None:
        _, cfg = _make_root()
        reason = _check_path_jail(["echo", "-n"], cfg)
        self.assertIsNone(reason)

    def test_slashless_symlink_to_outside_is_denied(self) -> None:
        # A symlink whose name has no slash points outside the root. The module
        # advertises a "symlink-safe path jail via realpath prefix check", so the
        # jail must resolve and refuse it even though _looks_like_path misses it.
        root, cfg = _make_root()
        outside_dir = tempfile.mkdtemp(prefix="sandbox-outside-")
        secret = os.path.join(outside_dir, "secret.txt")
        with open(secret, "w", encoding="utf-8") as fh:
            fh.write("TOP-SECRET\n")
        os.symlink(secret, os.path.join(root, "link.txt"))
        reason = _check_path_jail(["cat", "link.txt"], cfg)
        self.assertIsNotNone(reason)
        self.assertIn("outside project root", reason)


class TruncateTests(unittest.TestCase):
    def test_under_cap_not_truncated(self) -> None:
        buf, truncated = truncate_stream(b"abc", 100)
        self.assertEqual(buf, b"abc")
        self.assertFalse(truncated)

    def test_over_cap_truncated_with_marker(self) -> None:
        buf, truncated = truncate_stream(b"x" * 200, 50)
        self.assertTrue(truncated)
        self.assertTrue(buf.startswith(b"x" * 50))
        self.assertIn(b"truncated", buf)


class SandboxIntegrationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.root, self.cfg = _make_root()
        self.sandbox = Sandbox(config=self.cfg)

    def test_echo_runs_ok(self) -> None:
        echo = find_executable(("echo",)) or "echo"
        result = self.sandbox.run([echo, "hello"])
        self.assertTrue(result.ok, msg=f"stderr={result.stderr!r}")
        self.assertIn(b"hello", result.stdout)
        self.assertFalse(result.denied)
        self.assertFalse(result.timed_out)

    def test_rm_refused(self) -> None:
        result = self.sandbox.run(["rm", "-rf", "."])
        self.assertTrue(result.denied)
        self.assertEqual(result.exit_code, DENIED_EXIT_CODE)

    def test_bash_c_refused(self) -> None:
        result = self.sandbox.run(["bash", "-c", "echo pwned"])
        self.assertTrue(result.denied)
        self.assertIn("interpreter", result.reason)

    def test_traversal_refused(self) -> None:
        cat = find_executable(("cat",))
        if cat is None:
            self.skipTest("cat not available")
        result = self.sandbox.run([cat, "../../etc/passwd"])
        self.assertTrue(result.denied)
        self.assertIn("outside project root", result.reason)

    def test_truncation_fires_on_large_stdout(self) -> None:
        echo = find_executable(("echo",))
        if echo is None:
            self.skipTest("echo not available")
        big = "y" * 4096
        result = self.sandbox.run([echo, big])
        self.assertTrue(result.truncated)
        self.assertLessEqual(len(result.stdout), self.cfg.max_output_bytes + 200)

    def test_timeout_fires(self) -> None:
        sleep = find_executable(("sleep",))
        if sleep is None:
            self.skipTest("sleep not available")
        cfg = SandboxConfig(
            project_root=self.root, max_output_bytes=128, timeout_seconds=0.3
        )
        sb = Sandbox(config=cfg)
        result = sb.run([sleep, "2"])
        self.assertTrue(result.timed_out)
        self.assertEqual(result.exit_code, TIMED_OUT_EXIT_CODE)

    def test_demo_main_exits_zero(self) -> None:
        self.assertEqual(run_demo(), 0)

    def test_interpreter_block_covers_canonical_set(self) -> None:
        self.assertIn("python3", DEFAULT_INTERPRETER_BLOCK)
        self.assertIn("bash", DEFAULT_INTERPRETER_BLOCK)
        self.assertIn("node", DEFAULT_INTERPRETER_BLOCK)


if __name__ == "__main__":
    unittest.main()
