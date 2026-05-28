---
name: runtime-picker
description: stack、latency budget、operational shapeに応じてproduction agent runtime (Agno、Mastra、LangGraph、provider SDK) を選ぶ。
version: 1.0.0
phase: 14
lesson: 18
tags: [agno, mastra, langgraph, runtime, selection]
---

stack、latency budget、required primitives、operational shapeを受け取り、runtimeを選ぶ。

Decision:

1. Python + FastAPI + 秒間数千のshort-lived agents -> **Agno**。
2. TypeScript + Next.js/Vercel + unified multi-provider -> **Mastra**。
3. durable state、explicit graph、resume-on-failure -> **LangGraph** (Lesson 13)。
4. Claude-first productでClaude Code harness shapeが欲しい -> **Claude Agent SDK** (Lesson 17)。
5. OpenAI-first productでhandoffs + guardrails + tracingが欲しい -> **OpenAI Agents SDK** (Lesson 16)。
6. multi-agent team、actor-model concurrency、fault isolation -> **AutoGen v0.4** / **Microsoft Agent Framework** (Lesson 14)。
7. role-based collaborationまたはevent-driven deterministic workflows -> **CrewAI** CrewまたはFlow (Lesson 15)。
8. 上記に当てはまらない -> direct API calls + Lesson 01のstdlib loop。

生成するもの:

- short decision document: stack、latency target、needed primitives、observed trade-offs。
- chosen runtimeでのminimal scaffold。
- すでに別runtimeを使っている場合のmigration plan。

Hard rejects:

- workloadがrequestごとに1つの遅いcallなのに、「performance」だけでAgnoまたはMastraを選ぶこと。performanceがbottleneckであることはまれです。
- rationaleなしにPython monorepoでTypeScript runtimeを選ぶこと。mixed-language agent codeはoperational taxです。
- stateless short tasksにLangGraphを選ぶこと。checkpointerはsimple workflow (Lesson 12) が避けられるoverheadを足します。

Refusal rules:

- userが「比較のために5つ全部のruntime」を求めたら拒否する。自分のworkloadでbenchmarkしてください。framework vendor benchmarkはdirectionalです。
- userがMastraの`ee/` featuresをself-hostしたいと言ったら拒否し、license termsを示す。
- productがlong-running async work (hours-to-days) を必要とする場合はself-hostedを拒否し、Claude Managed Agentsまたはqueue-based architecture (Lesson 29) へrouteする。

Output: decision doc + scaffold + README。最後に"what to read next"として、framework上のoperational layerにはLesson 24 (observability) とLesson 29 (production runtimes) を示す。
