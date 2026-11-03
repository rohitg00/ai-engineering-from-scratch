---
id: hash-bucket-assignment
title: Read the prompt router's experiment assignment
card: production-mlops
kind: code-reading
level: 2
roles: [ai-evaluation-reliability-engineer, applied-ai-engineer, ai-data-engineer]
rounds: [coding, debugging]
tags: [ab-testing, assignment, hashing, prompt-versions]
minutes: 8
lessons: [phases/11-llm-engineering/13-production-app]
manuals: []
practice: []
cheatsheet: [production-llm-app, progressive-delivery]
related: [production-mlops/split-ratio-mismatch, production-mlops/evals-or-ab-test]
updated: 2026-11-03
---

This function from the production app picks the prompt version for a request. Explain what it does, why it hashes the user id together with the experiment name, and what the number 10 in the experiment config means for one user over a week.

```python
AB_EXPERIMENTS = {
    "general_chat_v2_test": {
        "template": "general_chat",
        "control": "v1",
        "variant": "v2",
        "traffic_pct": 10,
    },
}


def select_prompt(template_name, user_id, variables):
    versions = PROMPT_TEMPLATES.get(template_name)
    if not versions:
        raise ValueError(f"Unknown template: {template_name}")
    version = "v1"
    for exp_name, exp in AB_EXPERIMENTS.items():
        if exp["template"] == template_name:
            bucket = int(hashlib.md5(f"{user_id}:{exp_name}".encode()).hexdigest(), 16) % 100
            if bucket < exp["traffic_pct"]:
                version = exp["variant"]
            else:
                version = exp["control"]
            break
    template = versions.get(version, versions["v1"])
    return template, template.template.format(**variables)
```

## Short answer

The code hashes the user id plus the experiment name, takes the result modulo 100, and sends the users whose bucket falls below the traffic percentage to the variant. The hash is deterministic, so one user lands in the same arm on every request for the life of the experiment. The experiment name in the hash keeps the buckets of two experiments independent, so the users who saw the variant in one test are not the same users in the next. With a traffic percentage of 10, about a tenth of the users see the variant on every request all week, and the others never do.

## Full answer

### Line by line

1. The default version is `v1`, so a template with no experiment always resolves.
2. The loop finds the experiment for this template and stops at the first match. One experiment per template at a time.
3. The bucket is a hash of `user_id:exp_name`, read as an integer and reduced modulo 100. That gives a value from 0 to 99.
4. A bucket below `traffic_pct` gets the variant, and every other bucket gets the control.
5. The template renders with the request variables.

### Why the hash is deterministic

The lesson is explicit: hash the user id, do not draw at random. A random draw per request would flip one user between the two prompts, so the user would see two behaviors and the per-user metrics would mix both arms. A stable arm per user also makes the exposure count a count of users, which the experiment analysis needs.

### Why the experiment name is in the key

Without it, the bucket of a user is the same in every experiment, so the same tenth of the users would be the variant group every time. Experiments would be correlated, and the effects of one would carry into the next. The experiment name acts as a salt that gives each experiment its own split.

### What to watch

- The modulo 100 gives steps of one percent. A smaller share needs a larger modulus.
- The demo runs 1000 synthetic user ids through the selector and prints the control and variant shares. That is a cheap sample ratio check, and it belongs in a test.
- The `break` means that a second experiment on the same template never runs. The config shape makes that visible, but nothing warns you.

## Follow-ups

- **Level 2:** Why does a user stay in the same arm across requests? Expected: the hash of the same user id and experiment name gives the same bucket every time.
- **Level 2:** Two experiments are configured for the same template. What happens? Expected: the loop takes the first match and breaks, so the second experiment never assigns anyone.
- **Level 3:** Why not hash the user id alone? Expected: the same users would land in the variant of every experiment, so the experiments would be correlated and carry-over effects would mix the results.
- **Level 3:** How does the demo check the split, and what would you add? Expected: it runs 1000 synthetic ids through the selector and prints both shares. Add the same check on real exposure logs as a sample ratio check.

## Wrong answers

- "A random draw below the percentage would be simpler and the same." It assigns per request, so one user flips between arms and sees both prompts.
- "The hash function is weak, so the assignment is broken." The hash is not a security control here. It only has to be deterministic and well spread.
- "The percentage is the share of requests." It is the share of users, because the bucket is per user and stays fixed.

## Taught in

The [production app lesson](../../../phases/11-llm-engineering/13-production-app/) builds the prompt router with hash-based experiment assignment and checks the split in its demo.
