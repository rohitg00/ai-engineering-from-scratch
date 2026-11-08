# Méthodes d'échantillonnage

> L'échantillonnage est la façon dont l'IA explore l'espace des possibilités.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1, Lessons 06-07 (Probability, Bayes' Theorem)
**Time:** ~120 minutes

## Objectifs d'apprentissage

- Implémenter à partir de zéro l'échantillonnage inverse de CDF, de rejet et d'importance en utilisant uniquement des nombres aléatoires uniformes
- Construire des échantillonnages de température, de top-k et de top-p (nucle) pour la génération de jetons de modèle de langage
- Expliquez la réparamétrisation et pourquoi elle permet la répartition par l'échantillonnage dans les VAE
- Exécuter le MCMC de Metropolis-Hastings pour échantillonner une distribution cible non normalisée

## Le problème

Un modèle de langage finit de traiter votre demande et produit un vecteur de 50 000 logits, un pour chaque jeton dans son vocabulaire.

Si elle choisit toujours le jeton de plus grande probabilité, chaque réponse est identique. Déterministique. ennuyeux. Si elle choisit uniformément au hasard, la sortie est grimaçante. La réponse vit quelque part entre ces extrêmes, et que quelque part est contrôlée par l'échantillonnage.

Le prélèvement d'échantillons ne se limite pas à la génération de texte. L'apprentissage par renforcement évalue les gradients de la politique en prenant des échantillons. Les VAE apprennent des représentations latentes en prélèvant des échantillons à partir de distributions apprises et en se propagant à travers le hasard. Les modèles de diffusion génèrent des images en prélèvant des échantillons de bruit et en dénonçant de manière itérative. Les méthodes de Monte Carlo estiment les intégrales qui n'ont pas de solution de forme fermée. Les algorithmes MCMC explorent des distributions postérieures de haute dimension qui sont impossibles à énumérer.

Chaque système génératif d'IA est un système d'échantillonnage. La stratégie d'échantillonnage détermine la qualité, la diversité et la contrôlabilité de la sortie. Cette leçon construit chaque méthode d'échantillonnage majeure à partir de zéro, à partir de nombres aléatoires uniformes et se terminant par les techniques qui alimentent les LLM modernes et les modèles génératifs.

## Le concept

### Pourquoi la prise d'échantillons est importante

L'échantillonnage apparaît dans quatre rôles fondamentaux dans l'IA et l'apprentissage automatique:

**Generation.**Les modèles linguistiques, les modèles de diffusion et les GAN produisent tous des résultats par échantillonnage. L'algorithme de prélèvement contrôle directement la créativité, la cohérence et la diversité.

**Training.**Les échantillons de dégradation du gradient stochastique sont des mini-parties. Les échantillons de décapage des neurones pour les désactiver. Les échantillons d'augmentation des données sont des transformations aléatoires.

**Estimation.**De nombreuses quantités dans ML n'ont pas de solution de forme fermée. La perte attendue sur une distribution de données, la fonction de partition d'un modèle basé sur l'énergie, les preuves de l'inférence bayésienne.

**Exploration.**Les algorithmes MCMC explorent les distributions postérieures dans l'inférence bayésienne.

Le défi principal: vous ne pouvez échantillonner directement que des distributions simples (uniforme, normale). Pour tout le reste, vous avez besoin d'une méthode pour convertir des échantillons simples en échantillons de votre distribution cible.

### Prise de l'échantillon aléatoire uniforme

Chaque méthode d'échantillonnage commence ici.$[0, 1)$où chaque sous-intervalle de même longueur a la même probabilité.

```
U ~ Uniform(0, 1)

P(a <= U <= b) = b - a    for 0 <= a <= b <= 1

Properties:
  E[U] = 0.5
  Var(U) = 1/12
```

Pour échantillonner uniformément à partir d' un ensemble discrète de $n$les articles, générer $U$et retourner .$\lfloor n U \rfloor$. Pour échantillonner à partir d' une plage continue $[a, b]$, calcul$a + (b - a) U$- Je suis désolé .

Le point de vue clé: un seul nombre aléatoire uniforme contient exactement la bonne quantité de chance pour produire un échantillon à partir d'une distribution.

### Métode de CDF inverse (échantillonnage en transformation inverse)

La fonction de distribution cumulée (CDF) trace les valeurs en probabilités:

```
F(x) = P(X <= x)

Properties:
  F is non-decreasing
  F(-inf) = 0
  F(+inf) = 1
  F maps the real line to [0, 1]
```

