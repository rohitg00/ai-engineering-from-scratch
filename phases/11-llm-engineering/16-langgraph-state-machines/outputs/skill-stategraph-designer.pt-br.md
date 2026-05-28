---
name: stategraph-designer
description: Transforme uma tarefa de agente em um LangGraph StateGraph com nós nomeados, estado digitado, redutores, ponto de verificação e interrupções humanas.
version: 1.0.0
phase: 11
lesson: 16
tags: [langgraph, stategraph, checkpointer, interrupt, time-travel, react-agent, human-in-the-loop]
---

Dada a tarefa do agente (objetivo voltado para o usuário, ferramentas disponíveis, contagem de turnos esperada, efeitos colaterais com raio de explosão de segurança, requisitos de durabilidade, orçamento de latência alvo), resultado:

1. Lista de nós. Nomeie cada etapa discreta: o pensador LLM, cada executor de ferramentas, cada etapa de revisão humana, qualquer resumidor ou crítico, qualquer recuperador. Rejeite o projeto se algum nó tocar em mais de uma preocupação; dividi-lo.
2. Esquema de estado. Campos TypedDict (ou Pydantic) com um redutor para cada lista. Sempre anotado[lista, add_messages] no log de mensagens. Retire qualquer lista específica de tarefa das mensagens (um plano, um contador de orçamento, uma lista de documentos recuperados) para que os redutores permaneçam corretos em atualizações paralelas.
3. Mapa de borda. Arestas estáticas onde a próxima etapa é determinística. Arestas condicionais com um roteador nomeado funcionam apenas onde o modelo escolhe a próxima etapa. Rejeite qualquer gráfico cuja função de roteador dependa de uma nova chamada LLM que você ainda não tenha feito em um nó anterior.
4. Interromper a colocação. interrupt_before em cada nó com um efeito colateral irreversível (gravações, exclusões, pagamentos, chamadas externas de API com custo). interrupção_after no nó do modelo quando a validação de saída é executada em um processo separado. Rejeite interrupção_after em qualquer nó de efeito colateral; a essa altura, o efeito colateral já aconteceu.
5. Ponteiro de verificação. MemorySaver apenas para testes. Escolha entre PostgresSaver, SQLiteSaver, RedisSaver para qualquer ambiente que deva sobreviver a uma reinicialização. Confirme a estratégia thread_id (por usuário, por sessão, por conversa) e o TTL do ponto de verificação.

Recuse-se a enviar um LangGraph sem um checkpointer. Nenhum ponto de verificação significa nenhum currículo, nenhuma viagem no tempo, nenhuma repetição humana. Recuse-se a enviar um campo de mensagens sem add_messages; a segunda gravação substitui a primeira silenciosamente e metade da conversa desaparece. Recusar um gráfico cuja cada transição seja uma aresta condicional roteada por um planejador LLM; isto é AutoGen com etapas extras e queima tokens por turno.

Entrada de exemplo: "Agente de tratamento de reembolsos sobre Anthropic Claude com três ferramentas (lookup_order, issue_refund, send_email), deve fazer uma pausa para um humano antes de qualquer reembolso acima de 100 dólares, deve retomar após a reinicialização do servidor, orçamento de latência p95 de 8 segundos."

Exemplo de saída:
- Nós: agente (chamada LLM), lookup_tool, refund_tool, email_tool, human_review.
- Estado: mensagens com add_messages, order_context (sobrescrever), refund_amount (sobrescrever), reviewer_decision (sobrescrever).
- Edges: agente para roteador should_continue com ramificações lookup_tool, refund_tool, email_tool, human_review, END. Os nós da ferramenta voltam para o agente.
- Interrupções: interrupt_before em refund_tool quando refund_amount > 100. Sem interrupção em lookup_tool ou email_tool.
- Checkpointer: PostgresSaver com thread_id "user:{user_id}:case:{case_id}" e TTL de 30 dias.