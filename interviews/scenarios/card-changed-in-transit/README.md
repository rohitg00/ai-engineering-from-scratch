---
id: card-changed-in-transit
title: A card that said production
card: scenarios
kind: incident
level: 3
roles: [agentic-ai-engineer, forward-deployed-ai-engineer]
rounds: [debugging, design-review]
tags: [a2a, agent-card, signatures, jws, prompt-injection, trust]
minutes: 25
lessons: [phases/18-ethics-safety-alignment/15-indirect-prompt-injection]
manuals: []
practice: []
cheatsheet: [a2a]
related: [scenarios/polling-a-parked-task]
updated: 2026-11-03
system:
  version: A2A 1.0.1 with the manual's capture kit (the test-runner, code-reviewer and deployer agents)
  model: no model; the agents are deterministic fixtures
  hardware: one machine, localhost, no network
source:
  - manuals/a2a-101/capture/out/17-signed-card.txt
  - manuals/a2a-101/capture/out/18-extended-card.http
  - manuals/a2a-101/capture/out/01-agent-cards.http
  - manuals/a2a-101/capture/out/08-rejected.http
  - manuals/a2a-101/sections/2-3-extended-cards-and-signatures.md
  - manuals/a2a-101/sections/6-1-security-schemes-and-in-task-authorization.md
---

## Situation

A planner builds its plan from the agent cards it fetches at startup. The cards pass through a caching proxy that another team runs, and the planner reads each card as a trusted description of what the agent will do. One morning the planner delegated the release step as `Deploy build 2026.10.06-1 to production`, because the copy of the deployer card it held described an agent that ships tagged builds to production. The deployer refused. The release stalled, and the on-call engineer found that the copy on the proxy differed from the card the agent serves in one word.

The deployer card carries a signature. Nobody on the planner team had looked at it. The card loader parsed the JSON, dropped the fields it did not know, and planned. You have the published card, the agent's own answer to an authenticated card request, the refusal, and the kit's record of canonicalizing, signing and verifying the card, with a check on a copy whose description names production.

## Evidence

- [the skills and the signature of the published deployer card](evidence/skills-and-signature.txt)
- [what the deployer itself says to an authenticated caller](evidence/the-agent-when-asked.txt)
- [the canonical payload and the decoded protected header](evidence/canonical-and-header.txt)
- [the three rules a verifier follows to rebuild the signed bytes](evidence/verify-rules.txt)
- [the published signature entry and two verification results](evidence/signature-and-two-checks.txt)
- [when a client verifies, and with which algorithms](evidence/verify-first.txt)
- [what the deployer answers to a production deploy](evidence/rejected-production-deploy.txt)

## Questions

1. What does the published card say the deployer does, and what did the agent say when asked with a token?
2. What does the signature cover, and what does it leave out?
3. One check returned True and the other False. What changed between the two, and why does one word matter?
4. Why does the kit sign with HS256, and why is that not acceptable for a real deployment?
5. Where in the planner's startup does verification belong, and what happens when it fails?
6. The deployer refused the production deploy. Why is that refusal not the defense?

## Walkthrough

1. **Read the published card.** The skill is `Deploy a build`, and its description says one tagged build to staging with operator approval. Its tags are `deploy` and `staging`, and its example is a staging deploy. Below the skills sits a `signatures` list with one entry: a `protected` header and a `signature`. The extended card, returned only to a caller with a bearer token, describes the same agent: it deploys to staging after an operator approves. The proxy copy alone named production.
2. **Read the canonical payload.** It is the card without its signatures, with keys sorted and no spaces, as RFC 8785 defines. The description inside it says staging. The decoded header gives `alg` HS256, `typ` JOSE and `kid` deployer-key-1. The signing input joins the base64url header and the base64url payload with a period.
3. **Read the three rules.** A verifier rebuilds those bytes from the card it received. A REQUIRED field is always present, even at its default. The JSON Canonicalization Scheme fixes the order and the form of every value. The `signatures` field stays out, because a signature cannot cover itself. So the signature binds every other field, the description among them.
4. **Read the two checks.** On the published card the check returns True. On the altered copy, where the word staging became production, the canonical bytes differ, and the check returns False. One changed word changes the signed bytes, and the signature no longer matches. This is the test that the planner never ran.
5. **Read the algorithm line.** The kit signs with HS256 because its standard library has no ECDSA. HS256 is an HMAC, so a verifier holds the signing key and could sign a card itself. Real cards use ES256 or RS256, with the public key published in a JWKS and fetched by `kid` and `jku` or taken from a trusted store. Verification has six MUST steps, and a client verifies at least one signature before it trusts a card, never with an expired or revoked key, and with an explicit list of allowed algorithms.
6. **Read the refusal.** The deployer answered `TASK_STATE_REJECTED` and said that production deploys are outside its policy. That policy sits in the agent, and it caught this case. The card also names the interface URL the planner sends to. A copy that can change one word can change that field, and then the request goes to a server the attacker runs, where no policy refuses anything.

## Resolution

The planner trusted an unverified copy of a signed document. The loader now verifies at least one signature before it reads any field for planning. It rebuilds the canonical bytes under the three rules, takes the key for the `kid` from a trusted store, and allows only the algorithms the team lists. A card that fails the check is rejected and raises an alert, and the planner does not fall back to its content. For an authenticated session, the planner also replaces the cached public card with the extended card that the agent itself returns. The kit's record is the proof of the mechanism: True on the published bytes, False on the same card with one word changed, and the agent's own description agrees with the published one.

## Wrong turns

- "Pin the proxy cache and move on." The card is still unverified. The next edit passes the same way.
- "Compare the description with the version we saw last week." The `version` field is inside the signed payload, and an edited copy keeps it. Only the signature binds the fields together.
- "Verify with whatever algorithm the header names." A header is part of the input. Give the verifier an explicit list, so that a changed `alg` cannot pick a weaker check.
- "The deployer refused, so the system is safe." The refusal came from the honest agent at the published URL. A changed card can also change the URL, and the honest agent never sees the request.
- "Fetch the extended card instead, it needs a token." The extended card is a fuller card for an authenticated caller, and it comes back without signatures. It helps once the planner trusts the agent it talks to, and the public card's signature is what earns that trust.

## Generalize

Anything an agent reads from the network is input, not truth, and the metadata that describes other agents is the input with the most leverage. Verify the integrity of such a document before you plan on it, with a key that did not travel with the document, and treat a policy check at the far end as a second layer, never the first.

## Taught in

The [extended cards and signatures page of A2A 101](../../../manuals/a2a-101/sections/2-3-extended-cards-and-signatures.md) walks through this signing and both checks, the [security schemes page](../../../manuals/a2a-101/sections/6-1-security-schemes-and-in-task-authorization.md) covers the credential and the authorization scope, and the [indirect prompt injection lesson](../../../phases/18-ethics-safety-alignment/15-indirect-prompt-injection/) explains why content an agent reads without a user in the loop is the attack surface that filters on user input never see.
