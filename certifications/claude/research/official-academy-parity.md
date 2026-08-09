# Official Anthropic Academy Parity Map

> Parity means every certification-relevant learning objective has a local explanation, decision exercise, artifact, and verification path. It does not mean copying the Academy catalog.

**Verified:** 2026-08-09

## Official Prep Snapshot

The current partner prep pages describe:

- Associate Foundations: eight modules, 389 listed minutes.
- Developer Foundations: five modules, 774 listed minutes.
- Architect Foundations: a bundle of seven existing Academy courses.
- Architect Professional: five modules, 733 listed minutes.

These totals are a dated catalog snapshot, not exam duration or a required study
time. The Academy can add, remove, or reorganize courses without changing a
public exam guide.

Sources: [Associate prep path](https://anthropic-partners.skilljar.com/path/claude-certified-associate-foundations),
[Developer prep path](https://anthropic-partners.skilljar.com/path/claude-certified-developer-foundations),
[Architect Foundations prep bundle](https://anthropic-partners.skilljar.com/page/claude-certified-architect-foundations-prep-courses), and
[Architect Professional prep path](https://anthropic-partners.skilljar.com/path/claude-certified-architect-professional).

## Learning-Surface Map

| Official Academy surface | Certification-relevant objective | Local coverage |
|---|---|---|
| [AI Fluency: Framework and Foundations](https://anthropic.skilljar.com/ai-fluency-framework-foundations) | Delegation, Description, Discernment, and Diligence | Lessons 00, 05, 06, and 07 turn the 4Ds into a study plan, capability diagnosis, control map, and human handoff |
| [AI Capabilities and Limitations](https://anthropic.skilljar.com/ai-capabilities-and-limitations) | Diagnose next-token prediction, knowledge, working memory, and steerability | Lessons 04 and 05 provide context decisions and a validated four-property failure diagnostic |
| [Claude 101](https://anthropic.skilljar.com/claude-101) | Claude product surfaces, Projects, knowledge, connectors, research, and safe everyday workflows | Lessons 01, 04, and 07 plus the Associate capstone |
| [Product Foundations](https://anthropic-partners.skilljar.com/product-foundations) | Choose direct Claude, Amazon Bedrock, Google Vertex AI, or Microsoft Foundry from business and control requirements | Lesson 01 deployment ADR; lessons 22, 23, and 25 extend procurement, architecture, identity, and data-boundary decisions |
| [Claude Platform 101](https://anthropic.skilljar.com/claude-platform-101) | Raw Messages loop, SDK Tool Runner, first-party tools, managed agents, event streams, workspaces, and spend controls | Lessons 08, 10, 12, 13, and 26 provide offline state-machine, execution-surface, security, and operational exercises |
| [Building with the Claude API](https://anthropic.skilljar.com/claude-with-the-anthropic-api) | API lifecycle, streaming, tools, structured outputs, caching, batch, RAG, evals, Computer Use, and agents | Lessons 08 through 14, 20, 24, and 26; existing phase lessons provide from-scratch RAG and eval depth |
| [Introduction to MCP](https://anthropic.skilljar.com/introduction-to-model-context-protocol) | Clients, servers, tools, resources, prompts, transport, MIME, and cleanup | Lesson 11 contract lab plus phase 13 MCP server and client builds |
| [MCP Advanced Topics](https://anthropic.skilljar.com/model-context-protocol-advanced-topics) | Sampling, roots, notifications, JSON-RPC, Streamable HTTP, sessions, and scaling | Lesson 11 decision and deployment lab plus phase 13 sampling and roots/elicitation builds |
| [Claude Code 101](https://anthropic.skilljar.com/claude-code-101) | Permissions, Plan Mode, context recovery, CLAUDE.md, subagents, Skills, MCP, and hooks | Lessons 15 and 19 plus the existing Claude Code permission-mode lesson |
| [Claude Code in Action](https://anthropic.skilljar.com/claude-code-in-action) | Compaction, rewind, goals and loops, worktrees, headless automation, review, routines, and distribution | Lessons 15 and 19 operational packets and CI validators |
| [Introduction to Agent Skills](https://anthropic.skilljar.com/introduction-to-agent-skills) | Author SKILL.md, trigger through descriptions, restrict tools, package scripts, distribute, and debug | Lesson 19 ships and validates a real multi-file Skill; the repository tutor demonstrates portable distribution |
| [Introduction to Subagents](https://anthropic.skilljar.com/introduction-to-subagents) | Isolated context, restricted tools, structured reports, obstacles, time boxes, and delegation limits | Lessons 16, 17, and 19 |
| [Introduction to Claude Cowork](https://anthropic.skilljar.com/introduction-to-claude-cowork) | Guided task loop, standing context, Skills/plugins, file workflows, and responsible steering | Brief product-landscape and workflow-selection coverage only; not promoted to a public exam objective |
| Claude on Amazon Bedrock and Google Vertex AI | Provider-specific deployment and operations | Lesson 01 teaches the architecture decision; provider console walkthroughs remain optional official companion material |

## What Local Parity Adds

Each mapped lesson must do more than mention the official objective:

1. Explain the mechanism and its failure boundary.
2. Let the learner manipulate a scenario or decision.
3. Produce a learner-owned artifact.
4. Run a deterministic validator or simulator.
5. Test transfer through original questions and a role capstone.

For a conceptual lesson, the executable surface grades the policy, threat
model, ADR, approval flow, or evidence packet. It never adds fake provider code
to make the lesson look technical.

## Deliberate Non-Parity

- The curriculum does not copy Academy narration, slides, exercises, or quiz
  wording.
- It does not preserve a fixed total Academy course count.
- It does not turn partner sales enablement into a technical exam requirement.
- It does not require Pydantic in this stdlib-first repository; lesson 09
  teaches how its validation role maps to the underlying contract.
- It does not duplicate provider-console tutorials when the public blueprint
  requires an architecture decision rather than console navigation.
- It does not pass certification lessons through the book workflow because the
  tutor state, labs, figures, and assessments are required learning surfaces.
