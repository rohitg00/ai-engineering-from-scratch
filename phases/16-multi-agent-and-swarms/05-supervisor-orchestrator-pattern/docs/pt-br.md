# Padrão Supervisor / Orquestrador-Trabalhador

> Um agent líder planeja e delega; trabalhadores especializados executam em contextos paralelos e reportam de volta. Esse é o padrão por trás do sistema de Pesquisa da Anthropic (Claude Opus 4 como líder, Sonnet 4 como subagents), medido em +90.2% sobre Opus 4 single-agent em evals internas de pesquisa. O post de engenharia da Anthropic relata que 80% da variância no BrowseComp é explicada por uso de tokens — multi-agent ganha em grande parte porque cada subagent recebe uma janela de contexto fresca. Esta lição constrói o padrão supervisor a partir das primitivas e cobre as lições de engenharia de 2026 de deployments em produção.

**Tipo:** Aprender + Construir
**Linguagens:** Python (stdlib, `threading`)
**Pré-requisitos:** Fase 16 · 04 (Modelo Primitivo)
**Tempo:** ~75 minutos

## Problema

Pesquisa é a tarefa prototípica onde sistemas single-agent falham. Você pergunta "o que mudou em sistemas multi-agent entre 2023 e 2026?" Um agent lê cinco papers em sequência, enche metade do seu contexto com o texto deles e depois precisa raciocinar sobre todos juntos. Ele esquece do primeiro paper quando chega no quinto. Não consegue paralelizar.

O padrão supervisor conserta isso: um agent líder planeja a busca, delega cada subpergunta pra um trabalhador e sintetiza. Cada trabalhador recebe sua janela de 200k tokens pra uma pergunta estreita. O líder nunca vê os papers brutos — só os resumos dos trabalhadores.

O sistema de Pesquisa em produção da Anthropic relata +90.2% em evals internas de pesquisa vs um Opus 4 single-agent. O mesmo post nota que 80% da variância no BrowseComp é explicada por *uso de tokens*. Contexto fresco por subagent é o principal mecanismo.

## Conceito

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

O líder nunca lê os materiais brutos. Os trabalhadores nunca veem o trabalho um do outro até o líder sintetizar. Cada seta é uma handoff com um artefato estreito.

### Por que ganha

Três mecanismos:

1. **Contexto fresco por subagent.** Um trabalhador explorando "herança FIPA-ACL" não carrega os 40k tokens que o líder gastou planejando. Ele recebe uma janela de 200k pra uma pergunta.
2. **Especialização via prompt.** O prompt do líder é "decompor e sintetizar," não "pesquisar." O prompt de cada trabalhador é estreito: "ache o que mudou em X." Prompts focados produzem saídas focadas.
3. **Paralelismo.** Trabalhadores rodam concorrentemente. Tempo de relógio é aproximadamente `max(tempo_trabalhadores) + plano + síntese`, não `soma(tempo_trabalhadores)`.

### Lições de engenharia (Anthropic 2025)

O post da Anthropic lista várias lições de produção que ainda são relevantes em 2026:

- **Escala o esforço à complexidade da consulta.** Consultas simples: um agent, 3-10 tool calls. Consultas complexas: 10+ agents. O líder deve estimar isso, não o chamador.
- **Primeiro amplo, depois estreito.** Decomponha em subperguntas amplas primeiro, depois gere mais trabalhadores por subpergunta se a resposta justificar profundidade.
- **Deployments rainbow.** Agents são de longa duração e com estado. Blue-green tradicional não funciona. Anthropic usa rainbow: rollout gradual de novas versões enquanto as antigas drenam.
- **Uso de tokens domina.** Multi-agent é ~15× os tokens de single-agent. Só rode quando o valor da tarefa justificar o custo.

### A virada do LangGraph

LangGraph originalmente entregou uma biblioteca `langgraph-supervisor` com um helper de alto nível `create_supervisor`. Em 2025 a LangChain moveu a recomendação pra implementar o padrão supervisor via tool-calling diretamente, porque tool calls dão mais controle sobre *o que o supervisor vê* (engenharia de contexto). A biblioteca ainda funciona; as docs agora recomendam a forma de tool-calling.

### Os modos de falha

- **Líder alucina o plano.** Se o líder gera subperguntas que não decompõem a pergunta real, trabalhadores fazem pesquisa precisa no alvo errado.
- **Trabalhadores super-exploram.** Sem limites de escopo explícitos, trabalhadores derivam além da subpergunta atribuída e poluem o passo de síntese.
- **Conflitos de síntese.** Dois trabalhadores retornam fatos contraditórios. O líder precisa ou re-perguntar (adicionar uma rodada) ou notar a discordância explicitamente. Escolher um lado silenciosamente é a pior falha: o usuário nunca sabe que houve discordância.

### Quando o supervisor é errado

- **Tarefas sequenciais.** Se o passo 2 literalmente precisa da saída do passo 1, o paralelismo não compra nada. Use um pipeline (CrewAI Sequential, grafo linear LangGraph).
- **Consultas simples.** Single-agent lida com elas mais rápido e barato. Use a verificação de "escala o esforço" do líder antes de gerar trabalhadores.
- **Determinismo estrito.** Supervisor usa delegação selecionada por LLM. Grafos estáticos são melhores quando auditoria/replay importam mais que adaptabilidade.

