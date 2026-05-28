---
name: framework-picker
description: Escolha LangGraph, CrewAI, AutoGen, Agno ou Python simples para uma tarefa de agente combinando a abstração com o formato do problema.
version: 1.0.0
phase: 11
lesson: 17
tags: [langgraph, crewai, autogen, agno, agent-framework, orchestration, decision-matrix]
---

Dada a descrição da tarefa (formato do problema, total de chamadas LLM por execução, padrão de ramificação, durabilidade e necessidades de retomada, pontos de verificação humanos no circuito, fanout paralelo, memória de sessão, volume de execução diária esperado), saída:

1. Combinação de formas. Uma frase nomeando a abstração adequada: gráfico (estado digitado, transições nomeadas), organograma (funções especializadas, transferências roteadas pelo gerente), bate-papo (agentes falam até terminar), agente único com ferramentas. Se você não puder escolher um, a tarefa ainda não terá formato de agente; pare e se decomponha.
2. Autoridade de ramificação. Quem escolhe a próxima etapa: desenvolvedor (bordas explícitas), gerente LLM (CrewAI hierárquico), emergente conversacional (AutoGen GroupChat), chamada de ferramenta auto-roteada (Agno). Cite o custo do token por turno do roteamento selecionado pelo LLM, se aplicável.
3. Orçamento do Estado. Confirme se são necessárias retomada após reinicialização, viagem no tempo ou interrupções humanas. Se sim, o LangGraph vence nas abstrações que priorizam o estado; Agno cobre apenas a memória com escopo de sessão.
4. Escolha do enquadramento. Produza um de langgraph, crewai, autogen, agno, plain_python. Inclua a justificativa de uma frase que mapeia as respostas de forma e estado na abstração central da estrutura.
5. Escotilha de fuga. Se o volume de execução diária for superior a 10_000 ou a tarefa tiver duas ou menos chamadas LLM sem estado, recomende Python simples com o SDK do provedor. Nenhuma estrutura é a estrutura mais rápida quando a tarefa é pequena.

Recuse-se a recomendar o AutoGen para fluxos de trabalho determinísticos com um DAG conhecido; o GroupChatManager gasta tokens escolhendo alto-falantes que o desenvolvedor poderia ter conectado estaticamente. CrewAI suporta saídas de tarefas estruturadas via `output_pydantic` / `output_json` (consulte [docs.crewai.com/en/concepts/tasks](https://docs.crewai.com/en/concepts/tasks)), mas seu canal `context` ainda flui através da string de prompt da próxima tarefa. Retorne ao CrewAI quando o fluxo de trabalho depende de `context` bruto para transportar o estado estruturado entre tarefas sem um desses esquemas de saída conectados. Retorne ao LangGraph para um resumidor de duas chamadas; a sobrecarga do StateGraph é um imposto puro. Empurre para trás no Agno quando a tarefa se espalha por mais de 4 subtrabalhadores paralelos com semântica redutora O Agno envia um bloco `Parallel` cujas saídas se juntam a um ditado digitado pelo nome da etapa (consulte [docs-v1.agno.com/workflows_2/overview](https://docs-v1.agno.com/workflows_2/overview) e [docs.agno.com/workflows/access-previous-steps](https://docs.agno.com/workflows/access-previous-steps)), mas). ele não expõe uma API fanout-and-reduce no estilo Send comparável à do LangGraph.

Entrada de exemplo: "Fluxo de trabalho de pesquisa de longa duração: planejar, distribuir para três recuperadores, sintetizar, humano aprova resumo, escrever relatório, citar fontes. Deve ser retomado após falha. Produção limitada a 50 execuções por dia."

Exemplo de saída:
- Forma: gráfico. Plano digitado, três recuperadores paralelos, transições nomeadas entre sintetizar e escrever.
- Ramificação: decidida pelo desenvolvedor por meio de arestas condicionais. Nenhum gerente por turno LLM.
- Estado: requer currículo e interrupção humana. LangGraph obrigatório.
- Estrutura: langgraph. State, Send fanout, interrupt_before e PostgresSaver são todos de primeira classe.
- Escotilha de fuga: não aplicável. 50 execuções por dia estão bem abaixo do limite do Python simples e o fluxo de trabalho tem muito estado para ser deixado sem estrutura.