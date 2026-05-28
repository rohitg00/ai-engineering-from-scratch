# Por que Multi-Agent?

> Um agente bate na parede. A jogada inteligente não é um agente maior — são mais agents.

**Tipo:** Aprender
**Linguagens:** TypeScript
**Pré-requisitos:** Fase 14 (Agent Engineering)
**Tempo:** ~60 minutos

## Objetivos de Aprendizado

- Identificar o teto de agente único (overflow de contexto, expertise misturada, gargalo sequencial) e explicar quando dividir em múltiplos agentes é a jogada certa
- Comparar padrões de orquestração (pipeline, fan-out paralelo, supervisor, hierárquico) e selecionar o certo para uma dada estrutura de tarefa
- Projetar um sistema multi-agent com limites de papéis claros, estado compartilhado e um contrato de comunicação
- Analisar os tradeoffs da complexidade multi-agent (latência, custo, dificuldade de debug) vs. a simplicidade de agente único

## O Problema

Você construiu um agente único na Fase 14. Funciona. Ele lê arquivos, roda comandos, chama APIs e raciocina sobre resultados. Aí você aponta ele pra um codebase real: 200 arquivos, três linguagens, testes que dependem de infraestrutura, e um requisito de pesquisar APIs externas antes de escrever código.

O agente engasga. Não porque o LLM é burro, mas porque a tarefa excede o que um loop de agente consegue lidar. A janela de contexto enche com conteúdo de arquivos. O agente esquece o que leu 40 ferramenta calls atrás. Ele tenta ser pesquisador, programador e reviewer ao mesmo tempo, e faz os três mal.

Esse é o teto de agente único. Você bate nele toda vez que uma tarefa precisa de:

- **Mais contexto do que cabe em uma janela** — ler 50 arquivos passa de 200k tokens
- **Expertises diferentes em estágios diferentes** — pesquisa exige prompts diferentes de geração de código
- **Trabalho que pode acontecer em paralelo** — por que ler três arquivos em sequência quando dá pra ler todos ao mesmo tempo?

## O Conceito

### O Teto de Agent Único

Um agente único é um loop, uma janela de contexto, um system prompt. Visualiza:

```
┌─────────────────────────────────────────┐
│            SINGLE AGENT                 │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │         Context Window            │  │
│  │                                   │  │
│  │  research notes                   │  │
│  │  + code files                     │  │
│  │  + test output                    │  │
│  │  + review feedback                │  │
│  │  + API docs                       │  │
│  │  + ...                            │  │
│  │                                   │  │
│  │  ██████████████████████ FULL ███  │  │
│  └───────────────────────────────────┘  │
│                                         │
│  One system prompt tries to cover       │
│  research + coding + review + testing   │
│                                         │
│  Result: mediocre at everything         │
└─────────────────────────────────────────┘
```

Três coisas quebram:

1. **Saturação de contexto** — resultados de ferramentas se acumulam. No turno 30, o agente já consumiu 150k tokens de conteúdo de arquivos, saídas de comandos e raciocínio anterior. Detalhes críticos do turno 5 se perdem.

2. **Confusão de papel** — um system prompt que diz "você é pesquisador, programador, reviewer e tester" produz um agente que meio que pesquisa, meio que programa e nunca termina de revisar.

3. **Gargalo sequencial** — o agente lê o arquivo A, depois o B, depois o C. Três chamadas LLM em série. Três execuções de ferramentas em série. Sem paralelismo.

### A Solução Multi-Agent

Divida o trabalho. Dê a cada agente um trabalho, uma janela de contexto e um system prompt calibrado pra esse trabalho:

```
┌──────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR                          │
│                                                          │
│  "Build a REST API for user management"                  │
│                                                          │
│         ┌──────────┬──────────┬──────────┐               │
│         │          │          │          │               │
│         ▼          ▼          ▼          ▼               │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│   │RESEARCHER│ │  CODER   │ │ REVIEWER │ │  TESTER  │  │
│   │          │ │          │ │          │ │          │  │
│   │ Reads    │ │ Writes   │ │ Checks   │ │ Runs     │  │
│   │ docs,    │ │ code     │ │ code     │ │ tests,   │  │
│   │ finds    │ │ based on │ │ quality, │ │ reports  │  │
│   │ patterns │ │ research │ │ finds    │ │ results  │  │
│   │          │ │ + especificação   │ │ bugs     │ │          │  │
│   └─────┬────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘  │
│         │           │            │             │         │
│         └───────────┴────────────┴─────────────┘         │
│                          │                               │
│                     Merge results                        │
└──────────────────────────────────────────────────────────┘
```

Cada agente tem:
- Um system prompt focado ("Você é um code reviewer. Seu único trabalho é achar bugs.")
- Sua própria janela de contexto (não poluída pelo trabalho de outros agents)
- Um contrato claro de entrada/saída (recebe notas de pesquisa, retorna código)

