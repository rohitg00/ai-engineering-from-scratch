# Análise dos sentimentos

> A tarefa canônica de PNL. A maior parte do que você precisa saber sobre classificação de textos clássicos aparece aqui.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 2 · 14 (Naive Bayes)
**Time:** ~75 minutes

## O problema

"A comida não foi boa". Positiva ou negativa?

O sentimento soa simples. Um crítico disse que gostava ou não de algo. Etiquete a frase. A razão pela qual se tornou a tarefa canônica da PNL é que cada caso fácil de olhar esconde um difícil. A negação inverte o significado. O sarcasmo inverte-o. "Não é ruim em tudo" é positivo apesar de duas palavras codificadas negativamente. Emojis carregam mais sinal do que o texto circundante.`tight`em revisão musical versus `tight`em revisão da moda).

Sentimento é um laboratório de trabalho para a PNL clássica. Se você entender por que cada linha de base ingênua tem um modo de falha específico, você entenderá por que cada modelo mais rico foi inventado. Esta lição constrói uma linha de base Bayes ingênua a partir do zero, adiciona regressão logística e nomeia as armadilhas que tornam o sentimento de produção um problema de nível de conformidade.

## O conceito

O sentimento clássico é uma receita de dois passos.

1. **Represent.**Transforme o texto em um vetor de caracteres.
2. **Classify.**Aplique um modelo linear (Naive Bayes, regressão logística, SVM) em exemplos rotulados.

Naívo Bayes é o modelo mais estúpido que funciona, supõe que cada característica é independente dada a etiqueta.`P(word | positive)`E ...`P(word | negative)`A hipótese de independência "ingênua" é ridiculamente errada e os resultados são chocantes. A razão: com recursos de texto escassos e dados moderados, o classificador se importa com que lado cada palavra inclina mais do que quanto.

A regressão logística fixa a suposição de independência.`not good`O Bayes ingênuo não pode fazer isso para bigrams que nunca foi etiquetado.

```figure
sentiment-logits
```

## Construí-lo

### Passo 1: um mini-conjunto de dados real

```python
POSITIVE = [
    "absolutely loved this movie",
    "beautiful cinematography and a great story",
    "one of the best films of the year",
    "brilliant acting from the lead",
    "heartwarming and funny",
]

NEGATIVE = [
    "boring and far too long",
    "not worth your time",
    "the plot made no sense",
    "terrible acting, awful script",
    "i want my two hours back",
]
```

O trabalho real usa dezenas de milhares de exemplos (IMDb, SST-2, polaridade Yelp).

### Passo 2: Naívo Bayes multinomial do zero

```python
import math
from collections import Counter


def train_nb(docs_by_class, vocab, alpha=1.0):
    class_priors = {}
    class_word_probs = {}
    total_docs = sum(len(d) for d in docs_by_class.values())

    for cls, docs in docs_by_class.items():
        class_priors[cls] = len(docs) / total_docs
        counts = Counter()
        for doc in docs:
            for token in doc:
                counts[token] += 1
        total = sum(counts.values()) + alpha * len(vocab)
        class_word_probs[cls] = {
            w: (counts[w] + alpha) / total for w in vocab
        }
    return class_priors, class_word_probs


def predict_nb(doc, class_priors, class_word_probs):
    scores = {}
    for cls in class_priors:
        s = math.log(class_priors[cls])
        for token in doc:
            if token in class_word_probs[cls]:
                s += math.log(class_word_probs[cls][token])
        scores[cls] = s
    return max(scores, key=scores.get)
```

O suavização aditiva (alfa=1.0) é o suavização de Laplace. Sem ele, uma palavra invisível em uma classe tem probabilidade zero e o log explode. `alpha=0.01`É comum na prática. `alpha=1.0`é o padrão de ensino.

### Passo 3: Regressão logística a partir do zero

```python
import numpy as np


def sigmoid(x):
    return 1.0 / (1.0 + np.exp(-np.clip(x, -20, 20)))


def train_lr(X, y, epochs=500, lr=0.05, l2=0.01):
    n_features = X.shape[1]
    w = np.zeros(n_features)
    b = 0.0
    for _ in range(epochs):
        logits = X @ w + b
        preds = sigmoid(logits)
        err = preds - y
        grad_w = X.T @ err / len(y) + l2 * w
        grad_b = err.mean()
        w -= lr * grad_w
        b -= lr * grad_b
    return w, b


def predict_lr(X, w, b):
    return (sigmoid(X @ w + b) >= 0.5).astype(int)
```

