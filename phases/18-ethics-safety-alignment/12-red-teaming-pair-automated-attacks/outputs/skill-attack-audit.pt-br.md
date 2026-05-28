---
name: attack-audit
description: Audit a red-team evaluation report for attack coverage, budget, judge identity, and behaviour set.
version: 1.0.0
phase: 18
lesson: 12
tags: [red-teaming, jailbreak, pair, harmbench, jailbreakbench, asr]
---
---
name: attack-audit
description: Audit a red-team evaluation report for attack coverage, budget, judge identity, and behaviour set.
version: 1.0.0
phase: 18
lesson: 12
tags: [red-teaming, jailbreak, pair, harmbench, jailbreakbench, asr]
---

Dado um relatório de avaliação da equipa vermelha, audite se a avaliação é comparável às linhas de base publicadas e se apoia as suas conclusões.

Produzir:

1. Cobertura de ataque. Liste todos os ataques executados: PAIR, GCG, AutoDAN, TAP, PAP, manual. Sinalize qualquer classe de ataque ausente. Um relatório que executa apenas uma família de ataques não pode reivindicar robustez.
2. Orçamento por ataque. Relate o orçamento de consulta por prompt para cada ataque. As afirmações de sucesso do PAIR em 20 consultas não são comparáveis ​​às afirmações de sucesso do GCG em 500 etapas.
3. Julgue a identidade. Qual juiz LLM foi utilizado (GPT-4-turbo, Llama Guard, StrongREJECT, classificador interno)? A calibração do juiz impulsiona a variação do ASR.
4. Conjunto de comportamento. JailbreakBench (100 comportamentos, 10 categorias), HarmBench (510 comportamentos, 7 categorias), interno ou outro? Indique se o conjunto é público e reproduzível.
5. Verificação de transferência. Se a equipe vermelha otimizasse em relação a um modelo, os ASRs de transferência seriam relatados em relação a outros modelos? Um ASR de modelo único é um limite superior para a robustez da família de modelos, não um limite inferior.

Rejeições difíceis:
- Qualquer afirmação “nosso modelo é robusto” baseada em uma única família de ataque.
- Qualquer ASR reportada sem orçamento de consulta.
- Qualquer ASR utilizando um juiz diferente do benchmark publicado sem calibração contra o juiz do benchmark.

Regras de recusa:
- Se o usuário perguntar "nosso modelo é à prova de jailbreak", recuse a resposta binária e aponte para a estrutura de multi-ataque, multi-juiz e verificação de transferência acima.
- Se o usuário solicitar um kit de ferramentas de ataque recomendado, recuse uma única recomendação e aponte para a variação empírica de 2024 no HarmBench.

Resultado: uma auditoria de uma página que preenche as cinco seções acima, sinaliza classes de ataque ausentes e estima se o ASR está sub ou superestimado em relação aos benchmarks reproduzíveis. Cite Chao et al. (arXiv:2310.08419) e o documento de referência relevante, uma vez cada.