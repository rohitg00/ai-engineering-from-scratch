# O Modelo Primitivo Multi-Agent

> Quatro primitivas, nada mais  o agente, a transferência, o estado compartilhado, o orquestador  abrangem um espaço de design quadridimensional, e as principais estruturas multi-agentes que serão enviadas em 2026 (AutoGen, LangGraph, CrewAI, OpenAI Agents SDK, Microsoft Agent Framework) são pontos nele. Esta lição construiu-os a partir de zero, executa um sistema de brinquedos em todos os quatro, e depois mapeia cada quadro principal nos mesmos eixos para que você possa ler qualquer nova versão em um parágrafo.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 (Agent Engineering), Phase 16 · 01 (Why Multi-Agent)
**Time:** ~60 minutes

## Problemas

A cada seis meses, um novo framework multi-agente é lançado. AutoGen em 2023. CrewAI em 2024. LangGraph e OpenAI Swarm em 2024. Google ADK em abril de 2025.

Se você tentar aprender um por um você vai ficar sem recursos. As APIs parecem diferentes. Os documentos discordam sobre o que é um "agente". Uma estrutura chama sua memória compartilhada de um "blackboard", outro chama-lo de um "pool de mensagens", um terceiro chama-lo de um "StateGraph". Você começa a suspeitar que o campo está apenas a girar.

Não é. Por baixo do marketing, os quatro primitivos são estáveis. Aprenda-os uma vez, leia cada novo quadro em um parágrafo.

## Conceptos

### Os quatro primitivos

1. **Agent** um prompt do sistema mais uma lista de ferramentas. Estatal; cada execução começa com o seu prompt do sistema e o histórico de mensagens atual.
2. **Handoff** uma transferência estruturada de controle de um agente para outro. Mecanicamente, uma chamada de ferramenta que retorna um novo agente ou uma borda de gráfico que segue uma condição.
3. **Shared state** qualquer estrutura de dados que mais de um agente possa ler (às vezes escrever). Pool de mensagens, quadro negro, armazenamento de valores de chave, memória vetorial.
4. **Orchestrator** quem decide quem fala a seguir. Opções: um gráfico explícito (determinista), um selector de oradores LLM (suave), a chamada de entrega do último orador (OpenAI Swarm), ou um cronógrafo sobre uma fila (arquitetura de enxames).

Cada framework escolhe as definições padrão para cada eixo; o resto é a sintaxe de superfície.

### Como cada quadro 2026 mapeia para ele

| Framework | Agent | Handoff | Shared state | Orchestrator |
|-----------|-------|---------|--------------|--------------|
| OpenAI Swarm / Agents SDK | `Agent(instructions, tools)` | tool returns Agent | caller's problem | the LLM's next handoff call |
| AutoGen v0.4 / AG2 | `ConversableAgent` | speaker-selector on GroupChat | message pool | selector function (LLM or round-robin) |
| CrewAI | `Agent(role, goal, backstory)` | `Process.Sequential / Hierarchical` | Task outputs chained | manager LLM or static order |
| LangGraph | node function | graph edge + condition | `StateGraph` reducer | the graph, deterministic |
| Microsoft Agent Framework | agent + orchestration patterns | pattern-specific | thread / context | pattern-specific |
| Google ADK | agent + A2A card | A2A task | A2A artifacts | host decides |

As diferenças superficiais parecem enormes, por baixo, os mesmos quatro botões.

### Por que isto importa

Uma vez que você vê os primitivos, a comparação de framework se torna uma lista de verificação curta:

- O orquestrador confía no LLM para encaminhar (Swarm) ou encaminha o envio em código (LangGraph)?
- O estado compartilhado é histórico completo (GroupChat) ou projetado (Redutor de Estatograma)?
- Os agentes podem modificar as instruções uns dos outros (gerente de CrewAI) ou apenas dar a mão (Swarm)?

Estas três perguntas respondem a 80% de quais frameworks se encaixam num determinado problema.

### A visão sem Estado

Todos os primitivos, exceto o estado compartilhado, são estatais. Agente é uma função de (prompt, ferramentas).**The only stateful thing in the system is shared state.**É onde vivem todos os bugs interessantes: envenenamento da memória (Lessão 15), ordenação de mensagens, versão, contenção de escrita.

Os quadros que escondem o estado compartilhado (Swarm) empurram o problema para o chamador.

### Anatomia de um único primitivo

#### Agente .

```
Agent = (system_prompt, tools, model, optional_name)
```

Não há memória, não há estado, dois agentes com o mesmo sistema de comando e ferramentas são intercambiáveis, tudo que parece ser um estado de agente é em estado compartilhado ou o protocolo de transferência.

#### Transmissão

```
Handoff = (from_agent, to_agent, reason, payload)
```

São três as implementações que dominam:

- **Function return** a ferramenta retorna o próximo agente. Este é o padrão OpenAI Swarm. Os agentes carregam roteamento em seus esquemas de ferramentas.
- **Graph edge** LangGraph. As bordas são declarativas. O LLM produz um valor; uma condição seleciona o próximo nó.
- **Speaker selection** AutoGen GroupChat. Uma função selector (às vezes uma chamada de LLM) lê o grupo e escolhe quem fala a seguir.

#### Estado comum

```
SharedState = { messages: [], artifacts: {}, context: {} }
```

Em geral, são mais frequentes: artefatos estruturados (exportações de tarefas CrewAI), conteúdo tipado (redutores de LangGraph), memória externa (MCP, vector DB).

Duas topologias: **full pool**(cada agente vê todas as mensagens) e **projected**(agentes vejam uma visão de escala de papéis). Pools completos são simples e escalão mal. Pools projetados escala mas requerem um projeto de esquema antecipado.

