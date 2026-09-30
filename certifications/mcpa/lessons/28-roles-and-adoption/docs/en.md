# Every MUST Needs an Owner

> The specification hands its MUSTs to a host, a client, and a server. A live deployment hands them to people, and the MUST nobody agreed to own is the one that fails first.

**Type:** Reference
**Languages:** Python
**Prerequisites:** Lesson 27
**Time:** ~45 minutes

## Learning Objectives

- Assign the six roles behind a real MCP deployment, server author, host and client developer, platform or gateway operator, security and governance owner, registry publisher, and end user, the spec requirements each one actually owns
- Trace how the owner of the same requirement can shift across three adoption paths: local stdio, remote Streamable HTTP with OAuth, and a gateway-fronted enterprise deployment
- Explain the MCP governance structure: stewardship under the Agentic AI Foundation, the Lead Maintainer, Core Maintainer, and Maintainer hierarchy, and the difference between a Working Group and an Interest Group
- Follow a proposal from an idea through the SEP workflow to a Final status, and connect that workflow to the feature lifecycle a requirement moves through once it ships
- Treat SDK tier selection as an adoption decision a role makes, not a checkbox, by reading the tiering system's conformance and response-time commitments

## The Problem

Read the specification end to end and it describes three participants: a host, a client, and a server. Read a real MCP rollout end to end and it involves at least six kinds of people, and none of them is named "host" on an org chart. Someone writes and maintains the server. Someone else builds or configures the host application and the client inside it. A third function runs the process in production, whether that means launching a stdio subprocess on a shared machine or operating the reverse proxy that terminates a remote connection. A fourth function reviews what the deployment is allowed to do with tokens, scopes, and logs. A fifth publishes the server so other teams can find it. A sixth, the end user, is the one actually granting consent when a tool is about to run.

Every MUST and SHOULD in the specification lands on one of those six functions, but the specification does not say which, and it cannot: the same protocol supports a solo developer running a local tool over stdio and a platform team fronting dozens of internal servers with a gateway, and the right owner for a requirement such as validating the Origin header is not the same person in both cases. A team that treats "the spec says servers MUST do X" as self-enforcing finds out the hard way, usually during a security review, that a MUST with no name attached to it is a MUST nobody actually did. This is the part of the Use Cases and Ecosystem domain the exam tests with scenario questions rather than recall questions: given a deployment shape, name the role, not just the requirement.

## The Concept

Give the six functions names and the exam's roles questions stop being abstract. The server author writes and maintains one implementation against the specification, version 2026-07-28: which tools exist, what each input schema requires, how `server/discover` answers. The host and client developer builds the application a person runs and the client inside it that speaks the wire protocol: capability declarations, the OAuth client when the transport is remote, the consent surface the user sees before a call goes out. The platform or gateway operator runs the process: launches the stdio subprocess with the right environment, or terminates the Streamable HTTP connection, applies network policy, and decides what a gateway checks before a request ever reaches a server implementation. The security and governance owner is accountable for the requirements that cut across all of the above, token handling, `requestState` protection, consent policy, and the cross-cutting MUSTs that do not belong cleanly to any single implementer. The registry publisher owns `server.json`, the namespace it claims, and whether the entries a registry serves are accurate. The end user is the accountable party for what the host does on their behalf, the role the specification is quietly protecting every time it says a human should be able to deny an invocation.

None of this replaces the host, client, and server roles from the architecture lessons. It sits on top of them, and a single person can hold two or three of these six functions on a small team. What matters for the exam is that a single requirement can move between functions as a deployment grows. Follow one requirement across the three adoption paths the domain expects: local stdio, remote Streamable HTTP with OAuth, and a gateway-fronted enterprise deployment with extensions. The Streamable HTTP transport is explicit that servers MUST validate the Origin header on all incoming connections to prevent DNS rebinding attacks. Stand a server up directly on the open internet and that MUST lands on the server author, because the server's own code is the only code standing between the socket and the request handler. Front the same server with an enterprise gateway and the MUST does not disappear, it moves: the platform or gateway operator's edge is now the first code to see the Origin header, so the operator has to get it right, and the server author's job narrows to trusting a network boundary someone else now enforces. A responsibility matrix built from curated requirement records has to track that: the requirement stays fixed, the shape changes, and the owner changes with it.

