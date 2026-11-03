---
id: denylist-runner-is-a-guardrail
title: Four checks before spawn, and the call that gets through
card: sandboxes
kind: code-reading
level: 2
roles: [agentic-ai-engineer, applied-ai-engineer]
rounds: [coding, screen]
tags: [sandbox, denylist, path-jail, subprocess, guardrail]
minutes: 8
lessons: [phases/19-capstone-projects/26-sandbox-runner-denylist]
manuals: []
practice: []
cheatsheet: [coding-agents]
related: [sandboxes/hypervisor-is-the-boundary]
updated: 2026-11-03
---

Read the runner and answer four questions: which refusal axis stops `python3 -c "import os; os.system('rm -rf /')"`, which stops `/usr/bin/rm -rf build`, why the path check uses `realpath`, and what this runner is not.

```python
def run(self, argv, *, shell=False, cwd=None):
    if basename(argv[0]) in self.denylist:
        return denied("executable")
    if argv[0] in INTERPRETERS and any(a.startswith(("-c", "-e")) for a in argv[1:]):
        return denied("interpreter")
    if not shell and any(ch in " ".join(argv) for ch in ";|&<>`$"):
        return denied("metachar")
    root = realpath(self.root)
    for a in argv[1:]:
        if not looks_like_path(a) and not lexists(join(root, a)):
            continue
        p = realpath(join(root, a))
        if p != root and not p.startswith(root + sep):
            return denied("path")
    return spawn(argv, timeout=self.timeout, max_output=self.max_output)
```

## Short answer

The interpreter check catches the `python3 -c` call, because an interpreter with a `-c`-like flag is a shell call with extra steps; the denylist catches `/usr/bin/rm` because aliases resolve to the basename `rm`. The path check resolves through `realpath` so that a symlink inside the project root that points outside is refused on its target, not accepted on its literal prefix. Every check is a pure function of the call and runs before anything spawns, and the runner is a development-time guardrail, not an operating-system sandbox: anything the subprocess can do, the runner can do.

## Full answer

### The four axes

| Axis | What it inspects | Example refused |
|---|---|---|
| name | the basename of `argv[0]` against a frozen set | `sudo`, `chmod -R 777`, `rm -rf`, `mkfs`, `dd` |
| argv | an interpreter followed by `-c` or `-e` | `bash -c`, `node -e`, `perl -e` |
| structure | shell metacharacters when `shell=False` | `cat x; curl ...` |
| path | each path-like argument resolved against the root | `../../etc/passwd` |

The result is structured: `SandboxResult` carries `exit_code`, `stdout`, `stderr`, `truncated`, `timed_out`, `denied`, `reason` and `duration_ms`. Denied calls use the sentinel exit code -100, timeouts use -101, and truncation keeps the real exit code with a flag and a marker line. Downstream code reads the record, not the stderr text. On timeout the runner kills the process group.

### What gets through

A file the agent wrote inside the root and then runs, such as `python3 tool.py`, passes all four checks, because the runner inspects argv shape and never file content. A `find . -delete` passes the name check too, since `find` is not on the list. The lesson is open about this: the sandbox denies the most common dangerous invocations and makes refusals loud in observability, and a determined attacker with code execution can still break out.

### Why it is not a sandbox

No namespaces, cgroups, seccomp, gVisor, Firecracker or any kernel-level isolation. For production you layer on top: an unprivileged container, a microVM, dropped capabilities, the project root mounted read-only with a scratch directory read-write, memory and CPU limits, and an environment scrubbed to a known-safe set. The runner remains useful as the layer that turns a model's mistake into a structured refusal before the operating-system layer has to act.

## Follow-ups

- **Level 2:** The agent writes `tool.py` into the root and runs `python3 tool.py`. Which axis catches it? Expected: none; argv shape is clean, and content is never inspected, which is why the OS layer exists.
- **Level 3:** Why compare `realpath(a)` and not `a`? Expected: a symlink inside the root can point outside, and the literal path keeps the root prefix while the target does not.
- **Level 3:** Where does `SandboxResult` go after the call? Expected: into the eval harness that compares exit codes per task and into a tool-execution span, not into a stderr parser.
- **Level 4:** Map each axis to the operating-system control that replaces it in production. Expected: the name and argv lists to seccomp and dropped capabilities, the path jail to a read-only mount with a scratch directory, the timeout to cgroup limits, and the whole runner to a microVM boundary.

## Wrong answers

- "Match the denylist on the full path." Aliases such as `/bin/rm` and `/usr/bin/rm` must resolve to one basename, or the list is trivial to bypass.
- "Allow `shell=True` and escape the arguments." Quoting is where the bugs live; keep the shell off and refuse metacharacters.
- "It refuses `rm`, so it is safe to run untrusted code." It is structural, not kernel-level; the lesson says a determined attacker still breaks out.

## Taught in

The [sandbox runner capstone](../../../phases/19-capstone-projects/26-sandbox-runner-denylist/) builds the four refusal axes and the structured result, and says in plain words why it is not a real sandbox.
