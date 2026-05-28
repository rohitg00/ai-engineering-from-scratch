# Engenharia de Features e Seleção

> Uma boa feature vale mais que mil pontos de dados.

**Tipo:** Build
**Linguagens:** Python
**Pré-requisitos:** Fase 1 (Estatística para ML, Álgebra Linear), Fase 2 Aulas 1-7
**Tempo:** ~90 minutos

## Objetivos de Aprendizado

- Implementar transformações numéricas (padronização, escalonamento min-max, transformação log, binning) e explicar quando cada uma é apropriada
- Construir encoding one-hot, de label e target para features categóricas e identificar o risco de vazamento de dados no target encoding
- Construir um vetorizador TF-IDF do zero e explicar por que ele supera contagens brutas de palavras para classificação de texto
- Aplicar seleção de features baseada em filtro (limiar de variância, correlação, informação mútua) para reduzir dimensionalidade

## O Problema

Você tem um dataset. Escolhe um algoritmo. Treina. Os resultados são medianos. Tenta um algoritmo mais sofisticado. Ainda mediano. Gasta uma semana ajustando hiperparâmetros. Melhoria marginal.

Aí alguém transforma os dados brutos em melhores features e uma regressão logística simples supera seu ensemble de gradient boosting ajustado.

Isso acontece o tempo todo. Na ML clássica, a representação dos dados importa mais que a escolha do algoritmo.

## O Conceito

### Features Numéricas

**Escalonamento:** Coloque features na mesma faixa para que algoritmos baseados em distância tratem todas igualmente. Min-max mapeia para [0, 1]. Padronização (z-score) mapeia para média=0, desvio=1.

**Transformação log:** Comprime distribuições enviesadas à direita (renda, população, contagens de palavras).

**Binning:** Converte valores contínuos em categorias. Útil quando a relação entre feature e alvo é não-linear mas por degraus.

### Features Categóricas

**One-hot encoding:** Cria uma coluna binária para cada categoria.

**Label encoding:** Mapeia cada categoria para um inteiro.

**Target encoding:** Substitui cada categoria pela média da variável alvo para aquela categoria.

### Features de Texto

**Count vectorizer:** Conta quantas vezes cada palavra aparece em um documento.

**TF-IDF:** Term Frequency-Inverse Document Frequency. Pesa palavras pelo quão únicas são entre documentos.

```
TF(palavra, doc) = contagem(palavra no doc) / total de palavras no doc
IDF(palavra) = log(total docs / docs contendo a palavra)
TF-IDF = TF * IDF
```

### Valores Ausentes

- **Deletar linhas:** Só quando dados faltantes são raros e aleatórios
- **Imputação por média/mediana:** Simples, preserva forma da distribuição
- **Coluna indicadora:** Adicione uma coluna binária "estava_faltando" antes de imputar

### Seleção de Features

Mais features nem sempre é melhor. Features irrelevantes adicionam ruído, aumentam tempo de treino e podem causar overajuste.

**Métodos filtro (pré-modelo):**
- Correlação: remover features altamente correlacionadas
- Informação mútua: mede o quanto saber uma feature reduz incerteza sobre o alvo
- Limiar de variância: remover features que quase não variam

## Construa

### Passo 1: Transformações numéricas do zero

```python
import math

def min_max_scale(values):
    min_val = min(values)
    max_val = max(values)
    if max_val == min_val:
        return [0.0] * len(values)
    return [(v - min_val) / (max_val - min_val) for v in values]

def standardize(values):
    n = len(values)
    mean = sum(values) / n
    variance = sum((v - mean) ** 2 for v in values) / n
    std = math.sqrt(variance) if variance > 0 else 1.0
    return [(v - mean) / std for v in values]

def log_transform(values):
    return [math.log(v + 1) for v in values]

def bin_values(values, n_bins=5):
    min_val = min(values)
    max_val = max(values)
    bin_width = (max_val - min_val) / n_bins
    if bin_width == 0:
        return [0] * len(values)
    result = []
    for v in values:
        bin_idx = int((v - min_val) / bin_width)
        bin_idx = min(bin_idx, n_bins - 1)
        result.append(bin_idx)
    return result
```

### Passo 2: Encoding categórico do zero

