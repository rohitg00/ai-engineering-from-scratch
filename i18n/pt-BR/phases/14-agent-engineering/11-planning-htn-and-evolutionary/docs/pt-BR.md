# Planejamento com HTN e Pesquisa Evolucionária

> O planejamento simbólico lida com os casos em que o plano é provavelmente correto. A pesquisa de código evolutivo lida com os casos em que a função de fitness é verificável pela máquina. ChatHTN (2025) e AlphaEvolve (2025) mostram o que cada um desbloqueia quando combinado com um LLM.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 02 (ReWOO and Plan-and-Execute)
**Time:** ~75 minutes

## Objetivos de aprendizagem

- Explicar as redes de tarefas hierárquicas: tarefas, métodos, operadores, pré-condições, efeitos.
- Descreva o ciclo híbrido de ChatHTN  pesquisa simbólica com decomposição de volta do LLM.
- Explica o ciclo evolutivo do AlphaEvolve e porque só funciona com um avaliador programático.
- Implementar um planeador de brinquedos HTN e uma pesquisa evolutiva de brinquedos em Stdlib.

## O problema

ReWOO (Lessão 02), Planear e Executa e ReAct cobrem a maioria dos planos de agentes.

1. **Plans with provable correctness.**A programação, o itinerário de voo, os fluxos de trabalho de conformidade  o plano deve ser sólido por construção.
2. **Optimizations with a machine-checkable fitness function.**Multiplicação de matriz, planejamento heurística, passes de compilador  o objetivo não é "um plano correto" mas "o melhor plano".

O planejamento HTN e o AlphaEvolve resolvem os dois problemas diferentes.

## O conceito

### Redes de tarefas hierárquicas

Uma HTN é:

- **Tasks** composto (a ser decomposto) e primitivo (executivo direto).
- **Methods** formas de decompor uma tarefa composta em subtarefas, com condições prévias.
- **Operators** Ações primitivas com condições prévias e efeitos.
- **State** um conjunto de fatos.

Planejamento: dada uma tarefa-alvo e um estado inicial, encontrar uma decomposição em operadores primitivos cujas pré-condições são satisfeitas em sequência.

O HTN é mais antigo do que os LLM e ainda é a referência para planos provavelmente corretos.

### ChatHTN (Gopalakrishnan et al., 2025)

ChatHTN (arXiv:2505.11814) interliga HTN simbólico com consultas de LLM:

1. Tente decompor a tarefa composta atual com métodos existentes.
2. Se não for aplicado nenhum método, pergunte ao LLM: "como se descompõe?`task`em estado`s`"O que é isso?
3. Traduzir a resposta do LLM em subtarefas candidatas.
4. Validar contra o esquema do operador; rejeitar descomposições inválidas.
5. Recurso.

A afirmação central do artigo: cada plano produzido é provavelmente sólido porque as sugestões de LLM só entram como decomposições candidatas, nunca como edições diretas de planos.

Aprendizagem de métodos on-line (OpenReview `gwYEDY9j2x`O programa de acompanhamento de 2025) adiciona um aprendiz que generaliza as decomposições produzidas pelo LLM por regressão  reduzindo a frequência de consulta do LLM até 75%.

### AlphaEvolve (Novikov et al., 2025)

AlphaEvolve (arXiv:2506.13131, DeepMind, junho 2025) é uma besta diferente: pesquisa de código evolutivo orquestrada por um conjunto Gemini 2.0 Flash / Pro.

Loop:

1. Comece com um programa de sementes + um avaliador programático (retorna uma pontuação de aptidão).
2. O conjunto de LLM propõe mutações.
3. Faça as mutações através do avaliador.
4. Mantém o melhor, muta novamente.

Ganhos publicados:

- Primeira melhoria em relação a Strassen para a multiplicação de matriz complexa 4x4 em 56 anos (48 multiplicações escalares).
- 0,7% recuperou o computador do Google através de uma heurística de programação Borg.
- 32% de aceleração da FlashAttention numa carga de trabalho de fronteira.

A restrição dura: a função de fitness deve ser verificável pela máquina.

### Quando utilizar qual

