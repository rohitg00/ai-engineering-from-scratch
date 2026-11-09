# Auto-refinamento e crítica: Melhoria do rendimento iterativo

> Self-Refine (Madaan et al., 2023) usa um LLM em três papéis  gerar, feedback, refinar  em um loop. Ganho médio: +20 absoluto em 7 tarefas. CRITIC (Gou et al., 2023) endurece o passo de feedback roteando verificação através de ferramentas externas. Em 2026 este padrão navega em cada quadro como "evaluador-optimizador" (Antropic) ou um loop de guarda (OpenAI Agents SDK).

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 03 (Reflexion)
**Time:** ~60 minutes

## Objetivos de aprendizagem

- Explique as três instruções do Estado Auto-Refinação (generar, feedback, refinar) e explique por que a história importa para o requisito de refinar.
- Explique a visão crítica da CRITIC: Os LLM são pouco confiáveis na autoverificação sem base externa.
- Implementar um loop de auto-refinamento stdlib com histórico e um verificador externo opcional.
- Mapear este padrão para o fluxo de trabalho "evaluador-optimizador" da Anthropic e as barragens de saída do OpenAI Agents SDK.

## O problema

Um agente produz uma resposta quase correta. Talvez uma linha de código tenha um erro de sintaxe. Talvez um resumo seja muito longo. Talvez um plano perca um caso de borda. O que você quer é: o agente critica sua própria saída, e depois a corrige.

O Auto-Refine mostra que isso funciona com um único modelo, sem dados de treinamento, sem RL. Mas há uma pega: os LLM são maus na auto-verificação em fatos concretos.

Juntos, estes dois artigos definem o padrão 2026 para melhoria iterativa: gerar, verificar (externamente quando possível), refinar, parar quando o verificador passar.

## O conceito

### Auto-refinamento (Madaan et al., NeurIPS 2023)

Um LLM, três funções:

```
generate(task)            -> output_0
feedback(task, output_0)  -> critique_0
refine(task, output_0, critique_0, history) -> output_1
feedback(task, output_1)  -> critique_1
refine(task, output_1, critique_1, history) -> output_2
...
stop when feedback says "no issues" or budget exhausted.
```

Detalhe-chave:`refine`O artigo abla isto: queda de história e queda de qualidade acentuada.

Título: +20 melhorias absolutas em média em 7 tarefas (matemática, código, sigla, diálogo) incluindo GPT-4.

### CRITA (Gou et al., arXiv:2305.11738, v4 fevereiro 2024)

A fraqueza da auto-refinagem: a etapa de feedback é a própria pontuação do LLM. Para as alegações factuais, esta é pouco confiável (uma alucinação muitas vezes parece convincente para o modelo que a produziu).`feedback(task, output)`com`verify(task, output, tools)`onde`tools`inclui:

- Um motor de busca de alegações factuais.
- Um intérprete de código para corretão de código.
- Uma calculadora para aritmética.
- Verificadores específicos de domínio (testes de unidade, verificadores de tipo, linters).

O verificador produz uma crítica estruturada baseada nos resultados das ferramentas.

Título: CRITIC supera a Auto-Refina em tarefas factuais porque a crítica é fundamentada. Em tarefas sem verificadores externos (escritura criativa, formatação), CRITIC reduz-se a Auto-Refina.

### A condição de parada

Duas formas comuns:

1. **Verifier passes.**Os testes externos apresentam sucesso. Preferido quando disponível (testes de unidade, verificador de tipo, afirmação de barragem).
2. **No feedback issued.**Modelo diz "a saída está bem". Mais barato, mas não confiável; par com um limite máximo de iteração.

2026 padrão: combiná-los. "Pare se o verificador passar OR modelo diz bem E iterações >= 2 OR iterações >= max_iterations".

### Otimizador de avaliação (Antropic, 2024)

O post de dezembro de 2024 da Anthropic nomeia isso como um dos cinco padrões de fluxo de trabalho.

- O avaliador: marca a produção e produz uma crítica.
- Otimizador: revisa a saída dada a crítica.

O sistema de avaliação de dados é um sistema de análise de dados que é um sistema de análise de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de

### Os dispositivos de segurança de saída do SDK OpenAI Agents

