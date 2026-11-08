# Normes et distances

> Votre fonction de distance définit ce que signifie "semblable".

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1, Lessons 01 (Linear Algebra Intuition), 02 (Vectors, Matrices & Operations)
**Time:** ~90 minutes

## Objectifs d'apprentissage

- Implémenter L1, L2, cosine, Mahalanobis, Jaccard, et modifier les fonctions de distance à partir de zéro
- Sélectionnez la mesure de distance appropriée pour une tâche de gestion de la distance donnée et expliquez pourquoi les alternatives échouent
- Connecter les normes L1 et L2 à la régularisation LASSO et Ridge et à leurs régions de contraintes géométriques
- Démontre comment le même ensemble de données produit différents voisins proches sous différentes mesures

## Le problème

Vous avez deux vecteurs. Peut-être sont-ils des emblèmes de mots. Peut-être sont-ils des profils d'utilisateurs. Peut-être sont-ils des matrices de pixels. Vous devez savoir: à quelle distance sont-ils?

La réponse dépend entièrement de la fonction de distance que vous choisissez. Deux points de données peuvent être voisins proches sous une mesure et loin de l'autre. Votre classifiateur KNN, votre moteur de recommandation, votre base de données vectorielle, votre algorithme de regroupement, votre fonction de perte - ils dépendent tous de ce choix.

Il n'y a pas de meilleure distance universelle. L2 fonctionne pour les données spatiales. La similitude cosine domine la PNL. Jaccard gère des ensembles. Modifier la distance gère les chaînes. Mahalanobis compte pour les corrélations. Wasserstein déplace la masse de probabilité. Chacun d'eux code une hypothèse différente sur ce que signifie "similar".

Cette leçon construit chaque fonction principale de distance à partir de zéro, vous montre quand chacun est l'outil approprié, et montre comment les mêmes données produisent des voisins proches complètement différents selon la métrique que vous utilisez.

## Le concept

### Normes: mesure de la magnitude du vecteur

Une norme mesure la "dimension" d'un vecteur.$d(a, b) = \lVert a - b \rVert$Donc comprendre les normes, c'est comprendre les distances.

### L1 Norm (distance de Manhattan)

La norme L1 résume les valeurs absolues de tous les composants.

```math
\lVert x \rVert_1 = |x_1| + |x_2| + \cdots + |x_n|
```

On l'appelle la distance de Manhattan parce qu'elle mesure la distance par laquelle on marche sur une grille de ville où on ne peut se déplacer que sur des axes.

```
Point A = (1, 1)
Point B = (4, 5)

L1 distance = |4-1| + |5-1| = 3 + 4 = 7

On a grid, you walk 3 blocks east and 4 blocks north.
```

Quand utiliser L1:
- Données rares de haute dimension (fonctionnalités de texte, codage unique)
- Lorsque vous voulez robustesse à des échelles (une seule énorme différence ne domine pas)
- Problèmes de sélection des caractéristiques (régularisation de la L1 favorise la rareté)

Connexion à la régulation L1 (Lasso): ajout $\lVert w \rVert_1$La fonction de perte de votre fonction pénalise la somme des valeurs de poids absolus. Cela pousse les petits poids à exactement zéro, effectuant une sélection automatique des caractéristiques. La pénalité L1 crée des régions de contrainte en forme de diamant dans l'espace de poids, et les coins des diamants sont sur les axes où certains poids sont zéro.

Connexion aux fonctions de perte: L'erreur absolue moyenne (MAE) est la distance moyenne L1 entre les prédictions et les cibles. Elle pénalise toutes les erreurs de manière linéaire, ce qui la rend robuste à des valeurs anormales par rapport à MSE.

### L2 Norm (distance euclidienne)

La norme L2 est la distance en ligne droite.

```math
\lVert x \rVert_2 = \sqrt{x_1^2 + x_2^2 + \cdots + x_n^2}
```

C'est la distance que vous avez apprise en géométrie.$n$les dimensions.

```
Point A = (1, 1)
Point B = (4, 5)

L2 distance = sqrt((4-1)^2 + (5-1)^2) = sqrt(9 + 16) = sqrt(25) = 5.0

The straight line, cutting diagonally through the grid.
```

