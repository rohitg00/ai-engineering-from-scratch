# Dynamic Analysis of Your Own Program: Debuggers, Traces, and Confirming Static Claims

> A breakpoint hit is an observation about one run of one build. This lesson builds the harness that turns those observations into confirmed, refuted, and not-observed verdicts on the claims the static lessons made.

**Type:** Build
**Languages:** Python, C, arm64 assembly, lldb command language
**Prerequisites:** Phase 13 · 33 (disassembly and control flow), Phase 13 · 35 (evidence, confidence, and unknowns)
**Time:** ~130 minutes

## Learning Objectives

- Explain what a debugger needs from the operating system on Linux (`ptrace`) and on macOS (Mach task ports and exception ports), and why a sandboxed shell cannot launch a debuggee.
- Set software breakpoints by name and by listing address, set a hardware watchpoint, and read the limits that the processor imposes on both.
- Drive lldb in batch mode from Python with a stop hook that records registers, memory, and frame variables at every stop, and parse the transcript back into a timeline.
- Check static claims from lessons 32, 33, 34, and 41 against that timeline: argument registers, struct field offsets, which edge a conditional branch took, and which calls happened.
- Run the same plan against an `-O2` build, read breakpoints that resolve and never hit, and say what that does and does not prove.
- Save and load a core file, and name what a stack-style core leaves out.
- Map the gdb and lldb command sets, and place `strace`, `ltrace`, `bpftrace`, `dtrace`, and `rr` on the right operating system with their versions and licences.
- State the macOS code-signing facts that let lldb debug a binary you built yourself, and the two conditions under which it refuses.

## The Problem

Lesson 41 read `struct account` from DWARF and said `balance` sits at offset 4. Lesson 33 built the control-flow graph of `classify` and said the first branch goes to the `return -1` block when the balance is negative. Lesson 32 said the first two arguments arrive in `x0` and `x1`. Every one of those sentences was derived from bytes. None of them was observed.

An agent then reads the same program and reports "main calls `bump`, `classify`, and `sum_balances`". The symbol table lists all three, so the sentence looks safe. You build the program at `-O2`, set a breakpoint on each function, and run it. The process prints its four lines and exits. Every breakpoint reports `hit count = 0`.

The agent was not wrong about the source. It was wrong about the build it was asked about. The compiler inlined all three calls and folded `sum_balances(rows, 3)` into the constant 315. The only way to know that for this binary on this machine is to run it under a debugger and look.

This lesson builds a harness that does the looking. It compiles `account.c`, reads the listing, plans one lldb session, runs it, and grades each static claim against what the stops show. The grading has three outcomes. `confirmed` means a stop showed the claim to be true for this run. `refuted` means a stop showed it to be false. `not-observed` means no stop could test it, and the record says why. Lesson 35 then stores each verdict as an `observed` record with authority `controlled-replay`.

```figure
re-42-run-timeline
```

## A Debugger Is Three System Services and a Table

A debugger does four things to a process it does not own the code of. It stops the process, reads and writes its registers, reads and writes its memory, and gets told when the process stops again. The kernel provides each of these as a service, and the services differ by operating system.

On Linux the service is `ptrace(2)`. The manual page says it "provides a means by which one process (the tracer) may observe and control the execution of another process". `PTRACE_TRACEME` lets a child announce that its parent will trace it, `PTRACE_ATTACH` takes an unrelated process, `PTRACE_PEEKDATA` reads "a word at the address addr in the tracee's memory", `PTRACE_GETREGS` reads the registers, and `PTRACE_SINGLESTEP` runs one instruction. The Yama module limits attach: `/proc/sys/kernel/yama/ptrace_scope` at its default of 1 means "the target process must be a descendant of the caller", 2 means only an administrator may attach, and 3 means nobody may.

On macOS `ptrace` is a smaller interface. Apple's manual lists `PT_TRACE_ME`, `PT_ATTACHEXC`, `PT_STEP`, `PT_CONTINUE`, and `PT_KILL`, and says that with `PT_ATTACHEXC` "Signals from the child go to the parent as Mach exceptions". Memory and registers do not go through `ptrace` at all. lldb's `debugserver` calls `task_for_pid()` to get a Mach task port for the process, then `task_set_exception_ports()` so that breakpoints arrive as exception messages. The system daemon `taskgated` decides who may call `task_for_pid`.

You can see the cost of that design in a transcript this lesson keeps. The session's shell runs under a Seatbelt sandbox. The same plan that produces eleven stops outside the sandbox produces this inside it:

```text
(lldb) run
error: process exited with status -1 (attach failed ((os/kern) invalid address))
```

The process was created and then could not be adopted. The error is about the debugger's rights, and it says nothing about the program. The harness records it as a launch failure, with zero stops and no verdicts.

The table is the breakpoint table. The debugger remembers which instruction byte it replaced at which address, so it can put the original back when you continue, and it counts hits per location. `breakpoint list` prints that table, and the harness reads it at the end of every run.

## Breakpoints: One Byte or One Word Replaced

A software breakpoint is an instruction the processor traps on, written over the first bytes of the instruction you want to stop at. On x86-64 that is `INT3`, opcode `CC`, one byte long, which the Intel manual describes as "intended for calling the debug exception handler". On arm64 it is `BRK #imm16`, a four-byte instruction whose exception "records the exception in ESR_ELx, using the EC value 0x3C". The Arm manual adds that the preferred return address is the `BRK` instruction itself, which is why a stop reports the address of the replaced instruction and not the one after it.

lldb sets breakpoints by name, by file and line, or by address. By name it skips the prologue:

```text
(lldb) breakpoint set -n bump
Breakpoint 1: where = account-O0`bump + 12 at account.c:13:19, address = 0x00000001000004bc
```

`bump + 12` is the fourth instruction. The three before it are `sub sp, sp, #0x10`, `str x0, [sp, #0x8]`, and `str w1, [sp, #0x4]`, the frame setup that the DWARF line table attributes to the function's opening line. At the stop, `x0` and `x1` still hold the arguments, because the prologue only copied them.

By address, lldb needs to know which module the address belongs to. A bare `breakpoint set -a 0x100000504` before the process exists is a load address with no section behind it, and in a first test it stayed `unresolved` through the whole run with `hit count = 0`. The form the harness uses names the module:

```text
(lldb) breakpoint set -a 0x100000504 -s account-O0
Breakpoint 4: address = 0x0000000100000504
```

With `-s` the number is a file address inside `account-O0`, lldb adds the load slide, and after the run the location reads `resolved, hit count = 2`. The lesson 33 listing gives file addresses, so this is the form that connects a static listing to a dynamic stop.

### Decode the branch by hand

