# Group Chat e Seleção de Orador

> AutoGen GroupChat e AG2 GroupChat compartilham uma conversa entre N agents; uma função selecionadora (LLM, round-robin ou custom) escolhe quem fala depois. Esse é o arquetipo de conversa multi-agent emergente — os agentes não conhecem seu papel num grafo estático, só reagem ao pool compartilhado. A semântica do GroupChat do AutoGen v0.2 foi preservada no fork AG2; o AutoGen v0.4 reescreveu como um modelo de ator event-driven. A Microsoft pôs o AutoGen em modo de manutenção em fevereiro de 2026 e mesclou com o Semantic Kernel no Microsoft Agent Framework (RC fevereiro de 2026). O primitive GroupChat sobrevive tanto no AG2 quanto no Microsoft Agent Framework — aprende uma vez, usa em todo lugar.

**Tipo:** Aprender + Construir
**Linguagens:** Python (stdlib)
**Pré-requisitos:** Fase 16 · 04 (Primitive Model)
**Tempo:** ~60 minutos

## Problema

Grafos estáticos (LangGraph) funcionam quando o workflow é conhecido. Conversas reais não são estáticas: às vezes o coder pergunta ao reviewer, ao pesquisador, ao escritor. Codificar cada possível handoff gera uma explosão de arestas. Você quer *agents reagindo a um pool compartilhado*, com alguma função decidindo quem fala depois.

Isso é exatamente o que o AutoGen GroupChat faz.

## Conceito

### A forma

```
              ┌─── shared pool ────┐
              │   m1  m2  m3  ...  │
              └─────────┬──────────┘
                        │ (everyone reads all)
      ┌───────┬─────────┼─────────┬───────┐
      ▼       ▼         ▼         ▼       ▼
    Agent A  Agent B  Agent C  Agent D  Selector
                                           │
                                           ▼
                                  "next speaker = C"
```

Cada agente vê cada mensagem. Uma função selecionadora é chamada a cada turno para escolher quem fala depois.

### Os três tipos de selecionador

**Round-robin.** Ciclo fixo. Determinístico. Escala linearmente em N, mas ignora contexto — um coder ganha a vez mesmo quando o assunto é revisão legal.

**Selecionado por LLM.** Uma chamada a um LLM que lê o pool recente e retorna o melhor próximo orador. Consciente do contexto, mas lento: cada turno adiciona uma chamada ao LLM. Padrão do AutoGen.

**Custom.** Uma função Python com a lógica que quiser. Típico: selecionado por LLM com regras de reserva (por exemplo, "sempre dar a vez ao verificador depois do coder").

### A API ConversableAgent

```
agent = ConversableAgent(
    name="coder",
    system_message="You write Python.",
    llm_config={...},
)
chat = GroupChat(agents=[coder, reviewer, tester], messages=[])
manager = GroupChatManager(groupchat=chat, llm_config={...})
```

`GroupChatManager` guarda o selecionador. Quando um agente completa um turno, o manager chama o selecionador, que retorna o próximo agent. O loop continua até uma condição de terminação.

### Terminação

Três padrões comuns:

- **Máximo de rodadas.** Limite rígido no total de turnos.
- **Token "TERMINATE".** Agents podem emitir uma mensagem sentinela; o manager para quando uma aparece.
- **Verificação de objetivo.** Um verificador leve roda a cada turno e para a conversa quando pronto.

### A divisão AutoGen → AG2 e a fusão com o Microsoft Agent Framework

No início de 2025, a Microsoft começou uma reescrita maior do AutoGen (v0.4) em torno de um modelo de ator event-driven. A comunidade fez fork do GroupChat semântico do AutoGen v0.2 como AG2, preservando a API que os early adopters já tinham integrado.

Em fevereiro de 2026, a Microsoft anunciou que o AutoGen entraria em modo de manutenção, com o modelo de ator event-driven sendo mesclado no **Microsoft Agent Framework** (RC fevereiro de 2026, agora mesclado com o Semantic Kernel). O conceito de GroupChat sobrevive nas duas tracks; os detalhes de implementação diferem. O AG2 é o upstream preferido para código compatível com v0.2.

### Quando o GroupChat se encaixa

- **Conversas emergentes.** Você não quer pré-configurar cada próximo-orador possível.
- **Tarefas de mistura de papéis.** O coder pergunta ao pesquisador, o pesquisador ao arquivista, o arquivista volta ao coder. O fluxo não é um DAG.
- **Resolução exploratória de problemas.** Pense em "reunião de brainstorming", não em "linha de montagem".

### Quando falha

