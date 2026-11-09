# Padrões de fluxo de trabalho da Anthropic: simples e mais complexos

> Schluntz e Zhang (Anthropic, Dec 2024) distinguem fluxos de trabalho (pistas predefinidas) de agentes (uso dinâmico de ferramentas). Cinco padrões de fluxo de trabalho cobrem a maioria dos casos. Comece com chamadas diretas de API. Adicione agentes apenas quando as etapas não podem ser previstas.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop)
**Time:** ~60 minutes

## Objetivos de aprendizagem

- Nomear os cinco padrões de fluxo de trabalho da Anthropic: cadeia de prompt, roteamento, paralelação, orquestor-trabalhadores, avaliador-optimizador.
- Explique a distinção entre o fluxo de trabalho e o custo de engenharia de cada um.
- Identificar quando escolher um fluxo de trabalho em vez de um agente (e vice-versa).
- Implementar os cinco padrões em STDlib contra um Mestrado em Direito.

## O problema

As equipes buscam quadros multi-agente para problemas que querem uma única chamada de função. O custo é real: os quadros adicionam camadas que obscurecem pedidos, escondem o fluxo de controle e convidam complexidade prematura. O post de Schluntz e Zhang de dezembro de 2024 é o retorno mais citado da indústria: comece simples, adicione complexidade apenas quando ganha seu custo.

## O conceito

### Fluxos de trabalho versus agentes

- **Workflow.**LLM e ferramentas orquestradas através de caminhos de código predefinidos.
- **Agent.**Os LLM dirigem dinâmicamente as suas próprias ferramentas e tomam os seus próprios passos.

Os fluxos de trabalho são mais baratos, mais rápidos e mais fáceis de depurar. Agentes desbloqueam problemas sem fim, mas tornam os modos de falha mais difíceis de raciocinar.

### O Mestrado em Direito e Direito

Fundamento para todos os cinco padrões: um LLM com três capacidades conectadas em busca (retorno), ferramentas (ações), memória (persistência).

### Os cinco padrões

1. **Prompt chaining.**A saída da chamada 1 é a entrada para a chamada 2. Utilize quando uma tarefa tem uma decomposição linear limpa. Portas programáticas opcionais entre etapas.

2. **Routing.**Um LLM classificador escolhe qual LLM ou ferramenta para invocar.

3. **Parallelization.**Execução de chamadas de N LLM simultâneas, resultados agregados. Duas formas: seccionamento (parcelações diferentes) e votação (o mesmo prompt, N runs, maioria/síntese).

4. **Orchestrator-workers.**Um LLM orquestador decide dinâmicamente quais trabalhadores (também LLM) executar e sintetiza sua produção.

5. **Evaluator-optimizer.**Um LLM propõe uma resposta, outro LLM avalia. Iterar até que o avaliador passe. Isto é auto-refinado (Lessão 05) generalizado.

### Onde os fluxos de trabalho vencem os agentes

- **Predictable tasks.**Se consegues enumerar os passos, devias.
- **Cost-bound tasks.**Os fluxos de trabalho têm números de passos limitados; os agentes podem circular.
- **Compliance-bound tasks.**Os auditores querem ler o gráfico, não inferir-lo a partir de trajetórias.

### Onde os agentes vencem os fluxos de trabalho

- **Open-ended research.**Quando o próximo passo depende do que o último passo retorna.
- **Variable-length tasks.**Minutos a horas de trabalho em que não se sabe o número de etapas.
- **Novel domains.**Quando ainda não conheces o fluxo de trabalho certo, primeiro explora, codifica depois.

### O companheiro de engenharia de contexto

"Effective context engineering for AI agents" (Anthropic 2025) formaliza a disciplina adjacente: a janela 200k é um orçamento, não um recipiente. O que incluir, quando compactar, quando deixar o contexto crescer. Coberto em detalhe na lição Fase 14 sobre compressão de contexto (Fase 14 lição 06 anterior neste currículo antes da renumeração).

```figure
workflow-chain
```

## Construí-lo

`code/main.py`Implementa os cinco padrões de fluxo de trabalho contra um `ScriptedLLM`- Não .

- `prompt_chain(input, steps)`- sequenciais.
- `route(input, classifier, handlers)` Classificação + expedição.
- `parallel_vote(prompt, n, aggregator)` N corridas, agregado.
- `orchestrator_workers(task, workers)`O orquestrador escolhe os trabalhadores.
- `evaluator_optimizer(task, proposer, evaluator, max_iter)` Loop até passar.

- É o que é ?

```
python3 code/main.py
npx tsx code/main.ts
```

Cada padrão imprime seu rastro. O total de linhas de código por padrão é de ~10-15; o custo de uma estrutura é medido em milhares.

## Usá-lo

- A API direta requer a maioria das tarefas.
- Framework apenas quando o padrão realmente precisa de estado durável (LangGraph), concurência entre modelo de ator (AutoGen v0.4), ou modelo de papel (CrewAI).
- Procure o SDK do Agente Claude quando quiser a forma do arsenal do código Claude sem reconstruí-lo.

## Envia-o

`outputs/skill-workflow-picker.md`seleciona o padrão adequado para uma determinada descrição de tarefa, incluindo a lógica da decisão e o caminho de refactor para um agente caso os fluxos de trabalho não sejam suficientes.

## Exercícios

1. Implementar roteamento com um limiar de confiança. Abaixo do limiar -> escala para humanos. Onde o limiar de aterrissagem para um caso de uso de suporte de nível 1?
2. Adicionar um timeout para `parallel_vote`O que acontece quando uma chamada é pendurada?
3. Vire .`evaluator_optimizer`para um bandido: manter as saídas dos dois primeiros em iterações para que um bom resultado tardío não seja sobreescrevido por um mau tardío.
4. Combine a cadeia de prompt com roteamento: um roteador escolhe uma das três cadeias.
5. Escolha uma das suas características de produção, desenhe o gráfico do fluxo de trabalho, conte os passos.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Workflow | "Predefined flow" | Engineer-owned graph of LLM and tool calls |
| Agent | "Autonomous AI" | Model-owned graph; dynamic tool direction |
| Augmented LLM | "LLM with tools" | LLM + search + tools + memory; the atomic unit |
| Prompt chaining | "Sequential calls" | Output of call N is input to call N+1 |
| Routing | "Classifier dispatch" | Pick which chain/model handles the input |
| Parallelization | "Fan out" | N concurrent calls; aggregate by sectioning or voting |
| Orchestrator-workers | "Dispatcher agent" | Orchestrator LLM picks specialist LLMs dynamically |
| Evaluator-optimizer | "Proposer + judge" | Iterate until evaluator passes; Self-Refine generalized |

## Mais leitura

- [Anthropic, Building Effective Agents (Dec 2024)](https://www.anthropic.com/research/building-effective-agents) os cinco padrões de fluxo de trabalho
- [Anthropic, Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) a disciplina do companheiro
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) quando os gráficos estatais ganham o seu custo
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/)O modelo de orquestração-trabalhador, produzido
