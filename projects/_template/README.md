# Your Project Title

This is a draft authoring scaffold. Replace its example artifact with your project and extend it to four to eight stages before marking it ready. Follow [the authoring contract](../AUTHORING.md) for runner, figure, demo, and certificate requirements.

The example parses bounded task labels. A valid label is lowercase, starts with a letter, contains letters, digits and single hyphens, and has at most 32 characters.

## Start

```bash
python3 scripts/project_test.py your-project-id --init /tmp/my-project-work
python3 scripts/project_test.py your-project-id --stage 1 --path /tmp/my-project-work
python3 scripts/project_test.py your-project-id --all --solution --strict
```

Each new stage should introduce a distinct capability, explain its invariant, and exercise five or more observable cases. Include realistic failure inputs and at least one held-out case. Demonstrate the finished artifact with a deterministic command in `project.json`.
