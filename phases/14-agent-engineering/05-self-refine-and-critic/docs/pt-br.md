# Self-Refine e CRITIC: Melhoria Iterativa de Saída

> Self-Refine (Madaan et al., 2023) usa um LLM em três papéis — gerar, feedback, refinar — em um loop. Ganho médio: +20 absoluto em 7 tarefas. CRITIC (Gou et al., 2023) fortalece o passo de feedback roteando verificação por ferramentas externas. Em 2026 esse padrão é entregue em todo framework como "evaluator-optimizer" (Anthropic) ou um loop de guardrail (OpenAI Agents SDK).

**Tipo:** Construção
**Linguagens:** Python (stdlib)
**Pré-requisitos:** Fase 14 · 01 (Agent Loop), Fase 14 · 03 (Reflexion)
**Tempo:** ~60 minutos

## Objetivos de Aprendizado

- Enunciar os três prompts do Self-Refine (generate, feedback, refine) e explicar por que histórico importa pro prompt de refine.
- Explicar o insight crítico do CRITIC: LLMs são pouco confiáveis em auto-verificação sem âncora externa.
- Implementar um loop Self-Refine com stdlib com histórico e um verificador externo opcional.
- Mapear esse padrão pro workflow "evaluator-optimizer" da Anthropic e pras output guardrails do OpenAI Agents SDK.

## O Problema

Um agent produz uma resposta quase certa. Talvez uma linha de código tenha um erro de sintaxe. Talvez um resumo seja longo demais. Talvez um plano pule um caso limite. O que você quer é: o agent critica sua própria saída e depois corrige.

Self-Refine mostra que isso funciona com um único modelo, sem dados de treino, sem RL. Mas tem um pegadinha: LLMs são ruins em auto-verificação em fatos concretos. CRITIC nomeia a correção — roteie o passo de verificação por ferramentas externas (busca, interpretador de código, calculadora, runner de testes).

Juntos, esses dois papers definem o padrão de 2026 pra melhoria iterativa: gerar, verificar (externamente quando possível), refinar, parar quando o verificador aprova.

## O Conceito

### Self-Refine (Madaan et al., NeurIPS 2023)

Um LLM, três papéis:

```
generate(task)            -> output_0
feedback(task, output_0)  -> critique_0
refine(task, output_0, critique_0, history) -> output_1
feedback(task, output_1)  -> critique_1
refine(task, output_1, critique_1, history) -> output_2
...
stop when feedback says "no issues" or budget exhausted.
```

Detalhe-chave: `refine` vê o histórico completo — todas as saídas e críticas anteriores — pra não repetir erros. O paper ablate isso: remove histórico e a qualidade cai bruscamente.

Manchete: +20 de melhoria absoluta em média em 7 tarefas (matemática, código, acrônimo, diálogo) incluindo GPT-4. Sem treino, sem ferramentas externas, modelo único.

### CRITIC (Gou et al., arXiv:2305.11738, v4 Fev 2024)

Fraqueza do Self-Refine: o passo de feedback é um LLM se pontuando. Pra afirmações factuais isso é pouco confiável (uma alucinação frequentemente parece convincente pro modelo que a produziu). CRITIC substitui `feedback(task, output)` por `verify(task, output, tools)` onde `tools` inclui:

- Um mecanismo de busca pra afirmações factuais.
- Um interpretador de código pra correção de código.
- Uma calculadora pra aritmética.
- Verificadores específicos de domínio (testes unitários, type checkers, linters).

O verificador produz uma crítica estruturada ancorada em resultados de ferramenta. O refinator depois condiciona nessa crítica.

Manchete: CRITIC supera Self-Refine em tarefas factuais porque a crítica é ancorada. Em tarefas sem verificadores externos (escrita criativa, formatação), CRITIC se reduz a Self-Refine.

### A condição de parada

Duas formas comuns:

1. **Verificador aprova.** Teste externo retorna sucesso. Preferido quando disponível (testes unitários, type checker, asserção de guardrail).
2. **Nenhum feedback emitido.** Modelo diz "a saída tá boa." Mais barato mas pouco confiável; combine com limite de iterações.

Padrão de 2026: combine-os. "Pare se o verificador aprovar OU modelo disser OK E iterações >= 2 OU iterações >= max_iterations."

### Evaluator-Optimizer (Anthropic, 2024)

O post de Dez 2024 da Anthropic nomeia isso como um dos cinco padrões de workflow. Dois papéis:

- Evaluator: pontua a saída e produz uma crítica.
- Optimizer: revisa a saída dada a crítica.

Loop até o evaluator aprovar. Isso é Self-Refine/CRITIC no framing da Anthropic. O detalhe de engenharia que a Anthropic adiciona: os prompts do evaluator e optimizer devem ser substancialmente diferentes pra que o modelo não só passe o carimbo.

### Output guardrails do OpenAI Agents SDK

