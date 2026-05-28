# Seleção de Stack de Observabilidade LLM

> O mercado de observabilidade em 2026 se divide em duas categorias. Plataformas de desenvolvimento (LangSmith, Langfuse, Comet Opik) empacotam monitoramento com evals, gestão de prompts, replays de sessão. Ferramentas de gateway/instrumentação (Helicone, SigNoz, OpenLLMetry, Phoenix) focam em telemetria. Langfuse tem core MIT-licensed com equilíbrio OSS forte (50K eventos/mês grátis na cloud). Phoenix é OpenTelemetry-native sob Elastic License 2.0 — excelente para visualização de drift/RAG, não é backend de produção persistente. Arize AX usa integração zero-copy Iceberg/Parquet alegando ser 100x mais barato que observabilidade monolítica. LangSmith lidera para LangChain/LangGraph, $39/usuário/mês, self-host apenas no Enterprise. Helicone é proxy-based com 15-30 minutos de setup, 100K req/mês grátis, mas menos profundidade em traces de agentes. Padrão de produção comum: Gateway (Helicone/Portkey) + plataforma de eval (Phoenix/TruLens) colados por OpenTelemetry.

**Tipo:** Aprender
**Linguagens:** Python (stdlib, simulador de trace-sampling)
**Pré-requisitos:** Fase 17 · 08 (Métricas de Inferência), Fase 14 (Agent Engineering)
**Tempo:** ~60 minutos

## Objetivos de Aprendizado

- Distinguir plataformas de desenvolvimento (empacotadas: evals + prompts + sessões) de ferramentas de gateway/telemetria (traces + métricas apenas).
- Mapear seis ferramentas principais (Langfuse, LangSmith, Phoenix, Arize AX, Helicone, Opik) para suas licenças, preços e casos de uso ideais.
- Explicar o padrão de cola OpenTelemetry que permite combinar uma ferramenta gateway com uma plataforma de eval separada.
- Nomear o diferencial de custo de 2026 (abordagem zero-copy do Arize AX vs ingestão monolítica) e declarar o multiplicador aproximado de 100x.

## O Problema

Você lançou uma feature LLM. Funciona. Você não tem visibilidade em falhas de prompt, loops de ferramentas, regressões de latência, picos de custo ou taxa de hit de prompt-cache. Você busca "LLM observability" e encontra oito ferramentas todas alegando resolver o mesmo problema em três preços diferentes.

Elas não resolvem o mesmo problema. LangSmith responde "por que essa run do LangGraph falhou?" Phoenix responde "meu pipeline de RAG está drifting?" Helicone responde "qual app está queimando tokens?" Langfuse responde "posso self-hostar tudo isso?" Ferramentas diferentes, públicos diferentes.

Escolher envolve quatro eixos: stack (LangChain? SDK raw? multi-vendor?), tolerância a licença (só MIT? Elastic tá bom? comercial tá ok?), orçamento (tier grátis? $100/mês? $1000/mês?), e self-host (obrigatório? legal ter? nunca?).

## O Conceito

### Duas categorias

**Plataformas de desenvolvimento** empacotam observabilidade com evals, gestão de prompts, versionamento de datasets, replay de sessão. Você roda experimentos, vê qual prompt funcionou, faz dataset-regression de um novo prompt contra vencedores antigos. LangSmith, Langfuse, Comet Opik.

**Ferramentas de gateway/telemetria** instrumentam chamadas de inferência — prompt, resposta, tokens, latência, modelo, custo. Helicone, SigNoz, OpenLLMetry, Phoenix. Minimalistas. Podem ser combinadas com ferramenta de eval separada via OpenTelemetry.

### Langfuse — equilíbrio OSS

- Core Apache / MIT licensed; self-host via Docker.
- Tier grátis na cloud: 50K eventos/mês. Pago: $29/mês para time.
- Evals, gestão de prompts, traces, datasets. Cobertura razoável das quatro funcionalidades de plataforma de desenvolvimento.
- Sweet spot: você quer funcionalidades de nível LangSmith mas precisa self-hostar ou ficar na licença OSS.

### Phoenix (Arize) — telemetria-first, OpenTelemetry-native

- Elastic License 2.0; self-host trivial.
- Excelente em visualização de RAG e drift. Scatter plots de embedding-space como funcionalidade de primeira classe.
- Não projetado como backend de produção persistente — primariamente observabilidade de development-time.
- Sweet spot: desenvolvimento de pipeline de RAG, debugging de drift, combinado com gateway separado para produção.

### Arize AX — o jogo da escala

- Comercial. Integração zero-copy com data lake via Iceberg/Parquet.
- Alega ~100x mais barato que observabilidade monolítica (nível Datadog) em escala. A matemática: você armazena traces no seu próprio Parquet no S3; Arize lê diretamente.
- Sweet spot: >10M traces/dia, data lake existente, quer dashboards específicos para LLM sem o preço do Datadog.

### LangSmith — LangChain/LangGraph primeiro

- Comercial, $39/usuário/mês. Self-host apenas no Enterprise.
- Melhor da classe para stacks LangChain e LangGraph. Se você não usa nenhum dos dois, é menos atraente.
- Sweet spot: time comprometido com LangChain, disposto a pagar.

### Helicone — proxy-based mínimo viável

