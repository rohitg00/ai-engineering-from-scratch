# MCPA Certification Curriculum

> Learn the judgment the exam measures by building the protocol the exam describes.

**Status:** Local preview
**Guide version:** 1.0
**Guide effective date:** September 2026
**Last verified:** 2026-09-24

This free curriculum prepares you for the Model Context Protocol Associate
(MCPA) exam from the Agentic AI Foundation, delivered through Linux Foundation
Training and Certification:

| Exam | Credential | Level | Time | Fee | Core route |
|------|------------|-------|------|-----|-----------:|
| MCPA | Model Context Protocol Associate | Beginner | 90 min | $250 | 34 lessons |

The exam is online proctored, multiple choice, aligned to the Model Context
Protocol specification dated 2026-07-28, valid for two years, with one retake
included and a twelve-month eligibility window. The official exam item count and
passing score are not published, so this curriculum's 60-question mock is an
original practice set, not the official length, and practice percentages cannot
predict an official outcome. The MCPA page lists 90 minutes; the launch
announcement stated 120 minutes. Confirm current pricing, format, duration, and
eligibility on the official page before scheduling, because program details can
change. Every exam fact and its retrieval date is recorded in
[research/source-verification-ledger.md](research/source-verification-ledger.md).

## Learn From GitHub With an AI Tutor

This curriculum is AI-native. Claude Code, Codex, ChatGPT, Cursor, or another
agent can teach the route, run the checked-in lab, review the artifact you
build, administer the lesson quiz, and resume from saved progress.

Start with the [GitHub learner guide](GETTING_STARTED.md), or install the
portable certification tutor skill at
[../../skills/mcpa-certification/SKILL.md](../../skills/mcpa-certification/SKILL.md):

```bash
npx skills add rohitg00/ai-engineering-from-scratch
```

Then ask your agent to run:

```text
/mcpa-certification
```

A local Claude Code session discovers the same skill from `.claude/skills/`
after you clone the repository. Harnesses without slash-command support can read
`GETTING_STARTED.md` and the tutor skill directly. Learner progress lives in
`MCPA-CERTIFICATION.md`; learner work lives under `learning-artifacts/mcpa/`.
The checked-in `outputs/` files remain reference artifacts and are never
overwritten. This curriculum lives outside the EPUB/PDF book workflow and is not
converted into the books.

## What You Build

One route, built from first principles, that assembles a working MCP exchange:

```mermaid
flowchart LR
    F["Fundamentals\nroles, JSON-RPC, discovery"] --> A["Architecture\nhosts, clients, servers, schemas"]
    A --> I["Interactions\nprimitives, lifecycle, errors"]
    I --> S["Security\ntrust boundaries, consent, audit"]
    S --> U["Use cases\nportability and ecosystem"]
    U --> C["Capstone\na full exchange, end to end"]
```

Each lesson ships a runnable standard-library MCP mock, a test suite, a lesson
quiz, and a reusable artifact. The route includes a short diagnostic and a
full-length original mock whose question mix follows the published blueprint
weights within practical rounding. It does not imitate or reproduce live exam
questions.

The MCPA blueprint has five domains:

| Domain | Weight |
|--------|-------:|
| MCP Fundamentals | 16% |
| Architecture and Components | 14% |
| Interactions and Execution | 26% |
| Security and Governance | 24% |
| Use Cases and Ecosystem | 20% |

## GitHub Lesson Index

- [00-mcp-exam-strategy/](lessons/00-mcp-exam-strategy/) mcp exam strategy
- [01-reading-the-specification/](lessons/01-reading-the-specification/) reading the specification
- [02-the-integration-problem/](lessons/02-the-integration-problem/) the integration problem
- [03-json-rpc-and-meta/](lessons/03-json-rpc-and-meta/) json rpc and meta
- [04-the-stateless-core/](lessons/04-the-stateless-core/) the stateless core
- [05-protocol-eras-and-compatibility/](lessons/05-protocol-eras-and-compatibility/) protocol eras and compatibility
- [06-hosts-clients-and-servers/](lessons/06-hosts-clients-and-servers/) hosts clients and servers
- [07-discovery-and-capability-negotiation/](lessons/07-discovery-and-capability-negotiation/) discovery and capability negotiation
- [08-tool-schemas-and-structured-content/](lessons/08-tool-schemas-and-structured-content/) tool schemas and structured content
- [09-reading-server-manifests/](lessons/09-reading-server-manifests/) reading server manifests
- [10-model-interaction-flow/](lessons/10-model-interaction-flow/) model interaction flow
- [11-the-tools-primitive/](lessons/11-the-tools-primitive/) the tools primitive
- [12-the-resources-primitive/](lessons/12-the-resources-primitive/) the resources primitive
- [13-prompts-and-completion/](lessons/13-prompts-and-completion/) prompts and completion
- [14-multi-round-trip-requests-and-elicitation/](lessons/14-multi-round-trip-requests-and-elicitation/) multi round trip requests and elicitation
- [15-deprecated-client-features/](lessons/15-deprecated-client-features/) deprecated client features
- [16-notifications-and-subscriptions/](lessons/16-notifications-and-subscriptions/) notifications and subscriptions
- [17-tool-invocation-lifecycle/](lessons/17-tool-invocation-lifecycle/) tool invocation lifecycle
- [18-error-handling/](lessons/18-error-handling/) error handling
- [19-transports-and-http-headers/](lessons/19-transports-and-http-headers/) transports and http headers
- [20-caching-and-pagination/](lessons/20-caching-and-pagination/) caching and pagination
- [21-long-running-work-and-tasks/](lessons/21-long-running-work-and-tasks/) long running work and tasks
- [22-trust-boundaries/](lessons/22-trust-boundaries/) trust boundaries
- [23-oauth-authorization/](lessons/23-oauth-authorization/) oauth authorization
- [24-client-registration-and-identity/](lessons/24-client-registration-and-identity/) client registration and identity
- [25-consent-and-least-privilege/](lessons/25-consent-and-least-privilege/) consent and least privilege
- [26-risk-and-safety-controls/](lessons/26-risk-and-safety-controls/) risk and safety controls
- [27-auditability-and-observability/](lessons/27-auditability-and-observability/) auditability and observability
- [28-roles-and-adoption/](lessons/28-roles-and-adoption/) roles and adoption
- [29-operational-use-cases/](lessons/29-operational-use-cases/) operational use cases
- [30-the-extensions-framework/](lessons/30-the-extensions-framework/) the extensions framework
- [31-mcp-apps/](lessons/31-mcp-apps/) mcp apps
- [32-registry-gateways-and-sdk-tiers/](lessons/32-registry-gateways-and-sdk-tiers/) registry gateways and sdk tiers
- [33-mcpa-capstone-readiness/](lessons/33-mcpa-capstone-readiness/) mcpa capstone readiness

## Not Affiliated

This is an independent community curriculum. It is not affiliated with, endorsed
by, sponsored by, or authorized by the Agentic AI Foundation or the Linux
Foundation. It does not contain live exam questions. The official exam page and
current program policies always take precedence.
