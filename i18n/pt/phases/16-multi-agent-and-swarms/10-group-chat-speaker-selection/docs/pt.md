# Seleção de grupos de conversa e oradores

> A orquestração de conversa compartilhada coloca N agentes em uma conversa; uma função selecionadora (LLM, round-robin ou custom) escolhe quem fala a seguir. Este é o arquétipo da conversa emergente multi-agente. Os agentes não sabem o seu papel num gráfico estático, eles apenas reagem ao pool compartilhado. AutoGen GroupChat e AG2 GroupChat são as implementações de referência: a semântica do GroupChat do AutoGen v0.2 foi preservada no garfo AG2; AutoGen v0.4 o reescreveu como um modelo de ator orientado por eventos. A Microsoft colocou o AutoGen em modo de manutenção em fevereiro de 2026 e o fundiu com o Kernel Semântico no Microsoft Agent Framework (RC fevereiro de 2026). O primitivo do GroupChat sobrevive tanto no AG2 quanto no Microsoft Agent Framework. Aprenda uma vez, use em todos os lugares.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 04 (Primitive Model)
**Time:** ~60 minutes

## Problemas

Os gráficos estáticos (LangGraph) são ótimos quando o fluxo de trabalho é conhecido. As conversas reais não são estáticas: às vezes o programador pergunta ao revisor, às vezes o pesquisador, às vezes o escritor. A codificação em ar condicionado de cada possível transferência produz uma explosão de borda. Você quer que * agentes reagam a um pool compartilhado*, com alguma função decidindo quem fala a seguir.

É exatamente isso que o AutoGen GroupChat faz.

## Conceptos

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

Cada agente vê todas as mensagens, e uma função selecionadora é invocada em cada turno para escolher quem fala a seguir.

### Os três sabores selectores

**Round-robin.**Ciclo fixo. Determinista. Escala linearmente em N mas ignora o contexto  um codificador recebe a volta mesmo quando o tópico é revisão legal.

**LLM-selected.**Uma chamada para um LLM que lê o pool recente e retorna o melhor próximo orador. Consciente do contexto, mas lento: a cada turno adiciona uma chamada de LLM.

**Custom.**Uma função Python com qualquer lógica que você deseja. Típica: LLM-selecionado com regras de fallback (por exemplo, "sempre dar ao verificador a volta após o codificador").

### A API do Agente Conversable

```
agent = ConversableAgent(
    name="coder",
    system_message="You write Python.",
    llm_config={...},
)
chat = GroupChat(agents=[coder, reviewer, tester], messages=[])
manager = GroupChatManager(groupchat=chat, llm_config={...})
```

`GroupChatManager`Quando um agente completa uma volta, o gerente chama o selector, que retorna o próximo agente.

### Cessão

Três padrões comuns:

- **Max rounds.**Capeta dura em viradas totais.
- **"TERMINATE" token.**Os agentes podem emitir uma mensagem sentinela; o gerente parou quando apareceu.
- **Goal-reached check.**Um verificador leve corre a cada turno e pára o bate-papo quando terminado.

### Linhagem: forças e fusões

No início de 2025, a Microsoft começou uma grande reescritura do AutoGen (v0.4) em torno de um modelo de ator orientado a eventos. A comunidade forcou a semântica GroupChat do AutoGen v0.2 como AG2, preservando a API que os primeiros adotadores tinham integrado.

Em fevereiro de 2026, a Microsoft anunciou que o AutoGen iria entrar em modo de manutenção, com o modelo de ator orientado por eventos se fundindo em **Microsoft Agent Framework**(RC fevereiro 2026, agora fundido com o Kernel Semantic). O conceito de GroupChat sobrevive em ambas as faixas; os detalhes de implementação diferem. AG2 é o código preferido para o upstream para o código compatível com v0.2.

### Quando o GroupChat se encaixa

- **Emergent conversations.**Não quer pre-cablear todos os possíveis próximos alto-falantes.
- **Role-mixing tasks.**O codificador pede ao pesquisador, o pesquisador pede ao arquivo, o arquivo pede ao codificador de volta.
- **Exploratory problem-solving.**Pensa em "reunião de tempestade cerebral", não em "linha de montagem".

