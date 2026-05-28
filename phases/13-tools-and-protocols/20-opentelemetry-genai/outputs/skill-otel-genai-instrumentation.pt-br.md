---
name: otel-genai-instrumentation
description: Produza um plano de instrumentação para uma base de código de agente para emitir extensões OTel GenAI de ponta a ponta.
version: 1.0.0
phase: 13
lesson: 19
tags: [otel, observability, gen-ai, tracing]
---

Dada uma base de código de agente (chamadas LLM, envio de ferramentas, cliente MCP, subagentes), produza um plano de instrumentação OTel GenAI.

Produzir:

1. Hierarquia de extensão. Raiz `agent.invoke_agent` (INTERNO) e filhos: `llm.chat` (CLIENTE), `tool.execute` (INTERNO), `mcp.call` (CLIENTE), `subagent.invoke` (INTERNO).
2. Lista de verificação de atributos por período. `gen_ai.operation.name`, `gen_ai.provider.name`, `gen_ai.request.model`, `gen_ai.response.model`, `gen_ai.usage.*`, `gen_ai.tool.name`, `gen_ai.agent.name`.
3. Regra de propagação. Injete traceparent W3C em cada chamada remota; para MCP stdio, use `_meta.traceparent` como um campo provisório.
4. Política de captura de conteúdo. Desativado por padrão; documento que env var permite; nomear riscos de PII.
5. Escolha do exportador. Jaeger/Tempo/Langfuse/Phoenix/Datadog/Honeycomb; OTLP como fio.

Rejeições difíceis:
- Qualquer plano sem propagação de rastreamento através dos limites do MCP ou do subagente.
- Qualquer plano com captura de conteúdo ativada por padrão. Vazamentos de avisos e PII.
- Qualquer plano que emita atributos personalizados arbitrários sem o `gen_ai.` ou o prefixo explícito do fornecedor.

Regras de recusa:
- Se a base de código usar uma estrutura com instrumentação automática OTel integrada (Pydantic AI, LangGraph, AgentOps), recomende primeiro o gancho da estrutura.
- Se o backend do exportador for local e a equipe não tiver suporte SRE, recomende um backend gerenciado.
- Se o usuário solicitar a captura de conteúdo para depuração do produto, recuse sem uma política de consentimento digitada e um pipeline de redação de PII.

Saída: um plano de uma página com hierarquia de extensão, lista de verificação de atributos por extensão, regra de propagação, política de captura de conteúdo e escolha do exportador. Termine com a métrica principal para alertar (normalmente p95 `gen_ai.client.operation.duration`).