# Le théorème de Bayes

> La probabilité est ce que vous attendez, le théorème de Bayes est ce que vous apprenez.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1, Lesson 06 (Probability Fundamentals)
**Time:** ~75 minutes

## Objectifs d'apprentissage

- Appliquer le théorème de Bayes pour calculer les probabilités ultérieures à partir de prédécesseurs, de probabilités et de preuves
- Construisez un classificateur de texte naïf Bayes à partir de zéro avec Laplace lissage et le calcul de l'espace log
- Comparer l'estimation de MLE et de MAP et expliquer comment le MAP correspond à la régularisation de L2
- Implementer une mise à jour séquentielle bayésienne à l'aide de préjôts conjugués bêta-binomial pour les tests A/B

## Le problème

Un test médical est à 99% exact, vous êtes positif, quelle est la probabilité que vous ayez la maladie ?

La plupart des gens disent 99%. La vraie réponse dépend de la rareté de la maladie. Si 1 personne sur 10 000 en souffre, un résultat positif ne donne qu'environ 1% de chances de tomber malade. Les autres 99% des résultats positifs sont de fausses alarmes de personnes en bonne santé.

Ce n'est pas une question de ruse. C'est le théorème de Bayes. Chaque filtre de spam, chaque diagnostic médical, chaque modèle d'apprentissage automatique qui quantifie l'incertitude utilise ce raisonnement exact. Vous commencez par une croyance. Vous voyez des preuves. Vous mettez à jour.

Si vous construisez des systèmes de machine à écrire sans comprendre cela, vous interpréterez mal les résultats des modèles, fixerez de mauvais seuils et vous enverrez des prédictions trop confiantes.

## Le concept

### De la probabilité commune à Bayes

Vous savez déjà de la leçon 06 que la probabilité conditionnelle est:

```math
P(A \mid B) = \frac{P(A \text{ and } B)}{P(B)}
```

Et symétriquement:

```math
P(B \mid A) = \frac{P(A \text{ and } B)}{P(A)}
```

Les deux expressions ont le même numérateur: $P(A \text{ and } B)$- Réglez-les et réorganisez-les:

```math
\begin{aligned}
P(A \text{ and } B) &= P(A \mid B) \cdot P(B) = P(B \mid A) \cdot P(A) \\[4pt]
&\text{Therefore:} \\[4pt]
P(A \mid B) &= \frac{P(B \mid A) \cdot P(A)}{P(B)}
\end{aligned}
```

C'est le théorème de Bayes, quatre quantités, une équation.

### Les quatre parties

| Part | Name | What it means |
|------|------|---------------|
| $P(A \mid B)$ | Posterior | Your updated belief about $A$ after seeing evidence $B$ |
| $P(B \mid A)$ | Likelihood | How probable the evidence $B$ is if $A$ is true |
| $P(A)$ | Prior | Your belief about $A$ before seeing any evidence |
| $P(B)$ | Evidence | Total probability of seeing $B$ under all possibilities |

Le terme de la preuve $P(B)$Vous pouvez l'étendre en utilisant la loi de la probabilité totale:

```math
P(B) = P(B \mid A) \cdot P(A) + P(B \mid \text{not } A) \cdot P(\text{not } A)
```

### Exemple de test médical

Une maladie touche 1 personne sur 10 000. Le test est 99% précis (capture 99% des malades, donne de faux résultats 1% du temps).

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

Les tests préliminaires dominent, et même les tests précis donnent des résultats fausses.

### Exemple de filtre à spam

Vous recevez un e-mail contenant le mot "loterie". Est-ce du spam?

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

Un mot change la probabilité de 30% à 95,5%. Un vrai filtre de spam applique Bayes sur des centaines de mots simultanément.

### Bayes naïf: supposition d'indépendance

Naïve Bayes étend cela à plusieurs caractéristiques en supposant que toutes les caractéristiques sont conditionnellement indépendantes étant donné la classe:

```math
P(\text{class} \mid \text{feature}_1, \text{feature}_2, \ldots, \text{feature}_n) = \frac{P(\text{class}) \cdot P(\text{feature}_1 \mid \text{class}) \cdot P(\text{feature}_2 \mid \text{class}) \cdots P(\text{feature}_n \mid \text{class})}{P(\text{feature}_1, \text{feature}_2, \ldots, \text{feature}_n)}
```

La partie "naïve" est l'hypothèse d'indépendance. Dans le texte, les occurrences de mots ne sont pas indépendantes ("New" et "York" sont corrélés). Mais l'hypothèse fonctionne étonnamment bien dans la pratique parce que le classifiant ne doit que classer les classes, pas produire des probabilités calibrées.

Comme le dénominateur est le même pour toutes les classes, vous pouvez le sauter et simplement comparer les numérateurs:

```math
\text{score}(\text{class}) = P(\text{class}) \cdot \prod_i P(\text{feature}_i \mid \text{class})
```

Choisissez la classe avec le score le plus élevé.

### Évaluation maximale de probabilité (MLE)

Comment ça se passe ?$P(\text{feature} \mid \text{class})$- Des données de formation ?

```math
P(\text{"free"} \mid \text{spam}) = \frac{\text{number of spam emails containing "free"}}{\text{total spam emails}}
```

C'est MLE: choisissez les valeurs de paramètre qui rendent les données observées les plus probables. Vous maximiserez la fonction de probabilité, qui pour les comptes discrets se réduit à la fréquence relative.

Problème: si un mot n'apparaît jamais dans le spam pendant la formation, MLE lui donne une probabilité zéro. Un mot invisible tue l'ensemble du produit.

```math
P(\text{word} \mid \text{class}) = \frac{\text{count}(\text{word}, \text{class}) + 1}{\text{total\_words\_in\_class} + \text{vocabulary\_size}}
```

Ajouter 1 à chaque compte assure qu'aucune probabilité n'est jamais nulle.

Un mot qui n'a jamais été utilisé dans un message d'entraînement n'est pas dans le vocabulaire. `predict`Il ne le fait pas, car il ne donne aucune preuve pour les deux classes.

### Le maximum a posteriori (MAP)

MLE demande: quels paramètres maximiser $P(\text{data} \mid \text{parameters})$- Je suis désolé .

Le MAP demande: quels paramètres maximiser $P(\text{parameters} \mid \text{data})$- Je suis désolé .

Selon le théorème de Bayes:

```math
P(\text{parameters} \mid \text{data}) \propto P(\text{data} \mid \text{parameters}) \cdot P(\text{parameters})
```

Le MAP ajoute un prior sur les paramètres eux-mêmes. Si vous pensez que les paramètres devraient être petits, vous le codez comme un prior qui pénalise les grandes valeurs.

| Estimation | Optimizes | ML equivalent |
|------------|-----------|---------------|
| MLE | $P(\text{data} \mid \text{params})$ | Unregularized training |
| MAP | $P(\text{data} \mid \text{params}) \cdot P(\text{params})$ | L2 / L1 regularization |

### Bayésien et fréquentiste: la différence pratique

Les fréquentistes considèrent les paramètres comme des inconnus fixes. " Si je répetais cette expérience plusieurs fois, demandent- ils, que se passerait- il? "

Les Bayésiens considèrent les paramètres comme des répartitions. " Compte tenu de ce que j'ai observé, que crois- je des paramètres? " demandent- ils.

Pour la construction de systèmes ML, la différence pratique:

| Aspect | Frequentist | Bayesian |
|--------|-------------|----------|
| Output | Point estimate | Distribution over values |
| Uncertainty | Confidence intervals (about procedure) | Credible intervals (about parameter) |
| Small data | Can overfit | Prior acts as regularization |
| Computation | Usually faster | Often requires sampling (MCMC) |

La plupart des méthodes de production sont fréquentistes (SGD, estimations de points). Les méthodes bayésiennes brillent lorsque vous avez besoin d'une incertitude calibrée (décisions médicales, systèmes critiques pour la sécurité) ou lorsque les données sont rares (apprentissage à quelques coups, démarrage à froid).

### Pourquoi la pensée bayésienne est importante pour l'IM

Le lien est plus profond que l' analogie:

**Priors are regularization.**Un préalable gaussien sur les poids est la régularisation de L2. Un préalable de Laplace est L1. Chaque fois que vous ajoutez un terme de régularisation, vous faites une déclaration bayésienne sur les valeurs de paramètre que vous attendez.

**Posteriors are uncertainty.**Une seule probabilité prévue ne vous dit rien sur la confiance du modèle dans cette estimation.$P(\text{spam})$est comprise entre 0,8 et 0,95. "

**Bayes updates are online learning.**Le postérieur d'aujourd'hui devient le prior de demain. Quand votre modèle voit de nouvelles données, il met à jour ses croyances progressivement au lieu de se réapproprier à partir de zéro.

**Model comparison is Bayesian.**Le critère Bayésien de l'information (BIC), la probabilité marginale et les facteurs Bayésiens utilisent tous le raisonnement Bayésien pour choisir entre des modèles sans sur-adaptation.

```figure
bayes-update
```

## Faites-le

### Étape 1: Fonction du théorème de Bayes

```python
def bayes(prior, likelihood, false_positive_rate):
    evidence = likelihood * prior + false_positive_rate * (1 - prior)
    posterior = likelihood * prior / evidence
    return posterior

result = bayes(prior=0.0001, likelihood=0.99, false_positive_rate=0.01)
print(f"P(sick|positive) = {result:.4f}")
```

### Étape 2: Classificateur Bayes naïf

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

Les probabilités de logs empêchent le sous-flow. Multiplication de nombreuses petites probabilités produit des nombres trop petits pour un point flottant. La somme des probabilités de logs est numériquement stable et mathématiquement équivalente.

### Étape 3: Trainer les données de spam

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

### Étape 4: Examinez les probabilités apprises

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

## Utilisez-le

Les navires de ski-apprentissage prêts à la production

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

Le même algorithme. CountVectorizer gère la symbolisation et la construction du vocabulaire. MultinomialNB gère le smoothing et les probabilités de journaux en interne. Votre version à partir de zéro fait la même chose en 40 lignes.

## La faire partir

La classe NaiveBayes construite ici démontre l'ensemble du pipeline: la tokenization, l'estimation de probabilité avec le lissage de Laplace, la prédiction de l'espace log.`code/bayes.py`fonctionne de bout en bout sans dépendances au-delà de la bibliothèque standard de Python.`code/bayes.ts`utilise uniquement la bibliothèque standard Node.

### Les prédécesseurs conjugaux

Lorsque le précédent et le posterior appartiennent à la même famille de distributions, le prior est appelé "conjugé". Cela rend la mise à jour algébrique bayésienne propre - vous obtenez une forme fermée de l'arrière sans intégration numérique.

| Likelihood | Conjugate Prior | Posterior | Example |
|-----------|----------------|-----------|---------|
| Bernoulli | $\text{Beta}(a, b)$ | $\text{Beta}(a + \text{successes}, b + \text{failures})$ | Coin flip bias estimation |
| Normal (known variance) | $\text{Normal}(\mu_0, \sigma_0)$ | Normal(weighted mean, smaller variance) | Sensor calibration |
| Poisson | $\text{Gamma}(a, b)$ | $\text{Gamma}(a + \text{sum of counts}, b + n)$ | Modeling arrival rates |
| Multinomial | $\text{Dirichlet}(\alpha)$ | $\text{Dirichlet}(\alpha + \text{counts})$ | Topic modeling, language models |

Pourquoi cela importe: sans précédents conjugués, vous avez besoin de l'échantillonnage de Monte Carlo ou d'une inférence variationnelle pour approximer le posterior.

La répartition bêta est le précurseur conjugué le plus courant en pratique. $\text{Beta}(a, b)$représente votre croyance sur un paramètre de probabilité.$a/(a+b)$- Le plus grand .$a+b$, plus la distribution est concentrée (confiante).

Cas particuliers de la période de Beta précédente:
- $\text{Beta}(1, 1)$Vous n'avez aucune opinion sur le paramètre.
- $\text{Beta}(10, 10)$Vous croyez fermement que le paramètre est proche de 0,5.
- $\text{Beta}(1, 10)$= dévié vers 0, vous pensez que le paramètre est petit.

