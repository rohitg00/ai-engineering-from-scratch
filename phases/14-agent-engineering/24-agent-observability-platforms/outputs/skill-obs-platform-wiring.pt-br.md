---
name: obs-platform-wiring
description: Pick an observability platform (Langfuse, Phoenix, Opik, Datadog) and wire traces + evals + prompt versions into an existing agent.
version: 1.0.0
phase: 14
lesson: 24
tags: [observability, langfuse, phoenix, opik, datadog, tracing]
---
---
name: obs-platform-wiring
description: Pick an observability platform (Langfuse, Phoenix, Opik, Datadog) and wire traces + evals + prompt versions into an existing agent.
version: 1.0.0
phase: 14
lesson: 24
tags: [observability, langfuse, phoenix, opik, datadog, tracing]
---

Dado o tempo de execução do agente e os requisitos do produto, escolha uma plataforma de observabilidade e monte a fiação.

Decisão:

1. Precisa de gerenciamento imediato + reprodução de sessão em um só lugar -> **Langfuse**.
2. Precisa de profunda relevância RAG + detecção de desvios/anomalias -> **Phoenix**.
3. Precisa de otimização automatizada de prompts + proteções de PII -> **Opik**.
4. Já execute o Datadog -> **Datadog LLM Observability** (mapeia GenAI nativamente a partir da v1.37+).
5. Precisa de licença livre de ELv2 -> **Langfuse** (MIT) ou **Opik** (Apache 2.0); evite Phoenix para distribuição pura de OSS.

Produzir:

1. Instrumentação OTel GenAI (Lição 23) — este é o substrato comum.
2. Configuração do SDK específico da plataforma ou do exportador OTel.
3. Rubrica do juiz LLM para o seu domínio (correção factual, escopo, tom, qualidade da recusa).
4. Controle de versão de prompt conectado a rastreamentos (Langfuse) ou configuração de clustering de rastreamento (Phoenix) ou definições de experimento (Opik).
5. Proteção ao conteúdo registrado: redação de PII, limpeza de segredos.
6. Dashboards: estado da sessão, taxonomia de falhas, distribuição de latência, custo por sessão.

Rejeições difíceis:

- Envio sem avaliações. O rastreamento por si só é um registro caro.
- Usando um juiz LLM escrito por ele mesmo, sem verificação externa. Padrão CRÍTICO (Lição 05): os juízes necessitam de ferramentas externas para fundamentação factual.
- Armazenamento de PII em corpos span. Sempre loja externa + IDs de referência.

Regras de recusa:

- Se o usuário solicitar “uma plataforma para tudo”, recuse e ofereça a decisão acima. Nenhuma plataforma domina todos os três eixos.
- Se o produto não tiver critérios de aceitação para cada tarefa do agente, recuse o envio de avaliações. Um juiz LLM precisa de uma rubrica; uma rubrica precisa de decisões sobre produtos.
- Se o usuário quiser “sem amostragem, capture tudo”, recuse. O volume de rastreamento é dimensionado linearmente com o tráfego; a amostragem (baseada na cabeça ou na cauda) é necessária em escala.

Resultado: `instrumentation.py`, `judge.py`, `dashboards.md`, `README.md` explicando a escolha da plataforma, rubrica, estratégia de amostragem e resposta a incidentes. Termine com "o que ler a seguir" apontando para a Lição 30 (desenvolvimento orientado à avaliação) ou Lição 26 (taxonomia do modo de falha).