# AutoGen v0.4: Modelo Ator e Framework de Agent

> AutoGen v0.4 (Microsoft Research, Jan 2025) redesenhou orquestração de agente ao redor do modelo ator. Troca assíncrona de mensagens, agentes orientados a eventos, isolamento de falhas, concorrência natural. O framework agora está em modo de manutenção enquanto Microsoft Agent Framework (pré-visualização pública Out 2025) se torna o sucessor.

**Tipo:** Aprender + Construir
**Linguagens:** Python (stdlib)
**Pré-requisitos:** Fase 14 · 01 (Agent Loop), Fase 14 · 12 (Workflow Patterns)
**Tempo:** ~75 minutos

## Objetivos de Aprendizado

- Descrever o modelo ator: agentes como atores, mensagens como único IPC, isolamento de falhas por ator.
- Nomear as três camadas de API do AutoGen v0.4 — Core, AgentChat, Extensions — e o que cada uma faz.
- Explicar por que desacoplar entrega de mensagens de tratamento dá isolamento de falhas e concorrência natural.
- Implementar um runtime de ator com stdlib em Python e portar um fluxo de code-review de dois agentes pra ele.

## O Problema

Maioria dos frameworks de agente são síncronos: um agente produz, um agente consome, em uma stack de chamadas. Falhas crasham a stack. Concorrência é aparafusada. Distribuição requer reescrita.

A resposta do AutoGen v0.4: modelo ator. Cada agente é um ator com uma inbox privada. Mensagens são a única interação. O runtime desacopla entrega de tratamento. Falhas isolam a um ator. Concorrência é nativa. Distribuição é só transporte diferente.

## O Conceito

### Atores

Um ator tem:

- Um estado privado (nunca tocado diretamente de fora).
- Uma inbox (fila de mensagens).
- Um handler: `receive(message) -> effects` onde effects podem ser "reply," "send to other actor," "spawn new actor," "update state," "stop self."

Dois atores não podem compartilhar memória. Só podem enviar mensagens.

### Três camadas de API no AutoGen v0.4

1. **Core.** Framework de ator de baixo nível. `AgentRuntime`, `Agent`, `Message`, `Topic`. Troca assíncrona de mensagens, orientado a eventos.
2. **AgentChat.** API de alto nível orientada a tarefa (substituto do ConversableAgent do v0.2). `AssistantAgent`, `UserProxyAgent`, `RoundRobinGroupChat`, `SelectorGroupChat`.
3. **Extensions.** Integrações — OpenAI, Anthropic, Azure, ferramentas, memória.

### Por que desacoplamento importa

No modelo v0.2, chamar `agent_a.chat(agent_b)` sincronicamente bloqueia agent_a até agent_b retornar. No v0.4, `send(agent_b, msg)` coloca a mensagem na inbox de agent_b e retorna. O runtime entrega depois. Três consequências:

- **Isolamento de falhas.** Agent B crashar não crasha Agent A — o runtime captura a falha no handler de B e decide o que fazer (log, retry, dead-letter).
- **Concorrência natural.** Muitas mensagens em voo ao mesmo tempo; atores processam sua inbox concorrentemente.
- **Pronto pra distribuição.** Inbox + transporte é a mesma abstração seja o ator em processo ou em outro host.

### Topologias

- **RoundRobinGroupChat.** Agents revezam em rotação fixa.
- **SelectorGroupChat.** Um agente selector escolhe quem vai próximo baseado no contexto da conversa.
- **Magentic-One.** Equipe multi-agent de referência pra navegação web, execução de código, manipulação de arquivos. Construído sobre AgentChat.

### Observabilidade

Suporte a OpenTelemetry embutido. Toda mensagem emite um span; chamadas de ferramenta carregam atributos `gen_ai.*` conforme as convenções semânticas OTel GenAI de 2026 (Aula 23).

### Status: modo de manutenção

Início de 2026: AutoGen v0.7.x é estável pra pesquisa e prototipagem. Microsoft migrou desenvolvimento ativo pro Microsoft Agent Framework (pré-visualização pública 1 Out 2025; 1.0 GA com meta de fim do Q1 2026). Padrões do AutoGen portam pra frente limpo — o modelo ator é a ideia duradoura.

## Construa

`code/main.py` implementa um runtime de ator com stdlib:

- `Message` — payload tipado com `sender`, `recipient`, `topic`, `body`.
- `Actor` — abstrato com `receive(message, runtime)`.
- `Runtime` — loop de eventos com fila compartilhada, entrega, isolamento de falhas.
- Demo de dois atores: `ReviewerAgent` revisa código, `ChecklistAgent` roda checklist; trocam mensagens até consenso.

Rode:

```
python3 code/main.py
```

O trace mostra entrega de mensagens, uma falha simulada num ator que não crasha o outro e convergência num veredito compartilhado.

## Use

- **AutoGen v0.4/v0.7** (manutenção) — estável pra pesquisa, prototipagem, padrões multi-agent.
- **Microsoft Agent Framework** (pré-visualização) — o caminho à frente; mesmas ideias de modelo ator numa API renovada.
- **Topologia swarm do LangGraph** (Aula 13) — padrão similar via handoffs de ferramentas compartilhadas.
- **Runtime de ator custom** — quando você precisa de transporte eespecificaçãoífico (NATS, RabbitMQ, gRPC).

## Entregue

`outputs/skill-actor-runtime.md` gera um runtime de ator mínimo mais um template de equipe (RoundRobin ou Selector) pra uma tarefa multi-agent dada.

## Exercícios

1. Adicione uma dead-letter queue: quando um handler levanta uma exceção, estacione a mensagem falha pra inspeção humana. Com que frequência DLQ é atingida no seu exemplo?
2. Implemente `SelectorGroupChat`: um ator selector escolhe quem processa a próxima mensagem baseado no estado da conversa.
3. Adicione transporte distribuído: troque a fila em processo por um servidor JSON-over-HTTP pra que atores possam rodar em processos separados.
4. Conecte um span OTel por mensagem (ou um placeholder no-op). Emita `gen_ai.agent.name`, `gen_ai.operation.name` conforme Aula 23.
5. Leia o post de arquitetura do AutoGen v0.4. Porte seu exemplo pra API real `autogen_core`. O que você pulou que importa em produção?

## Termos-Chave

| Termo | O que a galera fala | O que realmente significa |
|-------|---------------------|---------------------------|
| Actor | "Agent" | Estado privado + inbox + handler; sem memória compartilhada |
| Message | "Evento" | Payload tipado; a única forma de atores interagirem |
| Inbox | "Caixa de correio" | Fila de mensagens pendentes por ator |
| Runtime | "Host do agent" | Loop de eventos que roteia mensagens e isola falhas |
| Topic | "Canal" | Rota publish-subscribe nomeada entre atores |
| Fault isolation | "Deixa crashar" | Um ator falhar não crasha outros |
| RoundRobinGroupChat | "Equipe com rotação fixa" | Agents revezam em ordem |
| SelectorGroupChat | "Equipe com roteamento por contexto" | Selector escolhe quem vai próximo |
| Magentic-One | "Equipe de referência" | Squads multi-agent pra web + código + arquivos |

## Leitura Complementar

- [AutoGen v0.4, Microsoft Research](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) — o post de redesenho
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) — alternativa em formato de grafo
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/especificaçãos/semconv/gen-ai/) — spans que o AutoGen emite por padrão