A regularização L2 é importante aqui. As características do texto são escassas; sem L2 o modelo memoriza exemplos de treinamento.`0.01`e sintonizar.

### Passo 4: negação de manuseio (modo de falha)

Considere "não bom" e "não ruim".`{not, good}`E ...`{not, bad}`E aprende com quem mais apareceu no treinamento.`not_good`E ...`not_bad`E, por vezes, é suficiente.

Uma solução mais crudíssima que funciona quando não há bigramas:**negation scoping**. Prefixo de tokens após uma palavra de negação com `NOT_`Até à próxima pontuação.

```python
NEGATION_WORDS = {"not", "no", "never", "nor", "none", "nothing", "neither"}
NEGATION_TERMINATORS = {".", "!", "?", ",", ";"}


def apply_negation(tokens):
    out = []
    negate = False
    for token in tokens:
        if token in NEGATION_TERMINATORS:
            negate = False
            out.append(token)
            continue
        if token in NEGATION_WORDS:
            negate = True
            out.append(token)
            continue
        out.append(f"NOT_{token}" if negate else token)
    return out
```

```python
>>> apply_negation(["not", "good", "at", "all", ".", "but", "funny"])
['not', 'NOT_good', 'NOT_at', 'NOT_all', '.', 'but', 'funny']
```

Agora .`good`E ...`NOT_good`O classificador pode pesá-los em oposição. três linhas de pré-processamento, precisão mensurável saltar em referência de sentimento.

### Passo 5: métricas de avaliação que importam

A precisão por si só é enganosa se as classes são desequilibradas. Os corpos de sentimento reais são geralmente de 70-80% positivo ou 70-80% negativo; um classificador de maioria constante obtém 80% de precisão e é inútil.

- **Per-class precision and recall.**Um par por classe, uma média macro para obter um único número que respeite o equilíbrio de classe.
- **Macro-F1 (primary metric for imbalanced data).**Mediano de pontuações por classe, igual a peso.
- **Weighted-F1 (alternative).**O mesmo que o macro, mas ponderado pela frequência da classe.
- **Confusion matrix.**Contas crudas. Inspecte sempre antes de confiar em qualquer métrica escalar; revela quais pares de classes o modelo confunde.
- **Per-class error samples.**Leia cinco previsões erradas por aula, nada substitui a leitura dos erros reais.

Para dados gravemente desequilibrados (> 95-5 ratio), relatório **AUROC**E ...**AUPRC**O AUPRC é mais sensível à classe minoritária, que é o que normalmente se preocupa (spam, fraude, sentimento raro).

**Common bug to avoid.**Relatório de micro-F1 em vez de macro-F1 em dados desequilibrados dá um número que parece alto porque é dominado pela classe majoritária.

```python
def evaluate(y_true, y_pred):
    tp = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 1)
    fp = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 1)
    fn = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 0)
    tn = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 0)
    precision = tp / (tp + fp) if tp + fp else 0
    recall = tp / (tp + fn) if tp + fn else 0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0
    return {"tp": tp, "fp": fp, "tn": tn, "fn": fn, "precision": precision, "recall": recall, "f1": f1}
```

## Usá-lo

O Scikit-Learn faz isto em seis linhas, corretamente.

```python
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

pipe = Pipeline([
    ("tfidf", TfidfVectorizer(ngram_range=(1, 2), min_df=2, sublinear_tf=True, stop_words=None)),
    ("clf", LogisticRegression(C=1.0, max_iter=1000)),
])
pipe.fit(X_train, y_train)
print(pipe.score(X_test, y_test))
```

Três coisas a notar.`stop_words=None`mantém as negações. `ngram_range=(1, 2)`Adiciona bigrams assim `not good`torna-se um recurso (scikit-learn une as duas palavras com um espaço). `sublinear_tf=True`Estes três sinais representam a diferença entre uma linha de base com 75% de precisão e uma linha de base com 85% de precisão na SST-2.

