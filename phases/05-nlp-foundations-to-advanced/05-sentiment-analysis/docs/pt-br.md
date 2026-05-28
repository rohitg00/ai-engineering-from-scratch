# Análise de Sentimento

> A tarefa canônica de NLP. A maior parte do que você precisa saber sobre classificação de texto clássica aparece aqui.

**Tipo:** Construção
**Linguagens:** Python
**Pré-requisitos:** Fase 5 · 02 (BoW + TF-IDF), Fase 2 · 14 (Naive Bayes)
**Tempo:** ~75 minutos

## O Problema

"The food was not great." Positivo ou negativo?

Sentimento parece simples. Um resenhista disse que gostou ou não de algo. Rotule a frase. A razão de ter se tornado a tarefa canônica de NLP é que todo caso aparentemente fácil esconde um difícil. Negação inverte significado. Ironia inverte. "Not bad at all" é positivo apesar de duas palavras com código negativo. Emojis carregam mais sinal que o texto ao redor. Vocabulário de domínio importa (`tight` em resenha musical vs. `tight` em resenha de moda).

Sentimento é um laboratório funcionando pra NLP clássico. Se você entende por que cada baseline ingênuo tem um modo de falha eespecificaçãoífico, entende por que cada modelo mais rico foi inventado. Essa lição constrói um baseline Naive Bayes do zero, adiciona regressão logística, e nomeia as armadilhas que fazem sentimento de produção ser um problema de nível de conformidade.

## O Conceito

Sentimento clássico é uma receita de dois passos.

1. **Representar.** Transformar o texto em um vetor de features. BoW, TF-IDF ou n-gramas.
2. **Classificar.** Ajustar um modelo linear (Naive Bayes, regressão logística, SVM) em exemplos rotulados.

Naive Bayes é o modelo mais burro que funciona. Assume que toda funcionalidade é independente dado o label. Estima `P(palavra | positivo)` e `P(palavra | negativo)` a partir de contagens. Em inferência, multiplica as probabilidades. A suposição "ingênua" de independência é risivelmente errada e ainda assim os resultados são surpreendentemente fortes. A razão: com features de texto esparsas e dados moderados, o classificador se importa mais com pra que lado cada pende do que com quanto.

Regressão logística corrige a suposição de independência. Aprende um peso por feature, incluindo pesos negativos. `not good` como funcionalidade de bigrama ganha um peso negativo. Naive Bayes não consegue fazer isso pra bigramas que nunca rotulou.

## Construindo

### Passo 1: um mini-dataset real

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

Pequeno de propósito. Trabalho real usa dezenas de milhares de exemplos (IMDb, SST-2, polaridade Yelp). A matemática é idêntica.

### Passo 2: Naive Bayes multinomial do zero

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

Suavização aditiva (alpha=1.0) é suavização Laplaciana. Sem ela, uma palavra não vista numa classe tem probabilidade zero e o log explode. `alpha=0.01` é comum na prática. `alpha=1.0` é o padrão didático.

### Passo 3: regressão logística do zero

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

Regularização L2 importa aqui. Features de texto são esparsas; sem L2 o modelo memoriza exemplos de treino. Comece em `0.01` e ajuste.

### Passo 4: lidar com negação (o modo de falha)

Considere "not good" e "not bad". Um classificador BoW vê `{not, good}` e `{not, bad}` e aprende de qual apareceu mais no treino. Um classificador de bigrama vê `not_good` e `not_bad` e aprende como features distintas. Isso geralmente basta.

Uma correção mais bruta que funciona quando você não tem bigramas: **escopo de negação**. Prefixa tokens que seguem uma palavra de negação com `NOT_` até a próxima pontuação.

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

Agora `good` e `NOT_good` são features diferentes. O classificador pode ponderar opostas. Três linhas de pré-processamento, salto mensurável de precisão em benchmarks de sentimento.

### Passo 5: métricas de avaliação que importam

Acurácia sozinha é enganosa se classes são desbalanceadas. Corpora de sentimento reais são geralmente 70-80% positivos ou 70-80% negativos; um classificador constante-majoritário ganha 80% de acurácia e não serve pra nada. Reporte cada uma das seguintes:

- **Precisão e recall por classe.** Um par por classe. Média macro pra obter um número que respeita balanceamento de classes.
- **Macro-F1 (métrica principal pra dados desbalanceados).** Média dos F1 scores por classe, com peso igual. Use isso em vez de acurácia quando classes são desbalanceadas.
- **Weighted-F1 (alternativa).** Igual ao macro mas ponderado pela frequência da classe. Reporte junto com macro-F1 quando o desbalanceamento em si tem significado de negócio.
- **Matriz de confusão.** Contagens brutas. Sempre inespecificaçãoione antes de confiar em qualquer métrica escalar; revela qual par de classes o modelo confunde.
- **Amostras de erro por classe.** Puxe 5 previsões erradas por classe. Leia. Nada substitui ler os erros reais.

Pra dados severamente desbalanceados (razão > 95-5), reporte **AUROC** e **AUPRC** em vez de acurácia. AUPRC é mais sensível à classe minoritária, que é o que você geralmente se importa (spam, fraude, sentimento raro).

