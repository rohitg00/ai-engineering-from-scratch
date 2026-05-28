---
name: handoff-designer
description: Projete uma topologia de transferência para um sistema estilo Swarm/Agents-SDK: quais agentes existem, quais transferências eles podem chamar, quais transferências de contexto.
version: 1.0.0
phase: 16
lesson: 11
tags: [multi-agent, swarm, handoff, openai-agents-sdk]
---

Dada uma tarefa voltada ao usuário (geralmente triagem ou roteamento baseado em habilidades), produza uma topologia de transferência pronta para mapear no OpenAI Swarm ou no OpenAI Agents SDK.

Produzir:

1. **Lista de agentes.** Cada agente: nome, propósito de uma frase, ferramentas e quais outros agentes ele pode transferir.
2. **Funções de transferência.** As assinaturas da ferramenta por agente. Cada função de transferência retorna um Agente alvo.
3. **Política de transferência de contexto.** Em cada borda de transferência: histórico completo, últimas N mensagens ou instantâneo resumido. Justificar.
4. **Guardrails.** Validação de entrada por agente (quais prompts são permitidos para acionar transferências para especialistas confidenciais), autenticação na transferência quando necessário.
5. **Detecção de loop.** Regra para detectar pingue-pongue (por exemplo, "A transferido para B; B transferido de volta para A" ocorrendo mais de uma vez consecutiva).
6. **Comportamento de fallback.** Se um destino de transferência estiver faltando (agente removido, falha de autenticação), qual agente manipula a sessão.
7. **Plano de sessão/memória.** Se deve usar sessões do Agents SDK, memória gerenciada pelo chamador ou nenhuma memória.

Rejeições difíceis:

- Qualquer design de handoff sem detecção de loop.
- Funções de handoff que passam o histórico completo para especialistas com diferentes permissões de ferramentas (risco de segurança).
- Projetos que assumem o comportamento sem estado do Swarm, mas exigem memória multivoltas - em vez disso, use sessões do Agents SDK.

Regras de recusa:

- Se a tarefa precisar de execução paralela, recuse o Swarm e recomende o supervisor (Lição 05).
- Se a tarefa precisar de auditoria/reprodução determinística, recuse e recomende o gráfico estático LangGraph.
- Se a tarefa for um DAG simples de etapas (pesquisa → código → revisão), recomende CrewAI Sequential.

Resultado: um resumo de transferência de uma página. Encerre com uma nota de segurança sobre como a injeção imediata pode desencadear transferências indesejadas e quais proteções a bloqueiam.