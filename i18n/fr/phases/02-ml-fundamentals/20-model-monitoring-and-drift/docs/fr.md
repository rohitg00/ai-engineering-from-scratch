# Modèles de surveillance de la production  Drift de données et Drift de concepts

> Un modèle déployé échoue sans message d'erreur. Il continue de retourner des scores alors que le monde s'éloigne de ses données de formation, et seule la surveillance montre l'écart.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 2, Lessons 09 (Model Evaluation), 16 (Anomaly Detection), and 19 (ML System Design)
**Time:** ~110 minutes

## Objectifs d'apprentissage

- Choisissez les signaux de surveillance à quatre niveaux: santé du système, entrées, prédictions et résultats
- Distinguer la dérive de covariation, la dérive antérieure et la dérive conceptuelle par la partie de la distribution commune qui change
- Mettre en œuvre l'indice de stabilité de la population, la statistique à deux échantillons Kolmogorov-Smirnov et le test du chi-quadré à partir de zéro
- Comparer une fenêtre de référence fixe avec des fenêtres coulissantes et expliquer comment la taille de la fenêtre modifie le bruit et le retard
- Conception d'une politique d'alerte qui limite les fausses alertes avec des tailles d'effet, une correction à plusieurs tests et une règle de persistance
- Décider quel type de dérive doit être recyclé, quel type doit être étiqueté et quel type ne doit pas être traité

## Le problème

Un modèle de risque de paiement est mis en œuvre avec une précision de 95%. Deux mois plus tard, une campagne de marketing amène des utilisateurs d'applications avec de plus grands paniers.

Le service modèle renvoie HTTP 200 pour chaque demande pendant tout cela. La latence est normale et les journaux ne montrent pas d'erreurs. Le premier signe de problème est un rapport financier sur les remboursements, des semaines après les dommages.

Le moniteur de logiciels vérifie si un service répond. Le moniteur de modèle vérifie si les réponses sont toujours correctes et si les données ressemblent toujours aux données qui ont formé le modèle. Cette leçon construit les statistiques, les fenêtres et la politique d'alerte pour ce deuxième travail. Vous les exécutez sur un flux synthétique avec deux changements injectés et regardez quel moniteur réagit à quel changement.

## Le concept

### Qu' est- ce à surveiller

Les trois premiers mettent en garde, le quatrième mesure la précision et arrive en retard.

| Layer | Signals | Available | Question it answers |
|---|---|---|---|
| System health | p50 and p99 latency, error rate, throughput, memory | At once | Does the service answer? |
| Inputs | Distribution of each feature, missing-value rate, schema, new categories | At once | Does live data look like training data? |
| Predictions | Score distribution, positive rate, share of default answers | At once | Does the model behave as before? |
| Outcomes | Accuracy, precision, calibration, business metric | After the label delay | Is the model still right? |

La surveillance des entrées est le sujet principal de cette leçon, car elle fonctionne avant l'arrivée des étiquettes.

### Trois types de dérive

Écrire la répartition commune des entrées `x`et les étiquettes `y`de deux façons:

```math
P(x, y) = P(x) \cdot P(y \mid x) = P(y) \cdot P(x \mid y)
```

Chaque type de dérive change un facteur différent:

| Drift | What changes | What stays | Payment example | Which monitor sees it |
|---|---|---|---|---|
| Covariate drift | `P(x)` | `P(y \| x)` | More app users with larger baskets | Input monitors |
| Prior drift | `P(y)` | `P(x \| y)` | The fraud rate doubles during an attack, and fraud looks the same | Prediction and outcome monitors |
| Concept drift | `P(y \| x)` | Can stay | The same basket now has a different fraud risk | Outcome monitors only |

Gama et coll. appellent un changement dans `P(y | x)`Ils appellent un changement de conception.`P(x)`qui laisse`P(y | x)`Leur enquête classifie également la dérive en fonction de la façon dont elle se produit au fil du temps: soudaine, incrémentielle, graduelle, ou comme un concept qui revient.

La dérive de la covariation ne fait pas toujours mal.`P(y | x)`Il peut perdre sa précision quand le trafic se déplace vers des régions avec peu de données de formation ou près de la limite de décision.

### Étiquettes retardées

Le résultat arrive après la prédiction.

| Problem | When the label arrives |
|---|---|
| Ad click | Seconds |
| Churn in the next 30 days | 30 days |
| Card fraud | When the chargeback arrives, often weeks later |
| Loan default | Months or years |