### Quando falha

- **Strict determinism.**O selector de LLM pode ser inconsistente, o mesmo prompt, diferentes corridas, diferentes oradores próximos.
- **Sycophancy cascades.**Os agentes deferem-se a quem falar com mais confiança.
- **Context bloat.**Cada agente lê cada mensagem; depois de 10 voltas, o contexto é enorme.
- **Hot speakers.**Um agente domina a conversa porque o selector favorece suas especialidades.

### Chat de grupo vs supervisor

Os mesmos primitivos, diferentes padrões:

- Supervisor: um agente planeja e outros executam.
- Chat em grupo: todos os agentes são pares; selector é uma função sobre o pool compartilhado.

Ambos usam os quatro primitivos da lição 04.

```figure
swarm-speaker
```

## Construí-lo

`code/main.py`O programa de discussão é um programa de discussão de grupos que permite a criação de um grupo de conversas de forma a permitir a criação de um grupo de conversas de grupos.`TERMINATE`- O sinal.

A demonstração imprime a transcrição da conversa, mais o rastro de decisão do selector para ambas as variantes.

- Correr .

```
python3 code/main.py
npx tsx code/main.ts
```

## Usá-lo

`outputs/skill-groupchat-selector.md`configura um selector GroupChat para uma determinada tarefa  round-robin vs LLM-selected vs custom, e quais entradas do selector (mensagens recentes, especialidades de agente, contagens de viradas) para usar.

## Envia-o

Lista de verificação:

- **Max rounds cap.**Sempre. 10 a 20 para tarefas típicas.
- **Speaker-balance metric.**As rotas de pista por agente; alerta quando o desequilíbrio excede um limiar.
- **Termination token.** `TERMINATE`ou um agente verificador dedicado.
- **Projection or scoped memory.**Após ~ 10 mensagens, considere dar a cada agente apenas uma visão de alcance para evitar o conteúdo inflado.
- **Selector logging.**Para as variantes selecionadas pelo LLM, registre tanto a entrada do selector quanto a sua escolha.

## Exercícios

1. Corra .`code/main.py`Comparar a conversa entre um round-robin e um LLM selecionado.
2. Adicione uma regra de "max-speaks-per-agent" no selector.
3. Implementar uma terminação atingida: parar quando o revisor retornar "aprovado".
4. Leia os documentos estáveis do AutoGen no GroupChat (https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/design-patterns/group-chat.html ). Identificar o selector padrão utilizado por `GroupChatManager`- Não .
5. Leia o repo AG2 (https://github.com/ag2ai/ag2O que é que a versão v0.4 adiciona?

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| GroupChat | "Agents in one chat room" | Shared message pool + selector function. AutoGen / AG2 primitive. |
| Speaker selection | "Who talks next" | The function that picks the next agent. Round-robin, LLM-selected, or custom. |
| GroupChatManager | "The meeting host" | AutoGen component that owns the selector and loops over turns. |
| ConversableAgent | "The base agent" | AutoGen base class; an agent that can send and receive messages. |
| Termination token | "The 'stop' word" | Sentinel string (usually `TERMINATE`) that ends the chat. |
| Hot speaker | "One agent dominates" | Failure mode where the selector keeps picking the same agent. |
| Context bloat | "Pool grows unbounded" | Each agent reads every prior message; context grows with turns. |
| Projection | "Scoped view" | Role-specific view into the shared pool to prevent context bloat. |

## Mais leitura

- [AutoGen group chat docs](https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/design-patterns/group-chat.html) a execução de referência
- [AG2 repo](https://github.com/ag2ai/ag2) comunidade AutoGen v0.2 continuação
- [Microsoft Agent Framework docs](https://learn.microsoft.com/en-us/agent-framework/) Sucessor fundido, RC Fevereiro 2026
- [AutoGen v0.4 release notes](https://microsoft.github.io/autogen/stable/) Detalhes de reescritura do modelo de ator orientado para eventos
