# Les lois de l'échelle

> Le papier de Kaplan 2020 disait: plus grand modèle, moins de perte. Le papier de Hoffmann 2022 disait: vous étiez sous-entraînés.

**Type:** Learn
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 7 · 07 (GPT)
**Time:** ~45 minutes

## Le problème

Lorsque vous avez des C FLOP de formation en calcul et que vous voulez le meilleur modèle, vous êtes confronté à deux boutons:

1. **How many parameters (N)?**Un modèle plus grand, une capacité plus élevée.
2. **How many training tokens (D)?**Plus de données, une meilleure utilisation des capacités.

Les PLOP sont approximativement `6 × N × D`Vous pouvez pousser N vers le haut et D vers le bas, ou D vers le haut et N vers le bas.

Avant 2022, la réponse était "pousse N fort". GPT-3 (2020) était 175B paramètres formés sur ~ 300B jetons. Un ratio d'environ 1,7 jetons par paramètre.

Hoffmann et coll. (2022), qui a formé une petite famille de modèles appelés Chinchilla, a trouvé quelque chose de différent: le rapport optimal est plus proche de **20 tokens per parameter**Le GPT-3 était 10 fois moins entraîné. Chinchilla (70B params, 1.4T tokens) a battu le GPT-3 (175B, 300B tokens) sur chaque référence à 2,5 fois moins de coût d'inférence.

Llama 3 8B a été formé sur 15 billions de jetons, un ratio de 1 875 jetons par paramètre. 94 fois plus que le Chinchilla-optimal. Les coûts d'inférence comptent plus que les coûts de formation pour les modèles qui seront utilisés à l'échelle, donc une formation excessive (passer Chinchilla) pour une empreinte déployable plus petite est la norme par défaut de 2026.

## Le concept

![Chinchilla curves: loss vs compute at various N/D ratios](../assets/scaling-laws.svg)

### La loi Hoffmann

Dans le journal Chinchilla, la perte est suivante:

```math
L(N, D) = \frac{A}{N^\alpha} + \frac{B}{D^\beta} + E
```

- $N$= paramètres (non intégrés).
- $D$= jetons de formation.
- $\alpha \approx 0.34$- Je suis là .$\beta \approx 0.28$(à peu près symétrique).
- $E \approx 1.69$, le plafond irréductible de perte.
- $A \approx 406$- Je suis là .$B \approx 411$- Je suis désolé .