Le CDF inverse repère les probabilités à des valeurs.$U \sim \text{Uniform}(0, 1)$Alors ...$X = F^{-1}(U)$suit la distribution cible.

```
Algorithm:
  1. Generate u ~ Uniform(0, 1)
  2. Return F_inverse(u)

Why it works:
  P(X <= x) = P(F_inverse(U) <= x) = P(U <= F(x)) = F(x)
```

**Exponential distribution example:**

```
PDF: f(x) = lambda * exp(-lambda * x),   x >= 0
CDF: F(x) = 1 - exp(-lambda * x)

Solve F(x) = u for x:
  u = 1 - exp(-lambda * x)
  exp(-lambda * x) = 1 - u
  x = -ln(1 - u) / lambda

Since (1 - U) and U have the same distribution:
  x = -ln(u) / lambda
```

Ça marche parfaitement quand on peut écrire .$F^{-1}$Pour la distribution normale, il n'y a pas de CDF inverse de forme fermée, nous utilisons donc d'autres méthodes (Box-Muller, ou approximation numérique).

**Discrete version:**Pour les distributions discrètes, construire le CDF comme une somme cumulée, générer $U$, et trouver le premier indice où la somme cumulée dépasse $U$C' est comme ça .`sample_categorical`Les travaux de la leçon 06.

### Prélèvement d'échantillons de rejet

Lorsque vous ne pouvez pas inverser le CDF mais pouvez évaluer le PDF cible jusqu'à une constante, le prélèvement d'échantillons de rejet fonctionne.

```
Target distribution: p(x)  (can evaluate, possibly unnormalized)
Proposal distribution: q(x)  (can sample from)
Bound: M such that p(x) <= M * q(x) for all x

Algorithm:
  1. Sample x ~ q(x)
  2. Sample u ~ Uniform(0, 1)
  3. If u < p(x) / (M * q(x)), accept x
  4. Otherwise, reject and go to step 1

Acceptance rate = Z/M, where Z is the integral of p(x)
                (Z = 1, so the rate is 1/M, when p is normalized)
```

Plus la limite est serrée$M$Dans les dimensions faibles (1-3), le prélèvement d'échantillons de rejet fonctionne bien. Dans les dimensions élevées, le taux d'acceptation diminue de manière exponentielle parce que la plupart du volume de proposition est rejeté.

**Example: sampling from a truncated normal.**Utilisez une proposition uniforme sur la gamme tronquée.$M$est le maximum du PDF normal dans cette plage.

**Example: sampling from a semicircle.**Proposez uniformément dans le rectangle de bord. Acceptez si le point tombe à l'intérieur du demi-cercle. C'est ainsi que Monte Carlo calcule$\pi$: le taux d' acceptation est égal au ratio de superficie $\pi/4$- Je suis désolé .

### Prélèvement d'échantillons d'importance

Parfois, vous n'avez pas besoin d'échantillons de la distribution cible $p(x)$Vous devez estimer une attente de moins de$p(x)$, et vous avez des échantillons d' une autre distribution $q(x)$- Je suis désolé .

```
Goal: estimate E_p[f(x)] = integral of f(x) * p(x) dx

Rewrite:
  E_p[f(x)] = integral of f(x) * (p(x)/q(x)) * q(x) dx
            = E_q[f(x) * w(x)]

where w(x) = p(x) / q(x)  are the importance weights.

Estimator:
  E_p[f(x)] ~ (1/N) * sum(f(x_i) * w(x_i))    where x_i ~ q(x)
```

Dans le cadre de l'optimisation des politiques proximes, vous collectez des trajectoires dans le cadre d'une ancienne politique.$\pi_{\text{old}}$Mais ils veulent optimiser une nouvelle politique $\pi_{\text{new}}$Le poids est important.$\pi_{\text{new}}(a \mid s) / \pi_{\text{old}}(a \mid s)$La PPO réduit ces poids pour empêcher la nouvelle politique de trop se détourner de l'ancienne.

La variance de l'estimatrice d'importance de l'échantillonnage dépend de la similitude $q$est à $p$Si vous ...$q$est très différent de $p$L'échantillonnage d'importance auto-normalité est divisé par la somme des poids pour réduire ce problème:

```math
\mathbb{E}_p[f(x)] \approx \frac{\sum_i w_i \, f(x_i)}{\sum_i w_i}
```

### Évaluation de Monte Carlo

L'estimation de Monte Carlo approximate les intégrales en moyenne des échantillons aléatoires.

