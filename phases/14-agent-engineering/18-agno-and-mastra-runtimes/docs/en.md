# Agno and Mastra: Production Runtimes

> Agno (Python) とMastra (TypeScript) は、2026年のproduction-runtime pairingです。Agnoはmicrosecond agent instantiationとstateless FastAPI backendを狙います。MastraはVercel AI SDK基盤の上で、agents、tools、workflows、unified model routing、composite storageをshipします。

**種別:** 学習
**言語:** Python, TypeScript
**前提条件:** Phase 14 · 01 (Agent Loop), Phase 14 · 13 (LangGraph)
**所要時間:** 約45分

## Learning Objectives

- Agnoのperformance targetsと、それが重要になる場面を識別する。
- Mastraの3つのprimitive (Agents、Tools、Workflows) とsupported server adaptersを挙げる。
- stateless session-scoped FastAPI backendがAgnoのrecommended production pathである理由を説明する。
- 与えられたstackに対してAgno vs Mastraを選ぶ (Python-first vs TypeScript-first)。

## 問題

LangGraph、AutoGen、CrewAIはframework-heavyです。「agent loopだけを、自分のruntime内で速く」欲しいteamはAgno (Python) またはMastra (TypeScript) を選びます。どちらも、framework-owned primitivesの一部をraw speedとsurrounding stackへのtight fitと交換します。

## The Concept

### Agno

- Python runtime。以前はPhi-data。
- 「No graphs, chains, or convoluted patterns — just pure python.」
- docs上のperformance targets: 約2μsのagent instantiation、agentあたり約3.75 KiB memory、約23 model providers。
- production path: stateless session-scoped FastAPI backend。各requestでfresh agentを開始し、session stateはDBに置く。
- native multimodal (text、image、audio、video、file) とagentic RAG。

speed targetが重要なのは、秒間数千のshort-lived agentsがある場合です (chat fan-in、evaluation pipelines)。1 agentが10分走る場合には重要性は下がります。

### Mastra

- TypeScript。Vercel AI SDK上に構築。
- 3つのprimitive: **Agents**、**Tools** (Zod-typed)、**Workflows**。
- Unified Model Router — 94 providers across 3,300+ models (2026年3月)。
- Composite storage: memory、workflows、observabilityを別backendへ。scale時のobservabilityにはClickHouse推奨。
- Apache 2.0。ただし`ee/` directoriesはsource-available enterprise license。
- Express、Hono、Fastify、Koaのserver adapters。Next.jsとAstro integrationはfirst-class。
- debugging用にMastra Studio (localhost:4111) をship。
- 1.0時点 (2026年1月) で22k+ GitHub stars、300k+ weekly npm downloads。

### Positioning

どちらもLangGraphになろうとしていません。競争軸は次です。

- **Language fit.** Python-first teamにはAgno。TypeScript-firstにはMastra。
- **Runtime ergonomics.** Agno = near-zero overhead。Mastra = Vercel ecosystemとの統合。
- **Observability.** 両方ともLangfuse/Phoenix/Opik (Lesson 24) とintegrateするが、Mastra Studioはfirst-party。

### When to pick each

- **Agno** — Python backend、多数のshort-lived agents、強いperf requirement、FastAPI shop。
- **Mastra** — TypeScript backend、Next.js / Vercel deploy、unified multi-provider model routing、Zod-typed tools。
- **LangGraph** (Lesson 13) — raw speedよりdurable stateとexplicit graph reasoningが重要な場合。
- **OpenAI / Claude Agent SDK** — providerのproductized shapeが欲しい場合 (Lessons 16–17)。

### Where this pattern goes wrong

- **Perf-for-perf's-sake。** workloadがrequestごとに1つの遅いagent callなのに、「2μs」が良さそうだからAgnoを選ぶ。overheadはbottleneckではありません。
- **Ecosystem lock-in。** MastraのVercel-flavored integrationはVercel上ではplus、他ではminusです。
- **Enterprise license confusion。** Mastraの`ee/` directoriesはsource-availableであり、Apache 2.0ではありません。fork予定ならlicenseを読んでください。

## 実装

このlessonは主に比較です。どちらのframeworkにも公平なsingle code artifactはありません。`code/main.py`にはside-by-side toyがあります。minimalな「agentをrunし、outputをstreamし、sessionをpersistする」flowを2回実装しています (Agno-shapedとMastra-shaped)。

実行:

```
python3 code/main.py
```

構造は違うが機能的には同等な2つのtraceが出ます。

## Use It

- **Agno** — speedとFastAPI shapeが必要なPython backend。
- **Mastra** — 多数providerとworkflow primitivesを持つTypeScript backend。
- 両方ともfirst-party observability hooksをshipします。両方ともLangfuseとintegrateします。

## Ship It

`outputs/skill-runtime-picker.md`は、stack、latency budget、operational shapeに基づいてAgno、Mastra、LangGraph、provider SDKを選びます。

## Exercises

1. Agno docsを読む。stdlib ReAct loop (Lesson 01) をAgnoへportする。何が消え、何が残ったか。
2. Mastra docsを読む。同じloopをMastraへportする。tool typingで何が変わったか (Zod vs nothing)。
3. benchmark: 自分のstackでagent instantiation latencyを測る。Agnoの2μsはworkloadに効くか。
4. migrationをdesignする。PythonでCrewAIを運用している場合、Agnoへ移ると何が壊れるか。
5. Mastraの`ee/` license termsを読む。open-source forkに影響するrestrictionは何か。

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Agno | 「Fast Python agents」 | stateless session-scoped agent runtime |
| Mastra | 「TypeScript agents on Vercel AI SDK」 | Agents + Tools + Workflows + Model Router |
| Unified Model Router | 「Multi-provider access」 | 94 providers across 3,300+ modelsへのsingle client |
| Composite storage | 「Multiple backends」 | memory/workflows/observabilityをそれぞれ別storeへ |
| Mastra Studio | 「Local debugger」 | agentsをinspectするlocalhost:4111 UI |
| Source-available | 「Not OSS」 | sourceは読めるがcommercial useを制限するlicense |

## 参考文献

- [Agno Agent Framework docs](https://www.agno.com/agent-framework) — performance targets, FastAPI integration
- [Mastra docs](https://mastra.ai/docs) — primitives, server adapters, Model Router
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) — stateful-graph alternative
- [Comet Opik](https://www.comet.com/site/products/opik/) — Mastra integrationsが引用するobservability comparisons