O OpenAI Agents SDK envia este padrão como "gardalas de saída".`OutputGuardrailTripwireTriggered`Os guardrails podem chamar ferramentas (estilo CRITIC) ou ser funções puras (estilo Auto-Refinação).

### 2026 armadilhas

- **Rubber-stamp loops.**O mesmo modelo fazendo geração e crítica com o mesmo estilo de prompt converge em "parece-me bem". Use instruções estruturalmente diferentes, ou um modelo mais pequeno e barato para a crítica.
- **Over-refinement.**Cada passagem de refinamento adiciona latência e tokens. O orçamento 1-3 passa; depois disso, escala para revisão humana.
- **CRITIC on trivial tasks.**Se não houver um verificador externo, o CRITIC degenera para Auto-Refine; não pague a latência por um verificador de estúdio.

```figure
self-refine
```

## Construí-lo

`code/main.py`A verificação de dados é feita por um grupo de dados que são utilizados para verificar o formato de um objeto.

Componentes:

- `generate`- Produtor de roteiro.
- `feedback` Autocrítica de estilo LLM.
- `verify_external` Verificador baseado de estilo CRITIC.
- `refine` reescreve a saída dada história.
- Condição de parada  passes de verificador ou max 4 iterações.

- É o que é ?

```
python3 code/main.py
npx tsx code/main.ts
```

Compare as corridas Auto-Refina versus CRITIC. CRITIC pega um erro factual Auto-Refina omitido porque o verificador externo tem terra a auto-crítica não.

## Usá-lo

O avaliador-optimizador da Anthropic é este padrão em linguagem amigável à Claude. Os guardrails de saída do OpenAI Agents SDK são CRITIC-formados (guardrails podem chamar ferramentas). LangGraph envia um nó de reflexão que lê como Self-Refine. O Gemini 2.5 Computer Use do Google adiciona um avaliador de segurança por passo que é uma variante CRITIC: cada ação é verificada antes de se comprometer.

## Envia-o

`outputs/skill-refine-loop.md`Configura um loop de avaliador-otimizador dado a forma da tarefa, disponibilidade do verificador e orçamento de iteração. Emite instruções para gerador, avaliador/verificador e optimizador, além de uma política de parada.

## Exercícios

1. Execute o brinquedo com max_iterations=1.
2. Substitua o verificador externo por um barulhento (random 30% falsos positivos). O que faz o loop? Esta é a realidade de 2026 da maioria das pilhas de guarda-roupa.
3. Implementar uma variante de "generação crítica em diferentes modelos": grandes modelos geram, pequenos modelos criticam.
4. Leia a secção 3 CRITIC (arXiv:2305.11738 v4).
5. Mapa do SDK de Agentes OpenAI `output_guardrails`O que é que o SDK está errado e o que é que está certo?

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Self-Refine | "LLM that fixes itself" | Generate -> feedback -> refine loop in one model, with history |
| CRITIC | "Tool-grounded verification" | Replace feedback with an external verifier (search, code, calc, tests) |
| Evaluator-Optimizer | "Anthropic workflow pattern" | Two roles — evaluator scores, optimizer revises — looped to convergence |
| Output guardrail | "Post-hoc check" | OpenAI Agents SDK validator that runs after an agent produces output |
| Verify step | "Critique phase" | The load-bearing decision: grounded or self-rated |
| Refine history | "What the model already tried" | Prior outputs + critiques prepended to refine prompt; drop and quality collapses |
| Rubber-stamp loop | "Self-agreement failure" | Same-prompt critique returns "looks good"; fix with structurally different prompts |
| Stop condition | "Convergence test" | Verifier passes OR no feedback AND iteration cap; never single-condition |

## Mais leitura

- [Madaan et al., Self-Refine (arXiv:2303.17651)](https://arxiv.org/abs/2303.17651) o papel canônico
- [Gou et al., CRITIC (arXiv:2305.11738)](https://arxiv.org/abs/2305.11738) Verificação baseada em ferramentas
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) padrão de fluxo de trabalho de avaliador-optimizador
- [OpenAI Agents SDK docs](https://openai.github.io/openai-agents-python/) barris de saída como verificadores em forma CRITIC
