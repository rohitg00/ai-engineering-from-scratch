---
name: skill-information-theory
description: Aplicar conceitos de teoria da informacao em funcoes de loss de ML, avaliacao de modelos e selecao de features
version: 1.0.0
phase: 1
lesson: 9
tags: [information-theory, entropy, loss-functions]
---

# Teoria da Informacao pra ML

Quando usar entropia, cross-entropy, divergencia KL e informacao mutua em sistemas de machine learning.

## Checklist de Decisao

1. Medindo incerteza em uma unica distribuicao? Use **entropia**.
2. Medindo quao bem um modelo aproxima os labels verdadeiros? Use **cross-entropy** (essa e sua loss de classificacao).
3. Medindo distancia entre duas distribuicoes? Use **divergencia KL**.
4. Verificando se duas variaveis estao relacionadas? Use **informacao mutua**.
5. Reportando qualidade de modelo de linguagem? Use **perplexity** (exponencial da cross-entropy).
6. Destilando um modelo em outro? Minimize a **divergencia KL** do professor pro aluno.

## Quando usar cada medida

| Medida | Formula | Caso de uso | Aplicacao ML |
|---|---|---|---|
| Entropia H(P) | -sum(p log p) | Quao incerta e essa distribuicao? | Complexidade de dados, modelos de maxima entropia |
| Cross-entropy H(P,Q) | -sum(p log q) | Quao bom e o modelo Q em prever o P verdadeiro? | Loss de classificacao, loss de modelo de linguagem |
| Divergencia KL D(P\|\|Q) | sum(p log(p/q)) | Quao diferentes sao P e Q? | Loss de VAE (ELBO), destilacao de conhecimento, RLHF |
| Informacao mutua I(X;Y) | H(X) - H(X\|Y) | Quanto Y nos diz sobre X? | Selecao de features, aprendizado de representacao |
| Perplexity | exp(H(P,Q)) ou 2^H | Quao confuso esta o modelo? | Avaliacao de modelo de linguagem |
| Entropia condicional H(X\|Y) | -sum(p(x,y) log p(x\|y)) | Incerteza restante em X apos conhecer Y | Informatividade de features |

## Relacoes-chave

```
Cross-entropy  = Entropia + Divergencia KL
H(P, Q)        = H(P)   + D_KL(P || Q)

Como H(P) e constante durante o treinamento:
  Minimizar cross-entropy = Minimizar divergencia KL

Informacao mutua = Entropia - Entropia condicional
I(X; Y) = H(X) - H(X|Y) = H(Y) - H(Y|X)

Perplexity = exp(cross-entropy em nats)
           = 2^(cross-entropy em bits)
```

## Referencia rapida: formulas e unidades

| Formula | Bits (log base 2) | Nats (log base e) |
|---|---|---|
| Informacao: -log(p) | -log2(p) | -ln(p) |
| Entropia: -sum(p log p) | bits | nats |
| 1 nat = | 1.4427 bits | 1 nat |
| Padrao PyTorch | -- | nats |
| Papers de teoria da informacao | bits | -- |

## Interpretando valores

| Valor de entropia | Significado |
|---|---|
| 0 | Deterministico. Um resultado tem probabilidade 1. |
| log(n) | Incerteza maxima. Distribuicao uniforme sobre n resultados. |
| Baixa | Distribuicao e pico. Modelo e confiante. |
| Alta | Distribuicao e plana. Modelo e incerto. |

| Valor de perplexity | Qualidade do modelo de linguagem |
|---|---|
| 1 | Predicao perfeita (nao acontece na pratica) |
| 10 | Escolhendo entre ~10 tokens igualmente provaveis em media |
| 50 | Nivel GPT-2 em benchmarks padrao |
| < 10 | State-of-the-art pra dominios bem representados |

## Erros comuns

- Computar divergencia KL e tratar como simetrica. D_KL(P||Q) != D_KL(Q||P). Pra medida simetrica, use divergencia Jensen-Shannon: JS = 0.5 * KL(P||M) + 0.5 * KL(Q||M) onde M = 0.5*(P+Q).
- Esquecer que cross-entropy com labels one-hot simplifica pra -log(p_true_class). Voce nao precisa somar sobre todas as classes quando a distribuicao verdadeira e one-hot.
- Usar log base 2 no codigo mas reportar nats (ou vice-versa). PyTorch usa logaritmo natural por padrao. Multiplique por log2(e) = 1.4427 pra converter nats em bits.
- Computar entropia de um evento vazio ou de probabilidade zero. Convencoes: 0 * log(0) = 0, porque lim(p->0) p*log(p) = 0.
- Comparar perplexity entre vocabularios diferentes. Um modelo com vocab de 50k e perplexity 30 nao e diretamente comparavel com um de vocab de 10k e perplexity 30.

## Onde cada conceito aparece na producao de ML

| Conceito | Onde voce ve |
|---|---|
| Loss de cross-entropy | Todo modelo de classificacao (nn.CrossEntropyLoss) |
| Divergencia KL | VAE ELBO, clipping PPO, destilacao de conhecimento |
| Regularizacao por entropia | Bonus de exploracao no RL (maior entropia = mais exploracao) |
| Informacao mutua | Selecao de features, loss InfoNCE (aprendizado contrastivo) |
| Perplexity | Benchmarks de modelos de linguagem (menor = melhor) |
| Label smoothing | Substitui one-hot por targets suaves, reduz superconfianca da cross-entropy |
| Temperature scaling | Divide logits por T antes do softmax, controla entropia da saida |
