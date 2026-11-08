# Teorema de Bayes

> A probabilidade é o que se espera, o teorema de Bayes é o que se aprende.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1, Lesson 06 (Probability Fundamentals)
**Time:** ~75 minutes

## Objetivos de aprendizagem

- Aplicar o teorema de Bayes para calcular probabilidades posteriores a partir de antecedentes, probabilidades e evidências
- Construir um classificador de texto Bayes ingênuo a partir do zero com Laplace suavizamento e log-space computação
- Comparar estimativas MLE e MAP e explicar como o MAP corresponde à regularização L2
- Implementar atualizações Bayesianas sequenciais usando antecedentes conjugados beta-binomial para testes A/B

## O problema

Um teste médico é 99% preciso, e se tivermos positivo, quais são as chances de termos a doença?

A maioria das pessoas diz 99%. A resposta real depende de quão rara é a doença. Se 1 em cada 10.000 pessoas a têm, um resultado positivo só dá a você cerca de 1% de chance de ficar doente. Os outros 99% de resultados positivos são falsos alarmes de pessoas saudáveis.

Esta não é uma pergunta de truque. É teorema de Bayes. Todo filtro de spam, todo diagnóstico médico, todo modelo de aprendizagem automática que quantifica a incerteza usa este raciocínio exato. Começa com uma crença. Veja evidências. Atualiza.

Se construir sistemas de inteligência artificial sem entender isso, interpretará mal as saídas do modelo, estabelecerá prazos ruins e enviará previsões exageradas.

## O conceito

### Da probabilidade conjunta para Bayes

Já sabe da lição 06 que a probabilidade condicional é:

```math
P(A \mid B) = \frac{P(A \text{ and } B)}{P(B)}
```

E simetricamente:

```math
P(B \mid A) = \frac{P(A \text{ and } B)}{P(A)}
```

Ambas as expressões compartilham o mesmo numerador: $P(A \text{ and } B)$Equalizá-los e reorganiza-os:

```math
\begin{aligned}
P(A \text{ and } B) &= P(A \mid B) \cdot P(B) = P(B \mid A) \cdot P(A) \\[4pt]
&\text{Therefore:} \\[4pt]
P(A \mid B) &= \frac{P(B \mid A) \cdot P(A)}{P(B)}
\end{aligned}
```

É o teorema de Bayes, quatro quantidades, uma equação.

### As quatro partes

| Part | Name | What it means |
|------|------|---------------|
| $P(A \mid B)$ | Posterior | Your updated belief about $A$ after seeing evidence $B$ |
| $P(B \mid A)$ | Likelihood | How probable the evidence $B$ is if $A$ is true |
| $P(A)$ | Prior | Your belief about $A$ before seeing any evidence |
| $P(B)$ | Evidence | Total probability of seeing $B$ under all possibilities |

O prazo de prova $P(B)$Pode-se expandir usando a lei da probabilidade total:

```math
P(B) = P(B \mid A) \cdot P(A) + P(B \mid \text{not } A) \cdot P(\text{not } A)
```

### Exemplo de teste médico

Uma doença afeta 1 em cada 10.000 pessoas. O teste é 99% preciso (aparece em 99% dos doentes, dá falsos resultados em 1% das vezes).

```math
\begin{aligned}
P(\text{sick}) &= 0.0001 \quad \text{(prior: disease is rare)} \\
P(\text{positive} \mid \text{sick}) &= 0.99 \quad \text{(likelihood: test catches it)} \\
P(\text{positive} \mid \text{healthy}) &= 0.01 \quad \text{(false positive rate)} \\[6pt]
P(\text{positive}) &= P(\text{positive} \mid \text{sick}) \cdot P(\text{sick}) + P(\text{positive} \mid \text{healthy}) \cdot P(\text{healthy}) \\
&= 0.99 \cdot 0.0001 + 0.01 \cdot 0.9999 \\
&= 0.000099 + 0.009999 \\
&= 0.010098 \\[6pt]
P(\text{sick} \mid \text{positive}) &= P(\text{positive} \mid \text{sick}) \cdot P(\text{sick}) / P(\text{positive}) \\
&= 0.99 \cdot 0.0001 / 0.010098 \\
&= 0.0098 \\
&= 0.98\%
\end{aligned}
```

Quando uma condição é rara, mesmo os testes precisos produzem em sua maioria falsos positivos.

