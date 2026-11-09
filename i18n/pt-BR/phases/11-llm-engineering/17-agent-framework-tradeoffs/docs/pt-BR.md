# Tradeoffs de Agente Framework  Gráfico, Papel e Orquestração de Atores

> Cada framework vende a mesma demonstração (o agente de pesquisa constrói um relatório) e esconde o mesmo bug (o esquema de estado luta com a camada de orquestração). Escolha o framework cujas abstrações correspondem à forma do seu problema; tudo o resto é cola que você escreve duas vezes.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 11 · 09 (Function Calling), Phase 11 · 16 (LangGraph)
**Time:** ~45 minutes

## O problema

Você tem uma tarefa que precisa de mais de uma chamada de LLM. Talvez seja um fluxo de trabalho de pesquisa (planar, pesquisa, resumir, citar). Talvez seja um pipeline de revisão de código (parse diff, crítica, correção, validação). Talvez seja um assistente multi-turn que faz livros de voos, escreve e-mails e arquivam relatórios de despesas. Você escolhe uma estrutura.

Três dias depois, descobrem a fuga de abstrações do quadro. A CrewAI dá-lhe papéis, mas luta contra você quando o "investigador" precisa entregar um plano estruturado ao "escritor". A AutoGen dá-lhe chat entre agentes, mas não tem estado de primeira classe, então o seu ponto de controle é um picão de um registro de conversa. O LangGraph dá-lhe um gráfico de estado, mas obriga-o a nomear cada transição antes de saber o que o agente vai fazer. O Agno dá-te uma abstração de um agente que grita quando tentas espalhar para três trabalhadores simultâneos.

A solução não é "pôr o melhor quadro". É combinar a abstração central do quadro com a forma do seu problema.

## O conceito

![Agent framework matrix: core abstraction vs problem shape](../assets/framework-matrix.svg)

Quatro estruturas dominam a paisagem de 2026.

| Framework | Core abstraction | Best fit | Worst fit |
|-----------|------------------|----------|-----------|
| **LangGraph** | `StateGraph` — typed state, nodes, conditional edges, checkpointer. | Workflows with explicit state and human-in-the-loop interrupts; production agents needing time-travel debugging. | Loose, role-driven brainstorming where the topology is unknown. |
| **CrewAI** | `Crew` — roles (goal, backstory), tasks, process (sequential or hierarchical). | Role-playing or persona-driven workflows with a short linear/hierarchical plan. | Anything stateful beyond the crew's turn history; complex branching. |
| **AutoGen** | `ConversableAgent` pair — two or more agents that speak in turns until an exit condition. | Multi-agent *dialogue* (teacher-student, proposer-critic, actor-reviewer) where the thinking emerges from the chat. | Deterministic workflows with a known DAG; anything needing durable state across restarts. |
| **Agno** | `Agent` — a single LLM + tools + memory, composable into teams. | Fast-to-build single agents and lightweight teams; strong multi-modality and built-in storage drivers. | Deep, explicitly-branched graphs with custom reducers. |

### O que significa "abstração"

A abstração central de uma estrutura é o que desenhamos no quadro quando apresentamos a arquitetura.

- **LangGraph**→ você desenha um gráfico. nós são passos, bordas são transições, e o objeto de estado em cada ponto é digitado.
- **CrewAI**→ você desenha um organograma. Cada função tem uma descrição do trabalho e um gerente encaminha tarefas.
- **AutoGen**- você desenha um Slack DM. Dois agentes enviam mensagens um ao outro; um terceiro se junta se você precisa de um moderador.
- **Agno**→ você desenha uma caixa única com ferramentas penduradas dela. Coloque caixas ao lado uma da outra para uma equipe. O modelo mental é "agente com baterias incluídas".

### A questão do Estado

O Estado é onde a maioria das escolhas de quadro se desmorona na produção.

