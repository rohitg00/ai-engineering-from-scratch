# O Modelo de Ator para Agentes  Mensagens de sincronia e tempos de execução tipografados

> Agentes como atores: intercâmbio de mensagens asíncronas, geradores de eventos, isolamento de falhas, concurência natural. AutoGen v0.4 (Microsoft Research, janeiro 2025) redesenhou a orquestração de agentes em torno deste modelo; a estrutura está agora em modo de manutenção, com a Microsoft Agent Framework (previsão pública de outubro 2025) como seu sucessor de produção.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 12 (Workflow Patterns)
**Time:** ~75 minutes

## Objetivos de aprendizagem

- Descreva o modelo de ator: agentes como atores, mensagens como o único IPC, isolamento de falhas por ator.
- Nomear as três camadas de API do AutoGen v0.4  Core, AgentChat, Extensions  e para o que cada uma é.
- Explique por que a desconexão da entrega de mensagens da manipulação dá isolamento de falhas e simetria natural.
- Implementar um stdlib actor runtime em Python e puxar um fluxo de revisão de código de dois agentes para ele.

## O problema

A maioria dos quadros de agentes são sincrónicos: um agente produz, um agente consome, em uma pilha de chamadas. Falhas caem na pilha. A concurrença é ligada. A distribuição requer reescritura.

A resposta do AutoGen v0.4 é: o modelo de ator. Cada agente é um ator com uma caixa de entrada privada. As mensagens são a única interação. O tempo de execução desacopla a entrega do manuseio. As falhas isolam-se a um ator. A concorrência é nativa. A distribuição é apenas um transporte diferente.

## O conceito

### Atores

Um ator tem:

- Um Estado privado (nunca tocado diretamente por fora).
- Uma caixa de entrada (fila de mensagens).
- Um manipulador:`receive(message) -> effects`onde os efeitos podem ser "responde", "enviar para outro ator", "espalhar um novo ator", "atender o estado", "deter-se".

Dois atores não podem partilhar memória, só podem enviar mensagens.

### Três camadas de API

AutoGen v0.4 divide a sua superfície em três:

1. **Core.**Estrutura de actores de baixo nível. `AgentRuntime`- Não .`Agent`- Não .`Message`- Não .`Topic`Troca de mensagens sincronizada, orientada por eventos.
2. **AgentChat.**API de alto nível orientado para tarefas (substituição do ConversableAgent do v0.2). `AssistantAgent`- Não .`UserProxyAgent`- Não .`RoundRobinGroupChat`- Não .`SelectorGroupChat`- Não .
3. **Extensions.**Integrações  OpenAI, Anthropic, Azure, ferramentas, memória.

### Por que é importante o desacoplamento

No modelo v0.2, chamando`agent_a.chat(agent_b)`Bloqueia sincronicamente o agente_a até o agente_b retornar.`send(agent_b, msg)`O tempo de execução entrega mais tarde.

- **Fault isolation.**Agente B que se desabar não desabar Agente A  o tempo de execução pega a falha no manipulador de B e decide o que fazer (log, retry, letra morta).
- **Natural concurrency.**Muitas mensagens em voo ao mesmo tempo; os atores processam a caixa de entrada simultaneamente.
- **Distribution-ready.**O cartão de entrada + transporte é a mesma abstração, quer o ator esteja em processo ou em outro hospedeiro.

### Topologias

- **RoundRobinGroupChat.**Os agentes fazem turnos numa rotação fixa.
- **SelectorGroupChat.**Um agente selector escolhe quem vai a seguir com base no contexto da conversa.
- **Magentic-One.**Equipe de referência multi-agente para navegação na web, execução de código, tratamento de arquivos.

### Observabilidade

O suporte à OpenTelemetry está incorporado.`gen_ai.*`Atributos de acordo com as convenções semânticas OTel GenAI de 2026 (Lessão 23).

### Status: modo de manutenção

Começo de 2026: AutoGen v0.7.x é estável para pesquisa e prototyping. A Microsoft mudou o desenvolvimento ativo para o Microsoft Agent Framework, o sucessor da produção (previsão pública 1 de outubro de 2025; 1.0 GA foi alvo para o final do primeiro trimestre de 2026).

```figure
actor-mailbox
```

## Construí-lo

`code/main.py`Implementa um runtime de atores stdlib:

- `Message` cargas úteis tipografadas com `sender`- Não .`recipient`- Não .`topic`- Não .`body`- Não .
- `Actor` abstracto com `receive(message, runtime)`- Não .
- `Runtime` Loop de eventos com uma fila compartilhada, entrega, isolamento de falhas.
- Uma demonstração de dois atores:`ReviewerAgent`código de revisão, `ChecklistAgent`Elas trocam mensagens até chegarem a um consenso.

- É o que é ?

```
python3 code/main.py
npx tsx code/main.ts
```

O rastro mostra a entrega de mensagens, um fracasso simulado em um ator que não bate o outro, e convergência em um veredicto compartilhado.

## Usá-lo

- **AutoGen v0.4/v0.7**(manutenção)  estável para pesquisa, prototipagem, padrões multi-agentes.
- **Microsoft Agent Framework** a sucessora da produção (previsão pública de outubro de 2025); as mesmas ideias de modelo de ator em uma API atualizada.
- **LangGraph swarm topology**(Lessão 13)  padrão semelhante através de transferências de ferramentas compartilhadas.
- **Custom actor runtime** quando precise de transporte específico (NATS, RabbitMQ, gRPC).

## Envia-o

`outputs/skill-actor-runtime.md`gera um tempo de execução mínimo de atores mais um modelo de equipe (RoundRobin ou Selector) para uma determinada tarefa multi-agente.

## Exercícios

1. Adicione uma fila de letras mortas: quando um manipulador levantar, estacione a mensagem falha para inspeção humana.
2. Implementação `SelectorGroupChat`: um ator selector escolhe quem processar a próxima mensagem com base no estado da conversação.
3. Adicionar transporte distribuído: trocar a fila de processo por um servidor JSON-over-HTTP para que os atores possam executar processos separados.
4. Transmitir um tempo de OTel por mensagem (ou um no-op substitutivo).`gen_ai.agent.name`- Não .`gen_ai.operation.name`Por lição 23.
5. Leia o post de arquitetura do AutoGen v0.4.`autogen_core`O que é que você deixou de ser importante na produção?

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Actor | "Agent" | Private state + inbox + handler; no shared memory |
| Message | "Event" | Typed payload; the only way actors interact |
| Inbox | "Mailbox" | Per-actor queue of pending messages |
| Runtime | "Agent host" | Event loop that routes messages and isolates failures |
| Topic | "Channel" | Named publish-subscribe route between actors |
| Fault isolation | "Let it crash" | One actor failing does not crash others |
| RoundRobinGroupChat | "Fixed-rotation team" | Agents take turns in order |
| SelectorGroupChat | "Context-routed team" | Selector picks who goes next |
| Magentic-One | "Reference team" | Multi-agent squad for web + code + files |

## Mais leitura

- [AutoGen v0.4, Microsoft Research](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) o post de redesenho
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) Alternativa em forma de gráfico
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) extensão emite AutoGen por padrão