```
Goal: estimate I = integral of g(x) dx over domain D

Method:
  1. Sample x_1, ..., x_N uniformly from D
  2. I ~ (Volume of D / N) * sum(g(x_i))

Error: O(1 / sqrt(N))   regardless of dimension
```

Le taux d'erreur est indépendant des dimensions, c'est pourquoi les méthodes de Monte Carlo dominent dans les dimensions élevées où l'intégration basée sur le réseau est impossible.

**Estimating pi:**

```
Sample (x, y) uniformly from [-1, 1] x [-1, 1]
Count how many fall inside the unit circle: x^2 + y^2 <= 1
pi ~ 4 * (count inside) / (total count)
```

**Estimating expectations:**

```
E[f(X)] ~ (1/N) * sum(f(x_i))    where x_i ~ p(x)

The sample mean converges to the true expectation.
Variance of the estimator = Var(f(X)) / N
```

### Chaîne de Markov Monte Carlo (MCMC): Métropole-Hastings

MCMC construit une chaîne Markov dont la distribution fixe est la distribution cible $p(x)$Après des étapes suffisantes, les échantillons de la chaîne sont (environ) des échantillons de $p(x)$- Je suis désolé .

```
Target: p(x)  (known up to a normalizing constant)
Proposal: q(x'|x)  (how to propose the next state given the current state)

Metropolis-Hastings algorithm:
  1. Start at some x_0
  2. For t = 1, 2, ..., T:
     a. Propose x' ~ q(x'|x_t)
     b. Compute acceptance ratio:
        alpha = [p(x') * q(x_t|x')] / [p(x_t) * q(x'|x_t)]
     c. Accept with probability min(1, alpha):
        - If u < alpha (u ~ Uniform(0,1)): x_{t+1} = x'
        - Otherwise: x_{t+1} = x_t
  3. Discard first B samples (burn-in)
  4. Return remaining samples
```