### Exemplo de filtro de spam

Recebe um e-mail com a palavra "loteria". É spam?

```math
\begin{aligned}
P(\text{spam}) &= 0.3 \quad \text{(30\% of email is spam)} \\
P(\text{"lottery"} \mid \text{spam}) &= 0.05 \quad \text{(5\% of spam emails contain "lottery")} \\
P(\text{"lottery"} \mid \text{not spam}) &= 0.001 \quad \text{(0.1\% of legitimate emails contain "lottery")} \\[6pt]
P(\text{"lottery"}) &= 0.05 \cdot 0.3 + 0.001 \cdot 0.7 \\
&= 0.015 + 0.0007 \\
&= 0.0157 \\[6pt]
P(\text{spam} \mid \text{"lottery"}) &= 0.05 \cdot 0.3 / 0.0157 \\
&= 0.955 \\
&= 95.5\%
\end{aligned}
```

Uma palavra muda a probabilidade de 30% para 95,5%. Um verdadeiro filtro de spam aplica Bayes em centenas de palavras simultaneamente.

### Bayes ingênuo: suposição de independência

Naive Bayes estende isso a múltiplas características assumindo que todas as características são condicionalmente independentes dada a classe:

```math
P(\text{class} \mid \text{feature}_1, \text{feature}_2, \ldots, \text{feature}_n) = \frac{P(\text{class}) \cdot P(\text{feature}_1 \mid \text{class}) \cdot P(\text{feature}_2 \mid \text{class}) \cdots P(\text{feature}_n \mid \text{class})}{P(\text{feature}_1, \text{feature}_2, \ldots, \text{feature}_n)}
```

A parte "ingênua" é a suposição de independência. No texto, ocorrências de palavras não são independentes ("Novo" e "York" estão correlacionados). Mas a suposição funciona surpreendentemente bem na prática porque o classificador só precisa classificar classes, não produzir probabilidades calibradas.

Como o denominador é o mesmo para todas as classes, você pode ignorá-lo e apenas comparar os numeradores:

```math
\text{score}(\text{class}) = P(\text{class}) \cdot \prod_i P(\text{feature}_i \mid \text{class})
```

Escolha a classe com a maior pontuação.

### Estimação máxima de probabilidade (MLE)

Como é que consegues ?$P(\text{feature} \mid \text{class})$- Os dados do treinamento?

```math
P(\text{"free"} \mid \text{spam}) = \frac{\text{number of spam emails containing "free"}}{\text{total spam emails}}
```

Este é MLE: escolha os valores de parâmetros que tornam os dados observados mais prováveis. Você está maximizando a função de probabilidade, que para contagens discretas se reduz à frequência relativa.

O problema é que se uma palavra nunca aparece no spam durante o treinamento, a MLE dá-lhe probabilidade zero. Uma palavra invisível mata todo o produto.

```math
P(\text{word} \mid \text{class}) = \frac{\text{count}(\text{word}, \text{class}) + 1}{\text{total\_words\_in\_class} + \text{vocabulary\_size}}
```

Adicionar 1 a cada contagem garante que nenhuma probabilidade seja nunca zero.

Uma palavra que nunca apareceu em nenhuma mensagem de formação não está no vocabulário. `predict`Salta-o, porque não dá provas para nenhuma das duas classes.

### MAP (Maksimal a posteriori)

A MLE pergunta: quais os parâmetros que maximizam $P(\text{data} \mid \text{parameters})$- Não .

O MAP pergunta: quais os parâmetros maximizam $P(\text{parameters} \mid \text{data})$- Não .

Pelo teorema de Bayes:

```math
P(\text{parameters} \mid \text{data}) \propto P(\text{data} \mid \text{parameters}) \cdot P(\text{parameters})
```

MAP adiciona um prévio sobre os próprios parâmetros. Se você acredita que os parâmetros devem ser pequenos, você codifica isso como um prévio que penaliza valores grandes. Isso é idêntico à regularização de L2 no ML. A penalidade "redonda" na regressão de cresta é literalmente um prévio gaussiano nos pesos.

| Estimation | Optimizes | ML equivalent |
|------------|-----------|---------------|
| MLE | $P(\text{data} \mid \text{params})$ | Unregularized training |
| MAP | $P(\text{data} \mid \text{params}) \cdot P(\text{params})$ | L2 / L1 regularization |

