---
name: observability-stack
description: Escolha uma pilha de observabilidade LLM (plataforma de desenvolvimento + gateway + camada de escala opcional) dada a pilha, escala, orçamento e postura de licença, e defina o conjunto de atributos OpenTelemetry GenAI.
version: 1.0.0
phase: 17
lesson: 13
tags: [observability, langfuse, langsmith, phoenix, arize, helicone, opik, opentelemetry, genai-conventions]
---

Dada a pilha (LangChain/DSPy/SDK bruto), escala (rastreamentos/dia), orçamento, postura de licença (apenas MIT vs OK comercial) e requisitos de auto-hospedagem, produza um plano de observabilidade.

Produzir:

1. Escolha da plataforma de desenvolvimento. Langfuse (OSS), LangSmith (primeiro comercial do LangChain), Opik (Comet OSS) ou nenhum. Justifique com pilha e licença.
2. Escolha de gateway/telemetria. Helicone (proxy + gateway), SigNoz (APM completo), OpenLLMetry (OTel puro). Se já estiver usando um gateway de IA (Fase 17 · 19), dê um nome à integração.
3. Camada de escala/lago. Opcional; Arize AX ou Iceberg bruto para análises de longo prazo, Phoenix para desvio RAG.
4. Convenções OTel GenAI. Especifique o conjunto mínimo de atributos: `gen_ai.system`, `gen_ai.request.model`, `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, `gen_ai.request.temperature`, `gen_ai.response.finish_reasons`, além de específico da organização (tenant_id, user_id, task).
5. Política de amostragem. 100% de erros, 100% de alto custo (>US$ 0,10/chamada), taxa de amostragem de sucesso de N%. Janela de retenção bruta (14d/30d/90d). Agregados retidos por mais tempo.
6. Alerta. Cinco métricas que devem ter alertas: taxa de erros, P99 TTFT, custo/solicitação, taxa de acertos do prompt-cache, taxa de recusa.

Rejeições difíceis:
- Instrumentação dentro do SDK específico da estrutura sem um substituto do OTel. Recusar – aprisionamento da estrutura.
- Manter 100% dos rastreamentos com preços de classe Datadog >US$ 500/mês para uma carga de trabalho não regulamentada. Recusar – recomendar amostragem.
- Ignorando as convenções do OpenTelemetry GenAI. Recuse – a interoperabilidade 2026 exige isso.

Regras de recusa:
- Se rastreamentos/dia > 5M e a equipe insistir na retenção total do Datadog, recuse sem previsão de custos.
- Se a equipe for apenas do MIT e escolher LangSmith, recuse - Langfuse é o equivalente do MIT.
- Se a equipe não tiver gateway de IA e escolher o Helicone como gateway E observabilidade, aceite - o proxy funciona como gateway até ~500 RPS (Fase 17 · 19 cobre a escala do gateway).

Saída: um plano de uma página nomeando plataforma de desenvolvimento, gateway, camada de escala (se houver), conjunto de atributos OTel, regra de amostragem, cinco alertas. Termine com a única métrica que sinaliza o desvio da pilha: porcentagem de chamadas LLM com atributos OTel GenAI completos nos últimos 7 dias.