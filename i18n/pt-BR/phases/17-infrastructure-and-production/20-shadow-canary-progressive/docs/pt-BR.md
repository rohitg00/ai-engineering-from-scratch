# Tráfico de sombras, implantação das Canárias e implantação progressiva dos LLM

> Os implementos LLM combinam as partes mais difíceis da implantação de software: não existem testes unitários, modos de falha difusos, sinais atrasados. A sequência é (1) modo sombra  pedidos duplicados de prod para modelo candidato, registro, comparação com impacto zero do usuário; pega problemas óbvios de distribuição, mas não é uma garantia de qualidade; (2) implantação canária  mudança progressiva de tráfego 10% → 25% → 50% → 75% → 100% com portas em cada etapa; percentilhas de latência de rastreamento, custo / pedido, taxa de erro / recusa, distribuição de comprimento de saída, taxa de feedback do usuário; (3) testes A / B para alternativas distintas após a estabilidade confirmar. O não-determinismo é irredutível  variação de precisão de até 15% em corridas com entradas idênticas devido à não-asociabilidade do GPU FP mais variação de tamanho de lote. O custo é variável, não constante  um modelo 20% melhor pode ser 3x mais caro por chamada. A velocidade de retorno é decisiva: se o retorno requer uma redeplocação, é muito lento. Política vive em configuração/flag; modelo vive em registro com digestões fixas; rollback = política de reversão + limiar de reversão + pin modelo antigo em segundos.

**Type:** Learn
**Languages:** Python (stdlib, toy canary-progression simulator)
**Prerequisites:** Phase 17 · 13 (Observability), Phase 17 · 21 (A/B Testing)
**Time:** ~60 minutes

## Objetivos de aprendizagem

- Distinguir o modo sombra (comparar com impacto zero), canário (trafego ao vivo progressivo) e A/B (comparar confirmado pela estabilidade).
- Cite cinco métricas canárias específicas do MLL (latença, custo/requisito, erro/recusão, distribuição de comprimento de saída, feedback do utilizador).
- Explique por que o não-determinismo do MLL (até 15%) muda o que significa "estavel" numa implantação.
- Desenhar um caminho de retrocesso que leve segundos (flip de política) e não horas (redistribuição).

## O problema

Enviamos um novo modelo, as avaliações offline mostram um aumento de 3% de precisão, e depois o colocamos em produção, dentro de 24 horas, o custo aumenta 40%, os dedos do usuário aumentam 8%, três bilhetes de clientes relatam respostas estranhas.

Cada peça disso era evitável. O modo sombra teria pegado o aumento de 40% antes que qualquer usuário o visse. Canary teria parado em 10% quando os polegares baixaram. O retorno da bandeira política teria demorado 30 segundos. A disciplina é o que preenche o fosso entre "a avaliação offline parece boa" e "os usuários reais estão felizes".

## O conceito

### Modo de sombra

O candidato recebe as mesmas solicitações que a produção; as saídas são registradas, não devolvidas aos usuários.

- Conteúdo de produção (diferência em relação à produção).
- Contas de tokens (delta de custo).
- - A latência.
- Rejeição e erro.

Captures: custos aumentados, regressões de comprimento, mudanças óbvias de recusa, erros difíceis. NÃO captura: qualidade que os usuários do delta perceberiam.

### Lançamento das Canárias

Progresso do tráfego com portões. Progressão típica: 1% → 10% → 25% → 50% → 75% → 100%. Portão em 5 métricas em cada etapa:

1. **Latency percentiles** P50, P95, P99. violação: canário tem P99 > 1,5x de linha de base.
2. **Cost per request** misturado.
3. **Error / refusal rate**5xx mais recusas explícitas.
4. **Output length distribution** média + P99. violação: deslocamento distributivo.
5. **User-feedback rate**- Infração: 1,5x da linha de base.

### O não-determinismo é a nova variância

As entradas idênticas produzem saídas não idênticas.

- Não-asociabilidade do GPU FP (ordem de redução de ponto flutuante varia de acordo com o lote).
- Variância de tamanho do lote (a mesma solicitação num lote de 128 versus um lote de 16).
- Amostragem (temperatura > 0).

Medido: variação de precisão de até 15% em conjuntos de avaliação idênticos. "Stable" num lançamento significa que as métricas estão dentro da variância esperada, não idênticas à linha de base.

### O custo é uma variável