### Bayesian vs frequentist: a diferença prática

Os frequentistas consideram os parâmetros como algo fixo desconhecido, perguntando: "Se eu repetisse esta experiência muitas vezes, o que aconteceria?"

Os bayesianos tratam os parâmetros como distribuições.

Para a construção de sistemas ML, a diferença prática:

| Aspect | Frequentist | Bayesian |
|--------|-------------|----------|
| Output | Point estimate | Distribution over values |
| Uncertainty | Confidence intervals (about procedure) | Credible intervals (about parameter) |
| Small data | Can overfit | Prior acts as regularization |
| Computation | Usually faster | Often requires sampling (MCMC) |

A maioria dos métodos de produção de MLM é frequentista (SGD, estimativas de pontos). Os métodos bayesianos brilham quando é necessária incerteza calibrada (decisões médicas, sistemas críticos para a segurança) ou quando os dados são escassos (aprendizagem em poucas tentativas, arranque a frio).

### Por que o pensamento bayesiano importa para a ML

A conexão é mais profunda do que a analogia:

**Priors are regularization.**Um prévio gaussiano em pesos é a regularização L2. Um prévio de Laplace é L1. Toda vez que você adiciona um termo de regularização, você está fazendo uma declaração bayesiana sobre quais valores de parâmetros você espera.

**Posteriors are uncertainty.**Uma única probabilidade prevista não diz nada sobre o quão confiante o modelo é nessa estimativa.$P(\text{spam})$é entre 0,8 e 0,95."

**Bayes updates are online learning.**O posterior de hoje torna-se o anterior de amanhã, quando o seu modelo vê novos dados, ele atualiza suas crenças gradualmente em vez de reestruturar a partir do zero.

**Model comparison is Bayesian.**O critério Bayesian de informação (BIC), a probabilidade marginal e os fatores Bayes usam o raciocínio Bayesian para escolher entre modelos sem sobreajuste.

```figure
bayes-update
```

## Construí-lo

### Passo 1: Função do teorema de Bayes

```python
def bayes(prior, likelihood, false_positive_rate):
    evidence = likelihood * prior + false_positive_rate * (1 - prior)
    posterior = likelihood * prior / evidence
    return posterior

result = bayes(prior=0.0001, likelihood=0.99, false_positive_rate=0.01)
print(f"P(sick|positive) = {result:.4f}")
```

### Passo 2: Classificador Bayes Ingênuo

```python
import math
from collections import defaultdict

class NaiveBayes:
    def __init__(self, smoothing=1.0):
        self.smoothing = smoothing
        self.class_counts = defaultdict(int)
        self.word_counts = defaultdict(lambda: defaultdict(int))
        self.class_word_totals = defaultdict(int)
        self.vocab = set()

    def train(self, documents, labels):
        for doc, label in zip(documents, labels):
            self.class_counts[label] += 1
            words = doc.lower().split()
            for word in words:
                self.word_counts[label][word] += 1
                self.class_word_totals[label] += 1
                self.vocab.add(word)

    def predict(self, document):
        words = [word for word in document.lower().split() if word in self.vocab]
        total_docs = sum(self.class_counts.values())
        vocab_size = len(self.vocab)
        best_class = None
        best_score = float("-inf")
        for cls in self.class_counts:
            score = math.log(self.class_counts[cls] / total_docs)
            for word in words:
                count = self.word_counts[cls].get(word, 0)
                total = self.class_word_totals[cls]
                score += math.log((count + self.smoothing) / (total + self.smoothing * vocab_size))
            if score > best_score:
                best_score = score
                best_class = cls
        return best_class
```

As probabilidades de registro impedem o fluxo inferior. Multiplicar muitas probabilidades pequenas produz números muito pequenos para um ponto flutuante.

### Passo 3: Treinar dados de spam

```python
train_docs = [
    "win free money now",
    "free lottery ticket winner",
    "claim your prize today free",
    "urgent offer free cash",
    "congratulations you won free",
    "meeting tomorrow at noon",
    "project update attached",
    "can we schedule a call",
    "quarterly report review",
    "lunch on thursday sounds good",
    "team standup notes attached",
    "please review the pull request",
]

train_labels = [
    "spam", "spam", "spam", "spam", "spam",
    "ham", "ham", "ham", "ham", "ham", "ham", "ham",
]

classifier = NaiveBayes()
classifier.train(train_docs, train_labels)

test_messages = [
    "free money waiting for you",
    "meeting rescheduled to friday",
    "you won a free prize",
    "please review the attached report",
]

for msg in test_messages:
    print(f"  '{msg}' -> {classifier.predict(msg)}")
```

