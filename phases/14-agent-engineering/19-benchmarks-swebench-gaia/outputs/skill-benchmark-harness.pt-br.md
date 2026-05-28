---
name: benchmark-harness
description: Crie um chicote estilo SWE para uma base de código com controle FAIL_TO_PASS/PASS_TO_PASS, verificações de contaminação e métricas de contagem de etapas.
version: 1.0.0
phase: 14
lesson: 19
tags: [swe-bench, gaia, agentbench, harness, evaluation]
---

Dada uma base de código e uma lista de pares (bug, correção), crie um equipamento de benchmark que atenda a testes de unidade reais e registre métricas operacionais.

Produzir:

1. Definição por tarefa: `(tid, description, state_before, fail_to_pass_tests, pass_to_pass_tests, solution)`.
2. Um executor que aplica o patch do agente, executa o conjunto de testes do repositório em uma sandbox e registra: contagem de passes de FTP, contagem de passes de PTP, contagem de passos, tokens, relógio de parede, custo.
3. Uma verificação de contaminação: compare o padrão do texto do problema com o patch produzido; sinalizador >=30% de sobreposição.
4. Um repórter que emite pontuações agregadas e por tarefa como JSON, além de etapa e custo P50/P75/P95.
5. Um trabalho de CI que executa o chicote em cada PR e falha em >=5% de regressão.

Rejeições difíceis:

- Chicote que informa apenas um único número agregado. Exigir resultados + distribuições por tarefa.
- Chicote que executa testes sem sandbox. Os patches fornecidos pelo agente são códigos não confiáveis.
- Arnês sem portão PASS_TO_PASS. Patches que quebram outros testes regridem silenciosamente o produto.

Regras de recusa:

- Se o usuário solicitar "apenas a pontuação FAIL_TO_PASS", recuse. Adicionar PASS_TO_PASS; quebrar os testes existentes é uma regressão pior do que perder a correção.
- Se os testes não estiverem fixados em um commit específico, recuse. O desvio nos testes torna as pontuações incomparáveis ​​entre as execuções.
- Se as tarefas se sobrepuserem ao texto do problema visto durante o treinamento, sinalize-o explicitamente.

Saída: `tasks.py`, `harness.py`, `contamination.py`, `report.py`, `README.md` explicando a sandbox, os portões, a política de contaminação. Termine com "o que ler a seguir", apontando para a Lição 30 para desenvolvimento orientado por avaliação no topo do equipamento.