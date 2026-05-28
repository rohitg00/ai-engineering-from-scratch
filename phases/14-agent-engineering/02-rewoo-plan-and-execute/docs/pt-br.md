# ReWOO e Plan-and-Execute: Planejamento Desacoplado

> ReAct alterna pensamento e ação em um stream. ReWOO os separa: um plano grande na frente, depois executa. 5x menos tokens, +4% de acurácia no HotpotQA, e você pode destilar o planner num modelo de 7B. Plan-and-Execute generalizou; Plan-and-Act escalou pra navegação web.

**Tipo:** Construção
**Linguagens:** Python (stdlib)
**Pré-requisitos:** Fase 14 · 01 (Agent Loop)
**Tempo:** ~60 minutos

## Objetivos de Aprendizado

- Explicar por que a divisão Planner / Worker / Solver do ReWOO economiza tokens e melhora robustez comparado ao loop intercalado do ReAct.
- Implementar um DAG de plano, um executor com ordem dependente e um solver que compõe saídas dos workers — tudo com stdlib.
- Decidir quando uma tarefa deve rodar como plan-then-execute vs ReAct intercalado, usando o framing de 2026 dos "cinco padrões de workflow" (Anthropic).
- Reconhecer quando dados de plano sintético do Plan-and-Act são necessários pra tarefas web ou mobile de longo horizonte.

## O Problema

O loop intercalado de pensamento-ação-observação do ReAct é simples e flexível, mas cada chamada de ferramenta tem que carregar todo o contexto anterior — incluindo cada pensamento anterior. Uso de tokens cresce quadraticamente com a profundidade. Pior: quando uma ferramenta falha no meio do loop, o modelo tem que re-derivar o plano inteiro a partir da observação de erro.

ReWOO (Xu et al., arXiv:2305.18323, Maio 2023) notou isso e fez uma aposta: planeja tudo na frente, busca evidências em paralelo, compõe a resposta no final. Uma chamada de LLM pra planejar, N chamadas de ferramenta pra evidências (podem ser paralelas), uma chamada de LLM pra resolver. A troca é menos flexibilidade (o plano é estático) por muito mais eficiência em tokens e modos de falha mais claros.

## O Conceito

### Os três papéis

```
Planner:  user_question -> [plan_dag]
Workers:  [plan_dag]     -> [evidence]        (tool calls, possibly parallel)
Solver:   user_question, plan_dag, evidence -> final_answer
```

O Planner produz um DAG. Cada nó nomeia uma ferramenta, seus argumentos e de quais nós anteriores depende (referências como `#E1`, `#E2`). Workers executam nós em ordem topológica. Solver costura tudo junto.

### Por que 5x menos tokens

ReAct cresce o comprimento do prompt linearmente com o número de etapas. Na etapa 10, o prompt contém pensamento 1 + ação 1 + observação 1 + pensamento 2 + ação 2 + observação 2, e assim por diante. Cada etapa intermediária também inclui redundante e prompt original.

ReWOO paga um prompt do planner (grande), N prompts pequenos dos workers (cada um só a chamada de ferramenta, sem cadeia) e um prompt do solver. No HotpotQA o paper mede ~5x menos tokens enquanto pontua +4 de acurácia absoluta.

### Por que é mais robusto

Se o worker 3 falha no ReAct, o loop tem que raciocinar pra sair do erro no meio do fluxo. No ReWOO, o worker 3 retorna uma string de erro; o solver vê ela no contexto com o plano original e pode degradar graciosamente. Localização de falha é por nó, não por etapa.

### Destilação do planner

O segundo resultado do paper: como o planner não vê observações, você pode fine-tunar um modelo de 7B com saídas do planner de um professor de 175B. O modelo pequeno cuida do planejamento; o modelo grande não é necessário na inferência. Isso agora é padrão — muitos agentes de produção de 2026 usam um planner pequeno e um executor grande ou vice-versa.

### Plan-and-Execute (LangChain, 2023)

O post de agosto de 2023 da equipe do LangChain generalizou o ReWOO num nome de padrão: Plan-and-Execute. Planner na frente emite uma lista de etapas, executor roda cada etapa, um replanner opcional pode revisar após observar resultados. Isso é mais perto de ReAct que ReWOO (o replanner traz observações de volta pro planejamento) mas preserva a economia de tokens.

### Plan-and-Act (Erdogan et al., arXiv:2503.09572, ICML 2025)

Plan-and-Act escala o padrão pra agentes web e mobile de longo horizonte. A contribuição-chave são dados de plano sintético: um gerador de trajectory rotulada produz dados de treino onde o plano é explícito. Usado pra fine-tunar modelos de planner que continuam funcionando passando de 30–50 etapas em tarefas estilo WebArena onde uma trajectory única de ReAct perde coerência.

