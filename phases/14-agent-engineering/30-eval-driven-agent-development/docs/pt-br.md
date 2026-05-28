# Desenvolvimento de Agentes Orientado por Eval

> Orientação da Anthropic: "comece com prompts simples, otimize-os com avaliação abrangente, e adicione sistemas agênticos multi-passos só quando necessário." Avaliação não é a última etapa. É o loop externo que direciona todas as outras escolhas na Fase 14.

**Tipo:** Aprender + Construir
**Linguagens:** Python (stdlib)
**Pré-requisitos:** Toda a Fase 14.
**Tempo:** ~60 minutos

## Objetivos de Aprendizado

- Nomear as três camadas de avaliação — benchmarks estáticos, offline custom, online de produção — e pra que cada uma serve.
- Explicar o loop apertado evaluator-optimizer.
- Descrever a melhor prática de 2026: evals vivem junto ao código, rodam em CI, bloqueiam PRs.
- Conectar cada aula da Fase 14 ao caso de eval que ela gera.

## O Problema

Agentes passam demos. Falham em produção de formas que demos não conseguem prever. Benchmarks respondem "esse modelo é amplamente capaz?" não "esse agente tá entregando os patches certos pro meu produto?" A resposta: avaliação em três camadas, rodando continuamente, com cada guardrail e regra aprendida mapeada pra um caso de eval.

## O Conceito

### Três camadas de avaliação

1. **Benchmarks estáticos** — SWE-bench Verified pra código (Aula 19), WebArena/OSWorld pra navegação / desktop (Aula 20), GAIA pra generalista (Aula 19), BFCL V4 pra uso de tools (Aula 06). Use pra comparação cross-model e gate de regressão. Contaminação é real: SWE-bench+ encontrou 32.67% de vazamento de solução. Sempre reporte scores Verified / auditados.

2. **Evals offline customizadas** — formato do seu produto:
   - LLM-as-judge (Langfuse, Phoenix, Opik — Aula 24).
   - Baseada em execução (roda o patch, checa testes).
   - Baseada em trajetória (compara sequências de ações contra dourado; OSWorld-Human mostra melhores agentes 1.4-2.7x sobre o dourado).

3. **Evals online** — produção:
   - Replay de sessão (Langfuse).
   - Alertas acionados por guardrail (Aulas 16, 21).
   - Rastreamento de custo/latência por passo (spans OTel da Aula 23).

### Evaluator-optimizer (Anthropic)

O loop apertado:

1. Proponente gera output.
2. Avaliador julga.
3. Refina até o avaliador passar.

Isso é Self-Refine (Aula 05) generalizado. Qualquer fluxo de agente que você se importa pode ser encapsulado em evaluator-optimizer pra confiabilidade.

### Melhor prática de 2026

- Evals vivem junto ao código.
- Rodam em CI a cada PR.
- Bloqueiam merge baseado em scores de eval (ex: "sem regressão > 5% vs main").
- Cada guardrail mapeia pra um caso de eval.
- Cada regra aprendida (Reflexion, learn-rule de pro-workflow) mapeia pra um caso de falha.

### Conectando a Fase 14

Cada aula da Fase 14 gera casos de eval:

| Aula | Caso de eval que gera |
|------|----------------------|
| 01 Agent Loop | Budget esgotado, guarda contra loop infinito |
| 02 ReWOO | Planejador replaneja corretamente quando uma tool falha |
| 03 Reflexion | Reflexões aprendidas se aplicam no retry |
| 05 Self-Refine/CRITIC | Juíz aprova output refinado |
| 06 Tool Use | Coerção de argumento funciona; tools desconhecidas rejeitadas |
| 07-10 Memory | Citações de recuperação batem com fontes; fatos desatualizados invalidados |
| 12 Workflow Patterns | Cada padrão produz output correto |
| 13 LangGraph | Resume reproduz estado exatamente |
| 14 AutoGen Actors | DLQ captura handlers que crasharam |
| 16 OpenAI Agents SDK | Guardrail dispara nos inputs certos |
| 17 Claude Agent SDK | Resultados de subagent voltam pro orquestrador |
| 19-20 Benchmarks | Score Verified do SWE-bench, taxa de sucesso WebArena, eficiência OSWorld |
| 21 Computer Use | Segurança por passo captura DOM injetado |
| 23 OTel | Spans emitem atributos necessários |
| 26 Failure Modes | Detectores etiquetam falhas conhecidas |
| 27 Prompt Injection | PVE recusa retrievals envenenados |
| 28 Orquestração | Supervisor roteia pro especialista certo |
| 29 Formatos de Runtime | DLQ lida com N% de falha |

