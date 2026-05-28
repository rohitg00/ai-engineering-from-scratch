---
name: llm-observability
description: Crie um painel de observabilidade LLM auto-hospedado que ingere extensões do OpenTelemetry GenAI, execute avaliações e capture regressões injetadas em menos de cinco minutos.
version: 1.0.0
phase: 19
lesson: 11
tags: [capstone, observability, otel, langfuse, phoenix, evals, drift, clickhouse]
---

Dado o tráfego de produção LLM em pelo menos seis famílias de SDK (OpenAI, Anthropic, Google GenAI, LangChain, LlamaIndex, vLLM), implante um plano de observabilidade auto-hospedado que ingira intervalos OTLP GenAI-semconv, execute avaliações, detecte desvios e alertas.

Plano de construção:

1. Coletor OpenTelemetry com receptor HTTP OTLP, processador de amostragem final (mantém 100% de erros, 10% de sucesso, 100% de alta toxicidade/PII), exportadores para ClickHouse + S3.
2. Espelhamento de esquema de span ClickHouse GenAI semconv: gen_ai.system, gen_ai.request.model, uso.input/output_tokens, latency_ms, user_id, app_id, além de saco JSON para prompts/conclusões.
3. Armazenamento de metadados Postgres para aplicativos, usuários, sessões, fila de anotações.
4. Instrumentação automática OpenLLMetry em um aplicativo cliente por família SDK; verifique os vãos canônicos da terra.
5. Pacote de avaliador DeepEval + RAGAS + Phoenix agendado sobre traços amostrados; juiz LLM personalizado para PII e fora da política.
6. Detector semanal de desvio PSI / KL em embeddings de prompt agrupados; limite de alerta 0,2.
7. Exportador Prometheus para agregados de pontuação de avaliação e percentis de latência; Alertmanager para Slack (aviso) + PagerDuty (crítico).
8. Painel do Next.js 15 App Router: visão geral, pesquisa de rastreamento + cascata, tendências de avaliação, gráfico de desvio, alertas.
9. Sonda de regressão: injeta um padrão de resposta que vaza SSNs falsos 1% das vezes; medir o MTTR (tempo de disparo do alerta).

Rubrica de avaliação:

| Peso | Critério | Medição |
|:-:|---|---|
| 25 | Cobertura do esquema de rastreamento | Número de famílias de SDK que produzem extensões GenAI canônicas (alvo 6+) |
| 20 | Correção da avaliação | Pontuações DeepEval / RAGAS vs conjunto rotulado à mão |
| 20 | UX do painel | MTTR na regressão injetada (alvo inferior a 5 minutos) |
| 20 | Custo/escala | Ingestão sustentada de 1k spans/s sem atraso |
| 15 | Alerta + detecção de desvio | Cadeia Prometheus/Alertmanager exercida de ponta a ponta |

Rejeições difíceis:

- Esquemas de extensão que inventam nomes de atributos que não estão no semconv do OpenTelemetry GenAI.
- Políticas de amostragem de cauda que eliminam erros (um antipadrão bem conhecido).
- Avaliações executadas na taxa de ingestão sem amostragem (custo inaceitável).
- Dashboards que mostram "latência" sem separação p50/p95/p99.

Regras de recusa:

- Recuse-se a persistir prompts ou conclusões sem uma política de redação de PII.
- Recuse-se a reivindicar "suporte multi-SDK" sem um teste de regressão de extensão canônica por SDK.
- Recusar a detecção de deriva de navios sem uma janela de referência; a deriva de tiro zero é inútil.

Saída: um repositório contendo a configuração do coletor, o esquema ClickHouse, o painel Next.js 15, os trabalhos de avaliação, o detector de desvio, a cadeia de alertas, o conjunto de dados de demonstração de rastreamento de 10k com regressões anotadas e um artigo documentando o MTTR para a regressão PII injetada, além das três principais melhorias de UX do painel que eliminaram o MTTR durante a iteração.