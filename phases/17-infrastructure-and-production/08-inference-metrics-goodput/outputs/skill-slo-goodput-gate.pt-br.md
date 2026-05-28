---
name: slo-goodput-gate
description: Produza uma receita de benchmark pronta para CI/CD que controle as implantações de LLM com bom rendimento, não com rendimento, com percentis P50/P90/P99 e uma escolha de ferramenta documentada.
version: 1.0.0
phase: 17
lesson: 08
tags: [inference-metrics, goodput, ttft, tpot, itl, slo, benchmarking]
---

Dada uma carga de trabalho (modelo, hardware, simultaneidade de destino, tipo de interação voltada ao usuário — chat de streaming/one-shot/voz/agente), produza uma porta SLO baseada em goodput para CI/CD.

Produzir:

1. Especificação de SLO. Três limites: limite TTFT P99, limite TPOT P99, limite E2E P99. Escolha valores defensáveis ​​do tipo de interação (streaming chat: TTFT 500 ms, TPOT 25 ms, E2E 3 s; voz: TTFT 300 ms mais apertado; agente: E2E 5 s mais solto).
2. Receita de referência. Escolha da ferramenta (LLMPerf ou GenAI-Perf - indique aquela que você escolheu e por quê). Distribuição imediata (média + desvio padrão dos tokens de entrada e saída). Varredura de simultaneidade (25%, 50%, 100%, 150% do alvo).
3. Cálculo de Goodput. Fórmula: fração de solicitações que atendem às três restrições simultaneamente. Meta >= 99% para produção, >= 95% para canário.
4. Relatórios de percentil. Para cada métrica, relate P50, P90, P99 (nunca signifique sozinho). Anotar significa apenas para verificação de integridade.
5. Nota sobre armadilha de ferramenta. Indique se a ferramenta inclui ou exclui o TTFT do ITL. Corrija a definição antes de comparar as equipes.
6. Lógica de portas. CI passa se goodput >= alvo AT simultaneidade de destino. Sinaliza se o goodput degrada mais de 5 pontos entre 100% e 150% de simultaneidade — indica que falta espaço para teste de carga.

Rejeições difíceis:
- Limitando apenas a taxa de transferência. Recuse e exija goodput.
- Média de relatórios sem P99. Recusar.
- Omissão do nome e da versão da ferramenta. Recusar.
- Benchmarking apenas na simultaneidade alvo; sempre faça a varredura.

Regras de recusa:
- Se o usuário não tiver nenhum SLO anotado, recuse e primeiro escreva um com base no tipo de interação.
- Se a distribuição de prompts for "prompts idênticos em um loop", recuse - esta é uma armadilha de uniformidade de prompts. Exigir sintético realista.
- Se o benchmark for <30 execuções ou <100 solicitações por execução, recusar como estatisticamente insuficiente.

Resultado: uma especificação de portão de SLO de uma página listando limites, receita de benchmark, escolha de ferramenta, modelo de relatório de percentil e a regra de aprovação/reprovação do CI. Termine com um parágrafo "o que medir a seguir", nomeando uma curva de goodput versus curva de simultaneidade, sensibilidade de distribuição imediata ou comparação de pré-preenchimento fragmentado on/off tail, dependendo da fraqueza conhecida.