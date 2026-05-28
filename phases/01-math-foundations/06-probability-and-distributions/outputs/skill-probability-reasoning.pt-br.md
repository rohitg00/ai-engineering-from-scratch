---
name: skill-probability-reasoning
description: Escolher a distribuicao de probabilidade certa pra um problema de ML
version: 1.0.0
phase: 1
lesson: 6
tags: [probability, distributions, modeling]
---

# Selecao de Distribuicao de Probabilidade

Como escolher a distribuicao certa ao modelar dados, projetar funcoes de loss, ou configurar priors.

## Checklist de Decisao

1. O resultado e discreto (categorias, contagens) ou continuo (medicoes, escores)?
2. O resultado e delimitado (ex: [0, 1]) ou ilimitado?
3. Quantos resultados possiveis existem? Dois? k? Infinitos?
4. Os dados sao simetricos ou enviesados?
5. Os eventos sao independentes ou correlacionados?
6. Voce esta modelando uma taxa, uma contagem, uma proporcao, ou uma medicao?

## Arvore de decisao pra distribuicoes

```
A variavel e discreta?
  Sim --> So 2 resultados? --> Bernoulli (p)
     |    k resultados, um trial? --> Categorica (p1...pk)
     |    k resultados, n trials? --> Multinomial (n, p1...pk)
     |    Contagem de sucessos em n trials? --> Binomial (n, p)
     |    Contagem de eventos por intervalo? --> Poisson (lambda)
     |    Contagem de trials ate o primeiro sucesso? --> Geometrica (p)
     |    Contagem de trials ate r sucessos? --> Binomial Negativa (r, p)
  Nao --> Simetrica, formato de sino? --> Normal (mu, sigma)
     |   Valores positivos, enviesada pra direita? --> Log-normal ou Exponencial
     |   Delimitada em [0, 1]? --> Beta (alpha, beta)
     |   Valores positivos, formato flexivel? --> Gamma (alpha, beta)
     |   Tempo entre eventos? --> Exponencial (lambda)
     |   Caudas pesadas necessarias? --> Student's t (nu) ou Cauchy
     |   Multivariada, formato de sino? --> Normal Multivariada
     |   No simples (soma 1)? --> Dirichlet (alpha)
```

## Mapeando cenarios reais de ML pra distribuicoes

| Cenario | Distribuicao | Parametros |
|---|---|---|
| Saida de classificacao binaria | Bernoulli | p = sigmoid(logit) |
| Saida de classificacao multi-classe | Categorica | p = softmax(logits) |
| Predicao de token em modelos de linguagem | Categorica sobre vocab | p do softmax |
| Intensidade de pixel (normalizada) | Beta ou Uniforme [0, 1] | Depende das estatisticas da imagem |
| Contagem de palavras num documento | Poisson | lambda = media de palavras |
| Tempo entre requisicoes do usuario | Exponencial | lambda = taxa de requisicoes |
| Erro de medicao | Normal | mu = 0, sigma dos dados |
| Inicializacao de pesos | Normal ou Uniforme | Regras Kaiming/Xavier |
| Prior no espaco latente do VAE | Normal Padrao | mu = 0, sigma = 1 |
| Prior Bayesiano em proporcoes | Beta | alpha, beta da crenca |
| Prior Bayesiano em pesos de categorias | Dirichlet | vetor alpha |
| Ruido nos alvos de regressao | Normal | mu = 0, sigma estimada |
| Regressao robusta a outliers | Student's t | baixos graus de liberdade |
| Modelagem de duracao/vida util | Weibull ou Gamma | forma e escala |
| Distribuicao topica por documento (LDA) | Dirichlet | alpha < 1 pra esparsidade |

## Quando as distribuicoes dao errado

- Usar Normal quando os dados tem um limite inferior rigido (ex: precos, distancias). A normal atribui probabilidade nao-negativa a valores negativos. Use log-normal ou gamma.
- Usar Poisson quando a variancia difere da media. Poisson assume media = variancia. Se variancia > media, use binomial negativa.
- Usar Bernoulli pra problemas multi-classe. Bernoulli e estritamente binaria. Use categorica pra k > 2.
- Assumir independencia quando as observacoes sao correlacionadas. Series temporais, dados espaciais e dados agrupados violam a independencia. Use modelos autorregressivos ou hierarquicos.

## Erros comuns

- Confundir valores de PDF com probabilidades. Uma PDF pode exceder 1. Probabilidade vem de integrar a PDF sobre um intervalo.
- Esquecer que as saidas do softmax sao probabilidades categoricas, nao probabilidades Bernoulli independentes. Elas somam 1 por construcao.
- Usar um prior uniforme quando voce tem conhecimento de dominio. Priors informativos reduzem variancia sem enviesar o resultado se bem escolhidos.
- Tratar log-probabilidades como probabilidades. Log-probs sao sempre negativas (ou zero). Elas nao somam 1.

## Referencia rapida: propriedades das distribuicoes

| Distribuicao | Suporte | Media | Variancia | Propriedade-chave |
|---|---|---|---|---|
| Bernoulli(p) | {0, 1} | p | p(1-p) | Mais simples discreta |
| Binomial(n, p) | {0..n} | np | np(1-p) | Soma de n Bernoulli |
| Poisson(lam) | {0, 1, 2, ...} | lam | lam | Media = variancia |
| Normal(mu, s^2) | (-inf, inf) | mu | s^2 | Max entropia pra media/var dadas |
| Exponencial(lam) | [0, inf) | 1/lam | 1/lam^2 | Sem memoria |
| Beta(a, b) | [0, 1] | a/(a+b) | ab/((a+b)^2(a+b+1)) | Conjugada a Binomial |
| Gamma(a, b) | (0, inf) | a/b | a/b^2 | Conjugada a Poisson |
| Dirichlet(alpha) | Simples | alpha_i/sum | (ver formula) | Conjugada a Categorica |