Pendant le retard, vous avez des entrées et des prédictions mais aucun résultat. Surveillez les entrées et les prédictions, rejoignez les étiquettes lorsqu'elles arrivent et comptez les métriques de résultat uniquement sur la partie étiquetée. La démonstration utilise un retard d'étiquette de 500 événements, de sorte que le moniteur de résultats regarde toujours 500 événements dans le passé.

### Les fenêtres de référence et les fenêtres courantes

Chaque test de dérive compare deux échantillons:

- **Reference window.**Les données de formation, ou une période de production que vous avez vérifiée à la main, restent fixes jusqu'à ce que vous repreniez.
- **Current window.**Les événements les plus récents, soit les derniers `N`événements ou les derniers `T`Des heures.

Une fenêtre coulissante se déplace vers l'avant d'un pas plus petit que sa taille, de sorte que les fenêtres consécutives se chevauchent. Une fenêtre coulissante se déplace par sa taille complète. La taille de la fenêtre est un compromis. Une petite fenêtre réagit rapidement mais note le bruit en dérive. Une grande fenêtre est stable mais rapporte un changement tard.

La saisonnalité brise les fenêtres naïves. Le trafic du lundi diffère du trafic du samedi dans de nombreux produits. Faites en sorte que la référence couvre un cycle complet, ou comparez chaque fenêtre avec la même période dans un cycle précédent.

### Indice de stabilité de la population

Le PSI provient du score de crédit. Coupez les valeurs de référence en poubelles, généralement dix poubelles aux décibels de référence, de sorte que chaque poubelle contient 10% de la référence.

```math
\text{PSI} = \sum_{\text{bins}} (\text{current\_share} - \text{reference\_share}) \cdot \ln\left(\frac{\text{current\_share}}{\text{reference\_share}}\right)
```

Un bin avec une part de zéro rend le journal infini, donc cliquez chaque part à une petite valeur telle que 0,0001. PSI est symétrique.

Les praticiens lisent le PSI avec des bandes fixes: en dessous de 0,1 est stable, de 0,1 à 0,25 est un changement modéré, et au-dessus de 0,25 est un changement significatif. Traitez ces bandes comme une convention, pas un test. Le PSI augmente avec le nombre de poubelles et se réduit avec la taille de l'échantillon.

### Statistique de Kolmogorov-Smirnov

Les statistiques KS à deux échantillons `D`est l'écart vertical le plus important entre les deux fonctions de distribution cumulative empirique:

```math
D = \max_x \left\lvert F_{\text{reference}}(x) - F_{\text{current}}(x) \right\rvert
```

`D`est 0 pour les échantillons identiques et 1 pour les échantillons qui ne se chevauchent pas. Il n'a pas besoin de poubelles. La valeur p provient de la distribution de Kolmogorov avec la taille effective de l'échantillon `n * m / (n + m)`- Je suis désolé .

Avec de grands échantillons, la valeur de p va à zéro pour une lacune qui ne tient pas compte. Un changement de 0,02 écarts standards est "signifiant" avec un million d'événements par fenêtre.`D`l'effet de la taille, et de l'alerte seulement lorsque les deux `D`et la valeur de p dépasse leurs seuils.

### Teste en chi-quadré pour les caractéristiques catégoriques

Pour une fonctionnalité catégorique, telle que le canal de paiement, construisez un tableau avec deux lignes (références, courants) et une colonne par catégorie.

```math
\begin{aligned}
\text{expected}[r][c] &= \text{row\_total}[r] \cdot \text{column\_total}[c] / \text{grand\_total} \\
\text{chi2} &= \sum_{\text{cells}} (\text{observed} - \text{expected})^2 / \text{expected}
\end{aligned}
```

Le test a`k - 1`degrés de liberté pour `k`catégories. Une catégorie qui apparaît uniquement dans la fenêtre actuelle ajoute un terme grand, de sorte que le test réagit à de nouvelles valeurs. V de Cramér est la taille de l'effet. Pour une table avec deux lignes, il est égal à la racine carrée de `chi2 / grand_total`- Je suis désolé .

### Les seuils d'alerte et les fausses alertes

Chaque test a un taux d' alarme fausse .`alpha`La surveillance effectue de nombreux tests, avec 50 fonctionnalités vérifiées toutes les heures à la fin de la journée.`alpha = 0.05`On s'attend à 60 fausses alertes par jour, quand rien n'a changé.

Quatre règles permettent de maintenir le taux d' alerte utile:

1. **Correct for multiple tests.**La correction Bonferroni divise `alpha`La démo utilise une famille.`alpha`de 0,01 sur deux essais, de sorte que chaque test utilise 0,005.
2. **Require an effect size.**Alerte uniquement lorsque le PSI,`D`, ou le V de Cramér passe aussi un seuil.
3. **Require persistence.**Alerte seulement après `k`Les fenêtres de dérive consécutives.`k = 2`- Je suis désolé .
4. **Separate warnings from alerts.**Un avertissement va à un tableau de bord.

La démo montre la règle 2 en action. Une fenêtre propre a une valeur p-chi-quadrée de 0,0009, inférieure à la valeur par test`alpha`Le V de Cramér est inférieur à 0,1, donc la police enregistre un avertissement, pas une alerte.

### Les déclencheurs de la réentraînement

Il existe trois déclencheurs communs de la rééducation:

- **Schedule.**C'est simple, mais il se réentraîne quand rien n'a changé et attend quand quelque chose a changé.
- **Drift.**Rétrainer lorsque la dérive d'entrée sur des caractéristiques importantes reste au-dessus du seuil.
- **Performance.**Rentraînement lorsque la métrique de résultat tombe en dessous de la valeur de référence moins une tolérance.

Le genre de dérive décide de ce que la rééducation peut faire:

| Drift | Useful action |
|---|---|
| Covariate drift, accuracy stable | Often none. Keep watching the outcome metric. |
| Covariate drift into regions with little data | Retrain on recent data that includes those regions |
| Prior drift | Recalibrate the scores or move the decision threshold |
| Concept drift | Collect new labels first. Retraining on old labels teaches the old concept again. |

Après la rééducation, testez le nouveau modèle sur les données étiquetées les plus récentes. Déployez-le avec les étapes de l'ombre et des canaries de la leçon de conception du système.

```figure
mlprod-drift-psi
```

## Faites-le

Le code dans `code/main.py`utilise uniquement la bibliothèque standard.

### Étape 1: Les contenants quantiques et les IPS

Les bords du coffre sont les décibels de référence. `bisect_right`trouve le coffre de chaque valeur.

```python
def quantile_edges(reference: list[float], bins: int = 10) -> list[float]:
    ordered = sorted(reference)
    n = len(ordered)
    edges = [ordered[min(n - 1, (n * i) // bins)] for i in range(1, bins)]
    return sorted(set(edges))


def psi_from_fractions(expected: list[float], actual: list[float], eps: float = 1e-4) -> float:
    total = 0.0
    for e, a in zip(expected, actual):
        e, a = max(e, eps), max(a, eps)
        total += (a - e) * math.log(a / e)
    return total
```

### Étape 2: Statistique de la SK et sa valeur p

Parcourez les deux échantillons triés ensemble. À chaque valeur distincte, dépassez chaque copie de celui-ci dans les deux échantillons, puis comparez les deux parts cumulées. Cela gère les liens correctement.

```python
def ks_statistic(sample_a: list[float], sample_b: list[float]) -> float:
    a, b = sorted(sample_a), sorted(sample_b)
    n, m = len(a), len(b)
    i = j = 0
    d = 0.0
    while i < n and j < m:
        x = min(a[i], b[j])
        while i < n and a[i] <= x:
            i += 1
        while j < m and b[j] <= x:
            j += 1
        d = max(d, abs(i / n - j / m))
    return d
```

La valeur p utilise la série pour la distribution de Kolmogorov,`2 * sum((-1)^(k-1) * exp(-2 k^2 lambda^2))`, avec `lambda = sqrt(n * m / (n + m)) * D`- Je suis désolé .

### Étape 3: Le test du carré de chi

`chi2_sf`Il compute la fonction de survie du carré de chi à travers la fonction gamma incomplète supérieure régulièrement régulée. Il utilise une série pour les petits arguments et une fraction continue pour les grands. `chi_square_test`construit la table à deux rangées, calcule la statistique et renvoie la valeur p et la V de Cramér.

```python
def chi_square_test(reference_counts: dict[str, int], current_counts: dict[str, int]) -> ChiSquareResult:
    categories = [c for c in sorted(set(reference_counts) | set(current_counts))
                  if reference_counts.get(c, 0) + current_counts.get(c, 0) > 0]
    rows = [[reference_counts.get(c, 0) for c in categories], [current_counts.get(c, 0) for c in categories]]
    row_totals = [sum(r) for r in rows]
    grand = sum(row_totals)
    if len(categories) < 2 or 0 in row_totals:
        return ChiSquareResult(0.0, 0, 1.0, 0.0)
    statistic = 0.0
    for col, _ in enumerate(categories):
        col_total = rows[0][col] + rows[1][col]
        for r in range(2):
            expected = row_totals[r] * col_total / grand
            statistic += (rows[r][col] - expected) ** 2 / expected
    dof = len(categories) - 1
    return ChiSquareResult(statistic, dof, chi2_sf(statistic, dof), math.sqrt(statistic / grand))
```