### Passo 4: Inspeccionar as probabilidades aprendidas

```python
def show_top_words(classifier, cls, n=5):
    vocab_size = len(classifier.vocab)
    total = classifier.class_word_totals[cls]
    probs = {}
    for word in classifier.vocab:
        count = classifier.word_counts[cls].get(word, 0)
        probs[word] = (count + classifier.smoothing) / (total + classifier.smoothing * vocab_size)
    sorted_words = sorted(probs.items(), key=lambda x: x[1], reverse=True)
    for word, prob in sorted_words[:n]:
        print(f"    {word}: {prob:.4f}")

print("\nTop spam words:")
show_top_words(classifier, "spam")
print("\nTop ham words:")
show_top_words(classifier, "ham")
```

## Usá-lo

Navio-aprendizagem de esculturas, pronto para produção implementações Bayes ingênuos:

```python
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.metrics import classification_report

vectorizer = CountVectorizer()
X_train = vectorizer.fit_transform(train_docs)
clf = MultinomialNB()
clf.fit(X_train, train_labels)

X_test = vectorizer.transform(test_messages)
predictions = clf.predict(X_test)
for msg, pred in zip(test_messages, predictions):
    print(f"  '{msg}' -> {pred}")
```

O CountVectorizer lida com a tokenização e a construção de vocabulário. MultinomialNB lida com o suavização e as probabilidades de registro internamente. A sua versão do zero faz a mesma coisa em 40 linhas.

## Envia-o

A classe NaiveBayes construída aqui demonstra o conjunto completo: tokenization, estimativa de probabilidade com suavização Laplace, previsão de log-space.`code/bayes.py`executa de ponta a ponta sem dependências além da biblioteca padrão do Python.`code/bayes.ts`utiliza apenas a biblioteca padrão do Node.

### Precessos conjuntos

Quando o anterior e posterior pertencem à mesma família de distribuições, o anterior é chamado de "conjugado". Isso torna a atualização de Bayesian algébrica limpa - você obtém um posterior fechado sem integração numérica.

| Likelihood | Conjugate Prior | Posterior | Example |
|-----------|----------------|-----------|---------|
| Bernoulli | $\text{Beta}(a, b)$ | $\text{Beta}(a + \text{successes}, b + \text{failures})$ | Coin flip bias estimation |
| Normal (known variance) | $\text{Normal}(\mu_0, \sigma_0)$ | Normal(weighted mean, smaller variance) | Sensor calibration |
| Poisson | $\text{Gamma}(a, b)$ | $\text{Gamma}(a + \text{sum of counts}, b + n)$ | Modeling arrival rates |
| Multinomial | $\text{Dirichlet}(\alpha)$ | $\text{Dirichlet}(\alpha + \text{counts})$ | Topic modeling, language models |

Por que isso importa: sem antecedentes conjugados, você precisa de amostragem Monte Carlo ou inferência variável para aproximar o posterior.

A distribuição Beta é o conjugado anterior mais comum na prática. $\text{Beta}(a, b)$representa a sua crença sobre um parâmetro de probabilidade.$a/(a+b)$- O maior .$a+b$A distribuição é mais concentrada (confiante).

Casos especiais do Beta anterior:
- $\text{Beta}(1, 1)$Não tem opinião sobre o parâmetro.
- $\text{Beta}(10, 10)$= 0,5, você acredita fortemente que o parâmetro está perto de 0,5.
- $\text{Beta}(1, 10)$= distorcido para 0, você acredita que o parâmetro é pequeno.

A regra da atualização é simples:

```math
\begin{aligned}
\text{Prior:} \quad & \text{Beta}(a, b) \\
\text{Data:} \quad & s \text{ successes}, f \text{ failures} \\
\text{Posterior:} \quad & \text{Beta}(a + s, b + f)
\end{aligned}
```

Sem integrals, sem amostragem, só adição.

### Atualização Bayesiana Sequencial