Pour les propositions symétriques $(q(x' \mid x) = q(x \mid x'))$, le ratio est simplifié à $p(x')/p(x)$C'est l'algorithme original de Metropolis.

**Why it works.**La règle d'acceptation garantit un équilibre détaillé: la probabilité d'être à $x$et de se déplacer à $x'$est égale à la probabilité d' être à $x'$et de se déplacer à $x$Un équilibre détaillé implique que$p(x)$est la distribution stationnaire de la chaîne.

**Practical considerations:**
- Brûlure: rejeter les premiers échantillons avant que la chaîne n'atteigne l'équilibre
- Éclairage: conservez tous les$k$-th échantillon pour réduire l'autocorrélation
- Équelles: trop petites et la chaîne se déplace lentement (accueil élevé, exploration lente); trop grandes et la plupart des propositions sont rejetées (accueil faible, collée à leur place)
- Le taux d'acceptation optimal pour une proposition gaussienne de grande dimension est d'environ 0,234

### Prise d'échantillons de Gibbs

Le prélèvement d'échantillons de Gibbs est un cas spécial du MCMC pour les distributions multivariées. Au lieu de proposer un mouvement dans toutes les dimensions à la fois, il met à jour une variable à la fois à partir de sa distribution conditionnelle.

```
Target: p(x_1, x_2, ..., x_d)

Algorithm:
  For each iteration t:
    Sample x_1^{t+1} ~ p(x_1 | x_2^t, x_3^t, ..., x_d^t)
    Sample x_2^{t+1} ~ p(x_2 | x_1^{t+1}, x_3^t, ..., x_d^t)
    ...
    Sample x_d^{t+1} ~ p(x_d | x_1^{t+1}, x_2^{t+1}, ..., x_{d-1}^{t+1})
```

L' échantillonnage de Gibbs exige que vous puissiez échantillonner à partir de chaque distribution conditionnelle .$p(x_i \mid x_{-i})$C' est simple pour beaucoup de modèles:
- Réseaux bayésiens: les conditionnels suivent la structure du graphique
- Les mélanges gaussiens: les conditionnels sont gaussiens
- Modèles d'isage: la condition de chaque tour dépend uniquement de ses voisins

Le taux d'acceptation est toujours de 1 (toute proposition est acceptée) car l'échantillonnage à partir de la condition exacte satisfait automatiquement l'équilibre détaillé.

**Limitation.**Lorsque les variables sont fortement corrélées, le prélèvement d'échantillons de Gibbs se mélange lentement parce que la mise à jour d'une variable à la fois ne peut pas faire de grands mouvements diagonales à travers la distribution.

### Prise d'échantillons à température (utilisés dans les LLM)

Modèles de langue logits de sortie $z_1, \ldots, z_V$Softmax les convertit en probabilités.

```
p_i = exp(z_i / T) / sum(exp(z_j / T))

T = 1.0: standard softmax (original distribution)
T -> 0:  argmax (deterministic, always picks highest logit)
T -> inf: uniform (all tokens equally likely)
T < 1.0: sharpens the distribution (more confident, less diverse)
T > 1.0: flattens the distribution (less confident, more diverse)
```

**Why it works.**Divisez les logits par $T < 1$Les différences entre les logites sont amplifiées.$z_1 = 2$et $z_2 = 1$, divisé par $T = 0.5$donne$z_1/T = 4$et $z_2/T = 2$Après Softmax, le jeton logite le plus élevé obtient une part beaucoup plus importante.

**In practice:**
- $T = 0.0$: décoding avide, le meilleur pour des questions et réponses factuelles
- $T = 0.3\text{-}0.7$: légèrement créatif, bon pour la génération de code
- $T = 0.7\text{-}1.0$: équilibré, bon pour une conversation générale
- $T = 1.0\text{-}1.5$: écriture créative, brainstorming
- $T > 1.5$: de plus en plus aléatoire, rarement utile

La température ne change pas les jetons possibles, elle change la masse de probabilité allouée à chaque jeton.

### Prise d'échantillons

Le prélèvement d'échantillons de haut niveau limite le candidat à l' ensemble $k$les jetons avec les probabilités les plus élevées, puis renormalizes et échantillons de cet ensemble restreint.

```
Algorithm:
  1. Compute softmax probabilities for all V tokens
  2. Sort tokens by probability (descending)
  3. Keep only the top k tokens
  4. Renormalize: p_i' = p_i / sum(p_j for j in top-k)
  5. Sample from the renormalized distribution

k = 1:  greedy decoding
k = V:  no filtering (standard sampling)
k = 40: typical setting, removes long tail of unlikely tokens
```

Top-k empêche le modèle de sélectionner des jetons extrêmement improbables (typos, nonsense) qui existent dans la longue queue de la distribution du vocabulaire.$k$Le modèle est sûr (un jeton a 95% de probabilité), $k = 40$La probabilité est répartie sur 1000 jetons, alors que le modèle est incertain.$k = 40$Il ne peut pas y avoir de possibilités plausibles.

### Prélèvement d'échantillons de haut niveau (nucleus)

Le prélèvement d'échantillons top-p ajuste dynamiquement la taille du jeu de candidats. Au lieu de conserver un nombre fixe de jetons, il conserve le plus petit ensemble de jetons dont la probabilité cumulée dépasse $p$- Je suis désolé .

```
Algorithm:
  1. Compute softmax probabilities for all V tokens
  2. Sort tokens by probability (descending)
  3. Find smallest k such that sum of top-k probabilities >= p
  4. Keep only those k tokens
  5. Renormalize and sample

p = 0.9:  keeps tokens covering 90% of probability mass
p = 1.0:  no filtering
p = 0.1:  very restrictive, nearly greedy
```

Lorsque le modèle est sûr, le prélèvement de noyau conserve peu de jetons (peut-être 2-3). Lorsque le modèle est incertain, il conserve beaucoup (peut-être 200). Ce comportement adaptatif est la raison pour laquelle le prélèvement de noyau produit généralement un meilleur texte que le top-k.

**Common combinations:**
- Température 0,7 + p-supérieur 0,9: bonne réglage général
- Température 0,0 (avid): optimale pour les tâches déterministes
- Température 1.0 + top-k 50: Fan et al. (2018) réglage original du papier

On peut combiner le top-k et le top-p. Appliquez le top-k d'abord, puis le top-p sur le reste du jeu.

### Triche de réparamétrisation (utilisée dans les VAE)

Les autoencoders variatifs (VAE) apprennent en encodant les entrées dans une distribution dans un espace latent, en prélèvant des échantillons à partir de cette distribution et en décodant l'échantillon.

```
Standard sampling (not differentiable):
  z ~ N(mu, sigma^2)

  The randomness blocks gradient flow.
  d/d_mu [sample from N(mu, sigma^2)] = ???
```

Le truc de réparamétrisation sépare la randomisation des paramètres:

```
Reparameterized sampling:
  epsilon ~ N(0, 1)          (fixed random noise, no parameters)
  z = mu + sigma * epsilon   (deterministic function of parameters)

  Now z is a deterministic, differentiable function of mu and sigma.
  d(z)/d(mu) = 1
  d(z)/d(sigma) = epsilon

  Gradients flow through mu and sigma.
```

Ça marche parce que$\mathcal{N}(\mu, \sigma^2)$a la même répartition que $\mu + \sigma \cdot \mathcal{N}(0, 1)$. L'idée clé: déplacer le cas échéant vers une source sans paramètres ($\epsilon$), puis exprimer l'échantillon comme une transformation différenciable des paramètres.

**In the VAE training loop:**
1. Sorties de codeur $\mu$et $\log(\sigma^2)$pour chaque entrée
2. Pratique $\epsilon \sim \mathcal{N}(0, 1)$
3. Compte $z = \mu + \sigma \epsilon$
4. Décodez$z$pour reconstruire l'entrée
5. Propagation en arrière à travers les étapes 4, 3, 2, 1 (possible car l'étape 3 est différenciable)

Sans le truc de réparamétrisation, les VAE ne peuvent pas être formés avec la répartition standard.

### Gumbel-Softmax (échantillonnage catégorique différenciable)

La réparamétrisation fonctionne pour les distributions continues (Gaussian). Pour les distributions catégoriques discrètes, nous avons besoin d'une approche différente.

**The Gumbel-Max trick (non-differentiable):**

```
To sample from a categorical distribution with log-probabilities log(p_1), ..., log(p_k):
  1. Sample g_i ~ Gumbel(0, 1) for each category
     (g = -log(-log(u)), where u ~ Uniform(0, 1))
  2. Return argmax(log(p_i) + g_i)

This produces exact categorical samples.
```

**Gumbel-Softmax (differentiable approximation):**

```
Replace the hard argmax with a soft softmax:
  y_i = exp((log(p_i) + g_i) / tau) / sum(exp((log(p_j) + g_j) / tau))

tau (temperature) controls the approximation:
  tau -> 0:  approaches a one-hot vector (hard categorical)
  tau -> inf: approaches uniform (1/k, 1/k, ..., 1/k)
  tau = 1.0: soft approximation
```

Gumbel-Softmax produit une relaxation continue d'un échantillon discret. La sortie est un vecteur de probabilité (mous one-hot) au lieu d'un hard one-hot. Les gradients circulent à travers le softmax.

**Applications:**
- Variables latentes discrètes dans les VAE
- Recherche d'architecture neuronale (choisir des opérations discrètes)
- Mécanismes d'attention dure
- Apprentissage renforcé par des actions discrètes

### Pratification stratifiée

L'échantillonnage standard de Monte Carlo peut laisser des lacunes dans l'espace de l'échantillon par hasard.

```
Standard Monte Carlo:
  Sample N points uniformly from [0, 1]
  Some regions may have clusters, others gaps

Stratified sampling:
  Divide [0, 1] into N equal strata: [0, 1/N), [1/N, 2/N), ..., [(N-1)/N, 1)
  Sample one point uniformly within each stratum
  x_i = (i + u_i) / N   where u_i ~ Uniform(0, 1),  i = 0, ..., N-1
```

L'échantillonnage stratifié a toujours une variance inférieure ou égale par rapport à la variation standard Monte Carlo:

```
Var(stratified) <= Var(standard Monte Carlo)

The improvement is largest when f(x) varies smoothly.
For piecewise-constant functions, stratified sampling is exact.
```

**Applications:**
- Intégration numérique (quasi-Monte Carlo)
- Divisions de données de formation (assurance de l'équilibre des classes dans chaque pliage)
- Prélèvement d'importance avec stratification (combinant les deux techniques)
- NeRF (Neural Radiance Fields) utilise des échantillonnages stratifiés le long des rayons de caméra

### Connexion aux modèles de diffusion

Les modèles de diffusion génèrent des images par un processus d'échantillonnage.$T$Le processus inverse apprend à dénoncer, en récupérant l'image d'origine étape par étape.

```
Forward process (known):
  x_t = sqrt(alpha_t) * x_{t-1} + sqrt(1 - alpha_t) * epsilon
  where epsilon ~ N(0, I)

  After T steps: x_T ~ N(0, I)  (pure noise)

Reverse process (learned):
  x_{t-1} = (1/sqrt(alpha_t)) * (x_t - (1 - alpha_t)/sqrt(1 - alpha_bar_t) * epsilon_theta(x_t, t)) + sigma_t * z
  where z ~ N(0, I)

  Each denoising step is a sampling step.
```

Le lien avec les méthodes de cette leçon:
- Chaque étape dénonciatrice utilise le procédé de réparamétrisation (bruit d'échantillon, transformation déterministe appliquée)
- Le calendrier du bruit $\lbrace \alpha_t \rbrace$contrôle une forme d'anneillage à température
- La formation utilise l'estimation de Monte Carlo pour approximer l'ELBO (la limite inférieure des preuves)
- L'échantillonnage ancestral dans les modèles de diffusion est une chaîne de Markov (chaque étape dépend uniquement de l'état actuel)

L'ensemble du processus de génération d'images est un échantillonnage itératif: commencez par le bruit et à chaque étape, prenez un échantillon d'une version légèrement moins bruyante, conditionnée sur le modèle de dénosage appris.

```figure
monte-carlo-pi
```

## Faites-le

### Étape 1: Prise d'échantillons CDF uniforme et inverse

```python
import math
import random

def sample_uniform(a, b):
    return a + (b - a) * random.random()

def sample_exponential_inverse_cdf(lam):
    u = random.random()
    return -math.log(u) / lam
```

Générer 10 000 échantillons exponentiels et vérifier la moyenne est $1/\lambda$- Je suis désolé .

### Étape 2: Prélèvement d'échantillons de rejet

```python
def rejection_sample(target_pdf, proposal_sample, proposal_pdf, M):
    while True:
        x = proposal_sample()
        u = random.random()
        if u < target_pdf(x) / (M * proposal_pdf(x)):
            return x
```

Utilisez l'échantillonnage de rejet pour tirer d'une distribution normale tronquée.

### Étape 3: Prélèvement d'importance

```python
def importance_sampling_estimate(f, target_pdf, proposal_pdf, proposal_sample, n):
    total = 0
    for _ in range(n):
        x = proposal_sample()
        w = target_pdf(x) / proposal_pdf(x)
        total += f(x) * w
    return total / n
```

On estime que$\mathbb{E}[X^2]$La répartition normale de la demande est basée sur une proposition uniforme.$\mu^2 + \sigma^2$)

### Étape 4: Estimation de Monte Carlo de pi

```python
def monte_carlo_pi(n):
    inside = 0
    for _ in range(n):
        x = random.uniform(-1, 1)
        y = random.uniform(-1, 1)
        if x*x + y*y <= 1:
            inside += 1
    return 4 * inside / n
```

### Étape 5: MCMC de la région de Metropolis-Hastings

```python
def metropolis_hastings(target_log_pdf, proposal_sample, proposal_log_pdf, x0, n_samples, burn_in):
    samples = []
    x = x0
    for i in range(n_samples + burn_in):
        x_new = proposal_sample(x)
        log_alpha = (target_log_pdf(x_new) + proposal_log_pdf(x, x_new)
                     - target_log_pdf(x) - proposal_log_pdf(x_new, x))
        if math.log(random.random()) < log_alpha:
            x = x_new
        if i >= burn_in:
            samples.append(x)
    return samples
```

Prenons un échantillon de la distribution bimodal (mixture de deux Gaussiens).

### Étape 6: Prise d'échantillons par Gibbs

```python
def gibbs_sampling_2d(conditional_x_given_y, conditional_y_given_x, x0, y0, n_samples, burn_in):
    x, y = x0, y0
    samples = []
    for i in range(n_samples + burn_in):
        x = conditional_x_given_y(y)
        y = conditional_y_given_x(x)
        if i >= burn_in:
            samples.append((x, y))
    return samples
```

### Étape 7: Prise d'échantillons à température

```python
def softmax(logits):
    max_l = max(logits)
    exps = [math.exp(z - max_l) for z in logits]
    total = sum(exps)
    return [e / total for e in exps]

def temperature_sample(logits, temperature):
    scaled = [z / temperature for z in logits]
    probs = softmax(scaled)
    return sample_from_probs(probs)
```

Montrez comment la température modifie la distribution de sortie pour un ensemble de logits de jetons.

### Étape 8: Prise d'échantillons en haut et en haut

```python
def top_k_sample(logits, k):
    indexed = sorted(enumerate(logits), key=lambda x: -x[1])
    top = indexed[:k]
    top_logits = [l for _, l in top]
    probs = softmax(top_logits)
    idx = sample_from_probs(probs)
    return top[idx][0]

def top_p_sample(logits, p):
    probs = softmax(logits)
    indexed = sorted(enumerate(probs), key=lambda x: -x[1])
    cumsum = 0
    selected = []
    for token_idx, prob in indexed:
        cumsum += prob
        selected.append((token_idx, prob))
        if cumsum >= p:
            break
    sel_probs = [pr for _, pr in selected]
    total = sum(sel_probs)
    sel_probs = [pr / total for pr in sel_probs]
    idx = sample_from_probs(sel_probs)
    return selected[idx][0]
```

### Étape 9: Réglage de réparamétrisation

```python
def reparam_sample(mu, sigma):
    epsilon = random.gauss(0, 1)
    return mu + sigma * epsilon

def reparam_gradient(mu, sigma, epsilon):
    dz_dmu = 1.0
    dz_dsigma = epsilon
    return dz_dmu, dz_dsigma
```

Démontre que les gradients circulent à travers l'échantillon réparamétrié mais pas par échantillonnage direct.

### Étape 10: Gumbel-Softmax

```python
def gumbel_sample():
    u = random.random()
    return -math.log(-math.log(u))

def gumbel_softmax(logits, temperature):
    gumbels = [math.log(p) + gumbel_sample() for p in logits]
    return softmax([g / temperature for g in gumbels])
```

Montrez comment la baisse de la température fait approcher le vecteur de sortie d'un vecteur à chaud.

Des mises en œuvre complètes avec toutes les visualisations sont en `code/sampling.py`- Je suis désolé .

Le port TypeScript est activé `code/sampling.ts`Il utilise son propre générateur aléatoire semé, donc ses nombres aléatoires diffèrent de la sortie Python.

## Utilisez-le

Avec NumPy et SciPy, les versions de production:

```python
import numpy as np

rng = np.random.default_rng(42)

exponential_samples = rng.exponential(scale=2.0, size=10000)
print(f"Exponential mean: {exponential_samples.mean():.4f} (expected 2.0)")

from scipy import stats
normal = stats.norm(loc=0, scale=1)
print(f"CDF at 1.96: {normal.cdf(1.96):.4f}")
print(f"Inverse CDF at 0.975: {normal.ppf(0.975):.4f}")

logits = np.array([2.0, 1.0, 0.5, 0.1, -1.0])
temperature = 0.7
scaled = logits / temperature
probs = np.exp(scaled - scaled.max()) / np.exp(scaled - scaled.max()).sum()
token = rng.choice(len(logits), p=probs)
print(f"Sampled token index: {token}")
```

Pour les MCMC à grande échelle, utilisez des bibliothèques dédiées:
- PyMC: modélisation bayésienne complète avec NUTS (HMC adaptatif)
- émetteur: échantillonneur MCMC ensemble
- NumPyro/JAX: MCMC accéléré par GPU

Vous avez construit ça à partir de zéro, maintenant vous savez ce que font les appels de la bibliothèque.

## Exercices

1. Implémenter l'échantillonnage inverse des CDF pour la distribution de Cauchy.$F(x) = 0.5 + \arctan(x)/\pi$. Générer 10 000 échantillons et tracer l'histogramme contre le vrai PDF. Notez les queues lourdes (valeurs extrêmes loin du centre).

2. Utilisez l'échantillonnage de rejet pour générer des échantillons à partir d'une distribution Beta(2, 5) en utilisant une proposition Uniform(0, 1). Tracer les échantillons acceptés contre le vrai Beta PDF. Quel est le taux d'acceptation théorique?

3. Évaluer l'intégralité de $\sin(x)$de 0 à $\pi$Vous pouvez comparer l'erreur à chaque niveau.$O(1/\sqrt{N})$- Je suis désolé .

4. Mettre en œuvre Metropolis-Hastings pour échantillonner à partir d' une distribution 2D $p(x, y)$proportionnel à $\exp(-(x^2 y^2 + x^2 + y^2 - 8x - 8y) / 2)$- Tracer les échantillons et la trajectoire de la chaîne.

5. Construisez une démo de génération de texte complète: compte tenu d'un vocabulaire de 10 mots avec logits, générez des séquences de 20 jetons en utilisant (a) avide, (b) température = 0,7, (c) top-k = 3, (d) top-p = 0,9.

### Des indices

**Exercise 1.**Résous $u = F(x)$pour $x$, ce qui donne$x = \tan(\pi(u - 0.5))$Vérifiez que la médiane de l'échantillon est proche de 0 et que 6% environ des échantillons ont$\lvert x \rvert > 10$, qui est $1 - (2/\pi)\arctan(10)$- Je suis désolé .

**Exercise 2.**La densité de la bêta (2, 5) est $30x(1-x)^4$Trouvez sa valeur la plus élevée en mode $x = 1/5$et utiliser cette valeur comme $M$dans `rejection_sample`Le taux d' acceptation théorique est $1/M$, alors comparez-le avec la fraction de propositions que vous acceptez.

**Exercise 3.**La valeur exacte est 2. Appelez `monte_carlo_integral(math.sin, 0, math.pi, n)`pour chacun $n$et répétez chaque course avec plusieurs graines.$n$s'il augmente de 10 fois, l'erreur moyenne devrait diminuer d'environ $\sqrt{10} \approx 3.2$- Je suis désolé .

**Exercise 4.**Écrivez le journal de la cible, qui est $-(x^2 y^2 + x^2 + y^2 - 8x - 8y)/2$, et le transmettre à `metropolis_hastings_2d`- enregistrer le taux d'acceptation pour chaque proposition d'écart standard: une valeur très petite accepte presque chaque étape mais se déplace lentement, et une valeur très grande rejette presque chaque étape.

**Exercise 5.**Le décoding avide prend l'indice de la plus grande logite à chaque étape.`temperature_sample`- Je suis là .`top_k_sample`, et `top_p_sample`La suite doit être la même dans les 5 tours, alors comptez les séquences distinctes pour chaque méthode pour mesurer la diversité.

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| Sampling | "Drawing random values" | Generating values according to a probability distribution. The mechanism behind all generative AI |
| Uniform distribution | "All equally likely" | Every value in $[a, b]$ has equal probability density $1/(b-a)$. The starting point for all sampling methods |
| Inverse CDF | "Probability transform" | $F^{-1}(U)$ converts a uniform sample into a sample from any distribution with known CDF. Exact and efficient |
| Rejection sampling | "Propose and accept/reject" | Generate from a simple proposal, accept with probability proportional to target/proposal ratio. Exact but wastes samples |
| Importance sampling | "Reweight samples" | Estimate expectations under $p(x)$ using samples from $q(x)$ by weighting each sample by $p(x)/q(x)$. Core to PPO in RL |
| Monte Carlo | "Average random samples" | Approximate integrals as sample averages. Error $O(1/\sqrt{N})$ regardless of dimension |
| MCMC | "Random walk that converges" | Construct a Markov chain whose stationary distribution is the target. Metropolis-Hastings is the foundational algorithm |
| Metropolis-Hastings | "Accept uphill, sometimes downhill" | Propose moves, accept based on density ratio. Detailed balance ensures convergence to target distribution |
| Gibbs sampling | "One variable at a time" | Update each variable from its conditional distribution holding others fixed. 100% acceptance rate |
| Temperature | "Confidence knob" | Divides logits by $T$ before softmax. $T<1$ sharpens (more confident), $T>1$ flattens (more diverse) |
| Top-k sampling | "Keep the k best" | Zero out all but the $k$ highest-probability tokens, renormalize, sample. Fixed candidate set size |
| Nucleus sampling (top-p) | "Keep the probable ones" | Keep the smallest set of tokens whose cumulative probability exceeds $p$. Adaptive candidate set size |
| Reparameterization trick | "Move randomness outside" | Write $z = \mu + \sigma \epsilon$ where $\epsilon \sim \mathcal{N}(0,1)$. Makes sampling differentiable. Essential for VAE training |
| Gumbel-Softmax | "Soft categorical sampling" | Differentiable approximation to categorical sampling using Gumbel noise + softmax with temperature |
| Stratified sampling | "Forced coverage" | Divide sample space into strata, sample from each. Always lower variance than naive Monte Carlo |
| Burn-in | "Warm-up period" | Initial MCMC samples discarded before the chain reaches its stationary distribution |
| Detailed balance | "Reversibility condition" | $p(x) T(x \to y) = p(y) T(y \to x)$. Sufficient condition for $p$ to be the stationary distribution of a Markov chain |
| Diffusion sampling | "Iterative denoising" | Generate data by starting from noise and applying learned denoising steps. Each step is a conditional sampling operation |

## Pour en savoir plus

- [Holbrook (2023): The Metropolis-Hastings Algorithm](https://arxiv.org/abs/2304.07010)- un tutoriel détaillé sur les fondations du MCMC
- [Jang, Gu, Poole (2017): Categorical Reparameterization with Gumbel-Softmax](https://arxiv.org/abs/1611.01144)- papier original Gumbel-Softmax
- [Holtzman et al. (2020): The Curious Case of Neural Text Degeneration](https://arxiv.org/abs/1904.09751)- papier d'échantillonnage de noyau (top-p)
- [Kingma & Welling (2014): Auto-Encoding Variational Bayes](https://arxiv.org/abs/1312.6114)- Le papier VAE introduisant le truc de réparamétrisation
- [Ho, Jain, Abbeel (2020): Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2006.11239)- Le DDPM relie l'échantillonnage à la génération d'images
