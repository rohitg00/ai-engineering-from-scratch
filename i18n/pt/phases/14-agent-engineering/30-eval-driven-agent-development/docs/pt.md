# Desenvolvimento de Agentes Driven Eval

> A orientação da Anthropic: "comece com pedidos simples, otimize-os com avaliação abrangente e adicione sistemas agenciários em várias etapas apenas quando necessário". A avaliação não é o último passo.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** All of Phase 14.
**Time:** ~60 minutes

## Objetivos de aprendizagem

- Nomear as três camadas de avaliação  referências estáticas, offline personalizada, produção on-line  e para o que cada uma é para.
- Explica o ciclo apertado do avaliador-optimizador.
- Descrever as melhores práticas para 2026: avaliações ao lado do código, executadas em CI, gate PRs.
- Conecte cada lição da Fase 14 ao caso de avaliação que gera.

## O problema

Os agentes passam por demonstrações. Eles falham na produção de maneiras que as demonstrações não podem prever. Os indicadores de referência respondem "este modelo é amplamente capaz?" não "este agente está enviando os patches certos para o meu produto?" A resposta: avaliação em três camadas, executando continuamente, com cada guarda-roupa e regra aprendida mapeada para um caso de avaliação.

## O conceito

### Três camadas de avaliação

1. **Static benchmarks** SWE-bench Verificado para código (Lessão 19), WebArena/OSWorld para navegação / desktop (Lessão 20), GAIA para generalista (Lessão 19), BFCL V4 para uso de ferramentas (Lessão 06). Uso para comparação entre modelos e fechamento de regressão. Contaminação é real: SWE-bench+ encontrou vazamento de solução de 32,67%.

2. **Custom offline evals** a forma do seu produto:
   - LLM como juiz (Langfuse, Phoenix, Opik  Lição 24).
   - Baseado em execução (exercer o corrector, testes de verificação).
   - Baseada em trajetória (comparar sequências de ação contra o ouro; OSWorld-Human mostra agentes superiores 1,4-2,7x sobre o ouro).

3. **Online evals** produção:
   - Repetições de sessão (Langfuse).
   - Alertas activadas por guarda-pista (Lessão 16, 21).
   - Per-passo de rastreamento de custos / latência (Lessão 23 OTel abrangem).

### Otimizador de avaliação (antrópico)

O circuito apertado:

1. O proponente gera saída.
2. Jueiros de avaliação.
3. Refinem até o avaliador passar.

Este é o Auto-Refino (Lessão 05) generalizado. Qualquer fluxo de agentes que você se importa pode envolver em avaliador-optimizador para confiabilidade.

### 2026 melhores práticas

- Os Evals vivem ao lado do código.
- - É um bom trabalho.
- A combinação de gate em pontuações de eval (por exemplo, "sem regressão > 5% vs principal").
- Cada guarda-redes faz um mapa para um caso de avaliação.
- Cada regra aprendida (Reflexão, regra de aprendizagem pró-fluxo de trabalho) mapeia um caso de falha.

### A ligação da fase 14

A maioria das lições na Fase 14 gera casos de avaliação.

| Lesson | Eval case it generates |
|--------|------------------------|
| 01 Agent Loop | Budget-exhausted, infinite-loop guard |
| 02 ReWOO | Planner replans correctly when a tool fails |
| 03 Reflexion | Learned reflections apply on retry |
| 05 Self-Refine/CRITIC | Judge passes refined output |
| 06 Tool Use | Argument coercion works; unknown tools rejected |
| 07-10 Memory | Retrieval citations match sources; stale facts invalidate |
| 12 Workflow Patterns | Each pattern produces correct output |
| 13 LangGraph | Resume reproduces state exactly |
| 14 AutoGen Actors | DLQ catches crashed handlers |
| 16 OpenAI Agents SDK | Guardrail trips on the right inputs |
| 17 Claude Agent SDK | Subagent results return to orchestrator |
| 19-20 Benchmarks | SWE-bench Verified score, WebArena success rate, OSWorld efficiency |
| 21 Computer Use | Per-step safety catches injected DOM |
| 23 OTel | Spans emit required attributes |
| 26 Failure Modes | Detectors tag known failures |
| 27 Prompt Injection | PVE refuses poisoned retrievals |
| 28 Orchestration | Supervisor routes to the right specialist |
| 29 Runtime Shapes | DLQ handles N% failure |

Se a sua suite de avaliação tem um caso para cada linha, você cobriu o núcleo da Fase 14.

### Quando o desenvolvimento orientado pela avaliação falhar

- **No baseline.**Evals sem o último bom conhecido são ilegíveis.
- **LLM-judge without grounding.**O padrão crítico (Lessão 05)  julgar fundamentos em ferramentas externas.
- **Over-fitting to evals.**Otimizar para a avaliação diverge da utilidade da produção.
- **Flaky evals.**Casos não deterministas causam falsos alarmes.

```figure
ae-eval-three-layers
```

## Construí-lo

`code/main.py`é um arame de avaliação stdlib:

- Registro de casos com categorias (marca de referência, personalidade, on-line).
- Um agente com guião em teste.
- Localização de avaliação-otimizador: propor, julgar, refinar até passar ou rodadas máximas.
- Portão de CI: taxa de passagem agregada + regressão em relação à linha de base.

- É o que é ?

```
python3 code/main.py
npx tsx code/main.ts
```

Resultado: passagem/falha por caso, bandeira de regressão, veredicto da porta CI.

## Usá-lo

- Escreva casos de avaliação no mesmo repo do seu código de agente.
- Controla-os em todas as relações públicas através de informadores.
- Falha na construção da regressão.
- Rate de passagem ao longo do tempo.
- Através de um novo caso, é possível que cada falha da produção seja relacionada a um novo caso.

## Envia-o

`outputs/skill-eval-suite.md`Construirá uma suíte de avaliação de três camadas para um produto agente com portões de CI e rastreamento de regressão.

## Exercícios

1. Tome uma das falhas da produção, escreva um caso de avaliação que a reproduza.
2. Construa uma rubrica de juiz de LLM para o seu domínio com três dimensões (factual, tone, scope).
3. Enviar o conjunto de avaliação para CI. Falhar na construção de >=5% regressão.
4. Adicione uma métrica de eficiência de trajetória: quantos passos o agente fez contra uma trajetória de ouro?
5. Mapa de cada aula da Fase 14 para um caso de avaliação na sua suite.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Static benchmark | "Off-the-shelf eval" | SWE-bench, GAIA, AgentBench, WebArena, OSWorld |
| Custom offline eval | "Domain eval" | LLM-as-judge / exec / trajectory on your product shape |
| Online eval | "Production eval" | Session replay, guardrail alerts, cost/latency tracking |
| Evaluator-optimizer | "Propose-judge-refine" | Iterate until judge passes |
| CI gate | "Merge blocker" | Fail the build on eval regression |
| Baseline | "Last-known-good" | Reference score to detect regression |
| Trajectory efficiency | "Steps over gold" | Agent step count divided by human expert minimum |

## Mais leitura

- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)"Comece simples, otimize com avaliações"
- [OpenAI, SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/) o índice de referência seleccionado
- [Berkeley Function Calling Leaderboard](https://gorilla.cs.berkeley.edu/leaderboard.html) Indicador de referência de utilização de ferramentas
- [Langfuse docs](https://langfuse.com/) avaliações + repetição de sessões na prática