- **Determinismo estrito.** O selecionador por LLM pode ser inconsistente. Mesmo prompt, rodadas diferentes, próximos oradores diferentes.
- **Cascata de sycophancy.** Agents se curvam a quem falou com mais confiança. Use contraprompt explícito.
- **Inchaço de contexto.** Cada agente lê cada mensagem; depois de 10 turnos o contexto é enorme. Use projeções (Lição 15) para limitar visões.
- **Oradores quentes.** Um agente domina a conversa porque o selecionador favorece suas eespecificaçãoialidades. Introduza equilíbrio de oradores como funcionalidade do selecionador.

### Group chat vs supervisor

Mesmos primitives, padrões diferentes:

- Supervisor: um agente planeja e os outros executam. O selecionador é "perguntar ao planejador o que fazer".
- Group chat: todos os agentes são peers; o selecionador é uma função sobre o pool compartilhado.

Ambos usam os quatro primitives da Lição 04. Group chat usa orquestração selecionada por LLM e estado compartilhado de pool completo como padrão.

## Construa

`code/main.py` implementa um GroupChat do zero em stdlib. Três agentes (coder, reviewer, manager), variantes round-robin e selecionado por LLM, e terminação no token `TERMINATE`.

A demo imprime a transcrição da conversa mais o trace de decisão do selecionador para ambas as variantes.

Execute:

```
python3 code/main.py
```

## Use

`outputs/skill-groupchat-selector.md` configura um selecionador de GroupChat para uma tarefa dada — round-robin vs selecionado por LLM vs custom, e quais inputs do selecionador usar (mensagens recentes, eespecificaçãoialidades dos agents, contagem de turnos).

## Deploy

Checklist:

- **Limite de rodadas.** Sempre. 10-20 para tarefas típicas.
- **Métrica de equilíbrio de oradores.** Acompanhe turnos por agent; alerte quando o desequilíbrio ultrapassar um limite.
- **Token de terminação.** `TERMINATE` ou um agente verificador dedicado.
- **Projeção ou memória escopada.** Depois de ~10 mensagens, considere dar a cada agente apenas uma visão limitada para prevenir inchaço de contexto.
- **Logging do selecionador.** Para variantes selecionadas por LLM, registre tanto o input do selecionador quanto sua escolha. Caso contrário, debugar é impossível.

## Exercícios

1. Execute `code/main.py`. Compare a conversa sob round-robin vs selecionado por LLM. Qual agente domina em cada caso?
2. Adicione uma regra "máximo de falas por agent" no selecionador. Como isso afeta a transcrição?
3. Implemente uma terminação por objetivo atingido: pare quando o reviewer retornar "approved". Com que frequência isso dispara antes do limite de rodadas?
4. Leia os docs estáveis do AutoGen sobre GroupChat (https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/design-patterns/group-chat.html). Identifique o selecionador padrão usado pelo `GroupChatManager`.
5. Leia o repo do AG2 (https://github.com/ag2ai/ag2) e compare o GroupChat v0.2 com a versão event-driven v0.4. Qual propriedade concreta (throughput, tolerância a falhas, composabilidade) o v0.4 adiciona?

## Termos Chave

| Termo | O que a gente diz | O que realmente significa |
|-------|-------------------|--------------------------|
| GroupChat | "Agents numa sala de chat" | Pool de mensagens compartilhado + função selecionadora. Primitive AutoGen / AG2. |
| Speaker selection | "Quem fala depois" | A função que escolhe o próximo agent. Round-robin, selecionado por LLM ou custom. |
| GroupChatManager | "O moderador da reunião" | Componente AutoGen que controla o selecionador e itera sobre turnos. |
| ConversableAgent | "O agente base" | Classe base AutoGen; um agente que pode enviar e receber mensagens. |
| Termination token | "A palavra de 'parar'" | String sentinela (geralmente `TERMINATE`) que encerra o chat. |
| Hot speaker | "Um agente domina" | Modo de falha onde o selecionador fica escolhendo o mesmo agent. |
| Context bloat | "Pool cresce sem limite" | Cada agente lê cada mensagem anterior; contexto cresce com turnos. |
| Projection | "Visão escopada" | Visão eespecificaçãoífica por papel no pool compartilhado para prevenir inchaço de contexto.

## Leitura Complementar

- [Docs do AutoGen group chat](https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/design-patterns/group-chat.html) — a implementação de referência
- [Repo do AG2](https://github.com/ag2ai/ag2) — continuação comunitária do AutoGen v0.2
- [Docs do Microsoft Agent Framework](https://microsoft.github.io/agent-framework/) — o sucessor mesclado, RC fevereiro de 2026
- [Release notes do AutoGen v0.4](https://microsoft.github.io/autogen/stable/) — detalhes da reescrita event-driven