Quand utiliser L2:
- Données continues de basse à moyenne dimension
- Lorsque les échelles de caractéristiques sont comparables
- Distances physiques (données spatiales, lectures des capteurs)
- La similitude de l'image au niveau des pixels

Connexion à la régulation L2 (Ridge): ajout $\lVert w \rVert_2^2$La fonction de perte de votre fonction pénalise les poids importants. contrairement à L1, elle ne pousse pas les poids à zéro. Elle réduit tous les poids vers zéro proportionnellement. La pénalité L2 crée des régions de contrainte circulaire, de sorte qu'il n'y a pas d'angle sur les axes. Les poids deviennent petits mais rarement exactement zéro.

Connexion aux fonctions de perte: l'erreur carrée moyenne (MSE) est la moyenne des distances L2 carrées.

```math
\begin{aligned}
\text{MAE (L1 loss):} \quad & |y - \hat{y}| && \text{Linear penalty. Robust to outliers.} \\
\text{MSE (L2 loss):} \quad & (y - \hat{y})^2 && \text{Quadratic penalty. Sensitive to outliers.}
\end{aligned}
```

### Normes de l'IP: la famille générale

L1 et L2 sont des cas particuliers de la norme Lp:

```math
\lVert x \rVert_p = (|x_1|^p + |x_2|^p + \cdots + |x_n|^p)^{1/p}
```

Vérités différentes de $p$produisent des "boulons d'unité" de différentes formes (l'ensemble de tous les points à une distance maximale de 1 de l'origine; les formes ci-dessous sont leurs limites):

```
p=1:    Diamond shape      (corners on axes)
p=2:    Circle/sphere      (the usual round ball)
p=3:    Superellipse       (rounded square)
p=inf:  Square/hypercube   (flat sides along axes)
```

### Normalité de l'infiniité L (distance Tchebyshev)

Comme $p$approche l'infini, la norme Lp converge à la composante absolue maximale.

```math
\lVert x \rVert_\infty = \max(|x_1|, |x_2|, \ldots, |x_n|)
```

La distance entre deux points est déterminée par la dimension unique où elles diffèrent le plus.

```math
\begin{aligned}
\text{Point } A &= (1, 1) \\
\text{Point } B &= (4, 5) \\[6pt]
L_\infty \text{ distance} &= \max(|4-1|, |5-1|) = \max(3, 4) = 4
\end{aligned}
```

