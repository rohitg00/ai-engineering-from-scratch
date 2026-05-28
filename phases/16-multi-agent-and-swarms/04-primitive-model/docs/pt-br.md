# O Modelo Primitivo Multi-Agent

> Todo framework multi-agent saindo em 2026 — AutoGen, LangGraph, CrewAI, OpenAI Agents SDK, Microsoft Agent Framework — é um ponto num espaço de design de quatro dimensões. Quatro primitivas, nada mais: o agent, a handoff, o estado compartilhado, o orquestrador. Esta lição constrói elas do zero, roda um sistema de brinquedo com as quatro, depois mapeia cada framework importante nos mesmos eixos pra você ler qualquer novo release num parágrafo.

**Tipo:** Aprender
**Linguagens:** Python (stdlib)
**Pré-requisitos:** Fase 14 (Agent Engineering), Fase 16 · 01 (Por que Multi-Agent)
**Tempo:** ~60 minutos

## Problema

A cada seis meses sai um novo framework multi-agent. AutoGen em 2023. CrewAI em 2024. LangGraph e OpenAI Swarm em 2024. Google ADK em abril de 2025. Microsoft Agent Framework RC em fevereiro de 2026. Cada comunicado de imprensa se declara "a abstração certa."

Se você tentar aprender um de cada vez, vai desistir. As APIs parecem diferentes. As docs discordam sobre o que é um "agent." Um framework chama sua memória compartilhada de "blackboard," outro chama de "message pool," um terceiro chama de "StateGraph." Você começa a suspeitar que o campo só está gerando ruído.

Não está. Por baixo do marketing, as quatro primitivas são estáveis. Aprenda uma vez, leia qualquer novo framework num parágrafo.

## Conceito

### As quatro primitivas

1. **Agent** — um system prompt mais uma lista de tools. Stateless; cada execução começa do seu system prompt e do histórico de mensagens atual.
2. **Handoff** — uma transferência estruturada de controle de um agent pra outro. Mecanicamente, uma chamada de tool que retorna um novo agent ou uma aresta de grafo que segue uma condição.
3. **Estado compartilhado** — qualquer estrutura de dados que mais de um agent possa ler (às vezes escrever). Message pool, blackboard, key-value store, memória vetorial.
4. **Orquestrador** — quem decide quem fala a seguir. Opções: um grafo explícito (determinístico), um selecionador de falante LLM (suave), a chamada de handoff do último falante (OpenAI Swarm), ou um agendador sobre uma fila (arquitetura swarm).

Esse é todo o espaço de design. Cada framework escolhe padrões pra cada eixo; o resto é sintaxe superficial.

### Como cada framework de 2026 se mapeia nele

| Framework | Agent | Handoff | Estado compartilhado | Orquestrador |
|-----------|-------|---------|----------------------|--------------|
| OpenAI Swarm / Agents SDK | `Agent(instructions, tools)` | tool retorna Agent | problema de quem chama | próxima chamada de handoff do LLM |
| AutoGen v0.4 / AG2 | `ConversableAgent` | selecionador de falante no GroupChat | message pool | função seletora (LLM ou round-robin) |
| CrewAI | `Agent(role, goal, backstory)` | `Process.Sequential / Hierarchical` | Saídas de tarefas encadeadas | LLM gerente ou ordem estática |
| LangGraph | função de nó | aresta de grafo + condição | `StateGraph` reducer | o grafo, determinístico |
| Microsoft Agent Framework | agent + padrões de orquestração | específico por padrão | thread / contexto | específico por padrão |
| Google ADK | agent + card A2A | tarefa A2A | artefatos A2A | host decide |

Diferenças superficiais parecem enormes. Por baixo: as mesmas quatro alavancas.

### Por que isso importa

Quando você vê as primitivas, a comparação de frameworks vira um checklist curto:

- O orquestrador confia no LLM pra rotear (Swarm) ou fixa o roteamento no código (LangGraph)?
- O estado compartilhado é histórico completo (GroupChat) ou projetado (reducer StateGraph)?
- Agents podem modificar os prompts um do outro (gerente CrewAI) ou só fazer handoff (Swarm)?

