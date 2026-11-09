# Modelo de supervisor / orquestrador-trabalhador

> Um agente principal planeja e delega; trabalhadores especializados executam em contextos paralelos e relatam. Este é o padrão por trás do sistema de pesquisa da Anthropic (Claude Opus 4 como chumbo, Sonnet 4 como subagentes), medido em +90,2% sobre o Opus 4 de um único agente em avaliações internas de pesquisa. O post de engenharia da Anthropic relata que 80% da variância no BrowseComp é explicada pelo uso de tokens sozinho  multi-agente ganha em grande parte porque cada subagente recebe uma janela de contexto fresca. Esta lição constrói o padrão de supervisor a partir dos primitivos e abrange as lições de engenharia de 2026 das implantações de produção.

**Type:** Learn + Build
**Languages:** Python (stdlib, `threading`), TypeScript
**Prerequisites:** Phase 16 · 04 (Primitive Model)
**Time:** ~75 minutes

## Problemas

A pesquisa é a tarefa prototípica que os sistemas de agente único falham. Você pergunta "o que mudou nos sistemas de agentes múltiplos entre 2023 e 2026?" Um agente único lê cinco artigos sequencialmente, preenche metade do seu contexto com seu texto, e depois tem que raciocinar sobre todos eles juntos. Esquece o primeiro artigo quando chega ao quinto. Não pode paralelalizar.

O padrão de supervisor corrige isso: um agente principal planeja a pesquisa, delega cada sub-question para um trabalhador e sintetizou. Cada trabalhador recebe sua própria janela de 200k-token para uma pergunta estreita. O líder nunca vê os trabalhos brutos  apenas os resumos dos trabalhadores.

O sistema de pesquisa de produção da Anthropic relata +90,2% sobre avaliações internas de pesquisa versus um único Opus 4.

## Conceptos

### O padrão

```
                 ┌──────────────┐
                 │   Lead       │  plans, decomposes,
                 │  (Opus 4)    │  synthesizes
                 └──┬────┬───┬──┘
                    │    │   │
            ┌───────┘    │   └───────┐
            ▼            ▼           ▼
      ┌─────────┐  ┌─────────┐  ┌─────────┐
      │ Worker1 │  │ Worker2 │  │ Worker3 │
      │(Sonnet) │  │(Sonnet) │  │(Sonnet) │
      └─────────┘  └─────────┘  └─────────┘
         fresh       fresh        fresh
         context     context      context
```

O chumbo nunca lê as matérias-primas, os trabalhadores nunca veem o trabalho uns dos outros até que o chumbo se sintetize, cada flecha é uma entrega com um artefato estreito.

### Por que ganha

Três mecanismos:

1. **Fresh context per subagent.**Um trabalhador que explora "herança da FIPA-ACL" não carrega os 40 mil tokens que o líder gastou no planejamento.
2. **Specialization via prompt.**A ordem do líder é "decompor e sintetizar", não "investigar". A ordem de cada trabalhador é estreita: "encontrar o que mudou em X". As instruções focalizadas produzem resultados focados.
3. **Parallelism.**Os trabalhadores correm simultaneamente.`max(worker_times) + plan + synthesis`Não , não .`sum(worker_times)`- Não .

### Lições de engenharia (Antropic 2025)

O post Anthropic lista várias lições de produção que ainda são relevantes para 2026:

- **Scale effort to query complexity.**Queries simples: um agente, 3-10 chamadas de ferramentas. Queries complexas: 10+ agentes. O líder deve estimar isso, não o chamador.
- **Broad then narrow.**Decompor em sub-perguntas amplas primeiro, e depois gerar mais trabalhadores por sub-perguntas se a resposta justificar profundidade.
- **Rainbow deployments.**Os agentes são de longa duração e estado. O azul-verde tradicional não funciona.
- **Token usage dominates.**Multi-agente é ~ 15 × os tokens de um agente único. só executá-lo quando o valor da tarefa justifica o custo.

### A curva gráfica-nativa

A LangGraph originalmente enviou um `langgraph-supervisor`Biblioteca com um nível elevado `create_supervisor`Em 2025, a LangChain mudou a recomendação para a implementação do padrão de supervisor através de chamadas de ferramentas diretamente, porque as chamadas de ferramentas dão mais controle sobre o que o supervisor vê* (engenharia de contexto).

### Os modos de falha

- **Lead hallucinates the plan.**Se o lead gera subquestions que não descompõem a verdadeira pergunta, os trabalhadores fazem pesquisas precisas sobre o alvo errado.
- **Workers over-explore.**Sem limites explícitos de âmbito, os trabalhadores desviam para além da subquestionaria atribuída e poluem a fase de síntese.
- **Synthesis conflicts.**Dois trabalhadores retornam fatos contraditórios. O líder deve perguntar novamente (agrega uma rodada) ou notar explicitamente o desacordo.