### Étape 4: Windows et le moniteur à dérive

`SlidingWindow`Il garde le dernier .`size`événements dans une `deque`- Je suis là .`DriftMonitor`Il compte les conteneurs de référence et compte une fois.`check`La méthode renvoie le PSI, `D`, et la valeur KS p pour chaque caractéristique numérique, et le résultat chi-quadrée pour chaque caractéristique catégorique.

### Étape 5: Politique d'alerte

La politique transforme chaque métrique définie en un niveau et compte les fenêtres de dérive consécutives par signal:

```python
def level(self, metrics: dict[str, float]) -> str:
    if "psi" in metrics:
        if metrics["psi"] >= self.psi_drift or (metrics["ks"] >= self.ks_drift and metrics["ks_p"] < self.alpha):
            return "drift"
        return "warn" if metrics["psi"] >= self.psi_warn else "ok"
    if metrics["p"] < self.alpha and metrics["v"] >= self.min_cramers_v:
        return "drift"
    return "warn" if metrics["p"] < self.alpha else "ok"
```

`update`Retour `ALERT`sur la fenêtre qui complète la ligne, et `resolved`sur la première fenêtre propre après une alerte.

### Étape 6: Un courant avec dérive injectable

Le flux comporte 9000 événements de paiement avec un `amount`, une `channel`, et une fraude .`label`Il est défini par quatre segments:

| Events | Amount | Channel mix (app, store, web) | Label boundary | Change |
|---|---|---|---|---|
| 0 to 2999 | mean 100, sd 20 | 35, 15, 50 percent | 120 | Reference period |
| 3000 to 4999 | mean 118, sd 24 | 60, 10, 30 percent | 120 | Covariate drift |
| 5000 to 6499 | mean 100, sd 20 | 35, 15, 50 percent | 120 | Back to normal |
| 6500 to 8999 | mean 100, sd 20 | 35, 15, 50 percent | 105 | Concept drift |

Le modèle est un seuil de `amount`Les étiquettes arrivent 500 événements en retard.

```bash
python3 code/main.py
npx tsx code/main.ts
```

```console
  end    PSI   KS D   chi2 p    acc  levels (amount/channel/accuracy)  events
 3000  0.010  0.041  3.0e-01  0.932  ok/ok/ok
 3250  0.152  0.163  7.6e-06  0.924  drift/warn/ok
 3500  0.463  0.298  2.8e-26  0.936  drift/drift/ok                     ALERT amount
 3750  0.609  0.343  3.5e-35  0.942  drift/drift/ok                     ALERT channel
 ...
 5500  0.026  0.044  2.6e-01  0.898  ok/ok/ok                           resolved amount, resolved channel
 ...
 7250  0.040  0.048  7.1e-01  0.848  ok/ok/drift
 7500  0.022  0.039  6.1e-01  0.778  ok/ok/drift                        ALERT accuracy
```

Lisez le résultat en trois parties:

- **Covariate drift.**La dérive commence à l'événement 3000, et le `amount`L'avertissement est de 3500.
- **Recovery.**Les entrées reviennent à la normale à 5000, et les deux alertes se résolvent à 5500.
- **Concept drift.**La dérive commence à 6500, et les moniteurs d'entrée restent silencieux car les entrées n'ont pas changé. La précision tombe de 0,946 à entre 0,76 et 0,79.

## Utilisez-le

**scipy.** `scipy.stats`Les statistiques correspondent au code de départ.

```python
from scipy import stats

result = stats.ks_2samp(reference_amounts, current_amounts)
print(result.statistic, result.pvalue)

table = [[1000, 700, 300], [140, 290, 70]]
chi2 = stats.chi2_contingency(table)
print(chi2.statistic, chi2.pvalue, chi2.dof)
```

On a vérifié .`ks_statistic`et `chi_square_test`Les statistiques de KS, de la statistique de chi-quadré et de la valeur de p de chi-quadré correspondent à la précision des points flottants.

Le code utilise la distribution limitante de Kolmogorov.`ks_2samp`Il utilise une méthode exacte lorsque les deux échantillons ont au plus 10 000 valeurs.`chi2_contingency`applique par défaut la correction de continuité de Yates, les statistiques diffèrent donc.

**Monitoring libraries.**Plusieurs bibliothèques open source contiennent des rapports et des tableaux de bord:

- **Evidently**Il utilise le test KS pour les colonnes numériques et le test chi-quadrés pour les colonnes catégoriques. Pour les données plus grandes, il utilise la distance Wasserstein et la divergence Jensen-Shannon avec un seuil de 0,1 .
- **NannyML**L'estimation de performance basée sur la confiance (CBPE) utilise les probabilités prévues du modèle, qui doivent être bien calibrées. La documentation NannyML stipule que CBPE gère le décalage de covariation mais ne fait pas face à la dérive conceptuelle.
- **TensorFlow Data Validation**Il utilise la distance L-infini pour les caractéristiques catégoriques et une divergence Jensen-Shannon approximative pour les caractéristiques numériques.

Le code à partir de zéro montre ce que chaque outil compute.

Pour les demandes de MLL, le[LLM observability lesson](../../../17-infrastructure-and-production/13-llm-observability/docs/en.md)Les concepts de cette leçon s'appliquent toujours aux entrées et sorties de ces systèmes.

## La faire partir

Cette leçon produit `outputs/skill-drift-monitoring.md`- La compétence planifie les moniteurs pour un nouveau modèle et tries une alerte de dérive. Elle demande quelle couche a été tirée, quel type de dérive correspond aux preuves et si l'action correcte est d'attendre, de récalibrer, de collecter des étiquettes ou de se réentraîner.

## Exercices

1. Exécutez le flux avec des fenêtres de 200 et 2000 événements, enregistrez les fausses alertes avant l'événement 3000 et le retard d'alerte.
2. Réglage `n_tests=1`- Je suis là .`patience=1`, et `min_cramers_v=0`- Comptez les alertes dans la période de nettoyage de 5000 à 6500.
3. Ajoutez une fonction dont la moyenne augmente de 0,01 par 100 événements.
4. Appliquez la distance Jensen-Shannon sur les mêmes déciles de contenant.
5. Ajoutez un moniteur pour voir si le modèle est positif et expliquez pourquoi il reste silencieux pendant la dérive conceptuelle.

## Les termes clés

| Term | What people say | What it means |
|------|----------------|----------------------|
| Data drift | "The data changed" | A change in the distribution of inputs, predictions, or labels compared with a reference window |
| Covariate drift | "New kinds of users" | `P(x)` changes while `P(y \| x)` stays the same |
| Prior drift | "More positives than before" | `P(y)` changes while `P(x \| y)` stays the same, also called label shift |
| Concept drift | "The rules of the game changed" | `P(y \| x)` changes, so the same input now has a different correct answer |
| Reference window | "The baseline data" | A fixed sample, often the training data, that every current window is compared with |
| PSI | "The stability score" | A symmetric sum over bins of (current share minus reference share) times the log of their ratio |
| KS statistic | "The KS test" | The largest gap between two empirical cumulative distribution functions |
| Cramér's V | "Effect size for categories" | The chi-square statistic scaled to the range 0 to 1 |
| Label delay | "Ground truth comes later" | The time between a prediction and the arrival of its true outcome |
| Alert fatigue | "Too many pages" | People ignore alerts because most of them were false alarms |

## Pour en savoir plus

- [Gama et al., A Survey on Concept Drift Adaptation (ACM Computing Surveys, 2014)](https://research.tue.nl/en/publications/a-survey-on-concept-drift-adaptation): dérive réelle et virtuelle, modèles de dérive et méthodes d'adaptation
- [Rabanser, Günnemann, and Lipton, Failing Loudly: An Empirical Study of Methods for Detecting Dataset Shift (NeurIPS 2019)](https://arxiv.org/abs/1810.11953): deux essais d'échantillons pour la détection des changements
- [Lu et al., Learning under Concept Drift: A Review (2020)](https://arxiv.org/abs/2004.05785): méthodes de détection, de compréhension et d'adaptation
- [Yurdakul, Statistical Properties of Population Stability Index (Western Michigan University, 2018)](https://scholarworks.wmich.edu/dissertations/3208/): comment l'ISP se comporte en fonction de la taille de l'échantillon et du nombre de conteneurs
- [scipy.stats.ks_2samp documentation](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.ks_2samp.html): méthodes exactes et asymptotiques de p-value pour le test KS à deux échantillons
- [Evidently, How data drift detection works](https://docs.evidentlyai.com/metrics/explainer_drift): sélection par défaut de test par type de colonne et taille de données
- [NannyML, Performance estimation](https://nannyml.readthedocs.io/en/stable/how_it_works/performance_estimation.html): CBPE et ses hypothèses
