# Where Trust Ends Is Where Consent Begins

> The host trusts the client it built. It has no standing reason to trust the server on the other end of that connection, and the human behind the host should not be asked to trust it either, not without being asked first.

**Type:** Reference
**Languages:** Python
**Prerequisites:** Lesson 05
**Time:** ~45 minutes

## Learning Objectives

- Locate the trust boundary that separates the host and its clients from a server and the tools that server exposes
- Explain why a tool result crossing back into the model's context is untrusted content, not a message the host already vetted
- Distinguish a read-only tool call, which a host may auto-approve, from a side-effecting call, which requires the user's explicit consent
- Apply per-tool consent scoping so that approving one tool never authorizes a different tool to run unattended
- Read a consent gate's refusal and its approval as ordinary structured JSON-RPC responses, not as exceptions bolted onto the protocol

## The Problem

An assistant with tool access can be handed real power: it can read a file, send a message, move money, or delete something you cannot get back. The tool that does any of that runs inside a server, and a server is a program you did not write. Even after you choose to connect to it, you are trusting its author's judgment every time a tool call runs, not only at the moment you installed it.

Two naive designs both fail. Treat every tool call as pre-approved the instant a server connects, and a single compromised or careless server can act with the full authority the user has, with no moment where a human looks at what is about to happen. Treat every tool call, including the ones that only read data, as needing a fresh approval, and the approval prompt becomes noise the user clicks through without reading, which is not consent, it is fatigue wearing the costume of consent.

The fix is neither more prompts nor fewer prompts. It is knowing exactly where the trust boundary sits, and gating only the calls that actually need a human decision: the ones that change something outside the conversation. This lesson is the foundation the rest of the Security and Governance domain builds on, the domain that carries the largest single share of the MCPA blueprint.

## The Concept

Draw the trust boundary where control of the code changes hands. The **host** is the application the user runs, and the **client** inside it is a component the host owns outright: the host decides when a client exists, which server it connects to, and what that connection is allowed to do. Both sit inside the user's trust domain, because the user, through the host, put them there. The **server** is different. It is a separate program, frequently written and operated by a third party, and connecting to it does not transfer any of that trust. A server can be honest today and compromised tomorrow, or honest about ninety nine tools and quietly wrong about the hundredth. The boundary is not a feeling about a vendor's reputation; it is the line between code the host controls and code it does not.

That boundary has consequences in both directions. Going out, it is where a decision about consent belongs. Coming back in, it is where a decision about trust in content belongs.

On the way out, tools split into two kinds by what they do to the world. A **read-only** tool looks at something and reports back: it lists files, searches an index, fetches a record. Running it does not change anything outside the conversation, so a host can let it proceed without stopping to ask, the same way a search engine does not request permission before returning results. A **side-effecting** tool changes something: it writes, deletes, sends, purchases, or executes. Running one without a decision from the user is the host acting on the user's behalf without the user's knowledge, which is the exact failure a permission system exists to prevent. A conformant design gates every side-effecting call behind explicit, informed consent, and lets read-only calls through.

Consent, once granted, is scoped to exactly the tool it was granted for. Approving `delete_file` does not approve `send_email`, even though both are side-effecting, even though both belong to the same server, and even though the user is clearly willing to grant some access to that server. A blanket "trust this server" grant collapses the point of naming tools individually: it turns a specific, informed decision into a general one the user never actually made. Least privilege here means a grant covers one named tool and nothing wider, and a new side-effecting tool always needs its own approval the first time it is called, no matter what was approved before it.

On the way back, the content a tool returns is untrusted the moment it crosses the boundary. The server chose those bytes. They might be a clean answer, or they might carry an instruction an attacker planted inside a document the tool happened to read, hoping the model treats it as a command instead of as data. Marking returned content as untrusted is not an insult to well behaved servers; it is the same discipline applied to any input a program did not generate itself, and it is what keeps one malicious result from acting as though the host itself had said it.

```figure
mcpa-06-trust-boundary
```

## Interactive Lab

The figure traces both directions of a single tool call. Reading left to right: a call leaves the client, crosses the dashed trust boundary, and either passes straight through to the server, if it is read-only, or has to clear the consent gate drawn on the boundary, if it is side-effecting. Reading right to left: whatever the tool returns crosses back marked as untrusted content, whether or not consent was required to produce it. Notice that the gate sits on the boundary itself, not inside the server. The decision about whether a call may proceed belongs to the side the user controls, not to the program asking for permission to act.

## Practice Lab

Open `code/main.py`. It registers three tools on one mock server: `list_files`, which is read-only, and `delete_file` and `send_email`, which are both side-effecting. Run the demo and read the four lines of output against the walkthrough above: a read-only call that just runs, a side-effecting call refused for lack of consent, the same call succeeding once consent is granted, and a second side-effecting tool refused even though the first one now has consent on record.

```bash
python3 code/main.py
```

Then extend it yourself. Add a fourth tool, `rename_file`, tagged side-effecting, with a required `new_name` argument. Call it four ways: with no consent granted at all, with consent granted for `delete_file` instead, with consent granted for `rename_file` itself, and with consent granted for `rename_file` but the `new_name` argument left out. Confirm which of the four succeed and which fail, and match each failure to the specific rule in this lesson that explains it.

## Shipped Artifact

`outputs/consent-and-trust-checklist.md` is a one-page checklist you can run any design against: what belongs inside the trust boundary, what belongs outside it, which calls need consent and at what scope, and a short list of failure patterns to reject in a review. Keep it next to a server's tool list when you are deciding what a new integration should and should not be allowed to do without asking first.

## Verify It

Run the tests with `python3 -m unittest discover code/tests`. They assert the claims this lesson makes: that a side-effecting call without consent is refused with a structured error, that the same call succeeds once consent is recorded, that a read-only call never needed consent in the first place, that consent for one tool does not leak into approval for another, and that a returned result carries an explicit untrusted marker. If a change to the mock breaks one of these, the design has drifted from the rule it claims to enforce.

## Capstone Connection

The Lesson 09 capstone asks you to defend a design end to end, and the trust boundary is where that defense starts. Every side-effecting tool in your capstone system needs a named, scoped consent decision you can point to, and every value flowing back from a server needs to be treated as untrusted until your own code has checked it. Keep the checklist from this lesson open while you draft that design; it is written to be read against a real tool list, not just the three tools in this mock.

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Trust boundary | "The connection" | The line between code the user's host controls and a separate server it does not |
| Consent | "Permission" | An explicit, informed approval scoped to one named tool, not to a server or a session |
| Read-only tool | "A safe call" | A tool that reports on the world without changing it, eligible for auto-approval |
| Side-effecting tool | "An action" | A tool that changes something outside the conversation and requires consent to run |
| Untrusted content | "The result" | Data returned by a server, treated as external input rather than as the host's own words |

## Further Reading

- [Model Context Protocol specification, version 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28), for the normative rules on tool behavior, human in the loop control, and how a server describes what its tools do.
- [Explicit Scope and Stateless Elicitation](../../../../../phases/13-tools-and-protocols/12-mcp-roots-and-elicitation/), for how a server binds a destructive confirmation to an authenticated principal and specific arguments instead of a blanket approval.
- [Model Context Protocol Associate certification page](https://training.linuxfoundation.org/certification/model-context-protocol-associate-mcpa/), for the official exam guide this curriculum prepares you for.
