# Shadow Traffic, Canary Rollout e Progressive Deployment para LLMs

> Rollouts de LLM combinam as partes mais difíceis de deploy de software: sem testes unitários, modos de falha difusos, sinais atrasados. A sequência é (1) shadow mode — duplica requests de produção para um modelo candidato, loga, compara com zero impacto no usuário; pega problemas óbvios de distribuição mas não garante qualidade; (2) canary rollout — migração progressiva de tráfego 10% → 25% → 50% → 75% → 100% com gates em cada etapa; acompanha percentis de latência, custo/requisição, taxa de erro/recusa, distribuição de tamanho do output, taxa de feedback do usuário; (3) testes A/B para alternativas distintas depois que a estabilidade é confirmada. O não-determinismo é irreductível — até 15% de variação de acurácia entre runs com inputs idênticos por causa da não-associatividade de ponto flutuante na GPU + variância de batch size. Custo é variável, não constante — um modelo 20% melhor pode ser 3x mais caro por chamada. Velocidade de rollback é decisiva: se o rollback exige redeploy, você é lento demais. Política fica em config/flags; modelo fica em registry com digest fixado; rollback = virar a política + reverter threshold + fixar modelo antigo em segundos.

**Tipo:** Aprender
**Linguagens:** Python (stdlib, simulador brincadeira de progressão canary)
**Pré-requisitos:** Fase 17 · 13 (Observabilidade), Fase 17 · 21 (Teste A/B)
**Tempo:** ~60 minutos

## Objetivos de Aprendizado

- Distinguir shadow mode (comparação de zero impacto), canary (tráfego progressivo ao vivo) e A/B (comparação confirmada por estabilidade).
- Listar cinco métricas canary específicas de LLM (latência, custo/requisição, erro/recusa, distribuição de tamanho do output, feedback do usuário).
- Explicar por que o não-determinismo de LLM (até 15%) muda o que "estável" significa num rollout.
- Projetar um caminho de rollback que leva segundos (virar política) e não horas (redeploy).

## O Problema

Você lança um modelo novo. Avaliações offline mostram 3% de ganho de acurácia. Você ativa em produção. Em 24 horas, custo subiu 40%, thumbs-down subiu 8%, três tickets de cliente reportam "respostas estranhas". Você desfaz. O redeploy leva 3 horas. Seu fim de semana acabou.

Tudo isso era evitável. Shadow mode teria pego o pico de 40% de custo antes de qualquer usuário ver. Canary teria parado em 10% quando o thumbs-down mudou. Rollback por flag de política teria levado 30 segundos. A disciplina é o que preenche o gap entre "avaliações offline parecem boas" e "usuários reais estão felizes".

## O Conceito

### Shadow mode

O candidato recebe os mesmos requests de produção; os outputs são logados, não retornados aos usuários. Zero impacto no usuário. Log:

- Conteúdo do output (diff contra produção).
- Contagem de tokens (delta de custo).
- Latência.
- Recusa e erro.

Pega: explosões de custo, regressões de tamanho, mudanças óbvias de recusa, erros duros. NÃO pega: delta de qualidade que os usuários perceberiam. Shadow é teste de fumaça, não teste de qualidade.

### Canary rollout

Migração progressiva de tráfego com gates. Progressão típica: 1% → 10% → 25% → 50% → 75% → 100%. Gate em 5 métricas a cada etapa:

1. **Percentis de latência** — P50, P95, P99. Violação: canary tem P99 > 1.5x baseline.
2. **Custo por request** — média ponderada $. Violação: >20% acima do baseline.
3. **Taxa de erro/recusa** — 5xx mais recusas explícitas. Violação: 2x baseline.
4. **Distribuição de tamanho do output** — média + P99. Violação: mudança distribucional.
5. **Taxa de feedback do usuário** — thumbs-down / aberturas de ticket. Violação: 1.5x baseline.

### Não-determinismo é a nova variância

Inputs idênticos geram outputs não-idênticos. Motivos:

- Não-associatividade de ponto flutuante da GPU (ordem de redução de ponto flutuante varia por batch).
- Variância de batch size (mesmo prompt num batch de 128 vs batch de 16).
- Amostragem (temperature > 0).

Medido: até 15% de variação de acurácia run-a-run em evals idênticos. "Estável" num rollout significa métricas dentro da variância esperada, não idênticas ao baseline. Coloque gates acima do ruído de fundo.

### Custo é variável

Um modelo 20% melhor pode ser 3x mais caro por chamada. Custo/request é um dos cinco gates. Lançar um modelo "melhor" que quebra a economia unitária é caso de rollback.

