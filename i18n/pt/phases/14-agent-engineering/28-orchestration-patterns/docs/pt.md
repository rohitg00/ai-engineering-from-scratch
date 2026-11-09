# Padrões de Orquestração: Supervisor, Swarm, Hierarquial

> Quatro padrões de orquestração se repetem em 2026 frameworks: supervisor-worker, enxame / peer-to-peer, hierarquica, debate. orientação de Anthropic: "É sobre a construção do sistema certo para suas necessidades". Comece simples; adicionar topologia apenas quando um único agente mais cinco padrões de fluxo de trabalho é insuficiente.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 12 (Workflow Patterns), Phase 14 · 25 (Multi-Agent Debate)
**Time:** ~60 minutes

## Objetivos de aprendizagem

- Cite os quatro padrões de orquestração recorrentes e quando cada um se encaixa.
- Descreva a recomendação de LangChain de 2026: supervisão baseada em ferramentas versus bibliotecas de supervisão.
- Explique a regra do Anthropic de "construir o sistema certo" e como ele abrange a escolha de topologia.
- Implementar os quatro em STDlib contra um Mestrado em Direito Comum.

## O problema

As equipes buscam "multi-agente" antes de precisarem dele. Quatro padrões se repetem em todos os quadros; uma vez que você pode nomeá-los, você pode escolher o certo  ou ignorar a topologia inteiramente.

## O conceito

### Supervisor-trabalhador

- Um LLM central de envio enviado para agentes especializados.
- Decide: voltar ao eu, entregar ao especialista, terminar.
- Os especialistas não falam entre si; toda a rotina passa pelo supervisor.

Estruturas: LangGraph `create_supervisor`, Orquestra Antropical-trabalhadores, CrewAI Processos Hierárquicos.

**2026 LangChain recommendation:**Fazer supervisão através de chamadas diretas de ferramentas em vez de `create_supervisor`. dá um controlo mais preciso da engenharia de contexto.

### Swarm / peer-to-peer

- Os agentes transmitem directamente através de uma superfície de ferramentas compartilhada.
- Sem roteador central.
- Menos atraso do que o supervisor (menos saltos).
- Mais difícil de raciocinar (não há um único ponto de controlo).

Estruturas: Topologia do enxame de LangGraph, transferências do SDK OpenAI Agents (quando todos os agentes podem transferir para todos os outros).

### - Hierarquias

- Supervisores gerentes sub-supervisores gerentes de trabalhadores.
- Implementados como subgrafos aninhados em LangGraph; tripulações aninhadas em CrewAI.
- Escala para grandes populações de agentes, a custo da complexidade operacional.

Quando é necessário: quando o orçamento contextual de uma única supervisão não pode conter descrições de todos os especialistas.

### Debate

- Proponentes paralelos + crítica cruzada iterativa (Lessão 25).
- Não é realmente orquestração  mais verificação  mas aparece como uma escolha de topologia em quadros.

### Equipamentos autônomos vs fluxos deterministas

A CrewAI formaliza dois modos de implantação:

- **Flow**para a automação determinista orientada por eventos (ponto de partida recomendado para a produção).
- **Crew**para a colaboração autónoma baseada em funções.

Isto é ortogonal aos quatro padrões acima, mas mapeia a topologia: Flow é tipicamente supervisor ou hierárquico; Crew é tipicamente supervisor com um roteador LLM.

### A orientação do Antropic

"O sucesso no espaço de LLM não é sobre a construção do sistema mais sofisticado, é sobre a construção do sistema certo para as suas necessidades".

Ordem de decisão:

1. O único agente + padrões de fluxo de trabalho (Lessão 12)
2. Supervisor-trabalhador  quando tiver 2-4 especialistas.
3. Swarm  quando a latência importa mais do que a clareza do raciocínio.
4. Hierarquica  apenas quando o orçamento do contexto da supervisão falhar.
5. Debate  quando a precisão é mais importante do que o custo.

### Onde este padrão vai mal

- **Topology-first thinking.**"Precisamos de multi-agente" antes de identificar o problema que multi-agente resolve.
- **Bouncing handoffs in swarm.**A -> B -> A -> B. Use contadores de saltos.
- **Fake hierarchy.**Três camadas por "empresa", duas equipes reais.

```figure
orchestration-pattern
```

## Construí-lo

`code/main.py`Implementa os quatro padrões em stdlib contra um LLM escrito:

- `Supervisor`Roteador central.
- `Swarm`- Peer-to-peer com transferências diretas.
- `Hierarchical` Supervisores de supervisores.
- `Debate` Propostas paralelas + crítica.

Cada padrão lida com a mesma tarefa de três intenções (reembolso / bug / vendas).

- É o que é ?

```
python3 code/main.py
npx tsx code/main.ts
```

Output: rastreamento por padrão + contagem de opções. Supervisor é mais limpo; enxame é mais curto; hierárquico é mais profundo; debate é mais caro.

## Usá-lo

- **LangGraph**para supervisores e hierárquicos (subgrafos aninhados).
- **OpenAI Agents SDK**para transferências como ferramentas (em forma de supervisor).
- **CrewAI Flow**para a determinação da produção.
- **Custom**Para debater ou quando quiserem o controlo exato.

## Envia-o

`outputs/skill-orchestration-picker.md`escolhe uma topologia e a implementa.

## Exercícios

1. Converter um supervisor-trabalhador em um enxame removendo o roteador.
2. Adicione um contador de saltos ao enxame: rejeita após 3 entregas.
3. Construir um sistema hierárquico de dois níveis para um domínio de 12 especialistas. Onde o orçamento contextual falha sem anidar?
4. Profila os quatro padrões de uma carga de trabalho em forma de produção. Qual vence em que métrica (latencia, custo, precisão, depurabilidade)?
5. Leia o post da Anthropic sobre "Eficientes Agentes de Construção", mapeando cada um dos fluxos de produção para um dos quatro.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Supervisor-worker | "Router + specialists" | Central LLM dispatches to specialists; they don't talk to each other |
| Swarm | "Peer-to-peer" | Direct handoffs via shared tools; no central router |
| Hierarchical | "Supervisors of supervisors" | Nested subgraphs for large populations |
| Debate | "Proposer + critique" | Parallel proposers, cross-critique (Lesson 25) |
| Tool-call-based supervision | "Supervisor without a library" | Implement supervisor as direct tool calls for context control |
| Crew | "Autonomous team" | CrewAI's role-based collaboration mode |
| Flow | "Deterministic workflow" | CrewAI's event-driven production mode |

## Mais leitura

- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) cinco padrões + agente vs fluxo de trabalho
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) supervisor, enxame, hierarquica
- [CrewAI docs](https://docs.crewai.com/en/introduction) Tripulação vs Fluxo
- [Du et al., Society of Minds (arXiv:2305.14325)](https://arxiv.org/abs/2305.14325) Padrão de debate