The first conditional branch in `classify` at `-O0` is the word `36f800a8` at `0x1000004f0`, which `llvm-objdump` prints as `tbz w8, #0x1f, 0x100000504`. Decode it from the Arm A64 encoding of `TBZ`.

1. Bit 31 is `b5`, the high bit of the bit number. It is 0.
2. Bits 30 to 25 are `011011`, the test-and-branch group. Bit 24 is 0, which selects `TBZ` and not `TBNZ`.
3. Bits 23 to 19 are `b40`, the low five bits of the bit number: `11111` = 31. With `b5` = 0 the tested bit is 31, the sign bit of a 32-bit value.
4. Bits 18 to 5 are `imm14`: `00000000000101` = 5. The branch offset is `imm14 * 4` = 20 = `0x14`, so the target is `0x1000004f0 + 0x14 = 0x100000504`.
5. Bits 4 to 0 are `Rt`: `01000` = 8, so the register is `w8`.

`w8` was loaded one instruction earlier by `ldr w8, [x8, #0x4]`, which is `a->balance` at offset 4. `TBZ` branches when the bit is zero. The branch is taken when the sign bit is clear, which is `balance >= 0`. The source wrote `if (a->balance < 0) return -1;`, so the compiler inverted the condition: the taken edge skips the `return -1` block, and the fall-through at `0x1000004f4` enters it. The static claim the harness carries is therefore an edge claim with a predicate: taken when `a->balance >= 0`, fall-through otherwise. The lift of the second branch works the same way. `subs w8, w8, #0xc8` computes `balance - 200` and `b.le 0x100000524` is taken when that is at most zero, which is `balance <= 200`.

## Watchpoints Are Hardware and Few

A watchpoint stops the process when memory at an address is accessed. It cannot be a replaced instruction, because any instruction anywhere might do the access. Processors therefore carry a small set of address comparators. On x86-64 they are the debug registers: `DR0` through `DR3` hold "the addresses of up to 4 breakpoints", and `DR7` enables each one and sets its condition (execute, write, or read-write) and its length (1, 2, 4, or 8 bytes). On arm64 the pairs are `DBGWVR<n>_EL1`, which "holds the data virtual address used for watchpoint matching", and `DBGWCR<n>_EL1` for the controls, and the Arm manual says "An implementation can include between 2-64 watchpoints".

lldb reports the number it was given:

```text
(lldb) watchpoint set variable a->balance
Watchpoint created: Watchpoint 1: addr = 0x16fdfe00c size = 4 state = enabled type = m
(lldb) watchpoint list
Number of supported hardware watchpoints: 4
```

Four on this machine. The watched address `0x16fdfe00c` is `x0 + 4`: the struct pointer at the `bump` stop plus the DWARF offset of `balance`. `size = 4` is the `int`. `type = m` means modify. When the slots run out lldb refuses the next watchpoint, and because a region that is not aligned or not a power of two can take two slots, the number of watchpoints you may set can be smaller than four.

Data watchpoints report after the access. The Intel manual says "an instruction that writes memory overwrites the original data before the debug exception generated by a data breakpoint is generated", and lldb keeps the old value in its own cache to print both:

```text
Watchpoint 1 hit:
old value: 250
new value: 255
* thread #1, queue = 'com.apple.main-thread', stop reason = watchpoint 1
    frame #0: 0x00000001000004d0 account-O0`bump(a=0x000000016fdfe008, by=5) at account.c:14:12
