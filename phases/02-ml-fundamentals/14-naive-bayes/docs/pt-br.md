# Naive Bayes

> A suposição "ingênua" está errada, e mesmo assim funciona. Essa é a beleza.

**Tipo:** Construção
**Idioma:** Python
**Pré-requisitos:** Fase 2, Lições 01-07 (classificação, teorema de Bayes)
**Tempo:** ~75 minutos

## Objetivos de Aprendizado

- Implementar Multinomial Naive Bayes do zero com suavização Laplace para classificação de texto
- Explicar por que a suposição de independência é matematicamente errada mas produz rankings corretos na prática
- Comparar variantes Multinomial, Bernoulli e Gaussian e selecionar a certa para um tipo de feature
- Avaliar Naive Bayes contra regressão logística em dados esparsos de alta dimensão

## O Problema

Você precisa classificar texto. Emails em spam ou não-spam. Reviews em positivos ou negativos. A maioria dos classificadores engasga aqui. Naive Bayes lida com isso. Faz uma suposição matematicamente errada e mesmo assim supera modelos "mais espertos" em classificação de texto.

## O Conceito

### Teorema de Bayes (Revisão)

```
P(classe | features) = P(features | classe) * P(classe) / P(features)
```

### A Suposição de Independência Ingênua

```
P(w1, w2, ..., wn | classe) = P(w1 | classe) * P(w2 | classe) * ... * P(wn | classe)
```

Em vez de uma distribuição conjunta impossível, estima n distribuições simples por feature.

**Por que ainda funciona:**
1. **Ranking sobre calibração.** Classificação só precisa que o top-ranked esteja certo.
2. **Alto viés, baixa variância.** A suposição é um prior forte que previne overfitting.
3. **Redundância de features se cancela.** Features correlatas fornecem evidência redundante.

### Três Variantes

| Variante | Tipo de Feature | Melhor Para |
|----------|----------------|-------------|
| Multinomial | Contagens ou frequências | Classificação de texto, bag-of-words |
| Gaussian | Valores contínuos | Dados tabulares com features normais |
| Bernoulli | Binário (0/1) | Texto curto, vetores de features binários |

### Suavização Laplace

Adiciona contagem pequena `alpha` a cada funcionalidade para evitar probabilidades zero.

```
P(palavra_i | classe) = (contagem(palavra_i, classe) + alpha) / (total_palavras_classe + alpha * vocab_size)
```

### Espaço de Log

Trabalhe com log P ao invés de P para evitar underflow de ponto flutuante.

```
log P(classe | features) = log P(classe) + sum_i log P(feature_i | classe)
```

Isso transforma a previsão em multiplicação de matriz.

### Naive Bayes vs Regressão Logística

| Aespecificaçãoto | Naive Bayes | Regressão Logística |
|---------|------------|-------------------|
| Tipo | Generativo | Discriminativo |
| Treino | Contar frequências | Otimizar função de perda |
| Dados pequenos | Melhor (prior forte ajuda) | Pior |
| Dados grandes | Pior (suposição errada machuca) | Melhor |
| Velocidade | Uma passagem, muito rápido | Otimização iterativa |

## Construa

```python
class MultinomialNB:
    def __init__(self, alpha=1.0):
        self.alpha = alpha

    def fit(self, X, y):
        classes = np.unique(y)
        self.classes_ = classes
        self.class_log_prior_ = np.zeros(len(classes))
        self.feature_log_prob_ = np.zeros((len(classes), X.shape[1]))
        for i, c in enumerate(classes):
            X_c = X[y == c]
            self.class_log_prior_[i] = np.log(X_c.shape[0] / X.shape[0])
            counts = X_c.sum(axis=0) + self.alpha
            self.feature_log_prob_[i] = np.log(counts / counts.sum())
        return self
```

## Entregue

- `outputs/skill-naive-bayes-chooser.md`
- `code/naive_bayes.py`

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| Naive Bayes | "Classificador probabilístico simples" | Classificador com suposição de independência condicional |
| Independência condicional | "Features não afetam umas às outras" | P(A, B \| C) = P(A \| C) * P(B \| C) |
| Suavização Laplace | "Adicionar-um" | Adicionar contagem pequena para prevenir probabilidades zero |
| Prior | "O que você acreditava antes" | P(classe) antes de observar features |
| Verossimilhança | "Quão bem os dados se encaixam" | P(features \| classe) |
| Posterior | "O que você acredita depois" | P(classe \| features) |

## Leitura Adicional

- [scikit-learn Naive Bayes docs](https://scikit-learn.org/stable/modules/naive_bayes.html)
- [Ng and Jordan, On Discriminative vs. Generative Classifiers (2001)](https://ai.stanford.edu/~ang/papers/nips01-discriminativegenerative.pdf)