A inferência Bayesiana é naturalmente sequencial. O posterior de hoje se torna o anterior de amanhã. É assim que os sistemas reais aprendem incrementalmente sem reprocessar todos os dados históricos.

Exemplo concreto: estimar se uma moeda é justa.

**Day 1: No data yet.**
Começa com $\text{Beta}(1, 1)$- Não tens opinião.
- Medida anterior: 0,5
- O Prior é plano em [0, 1]

**Day 2: Observe 7 heads, 3 tails.**
$\text{Posterior} = \text{Beta}(1 + 7, 1 + 3) = \text{Beta}(8, 4)$
- Medida posterior: $8/12 = 0.667$
- Evidências sugerem que a moeda é tendenciosa em direção às cabeças

**Day 3: Observe 5 more heads, 5 more tails.**
Use o posterior de ontem como o anterior de hoje.
$\text{Posterior} = \text{Beta}(8 + 5, 4 + 5) = \text{Beta}(13, 9)$
- Medida posterior: $13/22 = 0.591$
- Os novos dados equilibrados retiraram a estimativa para 0,5.

```mermaid
graph LR
    A["Prior<br/>Beta(1,1)<br/>mean = 0.50"] -->|"7H, 3T"| B["Posterior 1<br/>Beta(8,4)<br/>mean = 0.67"]
    B -->|"becomes prior"| C["Prior 2<br/>Beta(8,4)"]
    C -->|"5H, 5T"| D["Posterior 2<br/>Beta(13,9)<br/>mean = 0.59"]
```

A ordem das observações não importa. $\text{Beta}(1,1)$atualizado com todas as 12 cabeças e 8 caudas ao mesmo tempo dá $\text{Beta}(13, 9)$A atualização sequencial e a atualização de lote são matematicamente equivalentes, mas a atualização sequencial permite que você tome decisões em cada passo sem armazenar dados brutos.

Esta é a base da aprendizagem on-line em sistemas de produção ML. Tompons sampling para bandidos, sistemas de recomendação incremental e detectores de anomalia de streaming todos usam este padrão.

### Conexão com testes A/B

Os testes A/B são inferências Bayesianas disfarçadas.

Configuração: você está testando duas cores de botões: variante A (azul) e variante B (verde). Você quer saber qual deles recebe mais cliques.

O teste Bayesian A/B:

1. **Prior.**Começa com $\text{Beta}(1, 1)$Não há preferência prévia.
2. **Data.**A variante A: 50 cliques em cada 1000 visualizações. A variante B: 65 cliques em cada 1000 visualizações.
3. **Posteriors.**
   - A: $\text{Beta}(1 + 50, 1 + 950) = \text{Beta}(51, 951)$. média = 0,051
   - B: $\text{Beta}(1 + 65, 1 + 935) = \text{Beta}(66, 936)$. média = 0,066
4. **Decision.**Computação$P(B > A)$-- a probabilidade de que a taxa de conversão verdadeira de B é maior do que A.

Computação$P(B > A)$analíticamente é difícil, mas Monte Carlo torna trivial:

```
1. Draw 100,000 samples from Beta(51, 951)  -> samples_A
2. Draw 100,000 samples from Beta(66, 936)  -> samples_B
3. P(B > A) = fraction of samples where B > A
```

Se$P(B > A) > 0.95$Se for entre 0,05 e 0,95, continue a recolher dados.$P(B > A) < 0.05$, você nave variante A.

Vantagens em relação aos testes A/B frequentistas:
- Você recebe uma declaração de probabilidade direta: "há uma chance de 97% B é melhor"
- Não há confusão de p-valor, não há cobertura de "falha em rejeitar a hipótese nula".
- Pode verificar os resultados a qualquer momento sem aumentar as taxas falsas positivas (sem "problema de olho")
- Pode incorporar conhecimentos prévios (por exemplo, testes anteriores sugerem taxas de conversão geralmente de 3-8%)

| Aspect | Frequentist A/B | Bayesian A/B |
|--------|----------------|--------------|
| Output | p-value | $P(B > A)$ |
| Interpretation | "How surprising is this data if A=B?" | "How likely is B better than A?" |
| Early stopping | Inflates false positives | Safe at any point (given a well-chosen prior and correctly specified model) |
| Prior knowledge | Not used | Encoded as Beta prior |
| Decision rule | $p < 0.05$ | $P(B > A) > \text{threshold}$ |

