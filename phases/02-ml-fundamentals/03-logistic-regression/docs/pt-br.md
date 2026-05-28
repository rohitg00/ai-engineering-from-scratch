# Regressão Logística

> Regressão logística dobra uma reta numa curva em S pra responder perguntas de sim ou não com probabilidades.

**Tipo:** Build
**Linguagens:** Python
**Pré-requisitos:** Fase 2 Aulas 1-2 (O Que É ML, Regressão Linear)
**Tempo:** ~90 minutos

## Objetivos de Aprendizado

- Implementar regressão logística do zero usando a função sigmoid e entropia cruzada binária
- Calcular e interpretar precisão, recall, F1 score e matriz de confusão para classificação binária
- Explicar por que MSE falha para classificação e por que entropia cruzada binária produz uma superfície de custo convexa
- Construir um modelo de regressão softmax para classificação multi-classe e avaliar tradeoffs de ajuste de limiar

## O Problema

Você quer prever se um tumor é maligno ou benigno dado seu tamanho. Tenta regressão linear. Ela produz números como 0.3 ou 1.7 ou -0.5. O que esses valores significam? 1.7 é "muito maligno"? -0.5 é "muito benigno"? Regressão linear produz números ilimitados. Classificação precisa de probabilidades delimitadas entre 0 e 1, e uma decisão clara: sim ou não.

Regressão logística resolve isso. Pega a mesma combinação linear (wx + b) e passa pela função sigmoid, que comprime qualquer número pro intervalo (0, 1). A saída é uma probabilidade. Você define um limiar (geralmente 0.5) e toma uma decisão.

## O Conceito

### A Função Sigmoid

```
sigmoid(z) = 1 / (1 + e^(-z))
```

Propriedades:
- Quando z é grande e positivo, sigmoid(z) se aproxima de 1
- Quando z é grande e negativo, sigmoid(z) se aproxima de 0
- Quando z = 0, sigmoid(z) = 0.5
- A saída é sempre entre 0 e 1

### Entropia Cruzada Binária

```
Perda = -(1/n) * sum(y * log(p) + (1-y) * log(1-p))
```

### Gradiente da Regressão Logística

```
dL/dw = (1/n) * sum((p - y) * x)
dL/db = (1/n) * sum(p - y)
```

Esses gradientes são idênticos aos da regressão linear. A diferença é que p = sigmoid(wx + b) em vez de p = wx + b.

### Métricas de Avaliação

**Precisão**: De todas as coisas previstas como positivas, quantas realmente são positivas?
```
Precisão = VP / (VP + FP)
```

**Recall**: De todas as coisas realmente positivas, quantas pegamos?
```
Recall = VP / (VP + FN)
```

**F1 Score**: Média harmônica de precisão e recall.
```
F1 = 2 * (Precisão * Recall) / (Precisão + Recall)
```

## Construa

### Passo 1: Função sigmoid e geração de dados

```python
import random
import math

def sigmoid(z):
    z = max(-500, min(500, z))
    return 1.0 / (1.0 + math.exp(-z))

random.seed(42)
N = 200
X = []
y = []

for _ in range(N // 2):
    X.append([random.gauss(2, 1), random.gauss(2, 1)])
    y.append(0)

for _ in range(N // 2):
    X.append([random.gauss(5, 1), random.gauss(5, 1)])
    y.append(1)
```

### Passo 2: Regressão logística do zero

```python
class LogisticRegression:
    def __init__(self, n_features, learning_rate=0.01):
        self.weights = [0.0] * n_features
        self.bias = 0.0
        self.lr = learning_rate
        self.loss_history = []

    def predict_proba(self, x):
        z = sum(w * xi for w, xi in zip(self.weights, x)) + self.bias
        return sigmoid(z)

    def predict(self, x, threshold=0.5):
        return 1 if self.predict_proba(x) >= threshold else 0
```

### Passo 3: Matriz de confusão e métricas do zero

```python
class ClassificationMetrics:
    def __init__(self, y_true, y_pred):
        self.tp = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 1)
        self.tn = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 0)
        self.fp = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 1)
        self.fn = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 0)

    def accuracy(self):
        total = self.tp + self.tn + self.fp + self.fn
        return (self.tp + self.tn) / total if total > 0 else 0

    def precision(self):
        denom = self.tp + self.fp
        return self.tp / denom if denom > 0 else 0

    def recall(self):
        denom = self.tp + self.fn
        return self.tp / denom if denom > 0 else 0

    def f1(self):
        p = self.precision()
        r = self.recall()
        return 2 * p * r / (p + r) if (p + r) > 0 else 0
```

### Passo 4: Multi-classe com softmax

```python
class SoftmaxRegression:
    def __init__(self, n_features, n_classes, learning_rate=0.01):
        self.n_features = n_features
        self.n_classes = n_classes
        self.lr = learning_rate
        self.weights = [[0.0] * n_features for _ in range(n_classes)]
        self.biases = [0.0] * n_classes

    def softmax(self, scores):
        max_score = max(scores)
        exp_scores = [math.exp(s - max_score) for s in scores]
        total = sum(exp_scores)
        return [e / total for e in exp_scores]
```

### Passo 5: Ajuste de limiar

```python
thresholds = [0.3, 0.4, 0.5, 0.6, 0.7]
for t in thresholds:
    y_pred_t = [1 if model.predict_proba(x) >= t else 0 for x in X_test]
    m = ClassificationMetrics(y_test, y_pred_t)
    print(f"{t:>10.1f} {m.accuracy():>10.4f} {m.precision():>10.4f} {m.recall():>10.4f} {m.f1():>10.4f}")
```

## Use

Com scikit-learn:

```python
from sklearn.linear_model import LogisticRegression as SklearnLR
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
from sklearn.metrics import confusion_matrix, classification_report
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import numpy as np

np.random.seed(42)
X_0 = np.random.randn(100, 2) + [2, 2]
X_1 = np.random.randn(100, 2) + [5, 5]
X_sk = np.vstack([X_0, X_1])
y_sk = np.array([0] * 100 + [1] * 100)

X_tr, X_te, y_tr, y_te = train_test_split(X_sk, y_sk, test_size=0.2, random_state=42)

scaler = StandardScaler()
X_tr_sc = scaler.fit_transform(X_tr)
X_te_sc = scaler.transform(X_te)

lr = SklearnLR()
lr.fit(X_tr_sc, y_tr)
y_pred = lr.predict(X_te_sc)

print(f"Accuracy: {accuracy_score(y_te, y_pred):.4f}")
print(f"Precision: {precision_score(y_te, y_pred):.4f}")
print(f"Recall: {recall_score(y_te, y_pred):.4f}")
print(f"F1: {f1_score(y_te, y_pred):.4f}")
```

## Exercícios

1. Implemente regressão logística do zero para classificar o dataset Iris (3 classes). Compare com sklearn.
2. Gere um dataset onde as classes não são linearmente separáveis. Mostre que regressão logística falha e que uma fronteira polinomial (features polinomiais) resolve.
3. Implemente a perda de hinge (SVM) e compare com a perda logística no mesmo dataset.
4. Plote as curvas de precisão e recall para diferentes limiares. Em que situação você escolheria recall sobre precisão?