#### Orquestra

```
Orchestrator = ({state, last_speaker}) -> next_agent
```

Quatro sabores:

- **Static** o gráfico é fixado no tempo de construção (Deterministic LangGraph, CrewAI Sequential).
- **LLM-selected** um Mestrado em Direito Legítimo lê o grupo e escolhe o próximo orador (AutoGen, CrewAI Hierarquial).
- **Handoff-driven** o agente atual decide chamando uma ferramenta de transferência (Swarm).
- **Queue-driven** trabalhadores tiram de uma fila compartilhada; nenhum alto-falante seguinte explícito (arquiteturas de enxames, Matrix).

### Que alterações ocorrem entre os quadros

Uma vez que os primitivos são fixos, as decisões de design restantes são:

- **Memory strategy** ponto de controlo efêmero versus duradouro (ponte de controlo LangGraph).
- **Safety boundary** que pode aprovar uma transferência (humano no circuito).
- **Cost accounting** Orçamentos de tokens por agente.
- **Observability** rastrear transferências, estado persistente para repetição.

Todos implementáveis em cima dos primitivos. Nenhum deles é novo primitivos.

```figure
a5-primitive-radar
```

## Construí-lo

`code/main.py`Não há um LLM real. Cada agente é uma política scriptada, então o foco permanece na estrutura de coordenação.

Exportação do ficheiro:

- `Agent` uma classe de dados de nome, sistema de instruções, ferramentas, função de política.
- `Handoff` uma função que retorna um novo agente.
- `SharedState` um grupo de mensagens seguro de fios.
- `Orchestrator` três variantes: `StaticOrchestrator`- Não .`HandoffOrchestrator`- Não .`LLMSelectorOrchestrator`(simulado).

A demonstração executa o mesmo pipeline de três agentes (investigação → escrever → revisão) através dos três tipos de orquestra e imprime o conjunto de mensagens no final. Você pode ver que as saídas diferem apenas em *quem escolhe o próximo*; os agentes e o estado compartilhado são idênticos em todas as corridas.

- É o que é ?

```
python3 code/main.py
npx tsx code/main.ts
```

A produção esperada: três corridas de orquestra, uma por padrão. Cada uma imprime o conjunto final de mensagens. A corrida dirigida por entrega chega a menos agentes se o pesquisador decidir que é feito cedo  que é o compromisso de envio de LLM em miniatura.

## Usá-lo

`outputs/skill-primitive-mapper.md`é uma habilidade que lê qualquer base de código multi-agente ou documento framework e retorna o mapeamento primitivo de quatro.

## Envia-o

Antes de adotar um novo framework, escreva o mapeamento primitivo para ele. Se você não puder, os documentos são incompletos ou o framework está inventando um quinto primitivo (cheque raros  para um sabor de estado compartilhado que você não viu).

Quando um novo membro da equipe se juntar, envie-lhe o mapeamento antes dos documentos da API. Quando as versões do framework mudarem, difere o mapeamento, não o log de mudanças.

## Exercícios

1. Corra .`code/main.py`Observe como a escolha do orquestrador muda os agentes que executam.
2. Implementar um quarto tipo de orquestrador: um tipo de orquestra em que os agentes compartilham o estado do trabalho.
3. Tome o LangGraph quickstart (https://docs.langchain.com/oss/python/langgraph/workflows-agentsQual dos mapas de abstracções de LangGraph 1:1 e quais são envolventes de conveniência?
4. Leia o livro de cozinha OpenAI Swarm (https://developers.openai.com/cookbook/examples/orchestrating_agentsIdentificar qual dos quatro primitivos que o Swarm torna mais ergonômico e qual ele empurra para o chamador.
5. Encontre um quadro nesta tabela que esconda o estado compartilhado inteiramente e explique o que se rompe quando os agentes precisam coordenar entre as transferências sem ler novamente o histórico.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Agent | "An LLM with tools" | A `(system_prompt, tools, model)` triple. Stateless. |
| Handoff | "Transfer of control" | A structured call that names the next agent and optional payload. Three implementations: function return, graph edge, speaker selection. |
| Shared state | "Memory" / "context" | The only stateful part of a multi-agent system. Message pool or blackboard. |
| Orchestrator | "Coordinator" | Whoever decides who runs next. Static graph, LLM selector, handoff-driven, or queue-driven. |
| Primitive | "Abstraction" | One of the four axes every framework parameterizes. Not a framework feature. |
| Message pool | "Shared chat history" | Full-history shared state. Easy to reason about, scales badly. |
| Projected state | "Scoped view" | Role-specific view into shared state. Scales, requires schema design. |
| Speaker selection | "Who talks next" | Orchestrator pattern where a function (often an LLM) picks the next agent from a group. |

## Mais leitura

- [OpenAI cookbook: Orchestrating Agents — Routines and Handoffs](https://developers.openai.com/cookbook/examples/orchestrating_agents) a articulação mais clara da orquestração orientada por transferências
- [AutoGen stable docs](https://microsoft.github.io/autogen/stable/) GrupoChat + seleção de oradores é a referência para a orquestração selecionada pelo LLM
- [LangGraph workflows and agents](https://docs.langchain.com/oss/python/langgraph/workflows-agents) Orquestração de bordas gráficas e estado compartilhado baseado em redução
- [CrewAI introduction](https://docs.crewai.com/en/introduction) agentes de papel-objetivo-conhecimento, processos sequenciais/hierárquicos
- [AG2 (community AutoGen continuation)](https://github.com/ag2ai/ag2) a linha de AutoGen v0.2 ao vivo depois que a Microsoft mudou v0.4 para manutenção