### Quando procurar um transformador

- Detecção de sarcasmo, os modelos clássicos falham aqui.
- Longas revisões onde o sentimento muda no meio do documento.
- Sentimento baseado em aspectos. "A câmera era ótima, mas a bateria era terrível".
- Línguas não inglesas, de baixo recurso. O BERT multilingue dá-lhe uma linha de base de zero-shot gratuitamente.

Se você precisar de qualquer um dos acima, vá para a fase 7 (mergulho profundo dos transformadores). caso contrário, o Naive Bayes ou regressão logística no TF-IDF mais bigrams mais manipulação de negação é a sua linha de base de produção de 2026.

### A armadilha da reproducibilidade (novamente)

Re-treinar modelos de sentimento é rotina. Re-avaliação não é. Números de precisão relatados em papéis usam divisões específicas, pré-processamento específico, tokenizers específicos. Se você comparar seu novo modelo com uma linha de base sem usar o mesmo pipeline, você obterá deltas enganosas. Sempre regenerar a linha de base em seu pipeline, não o número do papel.

## Envia-o

Salva como`outputs/prompt-sentiment-baseline.md`- Não .

```markdown
---
name: sentiment-baseline
description: Design a sentiment analysis baseline for a new dataset.
phase: 5
lesson: 05
---

Given a dataset description (domain, language, size, label granularity, latency budget), you output:

1. Feature extraction recipe. Specify tokenizer, n-gram range, stopword policy (usually keep), negation handling (scoped prefix or bigrams).
2. Classifier. Naive Bayes for baseline, logistic regression for production, transformer only if the domain needs sarcasm / aspects / cross-lingual.
3. Evaluation plan. Report precision, recall, F1, confusion matrix, and per-class error samples (not just scalars).
4. One failure mode to monitor post-deployment. Domain drift and sarcasm are the top two.

Refuse to recommend dropping stopwords for sentiment tasks. Refuse to report accuracy as the sole metric when classes are imbalanced (e.g., 90% positive). Flag subword-rich languages as needing FastText or transformer embeddings over word-level TF-IDF.
```

## Exercícios

1. **Easy.**Adicionar`apply_negation`como um passo de pré-processamento no pipeline de aprendizagem de scikit e medir o delta da F1 em um pequeno conjunto de dados de sentimento.
2. **Medium.**Implementar regressão logística ponderada por classe (passar `class_weight="balanced"`Mas, como é possível, a diferença entre os níveis de gravidade e os níveis de gravidade é que os níveis de gravidade são mais elevados.
3. **Hard.**Construir um detector de sarcasmo treinando um segundo classificador sobre os resíduos do modelo de sentimento. Documentar a sua configuração experimental. Avise o leitor quando a sua precisão é abaixo do acaso (nível de chance em sarcasmo de 2 classes é de ~ 50% e a maioria das primeiras tentativas aterrissam lá).

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Polarity | Positive or negative | Binary label; sometimes extended to neutral or fine-grained (5-star). |
| Aspect-based sentiment | Per-aspect polarity | Attribute sentiment to specific entities or attributes mentioned in text. |
| Negation scoping | Reversing nearby tokens | Prefix tokens after "not" with `NOT_` until punctuation. |
| Laplace smoothing | Adding 1 to counts | Prevents zero-probability features in Naive Bayes. |
| L2 regularization | Shrinking weights | Adds `lambda * sum(w^2)` to loss. Essential for sparse text features. |

## Mais leitura

- [Pang and Lee (2008). Opinion Mining and Sentiment Analysis](https://www.cs.cornell.edu/home/llee/opinion-mining-sentiment-analysis-survey.html)- a pesquisa fundamental. - Longa, mas as primeiras quatro secções abrangem tudo o clássico.
- [Wang and Manning (2012). Baselines and Bigrams: Simple, Good Sentiment and Topic Classification](https://aclanthology.org/P12-2018/)O jornal que mostrou Bigrams + Naive Bayes é difícil de vencer em texto curto.
- [scikit-learn text feature extraction docs](https://scikit-learn.org/stable/modules/feature_extraction.html#text-feature-extraction) referência para `CountVectorizer`- Não .`TfidfVectorizer`, e cada botão que sintonizar.