### Quando o supervisor está errado

- **Sequential tasks.**Se o passo 2 precisa literalmente da saída do passo 1, o paralelismo não compra nada. Use um pipeline (CrewAI Sequential, LangGraph linear graph).
- **Simple queries.**O agente único trata-os mais rápido e mais barato.
- **Strict determinism.**O supervisor usa delegação selecionada pelo LLM. Os gráficos estáticos são melhores quando a auditoria/replay é mais importante do que a adaptabilidade.

```figure
supervisor-hierarchy
```

## Construí-lo

`code/main.py`Implementa um supervisor de três trabalhadores paralelos utilizando `threading`O lead decompõe uma consulta em subquestions, os trabalhadores executam simultaneamente em cada subquestion e o lead sintetizes.

Estrutura chave:

- `Lead.plan(query)`Divide uma consulta em 3 subperguntas.
- `Worker.run(sub_q)`Retorna um resumo falso (poderá ser qualquer agente que utilize ferramentas na produção).
- `Lead.run(query)`Desliga os trabalhadores em fios, juntas e sintetizas.

- Correr .

```
python3 code/main.py
npx tsx code/main.ts
```

A saída mostra o plano, os trabalhadores paralelos rastream com timestamps de início/final e a síntese final.

## Usá-lo

`outputs/skill-supervisor-designer.md`O sistema de supervisão é um sistema de supervisão que permite a criação de um modelo de supervisão.

## Envia-o

Lista de verificação antes de implantar um padrão de supervisão:

- **Model pairing.**O plomo em um modelo de raciocínio (classe Opus, `o3`Os trabalhadores de um modelo mais rápido e mais barato (Sonnet, `o4-mini`)).
- **Worker timeout.**Qualquer trabalhador que exceda 2x o tempo de execução médio é morto; o líder ou re-espanha com um escopo mais estreito ou prossegue sem ele.
- **Token cap per worker.**O limite duro (por exemplo, 10x a entrada de síntese esperada) impede que um trabalhador fugitivo estrague o orçamento.
- **Observability.**Rastrear o plano do líder, as chamadas de ferramentas de cada trabalhador e a síntese.
- **Rainbow rollout.**Os agentes de longa data do Estado precisam de transição gradual, não de troca de troca.

## Exercícios

1. Corra .`code/main.py`Em que número de trabalhadores a despesa de criação excede as economias paralelas nesta demonstração?
2. Implementar um tempo de trabalho para os trabalhadores: matar qualquer trabalhador que corre mais de 0,5 segundos e ter o lead sintetizar os resultados restantes. Que observabilidade você precisa para saber que um trabalhador foi cortado?
3. Adicione um passo de detecção de conflitos à síntese do líder: se dois trabalhadores retornam respostas contraditórias, o líder nota a discórdia em vez de escolher uma.
4. Leia o artigo de engenharia de sistemas de pesquisa da Anthropic.
5. Comparar com o de LangGraph `create_supervisor`O que lhe dá um melhor controle sobre o que o supervisor vê? Por que a Anthropic só passa explícitamente sub-respostas e não conteúdo de trabalhador bruto para a síntese?

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Supervisor | "Lead agent" | An orchestrator agent that plans, delegates, and synthesizes. Does not do the work itself. |
| Worker | "Subagent" | A focused agent invoked by the supervisor with narrow scope and its own context window. |
| Orchestrator-worker | "Supervisor pattern" | Same thing, different name. The 2026 literature uses both. |
| Fresh context | "Clean window" | A worker's context starts from its system prompt and assigned question, not the lead's history. |
| Rainbow deployment | "Gradual rollout" | Long-running stateful agents need versioned drain-and-replace, not blue-green. |
| Token dominance | "Context is the variable" | 80% of research-eval variance comes from total tokens used, not model choice, per Anthropic. |
| Scale effort | "Match agent count to complexity" | Lead estimates query difficulty, spawns 1 vs 10+ workers accordingly. |
| Synthesis conflict | "Workers disagree" | Two workers return contradictory facts; the lead must surface disagreement, not silently pick one. |

## Mais leitura

- [Anthropic engineering — How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) a referência de produção para o modelo de supervisão
- [LangGraph workflows and agents](https://docs.langchain.com/oss/python/langgraph/workflows-agents) Supervisor de chamada de ferramentas é agora o formulário recomendado
- [LangGraph supervisor reference](https://reference.langchain.com/python/langgraph-supervisor) o auxiliar legado, ainda utilizado na produção de 2026
- [OpenAI cookbook — Orchestrating Agents: Routines and Handoffs](https://developers.openai.com/cookbook/examples/orchestrating_agents) Variante de supervisor baseada em transferência
