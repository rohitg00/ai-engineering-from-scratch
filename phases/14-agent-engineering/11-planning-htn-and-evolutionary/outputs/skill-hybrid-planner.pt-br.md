---
name: hybrid-planner
description: Crie um planejador híbrido – ChatHTN para planos comprovadamente sólidos, AlphaEvolve para pesquisa de código com um avaliador verificável por máquina – e escolha o caminho certo para o problema.
version: 1.0.0
phase: 14
lesson: 11
tags: [planning, htn, chathtn, alphaevolve, evolutionary-search]
---

Dada uma classe de problema (fluxo de trabalho vinculado a políticas versus otimização de código versus tarefa aberta), escolha um planejador e produza uma estrutura correta.

Decisão:

1. O problema tem pré-condições/políticas/restrições de agendamento? ->HTN (ChatHTN).
2. O problema tem uma função de aptidão determinística e verificável por máquina? -> Evolutivo (AlphaEvolve).
3. Nenhum dos dois? -> Procure ReAct (Lição 01) ou ReWOO (Lição 02).

Para HTN, produza:

1. Digite `Operator` com `preconditions`, `effects_add`, `effects_remove`.
2. Digite `Method` com `task`, `preconditions`, `subtasks`.
3. Um planejador que tenta métodos primeiro, recorre à decomposição LLM e armazena em cache decomposições LLM bem-sucedidas.
4. Uma etapa de validação que rejeita decomposições LLM que fazem referência a operadores ou métodos desconhecidos.

Para Evolucionário, produza:

1. Uma população inicial de programas candidatos.
2. Um avaliador determinístico que retorna uma aptidão escalar.
3. Um operador de mutação (orientado por LLM ou baseado em regras).
4. Um loop de seleção (manter top-k, mutar, repetir) com parada antecipada.

Rejeições difíceis:

- ChatHTN onde a saída LLM é aplicada diretamente sem validação do esquema do operador. A alegação de solidez falha.
- AlphaEvolve onde o avaliador chama um juiz LLM. A aptidão deve ser determinística; Os juízes do LLM introduzem ruído estocástico do qual o loop não consegue se recuperar.
- Qualquer padrão para tarefas abertas ("escrever uma postagem no blog"). Sem avaliador, sem pré-condições -> use ReAct.

Regras de recusa:

- Se o domínio não tiver um esquema de operador claro, recuse ChatHTN. Sugira ReWOO ou ReAct simples.
- Se o domínio não tiver aptidão verificável por máquina, recuse AlphaEvolve. Sugira o Auto-Refinamento (Lição 05).
- Se o usuário quiser que "o planejador + LLM faça a chamada final", recuse. A divisão entre a correção simbólica e a exploração do LLM é pesada.

Saída: `operators.py`, `methods.py`, `planner.py` (HTN) ou `evaluator.py`, `mutator.py`, `loop.py` (evolutivo), mais `README.md` com a justificativa da decisão. Termine com "o que ler a seguir" apontando para a Lição 25 se a verificação no estilo de debate se adequar ao problema, ou para a Lição 02 se a tarefa for realmente em formato ReWOO, afinal.