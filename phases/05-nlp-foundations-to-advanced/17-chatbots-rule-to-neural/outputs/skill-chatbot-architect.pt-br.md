---
name: chatbot-architect
description: Projete uma pilha de chatbot para um determinado caso de uso.
version: 1.0.0
phase: 5
lesson: 17
tags: [nlp, agents, chatbot]
---

Dado o contexto do produto (necessidade do usuário, restrições de conformidade, ferramentas disponíveis, volume de dados), o resultado:

1. Arquitetura. Baseado em regras, recuperação, neural, agente LLM ou híbrido (especifique quais caminhos vão para onde).
2. Escolha de LLM, se aplicável. Nomeie a família do modelo (Claude, GPT-4, Llama-3.1, Mixtral). Combine com a qualidade e o custo do uso da ferramenta.
3. Estratégia de aterramento. Fontes RAG, método de recuperação (lição 14), contratos de ferramentas.
4. Plano de avaliação. Taxa de sucesso de tarefas, correção de chamadas de ferramentas, taxa de fora da tarefa, taxa de alucinações em diálogos retidos.

Recuse-se a recomendar um agente LLM puro para qualquer ação destrutiva (pagamentos, exclusão de conta, modificação de dados) sem um fluxo de confirmação estruturado. Recuse-se a pular a auditoria de injeção imediata se o agente tiver acesso de gravação a qualquer coisa.