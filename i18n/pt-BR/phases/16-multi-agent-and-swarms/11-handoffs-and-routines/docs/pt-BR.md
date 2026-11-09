# Transferências e rotinas  Orquestração sem Estado

> O Swarm (outubro de 2024) da OpenAI destila a orquestração multi-agente para dois primitivos: **routines**(instruções + ferramentas como um sistema de instrução) e **handoffs**(uma ferramenta que devolve outro agente). Não há máquina de Estado, não há DSL ramificante, as rotas de LLM chamando a ferramenta de transferência certa. O OpenAI Agents SDK (março 2025) é o sucessor da produção. O próprio enxame continua a ser a referência conceitual mais limpa. O padrão é viral porque a superfície da API é aproximadamente "agente = prompt + ferramentas; transferência = agente de devolução de função". Limitação: sem estado, então a memória é o problema do chamador.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 04 (Primitive Model)
**Time:** ~60 minutes

## Problemas

Cada framework multi-agente quer que você aprenda o seu DSL: nós e bordas de LangGraph, equipes e tarefas CrewAI, AutoGen GroupChat e gerentes. Os DSLs são abstrações reais, mas eles fazem a coisa sentir mais pesada do que precisa ser.

O grupo empurra na direção oposta: use a capacidade de chamada de ferramentas que o modelo já tem. As entregas se tornam chamadas de ferramentas. O orquestrador é o agente que atualmente mantém a conversa. A máquina de estado está implícita nas instruções do sistema dos agentes.

## Conceptos

### Dois primitivos

**Routine.**Um sistema de instruções que define o papel de um agente e as ferramentas disponíveis. Pense nisso como um conjunto de instruções com escopo: "você é um agente de triagem; se o usuário perguntar sobre reembolsos, entregue ao agente de reembolso".

**Handoff.**Uma ferramenta que o agente pode chamar que retorna um novo objeto do agente.

É toda a abstração.

```
def transfer_to_refunds():
    return refund_agent  # Swarm sees Agent return → switch active agent

triage_agent = Agent(
    name="triage",
    instructions="Route the user to the right specialist.",
    functions=[transfer_to_refunds, transfer_to_sales, transfer_to_support],
)
```

O pedido do sistema do agente de triagem faz com que ele escolha a transferência certa com base na mensagem do usuário.

### Por que é viral

- **Small API.**Dois conceitos a aprender.
- **Uses what the model already does.**A chamada de ferramentas já é de nível de produção entre os fornecedores.
- **No state-machine burden.**Não descreve o gráfico, as instruções dos agentes descrevem a quem entregam.

### O comércio sem Estado

O conjunto é explicitamente sem estatuto entre corridas. O framework mantém um histórico de mensagem durante uma corrida, mas não persiste nada. Memória, continuidade, tarefas de longa duração  todo o problema do chamador.

Na produção (OpenAI Agents SDK, março 2025) esta foi uma das principais coisas que mudou: o SDK adiciona gerenciamento de sessões incorporado, barris de segurança e rastreamento, mantendo a entrega primitiva.

### Quando o Enxame/Handoffs se encaixam

- **Triage patterns.**O agente da linha de frente encaminha o usuário para um especialista.
- **Skill-based handoffs.**"Se a tarefa precisa de código, ligue ao programador; se precisa de pesquisa, ligue ao pesquisador".
- **Short, bounded conversations.**Suporte ao cliente, FAQ-to-ticket, fluxos de trabalho simples.

### Quando o Enxame luta

- **Long sessions with shared memory.**As transferências resetaram o estado da conversa para o histórico de resposta do novo agente.
- **Parallel execution.**O Handoff é um-a-tempo  os agentes ativos alternam. Paralelamente requer que o chamador orquestre várias corridas Swarm.
- **Audit and replay.**As corridas sem estatuto são difíceis de repeti-las exatamente; a escolha de transferência do LLM não é determinista.

### O programa de desenvolvimento de agentes OpenAI (março 2025)

O sucessor da produção acrescenta:

- **Session state.**Fios persistentes em corridas.
- **Guardrails.**Anéis de validação de entrada/saída.
- **Tracing.**Todas as chamadas e transferências de ferramentas estão registradas.
- **Handoff filters.**Controlar o que o contexto transfere na transferência.