```python
def one_hot_encode(values):
    categories = sorted(set(values))
    cat_to_idx = {cat: i for i, cat in enumerate(categories)}
    n_cats = len(categories)

    encoded = []
    for v in values:
        row = [0] * n_cats
        row[cat_to_idx[v]] = 1
        encoded.append(row)

    return encoded, categories

def label_encode(values):
    categories = sorted(set(values))
    cat_to_int = {cat: i for i, cat in enumerate(categories)}
    return [cat_to_int[v] for v in values], cat_to_int
```

### Passo 3: Features de texto do zero

```python
def count_vectorize(documents):
    vocab = {}
    idx = 0
    for doc in documents:
        for word in doc.lower().split():
            if word not in vocab:
                vocab[word] = idx
                idx += 1

    vectors = []
    for doc in documents:
        vec = [0] * len(vocab)
        for word in doc.lower().split():
            vec[vocab[word]] += 1
        vectors.append(vec)

    return vectors, vocab

def tfidf(documents):
    n_docs = len(documents)

    vocab = {}
    idx = 0
    for doc in documents:
        for word in doc.lower().split():
            if word not in vocab:
                vocab[word] = idx
                idx += 1

    doc_freq = {}
    for doc in documents:
        seen = set()
        for word in doc.lower().split():
            if word not in seen:
                doc_freq[word] = doc_freq.get(word, 0) + 1
                seen.add(word)

    vectors = []
    for doc in documents:
        words = doc.lower().split()
        word_count = len(words)
        tf_map = {}
        for word in words:
            tf_map[word] = tf_map.get(word, 0) + 1

        vec = [0.0] * len(vocab)
        for word, count in tf_map.items():
            tf = count / word_count
            idf = math.log(n_docs / doc_freq[word])
            vec[vocab[word]] = tf * idf
        vectors.append(vec)

    return vectors, vocab
```

### Passo 4: Imputação de valores ausentes do zero

```python
def impute_mean(values):
    present = [v for v in values if v is not None]
    if not present:
        return [0.0] * len(values), 0.0
    mean = sum(present) / len(present)
    return [v if v is not None else mean for v in values], mean

def impute_median(values):
    present = sorted(v for v in values if v is not None)
    if not present:
        return [0.0] * len(values), 0.0
    n = len(present)
    if n % 2 == 0:
        median = (present[n // 2 - 1] + present[n // 2]) / 2
    else:
        median = present[n // 2]
    return [v if v is not None else median for v in values], median
```

### Passo 5: Seleção de features do zero

```python
def correlation(x, y):
    n = len(x)
    mean_x = sum(x) / n
    mean_y = sum(y) / n
    cov = sum((xi - mean_x) * (yi - mean_y) for xi, yi in zip(x, y)) / n
    std_x = math.sqrt(sum((xi - mean_x) ** 2 for xi in x) / n)
    std_y = math.sqrt(sum((yi - mean_y) ** 2 for yi in y) / n)
    if std_x == 0 or std_y == 0:
        return 0.0
    return cov / (std_x * std_y)

def variance_threshold(features, threshold=0.01):
    n_features = len(features[0])
    n_samples = len(features)
    selected = []

    for j in range(n_features):
        col = [features[i][j] for i in range(n_samples)]
        mean = sum(col) / n_samples
        var = sum((v - mean) ** 2 for v in col) / n_samples
        if var >= threshold:
            selected.append(j)

    return selected
```

## Use

Com scikit-learn, seleção de features está integrada ao pipeline:

```python
from sklearn.feature_selection import VarianceThreshold, mutual_info_classif, RFE
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier

vt = VarianceThreshold(threshold=0.01)
X_filtered = vt.fit_transform(X)

mi_scores = mutual_info_classif(X, y)
top_k = np.argsort(mi_scores)[-10:]

rf = RandomForestClassifier(n_estimators=100)
rf.fit(X, y)
importances = rf.feature_importances_
```

## Exercícios

1. Implemente seleção frente (forward selection): comece com zero features. A cada passo, adicione a feature que mais melhora a performance. Pare quando adicionar features não ajudar mais.
2. Implemente seleção por estabilidade: rode seleção L1 50 vezes, cada vez em um subconjunto aleatório de 80% dos dados.
3. Detecte multicolinearidade: calcule a matriz de correlação para todas as features e implemente uma função que remove uma feature de cada par altamente correlacionado.
4. Encadeie limiar de variância, filtro por informação mútua e RFE em um pipeline único.
5. Implemente importância por permutação do zero. Para cada feature, embaralhe seus valores 10 vezes e meça a queda média no F1 score.
