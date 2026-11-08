---
name: dynamic-analysis-of-your-own-program
description: Drive lldb or gdb in batch mode over a program you compiled, record registers and memory at every stop, and grade each static claim as confirmed, refuted, or not observed for that run.
version: 1.0.0
phase: 13
lesson: 42
tags: [reverse-engineering, dynamic-analysis, lldb, gdb, breakpoints, watchpoints, core-dumps, evidence]
---

Given a program you wrote and compiled with debug information, a disassembly listing of that build, and a list of static claims from earlier analysis, produce one debugger run whose transcript is saved, and one evidence record per claim per stop. Use this skill with Claude, Cursor, Codex, OpenClaw, Hermes, or any agent that reads SKILL.md.

## Required inputs

- The source, the exact compiler command, and the binary it produced. Debug only builds you made yourself.
- A listing from `llvm-objdump -d` or `objdump -d` of that binary, so breakpoint addresses come from the listing and not from memory.
- The DWARF dump of the struct types the claims mention, or the `ctypes` layout, as the source of field offsets.
- The claims to test, each as a sentence with the function, the register or address, the expected value or edge, and the lesson or document it came from.
- A debugger: lldb from the Command Line Tools or Xcode on macOS, lldb or gdb on Linux. Record the version string.

## Procedure

1. Read the listing. For each function in the claims record its start and end address. For each conditional branch in a function with an edge claim record the branch address, its target, and its fall-through address.
2. Write the debugger commands to a file before you run anything: one `breakpoint set -n` per function, one `breakpoint set -a ADDR -s MODULE` per branch successor, one stop hook that reads the argument registers, the memory behind the first argument, and the frame variables, then `run`, the watchpoint you want, a fixed budget of `continue`, and `breakpoint list` plus `watchpoint list -v` at the end.
3. Run the debugger in batch mode with `settings set interpreter.stop-command-source-on-error false` so a command that fails after the process exits does not end the session. Save the complete output as the transcript with the command line and the debugger version in a header.
4. Parse the transcript into stops. Each stop has a program counter, a function, a stop reason, the registers and memory the hook printed, and the frame variables. Attach hook output to the stop report that follows it.
5. Grade each claim at each stop that can test it. A register claim compares the register with the frame variable. A field-offset claim decodes the memory words through the DWARF offsets and compares them with the frame variable fields. An edge claim reads the compared value at the function entry and checks that the next stop is the successor the lifted condition predicts. A call-edge claim counts entry stops after the process has exited.
6. Write `confirmed` when the observation agrees, `refuted` when it disagrees, and `not-observed` when no stop could test the claim. Say why it was not observed: the breakpoint never hit, the watchpoint was never set, or the process did not exit.
7. Repeat on an optimized build of the same source. Expect resolved breakpoints with hit count 0 where the compiler inlined the function, and keep those claims `not-observed` unless the claim was about the call edge itself, which the full run refutes.
8. If the run cannot start, record the exact error. On macOS a sandboxed shell reports `attach failed ((os/kern) invalid address)`, and a hardened target without `com.apple.security.get-task-allow` refuses the task port. Neither is evidence about the program.

## Required report

- compiler, debugger version, operating system, and the build flags of every binary used
- the transcript file names and the command that produced each one
- the stops in order with program counter, function, reason, and the registers read
- every claim with its verdict, the stop indexes that produced the verdict, and the observation text
- breakpoint hit counts and watchpoint hit counts from the end of the run
- the process exit status and its standard output
- the claims that stayed `not-observed` and the reason for each

## Hard rejects

- Treating a resolved breakpoint as proof that the code runs.
- Treating a hit count of zero as proof that a function is dead code.
- Reading a struct through a pointer without the field offsets from DWARF or from the ABI rules.
- Comparing an argument register at a stop that is not the function entry, where the register may hold a leftover value.
- Grading an edge claim from the branch instruction alone instead of from the stop at the successor.
- Setting a watchpoint on a local that lives in a register in an optimized build and reporting the silence as proof.
- Running the debugger against a binary you did not build, or attaching to a process you do not own.
- Deleting the transcript after grading. The transcript is the evidence; the verdicts are derived from it.
- Reporting a run on one input as a statement about every input.

## Produce

Return these sections:

1. Build: compiler, flags, debugger, and the listing and DWARF files used.
2. Plan: the command file as written, with the address of every breakpoint and where it came from.
3. Stops: the timeline, one row per stop.
4. Verdicts: one row per claim with confirmed, refuted, and not-observed counts and the final verdict.
5. Not observed: each claim no stop tested, with the reason.
6. Environment facts: signing flags of the binary, hardware watchpoint count, and any launch error.

End with the first refuted claim. If there is none, state the number of stops and the number of claims confirmed by them.
