---
name: search-policy
description: Escolha uma estratégia de pesquisa (ReAct, ToT, LATS, evolucionária) de acordo com o formato da tarefa, o orçamento de tokens e a qualidade do avaliador.
version: 1.0.0
phase: 14
lesson: 04
tags: [tree-of-thoughts, lats, mcts, search, value-function]
---

Dado um formato de tarefa (resposta única/resposta múltipla/aberta), um orçamento de token e um avaliador disponível (teste escalar/heurística/autoavaliação), produza uma recomendação de estratégia de busca com parâmetros concretos.

Produzir:

1. Decisão. Um dos seguintes: ReAct linear, feixe ToT (com largura de feixe k), BFS ToT (com profundidade máxima), DFS ToT com poda, MCTS LATS (com iterações e UCT c), pesquisa evolutiva (somente se o avaliador for programático e verificável).
2. Parâmetros. Para cada estratégia, padrões numéricos concretos: largura da viga, limite de profundidade, fator de ramificação K, implementações por nível, UCT c (padrão 1.4), tempo limite.
3. Função de valor. Especifique exatamente o que pontua um nó. Opções: taxa de aprovação no teste unitário, distância numérica até o alvo, pontuação LLM solicitada com formato (certo/provável/impossível ou 1..10 ou voto) ou recompensa ambiental.
4. Estimativa de orçamento simbólico. Tokens de pior caso = branching_factor ^ profundidade * avg_prompt_tokens. Mostre o número. Caso ultrapasse o orçamento do usuário, recomende uma estratégia mais barata.
5. Modos de falha. Para cada estratégia escolhida, liste os dois principais modos de falha e suas mitigações (por exemplo, LATS + avaliador ruidoso -> adicione verificação baseada em ferramenta de acordo com CRITIC, Lição 05).

Rejeições difíceis:

- Recomendar pesquisa quando o avaliador não for confiável (apenas autoavaliação, sem informações básicas). Volte para ReAct + CRITIC.
- Definir o fator de ramificação K superior a 5 sem motivo convincente. K=3-5 é o padrão do papel; K = 10 explode o custo.
- Aplicação do LATS em tarefas estilo chat. A pesquisa não oferece suporte a perguntas e respostas conversacionais sem objetivo programático.
- Pesquisa evolutiva sem aptidão verificável por máquina. AlphaEvolve só é interessante quando o condicionamento físico é programático (executar testes, medir velocidade, verificar teorema).

Regras de recusa:

- Se orçamento de token < 5x custo de trajetória única, recuse a pesquisa e recomende ReAct + Reflexion (Lição 03).
- Se o orçamento de latência do relógio for < 10 segundos, recuse o LATS e recomende o ReAct.
- Se a tarefa for pura recuperação de informação, recuse a busca e recomende o ReWOO (Lição 02).

Resultado: um bloco de recomendação (estratégia escolhida, parâmetros, função de valor, estimativa de orçamento) mais uma nota "o que ler a seguir" apontando para a Lição 05 (CRITIC) para confiabilidade do avaliador, Lição 11 (AlphaEvolve) para variantes evolutivas ou Lição 30 (desenvolvimento orientado à avaliação) para validação de nota de referência.