```

The stop is at `0x1000004d0`, the instruction after `str w8, [x9, #0x4]` at `0x1000004cc`. One quirk is worth knowing before you parse the output. Right after `watchpoint set`, lldb prints `Watchpoint 1 hit:` with an empty old value and `new value: 250`. That is the initial read, and the harness ignores a hit without an old value.

## Stepping, Stop Hooks, and Batch Mode

lldb's command grammar is `<noun> <verb> [-options] [arguments]`. The stepping verbs are `thread step-in` (`s`), `thread step-over` (`n`), `thread step-inst` (`si`), `thread step-inst-over` (`ni`), and `thread step-out` (`finish`). `thread until 12` runs to a line. `thread return <expr>` returns early with a value. The harness does not step. It stops at planned addresses and lets a stop hook do the reading:

```text
target stop-hook add -o "register read x0 x1 pc" -o "memory read -s4 -fx -c24 $x0" -o "frame variable -P 1"
```

`-o` may be repeated, and the commands run in order at every stop. `register read` names the two argument registers and the program counter. `memory read -s4 -fx -c24 $x0` prints 24 four-byte words in hex from the address in `x0`, which is 96 bytes, three `struct account` rows. `frame variable -P 1` prints the arguments and locals and expands pointers one level, so `a` shows its five fields.

Batch mode is `lldb -b`. The manual says `--batch` runs the commands from `-s`, `-S`, `-o`, and `-O` and then quits, and that if a command stopped "due to a signal or crash, the debugger will return to the interactive prompt". The harness writes the plan to a file and passes it with `-s`. One setting matters: `settings set interpreter.stop-command-source-on-error false`. Without it, the first `continue` after the process has exited ends the whole file, and `breakpoint list` never runs. With it, lldb prints `error: Process must be launched.` and goes on.

Two facts about the output shape decide how the parser works. First, hook output is printed as the hook runs, and the `Process N stopped` block with its `frame #0` line is printed afterwards. The parser therefore collects register, memory, and variable lines into a pending chunk and attaches the chunk to the next `frame #0` line it sees. A chunk whose program counter is in `dyld` at `_dyld_start` is the entry stop before the program runs, and no `frame #0` ever claims it. Second, a breakpoint with `--auto-continue` does not report its stop at all, and a stop hook does not run for it. A first version of this harness used auto-continue and recorded nothing. The plan uses plain breakpoints and a fixed budget of `continue` commands instead.

## The Plan Comes From the Listing

`Plan.commands()` builds the command file from the `llvm-objdump -d` text of the binary it will run. For `account-O0`:

```text
breakpoint set -n bump
breakpoint set -n classify
breakpoint set -n sum_balances
breakpoint set -a 0x100000504 -s account-O0
breakpoint set -a 0x1000004f4 -s account-O0
breakpoint set -a 0x100000524 -s account-O0
breakpoint set -a 0x100000514 -s account-O0
target stop-hook add -o "register read x0 x1 pc" -o "memory read -s4 -fx -c24 $x0" -o "frame variable -P 1"
run
watchpoint set variable a->balance
watchpoint list
continue
...
breakpoint list
watchpoint list -v
```

The three name breakpoints are the function entries. The four address breakpoints are the target and the fall-through of each conditional branch that `Listing.conditional_branches()` finds in `classify`: `tbz` at `0x1000004f0` and `b.le` at `0x100000510`. The watchpoint is set at the first stop, which the plan expects to be `bump`. Sixteen `continue` commands follow, more than any run needs, and the leftovers fail harmlessly after exit. The budget is not knowledge about the program. It is a ceiling.

The claims are built from the same inputs by `claims_for()`:

| Id | Kind | Claim | Source |
|---|---|---|---|
| `arg-registers` | argument-register | at every entry the first arguments arrive in `x0` and `x1` | lesson 32 and AAPCS64 |
| `field-offsets` | field-offset | `struct account` is 32 bytes with `kind` at 0, `balance` at 4, `code` at 8, `rate` at 16, `label` at 24 | lesson 41 and the DWARF dump |
| `branch-1` | branch-taken | `tbz` at `0x1000004f0` goes to `0x100000504` when `a->balance >= 0`, otherwise to `0x1000004f4` | lesson 33 edges and the lesson 34 lift |
| `branch-2` | branch-taken | `b.le` at `0x100000510` goes to `0x100000524` when `a->balance <= 200`, otherwise to `0x100000514` | lesson 33 edges and the lesson 34 lift |
| `calls` | call-edge | `main` calls `bump` once, `classify` three times, `sum_balances` once | source text and `nm` |
| `store-once` | store | `bump` writes `a->balance` once and the new value is the old value plus `by` | lesson 34 pseudocode |
| `stride` | struct-stride | `list[i].balance` sits at `list + 32*i + 4` | lesson 41 and the psABI aggregate rule |
| `output` | behaviour | the program prints `class 0 1 -1` and `sum 315` | source arithmetic |

The field offsets come from `struct_layout()`, which reads `DW_TAG_structure_type` with `DW_AT_byte_size (0x20)` and the five `DW_TAG_member` entries with their `DW_AT_data_member_location` out of the dSYM dump. The plan never types the number 4. It reads it.

## The Run at -O0: Eleven Stops

The first stop is the `bump` breakpoint. The hook printed this before the stop block:

```text
      x0 = 0x000000016fdfe008
      x1 = 0x0000000000000005
      pc = 0x00000001000004bc  account-O0`bump + 12 at account.c:13:19
0x16fdfe008: 0x00000073 0x000000fa 0x00000009 0x00000000
0x16fdfe018: 0x00000000 0x3ff40000 0x00000719 0x00000001
0x16fdfe028: 0x0000006c 0xffffffd8 0x00000003 0x00000000
0x16fdfe038: 0x00000000 0x40000000 0x00000721 0x00000001
(account *) a = 0x000000016fdfe008 {
  kind = 's'
  balance = 250
  code = 9
  rate = 1.25
  label = 0x0000000100000719 "savings"
}
(int) by = 5
```

Read the eight words of the first row against the DWARF offsets. Word 0 at offset 0 is `0x73`, which is `'s'`, the `kind` byte, followed by three padding bytes. Word 1 at offset 4 is `0xfa` = 250, `balance`. Word 2 at offset 8 is `0x9`, `code`, a `short` in the low half with two padding bytes above it. Word 3 at offset 12 is padding before the 8-byte-aligned `double`. Words 4 and 5 at offset 16 are `0x3ff4000000000000`, which is the IEEE-754 encoding of 1.25. Words 6 and 7 at offset 24 are `0x100000719`, the `label` pointer into `__TEXT`. The next eight words start with `0x6c` = `'l'` and `0xffffffd8` = -40: the third row, `loan`, 32 bytes later. Every number agrees with `frame variable`, so `_check_layout()` records `field-offsets` as `confirmed` at this stop, and it does so again at each of the eleven stops where `x0` holds a struct pointer.

`x0` equals `a` and `x1` equals `by`, so `arg-registers` is confirmed at this entry. The harness compares only the declared arguments. At the `classify` stops `x1` still reads `0x5`, a leftover from `bump`, and `classify` has one argument, so nothing is compared against it. A register that no argument lives in is noise, and the lesson 32 claim says nothing about it.

The second stop is the watchpoint, old value 250, new value 255, `by` = 5. One hit in the whole run, so `store-once` is confirmed. Then come three activations of `classify`, each with its entry stop and one or two edge stops:

| Stop | Address | Stop reason | What it tests |
|---|---|---|---|
| 2 | `0x1000004e8` | breakpoint 2.1 | entry, `a->balance` = 100, `x0` = `a` |
| 3 | `0x100000504` | breakpoint 4.1 | `tbz` taken, 100 >= 0, `branch-1` confirmed |
| 4 | `0x100000524` | breakpoint 6.1 | `b.le` taken, 100 <= 200, `branch-2` confirmed |
| 5 | `0x1000004e8` | breakpoint 2.1 | entry, `a->balance` = 255 |
| 6 | `0x100000504` | breakpoint 4.1 | `tbz` taken, 255 >= 0 |
| 7 | `0x100000514` | breakpoint 7.1 | `b.le` fell through, 255 > 200 |
| 8 | `0x1000004e8` | breakpoint 2.1 | entry, `a->balance` = -40 |
| 9 | `0x1000004f4` | breakpoint 5.1 | `tbz` fell through, -40 < 0 |
| 10 | `0x100000544` | breakpoint 3.1 | `sum_balances` entry, `x1` = 3 |

`_check_branches()` groups the stops into activations, reads the balance at the entry, and for each edge stop computes the successor the lifted predicate predicts. Five edge stops, five agreements: `branch-1` confirmed three times, `branch-2` twice. Stop 5 shows the balance as 255, which is the value the watchpoint saw written. The run is one program and the evidence connects.

At stop 10 the hook read 24 words from `list`. `_check_stride()` takes word 1, word 9, and word 17, which are offsets 4, 36, and 68: 100, 255, and -40. It compares each with the balance `classify` saw at the same address, sums them to 315, and compares the sum with the `sum 315` line the program printed. Then the process exits with status 0 and `breakpoint list` shows hit counts of 1, 3, 1 for the names and 2, 1, 1, 1 for the four edges. All eight claims end `confirmed`, with 25 records behind them, 23 of them tied to a stop and two to the finished run.

## The Run at -O2: Zero Stops

The same source at `-O2` is a different program. `llvm-objdump -d` of `main` has four `bl` instructions, all to `printf`. In place of the calls it has `mov w8, #-0x1`, `mov w8, #0x1`, a zero through `xzr`, and `mov w8, #0x13b`, which is 315. The compiler computed every result at compile time. `nm` still lists `_bump`, `_classify`, and `_sum_balances`, because they are external functions and the out-of-line copies must exist for other objects to call. The dSYM has `DW_TAG_subprogram` entries for all four functions and zero `DW_TAG_inlined_subroutine` entries, so even the debug information does not record the inlining.

The plan for this build has three name breakpoints and no edge breakpoints. `classify` at `-O2` is six instructions, `ldr`, `cmp`, `cset`, `cmp`, `csinv`, `ret`, with no conditional branch in it. The edge claims from the `-O0` listing have no address in this binary, and the harness does not carry them over. A claim about an edge belongs to the build whose listing has the edge.

The run:

```text
(lldb) breakpoint set -n bump
Breakpoint 1: where = account-O2`bump at account.c:13:16, address = 0x0000000100000460
(lldb) run
sizeof 32 align 8
offsets 0 4 8 16 24
class 0 1 -1
sum 315
Process 48444 exited with status = 0 (0x00000000)
(lldb) watchpoint set variable a->balance
error: Command requires a process which is currently stopped.
(lldb) breakpoint list
1: name = 'bump', locations = 1, resolved = 1, hit count = 0
```

Each breakpoint resolved. The address exists, the symbol exists, and lldb wrote a `BRK` there. The hit count is zero because no instruction fetch ever reached the address. The verdicts:

| Claim | Verdict | Record |
|---|---|---|
| `calls` | refuted | after a full run with exit status 0, entry stops bump 0, classify 0, sum_balances 0 |
| `output` | confirmed | the four lines and exit status 0 |
| `arg-registers` | not-observed | no stop tested it, hit counts all 0 |
| `field-offsets` | not-observed | no stop tested it |
| `store-once` | not-observed | no stop in bump, so the watchpoint was never set |
| `stride` | not-observed | no stop in sum_balances |

Be exact about what the refutation says. The claim was that `main` calls the three functions in this program. For this build and this run it does not, and the harness checked that the run completed, because a hit count of zero before exit would mean only that the run had not reached the call yet. The claim did not say the functions are dead code, and the run does not say that either: they are exported and another object could call them. The other four claims are neither confirmed nor refuted. The struct still has `balance` at offset 4 in this build, and the `-O2` DWARF says so, but no stop in this run read memory to show it. `not-observed` keeps that distinction, and lesson 35 keeps the unknown open until a run does observe it.

## Core Dumps

A core file is the process's memory and registers written to disk, so the debugger can read a stopped program after the program is gone. Apple's `core(5)` says "A small number of signals which cause abnormal termination of a process also cause a record of the process's in-core state to be written to disk", into `/cores/core.pid`, "provided the terminated process had write permission in the directory, and the directory existed". On this machine `sysctl` reports `kern.coredump: 1` and `kern.corefile: /cores/core.%P`, `/cores` exists with mode `drwxrwxr-t root admin`, and the shell's `ulimit -c` is 0. No kernel core is written until you raise the limit with `ulimit -c unlimited`, or system-wide with `launchctl limit core unlimited`.

lldb writes a core on demand without a crash. At the `bump` breakpoint:

```text
(lldb) process save-core --style stack account-O0-stack.core
Saving 49152 bytes of data for memory region at 0x16fdf4000

Modified-memory or stack-memory only corefile created.  This corefile may 
not show library/framework/app binaries on a different system, or when 
those binaries have been updated/modified. Copies are not included
in this corefile.  Use --style full to include all process memory.
```

The file was 53,248 bytes. Loading it needs the binary beside it:

```text
(lldb) target create "./account-O0" --core "account-O0-stack.core"
(lldb) bt
* thread #1, stop reason = ESR_EC_BRK_AARCH64 (fault address: 0x0)
  * frame #0: 0x00000001000004bc account-O0`bump(a=0x000000016fdfe008, by=5) at account.c:13:19
    frame #1: 0x0000000100000640 account-O0`main at account.c:40:5
    frame #2: 0x000000019a949d54 dyld`start + 7184
(lldb) frame variable *a
(account) *a = (kind = 's', balance = 250, code = 9, rate = 1.25, label = "")
(lldb) frame variable a->label
(const char *) a->label = 0x0000000100000719 ""
```

The backtrace and the integer fields are intact, because they live on the stack that the core saved. `label` prints as an empty string with its pointer intact. The pointer `0x100000719` is correct; the bytes it points at are the literal `"savings"` in the `__TEXT` segment of the executable, and a stack-style core does not include that segment. The pointer is an observation. The string is not available, and lldb does not invent it. `--style full` includes all process memory, and a full core of this 34 KB program on the research machine was 2.1 GB, because the process maps the shared cache. The stop reason reads `ESR_EC_BRK_AARCH64`: the core recorded the `BRK` exception that the breakpoint raised.

On Linux the kernel writes the core according to `/proc/sys/kernel/core_pattern`, a template with `%p` for the PID, `%e` for the command name, `%s` for the signal, and `%t` for the time, and a leading `|` pipes the dump to a program. systemd distributions use that pipe for `systemd-coredump`, and `coredumpctl list`, `info`, `dump`, and `debug` retrieve what it stored. `gdb prog core` and `lldb -c core prog` both open the result.

## gdb and lldb Side by Side

The two debuggers do the same work with different words. `COMMAND_MAP` in the harness holds 35 rows, printed by `python3 code/main.py commands`. The ones this lesson uses:

| Task | gdb | lldb | lldb alias |
|---|---|---|---|
| break at a function | `break bump` | `breakpoint set -n bump` | `b bump` |
| break at an address in one module | `break *0x1000004f0` | `breakpoint set -a 0x1000004f0 -s account-O0` | |
| run commands at every stop | `define hook-stop` ... `end` | `target stop-hook add -o '...'` | |
| list breakpoints with hit counts | `info breakpoints` | `breakpoint list` | `br l` |
| watch a variable for writes | `watch a->balance` | `watchpoint set variable a->balance` | `wa s v a->balance` |
| list watchpoints | `info watchpoints` | `watchpoint list -v` | `wa l -v` |
| read one register | `p $x0` | `register read x0` | |
| read memory as words | `x/8xw 0x16fdfe008` | `memory read -s4 -fx -c8 0x16fdfe008` | `x -s4 -fx -c8 0x16fdfe008` |
| show arguments | `info args` | `frame variable --no-locals` | |
| step one instruction | `stepi` | `thread step-inst` | `si` |
| run until the function returns | `finish` | `thread step-out` | `finish` |
| write a core file | `gcore core` | `process save-core --style stack core` | |
| open a core file | `gdb account-O0 core` | `lldb -c core account-O0` | |

lldb's `p` is an alias of `dwim-print`, which prints a plain variable through the `frame variable` path and falls back to `expression` for anything else. `v` is `frame variable`. Prefer `frame variable` in a harness: it reads DWARF locations and never runs code in the debuggee.

Versions and licences on 2026-10-14. lldb carries the LLVM version number, and the current llvm.org release is LLVM 23.1.3 of 2026-10-06, under the Apache License 2.0 with LLVM exceptions. Homebrew ships it as the separate formula `lldb`. The Command Line Tools on this machine ship `lldb-1703.0.236.21`, Apple's own numbering, with an embedded Python 3.9.6, and Apple's lldb is already signed to debug. GDB 18.1 was released on 2026-09-25 under GPL-3.0-or-later. Its release notes list Windows, `.gdb_index`, AArch64 `FPMR`, and Python `gdb.Corefile` changes and no Darwin entry. GDB has no native support for Apple silicon processes through 18.1: a 15-patch "Initial AArch64-Darwin support" series was posted in October 2025, and in February 2026 a maintainer set out the route to land it through copyright assignment and the BFD patches first. The Homebrew `gdb` formula has arm64 bottles and builds with a faked `--target=x86_64-apple-darwin20`, and the pull request that added them says "it is not possible to debug aarch64-darwin binaries via GDB". Any non-Apple debugger on macOS also needs a self-signed certificate and the `com.apple.security.cs.debugger` entitlement, or `task_for_pid` fails with "(os/kern) failure (0x5)". gdb's place in this course is Linux, where Debian stable ships gdb 16.3 for arm64, and where `rr` lives.

## Tracing: What the Program Asked the Kernel For

A debugger shows the program's state at a stop. A tracer shows the program's effects on the system without stopping it for long. The tools are per operating system.

| Tool | OS | Version | Licence | What it records |
|---|---|---|---|---|
| `strace` | Linux | 7.2, 2026-08-18 | LGPL-2.1-or-later | system calls with arguments and return values |
| `ltrace` | Linux | 0.7.3 last tarball, git snapshots in Debian | GPL-2.0 | dynamic library calls |
| `bpftrace` | Linux | v0.27.0, 2026-09-10 | Apache-2.0 | kernel and user probes through eBPF |
| `dtrace` and `dtruss` | macOS | `Sun D 1.19` in macOS 26.2 | CDDL, from Sun's OpenSolaris | D probes; `dtruss` prints system calls |

`dtruss` says in its manual that "Since this uses DTrace, only users with root privileges can run this command". Apple's `dtrace(1)` adds that "With default System Integrity Protection settings, D programs are not permitted to access kernel address values or kernel memory contents" and that destructive actions are not allowed under SIP. `sudo dtruss ./account-O0` on this machine was not run in this lesson, because the harness runs without root, and the lesson records that as unverified. A trace answers a different question from the harness: "did this run issue a `write` for each `printf` line" is a trace question, "did `x1` hold 5 at `bump`" is a debugger question. Both are per run.

## Record and Replay

`rr` records a run once and replays it deterministically under gdb, with reverse execution: set a watchpoint on the value you care about and `reverse-cont` runs backwards to the write. The project describes itself as "You record a failure once, then debug the recording, deterministically, as many times as you want". The current release is 5.9.0 of 2025-02-13, under the MIT licence with a BSD-2-Clause block. It is Linux only. It needs hardware performance counters to count branches, so it runs on Intel Nehalem and later, certain AMD Zen cores, and "certain AArch64 microarchitectures (e.g. ARM Neoverse N1 or the Apple Silicon M-series)" under Linux. Inside a virtual machine the counters must be virtualized, and the project wiki says "No other virtualization on Mac does either", so Docker and Colima on this machine cannot run it. Pernosco is the commercial service built on rr recordings.

gdb has a software recorder of its own. `record full` records "a log of the process execution" with a default limit of 200,000 instructions, and `record btrace` uses Intel branch tracing and "does not record data". Neither is available in lldb. On this macOS machine, the harness's saved transcript is the record: the same plan on the same binary produces the same stops in the same order, and the fixture tests pin that order.

## What One Run Proves

One run proves one input on one build. The C standard defines undefined behaviour as "behavior, upon use of a nonportable or erroneous program construct or of erroneous data, for which this document imposes no requirements", so a program that overflows a signed `int` may legitimately print different results at `-O0` and `-O2`. Lesson 36 met this with the `percent_change` overflow cells. UBSan turns the question into a stop: `-fsanitize=signed-integer-overflow -fsanitize-trap=undefined` makes the overflow "execute a trap instruction", which lands in lldb as a stop with a reason.

Optimized code also moves what you want to watch. GDB's manual says "the optimizer has rearranged your code; the debugger shows you what is really there" and that a variable optimized out of existence is one "GDB never sees". GDB prints such a value as `<optimized out>`, and its source separates that from `<unavailable>`: optimized out "does not actually exist in the program", unavailable "exists in the program (at the machine level), but GDB has no means to get to it". lldb prints `<variable not available>` when the program counter is outside every range of the variable's DWARF location list. A watchpoint on a local that lives in a register never fires, because a register is not memory. The `-O2` run above shows the extreme case: the whole function was folded away, and the silence of a watchpoint that was never set proves nothing.

The harness therefore writes three kinds of record and never a fourth. A stop that tested the claim and agreed is `confirmed`. A stop that tested it and disagreed is `refuted`. A claim no stop could test is `not-observed`, with the reason, and the breakpoint hit counts are part of that reason. Lesson 35's ledger accepts the first two as `observed` records with authority `controlled-replay`, and keeps the third as an open unknown.

## Debugging Only Your Own Builds on macOS

On Apple silicon the linker signs for you. Apple's `ld(1)` says of `-adhoc_codesign`: "The default for Apple Silicon binaries is to be ad-hoc codesigned." `codesign -dvvv account-O0` on the fixture prints:

```text
Format=Mach-O thin (arm64)
CodeDirectory v=20400 size=387 flags=0x20002(adhoc,linker-signed) hashes=9+0 location=embedded
Signature=adhoc
TeamIdentifier=not set
```

`0x20002` is `CS_ADHOC` (`0x2`) plus `CS_LINKER_SIGNED` (`0x20000`), "Automatically signed by the linker" in Apple's code-signing header. `codesign -d --entitlements -` prints nothing after the executable name: the binary has no entitlements. lldb launched it, hit every breakpoint, set a hardware watchpoint, and wrote a core, with `DevToolsSecurity -status` reporting "Developer mode is currently disabled" and System Integrity Protection enabled.

Two entitlements control who may debug what, and they sit on opposite sides. `com.apple.security.cs.debugger` is for the debugger: "A Boolean value that indicates whether the app is a debugger and may attach to other processes or get task ports". Apple's `debugserver` carries the private form of it, and `codesign -d --entitlements -` on the Command Line Tools copy lists `com.apple.private.cs.debugger`, `com.apple.private.set-exception-port`, `com.apple.private.thread-set-state`, and `com.apple.private.logging.diagnostic`. `com.apple.security.get-task-allow` is for the target. Xcode injects it into debug builds, strips it on export, and notarization rejects a binary that still has it. Apple's engineers state the rule for the refusal: the task port is denied when the target has the hardened runtime enabled and does not have `get-task-allow`. A plain `clang` build is not hardened and triggers neither condition. If you ever sign a fixture with `codesign --options runtime`, re-sign it with `codesign -s - -f --entitlements get-task-allow.plist` before debugging.

Three more facts close the section. First, you may see the dialog "Developer Tools Access needs to take control of another process for debugging to continue" the first time in a login session; `sudo DevToolsSecurity -enable` removes the extra password for members of the `admin` or `_developer` groups. Second, you do not disable SIP to debug your own code. Apple says "You don't need to disable SIP to run and debug apps from Xcode", and the only SIP component that touches debugging is the one `csrutil enable --without debug` relaxes, for other people's processes. Third, the Seatbelt sandbox in this session blocks `task_for_pid` entirely, and the fixture `sandbox-O0.lldb.txt` shows the result. A run that cannot start is an environment fact, and the harness reports it as one.

Everything in this lesson applies to programs you compiled. The same commands would attach to another process only if its owner opted in, and nothing here teaches how to change that.

## Build It

Run the demo:

```bash
cd phases/13-tools-and-protocols/42-dynamic-analysis-of-your-own-program
python3 code/main.py
```

The output is one JSON report over the saved transcripts. For each build it lists the breakpoints with their resolution and hit counts, the hardware watchpoint count, every stop with its registers and arguments, the exit status, the program's output, the errors lldb printed, and the claims with their verdicts and the evidence records behind them. It adds the core round trip, the Python API results, the sandbox failure, and which external tools are absent on this machine.

Expected shape:

```json
{
  "program": "account.c",
  "variants": {
    "O0": {
      "binary": "account-O0",
      "breakpoints": {"1": {"spec": "name=bump", "address": "0x1000004bc", "resolved": true, "hits": 1}, "...": "..."},
      "hardwareWatchpoints": 4,
      "watchpoints": {"1": {"address": "0x16fdfe00c", "size": 4, "type": "m", "hits": [[250, 255]], "hitCount": 1}},
      "stops": [{"index": 0, "pc": "0x1000004bc", "function": "bump", "kind": "entry", "registers": {"x0": "0x16fdfe008", "x1": "0x5"}, "...": "..."}],
      "exitStatus": 0,
      "claims": [{"id": "arg-registers", "verdict": "confirmed", "confirmed": 5, "refuted": 0, "not-observed": 0, "...": "..."}],
      "evidence": [{"claim": "arg-registers", "verdict": "confirmed", "stop": 0, "observation": "bump: x0 = 0x16fdfe008 and a = 0x000000016fdfe008, x1 = 0x5 and by = 5"}]
    },
    "O2": {"stops": [], "claims": [{"id": "calls", "verdict": "refuted", "...": "..."}], "...": "..."}
  },
  "core": {"savedAt": {"function": "bump", "pc": "0x1000004bc"}, "labelString": "", "...": "..."},
  "types": {"python": "3.9.6", "size": 32, "...": "..."},
  "sandbox": {"stops": 0, "errors": ["process exited with status -1 (attach failed ((os/kern) invalid address))"]},
  "absentTools": ["bpftrace", "gdb", "llvm-objdump", "ltrace", "rr", "strace"]
}
```

Read `code/main.py` in this order:

1. `Listing` parses the `llvm-objdump -d` text into functions and instructions, and `Function.conditional_branches()` finds the branches with their targets and fall-throughs.
2. `struct_layout()` reads the structure and member entries from the `llvm-dwarfdump` text.
3. `lift_condition()` turns one conditional branch into a predicate, the lesson 34 step for `tbz`, `cbz`, and the compare-and-branch forms.
4. `Plan.commands()` writes the lldb command file from the listing, and `Plan.lldb_command()` is the batch invocation.
5. `parse_transcript()` walks the output in order and builds `Stop` records with registers, memory, variables, and watchpoint values, plus the breakpoint table and the exit status.
6. `claims_for()` states the eight claims, and `evaluate()` grades them stop by stop with the `_check_*` functions.
7. `rollup()` reduces the records to one verdict per claim, with refuted taking precedence over confirmed.
8. `capture()` and `capture_extras()` produced the fixtures, and `live()` repeats the whole loop on a fresh build when `clang` and `lldb` can run.

Four more commands exist. `python3 code/main.py plan O0` prints the command file for a build. `python3 code/main.py commands` prints the gdb and lldb table. `python3 code/main.py tools` reports which external tools are on `PATH`. `python3 code/main.py live O0` compiles `account.c` into a temporary directory, plans from its fresh listing, runs lldb, and grades the claims against that run. Inside a sandbox it reports that lldb could not launch the process, with the error, and exits 1.

## Use It

Use the harness on a program of your own in this order.

1. Build it with `-g` and the optimization level you will ship. Keep the binary, its dSYM or its DWARF, and the `llvm-objdump -d` text together.
2. Write the claims before you run. Each one names a function, a register or an address or an offset, an expected value or edge, and the lesson or document it came from. A claim you write after seeing the stop describes the stop and tests nothing.
3. Generate the plan from the listing and read it. Every address in it should trace to a line in the listing. If a breakpoint has no such line, remove it.
4. Run once in batch mode and keep the transcript with the command line and the debugger version in its header. The transcript is the evidence. The verdicts are derived from it, and anyone can re-derive them.
5. Grade. Read every `not-observed` record and its reason before you read the confirmations. The reasons tell you which claims need another input, another build, or another breakpoint.
6. Run the optimized build with the same claims. Expect resolved breakpoints with zero hits where the compiler inlined, and keep those claims open.
7. Feed the confirmed and refuted records into the lesson 35 ledger as `observed`, authority `controlled-replay`, one record per stop. Leave the not-observed ones as unknowns with the breakpoint hit counts attached.

## Interactive Lab

### Lab A: read a stop by hand

From the `code` directory, open Python:

```bash
cd phases/13-tools-and-protocols/42-dynamic-analysis-of-your-own-program/code
python3 -q
```

Run:

```python
from main import *
t = load_transcript("session-O0.lldb.txt")
s = t.stops[0]
hex(s.pc), s.function, s.reason, s.registers
[hex(w) for w in s.memory[:8]]
s.struct_pointer().fields
```

Before the second line, write down which word you expect to hold 250 and which two words hold 1.25. Then run `struct.unpack("<d", struct.pack("<II", s.memory[4], s.memory[5]))` and compare. Then look at `t.stops[1].watch_hit` and `t.stops[1].pc`, and find that address in `account-O0.objdump.txt`: it is the instruction after the store.

### Lab B: the branch and its successor

```python
plan = make_plan("O0")
plan.branches()
classify = plan.listing.function("classify")
[lift_condition(classify, b, "a->balance")[0] for b in plan.branches()]
[(hex(s.pc), s.struct_pointer().field_int("balance")) for s in t.stops_in("classify")]
```

Match each edge stop to its entry stop and decide, before you look at the evidence, which successor the predicate predicts. Then run `[e.to_dict() for e in evaluate(plan, t, struct_layout(open("fixtures/account-O0.dwarfdump.txt").read(), "account")) if e.claim.startswith("branch")]` and compare.

### Lab C: the run that never stopped

```python
o2 = load_transcript("session-O2.lldb.txt")
len(o2.stops), o2.exit_status, o2.hits()
o2.errors[:3]
make_plan("O2").branches()
rollup(evaluate(make_plan("O2"), o2, struct_layout(open("fixtures/account-O2.dwarfdump.txt").read(), "account")))
```

Explain each `not-observed` in your own words, then open `account-O2.objdump.txt` and find the four constants in `main` that replaced the calls. Then count `DW_TAG_inlined_subroutine` in `account-O2.dwarfdump.txt` with `count_tags()`.

### Lab D: break the evidence

```python
text = open("fixtures/session-O0.lldb.txt").read().replace("x1 = 0x0000000000000005", "x1 = 0x0000000000000006", 1)
broken = parse_transcript(text)
[e.to_dict() for e in evaluate(plan, broken, struct_layout(open("fixtures/account-O0.dwarfdump.txt").read(), "account")) if e.claim == "arg-registers"][:2]
```

One edited register turns the first `arg-registers` record to `refuted` and the rollup with it, while the four other entries stay `confirmed`. Then delete the `old value: 250` line before the watchpoint stop and watch `store-once` fall to `not-observed`. A grader that cannot be made to fail is not grading.

If lldb can launch a process in your shell, finish with `python3 main.py live O0` and `python3 main.py live O2`. The stack addresses will differ from the fixtures. The verdicts should not.

## Practice Lab

Extend the harness with a claim about the loop in `sum_balances`.

Requirements:

- Find the loop back edge of `sum_balances` in the `-O0` listing with `conditional_branches()` and add a breakpoint at the loop header.
- Add a claim that the header executes `count + 1` times for `count` = 3, which is the lesson 33 back edge plus the exit test.
- Extend the stop hook or the plan so the hook reads the loop counter's stack slot at each header stop, and write a `_check_loop()` that records the sequence of counter values.
- Re-capture the transcript with `python3 main.py capture O0` on a machine where lldb can launch, and re-run the suite. The plan test will fail until the committed command file matches the new plan, which is the point of that test.
- Add a test that edits one counter value in the transcript and asserts the claim turns `refuted`.

Success means the report shows the header stops in order with their counter values, and the `-O2` run keeps the new claim `not-observed` with the reason that the loop was vectorised or folded away.

## Lesson Artifact

This lesson includes `outputs/skill-dynamic-analysis-of-your-own-program.md`. Use it to turn a program you built, its listing, and a list of static claims into one saved debugger transcript and one verdict per claim, with the stop that produced each verdict and the reason for every claim that stayed not-observed. It applies to Claude, Cursor, Codex, OpenClaw, Hermes, or any agent that reads SKILL.md.

## Verify It

Run the demo and the deterministic suite:

```bash
cd phases/13-tools-and-protocols/42-dynamic-analysis-of-your-own-program
python3 code/main.py
python3 -m unittest discover -s code/tests -v
```

The suite runs without lldb. It reads the transcripts captured once into `code/fixtures/`. Verification should prove:

- the listing parser finds the four functions with their ranges and the two conditional branches of `classify` at `-O0` with target and fall-through
- the lift of `tbz w8, #0x1f` is `a->balance >= 0` and the lift of `subs` plus `b.le` is `a->balance <= 200`
- `main` at `-O0` calls `bump`, `classify` three times, and `sum_balances`, and `main` at `-O2` calls only `printf`
- x86-64 `j<cc>` mnemonics are conditional and `jmp` and `callq` are not
- the DWARF dump yields a 32-byte struct with members at 0, 4, 8, 16, and 24
- the `-O2` DWARF has four subprograms and zero inlined-subroutine entries, and `nm` still lists the three functions
- the plan equals the committed command file for both builds, and the transcript header records the lldb command that ran it
- the `-O0` transcript has eleven stops in the expected functions, exit status 0, and the four output lines
- hook output is attached to the stop that follows it, with `x1` = 5, memory starting at `x0`, and the label string
- the breakpoint table carries resolution and hit counts 1, 3, 1, 2, 1, 1, 1
- the watchpoint is 4 bytes of type modify at `x0 + 4`, hit once with old value 250 and new value 255, and four hardware slots are reported
- the `-O2` transcript has zero stops, three resolved breakpoints with zero hits, no watchpoint, and one error per unused `continue`
- the sandboxed launch fails before any stop with the attach error
- the core round trip keeps the backtrace and `balance` = 250 and loses the string behind `label`
- the Python API reads the five fields, the size 32, and the function ranges without a process
- a hand-written x86-64 transcript parses with `rdi`, `rsi`, and `rip`
- every claim is confirmed at `-O0` with 5, 11, 3, 2, 1, 1, 1, 1 records
- the branch evidence names the value, the condition, and the edge
- the field-offset evidence decodes the words through the DWARF layout
- the store and stride evidence carry the old and new value and the three row balances
- the `-O2` run refutes the call edges and leaves the other claims not-observed
- an edited register value is refuted, a deleted watchpoint hit is not-observed, and refuted wins the rollup
- the command map has gdb and lldb forms for every row, and the hardware table names four x86 debug registers
- the demo lists absent tools instead of failing, and live mode reports the missing tool by name
- the figure data comes from both sessions and the site module embeds the same data

## Production Failure Modes

| Failure | What the weak report says | What the harness must prove |
|---|---|---|
| Resolved breakpoint with zero hits | "the function runs" or "the function is dead" | a full run with exit status, hit counts, and the verdict `refuted` for the call edge only |
| Register read at the wrong stop | "`x1` = 5 inside `classify`" | compare only declared arguments at the entry stop |
| Struct read without offsets | a column of hex words | every word mapped to a `DW_AT_data_member_location` and compared with `frame variable` |
| Branch graded from the mnemonic | "`tbz` means taken when negative" | the lifted predicate from the encoding and the stop at the successor |
| Watchpoint on a register-resident local | "no write happened" | the watchpoint was set on an address and was hit, or the record is `not-observed` |
| Auto-continue breakpoints | a clean transcript with no stops | plain breakpoints, a stop hook, and a continue budget |
| Address breakpoint without a module | `unresolved, hit count = 0` | `-s MODULE` so the listing address resolves to a load address |
| First command error ends the batch | no `breakpoint list` at the end | `interpreter.stop-command-source-on-error false` |
| Stack-style core read as full memory | `label = ""` reported as the program's value | the core style, the pointer, and the segment it points into |
| Sandboxed shell | "lldb is broken" | `attach failed ((os/kern) invalid address)` recorded as an environment fact |
| Hardened target without `get-task-allow` | "macOS forbids debugging" | the two conditions from Apple's rule, and a re-sign of your own binary |
| Transcript discarded after grading | verdicts with no source | the transcript file, its command line, and the debugger version |

## Operational Rule

Plan the stops from the listing, run once in batch mode, keep the transcript, and grade every static claim at every stop that can test it. Write confirmed or refuted only from a stop, write not-observed with the hit counts and the reason, and never let a resolved breakpoint stand in for a run. Debug only the builds you made.

## Further Reading

- [LLDB Tutorial: command grammar, breakpoints, watchpoints, stop hooks](https://lldb.llvm.org/use/tutorial.html)
- [lldb(1) manual page: --batch, --one-line, --source, --core](https://lldb.llvm.org/man/lldb.html)
- [GDB to LLDB Command Map](https://lldb.llvm.org/use/map.html)
- [LLDB Python Reference: SBTarget, SBFrame, SBValue, and the embedded interpreter](https://lldb.llvm.org/use/python-reference.html)
- [LLDB Caveats: the Python build lldb links against](https://lldb.llvm.org/resources/caveats.html)
- [LLVM 23.1.3 release](https://github.com/llvm/llvm-project/releases/tag/llvmorg-23.1.3)
- [GDB 18.1 release announcement, 2026-09-25](https://sourceware.org/pipermail/gdb-announce/2026/000150.html)
- [GDB manual: Process Record and Replay](https://sourceware.org/gdb/current/onlinedocs/gdb.html/Process-Record-and-Replay.html)
- [GDB manual: Debugging Optimized Code](https://sourceware.org/gdb/current/onlinedocs/gdb.html/Optimized-Code.html)
- [GDB wiki: Permissions on Darwin, code signing a debugger](https://sourceware.org/gdb/wiki/PermissionsDarwin)
- [gdb-patches: Initial AArch64-Darwin support series, October 2025](https://sourceware.org/pipermail/gdb-patches/2025-October/222196.html)
- [Homebrew gdb formula pull request adding arm64 bottles](https://github.com/Homebrew/homebrew-core/pull/209753)
- [ptrace(2), Linux manual page](https://man7.org/linux/man-pages/man2/ptrace.2.html)
- [lldb debugserver MachTask.mm: task_for_pid and task_set_exception_ports](https://github.com/llvm/llvm-project/blob/main/lldb/tools/debugserver/source/MacOSX/MachTask.mm)
- [Intel SDM Volume 2: INT n, INTO, INT3, INT1](https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html)
- [Intel SDM Volume 3: debug registers DR0 to DR7 (Debug, Branch Profile, TSC, and Resource Monitoring Features)](https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html)
- [Arm A64 ISA: BRK, Breakpoint instruction](https://developer.arm.com/documentation/ddi0602/latest/Base-Instructions/BRK--Breakpoint-instruction-)
- [Arm A64 ISA: TBZ, Test bit and branch if zero](https://developer.arm.com/documentation/ddi0602/latest/Base-Instructions/TBZ--Test-bit-and-branch-if-zero-)
- [Arm Architecture Reference Manual, D2.9 Watchpoint exceptions](https://developer.arm.com/documentation/ddi0487/latest/)
- [Apple ld(1): -adhoc_codesign](https://keith.github.io/xcode-man-pages/ld.1.html)
- [Apple ld64 LinkEdit.hpp: CS_LINKER_SIGNED](https://github.com/apple-oss-distributions/ld64/blob/59a99ab60399c5e6c49e6945a9e1049c42b71135/src/ld/LinkEdit.hpp)
- [Apple: Debugging Tool Entitlement, com.apple.security.cs.debugger](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.cs.debugger)
- [Apple: Hardened Runtime](https://developer.apple.com/documentation/security/hardened-runtime)
- [Apple: Resolving common notarization issues, the get-task-allow entitlement](https://developer.apple.com/documentation/security/resolving-common-notarization-issues)
- [Apple: Disabling and Enabling System Integrity Protection](https://developer.apple.com/documentation/security/disabling-and-enabling-system-integrity-protection)
- [Apple Developer Forums: debugserver may not get the taskport of a hardened process](https://developer.apple.com/forums/thread/127544)
- [Apple DevToolsSecurity(8)](https://keith.github.io/xcode-man-pages/DevToolsSecurity.8.html)
- [Apple core(5)](https://keith.github.io/xcode-man-pages/core.5.html)
- [Apple Technical Note TN2124: Mac OS X Debugging Magic, core dumps](https://developer.apple.com/library/archive/technotes/tn2124/_index.html)
- [lldb `process save-core` help text](https://github.com/llvm/llvm-project/pull/143126)
- [core(5), Linux manual page](https://man7.org/linux/man-pages/man5/core.5.html)
- [coredumpctl(1)](https://man7.org/linux/man-pages/man1/coredumpctl.1.html)
- [Apple dtrace(1)](https://keith.github.io/xcode-man-pages/dtrace.1.html)
- [Apple dtruss(1m)](https://keith.github.io/xcode-man-pages/dtruss.1m.html)
- [strace releases](https://github.com/strace/strace/releases)
- [ltrace](https://ltrace.org/)
- [bpftrace CHANGELOG](https://github.com/bpftrace/bpftrace/blob/master/CHANGELOG.md)
- [rr project](https://rr-project.org/)
- [rr 5.9.0 release](https://github.com/rr-debugger/rr/releases/tag/5.9.0)
- [rr wiki: Building And Installing, hardware and VM requirements](https://github.com/rr-debugger/rr/wiki/Building-And-Installing)
- [Clang UndefinedBehaviorSanitizer](https://clang.llvm.org/docs/UndefinedBehaviorSanitizer.html)
- [ISO/IEC 9899:2024 working draft N3220, clause 3.5 undefined behavior](https://www.open-std.org/jtc1/sc22/wg14/www/docs/n3220.pdf)
- [DWARF Debugging Information Format Version 5](https://dwarfstd.org/doc/DWARF5.pdf)
- [Procedure Call Standard for the Arm 64-bit Architecture (AAPCS64)](https://github.com/ARM-software/abi-aa/blob/main/aapcs64/aapcs64.rst)
- [System V Application Binary Interface, AMD64 Architecture Processor Supplement](https://gitlab.com/x86-psABIs/x86-64-ABI)