## Construa

`code/main.py` implementa um supervisor de três trabalhadores paralelos usando `threading`. O líder decompõe uma consulta em subperguntas, trabalhadores rodam concorrentemente em cada subpergunta e o líder sintetiza. Sem LLMs reais — os trabalhadores são scriptados pra simular fetch-and-summarize.

Estrutura chave:

- `Lead.plan(query)` divide uma consulta em 3 subperguntas.
- `Worker.run(sub_q)` retorna um resumo falso (poderia ser qualquer agent usando tools em produção).
- `Lead.run(query)` dispara trabalhadores em threads, junta e sintetiza.

Execute:

```
python3 code/main.py
```

Saída mostra o plano, os traces paralelos dos trabalhadores com timestamps de início/fim e a síntese final. Você vê as vitórias de tempo de relógio: três trabalhadores de 0.3 segundos rodam em ~0.35 segundos, não 0.9.

## Use

`outputs/skill-supervisor-designer.md` pega uma consulta de usuário e produz um design de padrão supervisor: system prompt do líder, papéis de trabalhadores, regras de decomposição de subperguntas e o template de síntese. Use isso antes de construir um novo sistema de agents estilo pesquisa.

## Entregue

Checklist antes de deployar um padrão supervisor:

- **Par de modelos.** Líder num modelo de raciocínio (classe Opus, classe `o3`). Trabalhadores num modelo mais rápido e barato (Sonnet, `o4-mini`).
- **Timeout de trabalhador.** Qualquer trabalhador que exceda 2× o tempo médio é morto; o líder ou re-gera com escopo mais estreito ou prossegue sem ele.
- **Limite de tokens por trabalhador.** Limite duro (digamos 10× a entrada esperada de síntese) impede que um trabalhador descontrolado estoure o orçamento.
- **Observabilidade.** Rastreie o plano do líder, cada chamada de tool dos trabalhadores e a síntese. Isso é a base pra qualquer debug posterior.
- **Rollout rainbow.** Agents de longa duração com estado precisam de transição gradual de versões, não hot swap.

## Exercícios

1. Execute `code/main.py`, depois modifique o líder pra gerar 5 trabalhadores em vez de 3. Observe o efeito no tempo de relógio. Com quantos trabalhadores o overhead de spawn excede a economia de paralelismo nesta demo?
2. Implemente um timeout de trabalhador: mate qualquer trabalhador que rode mais que 0.5 segundos e tenha o líder sintetizar os resultados restantes. Que observabilidade você precisa pra saber que um trabalhador foi cortado?
3. Adicione um passo de detecção de conflito na síntese do líder: se dois trabalhadores retornam respostas contraditórias, o líder nota a discordância em vez de escolher um. Como você detecta contradição sem chamar um LLM?
4. Leia o post de engenharia do sistema de Pesquisa da Anthropic. Liste três práticas que esta demo de brinquedo precisaria adotar pra rodar em produção.
5. Compare o `create_supervisor` do LangGraph (legado) vs a nova recomendação de tool-calling. Qual dá melhor controle sobre o que o supervisor vê? Por que a Anthropic passa explicitamente só sub-respostas e não o contexto bruto dos trabalhadores na síntese?

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| Supervisor | "Agent líder" | Um agent orquestrador que planeja, delega e sintetiza. Não faz o trabalho em si. |
| Trabalhador | "Subagent" | Um agent focado invocado pelo supervisor com escopo estreito e sua própria janela de contexto. |
| Orquestrador-trabalhador | "Padrão supervisor" | A mesma coisa, nome diferente. A literatura de 2026 usa os dois. |
| Contexto fresco | "Janela limpa" | O contexto de um trabalhador começa do seu system prompt e pergunta atribuída, não do histórico do líder. |
| Deploy rainbow | "Rollout gradual" | Agents de longa duração com estado precisam de transição gradual de versões, não blue-green. |
| Dominância de tokens | "Contexto é a variável" | 80% da variância em evals de pesquisa vem do total de tokens usados, não da escolha do modelo, segundo a Anthropic. |
| Escalar esforço | "Combinar contagem de agents com complexidade" | Líder estima dificuldade da consulta, gera 1 vs 10+ trabalhadores conforme o caso. |
| Conflito de síntese | "Trabalhadores discordam" | Dois trabalhadores retornam fatos contraditórios; o líder precisa tornar a discordância visível, não escolher um silenciosamente. |

## Leitura Complementar

- [Engenharia Anthropic — How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) — a referência de produção pro padrão supervisor
- [Workflows e agents LangGraph](https://docs.langchain.com/oss/python/langgraph/workflows-agents) — tool-calling supervisor é agora a forma recomendada
- [Referência do supervisor LangGraph](https://reference.langchain.com/python/langgraph-supervisor) — o helper legado, ainda usado em produção em 2026
- [Cookbook OpenAI — Orchestrating Agents: Routines and Handoffs](https://developers.openai.com/cookbook/examples/orchestrating_agents) — variante de supervisor baseada em handoff
