# Padrões de Workflow da Anthropic: Simples Sobre Complexo

> Schluntz e Zhang (Anthropic, Dez 2024) distinguem workflows (caminhos predefinidos) de agentes (uso dinâmico de ferramentas). Cinco padrões de workflow cobrem a maioria dos casos. Comece com chamadas de API diretas. Adicione agentes só quando etapas não podem ser previstas.

**Tipo:** Aprender + Construir
**Linguagens:** Python (stdlib)
**Pré-requisitos:** Fase 14 · 01 (Agent Loop)
**Tempo:** ~60 minutos

## Objetivos de Aprendizado

- Nomear os cinco padrões de workflow da Anthropic: prompt chaining, roteamento, paralelização, orchestrator-workers, evaluator-optimizer.
- Explicar a distinção agent-vs-workflow e o custo de engenharia de cada um.
- Identificar quando escolher um workflow em vez de um agente (e vice-versa).
- Implementar os cinco padrões com stdlib contra um LLM programado.

## O Problema

Times recorrem a frameworks multi-agent pra problemas que querem uma única chamada de função. O custo é real: frameworks adicionam camadas que obscurecem prompts, escondem fluxo de controle e convidam complexidade prematura. O post de Dez 2024 de Schluntz e Zhang é o contra-argumento da indústria mais citado: comece simples, adicione complexidade só quando ela ganha seu custo.

## O Conceito

### Workflows vs agents

- **Workflow.** LLMs e ferramentas orquestrados via caminhos de código predefinidos. Engenheiros detêm o grafo.
- **Agent.** LLMs dirigem dinamicamente suas próprias ferramentas e tomam seus próprios passos. O modelo detém o grafo.

Ambos têm seu lugar. Workflows são mais baratos, mais rápidos e mais fáceis de debugar. Agents desbloqueiam problemas abertos mas tornam modos de falha mais difíceis de raciocinar.

### O LLM aumentado

Fundação de todos os cinco padrões: um LLM com três capacidades conectadas — busca (recuperação), ferramentas (ações), memória (persistência). Qualquer chamada de API pode usar essas.

### Os cinco padrões

1. **Prompt chaining.** Saída da chamada 1 é input da chamada 2. Use quando uma tarefa tem uma decomposição linear limpa. Gates programáticos opcionais entre etapas.

2. **Roteamento.** Um LLM classificador escolhe qual LLM ou ferramenta downstream invocar. Use quando inputs categoricamente diferentes precisam de tratamento diferente (suporte tier-1 vs reembolso vs bug vs vendas).

3. **Paralelização.** Rode N chamadas de LLM concorrentes, agregue resultados. Duas formas: seção (chunks diferentes) e votação (mesmo prompt, N execuções, maioria/síntese).

4. **Orchestrator-workers.** Um LLM orquestrador decide dinamicamente quais workers (também LLMs) rodar e sintetiza suas saídas. Parecido com loops de agente mas o orquestrador não entra em loop indefinidamente.

5. **Evaluator-optimizer.** Um LLM propõe uma resposta, outro LLM avalia. Itere até o evaluator aprovar. Isso é Self-Refine (Aula 05) generalizado.

### Onde workflows superam agents

- **Tarefas previsíveis.** Se você consegue enumerar as etapas, deveria.
- **Tarefas com orçamento de custo.** Workflows têm contagem de etapas limitada; agentes podem espiralar.
- **Tarefas vinculadas a conformidade.** Auditores querem ler o grafo, não inferi-lo de trajectories.

### Onde agentes superam workflows

- **Pesquisa aberta.** Quando a próxima etapa depende do que a etapa anterior retornou.
- **Tarefas de tamanho variável.** Minutos a horas de trabalho onde a contagem de etapas é desconhecida.
- **Domínios novos.** Quando você ainda não sabe o workflow certo — explore primeiro, codifique depois.

### A disciplina complementar de context engineering

"Effective context engineering for AI agents" (Anthropic 2025) formaliza a disciplina adjacente: a janela de 200k é um orçamento, não um contêiner. O que incluir, quando compactar, quando deixar o contexto crescer. Coberto em detalhes na aula de compressão de contexto da Fase 14 (aula anterior 06 nesse currículo antes da renumeração).

## Construa

`code/main.py` implementa os cinco padrões de workflow contra um `ScriptedLLM`:

- `prompt_chain(input, steps)` — sequencial.
- `route(input, classifier, handlers)` — classificação + despacho.
- `parallel_vote(prompt, n, aggregator)` — N execuções, agregação.
- `orchestrator_workers(task, workers)` — orquestrador escolhe workers.
- `evaluator_optimizer(task, proposer, evaluator, max_iter)` — loop até aprovação.

Rode:

```
python3 code/main.py
```

Cada padrão imprime seu trace. Total de linhas de código por padrão é ~10-15; o custo de um framework é medido em milhares.

## Use

- Chamadas de API diretas pra maioria das tarefas.
- Framework só quando o padrão genuinamente precisa de estado durável (LangGraph), concorrência de modelo ator (AutoGen v0.4) ou templates de papel (CrewAI).
- Recorra ao Claude Agent SDK quando quiser a forma do harness do Claude Code sem reconstruí-lo.

## Entregue

`outputs/skill-workflow-picker.md` escolhe o padrão certo pra uma descrição de tarefa dada, incluindo a justificativa da decisão e o caminho de refatoração pra agente se workflows não bastarem.

## Exercícios

1. Implemente roteamento com limiar de confiança. Abaixo do limiar -> escale pra humano. Onde o limiar cai pra um caso de uso de suporte tier-1?
2. Adicione um timeout em `parallel_vote`. O que acontece quando uma chamada trava? Como você agrega com votos faltando?
3. Transforme `evaluator_optimizer` num bandit: mantenha os top-2 outputs entre iterações pra que um bom resultado tardio não seja sobrescrito por um ruim tardio.
4. Combine prompt chaining com roteamento: um roteador escolhe uma de três cadeias. Meça custo em tokens versus uma alternativa de prompt grande único.
5. Escolha uma de suas features de produção. Desenhe o grafo do workflow. Conte as etapas. Um agente realmente seria melhor aqui?

## Termos-Chave

| Termo | O que a galera fala | O que realmente significa |
|-------|---------------------|---------------------------|
| Workflow | "Fluxo predefinido" | Grafo de LLM e chamadas de ferramenta detido pelo engenheiro |
| Agent | "IA Autônoma" | Grafo detido pelo modelo; direção dinâmica de ferramentas |
| Augmented LLM | "LLM com ferramentas" | LLM + busca + ferramentas + memória; a unidade atômica |
| Prompt chaining | "Chamadas sequenciais" | Saída da chamada N é input da chamada N+1 |
| Routing | "Despacho de classificador" | Escolher qual cadeia/modelo lida com o input |
| Parallelization | "Fan out" | N chamadas concorrentes; agregação por seção ou votação |
| Orchestrator-workers | "Agent despachante" | LLM orquestrador escolhe LLMs eespecificaçãoialistas dinamicamente |
| Evaluator-optimizer | "Propositor + juiz" | Itere até evaluator aprovar; Self-Refine generalizado |

## Leitura Complementar

- [Anthropic, Building Effective Agents (Dec 2024)](https://www.anthropic.com/research/building-effective-agents) — os cinco padrões de workflow
- [Anthropic, Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) — a disciplina complementar
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) — quando grafos com estado ganham seu custo
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) — o padrão orchestrator-workers, produto
