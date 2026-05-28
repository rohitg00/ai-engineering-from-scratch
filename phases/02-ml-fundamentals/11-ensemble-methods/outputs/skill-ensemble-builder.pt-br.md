---
name: skill-ensemble-builder
description: Escolher o metodo de ensemble certo e configura-lo pro seu problema
version: 1.0.0
phase: 2
lesson: 11
tags: [ensemble, bagging, boosting, random-forest, xgboost, stacking]
---

# Guia de Selecao de Metodo de Ensemble

Ensembles combinam multiplos modelos pra produzir predicoes melhores que qualquer modelo individual. A questao sempre e: qual tipo de ensemble, e quando?

## Checklist de Decisao

1. Qual o principal problema com seu modelo atual?
   - Alta variancia (overfitting): use bagging (Random Forest)
   - Alto bias (underfitting): use boosting (Gradient Boosting, XGBoost)
   - Ambos, ou voce quer acuracia maxima: use stacking

2. Quantos dados voce tem?
   - Menos de 1.000 linhas: Random Forest (robusto, dificil de configurar errado)
   - 1.000 a 100.000: XGBoost ou LightGBM (melhor geral pra dados tabulares)
   - Mais de 100.000: LightGBM (gradient boosting mais rapido, lida bem com dados grandes)

3. Quanto tempo de ajuste voce pode investir?
   - Minimo: Random Forest com padroes (quase sempre funciona)
   - Moderado: XGBoost com learning_rate=0.1, ajuste n_estimators com early stopping
   - Maximo: LightGBM ou XGBoost com busca bayesiana de hiperparametros

4. Voce precisa de interpretabilidade?
   - Sim: arvore de decisao unica ou Random Forest pequeno com importancia de features
   - Parcial: gradient boosting com valores SHAP
   - Nao: stacking ou ensembles profundos

5. Os dados sao ruidosos com muitos outliers?
   - Sim: Random Forest (bagging e robusto a ruido)
   - Nao: gradient boosting (pode empurrar acuracia mais em dados limpos)

## Quando usar cada metodo

**Random Forest (Bagging)**: sua escolha segura inicial. Treina muitas arvores em amostras bootstrap e media. Reduza variancia sem aumentar bias. Quase impossivel de overfit em dados moderados. Minimo de ajuste necessario: defina n_estimators=100-500 e deixe padroes.

**AdaBoost**: boosting sequencial com reponderacao de amostras. Funciona bem com aprendizes base simples (stumps de decisao). Sensivel a outliers e labels ruidosos porque aumenta o peso dos pontos classificados incorretos. Amplamente substituido por gradient boosting na pratica.

**Gradient Boosting**: ajusta cada nova arvore nos residuos do ensemble ate agora. Reduz bias. O metodo mais poderoso pra dados tabulares. Requer ajuste: learning_rate, n_estimators, max_depth, min_child_weight, subsample.

**XGBoost**: gradient boosting com regularizacao, otimizacao de segunda ordem, e aceleracoes de sistema. Lida com valores faltantes nativamente. O padrao pra competicoes Kaggle e ML em producao em dados tabulares.

**LightGBM**: gradient boosting com crescimento por folha (em vez de por nivel). Mais rapido que XGBoost em datasets grandes. Usa divisoes baseadas em histograma. Melhor pra datasets com mais de 50k linhas.

**CatBoost**: gradient boosting com tratamento nativo de features categoricas. Nao precisa de codificacao one-hot. Bom quando voce tem muitas features categoricas.

**Stacking**: treina um meta-learner nas predicoes de multiplos modelos base diversos. Use quando precisa da acuracia absoluta melhor e tem compute sobrando. Sempre gere previsoes de modelos base via cross-validation pra evitar vazamento.

**Votacao**: ensemble mais simples. Votacao dura (classe majoritaria) ou votacao suave (media de probabilidades). Forma rapida de combinar 2-3 modelos diversos sem meta-learner.

## Erros comuns

- Usar gradient boosting sem early stopping (vai overfit se deixar rodar muitas rodadas)
- Definir learning_rate alto (acima de 0.3 geralmente causa instabilidade)
- Nao ajustar max_depth pra gradient boosting (padrao de arvores ilimitadas ou muito profundas causa overfit)
- Stacking com modelos que sao todos do mesmo tipo (diversidade e o ponto do stacking)
- Usar AdaBoost em dados ruidosos (outliers ganham peso cada vez maior a cada rodada)
- Esperar que Random Forest corrija underfitting (reduz variancia, nao bias)

## Prioridades de ajuste por metodo

**Random Forest:**
1. n_estimators: 100-500 (mais raramente e pior, so mais lento)
2. max_depth: Nenhum (deixe arvores crescerem totalmente) ou limite em 10-20 pra velocidade
3. max_features: "sqrt" pra classificacao, "log2" ou n/3 pra regressao

**XGBoost / LightGBM:**
1. learning_rate: 0.01-0.3 (menor e melhor se voce tem compute pra mais arvores)
2. n_estimators: use early stopping num conjunto de validacao em vez de adivinhar
3. max_depth: 3-8 (comece com 6)
4. min_child_weight / min_data_in_leaf: 1-20 (maior previne overfit)
5. subsample: 0.7-1.0
6. colsample_bytree: 0.7-1.0
7. reg_alpha (L1) e reg_lambda (L2): 0-10

## Referencia rapida

| Metodo | Reduz | Velocidade | Esforco de ajuste | Melhor pra |
|--------|---------|-------|--------------|----------|
| Random Forest | Variancia | Rapido | Baixo | Dados ruidosos, baseline rapido |
| AdaBoost | Bias | Rapido | Baixo | Aprendizes base simples, dados limpos |
| Gradient Boosting | Bias | Medio | Alto | Dados tabulares, competicoes |
| XGBoost | Ambos | Rapido | Alto | ML tabular em producao |
| LightGBM | Ambos | Mais rapido | Alto | Dados grandes (50k+ linhas) |
| CatBoost | Ambos | Medio | Medio | Muitas features categoricas |
| Stacking | Ambos | Lento | Alto | Acuracia maxima, modelos diversos |
| Votacao | Variancia | Rapido | Nenhuma | Combinacao rapida de 2-3 modelos |
