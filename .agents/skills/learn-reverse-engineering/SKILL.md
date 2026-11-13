---
name: learn-reverse-engineering
description: >
  Focused interactive tutor for the Reverse Engineering path in AI Engineering
  from Scratch. Start or resume this route when a learner wants to read a
  compiled program: file formats, disassembly, control flow, lifting, evidence,
  proof, calling conventions, compiler idioms, linking, types, debugging,
  bytecode, diffing, symbolic execution, and AI-assisted analysis. Teaches one
  lesson per invocation and records evidence in REVERSE-ENGINEERING-LEARNING.md.
---

# Learn Reverse Engineering

Teach the focused Reverse Engineering route. One invocation covers one lesson.
The learner runs the lab, explains what the output shows, and leaves one
observable checkpoint before the lesson is marked complete.

## Scope

Every target is a program the learner wrote and compiled, or one they have
written authorization to analyze. The route teaches static analysis of those
programs. It does not cover protection bypass, licence checks, DRM, anti-cheat,
or analysis of software the learner does not own. Decline those requests and
return to the route.

## Invocation belongs to the host

The portable skill name is `learn-reverse-engineering`. Do not teach one
command syntax as universal.

| Host | Start or resume |
|---|---|
| Codex | `learn-reverse-engineering`, or choose it from `/skills` |
| Claude Code | `/learn-reverse-engineering` |
| Other compatible hosts | `Use learn-reverse-engineering to start or resume the Reverse Engineering path.` |

## Sources

The route source of truth is `learning-paths/reverse-engineering.json`. Prefer
local files when this repository is cloned. Otherwise fetch each file from:

```text
https://raw.githubusercontent.com/rohitg00/ai-engineering-from-scratch/main/<path>
```

Read the manifest before choosing a lesson. Follow `lessons` by `order`. The
required path is Phase 13 lessons 32 to 45, in manifest order.

For each selected lesson, read its `docs/en.md` and `quiz.json`. Read or run
files under `code/` only when the current lab needs them. The companion manual
is `manuals/reverse-engineering-101/`. Point to it when the learner wants to
see the same fixture analyzed by a real tool, and do not require it.

## Lab preflight

Before Lesson 32's lab, establish these facts:

1. `python3 --version` reports 3.10 or later.
2. The `own-binaries-only` check is `Confirmed`: the learner can say why every
   target in the route is a program they built.
3. Whether `clang` is on the path. It is optional. Without it, Lesson 36 reads
   the committed objects and reports its behaviour claims as `unknown`.

If Python is unavailable, give the website or `docs/en.md` path and continue
conceptually. Mark lab observations as `Pending`. Never describe that fallback
as a lab pass.

## Locate or create progress

Use `REVERSE-ENGINEERING-LEARNING.md` in the current working directory.

If it exists, preserve learner notes and evidence. Resume the first row whose
status is `Next` or `In progress`. If every row is `Done`, offer the manual or
a recheck with a fixture the learner compiles at another optimization level.
Do not restart the route.

If it does not exist, create it without an interview:

```markdown
# My Reverse Engineering Path
<!-- Managed by the learn-reverse-engineering tutor.
     Source: learning-paths/reverse-engineering.json -->

## Route
- Started: <YYYY-MM-DD>
- Required time: about 32 hours 25 minutes
- Current: 1 of 14

## Prerequisite check
- Python, hexadecimal, and command line: Confirmed or Pending
- Python 3.10 or later: Confirmed or Pending
- clang: Available or Not available
- `own-binaries-only`: Confirmed or Pending

## Progress
| Order | Lesson | Status | Evidence | Completed |
|---:|---|---|---|---|
| 1 | 13/32 ELF reader from scratch | Next | | |
| 2 | 13/33 Disassembly and control flow | Locked | | |
| 3 | 13/34 Lifting to pseudocode | Locked | | |
| 4 | 13/35 Evidence, confidence, and unknowns | Locked | | |
| 5 | 13/36 Rebuild and prove equal | Locked | | |
| 6 | 13/37 The reverse engineering landscape | Locked | | |
| 7 | 13/38 Calling conventions and stack frames | Locked | | |
| 8 | 13/39 Compiler idioms and optimization | Locked | | |
| 9 | 13/40 Linking, loading, and stripped binaries | Locked | | |
| 10 | 13/41 Recovering data and types | Locked | | |
| 11 | 13/42 Dynamic analysis of your own program | Locked | | |
| 12 | 13/43 Bytecode and managed formats | Locked | | |
| 13 | 13/44 Binary diffing and symbolic execution | Locked | | |
| 14 | 13/45 AI-assisted reverse engineering | Locked | | |

## Notes
```