Essas três perguntas respondem 80% de qual framework se encaixa num dado problema. Você para de procurar "o melhor framework multi-agent" e começa a projetar pro eixo que realmente importa pra você.

### A intuição stateless

Toda primitiva exceto estado compartilhada é stateless. Agent é uma função de (prompt, tools). Handoff é uma chamada de função. Orquestrador é um agendador. **A única coisa com estado no sistema é o estado compartilhado.** É onde moram todos os bugs interessantes: envenenamento de memória (Lição 15), ordenação de mensagens, versionamento, contenção de escrita.

Frameworks que escondem o estado compartilhado (Swarm) empurram o problema pro chamador. Frames que o centralizam (checkpoint LangGraph, pool AutoGen) o tornam inspecionável mas transferem o custo de coordenação pra implementação do estado compartilhado.

### Anatomia de uma primitiva individual

#### Agent

```
Agent = (system_prompt, tools, model, optional_name)
```

Sem memória. Sem estado. Dois agents com o mesmo system prompt e tools são intercambiáveis. Tudo que parece estado por agent é na verdade estado compartilhado ou protocolo de handoff.

#### Handoff

```
Handoff = (from_agent, to_agent, reason, payload)
```

Três implementações dominam:

- **Retorno de função** — a tool retorna o próximo agent. Esse é o padrão OpenAI Swarm. Agents carregam o roteamento nos seus schemas de tool.
- **Aresta de grafo** — LangGraph. Arestas são declarativas. O LLM produz um valor; uma condição seleciona o próximo nó.
- **Seleção de falante** — GroupChat do AutoGen. Uma função seletora (às vezes ela mesma uma chamada LLM) lê o pool e escolhe quem fala a seguir.

#### Estado compartilhado

```
SharedState = { messages: [], artifacts: {}, context: {} }
```

No mínimo, uma lista de mensagens. Geralmente mais: artefatos estruturados (saídas de Tarefa CrewAI), contexto tipado (reducers LangGraph), memória externa (MCP, vector DB).

Duas topologias: **pool completo** (cada agent vê cada mensagem) e **projetado** (agents veem uma visão limitada por papel). Pools completos são simples e escalam mal. Pools projetados escalam mas exigem design de schema antecipado.

#### Orquestrador

```
Orchestrator = ({state, last_speaker}) -> next_agent
```

Quatro variantes:

- **Estático** — o grafo é fixo na hora da construção (LangGraph determinístico, CrewAI Sequential).
- **Selecionado por LLM** — um LLM lê o pool e escolhe o próximo falante (AutoGen, CrewAI Hierarchical).
- **Orientado a handoff** — o agent atual decide chamando uma tool de handoff (Swarm).
- **Orientado a fila** — trabalhadores puxam de uma fila compartilhada; sem próximo-falante explícito (arquiteturas swarm, Matrix).

### O que muda entre frameworks

Uma vez que as primitivas estão fixadas, as decisões de design restantes são:

- **Estratégia de memória** — efêmero vs checkpoint durável (checkpointer LangGraph).
- **Limite de segurança** — quem pode aprovar uma handoff (human-in-the-loop).
- **Contabilidade de custo** — orçamentos de tokens por agent.
- **Observabilidade** — rastrear handoffs, persistir estado pra replay.

Tudo implementável sobre as primitivas. Nenhuma delas é uma nova primitiva.

## Construa

`code/main.py` implementa as quatro primitivas em ~150 linhas de Python stdlib. Sem LLM real — cada agent é uma política scriptada pra que o foco fique na estrutura de coordenação.

O arquivo exporta:

- `Agent` — um dataclass de nome, system prompt, tools, função de política.
- `Handoff` — uma função que retorna um novo agent.
- `SharedState` — um message pool thread-safe.
- `Orchestrator` — três variantes: `StaticOrchestrator`, `HandoffOrchestrator`, `LLMSelectorOrchestrator` (simulado).

A demo roda o mesmo pipeline de três agents (pesquisa → escrita → review) nos três tipos de orquestrador e imprime o message pool no final. Você vê que as saídas diferem só em *quem escolhe a seguir*; os agents e o estado compartilhado são idênticos entre execuções.

