# Les flux correspondants et les flux corrigés

> Les modèles de diffusion prennent 20 à 50 étapes de prélèvement d'échantillons parce qu'ils suivent un chemin incurvé du bruit aux données.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 06 (DDPM), Phase 1 · Calculus
**Time:** ~45 minutes

## Le problème

Le processus inverse du DDPM est une marche stochastique de 1000 pas de $\mathcal{N}(0, I)$Le blocage est que le processus inverse est rigide, le chemin est incurvé.

Si vous pouviez former le modèle de telle sorte que le chemin du bruit vers les données était une * ligne droite*, un seul pas d'Euler de $t=1$à $t=0$Le flux de correspondance construit ceci directement: définir une interpolation en ligne droite à partir de$x_1 \sim \mathcal{N}(0, I)$à $x_0 \sim \text{data}$, entraîne un champ vectoriel $v_\theta(x, t)$pour correspondre à sa dérivée temporelle, intégrer à l'inférence.

Le flux rectifié (Liu 2022) va plus loin: redresser de manière itérative les chemins avec une procédure de reflux qui produit un ODE progressivement plus proche de la ligne. Après deux itérations de reflux, un échantillonneur en 2 étapes correspond à la qualité DDPM en 50 étapes.

## Le concept

![Flow matching: straight-line interpolation between noise and data](../assets/flow-matching.svg)

### Flux en ligne droite

Définir:

```math
x_t = t \cdot x_1 + (1 - t) \cdot x_0, \quad t \in [0, 1]
```

où $x_0 \sim \text{data}$et $x_1 \sim \mathcal{N}(0, I)$La dérivée temporelle le long de cette ligne droite est constante:

```math
\frac{dx_t}{dt} = x_1 - x_0
```

Définir un champ vectoriel neuronal $v_\theta(x_t, t)$et l'entraîner à correspondre à cette dérivé:

```math
L = \mathbb{E}_{x_0, x_1, t} \left\lVert v_\theta(x_t, t) - (x_1 - x_0) \right\rVert^2
```

C' est le **conditional flow matching**L'apprentissage est sans simulation: vous ne déployez jamais l'ODE.$(x_0, x_1, t)$et le régression.

### Prise d'échantillons

Pour l'inférence, intégrez le champ vectoriel appris * à l'arrière* dans le temps:

```math
x_{t-\Delta t} = x_t - \Delta t \cdot v_\theta(x_t, t)
```

Commencez par $x_1 \sim \mathcal{N}(0, I)$, Euler-passer vers le bas à $t=0$- Je suis désolé .

### Flux rectifié (Liu 2022)

Les voies de la ligne droite fonctionnent, mais les voies apprises ne sont pas en fait droites. Elles se courbent parce que beaucoup de voies sont droites.$x_0$- Je peux le faire .$x_1$. étape de reflux du flux rectifié:

1. Modèle de débit du train $v_1$avec des couples aléatoires.
2. Pratique N paires $(x_1, x_0)$en intégrant $v_1$de $x_1$à son atterrissage $x_0$- Je suis désolé .
3. Le train$v_2$Parce que les paires sont maintenant "ODE-matched", l'interpolant en ligne droite entre eux est vraiment plus plat.
4. Je répète.

En pratique, 2 itérations de reflux vous amènent à une approche linéaire, permettant une inférence de 2 à 4 étapes. SDXL-Turbo, SD3-Turbo, LCM sont tous des modèles distillés à partir de flux.

### Pourquoi cette image a gagné en 2024 ?

Trois raisons:

1. **Simulation-free training** aucune ODE déroulant pendant la formation, trivial à mettre en œuvre.
2. **Better loss geometry** les voies droites ont une signal-au-bruit cohérente, alors que la DDPM ε-loss a une mauvaise SNR aux bords du calendrier.
3. **Faster inference** 4 à 8 étapes à la qualité SDXL-Turbo; 1 étape avec distillation de consistance.