Se sua suíte de eval tem casos pra cada um, você cobriu a Fase 14.

### Onde desenvolvimento orientado por eval falha

- **Sem baseline.** Evals sem last-known-good são ilegíveis. Armazene baselines.
- **LLM-judge sem grounding.** Juízes também alucinam. Padrão CRITIC (Aula 05) — juiz ancora em tools externas.
- **Overfitting nas evals.** Otimizar pro eval diverge da utilidade em produção. Rotacione casos.
- **Evals instáveis.** Casos não-determinísticos causam falsos alarmes. Fixe seeds, snapshotte estado.

## Construa

`code/main.py` é um harness de eval em stdlib:

- Registro de casos com categorias (benchmark, custom, online).
- Um agente roteado sob teste.
- Loop evaluator-optimizer: propõe, julga, refina até passar ou max de rodadas.
- Gate de CI: taxa de pass agregada + regressão contra baseline.

Execute:

```
python3 code/main.py
```

Saída: pass/fail por caso, flag de regressão, veredicto do gate de CI.

## Use

- Escreva casos de eval no mesmo repo do código do seu agente.
- Rode-os a cada PR via CI.
- Falhe o build em regressão.
- Rastreie taxa de pass ao longo do tempo.
- Vincule cada falha de produção a um caso novo.

## Entregue

`outputs/skill-eval-suite.md` constrói uma suíte de eval em três camadas pra um produto de agente com gates de CI e rastreamento de regressão.

## Exercícios

1. Pegue uma das suas falhas de produção. Escreva um caso de eval que a reproduz. Seu agente passa agora?
2. Construa uma rubrica de LLM-judge pro seu domínio com três dimensões (factual, tom, escopo). Pontue 50 sessões.
3. Conecte a suíte de eval no CI. Falhe o build em >=5% de regressão.
4. Adicione uma métrica de eficiência de trajetória: quantos passos o agente deu vs uma trajetória dourada?
5. Mapeie cada aula da Fase 14 pra um caso de eval na sua suíte. Algum faltando? Essa é uma lacuna pra fechar.

## Termos Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| Benchmark estático | "Eval pronta" | SWE-bench, GAIA, AgentBench, WebArena, OSWorld |
| Eval offline custom | "Eval de domínio" | LLM-as-judge / exec / trajetória no formato do seu produto |
| Eval online | "Eval de produção" | Replay de sessão, alertas de guardrail, rastreamento custo/latência |
| Evaluator-optimizer | "Propor-julgamento-refinar" | Itera até o juiz aprovar |
| Gate de CI | "Bloqueador de merge" | Falhe o build em regressão de eval |
| Baseline | "Last-known-good" | Score de referência pra detectar regressão |
| Eficiência de trajetória | "Passos sobre o dourado" | Contagem de passos do agente dividida pelo mínimo do especialista humano |

## Leitura Complementar

- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) — "comece simples, otimize com evals"
- [OpenAI, SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/) — o benchmark curado
- [Berkeley Function Calling Leaderboard](https://gorilla.cs.berkeley.edu/leaderboard.html) — benchmark de uso de tools
- [Langfuse docs](https://langfuse.com/) — evals + replay de sessão na prática
