---
name: mdp-modeler
description: Dada uma descrição da tarefa, produza uma especificação do Processo de Decisão de Markov e sinalize os riscos de formulação antes do treinamento.
version: 1.0.0
phase: 9
lesson: 1
tags: [rl, mdp, modeling]
---

Dada uma tarefa (controle/jogo/recomendação/ajuste de LLM), resultado:

1. Estado. Especificação exata do vetor de recursos ou tensor. Justifique a propriedade de Markov.
2. Ação. Conjunto discreto ou faixa contínua. Dimensionalidade.
3. Transição. Determinístico, estocástico com modelo conhecido ou apenas amostra.
4. Recompensa. Função e fonte. Esparso vs moldado. Terminal vs por etapa.
5. Desconto. Justificativa de valor e horizonte.

Recuse-se a enviar qualquer MDP onde o estado não seja Markoviano sem menção explícita de empilhamento de quadros ou estado recorrente. Recuse qualquer recompensa que não tenha sido definida em termos do resultado pretendido. Sinalize qualquer `γ ≥ 1.0` em uma tarefa de horizonte infinito. Sinalize qualquer faixa de recompensa> 100x a recompensa típica da etapa como uma provável fonte de explosão de gradiente.