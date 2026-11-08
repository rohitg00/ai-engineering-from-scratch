---
name: demo-interface-checklist
description: Review a model demo before its link goes public. Check the contract, the feedback, the errors, the public-link controls, and log privacy.
version: 1.0.0
phase: 17
lesson: 29
tags: [demo, interface, validation, streaming, rate-limit, privacy, gradio, streamlit]
---

Given a description of a model demo or its code, review the demo against the checklist below. Mark each item PASS, FAIL, or UNKNOWN. Give evidence for each mark: a file and line, a setting, or a quote from the description.

Ask for these facts when they are missing:

- The model call: a provider API or a local model, the typical latency, and the cost of one call.
- The audience: the team only, invited reviewers, or anyone with the link.
- The input type, and the largest input that the model accepts.
- How the demo runs: the framework, the server, and the host of the link.

Checklist:

Contract

1. The input has a type, a maximum size, and a rule for control characters.
2. The server checks every limit again. A check in the browser only is a FAIL.
3. The demo has at least one example for each output class.
4. The model call has a timeout, and the timeout error has a hint for the user.

Feedback

5. The submit control is disabled while a request runs.
6. The page shows that the model is working, with elapsed time or a progress display.
7. A text reply arrives as a stream, and the page shows the time to first token.
8. A failure after the stream starts reaches the user as an error event. A silent stop is a FAIL.

Errors

9. Every error response has a stable code, a message with the relevant numbers, a hint with one action, and a request id.
10. No error response contains a stack trace, a file path, or a secret.

Public link

11. A per-client rate limit exists. A rejected request gets status 429 and a `Retry-After` header.
12. The rate limit key is correct behind a proxy. A client cannot choose its own key.
13. A usage cap or a spend limit exists for the whole demo, for all clients together.
14. Access needs a token, a password, or a sign-in, unless the owner wants the demo open to anyone.
15. The rate limit and the cap also apply to API endpoints that the framework creates.
16. The page writes model output as text, never as HTML. The server sends a `Content-Security-Policy` header.

Privacy

17. Logs keep no input text, no full URL with a query string, and no raw client address.
18. Each feature that stores input, such as flagging, history, or analytics, is off, or the page tells users about it.
19. The page tells users what the server keeps.

Product signals

20. Report each of these signals that is present:
    - People outside the team use the demo every week.
    - Someone asks for an uptime target.
    - Users ask for accounts, saved results, or history.
    - The model cost is a line in a budget.
    - The input includes data that a contract or a law covers.

Produce:

1. A table with the item number, the mark, and the evidence.
2. A list of fixes for each FAIL, in order of risk. Put public-link and privacy items first, then errors, then contract, then feedback. Each fix names the file, the setting, or the code change.
3. A list of the product signals that are present. If one or more signals are present, recommend a move to a production stack. That stack has real authentication, tracing, and per-user cost tracking.
4. A verdict in one line: ready to share, ready after the listed fixes, or move to the production stack first.

Hard rejects. Do not mark the demo ready to share when any of these is true:

- The server does not check the input size.
- A link that anyone can open has no rate limit or no usage cap.
- Logs or a framework feature store input text, and the page does not tell users.

Refusal rules:

- If the audience is unknown, treat the link as open to anyone.
- If the cost of one model call is unknown, require a usage cap before a public link.
- If the demo runs on a framework, check its defaults for flagging, share links, and automatic API endpoints. Do not assume that the defaults are safe for a public link.