OpenAI Agents SDK entrega esse padrão como "output guardrails." Um guardrail é um validador que roda na saída final de um agent. Se o guardrail é ativado (`OutputGuardrailTripwireTriggered`), a saída é rejeitada e o agent pode tentar de novo. Guardrails podem chamar ferramentas (estilo CRITIC) ou ser funções puras (estilo Self-Refine).

### Armadilhas de 2026

- **Loops de passar o carimbo.** Mesmo modelo fazendo geração e crítica com o mesmo estilo de prompt converge em "parece bom pra mim." Use prompts estruturalmente diferentes ou um modelo pequeno e barato pra crítica.
- **Sobre-refinamento.** Cada passo de refinar adiciona latência e tokens. Orce 1-3 passos; depois disso, escale pra revisão humana.
- **CRITIC em tarefas triviais.** Se não há verificador externo, CRITIC degenera pra Self-Refine; não pague a latência por um verificador placeholder.

## Construa

`code/main.py` implementa Self-Refine e CRITIC numa tarefa de exemplo: produzir uma lista curta de tópicos dado um tema. O verificador checa formato (3 bullets, cada um abaixo de 60 caracteres). CRITIC adiciona um "verificador factual" externo que penaliza alucinações conhecidas.

Componentes:

- `generate` — produtor programado.
- `feedback` — auto-crítica estilo LLM.
- `verify_external` — verificador ancorado estilo CRITIC.
- `refine` — reescreve saída dado histórico.
- Condição de parada — verificador aprova ou máx. 4 iterações.

Rode:

```
python3 code/main.py
```

Compare as execuções Self-Refine vs CRITIC. CRITIC pega um erro factual que Self-Refine perdeu porque o verificador externo tem âncora que a auto-crítica não tem.

## Use

Evaluator-optimizer da Anthropic é esse padrão em linguagem amigável ao Claude. Output guardrails do OpenAI Agents SDK são formato CRITIC (guardrails podem chamar ferramentas). LangGraph entrega um nó de reflexão que parece Self-Refine. Computer Use do Gemini 2.5 da Google adiciona um avaliador de segurança por etapa que é uma variante CRITIC: toda ação é verificada antes do commit.

## Entregue

`outputs/skill-refine-loop.md` configura um loop evaluator-optimizer dada a forma da tarefa, disponibilidade de verificador e orçamento de iterações. Emite prompts pra generator, evaluator/verificador e optimizer, mais uma política de parada.

## Exercícios

1. Rode o exemplo com max_iterations=1. CRITIC ainda ajuda?
2. Substitua o verificador externo por um barulhento (30% de falsos positivos aleatórios). O que o loop faz? Essa é a realidade de 2026 da maioria dos stacks de guardrail.
3. Implemente uma variante "generator-critic em modelos diferentes": modelo grande gera, modelo pequeno critica. Ele supera o mesmo modelo?
4. Leia Seção 3 do CRITIC (arXiv:2305.11738 v4). Nomeie as três categorias de ferramentas de verificação e dê um exemplo pra cada.
5. Mapeie `output_guardrails` do OpenAI Agents SDK pro papel de verificador do CRITIC. O que o SDK erra e o que ele acerta?

## Termos-Chave

| Termo | O que a galera fala | O que realmente significa |
|-------|---------------------|---------------------------|
| Self-Refine | "LLM que se corrige" | Loop generate -> feedback -> refine num modelo, com histórico |
| CRITIC | "Verificação ancorada em ferramenta" | Substitui feedback por verificador externo (busca, código, calc, testes) |
| Evaluator-Optimizer | "Padrão de workflow da Anthropic" | Dois papéis — evaluator pontua, optimizer revisa — em loop até convergência |
| Output guardrail | "Checagem post-hoc" | Validador do OpenAI Agents SDK que roda depois que o agent produz saída |
| Verify step | "Fase de crítica" | A decisão que aguenta o peso: ancorada ou auto-avaliada |
| Refine history | "O que o modelo já tentou" | Saídas + críticas anteriores prepended no prompt de refine; remove e a qualidade colapsa |
| Rubber-stamp loop | "Falha de auto-acordo" | Crítica de mesmo prompt retorna "parece bom"; conserte com prompts estruturalmente diferentes |
| Stop condition | "Teste de convergência" | Verificador aprova OU sem feedback E limite de iterações; nunca condição única |

## Leitura Complementar

- [Madaan et al., Self-Refine (arXiv:2303.17651)](https://arxiv.org/abs/2303.17651) — o paper canônico
- [Gou et al., CRITIC (arXiv:2305.11738)](https://arxiv.org/abs/2305.11738) — verificação ancorada em ferramenta
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) — padrão de workflow evaluator-optimizer
- [OpenAI Agents SDK docs](https://openai.github.io/openai-agents-python/) — output guardrails como verificadores formato CRITIC