### Sistemas Reais Que Fazem Isso

**Claude Code subagents** — quando o Claude Code gera um subagent com `Task`, ele cria um agente filho com uma tarefa escopada. O pai mantém seu contexto limpo. O filho faz trabalho focado e retorna um resumo.

**Devin** — roda um agente planejador, um agente programador e um agente navegador. O planejador divide o trabalho em passos. O programador escreve código. O navegador pesquisa documentação. Cada um tem contexto separado.

**Multi-agent coding teams (SWE-bench)** — os sistemas de melhor desempenho no SWE-bench usam um pesquisador que lê o codebase, um planejador que projeta o fix e um programador que implementa. Sistemas de agente único pontuam menos.

**ChatGPT Deep Research** — gera múltiplos agentes de busca em paralelo, cada um explorando um ângulo diferente, depois sintetiza os resultados.

### O Eespecificaçãotro

Multi-agent não é binário. É um eespecificaçãotro:

```
SIMPLE ──────────────────────────────────────────── COMPLEX

 Single        Sub-         Pipeline      Team         Swarm
 Agent         agents

 ┌───┐       ┌───┐        ┌───┐───┐    ┌───┐───┐    ┌─┐┌─┐┌─┐
 │ A │       │ A │        │ A │ B │    │ A │ B │    │ ││ ││ │
 └───┘       └─┬─┘        └───┘─┬─┘    └─┬─┘─┬─┘    └┬┘└┬┘└┬┘
               │                │        │   │       ┌┴──┴──┴┐
             ┌─┴─┐          ┌───┘───┐    │   │       │shared │
             │ a │          │ C │ D │  ┌─┴───┴─┐    │ state │
             └───┘          └───┘───┘  │  msg   │    └───────┘
                                       │  bus   │
 1 loop      Parent +      Stage by    │       │    N peers,
 1 context   child tasks   stage       └───────┘    emergent
                                       Explicit      behavior
                                       roles
```

**Agent único** — um loop, um prompt. Bom pra tarefas simples.

**Subagents** — um pai gera filhos pra subtarefas focadas. O pai mantém o plano. Os filhos reportam de volta. Isso é o que o Claude Code faz.

**Pipeline** — agentes rodam em sequência. A saída do Agent A vira a entrada do Agent B. Bom pra workflows por estágios: pesquisa -> código -> review -> teste.

**Team** — agentes rodam em paralelo com um message bus compartilhado. Cada um tem um papel. Um orquestrador coordena. Bom quando habilidades diferentes são necessárias ao mesmo tempo.

**Swarm** — muitos agentes idênticos ou quase idênticos com estado compartilhado. Sem orquestrador fixo. Agents pegam trabalho de uma fila. Bom pra tarefas paralelas de alta taxa de transferência.

### Os Quatro Padrões Multi-Agent

#### Padrão 1: Pipeline

```
Input ──▶ Agent A ──▶ Agent B ──▶ Agent C ──▶ Output
          (research)  (code)      (review)
```

Cada agente transforma os dados e passa pra frente. Fácil de raciocinar. Falha num estágio bloqueia os outros.

#### Padrão 2: Fan-out / Fan-in

```
                ┌──▶ Agent A ──┐
                │              │
Input ──▶ Split ├──▶ Agent B ──├──▶ Merge ──▶ Output
                │              │
                └──▶ Agent C ──┘
```

Divide trabalho entre agentes paralelos, depois combina resultados. Bom pra tarefas que se decompõem em subtarefas independentes.

#### Padrão 3: Orquestrador-Trabalhador

```
                    ┌──────────┐
                    │  Orch.   │
                    └──┬───┬───┘
                  task │   │ task
                 ┌─────┘   └─────┐
                 ▼               ▼
           ┌──────────┐   ┌──────────┐
           │ Worker A │   │ Worker B │
           └──────────┘   └──────────┘
```

Um orquestrador inteligente decide o que fazer, delega pra trabalhadores e sintetiza resultados. O orquestrador em si é um agente com ferramentas pra gerar trabalhadores.

#### Padrão 4: Swarm entre Pares

```
         ┌───┐ ◄──── msg ────▶ ┌───┐
         │ A │                  │ B │
         └─┬─┘                  └─┬─┘
           │                      │
      msg  │    ┌───────────┐     │ msg
           └───▶│  Shared   │◄────┘
                │  State    │
           ┌───▶│  / Queue  │◄────┐
           │    └───────────┘     │
      msg  │                      │ msg
         ┌─┴─┐                  ┌─┴─┐
         │ C │ ◄──── msg ────▶ │ D │
         └───┘                  └───┘
```