## Exercícios

1. **Multiple tests.**Um paciente apresenta resultados positivos duas vezes em testes independentes (ambos 99% de precisão, prevalência de doença 1 em 10.000).$P(\text{sick})$Use o posterior do primeiro teste como o anterior para o segundo.

2. **Smoothing impact.**Execute o classificador de spam com valores de suavizamento de 0.01, 0.1, 1.0 e 10.0. Como as probabilidades de palavra superior mudam? O que acontece com suavizamento=0 e uma palavra que aparece apenas em presunto?

3. **Add features.**Extenda a classe NaiveBayes para que também use o comprimento da mensagem (curto/longo) como característica ao lado da contagem de palavras. Estimar $P(\text{short} \mid \text{spam})$E ...$P(\text{short} \mid \text{ham})$de dados de treinamento e dobrar-o na pontuação de previsão.

4. **MAP by hand.**Dados os dados observados (7 cabeças em 10 lançamentos de moeda), calcule a estimativa do MAP do viés usando um $\text{Beta}(2,2)$A Comissão deve apresentar um relatório sobre a evolução da situação dos países em desenvolvimento.$7/10$)).

### Indicios

**Exercise 1.**Liga-me .`bayes`uma vez para obter o posterior após o teste 1, então chamá-lo novamente com o posterior como o anterior. `sequential_bayes(prior, likelihood, false_positive_rate, 2)`deve dar o mesmo valor, próximo de 0,5.

**Exercise 2.**Crie um .`NaiveBayes(smoothing=s)`para cada valor, treinar-o nos mesmos dados e imprimir `top_words`Com o smoothing 0, uma palavra que nunca aparece no spam recebe probabilidade 0, então seu log não é definido.

**Exercise 3.**Conte quantas mensagens de spam e ham são curtas, divida pelo número de mensagens em cada classe e adicione o log dessa relação ao resultado em `predict`Verifique se as duas probabilidades para cada classe somam a 1.

**Exercise 4.**Com um$\text{Beta}(\alpha, \beta)$Antes de ser concluída, a estimativa do MAP é $\frac{h + \alpha - 1}{n + \alpha + \beta - 2}$- Coloque-o .$h = 7$- Não .$n = 10$O resultado deve ser entre o MLE (0,7) e o modo anterior (0,5).

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| Prior | "My initial guess" | $P(\text{hypothesis})$ before observing evidence. In ML: the regularization term. |
| Likelihood | "How well the data fits" | $P(\text{evidence} \mid \text{hypothesis})$. How probable the observed data is under a specific hypothesis. |
| Posterior | "My updated belief" | $P(\text{hypothesis} \mid \text{evidence})$. The prior multiplied by the likelihood, then normalized. |
| Evidence | "The normalizing constant" | $P(\text{data})$ across all hypotheses. Ensures the posterior sums to 1. |
| Naive Bayes | "That simple text classifier" | A classifier that assumes features are independent given the class. Works well despite the false assumption. |
| Laplace smoothing | "Add-one smoothing" | Adding a small count to every feature to prevent zero probabilities from unseen data. |
| MLE | "Just use the frequencies" | Choose parameters that maximize $P(\text{data} \mid \text{parameters})$. No prior. Can overfit with small data. |
| MAP | "MLE with a prior" | Choose parameters that maximize $P(\text{data} \mid \text{parameters}) \cdot P(\text{parameters})$. Equivalent to regularized MLE. |
| Log-probability | "Work in log space" | Using $\log(P)$ instead of $P$ to avoid floating-point underflow when multiplying many small numbers. |
| False positive | "A wrong alarm" | The test says positive, but the true state is negative. Drives the base rate fallacy. |

## Mais leitura

- [3Blue1Brown: Bayes' theorem](https://www.youtube.com/watch?v=HZGCoVF3YvM)- explicação visual com o exemplo do ensaio médico
- [Stanford CS229: Generative Learning Algorithms](https://cs229.stanford.edu/main_notes.pdf)- Bayes ingênuo e a sua ligação a modelos discriminatórios
- [Think Bayes](https://greenteapress.com/wp/think-bayes/)- Livro livre, estatísticas bayesianas com código Python
- [scikit-learn Naive Bayes](https://scikit-learn.org/stable/modules/naive_bayes.html)- implementações de produção e quando utilizar cada variante
