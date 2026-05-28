# Seleção de Features

> Mais features não é melhor. As features certas é melhor.

**Tipo:** Construção
**Idioma:** Python
**Pré-requisitos:** Fase 2, Lições 01-09, 08 (feature engineering)
**Tempo:** ~75 minutos

## Objetivos de Aprendizado

- Implementar métodos filtro (threshold de variância, informação mútua, chi-quadrado) e wrapper (RFE, seleção progressiva) do zero
- Explicar por que informação mútua captura relações não-lineares que correlação perde
- Comparar regularização L1 (seleção embarcada) com RFE (seleção wrapper)
- Construir pipeline de seleção de features combinando múltiplos métodos

## O Problema

Você tem 500 features. Seu modelo treina devagar, faz overfitting constantemente. A seleção de features é o antídoto: remova ruído, remova redundância, mantenha features com informação real.

## O Conceito

### Três Categorias

**Métodos filtro:** Pontuam cada funcionalidade independentemente usando medida estatística. Rápidos, mas perdem interações.

**Métodos wrapper:** Treinam modelo para avaliar subconjuntos. Melhores resultados, mas caros.

**Métodos embarcados:** Selecionam features durante o treino. L1 regularização direciona pesos para zero.

### Threshold de Variância

Se uma funcionalidade mal varia, carrega quase nenhuma informação. Remova-a.

### Informação Mútua

Mede quanto saber o valor de X reduz incerteza sobre Y. Captura relações não-lineares.

```
I(X; Y) = sum_x sum_y p(x, y) * log(p(x, y) / (p(x) * p(y)))
```

### Eliminação Recursiva de Features (RFE)

Wrapper que usa importância do modelo para podar iterativamente features.

### Seleção Progressiva

Começa com zero features, adiciona a que mais melhora o modelo.

## Construa

```python
from sklearn.feature_selection import mutual_info_classif, RFE
from sklearn.ensemble import RandomForestClassifier

# Informação mútua
mi_scores = mutual_info_classif(X, y)

# RFE
rfe = RFE(RandomForestClassifier(n_estimators=100), n_features_to_select=10)
rfe.fit(X, y)
selected = rfe.support_
```

## Entregue

- `outputs/skill-feature-selector.md`

## Termos-Chave

| Termo | Significado |
|-------|-------------|
| Método filtro | Pontua features independentemente do modelo |
| Método wrapper | Usa performance do modelo para avaliar subconjuntos |
| Método embarcado | Seleciona durante o treino (L1, árvores) |
| Informação mútua | Mede dependência entre funcionalidade e target, captura não-linearidades |
| RFE | Eliminação recursiva de features |
| L1/Lasso | Regularização que direciona pesos para zero (sparsidade) |

## Leitura Adicional

- [scikit-learn Feature Selection](https://scikit-learn.org/stable/modules/feature_selection.html)
- [Guyon & Elisseeff, An Introduction to Feature Selection (2003)](https://jmlr.org/papers/v3/guyon03a.html)
