# Padrões de Orquestração: Supervisor, Swarm, Hierárquico

> Quatro padrões de orquestração se repetem nos frameworks de 2026: supervisor-worker, swarm / peer-to-peer, hierárquico, debate. Orientação da Anthropic: "Trata-se de construir o sistema certo pra suas necessidades." Comece simples; adicione topologia só quando um agente só + cinco padrões de workflow não é suficiente.

**Tipo:** Aprender + Construir
**Linguagens:** Python (stdlib)
**Pré-requisitos:** Fase 14 · 12 (Workflow Patterns), Fase 14 · 25 (Multi-Agent Debate)
**Tempo:** ~60 minutos

## Objetivos de Aprendizado

- Nomear os quatro padrões de orquestração recorrentes e quando cada um se encaixa.
- Descrever a recomendação do LangChain em 2026: supervisão baseada em tool-call vs bibliotecas de supervisor.
- Explicar a regra "construa o sistema certo" da Anthropic e como ela controla a escolha de topologia.
- Implementar todos os quatro em stdlib contra um LLM roteado comum.

## O Problema

Times recorrem a "multi-agente" antes de precisar. Quatro padrões se repetem entre frameworks; uma vez que consegue nomeá-los, consegue escolher o certo — ou pular a topologia completamente.

## O Conceito

### Supervisor-worker

- Um LLM de roteamento central despacha pra agentes eespecificaçãoialistas.
- Decide: voltar pra si, handoff pro eespecificaçãoialista, terminar.
- Eespecificaçãoialistas não conversam entre si; todo roteamento passa pelo supervisor.

Frameworks: LangGraph `create_supervisor`, Anthropic orchestrator-workers, CrewAI Hierarchical Process.

**Recomendação do LangChain em 2026:** faça supervisão via chamadas diretas de ferramenta ao invés de `create_supervisor`. Dá controle mais fino de context engineering — você decide exatamente o que cada eespecificaçãoialista vê.

### Swarm / peer-to-peer

- Agentes fazem handoff diretamente via superfície de ferramentas compartilhada.
- Sem roteador central.
- Menor latência que supervisor (menos hops).
- Mais difícil de raciocinar (sem ponto único de controle).

Frameworks: topologia swarm do LangGraph, handoffs do OpenAI Agents SDK (quando todos agentes podem fazer handoff pra todos os outros).

### Hierárquico

- Supervisores gerenciando sub-supervisores gerenciando workers.
- Implementado como subgraphs aninhados no LangGraph; crews aninhadas no CrewAI.
- Escala pra grandes populações de agente ao custo de complexidade operacional.

Quando precisa: quando o orçamento de contexto de um único supervisor não cabe nas descrições de todos os eespecificaçãoialistas.

### Debate

- Proponentes paralelos + cross-critique iterativo (Aula 25).
- Não é realmente orquestração — é mais verificação — mas aparece como escolha de topologia nos frameworks.

### CrewAI Crew vs Flow

CrewAI formaliza dois modos de deploy:

- **Flow** pra automação determinística orientada a eventos (ponto de partida recomendado pra produção).
- **Crew** pra colaboração autônoma baseada em papéis.

Isso é ortogonal aos quatro padrões acima mas mapeia pra topologia: Flow é tipicamente supervisor ou hierárquico; Crew é tipicamente supervisor com um roteador LLM.

### Orientação da Anthropic

"Success in the LLM space isn't about building the most sophisticated system. It's about building the right system for your needs."

Ordem de decisão:

1. Agente único + padrões de workflow (Aula 12) — comece aqui.
2. Supervisor-worker — quando você tem 2-4 eespecificaçãoialistas.
3. Swarm — quando latência importa mais que clareza de raciocínio.
4. Hierárquico — só quando o orçamento de contexto do supervisor falha.
5. Debate — quando acurácia importa mais que custo.

### Onde esse pattern dá errado

- **Pensamento topology-first.** "Precisamos de multi-agente" antes de identificar qual problema multi-agente resolve.
- **Handoffs rebatendo no swarm.** A -> B -> A -> B. Use contadores de hops.
- **Hierarquia falsa.** Três camadas porque "enterprise"; dois times reais. Colapse.

## Construa

`code/main.py` implementa todos os quatro padrões em stdlib contra um LLM roteado:

- `Supervisor` — roteador central.
- `Swarm` — peer-to-peer com handoffs diretos.
- `Hierarchical` — supervisores de supervisores.
- `Debate` — proponentes paralelos + critique.

Cada padrão lida com a mesma tarefa de três intenções (reembolso / bug / vendas). Formatos de trace diferem.

Execute:

```
python3 code/main.py
```

Saída: trace + contagem de ops por padrão. Supervisor é o mais limpo; swarm é o mais curto; hierárquico é o mais profundo; debate é o mais caro.

## Use

- **LangGraph** pra supervisor e hierárquico (subgraphs aninhados).
- **OpenAI Agents SDK** pra handoffs-as-tools (formato supervisor).
- **CrewAI Flow** pra determinístico de produção.
- **Custom** pra debate ou quando quer controle exato.

## Entregue

`outputs/skill-orchestration-picker.md` escolhe uma topologia e a implementa.

## Exercícios

1. Converta um supervisor-worker pra swarm removendo o roteador. O que quebra? O que melhora?
2. Adicione um contador de hops no swarm: recuse após 3 handoffs. Captura o rebatimento A->B->A?
3. Construa um sistema hierárquico de dois níveis pra um domínio de 12 eespecificaçãoialistas. Onde o orçamento de contexto falha sem nesting?
4. Profile os quatro padrões num workload de formato de produção. Qual ganha em qual métrica (latência, custo, acurácia, debugabilidade)?
5. Leia o post "Building Effective Agents" da Anthropic. Mapeie cada um dos seus fluxos de produção pra um dos quatro. Algum que não mapeia limpo?

## Termos Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| Supervisor-worker | "Roteador + eespecificaçãoialistas" | LLM central despacha pra eespecificaçãoialistas; eles não conversam entre si |
| Swarm | "Peer-to-peer" | Handoffs diretos via ferramentas compartilhadas; sem roteador central |
| Hierárquico | "Supervisores de supervisores" | Subgraphs aninhados pra grandes populações |
| Debate | "Proponente + critique" | Proponentes paralelos, cross-critique (Aula 25) |
| Supervisão via tool-call | "Supervisor sem biblioteca" | Implementa supervisor como chamadas diretas de ferramenta pra controle de contexto |
| Crew | "Time autônomo" | Modo de colaboração baseada em papéis do CrewAI |
| Flow | "Workflow determinístico" | Modo de produção orientado a eventos do CrewAI |

## Leitura Complementar

- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) — cinco padrões + agente vs workflow
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) — supervisor, swarm, hierárquico
- [CrewAI docs](https://docs.crewai.com/en/introduction) — Crew vs Flow
- [Du et al., Society of Minds (arXiv:2305.14325)](https://arxiv.org/abs/2305.14325) — padrão de debate
