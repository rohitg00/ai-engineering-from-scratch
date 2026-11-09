# ReWOO e Planeamento e Execução: Planeamento Desacoplado

> ReAct interliga pensamento e ação em um fluxo. ReWOO os separa: um grande plano de frente, em seguida, executar. 5x menos tokens, +4% de precisão no HotpotQA, e você pode destilar o planejador em um modelo 7B. Plan-and-Execute generalizou-o; Plan-and-Act escalado para a navegação na web.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop)
**Time:** ~60 minutes

## Objetivos de aprendizagem

- Explique por que a divisão Planner / Worker / Solver da ReWOO salva tokens e melhora a robustez sobre o loop interleaved da ReAct.
- Implementar um plano DAG, um executor de ordem dependência e um solvente que compõe as saídas de trabalho  todos os stdlib.
- Decidir quando uma tarefa deve ser executada como plano-depois-execução vs. ReAct interleaved, usando o enquadramento de 2026 "cinco padrões de fluxo de trabalho" (Antropic).
- Reconhecer quando os dados sintéticos do plano do Plan-and-Act são necessários para tarefas de longo prazo na web ou móveis.

## O problema

O loop de pensamento-ação-observação interligado do ReAct é simples e flexível, mas cada chamada de ferramenta tem que levar o contexto anterior completo  incluindo cada pensamento anterior. O uso de tokens cresce quadraticamente com a profundidade. Pior: quando uma ferramenta falha no meio do loop, o modelo tem que redirecionar todo o plano da observação de erro.

ReWOO (Xu et al., arXiv:2305.18323, maio 2023) notou isso e fez uma aposta: planejar a coisa toda com antecedência, buscar evidências em paralelo, compor a resposta no final. Uma chamada de LLM para planejar, N ferramenta pede evidências (pode ser paralelo), uma chamada de LLM para resolver. O comércio é menos flexibilidade (o plano é estático) para uma melhor eficiência de token e modos de falha mais claros.

## O conceito

### Os três papéis

```
Planner:  user_question -> [plan_dag]
Workers:  [plan_dag]     -> [evidence]        (tool calls, possibly parallel)
Solver:   user_question, plan_dag, evidence -> final_answer
```

