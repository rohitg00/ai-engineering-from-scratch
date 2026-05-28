---
name: otel-genai
description: Instrumente um agente com convenções semânticas do OpenTelemetry GenAI — invoque_agent, chat, tool_call spans com atributos corretos e captura de conteúdo opcional.
version: 1.0.0
phase: 14
lesson: 23
tags: [opentelemetry, genai, observability, tracing, semantic-conventions]
---

Dado um tempo de execução do agente, conecte as convenções semânticas do OTel GenAI.

Produzir:

1. Intervalo de `invoke_agent` por execução do agente. Tipo CLIENTE para serviços de agente remoto, INTERNO para em processo. Nome: `invoke_agent {gen_ai.agent.name}`.
2. Extensão de `chat` por chamada LLM com `gen_ai.operation.name=chat`, `gen_ai.provider.name`, `gen_ai.request.model`, `gen_ai.response.model`.
3. Extensão de `tool_call` por invocação de ferramenta com `gen_ai.tool.name` e, quando aplicável, `gen_ai.data_source.id` (corpus RAG/armazenamento de memória).
4. Captura de conteúdo opcional: padrão DESATIVADO; quando ligado, armazena entradas/saídas externamente e grava `*.reference_id` em spans.
5. Propagação de contexto: use cabeçalhos de contexto de rastreamento W3C para que execuções de vários processos (subprocesso CLI do SDK do Agente Claude) sejam unidas em um rastreamento.

Rejeições difíceis:

- Captura de prompts/saídas completos em linha por padrão. PII e risco de vazamento secreto; também viola as especificações.
- Faltando `gen_ai.provider.name`. Painéis de vários provedores quebram.
- Vãos de ferramentas órfãs. Sempre defina a relação pai-filho por meio do contexto ativo.

Regras de recusa:

- Se o tempo de execução não puder propagar o contexto através dos limites do processo, recuse. A costura de rastreamento multiprocesso é necessária para usuários do Claude Agent SDK + CLI.
- Se o produto tiver restrições regulatórias (HIPAA, GDPR), recuse a captura de conteúdo inline. Loja externa apenas com controle de acesso.
- Se o backend não definir `OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental`, aviso: os nomes dos atributos podem mudar na atualização do coletor.

Saída: `tracer.py`, `attributes.py`, `content_store.py`, `README.md` explicando a estrutura do span, aceitação de estabilidade e política de captura de conteúdo. Termine com "o que ler a seguir" apontando para a Lição 24 (backends: Langfuse, Phoenix, Opik) ou Lição 17 para propagação de contexto de rastreamento do SDK do Agente Claude.