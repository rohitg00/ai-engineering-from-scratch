---
name: load-test-plan
description: Projete um teste de carga LLM realista - escolha uma ferramenta (LLMPerf, k6, GenAI-Perf, guidellm), construa quatro padrões (estável, rampa, pico, absorção) e portão em CI.
version: 1.0.0
phase: 17
lesson: 22
tags: [load-testing, llmperf, k6, genai-perf, guidellm, llm-locust, ci-gate]
---

Dada a carga de trabalho (ponto final, SLA para TTFT/TPOT/erro), escala alvo (simultaneidade, RPS) e postura CI (portão PR ou somente liberação), produza um plano de teste de carga.

Produzir:

1. Ferramenta. LLMPerf para execuções de linha de base; k6 + extensão de streaming para portas CI; GenAI-Perf para execuções de referência NVIDIA; guidellm para grandes sintéticos. LLM-Locust somente se já estiver no Locust.
2. Distribuição imediata. Média + tokens de entrada stddev de tráfego real (se disponível) ou distribuição publicada (ShareGPT/HumanEval). Proibir loop com um prompt.
3. Quatro padrões. Firme, rampa, pico, imersão. Para cada um: RPS alvo, duração, modo de falha esperado.
4. Porta CI. Limites específicos: TTFT P95 < X, 5xx < 5%, TPOT < Y. Tempo de execução por PR: 3-5 min.
5. Alinhamento métrico. Observe se a ferramenta de relatório é do estilo GenAI-Perf (ITL exclui TTFT) ou estilo LLMPerf (ITL inclui TTFT). Escolha um e seja consistente.
6. Saída. Um arquivo de script (k6 JS, LLMPerf CLI) confirmado no repositório.

Rejeições difíceis:
- Teste de carga com prompts uniformes. Recuse – os números mentem.
- Teste de carga sem suporte de streaming. Recusar – os endpoints LLM são transmitidos por padrão.
- Comparar números entre ferramentas sem reconhecer diferenças de definição de métricas. Recusar.

Regras de recusa:
- Se a equipe pretende operar com estoque Locust sem extensão LLM-Locust, recuse - armadilha GIL.
- Se o orçamento do gate do CI for < 60s por PR, recuse a absorção total — proponha um estado estacionário rápido mais uma absorção noturna separada.
- Se os dados de distribuição imediata não estiverem disponíveis, exija uma distribuição publicada documentada (ShareGPT) e observe a suposição.

Resultado: um plano de uma página com ferramenta, distribuição imediata, quatro padrões com metas, limites de porta CI, alinhamento de métricas. Termine com a saída CI única: PR verde somente se todos os limites forem atendidos, estabilidade em 3 execuções.