Sem orquestrador central. Agents comunicam peer-to-peer. Decisões emergem da interação. Mais difícil de debugar, mas escala pra muitos agents.

### Quando NÃO Usar Multi-Agent

Multi-agent adiciona complexidade. Cada mensagem entre agentes é um ponto potencial de falha. Debugar vai de "ler uma conversa" pra "rastrear mensagens entre cinco agents."

**Fique com agente único quando:**
- A tarefa cabe em uma janela de contexto (menos de ~100k tokens de dados de trabalho)
- Você não precisa de system prompts diferentes pra diferentes estágios
- Execução sequencial é rápida o suficiente
- A tarefa é simples o suficiente que dividir adiciona mais overhead do que valor

**O custo da complexidade:**
- Cada fronteira de agente é um passo de compressão lossy: o contexto completo do agente A é resumido numa mensagem pro agente B
- Lógica de coordenação (quem faz o quê, quando, em que ordem) é uma fonte própria de bugs
- Latência aumenta: N agentes significa N chamadas LLM em série no mínimo, mais se precisam conversar de volta e forth
- Custo multiplica: cada agente consome tokens independentemente

Regra geral: se uma tarefa leva menos de 20 ferramenta calls e cabe em 100k tokens, mantenha como agente único.

## Construa

### Passo 1: O Agent Único Sobrecarregado

Aqui está um agente único tentando fazer tudo. Ele tem um system prompt enorme e uma janela de contexto com pesquisa, código e reviews:

```typescript
type AgentResult = {
  content: string;
  tokensUsed: number;
  toolCalls: number;
};

async function singleAgentApproach(task: string): Promise<AgentResult> {
  const systemPrompt = `You are a full-stack developer. You must:
1. Research the requirements
2. Write the code
3. Review the code for bugs
4. Write tests
Do ALL of these in a single conversation.`;

  const contextWindow: string[] = [];
  let totalTokens = 0;
  let totalToolCalls = 0;

  const research = await fakeLLMCall(systemPrompt, `Research: ${task}`);
  contextWindow.push(research.output);
  totalTokens += research.tokens;
  totalToolCalls += research.calls;

  const code = await fakeLLMCall(
    systemPrompt,
    `Given this research:\n${contextWindow.join("\n")}\n\nNow write code for: ${task}`
  );
  contextWindow.push(code.output);
  totalTokens += code.tokens;
  totalToolCalls += code.calls;

  const review = await fakeLLMCall(
    systemPrompt,
    `Given all previous context:\n${contextWindow.join("\n")}\n\nReview the code.`
  );
  contextWindow.push(review.output);
  totalTokens += review.tokens;
  totalToolCalls += review.calls;

  return {
    content: contextWindow.join("\n---\n"),
    tokensUsed: totalTokens,
    toolCalls: totalToolCalls,
  };
}
```

Problemas dessa abordagem:
- A janela de contexto cresce a cada estágio. No passo de review, ela contém notas de pesquisa E código E raciocínio anterior.
- O system prompt é genérico. Não pode ser calibrado pra cada estágio.
- Nada roda em paralelo.

### Passo 2: Agents Eespecificaçãoialistas

Agora divide. Cada agente recebe um trabalho:

```typescript
type SpecialistAgent = {
  name: string;
  systemPrompt: string;
  run: (input: string) => Promise<AgentResult>;
};

function createSpecialist(name: string, systemPrompt: string): SpecialistAgent {
  return {
    name,
    systemPrompt,
    run: async (input: string) => {
      const result = await fakeLLMCall(systemPrompt, input);
      return {
        content: result.output,
        tokensUsed: result.tokens,
        toolCalls: result.calls,
      };
    },
  };
}

const researcher = createSpecialist(
  "researcher",
  "You are a technical researcher. Read documentation, find patterns, and summarize findings. Output only the facts needed for implementation."
);

const coder = createSpecialist(
  "coder",
  "You are a senior TypeScript developer. Given requirements and research notes, write clean, tested code. Nothing else."
);

const reviewer = createSpecialist(
  "reviewer",
  "You are a code reviewer. Find bugs, security issues, and logic errors. Be especificaçãoific. Cite line numbers."
);
```

Cada eespecificaçãoialista tem um prompt focado. Cada um recebe uma janela de contexto limpa com só a entrada que precisa.

### Passo 3: Coordenar por Mensagens

Conecte os eespecificaçãoialistas com passagem explícita de mensagens:

```typescript
type AgentMessage = {
  from: string;
  to: string;
  content: string;
  timestamp: number;
};

async function multiAgentApproach(task: string): Promise<AgentResult> {
  const messages: AgentMessage[] = [];
  let totalTokens = 0;
  let totalToolCalls = 0;

  const researchResult = await researcher.run(task);
  messages.push({
    from: "researcher",
    to: "coder",
    content: researchResult.content,
    timestamp: Date.now(),
  });
  totalTokens += researchResult.tokensUsed;
  totalToolCalls += researchResult.toolCalls;

  const coderInput = messages
    .filter((m) => m.to === "coder")
    .map((m) => `[From ${m.from}]: ${m.content}`)
    .join("\n");

  const codeResult = await coder.run(coderInput);
  messages.push({
    from: "coder",
    to: "reviewer",
    content: codeResult.content,
    timestamp: Date.now(),
  });
  totalTokens += codeResult.tokensUsed;
  totalToolCalls += codeResult.toolCalls;

  const reviewerInput = messages
    .filter((m) => m.to === "reviewer")
    .map((m) => `[From ${m.from}]: ${m.content}`)
    .join("\n");

  const reviewResult = await reviewer.run(reviewerInput);
  messages.push({
    from: "reviewer",
    to: "orchestrator",
    content: reviewResult.content,
    timestamp: Date.now(),
  });
  totalTokens += reviewResult.tokensUsed;
  totalToolCalls += reviewResult.toolCalls;

  return {
    content: messages.map((m) => `[${m.from} -> ${m.to}]: ${m.content}`).join("\n\n"),
    tokensUsed: totalTokens,
    toolCalls: totalToolCalls,
  };
}
```

Cada agente recebe só as mensagens dirigidas a ele. Sem poluição de contexto. Os 50k tokens de leitura de documentação do pesquisador nunca entram no contexto do reviewer.

### Passo 4: Compare

```typescript
async function compare() {
  const task = "Build a rate limiter middleware for an Express.js API";

  console.log("=== Single Agent ===");
  const single = await singleAgentApproach(task);
  console.log(`Tokens: ${single.tokensUsed}`);
  console.log(`Tool calls: ${single.toolCalls}`);

  console.log("\n=== Multi-Agent ===");
  const multi = await multiAgentApproach(task);
  console.log(`Tokens: ${multi.tokensUsed}`);
  console.log(`Tool calls: ${multi.toolCalls}`);
}
```

A versão multi-agent usa mais tokens no total (três agents, três chamadas LLM separadas), mas o contexto de cada agente fica limpo. A qualidade de cada estágio melhora porque o system prompt é eespecificaçãoializado.

## Use

Esta lição produz um prompt reutilizável pra decidir quando ir com multi-agent. Veja `outputs/prompt-multi-agent-decision.md`.

## Exercícios

1. Adicione um quarto eespecificaçãoialista: um agente "tester" que recebe código do programador e feedback do reviewer, e escreve testes
2. Modifique o pipeline pra que o reviewer possa mandar feedback de volta pro programador pra um loop de revisão (máx 2 rodadas)
3. Converta o pipeline sequencial em um fan-out: rode o pesquisador e um agente "analisador de requisitos" em paralelo, depois combine suas saídas antes de passar pro programador

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| Swarm | "Uma mente colmeia de agentes de IA" | Um conjunto de agentes pares com estado compartilhado e sem líder fixo. O comportamento emerge de interações locais. |
| Orquestrador | "O agente chefe" | Um agente cujas ferramentas incluem gerar e gerenciar outros agents. Planeja e delega mas pode não fazer o trabalho em si. |
| Coordenador | "O policial de trânsito" | Um componente não-agent (geralmente só código, não um LLM) que roteia mensagens entre agentes baseado em regras. |
| Consenso | "Os agentes concordam" | Um protocolo onde múltiplos agentes devem chegar a um acordo antes de prosseguir. Usado quando saídas conflitantes precisam de resolução. |
| Comportamento emergente | "Os agentes se viraram sozinhos" | Padrões a nível de sistema que surgem de interações entre agentes mas não foram programados explicitamente. Pode ser útil ou prejudicial. |
| Fan-out / fan-in | "Map-reduce pra agents" | Dividir uma tarefa entre agentes paralelos (fan-out), depois combinar seus resultados (fan-in). |
| Passagem de mensagens | "Agents conversam entre si" | O mecanismo de comunicação entre agents: dados estruturados enviados de um agente pro outro, substituindo janelas de contexto compartilhadas. |

## Leitura Complementar

- [The Landscape of Emerging AI Agent Architectures](https://arxiv.org/abs/2409.02977) - survey de padrões multi-agent
- [AutoGen: Enabling Next-Gen LLM Applications](https://arxiv.org/abs/2308.08155) - framework de conversação multi-agent da Microsoft
- [Documentação dos subagents do Claude Code](https://docs.anthropic.com/en/docs/claude-code) - como o Claude Code delega com Task
- [Documentação do CrewAI](https://docs.crewai.com/) - framework multi-agent baseado em papéis
