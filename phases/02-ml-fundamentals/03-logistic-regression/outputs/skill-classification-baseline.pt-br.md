---
name: skill-classification-baseline
description: Estabelecer um baseline forte de classificacao antes de partir pra modelos complexos
version: 1.0.0
phase: 2
lesson: 3
tags: [classification, logistic-regression, baseline, preprocessing]
---

# Guia de Baseline de Classificacao

Antes de tentar modelos complexos, estabeleca um baseline com regressao logistica. Treina em segundos, produz probabilidades, e e totalmente interpretavel. Um numero surpreendente de problemas do mundo real nunca precisa de nada mais elaborado.

## Checklist de Decisao

1. A fronteira de decisao provavelmente e linear?
   - Sim: regressao logistica provavelmente sera suficiente
   - Nao: voce ainda quer ela como baseline pra medir melhoria

2. Quantas features voce tem?
   - Menos de 50: regressao logistica padrao funciona bem
   - 50 a 10.000: adicione regularizacao L2 (Ridge)
   - Mais de 10.000 (ex: features de texto TF-IDF): use regularizacao L1 (Lasso) ou LinearSVC

3. O dataset e desbalanceado?
   - Razao menor que 5:1: provavelmente ok sem ajuste
   - 5:1 a 50:1: use `class_weight="balanced"` no sklearn
   - Mais de 50:1: combine ponderacao de classe com metrica adequada (precision, recall, ou F1)

4. As features estao em escalas diferentes?
   - Sempre padronize antes de regressao logistica. Usa otimizacao baseada em gradiente, e features nao-escaladas desaceleram convergencia ou distorcem a fronteira de decisao.

5. Ha valores faltantes?
   - Impute antes de ajustar. Regressao logistica nao lida com NaNs.
   - Use imputacao por mediana pra colunas numericas, moda pra categoricas.

## Quando regressao logistica ja basta

- Classificacao binaria com relacoes de features majoritariamente lineares
- Voce precisa de saidas de probabilidade (nao so labels de classe)
- Interpretabilidade e necessaria (coeficientes indicam direcao de importancia e magnitude relativa apos padronizacao)
- Dados de treino sao pequenos (centenas a poucos milhares de amostras)
- Voce precisa de modelo rapido pra servico em tempo real (unico produto escalar na inferencia)
- Requisitos regulatórios ou de conformidade exigem explicabilidade

## Quando upgrade

- Acuracia estabiliza bem abaixo do alvo e voce ja tentou engenharia de features
- A relacao entre features e alvo e claramente nao-linear (verifique graficos de residuos)
- Voce tem dados tabulares grandes (10k+ linhas): tente gradient boosting (XGBoost ou LightGBM)
- Features tem interacoes complexas que features polinomiais nao podem capturar
- Voce tem dados de imagem, texto ou sequenciais: regressao logistica em entradas brutas nao vai funcionar

## Passos de pre-processamento pra baseline de classificacao

1. **Split treino/teste** primeiro, antes de qualquer pre-processamento. Isso evita vazamento de dados.
2. **Lide com valores faltantes**: imputacao numerica por mediana, categorica por moda.
3. **Codifique categoricas**: one-hot pra baixa cardinalidade (menos de 10 valores), target encoding pra mais. Ajuste target encoding so nos folds de treino (use out-of-fold encoding pra evitar vazamento).
4. **Escale numericas**: StandardScaler (media zero, variancia unitaria). Ajuste no treino, transforme ambos.
5. **Ajuste regressao logistica** com `C=1.0` (regularizacao padrao).
6. **Avalie**: matriz de confusao, precision, recall, F1. Nao so acuracia.
7. **Ajuste threshold**: padrao 0.5 raramente e otimo. Varie de 0.1 a 0.9 e escolha o threshold que combina com sua prioridade de precision/recall.

## Erros comuns

- Avaliar so acuracia em dados desbalanceados (um modelo que prediz a classe majoritaria pontua alto mas e inutil)
- Esquecer de escalar features (regressao logistica com features nao-escaladas treina devagar e converge pra solucao pior)
- Usar o teste de teste pra ajustar o threshold de decisao (use validacao ou cross-validation)
- Pular o baseline e ir direto pro XGBoost (voce perde interpretabilidade e nao tem referencia)
- Nao verificar multicolinearidade (features altamente correlacionadas inflam a variancia dos coeficientes)

## Referencia rapida

| Cenario | Modelo | Regularizacao | Configuracao-chave |
|----------|-------|---------------|-------------|
| Poucas features, interpretavel | LogisticRegression | L2 (padrao) | C=1.0 |
| Muitas features, algumas irrelevantes | LogisticRegression | L1 | penalty="l1", solver="saga" |
| Alta dim esparsa (texto) | SGDClassifier | L1 ou ElasticNet | loss="log_loss" |
| Classes desbalanceadas | LogisticRegression | L2 | class_weight="balanced" |
| Precisa de probabilidades | LogisticRegression | L2 | predict_proba() |
| Precisa so de labels de classe | LinearSVC | L2 | Mais rapido que LR pra dados grandes |
