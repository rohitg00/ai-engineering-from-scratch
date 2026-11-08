# Stabilité numérique

> Le point flottant est une abstraction fuyant.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1, Lessons 01-04
**Time:** ~120 minutes

## Objectifs d'apprentissage

- Implémenter le softmax et le log-sum-exp stables numériquement en utilisant le truc de soustraction max
- Identifier les débordements, les débordements et les annulations catastrophiques dans les calculs des points flottants
- Vérifiez les gradients analytiques contre les gradients numériques en utilisant des différences finites centrées
- Expliquez pourquoi bfloat16 est préféré à float16 pour l'entraînement et comment l'évolutivité des pertes empêche le sous-flux de la gradiente

## Le problème

Vous ajoutez une déclaration d'impression. les logits sont bons à l'étape 9,000. à l'étape 9,001 ils sont`inf`Par étape 9,002 chaque gradient est`nan`et l'entraînement est mort.

Ou: votre modèle est prêt à être terminé mais la précision est 2% pire que les revendications du papier. Vous vérifiez tout. L'architecture correspond. Les hyperparametres correspondent. Les données correspondent. Le problème est que le papier a utilisé float32 et que vous avez utilisé float16 sans l'échelle correcte.

Ou: vous mettez en œuvre la perte de l'entropie croisée à partir de zéro. Cela fonctionne sur de petits logits. Lorsque les logits dépassent 100, il revient`inf`Le softmax a débordé parce que`exp(100)`Tout système de gestion de la machine à écrire traite cela avec un truc à deux lignes.

La stabilité numérique n'est pas une préoccupation théorique. C'est la différence entre une course d'entraînement qui réussit et une course qui échoue silencieusement.

## Le concept

### IEEE 754: Comment les ordinateurs stockent les nombres réels

Les ordinateurs stockent les nombres réels en tant que valeurs de point flottant selon la norme IEEE 754.

```
Float32 layout (32 bits total):
[1 sign] [8 exponent] [23 mantissa]

Value = (-1)^sign * 2^(exponent - 127) * 1.mantissa
```

La mantissa détermine la précision (combien de chiffres significatifs).

```
Format     Bits   Exponent  Mantissa  Decimal digits  Range (approx)
float64    64     11        52        ~15-16          +/- 1.8e308
float32    32     8         23        ~7-8            +/- 3.4e38
float16    16     5         10        ~3-4            +/- 65,504
bfloat16   16     8         7         ~2-3            +/- 3.4e38
```

float32 vous donne environ 7 chiffres décimaux de précision. Cela signifie qu'il peut distinguer entre 1.0000001 et 1.0000002, mais pas entre 1.00000001 et 1.00000002.

Le nombre le plus grand qu'il puisse représenter est de 65.504. C'est inquiétant pour ML où les logits, les gradients et les activations dépassent régulièrement ce nombre.

bfloat16 est la réponse de Google au problème de portée de float16. Il a le même exponent de 8 bits que float32 (même portée, jusqu'à 3,4e38) mais seulement 7 bits mantissa (moins de précision que float16). Pour l'entraînement des réseaux neuronaux, la portée compte plus que la précision, de sorte que bfloat16 gagne généralement.

### Pourquoi 0,1 + 0,2 ! = 0,3

Le nombre 0.1 ne peut pas être représenté exactement dans un point flottant binaire.

```
0.1 in binary = 0.0001100110011001100110011... (repeating forever)
```

Float32 réduit cette somme à 23 bits de mantissa. La valeur stockée est d'environ 0,100000001490116. De même, 0,2 est stockée comme environ 0,200000002980232.

```
In Python:
>>> 0.1 + 0.2
0.30000000000000004

>>> 0.1 + 0.2 == 0.3
False
```

Cela importe pour ML parce que:

1. Les comparaisons de pertes comme `if loss < threshold`peut donner de mauvaises réponses
2. L'accumulation de nombreuses petites valeurs (actualisations graduelles sur des milliers d'étapes) dérive de la somme réelle
3. Les tests de vérification et de reproductibilité échouent si vous comparez les floats avec `==`