Quand utiliser L-infinity:
- Lorsque la plus grave déviation dans une dimension unique est importante
- Tables de jeu (un roi à l'échec se déplace à l'infini: un pas dans n'importe quelle direction coûte 1)
- Tolérances de fabrication (toutes les dimensions doivent être dans les spécifications)

### Similation cosine et distance cosine

La similitude cosine mesure l'angle entre deux vecteurs, en ignorant leurs magnitudes.

```math
\text{cos\_sim}(a, b) = \frac{a \cdot b}{\lVert a \rVert_2 \, \lVert b \rVert_2}
```

Il va de -1 (directions opposées) à +1 (même direction).

La distance cosine la convertit en distance: cosine_distance = 1 - cosine_similarité. Cela varie de 0 (direction identique) à 2 (direction opposée).

```math
\begin{aligned}
& a = (1, 0) \qquad b = (1, 1) \\[6pt]
& \text{cos\_sim} = \frac{1 \cdot 1 + 0 \cdot 1}{1 \cdot \sqrt{2}} = \frac{1}{\sqrt{2}} = 0.707 \\
& \text{cos\_dist} = 1 - 0.707 = 0.293
\end{aligned}
```

Pourquoi le cosine domine la PNL et les emblèmes: dans le texte, la longueur du document ne devrait pas affecter la similitude. Un document sur les chats qui est deux fois plus long que un autre document sur les chats devrait toujours être "semblable". Deux documents avec la même répartition de mots mais des longueurs différentes pointent dans la même direction et obtiennent une similitude cosine 1.0.

Quand utiliser la similitude cosine:
- Parmi les éléments suivants, il y a:
- Tout domaine où la magnitude est bruit et la direction est signal
- Systèmes de recommandations (vecteurs de préférence des utilisateurs)
- Embedding search (les bases de données vectorielles utilisent presque toujours le produit cosine ou point)

### Parallèle produit point parallèle cosine

Le produit de point de deux vecteurs est:

```math
\begin{aligned}
a \cdot b &= a_1 b_1 + a_2 b_2 + \cdots + a_n b_n \\
&= \lVert a \rVert \, \lVert b \rVert \cos(\text{angle})
\end{aligned}
```

La similitude cosine est le produit de point normalisé par les deux magnitudes. Lorsque les deux vecteurs sont déjà normalisés en unité (magnitude = 1), le produit de point et la similitude cosine sont identiques.

```math
\text{If } \lVert a \rVert = 1 \text{ and } \lVert b \rVert = 1: \quad a \cdot b = \cos(\text{angle between } a \text{ and } b)
```

Quand ils diffèrent: le produit de point inclut des informations de grandeur. Un vecteur avec une grandeur plus grande obtient un score de produit de point plus élevé. Cela compte dans certains systèmes de récupération où vous voulez que les éléments "populaires" se classent plus haut. La grandeur agit comme un signal implicite de qualité ou d'importance.

```
a = (3, 0)    b = (1, 0)    c = (0, 1)

dot(a, b) = 3     dot(a, c) = 0
cos(a, b) = 1.0   cos(a, c) = 0.0

Both agree on direction, but dot product also reflects magnitude.
```

Dans la pratique:
- Utilisez la similitude cosine lorsque vous voulez une similitude directionnelle pure
- Utiliser le produit de point lorsque les magnitudes contiennent des informations significatives
- De nombreuses bases de données vectorielles (Pinecone, Weaviate, Qdrant) vous permettent de choisir entre elles
- Si vos embeddings sont L2-normalizés, le choix n'a pas d'importance

### Distance à Mahalanobis

La distance euclidienne traite toutes les dimensions de la même manière, mais si vos caractéristiques sont corrélatives ou ont des échelles différentes, L2 donne des résultats trompeurs.

La distance de Mahalanobis explique la structure de covariance des données.

```math
d_M(x, y) = \sqrt{(x - y)^T S^{-1} (x - y)}
```

où $S$est la matrice de covariance des données.

Intuitivement: la distance de Mahalanobis décorélise et normalise d'abord les données (blanchiment), puis calcule la distance L2 dans cet espace transformé.$S$est la matrice d'identité (non corrélation, caractéristiques de variance unitaire), la distance de Mahalanobis se réduit à la distance euclidienne.

```
Example: height and weight are correlated.
Someone 6'2" and 180 lbs is not unusual.
Someone 5'0" and 180 lbs is unusual.

Euclidean distance might say they are equally far from the mean.
Mahalanobis distance correctly identifies the second as an outlier
because it accounts for the height-weight correlation.
```

Quand utiliser la distance Mahalanobis:
- Détection de l'outlier (les points à grande distance de Mahalanobis de la moyenne sont des points outliers)
- Classification lorsque les caractéristiques ont des échelles et des corrélations différentes
- Lorsque vous avez suffisamment de données pour estimer une matrice de covariance fiable
- Contrôle de la qualité dans la fabrication (monitorage des processus multivariés)

### La comparaison de jaccard (pour les ensembles)

Les mesures de similitude de Jaccard se chevauchent entre deux ensembles.

```math
J(A, B) = \frac{|A \cap B|}{|A \cup B|}
```

Il va de 0 (pas de chevauchement) à 1 (ensemble identique).

```
A = {cat, dog, fish}
B = {cat, bird, fish, snake}

Intersection = {cat, fish}         size = 2
Union = {cat, dog, fish, bird, snake}  size = 5

Jaccard similarity = 2/5 = 0.4
Jaccard distance = 0.6
```

Quand utiliser Jaccard:
- Comparer des ensembles de balises, de catégories ou de caractéristiques
- La similitude du document en fonction de la présence des mots (pas de la fréquence)
- Détection de quasi-duplicates (approximation MinHash de Jaccard)
- Comparer les vecteurs de caractéristiques binaires (données de présence/absence)
- Modèles d'évaluation de la segmentation (intersection sur l'Union = Jaccard)

