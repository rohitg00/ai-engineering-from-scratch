# Arquitetura Hierárquica e Seu Modo de Falha

> A hierarquia é a de supervisores, de gerentes, de subgerentes, de trabalhadores.`Process.hierarchical`é a versão do livro de texto: a `manager_llm`O equivalente de LangGraph é `create_supervisor(create_supervisor(...))`É o padrão natural quando a tarefa é um gráfico de órgãos real. É também o padrão mais provável de colapso em circuitos gerenciais.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 05 (Supervisor Pattern)
**Time:** ~60 minutes

## Problemas

Uma vez que o padrão de supervisor clique, o próximo passo natural é "e se os trabalhadores são eles mesmos supervisores?" As equipes têm sub-equipas; as empresas têm departamentos de departamentos. Arquiteturas hierárquicas refletem isso.

O problema: os gerentes de LLM não são os mesmos que os gerentes humanos. Um gerente humano tem antecedentes estáveis sobre o que seus relatórios sabem. Um gerente de LLM re-raciona a organização a cada passo a partir de qualquer coisa que esteja em seu contexto.

## Conceptos

### A forma

```
                 Manager
                 ┌─────┐
                 └──┬──┘
           ┌────────┴────────┐
           ▼                 ▼
       Sub-Mgr A         Sub-Mgr B
       ┌─────┐           ┌─────┐
       └──┬──┘           └──┬──┘
         ┌┴──┬──┐          ┌┴──┐
         ▼   ▼  ▼          ▼   ▼
       W1  W2  W3         W4  W5
```

Cada nó interno planeja, delega e sintetiza.

### Onde brilha

- **Clear org mapping.**Se a tarefa real for departamental ("revisão legal do documento, revisão financeira do documento, revisão de engenharia do documento, em seguida, resumo para exec"), a hierarquia é explícita.
- **Local summarization.**Cada sub-gerente sintetiza a produção de sua equipe antes que o gerente superior a veja.

### Onde se quebra

Três modos de falha os post-mortem de 2026 continuam a encontrar:

1. **Task assignment error.**O gerente lê o objetivo, alucina uma decomposição e delega ao sub-gerente errado. Porque o sub-gerente obedece a o que lhe foi dado, o erro só surge na síntese superior  um nível removido de onde um ser humano poderia tê-lo pego.
2. **Output misinterpretation.**O sub-gerente retorna "não pode verificar a reivindicação X". O gerente superior resume como "a reivindicação X não confirmada". O significado varia em todos os níveis.
3. **Consensus loops.**Dois sub-gerentes discordam; o gerente superior pede-lhes que se reconciliem; eles re-delegam para baixo; os trabalhadores re-existem; os sub-gerentes retornam respostas ligeiramente diferentes; ciclo.`Process.hierarchical`O que é que é o problema?

### A questão decisiva

Sequencial (linha linear) vs hierárquica: a sua tarefa realmente tem sub-equipas independentes, ou é um fluxo linear fingindo ser uma árvore?

### Implementação do quadro de funções

A tripulação da IAA `Process.hierarchical`O gerente:

- recebe a tarefa de nível superior,
- atribui subtarefas às tripulações,
- Avalia as saídas da tripulação,
- Decide se aceitar, re-delegar ou iterar.

Documentação: https://docs.crewai.com/en/introduction(veja "Processo hierárquico" no ponto "Conceptos fundamentais").

### Implementação do quadro gráfico

LangGraph usa nested `create_supervisor`O supervisor interno tem seu próprio gráfico; o supervisor externo trata o gráfico interno como um nó opaco. Isso é mais limpo do que o CrewAI para depurar (você pode passar por cada gráfico separadamente), mas é mais difícil expressar a remodelação dinâmica da árvore.

Referência: https://reference.langchain.com/python/langgraph-supervisor.

```figure
swarm-hierarchy-token
```

## Construí-lo

`code/main.py`Funciona numa hierarquia de três níveis:

- gerente superior: divide uma tarefa em "engenharia" e "jurídica",
- Sub-gerente de engenharia: se divide em trabalhadores "frontend" e "backend",
- Sub-gerente jurídico: um trabalhador.

Demo contrasta caminho feliz (todos concordam) contra um **perturbed path**Quando a decomposição do gerente superior marca erroneamente "legal" como "finance" e observa a cascata de erros  o subgerente obedece ao trabalho financeiro, o sintetizador superior relata as conclusões financeiras, a questão legal original fica sem resposta.

- Correr .

```
python3 code/main.py
npx tsx code/main.ts
```

A saída mostra ambos os caminhos com um lado claro do lado de "o que foi pedido" versus "o que foi entregue".

## Usá-lo

`outputs/skill-hierarchy-fitness.md`A avaliação da utilização de um supervisor hierárquico, sequencial ou plano em uma determinada tarefa.

## Envia-o

Se você enviar hierárquica:

- **Cap tree depth at 2.**Três níveis já escondem a maioria dos erros da observabilidade.
- **Explicit reconciliation budget.**Defina o máximo de rodadas antes que o gerente principal se comprometa.
- **Provenance on every synthesis.**O resumo de cada nó deve indicar quais as saídas de folha que o produziram.
- **Alert on decomposition drift.**Registre a decomposição do gerente por etapa; diferir contra a consulta do usuário. Se a decomposição não cobrir mais a consulta, inicie um alerta.

## Exercícios

1. Corra .`code/main.py`Quantos níveis de entrega do gerente são necessários antes que a saída máxima diverja completamente da pergunta do usuário?
2. Adicione um terceiro nível (top → sub → sub → worker). Meter a frequência com que o caminho perturbado se corrige e diverge completamente à medida que a profundidade cresce.
3. Implementar um trabalhador "canário" em cada sub-gerente que sempre é feito a pergunta original do usuário inalterada. Use a resposta canária para detectar a deriva de decomposição. Como o gerente deve reagir quando o canário não concorda com a resposta sintetizada?
4. Leia o CrewAI `Process.hierarchical`Identificar um barranco de segurança de concreto que a CrewAI aplica (limite de passos, restrição manager_llm) e descrever o modo de falha que visa.
5. Comparar os supervisores de LangGraph aninhados com os hierárquicos da CrewAI.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Hierarchical | "Org chart pattern" | Supervisors over supervisors; only leaves do work. |
| Manager LLM | "The boss" | The LLM that decomposes, assigns, and validates at an internal node. |
| Decomposition drift | "The boss lost the plot" | Top manager's split no longer covers the original question. |
| Reconciliation loop | "Endless meetings" | Sub-managers disagree; top re-delegates; workers re-run; loop until budget exhausted. |
| Depth-2 ceiling | "Don't go deeper than 2 levels" | Empirical guardrail: 3+ levels collapses observability. |
| Canary question | "Ground truth at every level" | A worker that is always asked the original query unchanged, to detect drift. |
| Provenance chain | "Who said what" | Trace from each synthesis back to the leaf outputs that produced it. |

## Mais leitura

- [CrewAI introduction — Process.hierarchical](https://docs.crewai.com/en/introduction) Manual hierárquico com um gerente LLM
- [LangGraph supervisor reference](https://reference.langchain.com/python/langgraph-supervisor) supervisor aninhado via `create_supervisor`
- [Anthropic engineering — Research system](https://www.anthropic.com/engineering/multi-agent-research-system) por que a Anthropic escolheu deliberadamente um supervisor plano em vez de um supervisor hierárquico
- [Cemri et al. — Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/abs/2503.13657) Taxonomia MAST; secção sobre falhas de coordenação documentação de descomposição deriva
