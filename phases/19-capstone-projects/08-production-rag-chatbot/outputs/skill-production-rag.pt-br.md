---
name: production-rag
description: Implante um chatbot RAG de domínio regulamentado com filtragem de função + jurisdição, cache de prompt, proteções e monitoramento de desvio em tempo real.
version: 1.0.0
phase: 19
lesson: 08
tags: [capstone, rag, chatbot, regulated, llama-guard, nemo-guardrails, ragas, langfuse]
---

Dado um corpus de domínio regulamentado (contratos legais, protocolos de ensaios clínicos, apólices de seguro ou similares), implante um chatbot que responda com citações verificáveis, respeite as políticas de acesso à função e à jurisdição e seja monitorado quanto a desvios.

Plano de construção:

1. Analisar o corpus com documentação ou não estruturado; encaminhe documentos visualmente ricos através do ColPali. Emita pedaços com rótulos de função e jurisdição.
2. Indexar denso (Voyage-3 ou Nomic-embed-v2) em pgvector + pgvectorscale; BM25 esparso via Tantivy.
3. Agente conversacional Wire LangGraph: recuperação (filtro por função + jurisdição, híbrido denso + BM25, fusão de classificação recíproca), reclassificação (bge-reranker-v2-gemma-2b ou Voyage rerank-2), sintetizador (Claude Sonnet 4.7 com cache imediato).
4. Monte prompts com prefixos estáveis: preâmbulo do sistema -> bloco de política -> contexto reclassificado -> consulta do usuário. Almeje uma taxa de acerto de cache de prompt de 60-80%.
5. Guardrails: Llama Guard 4 na entrada e saída, NeMo Guardrails v0.12 rails para perguntas fora do domínio e proibidas por política, limpeza Presidio PII na saída, pós-filtro de aplicação de citações.
6. Construa um conjunto dourado de 200 perguntas rotulado por especialistas com (resposta, citações). Pontuação na correspondência de citação exata, resposta correta, fidelidade RAGAS.
7. Construa uma equipe vermelha de 50 prompts (PAIR, TAP, extração de PII, sondagens fora do domínio e entre jurisdições).
8. Painel de derivação do Arize Phoenix, rastreamento de recuperação nDCG e fidelidade de citação semanalmente; alerta sobre queda de 5%.
9. Relatório de custos do Langfuse: taxa de acertos do prompt-cache, tokens por consulta, $/consulta por estágio.

Rubrica de avaliação:

| Peso | Critério | Medição |
|:-:|---|---|
| 25 | Fidelidade RAGAS + relevância da resposta | Pontuações online no conjunto dourado de 200 perguntas |
| 20 | Correção de citação | Fração de respostas com âncoras de origem verificáveis ​​|
| 20 | Cobertura de guarda-corpo | Taxa de aprovação do Llama Guard 4 + resultado do conjunto de jailbreak |
| 20 | Engenharia de custo/latência | Taxa de acerto do cache de prompt, latência p95, $/consulta |
| 15 | Painel de monitoramento de deriva | Painel Live Phoenix com tendência semanal de qualidade de recuperação |

Rejeições difíceis:

- Qualquer chatbot que vaze dados entre jurisdições. A filtragem de função+jurisdição deve ser aplicada antes da recuperação, não depois.
- Prompts de síntese que quebram prefixos de cache (política de reordenação entre sistema e contexto). Destruirá a economia do cache.
- Configurações do Guardrail sem execuções registradas do red-team.
- Respostas sem citações; citações sem âncoras verificáveis.

Regras de recusa:

- Recuse-se a implantar em um domínio regulamentado sem tags de jurisdição em cada parte.
- Recuse-se a treinar a recuperação em questões do conjunto dourado rotuladas por especialistas. A contaminação destrói a credibilidade da avaliação.
- Recuse-se a reivindicar "conformidade" sem uma matriz de aplicabilidade SOC2/HIPAA/GDPR explícita no README.

Saída: um repositório contendo o pipeline de ingestão, o agente de conversação LangGraph, o conjunto dourado de 200 perguntas, a equipe vermelha de 50 prompts, o painel de desvio do Phoenix, o painel de custos do Langfuse e um artigo nomeando os três principais padrões de quebra de citação que você observou e a recuperação ou correção imediata para cada um.