The same discipline applies to stdio. Implementations using an STDIO transport SHOULD NOT follow the OAuth authorization flow at all and instead retrieve credentials from the environment, so a stdio deployment never asks the host and client developer to build an OAuth client. It asks the platform or gateway operator, or on a single laptop, whoever launches the process, to make sure the right credential is already sitting in the environment before the subprocess starts. Skip that ownership question and a stdio tool either fails at the first call that needs a credential or, worse, someone hardcodes one into a config file nobody reviews.

Governance answers a related but separate question: who decides what a MUST becomes next. MCP is a project of the Agentic AI Foundation, and its technical direction runs through a small hierarchy. Lead Maintainers hold final veto authority. Core Maintainers steer the specification and the overall project direction. Maintainers steward one specific area each, an SDK, documentation, or a Working Group. Contributors are anyone who opens an issue or a pull request; sustained contributors become Members, and a Member of at least six months can become a Maintainer with a sponsor and Core Maintainer approval; those timelines are minimums, not guarantees. Two kinds of groups do the collaborative work between those layers. An Interest Group discusses a problem and produces non-binding recommendations, use cases, and requirements, the place to raise "should MCP support this" before anyone has committed to a design. A Working Group builds the concrete deliverable, usually a Specification Enhancement Proposal (SEP) and its reference implementation, once an idea has enough support to justify engineering time. A SEP moves through `draft`, `in-review`, and then either `accepted` or `rejected`, and an accepted Standards Track SEP is not `final` until its reference implementation, and for anything with observable protocol behavior a conformance test, both land. That is the same feature lifecycle from the specification-reading lesson, applied to the moment a requirement is born rather than the moment it is retired: a feature is Active, then optionally Deprecated with a required migration path and a minimum window, then eventually Removed.

SDK tier is the last adoption decision this lesson hands to a role, usually the host and client developer or the server author choosing a foundation to build on. Tier 1 SDKs pass 100 percent of the conformance tests, ship new protocol features before or alongside a spec release, triage issues within two business days, and fix critical bugs within seven. Tier 2 commits to the same destination on a longer clock: 80 percent conformance and a six month window for new features. Tier 3 is explicitly experimental with no timeline commitment at all. Picking a Tier 3 SDK for a production gateway is not a technical shortcut, it is a decision to inherit that SDK's maintenance risk, and a candidate who can say so, by name, is answering the kind of scenario question this domain asks.

```figure
mcpa-28-roles-map
```

## Interactive Lab

The figure lays three panels side by side: a local stdio deployment, a plain remote HTTP deployment with no gateway, and the same server once a gateway sits in front of it. Each panel names the role that owns a sample of that shape's requirements. Watch the flagged row move. Under plain HTTP, the server author owns Origin validation right next to Protected Resource Metadata. Add a gateway and the flagged row jumps to the platform or gateway operator, because the gateway is now the first thing a request touches. Nothing about the underlying MUST changed between the second and third panel. What changed is which panel, which deployment shape, gets to claim it.

## Practice Lab

Open `code/main.py`. `REQUIREMENTS` is a tuple of curated `Requirement` records, each one an exact MUST or SHOULD quoted from the brief or the specification, tagged with the deployment shapes it applies to and the role that owns it by default. `build_responsibility_matrix(shape)` filters the catalog to one shape, assigns an owner to each applicable requirement, and collects any MUST whose owner is `None` into a `gaps` list. Run it:

```bash
python3 code/main.py
```