### Quando escolher qual

| Padrão | Quando |
|---------|--------|
| ReAct | Tarefas curtas, ambiente desconhecido, tratamento reativo de exceções |
| ReWOO | Tarefas estruturadas com ferramentas conhecidas, sensível a tokens, evidências paralelizáveis |
| Plan-and-Execute | Como ReWOO mas com replanejamento após execução parcial |
| Plan-and-Act | Longo horizonte (>30 etapas), web/mobile/computer-use |
| Tree of Thoughts | Busca vale o custo em tokens (Aula 04) |

Orientação da Anthropic de Dez 2024: comece com o mais simples. Se a tarefa é uma chamada de ferramenta + um resumo, não construa ReWOO. Se a tarefa é um trabalho de pesquisa de 40 etapas, não faça só ReAct.

## Construa

`code/main.py` implementa um ReWOO de exemplo:

- `Planner` — uma política programada que emite um DAG de plano a partir de um prompt.
- `Worker` — despacha a chamada de ferramenta de cada nó via o registro.
- `Solver` — composição programada que lê evidências e produz uma resposta final.
- Resolução de dependências — referências como `#E1` são substituídas por saídas de workers anteriores.

A demo responde "Qual é a população da capital da France, arredondada pra milhões?" usando um plano de duas etapas: (1) buscar a capital, (2) buscar a população, depois resolver.

Rode:

```
python3 code/main.py
```

O trace mostra o plano completo primeiro, depois resultados dos workers, depois a composição do solver. Compare a contagem de tokens (imprimimos uma contagem aproximada de caracteres) com uma execução intercalada estilo ReAct — ReWOO ganha nesse tipo de tarefa estruturada.

## Use

LangGraph entrega Plan-and-Execute como receita (`create_react_agent` pra ReAct, grafos customizados pra plan-execute). Flows do CrewAI codificam o padrão diretamente: você define tarefas na frente e o DAG do Flow executa. A abordagem de dados sintéticos do Plan-and-Act ainda é em sua maioria pesquisa; o padrão de runtime (DAG de plano explícito) é entregue em produção via LangGraph e Flows do CrewAI.

## Entregue

`outputs/skill-rewoo-planner.md` gera um DAG de plano ReWOO a partir de um pedido do usuário, dado um catálogo de ferramentas. Valida o plano (acíclico, toda referência resolvida, toda ferramenta existe) antes de passar pro executor.

## Exercícios

1. Paralelize a execução de workers pra nós de plano independentes. O que você ganha num DAG de 6 nós com 2 grupos paralelos?
2. Adicione um nó replanner que dispara se qualquer worker retornar erro. Qual é a menor mudança no ReWOO que o torna Plan-and-Execute?
3. Substitua o `Planner` por um modelo pequeno (classe 7B) e mantenha o `Solver` num modelo frontier. Compare qualidade de ponta a ponta — onde a divisão falha?
4. Leia a Seção 4 do paper do ReWOO sobre destilação do planner. Reproduza o resultado 175B -> 7B conceitualmente: quais dados de treino você precisa e como você pontua qualidade do plano?
5. Porte o exemplo pra forma de trajectory do Plan-and-Act: plano é uma sequência, não um DAG. Quais tradeoffs mudam?

## Termos-Chave

| Termo | O que a galera fala | O que realmente significa |
|-------|---------------------|---------------------------|
| ReWOO | "Raciocínio sem observações" | Planeja, depois busca evidências em paralelo, depois resolve — sem observações no prompt do planner |
| Plan-and-Execute | "Padrão plan-execute do LangChain" | ReWOO com nó replanner opcional após execução |
| Plan-and-Act | "Plan-execute escalado" | Divisão explícita planner/executor com dados de treino de plano sintético pra tarefas de longo horizonte |
| Evidence reference | "#E1, #E2, ..." | Placeholder de nó de plano substituído pela saída de worker anterior no despacho |
| Planner distillation | "Planner pequeno, executor grande" | Fine-tune de modelo pequeno em traces de planner de um grande professor |
| Token efficiency | "Menos idas e vindas" | 5x menos tokens no HotpotQA vs ReAct no paper |
| DAG executor | "Despachante topológico" | Roda nós de plano em ordem de dependência; paralelo em cada nível |

## Leitura Complementar

- [Xu et al., ReWOO: Decoupling Reasoning from Observations (arXiv:2305.18323)](https://arxiv.org/abs/2305.18323) — o paper canônico
- [Erdogan et al., Plan-and-Act (arXiv:2503.09572)](https://arxiv.org/abs/2503.09572) — planner-executor escalado com planos sintéticos
- [LangGraph Plan-and-Execute tutorial](https://docs.langchain.com/oss/python/langgraph/overview) — a receita do framework
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) — escolha o padrão mais simples que funciona