## Parallèle de flux par rapport à DDPM  connexion exacte

Le flux correspondant à un chemin conditionné de Gauss est la diffusion *avec un calendrier de bruit spécifique*.$x_t = \alpha(t) x_0 + \sigma(t) x_1$Le calendrier et le flux correspondant récupèrent la diffusion réformée par Stratonovich avec $v = \alpha' \cdot x_0 - \sigma' \cdot x_1$Les deux sont équivalents algébriques pour les chemins gaussiens.

Ce que l'ajustement de flux a ajouté: la * clarté* de la cible (une vitesse simple), une perte plus nette et la licence d'expérimenter avec des interpolants non gaussiens.

```figure
normalizing-flow
```

## Faites-le

`code/main.py`Il met en œuvre une correspondance de flux 1D sur un mélange gaussien à deux modes.$v_\theta(x, t)$En conclusion, intégrez les étapes 1, 2, 4 et 20 d'Euler et comparez la qualité de l'échantillon.

### Étape 1: Perte de formation

```python
def train_step(x0, net, rng, lr):
    x1 = rng.gauss(0, 1)
    t = rng.random()
    x_t = t * x1 + (1 - t) * x0
    target = x1 - x0
    pred = net_forward(x_t, t)
    loss = (pred - target) ** 2
    # backprop + update
```

### Étape 2: inférence en plusieurs étapes

```python
def sample(net, num_steps):
    x = rng.gauss(0, 1)
    for i in range(num_steps):
        t = 1.0 - i / num_steps
        dt = 1.0 / num_steps
        x -= dt * net_forward(x, t)
    return x
```

### Étape 3: comparer le nombre d'étapes

Attendez-vous que le prélèvement de 4 étapes corresponde déjà à la qualité de 20 étapes  un gros problème pour la latence.

## Les pièges

- **Time parameterization.**Utilisation de l' échange de flux $t \in [0, 1]$avec $t=0$à la base de données, $t=1$à l'aide de la DDPM$t \in [0, T]$avec $t=0$à la base de données, $t=T$Les journaux se trompent constamment.
- **Schedule choice.**La ligne droite du flux rectifié est le calendrier de correspondance des flux, mais vous pouvez utiliser l'échantillonnage t-normal cosine ou logite (SD3 le fait) pour une meilleure couverture à l'échelle.
- **Reflow cost.**Générer le jeu de données en couple pour le reflux est un passage d'inférence complet par échantillon.
- **Classifier-free guidance still applies.**Il suffit d' échanger .$\epsilon$pour $v$dans la combinaison linéaire: $v_{\text{cfg}} = (1+w) v_{\text{cond}} - w v_{\text{uncond}}$- Je suis désolé .

## Utilisez-le

| Use case | 2026 stack |
|----------|-----------|
| Text-to-image, best quality | Flow matching: SD3, Flux.1-dev |
| Text-to-image, 1-4 steps | Distilled flow matching: Flux.1-schnell, SD3-Turbo, SDXL-Turbo |
| Real-time inference | Consistency distillation from a flow-matched base (LCM, PCM) |
| Audio generation | Flow matching: Stable Audio 2.5, AudioCraft 2 |
| Video generation | Flow matching mixed with diffusion (Sora, Veo, Stable Video) |
| Science / physics (particle trajectories, molecules) | Flow matching + equivariant vector field |

Chaque fois qu'un article dit "plus vite que la diffusion" en 2025-2026, c'est presque toujours le flux correspondant + la distillation.

## La faire partir

- Ça va .`outputs/skill-fm-tuner.md`. Skill prend une spécification de modèle de diffusion et la convertit en une configuration de formation correspondant au flux: choix de calendrier, répartition des échantillons de temps (uniforme / logit-normal), optimisateur, plan de reflux, compte de étapes cibles, protocole d'évaluation.

## Exercices