- 15-30 minutos de setup trocando seu `OPENAI_API_BASE` para o proxy Helicone.
- MIT licensed; 100K req/mês grátis, pago $20/mês+.
- Inclui failover, cache, rate limits — funciona como gateway também.
- Menos profundidade em traces de agentes / multi-step.
- Sweet spot: início rápido, app single-stack, precisa de gateway + observabilidade num só.

### Opik (Comet) — plataforma dev OSS

- Apache 2.0, totalmente OSS.
- Conjunto de funcionalidades similar ao Langfuse com herança Comet.
- Sweet spot: times de ML já no Comet, querem observabilidade LLM no mesmo painel.

### SigNoz — OpenTelemetry-first APM completo

- Apache 2.0. Trata APM geral mais LLM via OpenTelemetry.
- Sweet spot: observabilidade unificada entre serviços e chamadas LLM.

### A cola: OpenTelemetry + convenções semânticas GenAI

OpenTelemetry publicou convenções semânticas GenAI no fim de 2025 (`gen_ai.system`, `gen_ai.request.model`, `gen_ai.usage.input_tokens`). Ferramentas que consomem OTel podem interopere. O padrão de produção emergindo:

1. Emita OTel com convenções GenAI de cada chamada LLM.
2. Roteie para gateway (Helicone / Portkey) para o dia-a-dia.
3. Envie duplicado para plataforma de eval (Phoenix / Langfuse) para regressões.
4. Arquivo no data lake (Iceberg) para análise de longo prazo via Arize AX ou DuckDB.

### A armadilha: instrumentar na camada errada

Instrumentar dentro do seu framework de agente (ex: adicionar traces LangSmith) acopla você ao framework. Instrumentar na camada HTTP/OpenAI-SDK (via OpenLLMetry ou seu gateway) é portável.

### Sampling — não dá para manter tudo

Com >1M requests/dia, retenção de trace completo custa mais que as chamadas LLM. Amostre por regras: 100% erros, 100% alto custo, 5% sucesso. Mantenha agregados sempre; mantenha raw para a cauda longa.

### Números que você deve lembrar

- Langfuse cloud grátis: 50K eventos/mês.
- LangSmith: $39/usuário/mês.
- Helicone grátis: 100K req/mês.
- Afirmação do Arize AX: ~100x mais barato que monolítico em escala.
- Convenções GenAI do OpenTelemetry: lançadas em 2025, amplamente adotadas em 2026.

## Use

`code/main.py` simula um dia de 1M de traces em diferentes estratégicas de retenção (100% ingest, sampling, sampling + erros). Reporta custo de armazenamento e o que é perdido em cada uma.

## Entregue

Esta aula produz `outputs/skill-observability-stack.md`. Dados stack, escala, orçamento, postura de licença, escolhe a(s) ferramenta(s).

## Exercícios

1. Seu time usa LangChain e quer observabilidade OSS self-hosted. Escolha Langfuse ou Opik e justifique.
2. Com 5M traces/dia e cotações Datadog de $150K/mês, calcule o break-even para Arize AX.
3. Projete um conjunto de atributos OpenTelemetry GenAI que o guideline da sua organização deveria exigir em cada chamada LLM.
4. Argumente se Phoenix sozinho é suficiente para produção. Quando não é suficiente?
5. Helicone tem 20ms de overhead de proxy. No TTFT P99 de 300 ms, isso é aceitável? E se o SLA for 100 ms?

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| OpenLLMetry | "OTel para LLMs" | Instrumentação OpenTelemetry open-source para LLMs |
| Convenções GenAI | "atributos OTel" | Nomes padronizados de atributos OTel para chamadas LLM |
| LangSmith | "observabilidade LangChain" | Plataforma comercial empacotada com ecossistema LangChain |
| Langfuse | "LangSmith OSS" | MIT OSS com conjunto de funcionalidades similar |
| Phoenix | "ferramenta dev da Arize" | Plataforma dev/eval OpenTelemetry-native |
| Arize AX | "observabilidade de escala" | Observabilidade comercial zero-copy Iceberg/Parquet |
| Helicone | "observabilidade via proxy" | Proxy HTTP coletando telemetria LLM + funcionalidades gateway |
| Opik | "Comet LLM" | Plataforma dev OSS Apache 2.0 da Comet |
| Replay de sessão | "rerun de trace" | Replay de sessão completa do agente com chamadas de ferramentas |
| Eval | "teste offline" | Rodar modelo/prompt candidato sobre dataset rotulado |

## Leituras Adicionais

- [SigNoz — Top LLM Observability Tools 2026](https://signoz.io/comparisons/llm-observability-tools/)
- [Langfuse — Análise de Alternativas ao Arize AX](https://langfuse.com/faq/all/best-phoenix-arize-alternatives)
- [PremAI — Configurando Langfuse, LangSmith, Helicone, Phoenix](https://blog.premai.io/llm-observability-setting-up-langfuse-langsmith-helicone-phoenix/)
- [Convenções Semânticas GenAI do OpenTelemetry](https://opentelemetry.io/docs/specs/semconv/gen-ai/)
- [Documentação do Arize Phoenix](https://docs.arize.com/phoenix)
- [Documentação do Helicone](https://docs.helicone.ai/)