### Modifier la distance (distance de Levenshtein)

La distance de modification compte le nombre minimum d'opérations à caractères simples nécessaires pour transformer une chaîne en une autre.

```
"kitten" -> "sitting"

kitten -> sitten  (substitute k -> s)
sitten -> sittin  (substitute e -> i)
sittin -> sitting (insert g)

Edit distance = 3
```

Compté à l'aide de la programmation dynamique. Remplissez une matrice où l'entrée $(i, j)$est la distance de modification entre la première $i$caractères de la chaîne A et le premier $j$caractères de la chaîne B.

```
        ""  s  i  t  t  i  n  g
    ""   0  1  2  3  4  5  6  7
    k    1  1  2  3  4  5  6  7
    i    2  2  1  2  3  4  5  6
    t    3  3  2  1  2  3  4  5
    t    4  4  3  2  1  2  3  4
    e    5  5  4  3  2  2  3  4
    n    6  6  5  4  3  3  2  3
```

Quand utiliser la distance de modification:
- Vérifie et corrige la sortie
- L'alignement des séquences d'ADN (avec des opérations pondérées)
- Parallèle de chaîne floue
- Déduplication des données de texte désordonnées

### KL Divergence (pas une distance, mais utilisée comme une)

La différence KL mesure la différence entre une distribution de probabilités et une autre.

```math
D_{KL}(P \,\|\, Q) = \sum_x p(x) \log\frac{p(x)}{q(x)}
```

Propriété critique: la divergence KL n'est PAS symétrique.

```math
D_{KL}(P \,\|\, Q) \ne D_{KL}(Q \,\|\, P)
```

Cela signifie qu'il ne répond pas aux exigences de base d'une métrique de distance. Il ne satisfait pas non plus à l'inégalité triangulaire.

Poursuite KL $(D_{KL}(P \Vert Q))$est "cherche de sens": $Q$essaie de couvrir tous les modes de $P$- Je suis désolé .
Retour en arrière KL $(D_{KL}(Q \Vert P))$est "recherche de mode": $Q$Il s'agit d'un mode de travail unique.$P$- Je suis désolé .

