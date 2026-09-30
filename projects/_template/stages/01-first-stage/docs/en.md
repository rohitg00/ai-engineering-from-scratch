# Parse a bounded task label

> A queue needs stable identifiers before it can reliably deduplicate work.

**Type:** Build
**Languages:** Python
**Stage:** 1 of 4 (starter; extend this draft)
**Time:** ~1 hour

## What you build

Implement `first_function(argument: str) -> str` in `your_package/first.py`. It returns a normalized identifier or raises an error that identifies whether the input type or grammar is wrong.

## Why it matters

A worker that treats `Ship-Report` and `ship-report` as different tasks can duplicate a delivery. A parser establishes a single representation before the task reaches persistent storage.

## The concept

Normalize surrounding whitespace and lowercase the label, then validate the entire result. For example, `  Ship-Report2  ` becomes `ship-report2`. Internal whitespace remains invalid. Do not remove bad characters until the string happens to pass: `ship/report` and `ship-report` might refer to different tasks.

Add an original, registered `figure` mechanism before marking this project ready. Show the input, normalization, length check, grammar check, and accepted or rejected terminal state.

## Your task

```python
def first_function(argument: str) -> str: ...
```

Reject non-string inputs with `TypeError`. A normalized label must have 1 to 32 characters, begin with an ASCII letter, and contain lowercase ASCII letters, digits or single hyphens between nonempty segments. Invalid strings raise `ValueError`. The function has no filesystem or network effects.

## Run the tests

```bash
python3 scripts/project_test.py your-project-id --stage 1 --path /tmp/my-project-work
```

The tests distinguish type errors from malformed text and check normalization, boundaries, ambiguous separators and traversal-like strings. Add an unseen example to your own tests before you inspect the solution.

## Check yourself

1. Why is rejecting a slash safer than replacing it with a hyphen?
2. Which boundary would be missed by testing only a normal label?

## Going further

Use the accepted label as a task key in stage two, then add explicit duplicate handling and a bounded retry state machine. Extend this scaffold to four complete stages and record a real artifact demonstration.
