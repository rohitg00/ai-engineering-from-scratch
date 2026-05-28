# Lidando com Dados Desbalanceados

> Quando 99% dos seus dados são "normais", acurácia é uma mentira.

**Tipo:** Construção
**Idioma:** Python
**Pré-requisitos:** Fase 2, Lições 01-09 (especialmente métricas de avaliação)
**Tempo:** ~90 minutos

## Objetivos de Aprendizado

- Implementar SMOTE do zero e explicar como oversampling sintético difere de duplicação aleatória
- Avaliar classificadores desbalanceados usando F1, AUPRC e MCC ao invés de acurácia
- Comparar pesos de classe, ajuste de limiar e estratégias de resampling
- Construir pipeline completo de dados desbalanceados combinando SMOTE, pesos de classe e otimização de limiar

## O Problema

Você constrói um modelo de detecção de fraude. Acurácia: 99.9%. Mas ele prevê "não fraude" para todas as transações. Acurácia falha porque trata todas previsões corretas igualmente.

## O Conceito

### Por que Acurácia Falha

Com 990 negativos e 10 positivos, um modelo que sempre prevê negativo tem 99% de acurácia mas zero fraudes detectadas.

### Melhores Métricas

- **Precisão** = TP / (TP + FP)
- **Recall** = TP / (TP + FN)
- **F1** = 2 * precisão * recall / (precisão + recall)
- **AUPRC** = Área sob a curva precisão-recall
- **MCC** = Coeficiente de Correlação de Matthews

### SMOTE

Gera amostras sintéticas da classe minoritária interpolando entre pontos reais:

```
nova_amostra = x + random(0, 1) * (vizinho - x)
```

### Pipeline de Dados Desbalanceados

```
Dados Desbalanceados -> Razão de Desbalanceamento?
  Leve (80/20) -> Pesos de Classe
  Moderado (95/5) -> SMOTE + Ajuste de Limiar
  Severo (99/1) -> SMOTE + Pesos + Limiar
```

## Construa

```python
def smote(X_minority, k=5, n_synthetic=None):
    from sklearn.neighbors import NearestNeighbors
    nn = NearestNeighbors(n_neighbors=k+1).fit(X_minority)
    distances, indices = nn.kneighbors(X_minority)
    synthetic = []
    for i in range(n_synthetic or len(X_minority)):
        idx = i % len(X_minority)
        neighbor_idx = indices[idx][np.random.randint(1, k+1)]
        t = np.random.random()
        synthetic.append(X_minority[idx] + t * (X_minority[neighbor_idx] - X_minority[idx]))
    return np.array(synthetic)
```

## Entregue

- `outputs/skill-imbalanced-data.md`

## Termos-Chave

| Termo | Significado |
|-------|-------------|
| SMOTE | Técnica de oversampling sintético para classe minoritária |
| AUPRC | Área sob curva precisão-recall, melhor que AUC para desbalanceamento |
| MCC | Coeficiente de correlação de Matthews, balanceado mesmo com classes desiguais |
| Oversampling | Aumentar amostras da classe minoritária |
| Undersampling | Reduzir amostras da classe majoritária |
| Threshold tuning | Ajustar limiar de classificação para otimizar métrica específica |

## Leitura Adicional

- [SMOTE (Chawla et al., 2002)](https://dl.acm.org/doi/10.1145/1622407.1622416)
- [Imbalanced-learn docs](https://imbalanced-learn.org/)