O primitivo de entrega sobrevive; a ergonomia da produção é adicionada ao seu redor.

### Swarm vs GroupChat

Ambos usam o roteamento orientado para o LLM, mas diferem em**who picks next**- Não .

- GrupoChat: um selector (função ou LLM) escolhe o próximo orador de fora.
- O agente atual escolhe o seu sucessor chamando uma ferramenta de transferência.

Swarm é "agente decide o que é o próximo"; GroupChat é "gerente decide o que é o próximo". A decisão de Swarm vive na chamada de ferramenta do agente ativo; GroupChat vive no `GroupChatManager`- Não .

```figure
sw-handoff-routing
```

## Construí-lo

`code/main.py`Implementa o Swarm desde o zero: uma classe de dados do agente, um mecanismo de transferência (outil retorna o agente) e um loop de execução que detecta os switches do agente.

Demo: um agente de triagem rotas para reembolso, vendas ou especialistas de suporte. Cada especialista tem suas próprias ferramentas.

- Correr .

```
python3 code/main.py
npx tsx code/main.ts
```

## Usá-lo

`outputs/skill-handoff-designer.md`Designa uma topologia de transferência para uma determinada tarefa: quais agentes existem, quais transferências podem ser chamadas, quais transferiam o contexto.

## Envia-o

Lista de verificação:

- **Handoff logging.**Cada transferência escreve um evento de rastreamento com um snapshot de agente para agente, contexto.
- **Context transfer rules.**Decida o que se move na transferência: histórico completo (caros), últimas N mensagens, ou um resumo.
- **Guardrail on handoff.**Uma entrega a um especialista com diferentes permissões de ferramenta deve ser autenticada  caso contrário, a injecção imediata pode forçar a entrega indesejada.
- **Loop detection.**Dois agentes que se entregam é uma falha comum; detecta com uma simples verificação de anel de última K.
- **Fallback agent.**Se não existir um alvo de transferência, volte a um padrão seguro.

## Exercícios

1. Corra .`code/main.py`Confirme que o agente ativo da segunda volta é o reembolso.
2. Adicione uma regra de detecção de circuito: se os mesmos dois agentes tiverem dado 3 vezes seguidas, forçar uma saída.
3. Leia os documentos do OpenAI Agents SDK sobre filtros de entrega. Implemente uma versão "summarise-on-handoff": o agente de saída comprime o contexto para um resumo de bala antes que o agente de entrada assuma.
4. Compare a transferência do Swarm com um selector do GroupChatManager.
5. Leia o livro de cozinha do "Swarm" (https://developers.openai.com/cookbook/examples/orchestrating_agentsO Swarm faz que o SDK OpenAI Agents seja alterado ou mantido.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Routine | "The agent prompt" | System prompt + tool list. Defines role and available handoffs. |
| Handoff | "Transfer to another agent" | A tool the active agent can call that returns a new Agent. The runtime switches active agent. |
| Stateless | "No memory between runs" | Swarm does not persist anything; memory is the caller's responsibility. |
| Active agent | "Who's speaking now" | The agent currently holding the conversation. Handoff changes this. |
| Context transfer | "What moves on handoff" | Policy for what history the incoming agent sees: full, last N, or summarized. |
| Handoff loop | "Agents ping-pong" | Failure mode where two agents keep handing back to each other. |
| OpenAI Agents SDK | "Production Swarm" | March 2025 successor; adds sessions, guardrails, tracing on top of the handoff primitive. |
| Handoff filter | "Gate on transfer" | SDK feature to inspect and modify context at the handoff boundary. |

## Mais leitura

- [OpenAI cookbook — Orchestrating Agents: Routines and Handoffs](https://developers.openai.com/cookbook/examples/orchestrating_agents) a articulação de referência
- [OpenAI Swarm repo](https://github.com/openai/swarm) implementação original, mantida como referência conceitual
- [OpenAI Agents SDK docs](https://openai.github.io/openai-agents-python/) Sucessor de produção com sessões e rastreamento
- [Anthropic handoff-in-Claude notes](https://docs.anthropic.com/en/docs/claude-code) como os subagentes do código Claude usam um padrão de transferência através de`Task`