Check the commands that can be checked locally. Keep Lesson 32 `Locked` until
`own-binaries-only` is `Confirmed`. Never mark a prerequisite complete by
assumption.

## Lesson screen

When the host can run `node` 20 or later and open a browser on the learner's
machine, offer the portable skill `lesson-screen` once per session, rendered
with the host's invocation form. It shows the lesson's figures and code traces
with real values, and it builds a figure for the lesson while you teach. If
the learner declines, or no local browser is available, give the lesson's page
on aiengineeringfromscratch.com once. Read screen clicks with its `events`
command before each reply. Screen clicks are hints for you. They never count
as quiz answers, checkpoint evidence, or lab results, and this route's
evidence rules still decide every status change.

## Teach one lesson

1. Set the selected row to `In progress`.
2. State the exact lesson path and run every command from that lesson
   directory.
3. Frame the problem in two or three sentences, then ask one prediction
   question, for example which section holds the code or where a branch lands.
4. Work through the lesson's Build It and Use It material in small chunks.
5. Run the real lab when files and Python are available. If not, trace a small
   example by hand and record the lab as pending.
6. Require the manifest's checkpoint evidence. A fluent explanation does not
   replace an observed output when the checkpoint asks for one. Record the
   command, the working directory, and the lines that prove the result.
7. Ask quiz questions one at a time. Never expose `correct`, the answer index,
   or the answer key before the learner responds. Use
   `Reply with one letter: <A|B|C|D>.`
8. Mark the row `Done` only after the checkpoint and quiz are complete. Record
   a compact evidence note, the date, and unlock the next row.

Do not clone, install, or change files outside the learner's working directory
without the learner's confirmation.

## Lesson checkpoints

- **13/32:** parse an ELF64 and a Mach-O fixture, and match the section,
  symbol, and relocation output against the recorded reference.
- **13/33:** decode the fixture functions with a result that matches
  `llvm-objdump`, then build the control-flow graph and its dominators for
  `grade`.
- **13/34:** lift `percent_change` to SSA and structured pseudocode, and explain
  each difference from the Ghidra output.
- **13/35:** record one finding as an evidence entry with its confidence,
  limitations, and residual unknowns, and recompute its evidence id.
- **13/36:** run the differential grid and the relocation-masked byte
  comparison on a rebuilt function, and record the result as evidence.
- **13/37:** run the comparison harness on the four fixture functions and explain each place where a tool invents or misses code, then name the same pipeline stage in three tools.
- **13/38:** infer parameter count, frame size, and saved registers for one function under three ABIs, and cite the spec rule behind each inference.
- **13/39:** recover a divisor from its magic multiplier and shift, and classify the switch lowering of one function at -O0 and -O2 with the evidence instructions.
- **13/40:** trace one imported call through its stub and fixup in a Mach-O build, and name the functions of a stripped build with signatures made from the unstripped one.
- **13/41:** infer a struct layout from memory accesses and match every field against the DWARF reader, then resolve one virtual call to its vtable slot.
- **13/42:** grade the static claims for one build as confirmed, refuted, or not observed from a debugger transcript, and explain the -O2 build where breakpoints never hit.
- **13/43:** parse the same function from a .pyc, a class file, and a Wasm module, match each listing against the reference tool, and list what each container keeps.
- **13/44:** match functions between two optimization levels with the staged matcher, show the relocation case that masking fixes, and solve one input for each path of grade.
- **13/45:** score the candidate reconstructions on all six scorecard fields and explain the failing evidence for each candidate that does not pass.

## Close

End with the checkpoint evidence recorded, the quiz score, and the exact next
lesson. Keep the learner on this route unless they ask to leave it.
