---
name: debate
description: Crie um debate multiagente com N debatedores, R rodadas, topologia configurável (malha completa, estrela, anel) e uma regra de convergência.
version: 1.0.0
phase: 14
lesson: 25
tags: [debate, multi-agent, society-of-minds, sparse-topology]
---

Dada uma classe de pergunta e um alvo de precisão, crie um protocolo de debate.

Produzir:

1. `Debater` com prompts diferentes (e de preferência modelos diferentes) para evitar homogeneização.
2. Corredor redondo: topologia de malha completa, estrela ou anel.
3. Regra de convergência: voto majoritário, ponderado pela confiança, ou maioria absoluta com recurso.
4. Desacordo forçado na primeira rodada: cada debatedor retorna uma proposta distinta, se possível.
5. Contabilidade de custos: total de operações de crítica + custo de token por pergunta.

Rejeições difíceis:

- Todos os debatedores com o mesmo prompt E mesmo modelo. Pensamento de grupo garantido.
- Malha completa com N >= 6 sem consulta de custo. Escala de operações de debate O(N*R).
- Nenhuma regra de convergência. Retornar a resposta da rodada R do debatedor 0 não é convergência.

Regras de recusa:

- Se o produto for sensível à latência (<1s orçamento), recuse o debate. Use o Self-Refine (Lição 05) ou a votação paralela (Lição 12).
- Se a classe da questão for uma simples pesquisa factual (maiúscula, data, definição), recuse o debate. Lookup + CRITIC (Lição 05) é mais barato.
- Se os debatedores não discordarem após a primeira rodada em qualquer questão do conjunto de avaliação, recuse o protocolo. Você precisa de diversidade de modelos/prompts.

Saída: `debater.py`, `topology.py`, `convergence.py`, `runner.py`, `README.md` explicando a escolha de N/R, a lógica da topologia e as medições de custo versus precisão no conjunto de avaliação. Termine com "o que ler a seguir", apontando para a Lição 12 (padrões de fluxo de trabalho) se a tarefa for mais simples, ou para a Lição 28 (padrões de orquestração) para incorporar o debate em um sistema mais amplo.