1. **Easy.**On court .`code/main.py`et comparer la MSE de 1 étape contre 20 étapes contre la réelle distribution des données.
2. **Medium.**Passez de l' uniforme .$t$L'échantillonnage est-il en phase logit-normale (concentre l'échantillonnage au milieu de la phase t)?
3. **Hard.**Implémenter une itération de reflux: générer par pair $(x_0, x_1)$en intégrant le premier modèle, en entraînant un deuxième modèle sur les paires et en comparant la qualité de l'échantillon en 1 étape.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Flow matching | "Straight-line diffusion" | Train $v_\theta(x, t)$ to match $x_1 - x_0$ along an interpolant. |
| Rectified flow | "Reflow" | Iterative procedure that straightens learned flows. |
| Velocity field | "v_θ" | Output of the model — the direction to move $x_t$. |
| Straight-line interpolant | "The path" | $x_t = (1-t) \cdot x_0 + t \cdot x_1$; trivial target derivative. |
| Euler sampler | "1st order ODE solver" | Simplest integrator; works well when paths are straight. |
| Logit-normal t | "SD3 sampling" | Concentrate $t$ sampling toward mid-values where gradients are strongest. |
| Consistency distillation | "1-step sampler" | Train a student to map any $x_t$ directly to $x_0$. |
| CFG with velocity | "v-CFG" | $v_{\text{cfg}} = (1+w) v_{\text{cond}} - w v_{\text{uncond}}$; same trick, new variable. |

## Note de production: Flux.1-schnell est le flux correspondant à son plus rapide

Le résultat de la production de flux matching est Flux.1-schnell  un flux-matched DiT distillé à 1-4 étapes d'inférence tout en maintenant la qualité de flux-dev-grade. Le bloc-notes de Niels "Run Flux sur une machine de 8 Go" est la recette de déploiement de référence: T5 + CLIP code, quantifié MMDiT dénoncer (en 4 étapes pour rapide vs 50 pour dev), VAE décode. La comptabilité des coûts:

| Variant | Steps | Latency at 1024² on L4 | Total FLOPs (relative) |
|---------|-------|------------------------|------------------------|
| Flux.1-dev (raw) | 50 | ~15 s | 1.0× |
| Flux.1-schnell | 4 | ~1.2 s | 0.08× (12× faster) |
| SDXL-base | 30 | ~4 s | 0.25× |
| SDXL-Lightning 2-step | 2 | ~0.3 s | 0.03× |

La règle de production: **flow-matched base + distillation = the 2026 default for fast text-to-image.**Chaque grand fournisseur expédie cette combinaison: SD3-Turbo (SD3 + flux + distillation), Flux-schnell (Flux-dev + rectifié-flux), CogView-4-Flash.

## Pour en savoir plus

- [Liu, Gong, Liu (2022). Flow Straight and Fast: Learning to Generate and Transfer Data with Rectified Flow](https://arxiv.org/abs/2209.03003) débit rectifié.
- [Lipman et al. (2023). Flow Matching for Generative Modeling](https://arxiv.org/abs/2210.02747) correspondance des flux.
- [Esser et al. (2024). Scaling Rectified Flow Transformers for High-Resolution Image Synthesis](https://arxiv.org/abs/2403.03206) SD3, débit rectifié à l'échelle.
- [Albergo, Vanden-Eijnden (2023). Stochastic Interpolants](https://arxiv.org/abs/2303.08797) cadre général qui couvre la diffusion FM+.
- [Song et al. (2023). Consistency Models](https://arxiv.org/abs/2303.01469) Destilation en 1 étape de diffusion/flux.
- [Sauer et al. (2023). Adversarial Diffusion Distillation (SDXL-Turbo)](https://arxiv.org/abs/2311.17042) Variante turbo.
- [Black Forest Labs (2024). Flux.1 models](https://blackforestlabs.ai/announcing-black-forest-labs/) correspondance des flux dans la production.