Quand vous voyez la divergence KL:
- Les VAE (le terme KL dans l'ELBO pousse la distribution latente vers une priorité)
- Destilation des connaissances (l'élève tente de correspondre à la distribution de l'enseignant)
- RLHF (la pénalité KL garde le modèle ajusté à la fine proche du modèle de base)
- Métodes de gradient de la politique (actualisations restrictives de la politique)

### Distance de Wasserstein (distance du déménageur de la Terre)

La distance de Wasserstein mesure le minimum de "travail" nécessaire pour transformer une distribution de probabilité en une autre. Pensez-y comme ceci: si une distribution est une pile de saleté et l'autre est un trou, combien de saleté devez-vous déplacer et jusqu'où?

```math
W(P, Q) = \inf_{\gamma} \mathbb{E}[d(x, y)] \quad \text{(over all transport plans } \gamma\text{)}
```

Pour les distributions 1D, il simplifie à l'intégrale de la différence absolue des fonctions de distribution cumulative:

```math
W_1(P, Q) = \int |\text{CDF}_P(x) - \text{CDF}_Q(x)| \, dx
```

Pourquoi Wasserstein est important:
- C'est une vraie métrique (symétrique, satisfait à l'inégalité triangulaire)
- Il fournit des gradients même lorsque les distributions ne se chevauchent pas (la divergence KL va à l'infini)
- Cette propriété en a fait le centre des GAN de Wasserstein (WGAN), qui ont résolu l'instabilité de formation des GAN originaux.

```
Distributions with no overlap:

P: [1, 0, 0, 0, 0]    Q: [0, 0, 0, 0, 1]

KL divergence: infinity (log of zero)
Wasserstein: 4 (move all mass 4 bins)

Wasserstein gives a meaningful gradient. KL does not.
```

Quand utiliser Wasserstein:
- Formation en GAN (WGAN, WGAN-GP)
- Comparer les répartitions qui ne peuvent pas se chevaucher
- Problèmes de transport optimaux
- Retrait d'image (comparer les histogrammes de couleur)

### Pourquoi les tâches doivent être différentes

| Task | Best distance | Why |
|------|--------------|-----|
| Text similarity | Cosine | Magnitude is noise, direction is meaning |
| Image pixel comparison | L2 | Spatial relationships matter, features are comparable scale |
| Sparse high-dim features | L1 | Robust, does not amplify rare large differences |
| Set overlap (tags, categories) | Jaccard | Data is naturally set-valued, not vectorial |
| String matching | Edit distance | Operations map to human editing intuition |
| Outlier detection | Mahalanobis | Accounts for feature correlations and scales |
| Comparing distributions | KL divergence | Measures information lost by using $Q$ instead of $P$ |
| GAN training | Wasserstein | Provides gradients even when distributions do not overlap |
| Embeddings (vector DB) | Cosine or dot product | Embeddings are trained to encode meaning in direction |
| Recommendation | Dot product | Magnitude can encode popularity or confidence |
| DNA sequences | Weighted edit distance | Substitution costs vary by nucleotide pair |
| Manufacturing QC | L-infinity | Worst-case deviation in any dimension matters |

### Connexion aux fonctions de perte

Les fonctions de perte sont des fonctions de distance appliquées aux prédictions par rapport aux cibles.

```
Loss function       Distance it uses       Behavior
MSE                 L2 squared             Penalizes large errors heavily
MAE                 L1                     Penalizes all errors equally
Huber loss          L1 for large errors,   Best of both: robust to outliers,
                    L2 for small errors    smooth gradient near zero
Cross-entropy       KL divergence          Measures distribution mismatch
Hinge loss          max(0, margin - d)     Only penalizes below margin
Triplet loss        L2 (typically)         Pulls positives close, pushes
                                           negatives away
Contrastive loss    L2                     Similar pairs close, dissimilar
                                           pairs beyond margin
```

### Connexion à la réglementation

La régulation ajoute une pénalité de norme sur les poids à la fonction de perte.

```
L1 regularization (Lasso):   loss + lambda * ||w||_1
  -> Sparse weights. Some weights become exactly zero.
  -> Automatic feature selection.
  -> Solution has corners (non-differentiable at zero).

L2 regularization (Ridge):   loss + lambda * ||w||_2^2
  -> Small weights. All weights shrink toward zero.
  -> No feature selection (nothing goes to exactly zero).
  -> Smooth solution everywhere.

Elastic Net:                  loss + lambda_1 * ||w||_1 + lambda_2 * ||w||_2^2
  -> Combines sparsity of L1 with stability of L2.
  -> Groups of correlated features are kept or dropped together.
```

Pourquoi L1 produit une rareté mais L2 ne le fait pas: imaginez la région de contrainte dans un espace de poids 2D. L1 est un diamant, L2 est un cercle. Les contours de la fonction de perte (élipse) sont les plus susceptibles de toucher le diamant à un coin, où un poids est zéro. Ils touchent le cercle à un point lisse, où les deux poids ne sont pas zéro.

### Rechercher le voisin le plus proche

Chaque fonction de distance implique un problème de recherche de voisin le plus proche: donné un point de requête, trouver les points les plus proches d'un ensemble de données.

La recherche de voisin la plus proche est $O(n \cdot d)$par requête dans un ensemble de données de $n$points avec $d$Pour les grands ensembles de données, c'est trop lent.

Les algorithmes Approximate Nearest Neighbor (ANN) échangent une petite précision pour des gains massifs de vitesse:

```
Algorithm         Approach                      Used by
KD-trees          Axis-aligned space partition   scikit-learn (low-dim)
Ball trees        Nested hyperspheres            scikit-learn (medium-dim)
LSH               Random hash projections        Near-duplicate detection
HNSW              Hierarchical navigable         FAISS, Qdrant, Weaviate
                  small-world graph
IVF               Inverted file index with       FAISS (billion-scale)
                  cluster-based search
Product quant.    Compress vectors, search       FAISS (memory-constrained)
                  in compressed space
```

HNSW (Hiérarchique Navigable Small World) est l'algorithme dominant dans les bases de données vectorielles modernes. Il crée un graphique multicouche où chaque nœud se connecte à ses voisins approximatifs.

```figure
norm-unit-balls
```

## Faites-le

### Étape 1: Toutes les fonctions de norme et de distance

Regardez !`code/distances.py`Chaque fonction est construite à partir de zéro en utilisant uniquement les mathématiques de base Python.`code/distances.ts`est un port TypeScript avec les mêmes fonctions et démos.

### Étape 2: Les mêmes données, différentes distances, voisins différents

La démo en .`distances.py`crée un ensemble de données, choisit un point de requête et montre comment le voisin le plus proche change en fonction de la mesure de distance.

### Étape 3: Embedding de recherche de similitudes

Le code comprend une recherche simulée intégrant des similitudes qui trouve les "documents" les plus similaires à une requête en utilisant la similitude cosine par rapport à la distance L2, montrant que les classements peuvent différer.

## Utilisez-le

L'utilisation pratique la plus courante: trouver des éléments similaires dans une base de données vectorielle.

```python
import numpy as np

def cosine_similarity_matrix(X):
    norms = np.linalg.norm(X, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1, norms)
    X_normalized = X / norms
    return X_normalized @ X_normalized.T

embeddings = np.random.randn(1000, 768)

sim_matrix = cosine_similarity_matrix(embeddings)

query_idx = 0
similarities = sim_matrix[query_idx]
top_k = np.argsort(similarities)[::-1][1:6]
print(f"Top 5 most similar to item 0: {top_k}")
print(f"Similarities: {similarities[top_k]}")
```

Quand vous appelez`model.encode(text)`et ensuite rechercher une base de données vectorielle, c'est ce qui se passe sous le capot. Le modèle d'intégration cartographient le texte vers des vecteurs. La base de données vectorielle calcule la similitude cosine (ou produit de point) entre votre vecteur de requête et chaque vecteur stocké, en utilisant des algorithmes ANN pour éviter de les vérifier tous.

## Exercices

1. Comptez les distances L1, L2 et L-infini entre (1, 2, 3) et (4, 0, 6). Vérifiez que $L_\infty \le L_2 \le L_1$Prouver pourquoi cette commande est garantie.

2. Créer deux vecteurs où la similitude cosine est élevée (> 0,9) mais la distance L2 est grande (> 10). Expliquer géométriquement ce qui se passe.

3. Implémenter une fonction qui prend un ensemble de données et un point de requête et renvoie le voisin le plus proche sous L1, L2, cosine et distance Mahalanobis.

4. Computez la distance de Wasserstein entre [0,5, 0,5, 0,0] et [0, 0, 0,5, 0,5] à la main en utilisant la méthode CDF. Computez-la ensuite entre [0,25, 0,25, 0,25, 0,25] et [0, 0, 0, 0,5, 0,5].

5. Implémenter MinHash pour une similitude approximative de Jaccard. Générer 100 ensembles aléatoires, calculer exact Jaccard pour toutes les paires, et comparer avec l'approximation MinHash en utilisant 50, 100 et 200 fonctions de hachage.

### Des indices

**Exercise 1.**Le vecteur de différence est (-3, 2, -3), alors calculer les trois normes de ce vecteur avec `l1_norm`- Je suis là .`l2_norm`, et `linf_norm`Pour la preuve, comparez le plus grand.$\lvert d_i \rvert$avec la somme des carrés, et comparer la somme des carrés avec le carré de la somme des valeurs absolues.

**Exercise 2.**La similitude cosine ignore la longueur, alors commencez par deux vecteurs qui pointent presque dans la même direction et faites l'un d'eux beaucoup plus long.`cosine_similarity`et `l2_distance`- Je suis désolé .

**Exercise 3.**Appel`find_nearest_neighbor(query, dataset, distance_fn)`une fois pour chacun `l1_distance`- Je suis là .`l2_distance`- Je suis là .`cosine_distance`, et `mahalanobis_distance`- Je suis là .`demo_different_neighbors`montre un ensemble de données où les mesures ne sont pas d'accord, alors lisez-le d'abord et changez les points jusqu'à ce que les quatre réponses diffèrent.

**Exercise 4.**Écrivez la somme cumulée de chaque distribution, puis ajoutez les différences absolues des deux sumes cumulatives.`wasserstein_1d(p, q)`, puis expliquer la valeur plus grande par la distance que la masse de probabilité doit se déplacer.

**Exercise 5.**Pour chaque fonction de hachage, la signature MinHash d'un ensemble est la valeur minimale de hachage sur ses éléments, et la fraction de fonction de hachage où deux ensembles obtiennent les mêmes estimations minimales de leur similitude Jaccard.`jaccard_similarity`; l' erreur devrait être de la taille suivante:$1/\sqrt{k}$pour $k$fonction de hachage.

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| Norm | "Size of a vector" | A function that maps a vector to a non-negative scalar, satisfying triangle inequality, absolute homogeneity, and zero only for the zero vector |
| L1 norm | "Manhattan distance" | Sum of absolute component values. Produces sparsity in optimization. Robust to outliers |
| L2 norm | "Euclidean distance" | Square root of sum of squared components. The straight-line distance in Euclidean space |
| Lp norm | "Generalized norm" | The $p$-th root of the sum of $p$-th powers of absolute components. L1 and L2 are special cases |
| L-infinity norm | "Max norm" or "Chebyshev distance" | The maximum absolute component value. The limit of Lp as $p$ approaches infinity |
| Cosine similarity | "Angle between vectors" | Dot product normalized by both magnitudes. Ranges from -1 to +1. Ignores vector length |
| Cosine distance | "1 minus cosine similarity" | Converts cosine similarity to a distance. Ranges from 0 to 2 |
| Dot product | "Unnormalized cosine" | Sum of component-wise products. Equals cosine similarity times both magnitudes |
| Mahalanobis distance | "Correlation-aware distance" | L2 distance in a space that has been whitened (decorrelated and normalized) using the data covariance matrix |
| Jaccard similarity | "Set overlap" | Size of intersection divided by size of union. For sets, not vectors |
| Edit distance | "Levenshtein distance" | Minimum insertions, deletions, and substitutions to transform one string into another |
| KL divergence | "Distance between distributions" | Not a true distance (not symmetric). Measures extra bits from using $Q$ to encode $P$ |
| Wasserstein distance | "Earth mover's distance" | Minimum work to transport mass from one distribution to another. A true metric |
| Approximate nearest neighbor | "ANN search" | Algorithms (HNSW, LSH, IVF) that find approximately closest points much faster than exact search |
| HNSW | "The vector DB algorithm" | Hierarchical Navigable Small World graph. Multi-layer graph for fast approximate nearest neighbor search |
| L1 regularization | "Lasso" | Adding the L1 norm of weights to the loss. Drives weights to zero (sparsity) |
| L2 regularization | "Ridge" or "weight decay" | Adding the squared L2 norm of weights to the loss. Shrinks weights toward zero without sparsity |
| Elastic Net | "L1 + L2" | Combines L1 and L2 regularization. Handles correlated feature groups better than either alone |

## Pour en savoir plus

- [FAISS: A Library for Efficient Similarity Search](https://github.com/facebookresearch/faiss)- La bibliothèque de Meta pour la recherche à l'échelle de milliards d'annes
- [Wasserstein GAN (Arjovsky et al., 2017)](https://arxiv.org/abs/1701.07875)- le papier qui a introduit la distance de la Terre Mover aux GAN
- [Locality-Sensitive Hashing (Indyk & Motwani, 1998)](https://dl.acm.org/doi/10.1145/276698.276876)- algorithme ANN fondamental
- [Efficient Estimation of Word Representations (Mikolov et al., 2013)](https://arxiv.org/abs/1301.3781)- Word2Vec, où la similitude cosine est devenue la norme par défaut pour les emblèmes
- [sklearn.neighbors documentation](https://scikit-learn.org/stable/modules/neighbors.html)- guide pratique des mesures de distance et des algorithmes de voisinage dans le scikit-learning