Read the printed matrix for all three shapes side by side. Confirm that `stdio-env-credentials` lands on the platform or gateway operator, that `prm-implemented` lands on the server author under both `http` and `gateway`, and that `origin-validation` is the one row whose owner changes between those two shapes: `server_author` for `http`, `platform_gateway_operator` for `gateway`. Then look at `error-code-allocation`. Its `default_role` is `None` on purpose, a MUST NOT from section 5 of the brief that does not map cleanly onto any single one of the six roles, and the matrix reports it as a gap on every shape you run it against. Add a thirteenth `Requirement` of your own, something from a lesson you have already read, decide which of the six roles should own it, tag it with the shapes where it applies, and rerun the script to see your addition take its place in the matrix.

## Shipped Artifact

`outputs/roles-responsibility-matrix.md` is a one-page field reference: the six roles in one line each, the three adoption paths and which role gains new responsibility at each step, the same Origin validation example worked through by hand, and a short governance and SDK tier cheat sheet covering the maintainer hierarchy, Working Group versus Interest Group, the SEP status list, and the three SDK tiers. Keep it next to the architecture roles map from the hosts, clients, and servers lesson; that one draws the wire topology, this one names who is accountable for it.

## Verify It

Run the tests from the lesson directory:

```bash
python3 -m unittest discover code/tests
```

They check the claims in this lesson: that every deployment shape resolves to a non-empty matrix, that stdio hands environment credentials to the platform or gateway operator, that a plain HTTP deployment hands Protected Resource Metadata to the server author, that a gateway-fronted deployment moves Origin validation to the platform or gateway operator while a plain HTTP deployment keeps it on the server author, that the deliberately unowned MUST is reported as a gap while an unowned SHOULD is not, that every applicable requirement is assigned exactly once per shape with none dropped or duplicated, that all six roles appear somewhere in the catalog, that an unrecognized deployment shape is rejected, and that the illustrative exchange never puts a credential on the wire. The repository's wire checker also validates the lesson's transcript against the 2026-07-28 rules:

```bash
python3 scripts/check_mcpa_wire.py certifications/mcpa/lessons/28-roles-and-adoption
```

## Capstone Connection

The capstone's integrated scenario asks you to defend a full deployment, not just describe its message shapes. This lesson is where that defense gets its vocabulary: when a reviewer asks who validates the Origin header in your design, the answer has to name a role and a deployment shape, not just repeat that the server MUST validate it. Bring the responsibility matrix, and bring the habit of asking, for every MUST a scenario mentions, who on this specific team just agreed to own it.

## Key Terms

| Term | Meaning |
|------|---------|
| Server author | Writes and maintains one MCP server implementation against the specification |
| Host and client developer | Builds the application and the client that declares capabilities and speaks the wire protocol |
| Platform or gateway operator | Runs the process: launches a stdio subprocess with its environment, or terminates and polices a remote connection |
| Security and governance owner | Accountable for cross-cutting requirements, such as token handling and consent policy, that no single implementer naturally owns |
| Registry publisher | Owns a server's server.json, its namespace, and the accuracy of what a registry serves about it |
| End user | Grants consent and is the accountable party for what a host does on their behalf |
| Working Group | A group that builds a concrete deliverable, usually a SEP and its reference implementation |
| Interest Group | A group that discusses a problem and produces non-binding recommendations, not a design |
| SEP | Specification Enhancement Proposal, the PR-based workflow for a new feature or a breaking change |
| SDK tier | A conformance and response-time commitment, Tier 1 through Tier 3, an SDK maintainer signs up for |

## Further Reading

- [MCP governance and stewardship](https://modelcontextprotocol.io/community/governance)
- [Working and Interest Groups](https://modelcontextprotocol.io/community/working-interest-groups)
- [SEP guidelines](https://modelcontextprotocol.io/community/sep-guidelines)
- [SDK tiering system](https://modelcontextprotocol.io/community/sdk-tiers)
- [Design principles](https://modelcontextprotocol.io/community/design-principles)
- [Contributor ladder](https://modelcontextprotocol.io/community/contributor-ladder)
- [MCP specification 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28), especially Authorization and the Streamable HTTP transport, for the exact MUST statements this lesson's requirement catalog quotes
- `certifications/mcpa/research/mcp-2026-07-28-brief.md`, sections 4, 5, 6, 9, 10, 12, and 15
