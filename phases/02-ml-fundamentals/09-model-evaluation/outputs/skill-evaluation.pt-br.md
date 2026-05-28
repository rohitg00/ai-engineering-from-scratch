---
name: skill-evaluation
description: Checklist de estrategia de avaliacao pra modelos de classificacao e regressao
version: 1.0.0
phase: 2
lesson: 9
tags: [evaluation, metrics, cross-validation, model-selection]
---

# Estrategia de Avaliacao de Modelos

Um checklist pra avaliar corretamente qualquer modelo de ML. Siga essa sequencia pra evitar os erros de avaliacao mais comuns.

## Passo 1: Divida os dados corretamente

- Divida antes de qualquer pre-processamento (escalacao, imputacao, codificacao)
- Use divisoes estratificadas pra tarefas de classificacao
- Reserve um teste de teste que voce toca exatamente uma vez no final
- Pra datasets pequenos, use cross-validation de 5-fold ou 10-fold em vez de um unico split
- Pra series temporais, use divisoes baseadas em tempo (nunca embaralhe)

## Passo 2: Escolha a metrica certa

### Classificacao

| Situacao | Use esta metrica | Por que |
|-----------|----------------|-----|
| Classes balanceadas, comparacao simples | Acuracia | Facil de interpretar, significativa quando classes sao iguais |
| Falsos positivos sao custosos (filtro de spam, alertas de fraude) | Precision | Mede quantos itens sinalizados sao realmente positivos |
| Falsos negativos sao custosos (triagem de cancer, seguranca) | Recall | Mede quantos positivos reais voce pega |
| Precisa equilibrar precision e recall | F1 Score | Media harmonica, pune desequilibrio extremo |
| Comparando modelos entre thresholds | AUC-ROC | Qualidade de ranking independente de threshold |
| Dados desbalanceados | F1, AUC-ROC, ou PR-AUC | Acuracia e enganadora com classes desbalanceadas |

### Regressao

| Situacao | Use esta metrica | Por que |
|-----------|----------------|-----|
| Regressao padrao, outliers aceitaveis | RMSE | Mesmas unidades do alvo, penaliza erros grandes |
| Avaliacao robusta a outliers | MAE | Trata todos erros igualmente, nao e dominada por outliers |
| Comparando modelos em escalas diferentes | R-squared | Escala normalizada 0-1 (fracao de variancia explicada) |
| Negocio requer valores em dolar | MAE ou RMSE | Diretamente interpretavel como magnitude de erro |

## Passo 3: Estabeleca baselines

Antes de avaliar seu modelo, compute performance de baseline:
- Classificacao: preditor de classe majoritaria (sempre prediga a classe mais comum)
- Regressao: sempre prediga a media do alvo de treino
- Qualquer modelo que nao supere esses baselines nao esta aprendendo

## Passo 4: Cross-valide

- Use K-fold (K=5 ou K=10) pra estimativas estaveis
- Use K-fold estratificado pra classificacao
- Reporte media e desvio padrao entre folds
- Um modelo com media=0.85 e desvio=0.02 e mais confiavel que media=0.87 e desvio=0.10

## Passo 5: Compare modelos estatisticamente

- Nao escolha o modelo com a maior pontuacao media sem verificar significancia
- Use um t-test pareado entre folds de cross-validation
- Se |t| < 2.78 (pra K=5, df=4, p<0.05), a diferenca pode ser por acaso
- Considere o modelo mais simples quando diferencas de performance nao sao significativas

## Passo 6: Verifique erros comuns

- Vazamento de dados: alguma informacao do teste de teste vazou pro treino? (escalacao antes da divisao, features derivadas do alvo)
- Desbalanceamento de classe: a acuracia esta escondendo performance ruim da classe minoritaria?
- Overfitting: o gap entre treino e validacao e grande demais?
- Avaliacoes em excesso: voce olhou pro teste de teste mais de uma vez?

## Passo 7: Reporte performance final

- Treine no treino + validacao combinados
- Avalie no teste de teste separado exatamente uma vez
- Reporte a metrica escolhida com intervalos de confianca se possivel
- Declare a comparacao com baseline (quao melhor que aleatorio/media)

## Referencia rapida

| Metrica | Quando usar | Como interpretar |
|---------|------------|-----------------|
| Acuracia | Classes balanceadas | Fracao de predicoes corretas |
| Precision | Falsos positivos custosos | Dos sinalizados, quantos sao realmente positivos |
| Recall | Falsos negativos custosos | Dos positivos reais, quantos voce pega |
| F1 | Equilibrar precision e recall | Media harmonica das duas |
| AUC-ROC | Comparar modelos com diferentes thresholds | Area sob a curva (1.0 = perfeito, 0.5 = aleatorio) |
| RMSE | Erros grandes sao especialmente ruins | Raiz do erro quadrado medio |
| MAE | Todos erros importam igualmente | Erro absoluto medio |
| R-squared | Quanto da variancia foi explicada | 1.0 = perfeito, 0.0 = media |