La règle de mise à jour est très simple:

```math
\begin{aligned}
\text{Prior:} \quad & \text{Beta}(a, b) \\
\text{Data:} \quad & s \text{ successes}, f \text{ failures} \\
\text{Posterior:} \quad & \text{Beta}(a + s, b + f)
\end{aligned}
```

Pas d'intégrales, pas de prélèvement, juste d'addition.

### Mise à jour séquentielle bayésienne

L'inférence bayésienne est naturellement séquentielle. Le postérieur d'aujourd'hui devient le prior de demain. C'est ainsi que les systèmes réels apprennent progressivement sans refaire tout le traitement des données historiques.

Exemple concret: évaluer si une pièce est juste.

**Day 1: No data yet.**
Commencez par $\text{Beta}(1, 1)$- Vous n'avez pas d'opinion.
- Moyenne antérieure: 0,5
- Le prior est plat à travers [0, 1]

**Day 2: Observe 7 heads, 3 tails.**
$\text{Posterior} = \text{Beta}(1 + 7, 1 + 3) = \text{Beta}(8, 4)$
- Moyenne postérieure: $8/12 = 0.667$
- Les preuves suggèrent que la pièce est orientée vers les têtes

**Day 3: Observe 5 more heads, 5 more tails.**
Utilisez le postérieur d'hier comme le prior d'aujourd'hui.
$\text{Posterior} = \text{Beta}(8 + 5, 4 + 5) = \text{Beta}(13, 9)$
- Moyenne postérieure: $13/22 = 0.591$
- Les nouvelles données équilibrées ont ramené l'estimation vers 0,5.

```mermaid
graph LR
    A["Prior<br/>Beta(1,1)<br/>mean = 0.50"] -->|"7H, 3T"| B["Posterior 1<br/>Beta(8,4)<br/>mean = 0.67"]
    B -->|"becomes prior"| C["Prior 2<br/>Beta(8,4)"]
    C -->|"5H, 5T"| D["Posterior 2<br/>Beta(13,9)<br/>mean = 0.59"]
```

L'ordre des observations n'a pas d'importance. $\text{Beta}(1,1)$mis à jour avec les 12 têtes et 8 queues à la fois donne $\text{Beta}(13, 9)$-- le même résultat. La mise à jour séquentielle et la mise à jour par lots sont mathématiquement équivalentes. Mais la mise à jour séquentielle vous permet de prendre des décisions à chaque étape sans stocker de données brutes.

C'est la base de l'apprentissage en ligne dans les systèmes ML de production. L'échantillonnage de Thompson pour les bandits, les systèmes de recommandation incrémentielle et les détecteurs d'anomalies de streaming utilisent tous ce modèle.

### Connexion aux tests A/B

Les tests A/B sont des déductions bayésiennes déguisées.

Configuration: vous testez deux couleurs de boutons: la variante A (bleu) et la variante B (vert). Vous voulez savoir lequel obtient le plus de clics.

Le test Bayésien A/B:

1. **Prior.**Commencez par $\text{Beta}(1, 1)$Pour les deux variantes, aucune préférence préalable.
2. **Data.**La variante A: 50 clics sur 1000 vues. La variante B: 65 clics sur 1000 vues.
3. **Posteriors.**
   - A: $\text{Beta}(1 + 50, 1 + 950) = \text{Beta}(51, 951)$- La moyenne = 0,051
   - B: $\text{Beta}(1 + 65, 1 + 935) = \text{Beta}(66, 936)$- La moyenne = 0,066
4. **Decision.**Compte $P(B > A)$-- la probabilité que le taux de conversion vrai de B est plus élevé que celui de A.

L' informatique $P(B > A)$C'est difficile, mais Monte Carlo le rend trivial.

```
1. Draw 100,000 samples from Beta(51, 951)  -> samples_A
2. Draw 100,000 samples from Beta(66, 936)  -> samples_B
3. P(B > A) = fraction of samples where B > A
```