Deux termes sont négociés l'un contre l'autre à mesure que vous étaliez.$N$à calcul fixe ($C = 6ND$Il est possible de trouver des solutions.$\alpha$et $\beta$ci-dessus, les exponents sortent à environ 0,45 pour $N$et 0,55 pour $D$, de sorte que le ratio optimal exact dérive lentement avec le budget; `code/main.py`Les deux premières approches de l'appareil, qui mesurent directement l'optimal, mettent les deux exponents à environ 0,5.$D = 20N$dans $C = 6ND$et la règle générale est la suivante:

```math
\begin{aligned}
N_{\text{opt}} &\approx 0.22 \times (C/6)^{0.5} \\
D_{\text{opt}} &\approx 4.5 \times (C/6)^{0.5} \\
D_{\text{opt}} / N_{\text{opt}} &\approx 20
\end{aligned}
```

Optimisé pour le calcul: 20 jetons par paramètre.

### Pourquoi trop de formation ?

Le Chinchilla-optimal réduit les pertes d'entraînement par entraînement FLOP. Mais vous payez le coût de l'entraînement une fois; l'inférence coûte pour toujours.

Pour un chatbot qui sert un milliard de tokens par mois, l'inférence domine le coût total. L'approche de Llama: traîne plus petit, plus long. 8B à 15T tokens est profondément optimisé pour l'inférence:

- Il s'adapte aux GPU du consommateur.
- La latence est une fraction de 70B Chinchilla-optimal.
- La qualité est suffisamment proche pour la plupart des tâches.

Le document 2024 de DeepMind ("Over-training is the new optimal") formait cela. Pour les charges de travail dominées par les inférences, le ratio correct est plus proche de 100500 jetons par paramètre en fonction du volume de service.

### Émergence versus lissage

Prétendue: certaines capacités (arithmétique, raisonnement à plusieurs étapes, suivi de la chaîne de pensée) "émergent" soudainement à une certaine échelle.

Schaeffer et coll. (2023) ont soutenu que c'est un artefact de mesure: les mesures émergentes utilisent des scores discontinues (correspondance exacte, précision au seuil) qui cachent une amélioration fluide des logits sous-jacents.

En 2026, le consensus est que les prévisions sur les pertes continues sont fiables. Les sauts de référence sont souvent des objets de plus haut niveau.

### La photo de 2026

Les lois de l'échelle fonctionnent toujours, mais:

| Factor | Changed how |
|--------|-------------|
| Data quality | Curating "good" tokens (Phi-style) shifts curves by >2× effective compute |
| MoE | Total params decouple from active FLOPs; scaling laws per-active-FLOP |
| Post-training | Some capabilities (instruction following, code) shift with SFT+RLHF more than pretraining |
| Multimodality | Image + text tokens scale together; separate curves per modality |
| Synthetic data | Models generate training data; effective compute can compound |

L'optimisateur de Muon (Kimi Moonlight, 2024) a montré un gain de calcul efficace de ~ 2x par rapport à AdamW à des données correspondantes. Certaines séries de formation 2026 utilisent Muon par défaut.

```figure
scaling-laws
```

## Faites-le

Regardez !`code/main.py`Nous mettons en œuvre l' équation de perte de Chinchilla et résolvons pour calcul-optimal$(N, D)$à chacun des différents budgets informatiques.

### Étape 1: Perte de la chinchilla

```python
def chinchilla_loss(N, D, A=406.4, B=410.7, alpha=0.34, beta=0.28, E=1.69):
    return A / N ** alpha + B / D ** beta + E
```

Le film$L$comme un contour sur $(N, D)$à fixé $C = 6ND$Trouvez le minimum.

### Étape 2: frontière optimale en matière de calcul

Pour les budgets informatiques de `1e17`à `1e25`Les FLOPs, trouvez $(N, D)$qui réduisent au minimum les pertes, sous réserve de $6ND = C$- Vérifiez le rapport $D/N \approx 20$- Je suis désolé .

### Étape 3: coût de la surentraînement

Comptez la perte supplémentaire que vous payez pour former un modèle 10x plus petit (1/10 de N optimale, 10x D optimale).

### Étape 4: comparer avec les modèles réels

Je sais .`(N, D)`Par exemple, les données de l'analyse de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur

## Utilisez-le

Vous ne pouvez pas former un modèle de frontière, mais les lois de l'échelle vous disent:

1. **Whether your fine-tune has enough data.**Si vos données spécifiques à la tâche sont inférieures à 20 jetons par paramètre du modèle de base, attendez-vous à une saturation à un certain niveau de perte.
2. **Whether to pick a bigger base model.**Si vous dépensez tout votre budget pour l'inférence, préférez un modèle plus petit et plus long.
3. **Where the returns diminish.**Au-delà de 1000 fois la meilleure des Chinchilla, les changements de perte de logs deviennent du bruit.

**The research trajectory in 2026:**

- **Data-constrained regime.**Le Web a un nombre fini de jetons de haute qualité (~510 billions d'anglais après filtration). Le prétrain frontalier approche ce plafond.
- **Compute-multiplier tricks.**Optimisateur de muons, MoE, meilleure curation de données  chaque déplace les constantes absolues, pas l'asymptote.
- **Scaling laws for RL.**Les premières preuves suggèrent la loi du pouvoir dans les échantillons de RL mais avec des exponents très différents de la pré-entraînement.

## La faire partir

Regardez !`outputs/skill-training-budget-estimator.md`- Les compétences sont choisies .`(N, D, hours, GPU)`pour une nouvelle formation, compte tenu du budget de calcul, des contraintes de déploiement et de la perte cible.

## Exercices

1. **Easy.**On court .`code/main.py`Imprimez Chinchilla-optimal$(N, D)$pour les budgets informatiques `1e20`- Je suis là .`1e22`- Je suis là .`1e24`Comparer avec la vraie table de modèle.
2. **Medium.**Implémenter la courbe de perte de fonction de calcul Hoffmann.`log10(C)`Identifier quand la loi prédit que nous aurons besoin de$>10^{28}$Les PLOP pour la prochaine réduction de 0,1 de l'entropie croisée.
3. **Hard.**Appliquez votre propre loi d'échelle sur 5 modèles minuscules (100 000 à 10 millions de params) formés sur le même ensemble de données.$\alpha$et $E$- Vos exposants correspondent-ils à ceux publiés ?

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Parameters (N) | "Model size" | Non-embedding weight count; determines capacity. |
| Tokens (D) | "Training data" | Number of training tokens seen; determines how well the parameters get used. |
| Compute (C) | "FLOPs spent" | Approximately `6 × N × D` for a standard transformer. |
| Chinchilla-optimal | "D/N ≈ 20" | Ratio that minimizes loss per FLOP of pretraining. |
| Over-training | "Past Chinchilla" | Spend extra training FLOPs to save inference FLOPs; D/N >> 20. |
| Irreducible loss | "The floor" | The $E$ term in the scaling law; the entropy of the data itself. |
| Emergent capability | "Sudden jumps at scale" | Often a scorer artifact; continuous loss is smooth. |
| Effective compute | "Training-efficiency multiplier" | Better data / optimizer / architecture multiplies how far a FLOP goes. |

## Pour en savoir plus

- [Kaplan et al. (2020). Scaling Laws for Neural Language Models](https://arxiv.org/abs/2001.08361) le premier document de droit de l'échelle; sous-trainé.
- [Hoffmann et al. (2022). Training Compute-Optimal Large Language Models](https://arxiv.org/abs/2203.15556)- Une Chinchilla.
- [Schaeffer et al. (2023). Are Emergent Abilities of Large Language Models a Mirage?](https://arxiv.org/abs/2304.15004) émergence en tant qu'artefact de mesure.
- [Sardana, Frankle (2024). Beyond Chinchilla-Optimal: Accounting for Inference in Language Model Scaling Laws](https://arxiv.org/abs/2401.00448)Pourquoi la surentraînement de Llama est la bonne chose pour sa charge de travail.
- [Jordan et al. (2024). Muon: An optimizer for hidden layers in neural networks](https://kellerjordan.github.io/posts/muon/) 2x multiplicateur de calcul.
