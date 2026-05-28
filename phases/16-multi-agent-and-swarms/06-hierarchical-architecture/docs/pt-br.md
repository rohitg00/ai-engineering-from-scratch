# Arquitetura Hierárquica e Seu Modo de Falha

> Hierárquico é supervisor aninhado. Agentes gerente sobre sub-gerentes sobre trabalhadores. `Process.hierarchical` do CrewAI é a versão de livro didático: um `manager_llm` delega tarefas dinamicamente e valida saídas. O equivalente no LangGraph é `create_supervisor(create_supervisor(...))`. É o padrão natural quando a tarefa é um organograma real. Também é o padrão mais propenso a colapsar em loops gerenciais — agentes gerente asignam trabalho mal, interpretam mal sub-resultados, ou falham em chegar a consenso. Sequencial frequentemente o vence.

**Tipo:** Aprender + Construir
**Linguagens:** Python (stdlib)
**Pré-requisitos:** Fase 16 · 05 (Padrão Supervisor)
**Tempo:** ~60 minutos

## Problema

Quando o padrão supervisor clica, o próximo passo natural é "e se os trabalhadores mesmos forem supervisores?" Times têm sub-times; empresas têm departamentos de departamentos. Arquiteturas hierárquicas espelham isso.

O problema: gerentes LLM não são iguais a gerentes humanos. Um gerente humano tem priors estáveis sobre o que seus subordinados sabem. Um gerente LLM re-raciocina a organização a cada turno baseado no que está no seu contexto. Uma deriva mínima nesse contexto, e a árvore inteira desaloca trabalho.

## Conceito

### A forma

