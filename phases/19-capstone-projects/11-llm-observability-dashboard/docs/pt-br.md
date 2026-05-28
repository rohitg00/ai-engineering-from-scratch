# Capstone 11 — Painel de Observabilidade e Avaliação de LLM

> Langfuse se tornou open-core. Arize Phoenix publicou os mapeamentos de semconv GenAI de 2026. Helicone e Braintrust ambos focaram em atribuição de custo por usuário. OpenLLMetry do Traceloop se tornou o SDK de instrumentação padrão. A forma de produção é ClickHouse para traces, Postgres para metadados, Next.js para UI e um pequeno exército de jobs de avaliação (DeepEval, RAGAS, LLM-judge) rodando sobre traces amostrados. Construa um auto-hospedado, ingira de pelo menos quatro famílias de SDK e demonstre pegar uma regressão injetada em menos de cinco minutos.

**Tipo:** Capstone
**Linguagens:** TypeScript (UI), Python / TypeScript (ingestão + avaliações), SQL (ClickHouse)
**Pré-requisitos:** Fase 11 (engenharia de LLM), Fase 13 (ferramentas), Fase 17 (infraestrutura), Fase 18 (segurança)
**Fases exercitadas:** P11 · P13 · P17 · P18
**Tempo:** 25 horas

## Problema

Toda equipe de IA rodando tráfego de produção em 2026 mantém um plano de observabilidade ao lado do modelo. Atribuição de custo. Detecção de alucinação. Monitoramento de deriva. Sinal de jailbreak. Paineis de SLO. Alertas de vazamento de PII. As referências open-source — Langfuse, Phoenix, OpenLLMetry — convergiram nas convenções semânticas do OpenTelemetry GenAI como schema de ingestão. Você pode agora instrumentar OpenAI, Anthropic, Google, LangChain, LlamaIndex e vLLM com um único SDK e enviar spans compatíveis.

Você vai construir um painel auto-hospedado que ingere de pelo menos quatro famílias de SDK, roda um pequeno conjunto de jobs de avaliação sobre traces amostrados, detecta deriva e alerta. A barra de medição: dada uma regressão deliberadamente injetada (um prompt que começa a produzir PII), o painel pega e dispara um alerta em menos de cinco minutos.

## Conceito

Ingestão é OTLP HTTP. O SDK produz spans com semconv GenAI: `gen_ai.system`, `gen_ai.request.model`, `gen_ai.usage.input_tokens`, `gen_ai.response.id`, `llm.prompts`, `llm.completions`. Spans vão para o ClickHouse para análise colunar; metadados (usuários, sessões, apps) vão para o Postgres.

Avaliações rodam como jobs em lote sobre traces amostrados. DeepEval pontua fidelidade, toxicidade e relevância da resposta. RAGAS pontua métricas de recuperação quando o trace carrega contexto de recuperação. LLM-judges customizados rodam verificações eespecificaçãoíficas do domínio (vazamento de PII, resposta fora de política). Jobs de avaliação escrevem de volta no mesmo ClickHouse como spans de avaliação vinculados ao trace pai.

Detecção de deriva observa distribuições de embeddings ao longo do tempo (divergência PSI ou KL em embeddings de prompt) mais tendências de pontuação de avaliação. Alertas alimentam Prometheus Alertmanager e depois Slack / PagerDuty. A UI é Next.js 15 com Recharts.

## Arquitetura

```
apps de produção:
  SDK OpenAI  +  SDK Anthropic  +  SDK Google GenAI
  LangChain + LlamaIndex + vLLM
       |
       v
  SDK OpenTelemetry com semconv GenAI
       |
       v  OTLP HTTP
  coletor (ingestão, amostragem, fan-out)
       |
       +-------------+-----------+
       v             v           v
   ClickHouse    Postgres    arquivo S3
   (spans)       (metadados) (eventos brutos)
       |
       +---> jobs de avaliação (DeepEval, RAGAS, LLM-judge)
       |     amostrados ou todos-os-traces
       |     escrevem spans de avaliação de volta
       |
       +---> detector de deriva (PSI / KL em embeddings de prompt)
       |
       +---> métricas Prometheus -> Alertmanager -> Slack / PagerDuty
       |
       v
   painel Next.js 15 (Recharts)
```

## Stack

- Ingestão: SDKs OpenTelemetry + convenções semânticas GenAI; transporte OTLP HTTP
- Coletor: OpenTelemetry Collector com processador tail-sampling (para controle de custo)
- Armazenamento: ClickHouse para spans, Postgres para metadados, S3 para arquivo de eventos brutos
- Avaliações: DeepEval, RAGAS 0.2, pacote de avaliadores Arize Phoenix, LLM-judge customizado
- Drift: PSI / KL em embeddings de prompt agrupados (sentence-transformers) semanalmente
- Alertas: Prometheus Alertmanager -> Slack / PagerDuty
- UI: Next.js 15 App Router + Recharts + server actions
- SDKs suportados fora da caixa: OpenAI, Anthropic, Google GenAI, LangChain, LlamaIndex, vLLM

## Construa

1. **Config do coletor.** OpenTelemetry Collector com receptor OTLP HTTP, um tail-sampler mantendo 100% dos traces com erro e 10% dos bem-sucedidos, e exportadores para ClickHouse e S3.

2. **Schema ClickHouse.** Tabela `spans` com colunas espelhando semconv GenAI: `gen_ai_system`, `gen_ai_request_model`, `input_tokens`, `output_tokens`, `latency_ms`, `prompt_hash`, `trace_id`, `parent_span_id`, além de um JSON bag para payloads longos. Adicione índices secundários por user_id e app_id.