La solution: ne comparez jamais les flottants avec `==`- Utilisez`abs(a - b) < epsilon`ou `math.isclose()`- Je suis désolé .

### L'annulation catastrophique

Lorsque vous soustraisez deux nombres de points flottants presque égaux, les chiffres significatifs s'annulent et vous êtes laissé avec le bruit arrondissant promu à des chiffres de premier plan.

```
a = 1.0000001    (stored as 1.00000011920929 in float32)
b = 1.0000000    (stored as 1.00000000000000 in float32)

True difference:  0.0000001
Computed:         0.00000011920929

Relative error: 19.2%
```

C'est une erreur relative de 19% d'une seule soustraction.

- Compute la variance des données avec une moyenne élevée: $\mathbb{E}[x^2] - \mathbb{E}[x]^2$quand ?$\mathbb{E}[x]$est grand
- Soustraire des probabilités de logement presque égales
- Compute les gradients de différence finie avec un epsilon trop petit

La solution: réorganiser les formules pour éviter de soustraire de grands nombres presque égaux. Pour la variance, utilisez l'algorithme Welford ou centrez les données en premier. Pour les probabilités de journaux, travaillez dans l'espace de journaux tout au long.

### Surflux et sousflux

Le surcoulant se produit lorsqu'un résultat est trop grand pour être représenté.

```
Float32 boundaries:
  Maximum:  3.4028235e+38
  Minimum positive (normal): 1.175e-38
  Minimum positive (denorm): 1.401e-45
  Overflow:  anything > 3.4e38 becomes inf
  Underflow: anything < 1.4e-45 becomes 0.0
```

Le `exp()`la fonction est la source principale de débordement dans le ML:

```
exp(88.7)  = 3.40e+38   (barely fits in float32)
exp(89.0)  = inf         (overflow)
exp(-87.3) = 1.18e-38   (barely above underflow)
exp(-104)  = 0.0         (underflow to zero)
```

Le `log()`La fonction se dirige dans l'autre sens:

```
log(0.0)   = -inf
log(-1.0)  = nan
log(1e-45) = -103.3      (fine)
log(1e-46) = -inf        (input underflowed to 0, then log(0) = -inf)
```

En ML, `exp()`apparaît dans les calculs softmax, sigmoid et probabilité. `log()`La combinaison de ces deux phénomènes est la différence entre les deux phénomènes.`log(exp(x))`C'est un champ de mines sans les bonnes astuces.

### Le truc du log-sum-exp

L' informatique `log(sum(exp(x_i)))`Le risque est numériquement élevé.`x_i`est grande,`exp(x_i)`- Si tout le monde...`x_i`sont très négatifs, chaque`exp(x_i)`débits à zéro et `log(0)`est `-inf`- Je suis désolé .

Le truc: soustraire la valeur maximale avant d'exposer.

```math
\log\left(\sum_i \exp(x_i)\right) = \max(x) + \log\left(\sum_i \exp(x_i - \max(x))\right)
```

Pourquoi cela fonctionne-t-il: après soustraction `max(x)`, le plus grand exponent est `exp(0) = 1`- Aucun débordement n'est possible. Au moins un terme de la somme est 1, donc la somme est au moins 1, et`log(1) = 0`- Pas de sous-couleurs .`-inf`C'est possible.

La preuve:

```math
\begin{aligned}
& \log\left(\sum_i \exp(x_i)\right) \\
&= \log\left(\sum_i \exp(x_i - c + c)\right) && \text{(add and subtract } c\text{)} \\
&= \log\left(\sum_i \exp(x_i - c) \cdot \exp(c)\right) && (\exp(a+b) = \exp(a) \cdot \exp(b)) \\
&= \log\left(\exp(c) \cdot \sum_i \exp(x_i - c)\right) && \text{(factor out } \exp(c)\text{)} \\
&= c + \log\left(\sum_i \exp(x_i - c)\right) && (\log(a \cdot b) = \log(a) + \log(b))
\end{aligned}
```

