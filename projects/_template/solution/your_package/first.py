"""Bounded task-label parsing for the authoring example.

Lesson: projects/your-project-id/stages/01-first-stage/docs/en.md
The accepted grammar prevents ambiguous separators and unbounded identifiers.
"""

import re


def first_function(argument: str) -> str:
    if not isinstance(argument, str):
        raise TypeError("task label must be text")
    label = argument.strip().lower()
    if len(label) > 32 or not re.fullmatch(r"[a-z][a-z0-9]*(?:-[a-z0-9]+)*", label):
        raise ValueError("expected a task label of 1 to 32 characters")
    return label
