---
name: skill-imbalanced-data
description: Lista de verificação de decisão para lidar com problemas de classificação desequilibrada
version: 1.0.0
phase: 2
lesson: 17
tags: [imbalanced-data, smote, class-weights, threshold-tuning, evaluation]
---

# Estratégia de dados desequilibrada

Uma lista de verificação de decisão para lidar com classificações desequilibradas. Siga esta sequência para escolher a abordagem certa para o seu problema.

## Etapa 1: Medir o desequilíbrio

- Contar amostras por aula
- Calcular a relação de desequilíbrio (maioria/minoria)
- Leve: proporção < 3:1 (por exemplo, 70/30)
- Moderado: proporção 3:1 a 20:1 (por exemplo, 95/5)
- Grave: proporção > 20:1 (por exemplo, 99/1)

## Etapa 2: Escolha a métrica certa

Prefira precisão/recuperação/F1 em vez de precisão para conjuntos de dados desequilibrados. Escolha com base no seu problema:

| Situação | Métrica Primária | Métrica Secundária |
|-----------|---------------|-----------------|
| A falta de positivos é muito dispendiosa (fraude, doença) | Lembrar | Pontuação F2 |
| Alarmes falsos custam caro (filtro de spam, recomendações) | Precisão | Pontuação F0.5 |
| Ambos são aproximadamente igualmente importantes | Pontuação F1 | MCC |
| Precisa de uma única métrica de classificação | AUPRC | AUC-ROC |
| Necessidade de comparar conjuntos de dados | MCC | AUPRC |

## Etapa 3: Escolha uma estratégia de reequilíbrio

### Por gravidade do desequilíbrio

| Desequilíbrio | Primeira tentativa | Segunda tentativa | Evite |
|-----------|-----------|------------|-------|
| Leve (<3:1) | Pesos de classe | Ajuste de limite | Sobreamostragem (desnecessária) |
| Moderado (3:1 a 20:1) | SMOTE + pesos de classe | Ajuste de limite no topo | Subamostragem (muita perda de dados) |
| Grave (> 20:1) | SMOTE + pesos de classe + limite | Conjunto com ensacamento balanceado | Subamostragem sozinha |

### Por tamanho do conjunto de dados

| Tamanho do conjunto de dados | Estratégia Preferida | Razão |
|------------|--------|--------|
| < 1.000 amostras | Sobreamostragem ou SMOTE | Não podemos nos dar ao luxo de perder dados majoritários |
| 1.000 - 10.000 | SMOTE + ajuste de limite | Amostras minoritárias suficientes para k-NN |
| > 10.000 | Pesos de classe ou subamostragem | Dados minoritários rápidos e suficientes |

## Passo 4: Aplique a técnica

### Pesos de classe (sempre tente primeiro)
- No sklearn: `class_weight='balanced'`
- Nenhuma modificação de dados necessária
- Funciona com qualquer modelo baseado em perdas
- Equivalente a sobreamostragem na expectativa

### SMOTE
- Aplicar apenas a dados de treinamento (nunca testar/validar)
- Use k=5 vizinhos (padrão)
- Combine com pesos de classe para obter melhores resultados
- Fique atento a pontos sintéticos barulhentos próximos ao limite

### Ajuste de limite
- Treine o modelo, obtenha probabilidades previstas no conjunto de validação
- Limiares de varredura de 0,05 a 0,95
- Escolha o limite maximizando a métrica escolhida
- Sempre ajuste os dados de validação, nunca teste os dados

## Etapa 5: valide corretamente

- Use validação cruzada estratificada (preserva as proporções de classe em cada dobra)
- Relatar métricas no conjunto de testes original (não reamostrado)
- Nunca aplique SMOTE antes de dividir – apenas em dobras de treinamento
- Compare com a linha de base "sempre prever a maioria"

## Etapa 6: Erros comuns a serem evitados

- Aplicar SMOTE a todo o conjunto de dados antes da divisão de treinamento/teste (vazamento de dados)
- Usando a precisão como métrica de avaliação
- Não tentar primeiro os pesos das classes (abordagem mais simples, muitas vezes suficiente)
- Sobreamostragem e validação cruzada (pontos sintéticos vazam pelas dobras)
- Ignorando o ajuste de limite (desempenho livre, sem necessidade de retreinamento)
- Usar subamostragem aleatória em pequenos conjuntos de dados (joga fora muitos dados)

## Árvore de decisão rápida

1. A proporção de desequilíbrio é < 3:1? -> Experimente apenas pesos de classe
2. O conjunto de dados tem mais de 10.000 amostras? -> Pesos de classe + ajuste de limite
3. O conjunto de dados tem <1.000 amostras? -> SMOTE + pesos de classe
4. Caso contrário -> SMOTE + pesos de classe + ajuste de limite
5. Ainda não é bom o suficiente? -> Conjunto de ensacamento balanceado