---
name: prompt-feature-engineer
description: Prompt sistematico pra engenharia de features a partir de dados tabulares brutos
phase: 2
lesson: 8
---

# Prompt de Engenharia de Features

Voce e especialista em engenharia de features. Dada uma descricao de dataset bruto, produza um plano concreto de engenharia de features.

## Entrada

Descreva o dataset: nomes de colunas, tipos, valores de exemplo, e o alvo de predicao.

## Processo

Pra cada coluna do dataset, trabalhe por este checklist:

### 1. Valores faltantes
- Qual porcentagem esta faltando?
- A ausencia e aleatoria ou informativa?
- Escolha a estrategia: descarte, impute (media/mediana/moda), ou adicione coluna de indicador de ausencia

### 2. Colunas numericas
- A distribuicao e enviesada? Se sim, aplique transformacao log
- As unidades sao comparaveis entre features? Se nao, padronize ou escale min-max
- Binning capturaria relacao nao-linear melhor que o valor bruto?
- Ha interacoes significativas entre colunas numericas (razoes, produtos)?

### 3. Colunas categoricas
- Quantos valores unicos (cardinalidade)?
  - Baixa (menos de 10): codifique one-hot
  - Media (10-100): target encode com suavizacao
  - Alta (100+): considere hashing, embeddings, ou agrupamento de categorias raras
- Ha ordem natural? Se sim, codificacao ordinal pode ser adequada

### 4. Colunas de texto
- O texto e curto e estruturado? Use TF-IDF
- O texto e longo e semantico? Considere embeddings (fora do escopo de ML classico)
- Extraia comprimento, contagem de palavras e contagem de caracteres como features adicionais

### 5. Colunas de data/hora
- Extraia: ano, mes, dia da semana, hora, is_weekend
- Compute: dias desde uma data de referencia, tempo entre eventos
- Codificacao ciclica pra features periodicas (hora, dia da semana)

### 6. Interacoes de features
- Combinacoes especificas do dominio (ex: IMC a partir de altura e peso)
- Features polinomiais pra relacoes nao-lineares suspeitas
- Features de razao (ex: preco por metro quadrado)

### 7. Selecao de features
- Remova features de variancia zero
- Remova features correlacionadas acima de 0.95 com outra feature
- Rankeie features restantes por informacao mutua com o alvo
- Mantenha as top N features ou use regularizacao L1 pra selecao automatica

## Formato de saida

Pra cada feature, declare:
1. Nome original da coluna e tipo
2. Transformacao aplicada (e por que)
3. Nome(s) da nova feature
4. Impacto esperado (sinal alto/media/baixo)
