---
id: split-ratio-mismatch
title: An even split that lands at 47 to 53
card: production-mlops
kind: debug
level: 2
roles: [ai-evaluation-reliability-engineer, applied-ai-engineer, ai-data-engineer]
rounds: [debugging, ml-breadth]
tags: [ab-testing, srm, randomization, assignment]
minutes: 8
lessons: [phases/17-infrastructure-and-production/21-ab-testing-llm-features, phases/11-llm-engineering/13-production-app]
manuals: []
practice: []
cheatsheet: [progressive-delivery]
related: [production-mlops/peeking-at-an-ab-test, production-mlops/hash-bucket-assignment]
updated: 2026-11-03
---

An experiment assigns users evenly to control and variant. After a week the dashboard shows 47 percent of users in control and 53 percent in the variant, and the variant is ahead on the primary metric. What do you conclude, and what do you do next?

## Short answer

Do not read the result. A configured even split that delivers 47 to 53 over a week of traffic is a sample ratio mismatch, which means the assignment or the logging is broken and the two groups are no longer comparable. Find the cause in the assignment path, fix it, and start the experiment again.

## Full answer

### What the check says

An assignment hash puts each user into an arm. Over a week, the delivered split should sit very close to the configured one. When it does not, the lesson's answer is blunt: something is broken. Both experiment platform types in the lesson run this check for you, and it belongs in front of every readout.

### Why the win is void

Whatever lost users from one arm can be correlated with the outcome. If slow clients fail before they log an exposure in one arm, that arm looks faster and happier. The measured lift is then the dropout, not the variant. No correction after the fact restores the randomization.

### Where to look

1. **The assignment function.** The production application capstone assigns with a deterministic hash of the user id, so that one user stays in one arm. A random draw per request, or a hash on a field that changes, breaks the split.
2. **Exposure logging.** One arm may drop events, for example when the variant path logs after a call that can fail.
3. **Client errors.** A variant that crashes before it logs removes its users from the count.
4. **Bots and retries.** A bot or a retry loop that lands in one arm inflates it.
5. **Caches.** A cache in front of the assignment can serve one arm's decision to many users.

### Then

Fix the cause, discard the data, and restart. Pre-register the mismatch check so that it blocks the readout automatically, and nobody has to argue about a winning variant.

## Follow-ups

- **Level 2:** Why hash the user id instead of drawing an arm at random on each request? Expected: the same user lands in the same arm on every request, so the experience is consistent and the exposure count is per user.
- **Level 3:** Name two causes that put more users in the variant than in control. Expected: a logging failure that drops control exposures, or a variant path that treats bots or retries differently.
- **Level 3:** Can you correct the mismatch statistically and keep the result? Expected: no. The mismatch shows that the groups are not comparable, and no correction restores the randomization.

## Wrong answers

- "Three percent is within noise." Over a week of traffic, that gap under a fair split is very unlikely, and the mismatch check exists to flag exactly this case.
- "The variant wins by more than the gap, so ship it." The gap can be correlated with the outcome, so the lift can be the dropout itself.
- "Drop variant users until the groups match." Removing users after the fact adds a second bias on top of the first.

## Taught in

The [A/B testing lesson](../../../phases/17-infrastructure-and-production/21-ab-testing-llm-features/) defines the sample ratio mismatch check, and the [production app lesson](../../../phases/11-llm-engineering/13-production-app/) hashes the user id to pick an arm.