**Bug comum pra evitar.** Reportar micro-F1 em vez de macro-F1 em dados desbalanceados dá um número que parece alto porque é dominado pela classe majoritária. Macro-F1 força você a ver a performance da classe minoritária.

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

## Usando

scikit-learn faz em seis linhas, corretamente.

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

Três coisas pra notar. `stop_words=None` mantém negações. `ngram_range=(1, 2)` adiciona bigramas pra que `not_good` vire feature. `sublinear_tf=True` amortigua palavras repetidas. Essas três flags são a diferença entre um baseline com 75% de acurácia e um com 85% no SST-2.

### Quando buscar um transformer

- Detecção de ironia. Modelos clássicos falham aqui. Ponto.
- Resenhas longas onde o sentimento muda no meio do documento.
- Sentimento baseado em aespecificaçãoto. "Camera was great but battery was terrible." Você precisa atribuir sentimento a aespecificaçãotos. Só transformers ou modelos de saída estruturada.
- Idiomas não-inglês, de baixo recurso. BERT multilíngue dá um baseline zero-shot de graça.

Se você precisa de qualquer um desses, pule pra fase 7 (aprofundamento em transformers). Caso contrário, Naive Bayes ou regressão logística em TF-IDF com bigramas e tratamento de negação é seu baseline de produção em 2026.

### A armadilha de reprodutibilidade (de novo)

Retreinar modelos de sentimento é rotina. Reavaliar não. Números de acurácia em papers usam splits eespecificaçãoíficos, pré-processamento eespecificaçãoífico, tokenizers eespecificaçãoíficos. Se você compara seu modelo novo com um baseline sem usar a pipeline idêntica, vai ter deltas enganosos. Sempre regenere o baseline na sua pipeline, não no número do paper.

## Entregando

Salve como `outputs/prompt-sentiment-baseline.md`:

```markdown
---
name: sentiment-baseline
description: Design a sentiment analysis baseline for a new dataset.
phase: 5
lesson: 05
---

Given a dataset description (domain, language, size, label granularity, latency budget), you output:

1. Feature extraction recipe. Specify tokenizer, n-gram range, stopword policy (usually keep), negation handling (scoped prefix or bigrams).
2. Classifier. Naive Bayes for baseline, logistic regression for production, transformer only if the domain needs sarcasm / aespecificaçãots / cross-lingual.
3. Evaluation plan. Report precision, recall, F1, confusion matrix, and per-class error samples (not just scalars).
4. One failure mode to monitor post-deployment. Domain deriva and sarcasm are the top two.

Refuse to recommend dropping stopwords for sentiment tasks. Refuse to report accuracy as the sole metric when classes are imbalanced (e.g., 90% positive). Flag subword-rich languages as needing FastText or transformer embeddings over word-level TF-IDF.
```

## Exercícios

1. **Fácil.** Adicione `apply_negation` como passo de pré-processamento na pipeline do scikit-learn e meça o delta de F1 num pequeno dataset de sentimento.
2. **Médio.** Implemente regressão logística com peso de classe (passe `class_weight="balanced"` pro scikit-learn, ou derive a gradiente você mesmo). Meça o efeito num desbalanceamento sintético de 90-10.
3. **Difícil.** Construa um detector de ironia treinando um segundo classificador nos resíduos do modelo de sentimento. Documente seu setup experimental. Avisе o leitor quando sua acurácia ficar abaixo de chance (nível de chance em ironia binária é ~50%, e a maioria das primeiras tentativas cai lá).

## Termos Chave

| Termo | O que a gente diz | O que realmente significa |
|------|-----------------|-----------------------|
| Polaridade | Positivo ou negativo | Label binária; às vezes estendida pra neutro ou granular (5 estrelas). |
| Sentimento baseado em aespecificaçãoto | Polaridade por aespecificaçãoto | Atribui sentimento a entidades ou atributos eespecificaçãoíficos mencionados no texto. |
| Escopo de negação | Invertendo tokens próximos | Prefixa tokens após "not" com `NOT_` até pontuação. |
| Suavização Laplaciana | Adicionando 1 às contagens | Previne features de probabilidade zero no Naive Bayes. |
| Regularização L2 | Encolhendo pesos | Adiciona `lambda * sum(w^2)` ao loss. Essencial pra features de texto esparsas. |

## Leitura Complementar

- [Pang and Lee (2008). Opinion Mining and Sentiment Analysis](https://www.cs.cornell.edu/home/llee/opinion-mining-sentiment-analysis-survey.html) — o levantamento fundamental. Longo, mas as quatro primeiras seções cobrem tudo clássico.
- [Wang and Manning (2012). Baselines and Bigrams: Simple, Good Sentiment and Topic Classification](https://aclanthology.org/P12-2018/) — o paper que mostrou que bigramas + Naive Bayes é difícil de superar em texto curto.
- [scikit-learn text funcionalidade extraction docs](https://scikit-learn.org/stable/modules/feature_extraction.html#text-feature-extraction) — referência pra `CountVectorizer`, `TfidfVectorizer`, e cada parâmetro que você vai ajustar.
