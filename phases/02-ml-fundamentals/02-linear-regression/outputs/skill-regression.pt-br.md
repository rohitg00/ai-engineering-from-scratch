---
name: skill-regression
description: Escolher a abordagem certa de regressao baseada nas caracteristicas dos dados e restricoes do problema
version: 1.0.0
phase: 2
lesson: 2
tags: [regression, linear-regression, polynomial-regression, ridge, regularization]
---

# Guia de Estrategia de Regressao

Regressao prediz valores continuos. A abordagem certa depende da relacao entre features e alvo, do numero de features, e do risco de overfitting.

## Checklist de Decisao

1. A relacao entre features e alvo e aproximadamente linear?
   - Sim: comece com regressao linear ordinaria
   - Nao: tente features polinomiais ou modelo nao-linear

2. Quantas features voce tem em relacao as amostras?
   - Poucas features, muitas amostras: regressao linear ordinaria funciona bem
   - Muitas features, poucas amostras: use regularizacao (Ridge ou Lasso)
   - Mais features que amostras: Lasso (L1) pra selecionar features, ou Ridge (L2) pra encolher todos pesos

3. Voce precisa de interpretabilidade?
   - Sim: regressao linear com poucas features, ou Lasso pra selecao automatica de features
   - Nao: features polinomiais, ou mude pra modelos baseados em arvore ou redes neurais

4. Seu dataset e pequeno (menos de 10.000 linhas)?
   - Use a equacao normal (solucao de forma fechada) pra velocidade
   - Cross-validation e essencial pra avaliacao confiavel

5. Seu dataset e grande (milhoes de linhas)?
   - Use stochastic gradient descent (SGD) ou mini-batch gradient descent
   - A equacao normal e lenta demais devido a inversao de matriz O(n^3)

## Quando usar cada abordagem

**Regressao Linear Ordinaria**: baseline pra qualquer tarefa de regressao. Comece aqui. Se R-squared for aceitavel e o modelo for simples, pare aqui.

**Regressao Polinomial**: o scatter plot mostra uma curva, nao uma linha. Comece com grau 2. Aumente so se justificado por performance de validacao. Grau > 5 quase sempre causa overfitting.

**Regressao Ridge (L2)**: muitas features correlacionadas. Todos os pesos diminuem em direcao ao zero mas nenhum vira exatamente zero. Bom quando voce acredita que todas features contribuem.

**Regressao Lasso (L1)**: muitas features e voce suspeita que so poucas importam. Lasso colapsa pesos de features irrelevantes pra exatamente zero, fazendo selecao automatica de features.

**Elastic Net**: combina penalidades L1 e L2. Use quando voce tem muitas features correlacionadas e quer alguma selecao de features.

## Erros comuns

- Pular feature scaling antes de gradient descent (convergencia fica extremamente lenta)
- Usar performance do teste de teste pra ajustar hiperparametros (use conjunto de validacao ou cross-validation)
- Ajustar polinomiais de alto grau sem verificar erro de validacao (R^2 de treino sempre aumenta com o grau)
- Ignorar graficos de residuos (R^2 pode ser enganador se residuos mostram padroes)
- Tratar R^2 como a unica metrica (verifique distribuicao de residuos, MAE, e limites especificos do dominio)

## Referencia rapida

| Metodo | Quando usar | Regularizacao | Selecao de features |
|---|---|---|---|
| OLS | Baseline, poucas features | Nenhuma | Manual |
| Ridge | Muitas features, todas relevantes | L2 (encolher) | Nao |
| Lasso | Muitas features, poucas relevantes | L1 (zerar) | Automatica |
| Elastic Net | Muitas features correlacionadas | L1 + L2 | Parcial |
| Polynomial | Relacao nao-linear | Adicione Ridge/Lasso por cima | Escolha manual de grau |