Planner produz um DAG. Cada nó nomeia uma ferramenta, seus argumentos e quais nós anteriores dependem (referências como `#E1`- Não .`#E2`Os trabalhadores executam os nós em ordem topológica.

### Por que 5x menos tokens

O ReAct aumenta a comprimento do prompt linearmente com a contagem de passos. No passo 10, o prompt contém pensamento 1 mais ação 1 mais observação 1 mais pensamento 2 mais ação 2 mais observação 2, e assim por diante. Cada passo intermediário também inclui redundantemente o prompt original.

O ReWOO paga um plano de planejamento (grande), N pequenos trabalhadores (cada um apenas a chamada de ferramenta, sem cadeia), e um solver.

### Por que é mais robusto

Se o operador 3 falhar no ReAct, o loop tem que raciocinar a partir do erro no meio do fluxo. No ReWOO, o operador 3 retorna uma cadeia de erro; o resolvedor vê-a em contexto com o plano original e pode degradar graciosamente.

### Destilação de planeador

O segundo resultado do artigo: porque o planejador não vê observações, você pode ajustar um modelo 7B em saídas do planejador de um professor 175B. O modelo pequeno lida com o planejamento; o modelo grande não é necessário na inferência.

### Planejamento e execução (2023)

O post de agosto de 2023 da equipe da LangChain generalizou ReWOO em um nome de padrão: Planejar e executar. O planejador de frente emite uma lista de passos, o executor executa cada passo, um replaneador opcional pode revisar após observar os resultados. Isso é mais próximo do ReAct do que ReWOO (o replaneador traz as observações de volta ao planejamento), mas preserva as poupanças de token.

### Planos e Acto (Erdogan et al., arXiv:2503.09572, ICML 2025)

Plan-and-Act escala o padrão para agentes de web e móveis de longo horizonte. A contribuição chave são dados de planos sintéticos: um gerador de trajetória rotulado produz dados de treinamento onde o plano é explícito. Usado para ajustar os modelos de planejador que continuam trabalhando depois de 3050 passos em tarefas semelhantes à WebArena onde uma única trajetória ReAct perde coerência.

### Quando escolher qual

| Pattern | When |
|---------|------|
| ReAct | Short tasks, unknown environment, need reactive exception handling |
| ReWOO | Structured tasks with known tools, token-sensitive, parallelizable evidence |
| Plan-and-Execute | Like ReWOO but with replanning after partial execution |
| Plan-and-Act | Long-horizon (>30 steps), web/mobile/computer-use |
| Tree of Thoughts | Search is worth paying for (Lesson 04) |

A diretriz de Anthropic de dezembro de 2024: comece com o mais simples. Se a tarefa é uma chamada de ferramenta mais um resumo, não construa ReWOO. Se a tarefa é uma tarefa de pesquisa de 40 passos, não faça ReAct sozinho.

```figure
rewoo-plan
```

## Construí-lo

`code/main.py`Implementa um brinquedo ReWOO:

- `Planner` uma política escrita que emite um plano DAG a partir de um aviso.
- `Worker` Envia a chamada de ferramenta de cada nó através do registo.
- `Solver` composição escrita que lê evidências e produz uma resposta final.
- Resolução de dependência  referências como `#E1`são substituídos por resultados de trabalhadores anteriores.

A demonstração responde "Qual é a população da capital da França, redondeada em milhões?" usando um plano de duas etapas: (1) procurar a capital, (2) procurar a população, e depois resolver.

- É o que é ?

```
python3 code/main.py
npx tsx code/main.ts
```

O rastro mostra o plano completo primeiro, depois os resultados do trabalhador, depois a composição do solver. Compare a contagem de tokens (imprimiremos uma contagem de caracteres aproximada) com uma corrida interleaved de estilo ReAct  ReWOO ganha neste tipo de tarefa estruturada.

## Usá-lo

O LangGraph envia o Plan-and-Execute como receita (`create_react_agent`Para ReAct, gráficos personalizados para executar planos). Os fluxos da CrewAI codificam o padrão diretamente: você define tarefas de antemão e o Flow DAG as executa.

## Envia-o

`outputs/skill-rewoo-planner.md`gera um plano DAG do ReWOO a partir de uma solicitação do usuário, dado um catálogo de ferramentas. Valida o plano (acíclico, todas as referências resolvidas, todas as ferramentas existem) antes de entregar a um executor.

## Exercícios

1. Paralelamente execução de trabalhadores para nós de plano independente. O que é que você compra em um DAG de 6 nós com 2 grupos paralelos?
2. Adicione um nó de replanagem que dispara se um trabalhador retornar um erro. Qual é a menor mudança para ReWOO que faz com que seja Plane-and-Execute?
3. Substitui`Planner`com um modelo pequeno (classe 7B) e manter `Solver`Comparar qualidade de ponta a ponta  onde falha a divisão?
4. Leia a secção 4 do artigo da ReWOO sobre destilação de planeadores.
5. Portar o brinquedo para a forma de trajetória do Plano e Ação: plano é uma sequência, não um DAG. Que compensações mudam?

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| ReWOO | "Reasoning without observations" | Plan, then fetch evidence in parallel, then solve — no observations in the planning prompt |
| Plan-and-Execute | "LangChain's plan-execute pattern" | ReWOO with an optional replanner node after execution |
| Plan-and-Act | "Scaled plan-execute" | Explicit planner/executor split with synthetic plan training data for long-horizon tasks |
| Evidence reference | "#E1, #E2, ..." | Plan-node placeholder substituted with prior worker output at dispatch time |
| Planner distillation | "Small planner, big executor" | Fine-tune a small model on planner traces from a large teacher |
| Token efficiency | "Fewer round trips" | 5x fewer tokens on HotpotQA vs ReAct in the paper |
| DAG executor | "Topological dispatcher" | Runs plan nodes in dependency order; parallel at each level |

## Mais leitura

- [Xu et al., ReWOO: Decoupling Reasoning from Observations (arXiv:2305.18323)](https://arxiv.org/abs/2305.18323) o papel canônico
- [Erdogan et al., Plan-and-Act (arXiv:2503.09572)](https://arxiv.org/abs/2503.09572) Planeador-executor em escala com planos sintéticos
- [LangGraph Plan-and-Execute tutorial](https://docs.langchain.com/oss/python/langgraph/overview) a receita-quadro
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) escolher o padrão mais simples que funciona