Execute:

```
python3 code/main.py
```

Saída esperada: três execuções de orquestrador, uma por padrão. Cada uma imprime o message pool final. A execução orientada a handoff alcança menos agents se o pesquisador decide que acabou cedo — esse é o tradeoff de roteamento por LLM em miniatura.

## Use

`outputs/skill-primitive-mapper.md` é uma skill que lê qualquer codebase multi-agent ou doc de framework e retorna o mapeamento das quatro primitivas. Rode num novo release de framework pra ter um entendimento de um parágrafo antes de ler as docs em profundidade.

## Entregue

Antes de adotar um novo framework, escreva o mapeamento de primitivas pra ele. Se não conseguir, as docs estão incompletas ou o framework está inventando uma quinta primitiva (raro — verifique se há uma variante de estado compartilhado que você não viu).

Fixe o mapeamento na sua doc de arquitetura. Quando um novo membro do time entrar, mande o mapeamento antes das docs da API. Quando as versões do framework mudarem, compare o mapeamento, não o changelog.

## Exercícios

1. Execute `code/main.py` três vezes com diferentes políticas de agent. Observe como a escolha do orquestrador muda quais agents rodam.
2. Implemente um quarto tipo de orquestrador: orientado a fila onde agents fazem polling no estado compartilhado por trabalho. Que deadlock pode acontecer, e como você detecta?
3. Pegue o quickstart do LangGraph (https://docs.langchain.com/oss/python/langgraph/workflows-agents) e reescreva como as quatro primitivas. Quais das abstrações do LangGraph mapeiam 1:1 e quais são wrappers de conveniência?
4. Leia o cookbook do OpenAI Swarm (https://developers.openai.com/cookbook/examples/orchestrating_agents). Identifique quais das quatro primitivas o Swarm torna mais ergonômico, e qual ele empurra pro chamador.
5. Encontre um framework nesta tabela que esconda completamente o estado compartilhado. Explique o que quebra quando agents precisam coordenar entre handiffs sem reler o histórico.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| Agent | "Um LLM com tools" | Uma tupla `(system_prompt, tools, model)`. Stateless. |
| Handoff | "Transferência de controle" | Uma chamada estruturada que nomeia o próximo agent e payload opcional. Três implementações: retorno de função, aresta de grafo, seleção de falante. |
| Estado compartilhado | "Memória" / "contexto" | A única parte com estado de um sistema multi-agent. Message pool ou blackboard. |
| Orquestrador | "Coordenador" | Quem decide quem roda a seguir. Grafo estático, selecionador LLM, orientado a handoff, ou orientado a fila. |
| Primitiva | "Abstração" | Um dos quatro eixos que todo framework parametriza. Não é feature de framework. |
| Message pool | "Histórico de chat compartilhado" | Estado compartilhado de histórico completo. Fácil de raciocinar, escala mal. |
| Estado projetado | "Visão escopada" | Visão específica por papel no estado compartilhado. Escala, exige design de schema. |
| Seleção de falante | "Quem fala a próximo" | Padrão de orquestrador onde uma função (geralmente um LLM) escolhe o próximo agent de um grupo. |

## Leitura Complementar

- [Cookbook OpenAI: Orchestrating Agents — Routines and Handoffs](https://developers.openai.com/cookbook/examples/orchestrating_agents) — a formulação mais clara de orquestração orientada a handoff
- [Docs estáveis do AutoGen](https://microsoft.github.io/autogen/stable/) — GroupChat + seleção de falante é a referência pra orquestração selecionada por LLM
- [Workflows e agents LangGraph](https://docs.langchain.com/oss/python/langgraph/workflows-agents) — orquestração por aresta de grafo e estado compartilhado baseado em reducer
- [Introdução ao CrewAI](https://docs.crewai.com/en/introduction) — agents de papel-objetivo-história, processos Sequential / Hierarchical
- [AG2 (continuação community do AutoGen)](https://github.com/ag2ai/ag2) — a linha ativa do AutoGen v0.2 depois que a Microsoft moveu v0.4 pra manutenção