Si vous$P(B > A) > 0.95$Si la variante B est comprise entre 0,05 et 0,95, vous continuez à collecter des données.$P(B > A) < 0.05$Vous avez la variante A.

Les avantages par rapport aux tests A/B fréquentistes:
- Vous obtenez une déclaration de probabilité directe: "il y a 97% de chances que B est meilleur"
- Pas de confusion sur la valeur de p, pas de couverture "faut rejeter l'hypothèse nulle".
- Vous pouvez vérifier les résultats à tout moment sans gonfler de taux de faux positifs (pas de "problème de recherche")
- Vous pouvez intégrer des connaissances préalables (par exemple, des tests antérieurs suggèrent que les taux de conversion sont généralement de 3-8%)

| Aspect | Frequentist A/B | Bayesian A/B |
|--------|----------------|--------------|
| Output | p-value | $P(B > A)$ |
| Interpretation | "How surprising is this data if A=B?" | "How likely is B better than A?" |
| Early stopping | Inflates false positives | Safe at any point (given a well-chosen prior and correctly specified model) |
| Prior knowledge | Not used | Encoded as Beta prior |
| Decision rule | $p < 0.05$ | $P(B > A) > \text{threshold}$ |

## Exercices

1. **Multiple tests.**Un patient a testé positif deux fois sur des tests indépendants (les deux tests sont 99% exacts, la prévalence de la maladie est de 1 sur 10 000).$P(\text{sick})$Utilisez le postérieur du premier test comme le préalable du second.

2. **Smoothing impact.**Exécutez le classifiateur de spam avec des valeurs de lissage de 0.01, 0.1, 1.0 et 10.0. Comment les probabilités de mots supérieurs changent-elles?

3. **Add features.**Élargir la classe NaiveBayes pour utiliser également la longueur du message (courte/longue) comme fonctionnalité à côté du nombre de mots.$P(\text{short} \mid \text{spam})$et $P(\text{short} \mid \text{ham})$de la formation et le plier dans le score de prédiction.

4. **MAP by hand.**Compte tenu des données observées (7 têtes sur 10 lancements de pièces), calculer l' estimation du MAP du biais en utilisant un $\text{Beta}(2,2)$Comparer avec l'estimation de l'AML ($7/10$)

### Des indices

**Exercise 1.**Appel`bayes`une fois pour obtenir le posterior après le test 1, puis appeler à nouveau avec ce posterior comme le prior. `sequential_bayes(prior, likelihood, false_positive_rate, 2)`doit donner la même valeur, proche de 0,5.

**Exercise 2.**Créez un .`NaiveBayes(smoothing=s)`pour chaque valeur, entraînez-le sur les mêmes données, et imprimez `top_words`Avec l'allégement 0, un mot qui ne apparaît jamais dans le spam obtient la probabilité 0, donc son journal n'est pas défini.

**Exercise 3.**Comptez combien de messages de spam et de jambon sont courts, divisez-les par le nombre de messages dans chaque classe, et ajoutez le journal de ce rapport au score en `predict`Vérifiez que les deux probabilités pour chaque classe s'ajoutent à 1.

**Exercise 4.**Avec un$\text{Beta}(\alpha, \beta)$Avant, l'estimation du PAM est $\frac{h + \alpha - 1}{n + \alpha + \beta - 2}$- Mettez-le .$h = 7$- Je suis là .$n = 10$; le résultat doit être entre le MLE (0,7) et le mode précédent (0,5).

## Les termes clés

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

## Pour en savoir plus

- [3Blue1Brown: Bayes' theorem](https://www.youtube.com/watch?v=HZGCoVF3YvM)- explication visuelle avec l'exemple du test médical
- [Stanford CS229: Generative Learning Algorithms](https://cs229.stanford.edu/main_notes.pdf)- Bayes naïf et son lien avec les modèles discriminatoires
- [Think Bayes](https://greenteapress.com/wp/think-bayes/)- livre gratuit, statistiques bayésiennes avec code Python
- [scikit-learn Naive Bayes](https://scikit-learn.org/stable/modules/naive_bayes.html)- les mises en œuvre de la production et le moment de l'utilisation de chaque variante