```
                 Manager
                 ┌─────┘
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

Todo nó interno planeja, delega e sintetiza. Só folhas fazem trabalho.

### Onde brilha

- **Mapeamento organizacional claro.** Se a tarefa real é departamental ("jurídico revisa o documento, financeiro revisa o documento, engenharia revisa o documento, depois resume pro executivo"), a hierarquia é explícita.
- **Síntese local.** Cada sub-gerente sintetiza a saída do seu time antes do gerente principal ver. O gerente principal vê três resumos de sub-gerentes, não quinze saídas de trabalhadores.

### Onde quebra

Três modos de falha que os post-mortems de 2026 continuam encontrando:

1. **Erro de atribuição de tarefa.** O gerente lê o objetivo, alucina uma decomposição e delega pro sub-gerente errado. Como o sub-gerente obedeientemente trabalha no que recebeu, o erro só aparece na síntese no topo — um nível removido de onde um humano poderia ter pego.
2. **Interpretação incorreta de saída.** Sub-gerente retorna "incapaz de verificar afirmação X." Gerente principal resume como "afirmação X não confirmada." O significado deriva em cada nível.
3. **Loops de consenso.** Dois sub-gerentes discordam; gerente principal pede pra reconciliarem; eles re-delegam pra baixo; trabalhadores re-rodam; sub-gerentes retornam respostas ligeiramente diferentes; loop. `Process.hierarchical` do CrewAI protege contra isso com limites de passos, mas o limite em si agora é um hiperparâmetro.

### A pergunta decisiva

Sequencial (pipeline linear) vs hierárquico: sua tarefa realmente tem sub-times independentes, ou é um fluxo linear fingindo ser uma árvore? Se o último, use sequencial. Se o primeiro, use hierárquico mas orçamente regras explícitas de reconciliação.

### A implementação do CrewAI

`Process.hierarchical` conecta um LLM gerente sobre times eespecificaçãoializados. O gerente:

- recebe a tarefa de topo,
- asigna subtarefas pras times,
- avalia saídas dos times,
- decide se aceita, re-delega ou itera.

Documentação: https://docs.crewai.com/en/introduction (procure "Hierarchical Process" sob Core Concepts).

### A implementação do LangGraph

LangGraph usa chamadas aninhadas `create_supervisor`. O supervisor interno tem seu próprio grafo; o supervisor externo trata o grafo interno como um nó opaco. Isso é mais limpo que o CrewAI pra debugar (você pode percorrer cada grafo separadamente) mas mais difícil pra expressar remodelamento dinâmico da árvore.

Referência: https://reference.langchain.com/python/langgraph-supervisor.

## Construa

`code/main.py` roda uma hierarquia de 3 níveis:

- gerente principal: divide uma tarefa nos ramos "engenharia" e "jurídico",
- sub-gerente de engenharia: divide em trabalhadores "frontend" e "backend",
- sub-gerente de jurídico: um trabalhador.

Demo contrasta o caminho feliz (todos concordam) contra um **caminho perturbado** onde a decomposição do gerente principal rotula "jurídico" como "financeiro" e acompanha o erro se cascateando — o sub-gerente obedeientemente faz trabalho financeiro, o sintetizador principal reporta achados financeiros, a pergunta jurídica original fica sem resposta.

Execute:

```
python3 code/main.py
```

Saída mostra ambos os caminhos com um contraste claro lado a lado de "o que foi pedido" vs "o que foi entregue."

## Use

`outputs/skill-hierarchy-fitness.md` avalia se uma dada tarefa deve usar hierárquico, sequencial, ou supervisor flat. Entradas: descrição da tarefa, estrutura organizacional, orçamento de reconciliação. Saída: recomendação de padrão com os modos de falha eespecificaçãoíficos pra proteger.

## Entregue

Se você usar hierárquico:

- **Limite a profundidade da árvore em 2.** Três níveis já escondem a maioria dos erros da observabilidade.
- **Orçamento explícito de reconciliação.** Defina máximo de rodadas antes do gerente principal precisar comprometer. Geralmente 2.
- **Procedência em cada síntese.** O resumo de cada nó deve citar quais saídas de folhas o produziram.
- **Alerta em deriva de decomposição.** Logue a decomposição do gerente a cada passo; compare com a consulta do usuário. Se a decomposição não cobre mais a consulta, dispare um alerta.

## Exercícios

1. Execute `code/main.py` e compare feliz vs perturbado. Quantas camadas de handoff de gerente são necessárias antes que a saída de topo divirja completamente da pergunta do usuário?
2. Adicione um terceiro nível (topo → sub → sub-sub → trabalhador). Meça com que frequência o caminho perturbado se corrige vs divirge completamente à medida que a profundidade cresce.
3. Implemente um trabalhador "canário" em cada sub-gerente que sempre recebe a pergunta original do usuário sem alteração. Use a resposta do canário pra detectar deriva de decomposição. Como o gerente deve reagir quando o canário discorda da resposta sintetizada?
4. Leia as docs do `Process.hierarchical` do CrewAI. Identifique uma salvaguarda concreta que o CrewAI aplica (limite de passo, restrição manager_llm) e descreva qual modo de falha ela ataca.
5. Compare supervisores aninhados do LangGraph com o hierárquico do CrewAI. Qual torna loops de reconciliação mais baratos de detectar?

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| Hierárquico | "Padrão de organograma" | Supervisores sobre supervisores; só folhas fazem trabalho. |
| LLM Gerente | "O chefe" | O LLM que decompõe, asigna e valida num nó interno. |
| Deriva de decomposição | "O chefe perdeu o fio" | A divisão do gerente principal não cobre mais a pergunta original. |
| Loop de reconciliação | "Reuniões infinitas" | Sub-gerentes discordam; topo re-delega; trabalhadores re-rodam; loop até o orçamento acabar. |
| Teto de profundidade-2 | "Não vá além de 2 níveis" | Salvaguarda empírica: 3+ níveis colapsa a observabilidade. |
| Pergunta canária | "Verdade fundamental em cada nível" | Um trabalhador que sempre recebe a consulta original sem alteração, pra detectar deriva. |
| Cadeia de procedência | "Quem disse o quê" | Rastreia de cada síntese até as saídas de folhas que a produziram. |

## Leitura Complementar

- [Introdução do CrewAI — Process.hierarchical](https://docs.crewai.com/en/introduction) — hierárquico de livro didático com LLM gerente
- [Referência do supervisor LangGraph](https://reference.langchain.com/python/langgraph-supervisor) — supervisor aninhado via `create_supervisor`
- [Engenharia Anthropic — Research system](https://www.anthropic.com/engineering/multi-agent-request-system) — por que a Anthropic deliberadamente escolheu supervisor flat sobre hierárquico
- [Cemri et al. — Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/abs/2503.13657) — taxonomia MAST; seção sobre falhas de coordenação documenta deriva de decomposição