Um modelo 20% melhor pode ser 3 vezes mais caro por chamada. custo/requisito é um dos cinco portões. Envio de um modelo "melhor" que quebra a economia de unidade é um caso de retrocesso.

### O Rollback é a arma.

- Flagão de política (sistema de flag de características): porcentagem de desvio em configuração; demora segundos.
- Modelo de fixação (digestão do registo): o modelo fixa não se actualiza automaticamente.
- Rollback = reverter a bandeira + definir digestado fixado para o anterior.

Se a pilha precisar de ser redistribuída para o rollback, corrija-a antes de rolar.

### Ferramentas

**Argo Rollouts**- Não .**Flagger** Controllers de entrega progressivos Kubernetes. Integrados com roteamento ponderado Istio/Linkerd.

**Istio weighted routing** Divisão do tráfego a nível de rede de serviços.

**KServe / Seldon Core** modelo servindo com canário incorporado.

**Feature flags**Lançamento: Darkly, Flagsmith, Unleash.

### Cadência de métricas

Canary gates verifica a cada 5-15 minutos dependendo do volume de tráfego. 1% de 1.000 req/min (10 req/min para o canário) dá 50-150 pontos de dados por janela de 5-15 minutos  suficiente para latência, mas barulhento para o feedback do usuário. 10% dá ~ 10x mais.

### O passo A/B é opcional

Se o novo modelo é claramente diferente (comportamento diferente, curva de custo diferente, tom diferente), teste-o A/B em 50% após o canário passar. Se for apenas uma versão melhorada do mesmo comportamento, puxe para 100% quando os gatos canários passarem. Melhor significa que o eval offline mostrou o ganho. Os gatos canários não medem a conclusão da tarefa, então o skip confia no eval para isso.

### Números que você deve lembrar

- Progressão canária: 1% → 10% → 25% → 50% → 75% → 100%.
- O limite máximo de não-determinismo: até 15% de variação corrida para corrida em insumos idênticos.
- Cinco métricas canárias: latência, custo, erro/recusão, comprimento de saída, feedback do utilizador.
- Por exemplo, o valor de um produto em causa é de 20% ou mais.
- Segundo, não horas.

```figure
i4-canary-ramp
```

## Usá-lo

`code/main.py`Simula uma implantação de canários com regressões injetadas.

## Envia-o

Esta lição produz`outputs/skill-rollout-runbook.md`. Tendo em conta o modelo candidato, a linha de base e a tolerância ao risco, desenha um plano shadow→canary→100%.

## Exercícios

1. Corra .`code/main.py`Injectar uma regressão de 25% dos custos.
2. O seu novo modelo tem 3% de precisão ganho offline mas custo/requisito é +18%. É um navio?
3. Desenhe um rollback que leve menos de 60 segundos de ponta a ponta.
4. Não-determinismo mostra ±7% na sua avaliação.
5. O modo sombra aumenta o custo de 40% antes do canário.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Shadow mode | "duplicate to new" | Zero-impact send-to-candidate for logging |
| Canary | "progressive traffic" | Gradual user-exposed rollout with gates |
| Gates | "rollout checks" | Metric thresholds that block progression |
| Non-determinism | "LLM variance" | Irreducible run-to-run differences |
| Policy flag | "flag flip rollback" | Config-level rollback, seconds not hours |
| Model pin | "registry digest" | Immutable reference to a model version |
| Argo Rollouts | "K8s progressive" | Kubernetes-native canary/rollback controller |
| KServe | "inference K8s" | Model serving with canary primitives |
| Istio weighted | "mesh split" | Service-mesh traffic splitter |

## Mais leitura

- [TianPan — Releasing AI Features Without Breaking Production](https://tianpan.co/blog/2026-04-09-llm-gradual-rollout-shadow-canary-ab-testing)
- [MarkTechPost — Safely Deploying ML Models](https://www.marktechpost.com/2026/03/21/safely-deploying-ml-models-to-production-four-controlled-strategies-a-b-canary-interleaved-shadow-testing/)
- [APXML — Advanced LLM Deployment Patterns](https://apxml.com/courses/mlops-for-large-models-llmops/chapter-4-llm-deployment-serving-optimization/advanced-llm-deployment-patterns)
- [Argo Rollouts docs](https://argo-rollouts.readthedocs.io/)
- [Flagger docs](https://docs.flagger.app/)
