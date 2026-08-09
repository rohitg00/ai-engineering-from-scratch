# Official Claude Certification Blueprint Map

> Source-of-truth notes for curriculum maintainers. Verify again before every release.

**Verified:** 2026-08-09
**Exam guide version:** 1.0
**Effective:** July 2026

## Official Guides

- [CCAO-F exam guide](https://everpath-course-content.s3-accelerate.amazonaws.com/instructor%2F6nizmqk8tpzpfjvt6qmmav7rh%2Fpublic%2F1783542847%2FClaude+Certified+Associate+%E2%80%93+Foundations+Exam+Guide.pdf)
- [CCDV-F exam guide](https://everpath-course-content.s3-accelerate.amazonaws.com/instructor%2F6nizmqk8tpzpfjvt6qmmav7rh%2Fpublic%2F1783542875%2FClaude+Certified+Developer+%E2%80%93+Foundations+Exam+Guide.pdf)
- [CCAR-F exam guide](https://everpath-course-content.s3-accelerate.amazonaws.com/instructor%2F6nizmqk8tpzpfjvt6qmmav7rh%2Fpublic%2F1783542750%2FClaude+Certified+Architect+%E2%80%93+Foundations+Exam+Guide.pdf)
- [CCAR-P exam guide](https://everpath-course-content.s3-accelerate.amazonaws.com/instructor%2F6nizmqk8tpzpfjvt6qmmav7rh%2Fpublic%2F1783542810%2FClaude+Certified+Architect+%E2%80%93+Professional+Exam+Guide.pdf)

## Coverage Strategy

The repository already has strong foundations for prompting, structured
output, context engineering, evaluation, agents, tool design, MCP, security,
RAG, observability, and production operations. The certification section does
three jobs that the phase curriculum should not:

1. It frames each topic as a blueprint decision under exam-style constraints.
2. It fills Claude-specific product, API, configuration, and lifecycle gaps.
3. It assembles role-specific capstones and weighted assessments.

The most important gaps found in the existing course were:

- Claude chat, research, Projects, Artifacts, and project knowledge maintenance.
- A cohesive Messages API state machine, including content blocks, stop reasons,
  tool continuations, streaming, thinking, caching, and batch tradeoffs.
- Claude Code configuration precedence, Rules, Skills, Commands, Agents,
  memory, headless execution, and CI workflows.
- Business discovery, stakeholder communication, architecture defense,
  implementation handoff, and operational ownership.

A second pass against the current Anthropic Academy catalog added product-surface
depth without changing the public blueprint:

- Direct Claude, Amazon Bedrock, Google Vertex AI, and Microsoft Foundry
  deployment decisions.
- SDK, REST, streaming, asynchronous, multimodal, Files API, Tool Runner, and
  managed-agent access patterns.
- Advanced MCP sampling, roots, notifications, Inspector, Streamable HTTP, and
  stateful-versus-stateless deployment decisions.
- Current Claude Code operating controls, real Skill authoring, subagent
  contracts, and team distribution.
- A four-property diagnostic for next-token prediction, knowledge, working
  memory, and steerability.

## Existing Deep Dives

Use these instead of duplicating their from-scratch teaching:

| Capability | Existing lesson paths |
|------------|-----------------------|
| Prompting and few-shot reasoning | `phases/11-llm-engineering/01-prompt-engineering`, `phases/11-llm-engineering/02-few-shot-cot` |
| Structured outputs | `phases/11-llm-engineering/03-structured-outputs`, `phases/13-tools-and-protocols/04-structured-output` |
| Context and caching | `phases/11-llm-engineering/05-context-engineering`, `phases/11-llm-engineering/11-caching-cost`, `phases/11-llm-engineering/15-prompt-caching` |
| Evaluation | `phases/11-llm-engineering/10-evaluation`, `phases/14-agent-engineering/30-eval-driven-agent-development` |
| Agent loops and orchestration | `phases/14-agent-engineering/01-the-agent-loop`, `phases/14-agent-engineering/12-anthropic-workflow-patterns`, `phases/14-agent-engineering/28-orchestration-patterns` |
| Claude Agent SDK | `phases/14-agent-engineering/17-claude-agent-sdk` |
| Tool and MCP design | `phases/13-tools-and-protocols/01-the-tool-interface`, `phases/13-tools-and-protocols/05-tool-schema-design`, `phases/13-tools-and-protocols/06-mcp-fundamentals`, `phases/13-tools-and-protocols/07-building-an-mcp-server`, `phases/13-tools-and-protocols/11-mcp-sampling`, `phases/13-tools-and-protocols/12-mcp-roots-and-elicitation` |
| Security and approvals | `phases/14-agent-engineering/27-prompt-injection-defense`, `phases/15-autonomous-systems/10-claude-code-permission-modes`, `phases/17-infrastructure-and-production/25-security-secrets-audit` |
| RAG and retrieval | `phases/11-llm-engineering/06-rag`, `phases/11-llm-engineering/07-advanced-rag`, `phases/19-capstone-projects/65-hybrid-retrieval-bm25-dense` |
| Observability and operations | `phases/17-infrastructure-and-production/13-llm-observability`, `phases/17-infrastructure-and-production/23-sre-for-ai`, `phases/17-infrastructure-and-production/27-finops-llms` |

## Track Emphasis

### CCAO-F

The highest-weight domain is output evaluation and validation at 21 percent.
The route therefore spends more time on factual verification, bias checks,
audience fit, appropriate formats, and human review than on prompt syntax.

### CCDV-F

Applications and Integration is 33.1 percent. The route is protocol-first:
Messages API state, application boundaries, SDK and REST behavior, session
hygiene, configuration, tools, and production failure isolation.

### CCAR-F

The exam is organized around realistic scenarios. The route teaches a repeatable
decision method across the six public scenario contexts, with the greatest time
given to Agentic Architecture and Orchestration at 27 percent.

### CCAR-P

Integration is the largest single domain at 19 percent, but Professional is a
full-lifecycle exam. The course connects discovery, architecture, prompting,
RAG, evaluation, safety, stakeholder communication, Claude Code enablement,
and operational ownership instead of treating them as isolated facts.