- **LangGraph.**Estado tipográfico (`TypedDict`O modelo Pydantic (ou modelo Pydantic), reductores por campo, ponto de verificação de primeira classe (SQLite/Postgres/Redis).
- **CrewAI.**Os fluxos de estado como cadeias entre tarefas através do `context`campo, ou estruturado através de `output_pydantic`Não há uma loja durável por tripulação fora da caixa, você vai sair sozinho se a tripulação tiver que sobreviver a uma reinicialização.
- **AutoGen.**Estado é o histórico de chat e qualquer usuário definido `context`As transcrições de conversação persistem; o estado de fluxo de trabalho arbitrário não, a menos que você escreva adaptadores.
- **Agno.**Drivers de armazenamento integrados (SQLite, Postgres, Mongo, Redis, DynamoDB) anexados a um `Agent`por via `storage=` sessões de conversação e memórias do usuário persistem automaticamente.

### A questão dos ramos

Todos os agentes não triviais são os que decidem as coisas.

- **LangGraph** você decide, através de bordas condicionais. Routing é uma função Python com ramos nomeados. Ramos são de primeira classe no gráfico compilado; o checkpointer registra qual ramos foram tomados.
- **CrewAI** o gerente decide em modo hierárquico; em modo sequencial você decide no tempo de construção. O roteamento é implícito na lista de tarefas; não há "se" de primeira classe fora do prompt do gerente.
- **AutoGen**Os agentes decidem através do chat.`GroupChatManager`seleciona o próximo orador; pode escrever a mão um `speaker_selection_method`Mas o padrão é o LLM.
- **Agno**O agente decide por que ferramenta ligar a seguir. As equipes têm um modo de coordenador/router/colaborador; a ramificação além disso é responsabilidade do desenvolvedor.

### A questão da observabilidade

- **LangGraph** OpenTelemetry via LangSmith ou qualquer exportador OTel. Cada transição de nó é um período de rastreamento; pontos de controle duplicam como rastreamento repletável. LangSmith é a opção de primeira parte; Langfuse/Phoenix também tem adaptadores.
- **CrewAI** OpenTelemetry de primeira classe desde o final de 2025; integrações com Langfuse, Phoenix, Opik, AgentOps.
- **AutoGen** Integração da OpenTelemetry através de `autogen-core`O agente Ops e o opik têm conectores.
- **Agno** incorporado `monitoring=True`A Comissão propõe que a Comissão adopte um regulamento relativo à aplicação do artigo 107.o, n.o 1, do Regulamento (CE) n.o 1069/2009 do Parlamento Europeu e do Conselho.

### Custo e latência

Os quatro frameworks adicionam sobrecarga por chamada (lógica do framework, validação, serialização). Ordem aproximada de aumento de sobrecarga: Agno ≈ LangGraph < CrewAI ≈ AutoGen. A diferença é dominada pelo quanto extra LLM roteamento do framework faz. O gerente hierárquico do CrewAI gasta tokens para decidir quem vai a seguir; AutoGen `GroupChatManager`LangGraph só gasta tokens quando escrever.`llm.invoke`O caminho de Agno para um agente é fino.

Quando o custo por rodada é importante, prefira o roteamento explícito (LangGraph edges, AutoGen `speaker_selection_method`) sobre o itinerário selecionado pelo LLM.

### Interoperabilidade

- **LangGraph**- Não .**LangChain**Ferramentas, retrievers, LLMs. Adaptador MCP de primeira classe (ferramentas importadas como servidores MCP).
- **CrewAI** ferramentas herdadas de `BaseTool`As ferramentas LangChain, LlamaIndex e MCP se adaptam a todos.`allow_delegation=True`- Não .
- **AutoGen**→ `FunctionTool`O sistema de ligação é um sistema de ligação de ligação de um agente a outro.
- **Agno**→ `@tool`Decorador ou subclasse BaseTool; adaptador MCP; ferramentas podem ser compartilhadas entre agentes e equipes.

## A habilidade

> Você pode explicar, em uma frase, por que uma determinada estrutura é adequada para um determinado problema de agente.

Lista de verificação pré-construída:

1. **Draw the shape.**É um gráfico (estado tipado, transições nomeadas)? Um jogo de papel (especialistas entregar o trabalho)? Uma conversa (agentes falar até terminar)? Um único agente com ferramentas?
2. **Decide who branches.**Desenvolvedor-decidido ramificação → LangGraph. Gerente-agente-decidido → CrewAI hierárquico. Chat-emergente → AutoGen. Ferramenta-chamada-decidido → Agno.
3. **Check the state budget.**Se você precisa de um currículo do ponto de verificação? viagem no tempo? interrupções humanas no meio da execução?
4. **Check the cost budget.**O roteamento selecionado pela LLM custa tokens adicionais por turno.
5. **Budget the framework overhead.**Cada framework é outra dependência. Se a tarefa é duas chamadas de LLM e uma ferramenta, escreva 30 linhas de Python simples; nenhuma framework é mais barata do que nenhuma framework.

Recusar-se a procurar um quadro antes de poder desenhar o gráfico, o gráfico org, o chat ou a caixa de agentes.

## A Matriz de Decisão

| Problem shape | Preferred framework | Why |
|---------------|---------------------|-----|
| Workflow DAG with typed state, human approvals, long-running | LangGraph | First-class state, checkpointer, interrupts, time-travel. |
| Research / writing pipeline with distinct roles | CrewAI (sequential) or LangGraph subgraphs | Role-per-task is cheap to express in CrewAI; scale up with LangGraph when branching gets complex. |
| Proposer-critic or teacher-student dialogue | AutoGen | Two-agent chat is its native shape. |
| Single agent with tools, sessions, memory | Agno | Thinnest setup, built-in storage and memory. |
| Thousands of parallel fanouts with reducers | LangGraph + `Send` | The only one with a first-class parallel-dispatch API. |
| Quick prototype, no framework commitment | Plain Python + provider SDK | No framework is the fastest framework. |

```figure
l5-framework-fit
```

## Exercícios

1. **Easy.**Faça a mesma tarefa  "investigar a sede da Anthropic, escrever um resumo de 200 palavras, citar fontes"  e implementá-lo em LangGraph (quatro nós: planejar, pesquisar, escrever, citar) e em CrewAI (três funções: pesquisador, escritor, editor).
2. **Medium.**Construir a mesma tarefa em AutoGen (investigador  escritor chat, editor se une através `GroupChat`) e Agno (um único agente com `search_tools`E ...`write_tools`A classificação das quatro implementações é feita em função de: a) custo por execução, b) capacidade de retomada após um acidente, c) capacidade de injetar uma aprovação humana antes da fase de escrita.
3. **Hard.**Construir um script de árvore de decisão `pick_framework.py`que requer uma breve descrição do problema (JSON: `{has_typed_state, has_roles, has_dialogue, has_parallel_fanout, needs_resume}`O artigo 107.o, n.o 1, do Tratado CEE, estabelece que a Comissão deve proceder a uma avaliação dos riscos de risco e, em especial, a uma avaliação dos riscos de risco.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Orchestration | "How the agents coordinate" | The layer that decides which node/role/agent runs next. |
| Durable state | "Resume after a restart" | State that survives process death, attached to a checkpoint or session store. |
| LLM-selected routing | "Let the model decide" | A planner LLM picks the next step each turn; flexible but pays tokens on every decision. |
| Explicit routing | "Developer decides" | A Python function or static edge picks the next step; cheap and auditable. |
| Crew | "A CrewAI team" | Roles + tasks + process (sequential or hierarchical) bound into a single runnable. |
| GroupChat | "AutoGen's multi-agent chat" | A managed conversation between N agents with a speaker selector. |
| Team (Agno) | "Multi-agent Agno" | Route / coordinate / collaborate mode over a set of agents. |
| StateGraph | "LangGraph's graph" | Typed-state, node, conditional-edge, checkpointer abstraction. |

## Mais leitura

- [LangGraph documentation](https://langchain-ai.github.io/langgraph/) StateGraph, pontos de controlo, interrupções, viagens no tempo.
- [CrewAI documentation](https://docs.crewai.com/) Equipes, Fluxos, Agentes, Tarefas, Processos.
- [AutoGen documentation](https://microsoft.github.io/autogen/) Agente conversável, Chat de grupo, equipes, ferramentas.
- [Agno documentation](https://docs.agno.com/)Agente, equipa, fluxo de trabalho, armazenamento, memória.
- [Anthropic — Building effective agents (Dec 2024)](https://www.anthropic.com/research/building-effective-agents) biblioteca de padrões (cadeia de instâncias, roteamento, paralelação, orquestra-trabalhadores, avaliador-optimizador) framework-agnostic.
- [Yao et al., "ReAct: Synergizing Reasoning and Acting" (ICLR 2023)](https://arxiv.org/abs/2210.03629) o ciclo cada quadro se veste.
- [Wu et al., "AutoGen: Enabling Next-Gen LLM Applications via Multi-Agent Conversation" (2023)](https://arxiv.org/abs/2308.08155) O papel de design da AutoGen.
- [Park et al., "Generative Agents: Interactive Simulacra of Human Behavior" (UIST 2023)](https://arxiv.org/abs/2304.03442)Base de jogo de papel que as pilhas de persona do estilo CrewAI se baseiam.
- Fase 11 · 16 (Langgraph)  o quadro que esta lição comparam.
- Fase 11 · 19 (Reflexão)  um padrão que mapeia limpo para LangGraph mas incómodo para CrewAI.
- Fase 11 · 22 (Observabilidade da produção)  como utilizar o instrumento, independentemente do quadro que escolher.