### Rollback é a arma

- Flag de política (sistema de feature flag): virar percentual na config; leva segundos.
- Fixação de modelo (digest do registry): modelo fixado não faz upgrade automático.
- Rollback = reverter flag + definir digest fixado para o anterior. Segundos, não horas.

Se sua stack exige redeploy para rollback, conserte isso antes de lançar.

### Ferramentas

**Argo Rollouts** / **Flagger** — controladores de delivery progressivo para Kubernetes. Integram com roteamento ponderado do Istio/Linkerd.

**Roteamento ponderado do Istio** — split de tráfego no nível do service-mesh.

**KServe / Seldon Core** — serving de modelo com canary nativo.

**Feature flags** — LaunchDarkly, Flagsmith, Unleash. Virada no nível de política, sem redeploy.

### Cadência de métricas

Gates de canary verificam a cada 5-15 minutos dependendo do volume de tráfego. 1% de tráfego com 10 req/min dá 50-150 pontos de dados por janela — suficiente para latência mas barulhento para feedback do usuário. 10% dá ~10x mais. Progressões devem pausar tempo suficiente para acumular amostras suficientes em cada etapa.

### O passo A/B é opcional

Se o modelo novo é claramente diferente (comportamento diferente, curva de custo diferente, tom diferente), teste A/B a 50% depois que canary passar. Se é só uma versão melhorada, pule para 100% quando os gates de canary passarem.

### Números pra lembrar

- Progressão canary: 1% → 10% → 25% → 50% → 75% → 100%.
- Teto de não-determinismo: até 15% de variação run-a-run com inputs idênticos.
- Cinco métricas canary: latência, custo, erro/recusa, tamanho do output, feedback do usuário.
- Gate de custo: >20% acima do baseline é violação.
- Rollback: segundos, não horas.

## Use

`code/main.py` simula um rollout canary com regressões injetadas. Reporta em qual etapa o rollout para e qual gate foi acionado.

## Entregue

Esta aula produz `outputs/skill-rollout-runbook.md`. Dado modelo candidato, baseline e tolerância a risco, projeta plano shadow→canary→100%.

## Exercícios

1. Execute `code/main.py`. Injete uma regressão de custo de 25%. Em qual etapa o canary para?
2. Seu modelo novo tem 3% de ganho de acurácia offline mas custo/request é +18%. Lança ou não? Depende da política — escreva os dois caminhos.
3. Projete um rollback que leva menos de 60 segundos ponta a ponta. Liste a infra necessária.
4. Não-determinismo mostra ±7% no seu eval. Configure gates de canary para não dar falso alarme. Quais multiplicadores usa?
5. Shadow mode pega um pico de custo de 40% antes do canary. Escreva a regra de alerta que dispara no shadow.

## Termos Chave

| Termo | O que a gente diz | O que realmente significa |
|-------|-------------------|---------------------------|
| Shadow mode | "duplicar pro novo" | Envio de zero impacto ao candidato para logging |
| Canary | "tráfego progressivo" | Rollout gradual exposto ao usuário com gates |
| Gates | "checagens de rollout" | Limites de métrica que bloqueiam progressão |
| Não-determinismo | "variância do LLM" | Diferenças irreductíveis entre runs |
| Flag de política | "rollback por flag" | Rollback em nível de config, segundos não horas |
| Fixação de modelo | "digest do registry" | Referência imutável a uma versão do modelo |
| Argo Rollouts | "progressivo no K8s" | Controlador canary/rollback nativo do Kubernetes |
| KServe | "inferência no K8s" | Serving de modelo com primitivas de canary |
| Istio ponderado | "split de mesh" | Splitter de tráfego de service-mesh |

## Leitura Complementar

- [TianPan — Releasing AI Features Without Breaking Production](https://tianpan.co/blog/2026-04-09-llm-gradual-rollout-shadow-canary-ab-testing)
- [MarkTechPost — Safely Deploying ML Models](https://www.marktechpost.com/2026/03/21/safely-deploying-ml-models-to-production-four-controlled-strategies-a-b-canary-interleaved-shadow-testing/)
- [APXML — Advanced LLM Deployment Patterns](https://apxml.com/courses/mlops-for-large-models-llmops/chapter-4-llm-deployment-serving-optimization/advanced-llm-deployment-patterns)
- [Argo Rollouts docs](https://argo-rollouts.readthedocs.io/)
- [Flagger docs](https://docs.flagger.app/)