| Problem class | Use | Why |
|---------------|-----|-----|
| Scheduling with hard constraints | HTN + ChatHTN | Provable soundness |
| Compiler optimization | AlphaEvolve | Machine-checkable fitness |
| Multi-step task execution | ReAct / ReWOO | LLM in the loop, no formal guarantees |
| Code improvement with tests | AlphaEvolve | Tests are the evaluator |
| Policy-bound automation | HTN | Preconditions encode policy |

### Onde este padrão vai mal

- **HTN without operators.**Sem esquemas de pré-condição/efeito, a alegação de solidez desmorona. "LLM sugere decomposição" do ChatHTN exige que o esquema rejeite movimentos inválidos.
- **AlphaEvolve without a real evaluator.**"Pergunte ao Mestrado em Direito se o código é melhor" não é uma função de fitness.
- **Over-engineering.**A maioria das tarefas de agentes não precisam de nada.

```figure
htn-tree-expand
```

## Construí-lo

`code/main.py`Implementa dois brinquedos:

- Um planejador de HTN com operadores, métodos, pré-condições, efeitos e um `LLMFallback`O LLM é um decomposador scriptado, o que faz com que o planejador seja executado offline.
- Uma busca evolutiva em programas aritméticos: crescer expressões cuja produção minimiza`|f(x) - target|`O avaliador é determinista.

- É o que é ?

```
python3 code/main.py
npx tsx code/main.ts
```

O rastro mostra o planejador HTN desintegrando uma tarefa composta (com um retorno de LLM no plano médio) e o ciclo evolutivo convergindo em uma expressão-alvo.

## Usá-lo

- **HTN planners**- Não .`pyhop`- Não .`SHOP3`, ou construir o seu próprio para a aplicação de políticas específicas de domínio.
- **ChatHTN** código de investigação; o padrão (símbolo + LLM fallback) é portado de forma limpa a qualquer planejador HTN.
- **AlphaEvolve** Papel DeepMind; o padrão (ensemble + evaluator) é reprodutivo.
- **Agent frameworks**Não se deve construir ainda um HTN de primeira classe ou um AlphaEvolve.

## Envia-o

`outputs/skill-hybrid-planner.md`gera um andamio de planejamento híbrido (HTN ou evolutivo) com o papel do MLL explicitamente definido.

## Exercícios

1. Extender o planejador de HTN com retrocesso: quando a post-condição do operador falhar no tempo de execução, recuar e tentar o próximo método.
2. Adicionar um cache do método LLM ao ChatHTN: quando o LLM descompõe a tarefa `T`em padrão de estado `P`Reverifique a biblioteca de métodos na próxima chamada.
3. Troque o evaluador de pesquisa evolutiva para um conjunto de testes real. Desenvolva uma função de classificação que passa por 20 casos de teste; informe gerações para a convergência.
4. Leia as notas de design de avaliador do AlphaEvolve. Desenhe um avaliador para um domínio que você se importa (otimizar a consulta SQL, minimizar a série de testes, implementar YAML).
5. Combine: use HTN para decompor uma tarefa composta em subtarefas, em seguida, use a pesquisa evolutiva no operador primitivo de cada subtarefa. Onde brilha, onde é super-engenharia?

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| HTN | "Hierarchical planner" | Task decomposition with operators, preconditions, effects |
| Method | "Decomposition rule" | Way to break a compound task into subtasks |
| Operator | "Primitive action" | Concrete step with precondition and effect |
| ChatHTN | "LLM + HTN" | Symbolic planner asks LLM when no method matches |
| AlphaEvolve | "Evolutionary code search" | Ensemble LLMs mutate code; deterministic evaluator selects |
| Fitness function | "Evaluator" | Deterministic, machine-checkable score over outputs |
| Online method learning | "Cached LLM decomposition" | Store + generalize LLM plans to cut query cost |

## Mais leitura

- [Gopalakrishnan et al., ChatHTN (arXiv:2505.11814)](https://arxiv.org/abs/2505.11814) Planeador híbrido de LLM
- [Novikov et al., AlphaEvolve (arXiv:2506.13131)](https://arxiv.org/abs/2506.13131) Pesquisa de código evolutivo com mutações de LLM
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) quando chegar a um planejador versus um ciclo simples