Réglage `c = max(x)`et le débordement est éliminé.

Ce truc apparaît partout dans ML:
- Normalité de la douceur maximale
- Compteur de perte de l'entropie croisée
- Summation de la probabilité de logement dans les modèles de séquences
- mélange de Gaussiens
- Inference variante

### Pourquoi Softmax a besoin du truc de soustraction max

Softmax convertit les logits en probabilités:

```math
\mathop{\mathrm{softmax}}(x_i) = \frac{\exp(x_i)}{\sum_j \exp(x_j)}
```

Sans le truc, les logits de [100, 101, 102] provoquent un débordement:

```
exp(100) = 2.69e43
exp(101) = 7.31e43
exp(102) = 1.99e44
sum      = 2.99e44

2.69e43 > 3.4e38, the float32 maximum, so every term overflows.
exp(88.7) is already at the float32 limit.
exp(100) = inf in float32.
```

Avec le truc, soustraire max ((x) = 102:

```
exp(100 - 102) = exp(-2) = 0.135
exp(101 - 102) = exp(-1) = 0.368
exp(102 - 102) = exp(0)  = 1.000
sum = 1.503

softmax = [0.090, 0.245, 0.665]
```

Les probabilités sont identiques, le calcul est sûr, ce n'est pas une optimisation, c'est une exigence de précision.

### NaN et Inf: détection et prévention

`nan`(Pas un nombre) et `inf`(infini) se propage viralement par le calcul.`nan`dans une mise à jour de gradient fait le poids `nan`, qui produit toutes les sorties ultérieures `nan`L'entraînement est mort en une seule étape.

Comment ?`inf`apparaît:
- `exp()`d'un nombre positif important
- Divise par zéro: `1.0 / 0.0`
- `float32`débordement des accumulations

Comment ?`nan`apparaît:
- `0.0 / 0.0`
- `inf - inf`
- `inf * 0`
- `sqrt()`d'un nombre négatif
- `log()`d'un nombre négatif
- Toute arithmétique impliquant une`nan`

Détection:

```python
import math

math.isnan(x)       # True if x is nan
math.isinf(x)       # True if x is +inf or -inf
math.isfinite(x)    # True if x is neither nan nor inf
```

Stratégies de prévention:

1. Les entrées de pinces à `exp()`Le numéro de la liste:`exp(clamp(x, -80, 80))`
2. Ajouter l' epsilon aux dénominateurs: `x / (y + 1e-8)`
3. Ajoutez de l' epsilon à l' intérieur `log()`Le numéro de la liste:`log(x + 1e-8)`
4. Utiliser des implémentations stables (log-sum-exp, softmax stable)
5. Coupe de grille pour éviter une explosion de poids
6. Vérifiez pour `nan`- Je suis là.`inf`après chaque passage avant lors du débogage

### Vérifie des gradations numériques

Les gradients analytiques (de la propagation en arrière) peuvent avoir des bugs.

La formule de différence centrée:

```math
\frac{df}{dx} \approx \frac{f(x + h) - f(x - h)}{2h}
```

C' est ça .$O(h^2)$C'est bien plus précis que la différence avant.$(f(x+h) - f(x)) / h$Ce qui est seulement $O(h)$- Je suis désolé .

Le choix$h$L'annulation trop petite et catastrophique détruit la réponse. `h = 1e-5`à `1e-7`C'est typique.

Le contrôle: calculer la différence relative entre les gradients analytiques et numériques.

```math
\text{relative\_error} = \frac{\lvert \text{grad}_{\text{analytical}} - \text{grad}_{\text{numerical}} \rvert}{\max(\lvert \text{grad}_{\text{analytical}} \rvert, \lvert \text{grad}_{\text{numerical}} \rvert, 10^{-8})}
```

Règles générales:
- relative_error < 1e-7: parfait, le gradient est correct
- relative_error < 1e-5: acceptable, probablement correcte
- relative_error > 1e-3: quelque chose ne va pas
- relative_error > 1: le gradient est complètement erroné

Vérifiez toujours les gradients lors de la mise en œuvre d'une nouvelle fonction de couche ou de perte. PyTorch fournit `torch.autograd.gradcheck()`Pour ça.

### Formation à la précision mixte

Les GPU modernes disposent d'un matériel spécialisé (Cores Tensor) qui compute les multiplications de matrice float16 2 à 8 fois plus rapidement que float32.

```
1. Maintain float32 master copy of weights
2. Forward pass in float16 (fast)
3. Compute loss in float32 (prevents overflow)
4. Backward pass in float16 (fast)
5. Scale gradients to float32
6. Update float32 master weights
```

Le problème avec la formation pure float16: les gradients sont souvent très petits (1e-8 ou plus). Float16 sous-flutes n'importe quoi en dessous de ~6e-8 à zéro. Votre modèle cesse d'apprendre parce que toutes les mises à jour de gradient sont zéro.

La solution est de réduire les pertes:

```
1. Multiply loss by a large scale factor (e.g., 1024)
2. Backward pass computes gradients of (loss * 1024)
3. All gradients are 1024x larger (pushed above float16 underflow)
4. Divide gradients by 1024 before updating weights
5. Net effect: same update, but no underflow
```

L'échelle dynamique de perte d'échelle ajuste automatiquement le facteur d'échelle. Commencez par une valeur importante (65536).`inf`- Si vous voulez.$N$Passez les marches sans débordement, doublons-le.

### Bfloat16 contre Bfloat16: Pourquoi Bfloat16 gagne pour l'entraînement

```
float16:   [1 sign] [5 exponent]  [10 mantissa]
bfloat16:  [1 sign] [8 exponent]  [7 mantissa]
```

bfloat16 a une précision plus élevée (10 bits mantissa vs 7) mais une portée limitée (max. ~65,504). bfloat16 a une précision inférieure mais une portée similaire à celle de float32 (max. ~3.4e38).

Pour la formation des réseaux neuronaux:

- Les activations et les logits dépassent régulièrement les 65 504 lors des pics d'entraînement.
- L'échelle de perte est requise avec float16 mais généralement inutile avec bfloat16 car sa plage couvre le spectre de la magnitude des gradients.
- bfloat16 est une simple troncation de float32: déposez les 16 bits inférieurs de la mantissa.

bfloat16 est préférable pour l'inférence où les valeurs sont limitées et où la précision est plus importante. bfloat16 est préférable pour l'entraînement où la portée est plus importante.

### Le découpage de la graisse

Les gradients explosants se produisent lorsque les gradients se développent de manière exponentielle à travers de nombreuses couches (communes dans les RNN, les réseaux profonds et les transformateurs).

Deux types de coupures:

**Clip by value:**coller chaque élément de gradient de manière indépendante.

```
grad = clamp(grad, -max_val, max_val)
```

Simple mais peut changer la direction du vecteur de gradient.

**Clip by norm:**étalonner l'ensemble du vecteur de gradient de manière à ce que sa norme ne dépasse pas un seuil.

```
if ||grad|| > max_norm:
    grad = grad * (max_norm / ||grad||)
```

Il préserve la direction du gradient.`torch.nn.utils.clip_grad_norm_()`C'est le choix standard.

Vérités typiques: `max_norm=1.0`pour les transformateurs, `max_norm=0.5`pour RL, `max_norm=5.0`pour des réseaux plus simples.

Le coup de gradient n'est pas un hack, c'est un mécanisme de sécurité.

### Les couches de normalisation comme stabilisateurs numériques

La normalisation de lot, la normalisation de couche et la normalisation du système de gestion des données sont généralement présentées comme des régularisateurs qui aident à la convergence des formations.

Sans normalisation, les activations peuvent croître ou diminuer de façon exponentielle à travers les couches:

```
Layer 1: values in [0, 1]
Layer 5: values in [0, 100]
Layer 10: values in [0, 10,000]
Layer 50: values in [0, inf]
```

Normalité des récurrents et rééchelles d'activations à chaque couche:

```math
\mathop{\mathrm{LayerNorm}}(x) = \frac{x - \mathop{\mathrm{mean}}(x)}{\mathop{\mathrm{std}}(x) + \epsilon} \cdot \gamma + \beta
```

Le `epsilon`(typiquement 1e-5) empêche la division par zéro lorsque toutes les activations sont identiques.`gamma`et `beta`Laissez le réseau restaurer toute l'échelle dont il a besoin.

Cela maintient les valeurs dans une plage numériquement sûre sur tout le réseau, empêchant à la fois le débordement dans le passage vers l'avant et l'explosion de gradient dans le passage vers l'arrière.

### Les bugs numériques ML communs

**Bug: Loss is NaN after a few epochs.**
Cause: les logits sont devenus trop grands, la softmax a débordé ou le taux d'apprentissage est trop élevé et les poids divergent.
Réparation: utilisez une douceur stable (soustraction maximale), réduisez le taux d'apprentissage, ajoutez une coupe de gradient.

**Bug: Loss is stuck at log(num_classes).**
Cause: les résultats du modèle sont des probabilités presque uniformes. Cela signifie souvent que les gradients disparaissent ou que le modèle n'apprend pas du tout.
Réparation: vérifier que les étiquettes de données sont correctes, vérifier la fonction de perte, vérifier les RELU morts.

**Bug: Validation accuracy is lower than expected by 1-3%.**
Cause: précision mixte sans mise à l'échelle des pertes.
Réparation: activer l'évolutivité dynamique des pertes ou passer à bfloat16.

**Bug: Gradient norms are 0.0 for some layers.**
Cause: neurones morts de ReLU (toutes les entrées négatives) ou sous-flux float16.
Réparation: utiliser LeakyReLU ou GELU, utiliser l'échelle des gradients, vérifier l'initialisation du poids.

**Bug: Model works on one GPU but gives different results on another.**
Cause: ordre d'accumulation de points flottants non déterministe. Les réductions parallèles de la GPU sont la somme de différents ordres sur différents matériels, et l'ajout de points flottants n'est pas associatif.
Fix: accepter les petites différences (1e-6), ou définir `torch.use_deterministic_algorithms(True)`et acceptez la pénalité de vitesse.

**Bug: `exp()` returns `inf` in loss computation.**
Cause: les logits bruts sont passés à `exp()`sans le truc de soustraction maximale.
Réparation: utilisation `torch.nn.functional.log_softmax()`qui implémentent log-sum-exp en interne.

**Bug: Training diverges after switching from float32 to float16.**
Cause: float16 ne peut pas représenter des magnitudes de gradient inférieures à 6e-8 ou des activations supérieures à 65,504.
Réparation: utiliser une précision mixte avec une mise à l'échelle des pertes (AMP) ou utiliser bfloat16 à la place.

```figure
logsumexp-stability
```

## Faites-le

### Étape 1: démontrer les limites de précision des points flottants

```python
print("=== Floating Point Precision ===")
print(f"0.1 + 0.2 = {0.1 + 0.2}")
print(f"0.1 + 0.2 == 0.3? {0.1 + 0.2 == 0.3}")
print(f"Difference: {(0.1 + 0.2) - 0.3:.2e}")
```

### Étape 2: Implémentation naïve contre stable softmax

```python
import math

def softmax_naive(logits):
    exps = [math.exp(z) for z in logits]
    total = sum(exps)
    return [e / total for e in exps]

def softmax_stable(logits):
    max_logit = max(logits)
    exps = [math.exp(z - max_logit) for z in logits]
    total = sum(exps)
    return [e / total for e in exps]

safe_logits = [2.0, 1.0, 0.1]
print(f"Naive:  {softmax_naive(safe_logits)}")
print(f"Stable: {softmax_stable(safe_logits)}")

dangerous_logits = [100.0, 101.0, 102.0]
print(f"Stable: {softmax_stable(dangerous_logits)}")
# softmax_naive(dangerous_logits) would return [nan, nan, nan]
```

### Étape 3: mettre en œuvre un log-sum-exp stable

```python
def logsumexp_naive(values):
    return math.log(sum(math.exp(v) for v in values))

def logsumexp_stable(values):
    c = max(values)
    return c + math.log(sum(math.exp(v - c) for v in values))

safe = [1.0, 2.0, 3.0]
print(f"Naive:  {logsumexp_naive(safe):.6f}")
print(f"Stable: {logsumexp_stable(safe):.6f}")

large = [500.0, 501.0, 502.0]
print(f"Stable: {logsumexp_stable(large):.6f}")
# logsumexp_naive(large) returns inf
```

### Étape 4: mettre en œuvre une entropie croisée stable

```python
def cross_entropy_naive(true_class, logits):
    probs = softmax_naive(logits)
    return -math.log(probs[true_class])

def cross_entropy_stable(true_class, logits):
    max_logit = max(logits)
    shifted = [z - max_logit for z in logits]
    log_sum_exp = math.log(sum(math.exp(s) for s in shifted))
    log_prob = shifted[true_class] - log_sum_exp
    return -log_prob

logits = [2.0, 5.0, 1.0]
true_class = 1
print(f"Naive:  {cross_entropy_naive(true_class, logits):.6f}")
print(f"Stable: {cross_entropy_stable(true_class, logits):.6f}")
```

### Étape 5: vérification des degrés

```python
def numerical_gradient(f, x, h=1e-5):
    grad = []
    for i in range(len(x)):
        x_plus = x[:]
        x_minus = x[:]
        x_plus[i] += h
        x_minus[i] -= h
        grad.append((f(x_plus) - f(x_minus)) / (2 * h))
    return grad

def check_gradient(analytical, numerical, tolerance=1e-5):
    for i, (a, n) in enumerate(zip(analytical, numerical)):
        denom = max(abs(a), abs(n), 1e-8)
        rel_error = abs(a - n) / denom
        status = "OK" if rel_error < tolerance else "FAIL"
        print(f"  param {i}: analytical={a:.8f} numerical={n:.8f} "
              f"rel_error={rel_error:.2e} [{status}]")

def f(params):
    x, y = params
    return x**2 + 3*x*y + y**3

def f_grad(params):
    x, y = params
    return [2*x + 3*y, 3*x + 3*y**2]

point = [2.0, 1.0]
analytical = f_grad(point)
numerical = numerical_gradient(f, point)
check_gradient(analytical, numerical)
```

## Utilisez-le

### Simulation de précision mixte

```python
import struct

def float32_to_float16_round(x):
    packed = struct.pack('f', x)
    f32 = struct.unpack('f', packed)[0]
    packed16 = struct.pack('e', f32)
    return struct.unpack('e', packed16)[0]

def simulate_bfloat16(x):
    packed = struct.pack('f', x)
    as_int = int.from_bytes(packed, 'little')
    truncated = as_int & 0xFFFF0000
    repacked = truncated.to_bytes(4, 'little')
    return struct.unpack('f', repacked)[0]
```

### Coupe de la coupe

```python
def clip_by_norm(gradients, max_norm):
    total_norm = math.sqrt(sum(g**2 for g in gradients))
    if total_norm > max_norm:
        scale = max_norm / total_norm
        return [g * scale for g in gradients]
    return gradients

grads = [10.0, 20.0, 30.0]
clipped = clip_by_norm(grads, max_norm=5.0)
print(f"Original norm: {math.sqrt(sum(g**2 for g in grads)):.2f}")
print(f"Clipped norm:  {math.sqrt(sum(g**2 for g in clipped)):.2f}")
print(f"Direction preserved: {[c/clipped[0] for c in clipped]} == {[g/grads[0] for g in grads]}")
```

### Détection de NaN/Inf

```python
def check_tensor(name, values):
    has_nan = any(math.isnan(v) for v in values)
    has_inf = any(math.isinf(v) for v in values)
    if has_nan or has_inf:
        print(f"WARNING {name}: nan={has_nan} inf={has_inf}")
        return False
    return True

check_tensor("good", [1.0, 2.0, 3.0])
check_tensor("bad",  [1.0, float('nan'), 3.0])
check_tensor("ugly", [1.0, float('inf'), 3.0])
```

Regardez !`code/numerical.py`Les résultats de l'étude ont été obtenus en vue de la réalisation complète de tous les cas de bord démontrés.`code/numerical.ts`est un port TypeScript avec les mêmes fonctions et démos.

## La faire partir

Cette leçon donne:
- `code/numerical.py`avec une douceur stable, une log-sum-exp, une entropie croisée, une vérification des gradients et une simulation de précision mixte
- `outputs/prompt-numerical-debugger.md`pour le diagnostic de la NA/INF et des problèmes numériques dans la formation

Ces mises en œuvre stables se réapparaissent à la phase 3 lors de la construction de la boucle de formation et à la phase 4 lors de la mise en œuvre de mécanismes d'attention.

## Exercices

1. **Catastrophic cancellation.**Comptez la variance de [1000000.0, 1000001.0, 1000002.0] en utilisant la formule naïve $\mathbb{E}[x^2] - \mathbb{E}[x]^2$Comparer les erreurs avec la variance réelle (0,6667).

2. **Precision hunt.**Trouvez la plus petite valeur positive float32 `x`comme ça .`1.0 + x == 1.0`C'est la machine epsilon, vérifiez qu'elle correspond.`numpy.finfo(numpy.float32).eps`- Je suis désolé .

3. **Log-sum-exp edge cases.**Testez votre`logsumexp_stable`La fonction fonction de l'indicateur est de type: a) toutes les valeurs sont égales, b) une valeur est beaucoup plus grande que les autres, c) toutes les valeurs sont très négatives (-1000).

4. **Gradient checking a neural network layer.**Implémenter une seule couche linéaire `y = Wx + b`et son passage analytique à l'arrière.`numerical_gradient`pour vérifier la précision d'une matrice de poids 3x2.

5. **Loss scaling experiment.**Simuler l'entraînement avec float16: créer des gradients aléatoires dans la plage [1e-9, 1e-3], convertir en float16, et mesurer quelle fraction devient zéro.

### Des indices

**Exercise 1.**Convertir les trois valeurs avec `np.float32`Avant de les écarter, alors appelez`variance_naive`et `welford_variance`Une valeur proche de$10^{12}$dans float32 a une distance beaucoup plus grande que 1, alors attendez-vous que le résultat naïf soit loin de 0,6667 et le résultat Welford soit proche.

**Exercise 2.**Commencez par `x = np.float32(1.0)`et la réduire de moitié pendant que `np.float32(1.0) + x != np.float32(1.0)`. Conservez chaque valeur dans float32, puis comparez la dernière valeur qui a encore changé la somme avec `numpy.finfo(numpy.float32).eps`, qui est $2^{-23}$- Je suis désolé .

**Exercise 3.**Prédire chaque réponse d'abord.$n$valeurs égales $c$, le résultat est $c + \ln n$Pour une valeur importante, le résultat est proche de cette valeur.$-1000 + \ln n$, alors que `logsumexp_naive`Retour `-inf`parce que chaque élément exponentiel descend à 0.

**Exercise 4.**Pour $y = Wx + b$avec une perte $L$, le gradient pour $W$est le produit externe du gradient en amont et $x$- Remplir la perte en fonction de l' aplatissement$W$- Je vous appelle .`numerical_gradient`, et de passer les deux résultats à `check_gradient`- Je suis désolé .

**Exercise 5.**Prenez des échantillons de la magnitude sur une échelle de jour avec `10 ** np.random.uniform(-9, -3, n)`et se convertir avec `np.float16`. Float16 ne peut pas maintenir les valeurs inférieures à environ $6 \times 10^{-8}$, alors attendez-vous à environ un quart des valeurs deviennent zéro avant l'échelle et presque aucun après que vous multipliez par 1024.

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| IEEE 754 | "The float standard" | International standard defining binary floating point formats, rounding rules, and special values (inf, nan). Every modern CPU and GPU implements it. |
| Machine epsilon | "The precision limit" | The smallest value $e$ such that $1.0 + e \ne 1.0$ in a given float format. For float32, it is about 1.19e-7. |
| Catastrophic cancellation | "Precision loss from subtraction" | When subtracting nearly equal floating point numbers, significant digits cancel and rounding noise dominates the result. |
| Overflow | "Number too big" | A result exceeds the maximum representable value and becomes inf. exp(89) overflows float32. |
| Underflow | "Number too small" | A result is closer to zero than the smallest representable positive number and becomes 0.0. exp(-104) underflows float32. |
| Log-sum-exp trick | "Subtract the max first" | Computing $\log(\sum \exp(x))$ by factoring out $\exp(\max(x))$ to prevent overflow and underflow. Used in softmax, cross-entropy, and log-probability math. |
| Stable softmax | "Softmax that does not explode" | Subtracting $\max(\text{logits})$ before exponentiating. Numerically identical result, no overflow possible. |
| Gradient checking | "Verify your backprop" | Comparing analytical gradients from backpropagation against numerical gradients from finite differences to catch implementation bugs. |
| Mixed precision | "Float16 forward, float32 backward" | Using lower-precision floats for speed-critical operations and higher-precision floats for numerically sensitive operations. Typical speedup is 2-3x. |
| Loss scaling | "Prevent gradient underflow" | Multiplying the loss by a large constant before backprop so gradients stay in float16's representable range, then dividing by the same constant before weight updates. |
| bfloat16 | "Brain floating point" | Google's 16-bit format with 8 exponent bits (same range as float32) and 7 mantissa bits (less precision than float16). Preferred for training. |
| Gradient clipping | "Cap the gradient norm" | Scaling the gradient vector so its norm does not exceed a threshold. Prevents exploding gradients from ruining weights. |
| NaN | "Not a Number" | Special float value from undefined operations (0/0, inf-inf, sqrt(-1)). Propagates through all subsequent arithmetic. |
| Inf | "Infinity" | Special float value from overflow or division by zero. Can combine to produce NaN (inf - inf, inf * 0). |
| Numerical gradient | "Brute force derivative" | Approximating a derivative by evaluating $f(x+h)$ and $f(x-h)$ and dividing by $2h$. Slow but reliable for verification. |

## Pour en savoir plus

- [What Every Computer Scientist Should Know About Floating-Point Arithmetic (Goldberg 1991)](https://docs.oracle.com/cd/E19957-01/806-3568/ncg_goldberg.html)- la référence définitive, dense mais complète
- [Mixed Precision Training (Micikevicius et al., 2018)](https://arxiv.org/abs/1710.03740)-- le document de NVIDIA qui a introduit l' écaillage des pertes pour l' entraînement de float16
- [AMP: Automatic Mixed Precision (PyTorch docs)](https://pytorch.org/docs/stable/amp.html)-- Guide pratique de la précision mixte dans PyTorch
- [bfloat16 format (Google Cloud TPU docs)](https://cloud.google.com/tpu/docs/bfloat16)-- pourquoi Google a choisi ce format pour les TPU
- [Kahan Summation (Wikipedia)](https://en.wikipedia.org/wiki/Kahan_summation_algorithm)-- algorithme pour réduire l'erreur d'arrondissement dans les sumes de points flottants