3. **Teste de cobertura de SDK.** Escreva um pequeno app cliente usando cada SDK (OpenAI, Anthropic, Google, LangChain, LlamaIndex, vLLM) com auto-instrumentação OpenLLMetry. Verifique que cada um produz spans GenAI canônicos que chegam ao ClickHouse.

4. **Jobs de avaliação.** Um job agendado lê traces amostrados dos últimos 15 minutos e roda DeepEval de fidelidade, toxicidade e relevância da resposta. Saídas são spans de avaliação vinculados ao trace pai.

5. **LLM-judge customizado.** Um juiz de vazamento de PII: dado uma resposta, chame um LLM guard para pontuar a probabilidade de vazamento de PII. Respostas de alta pontuação vão para uma fila de triagem.

6. **Detecção de deriva.** Job semanal que computa PSI entre os embeddings de prompt agrupados desta semana e a linha de base das 4 semanas anteriores. Se PSI acima do limiar, alerta.

7. **Painel.** Next.js 15 com páginas: visão geral (spans/seg, custo/usuário, latência p95), traces (busca + waterfall), avaliações (tendência de fidelidade, toxicidade), deriva (PSI ao longo do tempo), alertas.

8. **Cadeia de alertas.** Exportador Prometheus lê agregados de pontuação de avaliação e percentis de latência; Alertmanager roteia para Slack para avisos e PagerDuty para violações críticas.

9. **Probe de regressão.** Injete um bug: o chatbot avaliado começa a vazar CPFs falsos 1% do tempo. Meça MTTR: do bug implantado ao alerta Slack.

## Use

```
$ curl -X POST https://my-otel-collector/v1/traces -d @trace.json
[coletor]   aceitou 1 trace, 3 spans
[clickhouse] inseriu 3 spans (app=chat, user=u_42)
[aval]       DeepEval fidelidade 0.82, toxicidade 0.03
[deriva]      PSI semanal 0.08 (abaixo do limiar 0.2)
[ui]         ao vivo em https://obs.example.com
```

## Entregue

`outputs/skill-llm-observability.md` é a entrega. Dada uma aplicação LLM, o painel ingere seus traces, roda avaliações, alerta em deriva e exibe breakdown de custo/usuário no Next.js.

| Peso | Critério | Como é medido |
|:-:|---|---|
| 25 | Cobertura do schema de traces | Número de famílias de SDK produzindo spans GenAI canônicos (meta: 6+) |
| 20 | Corretude das avaliações | Pontuações DeepEval / RAGAS vs conjunto rotulado manualmente |
| 20 | UX do painel | MTTR na regressão injetada (meta abaixo de 5 minutos) |
| 20 | Custo / escala | Ingestão sustentada de 1k spans/sem sem backlog |
| 15 | Alertas + detecção de deriva | Cadeia Prometheus/Alertmanager exercitada ponta a ponta |
| **100** | | |

## Exercícios

1. Adicione instrumentação customizada para o framework Haystack. Verifique que spans canônicos chegam ao ClickHouse com atributos `gen_ai.*` fiéis.

2. Troque DeepEval por avaliadores Phoenix nos mesmos traces. Meça a variação de pontuação entre os dois motores de avaliação.

3. Afine o detector de deriva: compute PSI por app-id em vez de global. Mostre trilhas de deriva por app.

4. Adicione uma página "impacto no usuário": custo-por-usuário e taxa-de-falha-por-usuário com sparklines.

5. Construa uma política de tail-sampling que mantém 100% dos traces com toxicidade > 0.5 mais uma amostra estratificada de 10% do resto. Meça o viés de amostragem introduzido.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|------|------------------------|------------------------|
| Semconv GenAI | "Atributos LLM do OTel" | Eespecificaçãoificação OpenTelemetry 2025 para atributos de span de LLM (sistema, modelo, tokens) |
| Tail sampling | "Amostragem pós-trace" | Coletor decide manter ou dropar um trace após ele completar (pode olhar erros) |
| PSI | "Índice de estabilidade populacional" | Métrica de deriva comparando duas distribuições; > 0.2 geralmente sinaliza deriva significativo |
| LLM-judge | "Avaliação como modelo" | Um LLM pontuando a saída de outro LLM numa rubrica (fidelidade, toxicidade, PII) |
| Política de tail-sampling | "Regra de manutenção" | Regra que decide quais traces persistir vs dropar; erro + taxa de amostragem |
| Span de avaliação | "Trace de avaliação vinculado" | Span filho carregando uma pontuação de avaliação vinculado ao span da chamada LLM original |
| Custo por usuário | "Unit economics" | Custo em dólar atribuído a um user_id em uma janela; métrica chave de produto |

## Leitura Complementar

- [Langfuse](https://github.com/langfuse/langfuse) — plataforma de observabilidade open-core de referência
- [Arize Phoenix](https://github.com/Arize-ai/phoenix) — referência alternativa com forte suporte a deriva
- [OpenLLMetry (Traceloop)](https://github.com/traceloop/openllmetry) — família de SDKs de auto-instrumentação
- [Convenções semânticas GenAI do OpenTelemetry](https://opentelemetry.io/docs/especificaçãos/semconv/gen-ai/) — o schema de ingestão
- [Helicone](https://www.helicone.ai) — observabilidade hospedada alternativa
- [Braintrust](https://www.braintrust.dev) — plataforma de avaliação-first alternativa
- [Documentação ClickHouse](https://clickhouse.com/docs) — armazenamento colunar de spans
- [DeepEval](https://github.com/confident-ai/deepeval) — biblioteca de avaliação
