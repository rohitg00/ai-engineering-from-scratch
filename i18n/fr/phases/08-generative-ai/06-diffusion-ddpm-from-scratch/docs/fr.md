# Modèles de diffusion  DDPM à partir de zéro

> Ho, Jain, Abbeel (2020) a donné au champ une recette qu'il ne pouvait pas arrêter. Destruire les données avec du bruit sur mille petits pas. Formez un filet neuronal pour prédire le bruit. Inversez le processus à l'inférence. Aujourd'hui, chaque image, vidéo, 3D et modèle musical traditionnel fonctionne sur cette boucle, éventuellement avec des astuces de correspondance de flux ou de cohérence en haut.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 3 · 02 (Backprop), Phase 8 · 02 (VAE)
**Time:** ~75 minutes

## Le problème

Tu veux un échantillon pour $p_{\text{data}}(x)$Les GAN jouent un jeu de minimax qui diverge souvent. Les VAE produisent des échantillons flou à partir d'un décodeur gaussien. Ce que vous voulez vraiment, c'est un objectif d'entraînement qui est (a) une seule perte stable (pas de point de selle, pas de minimax), (b) une limite inférieure sur $\log p(x)$(pour que vous ayez des probabilités), et (c) des échantillons correspondant à la qualité de la SOTA.

Sohl-Dickstein et coll. (2015) ont eu une réponse théorique: définir une chaîne Markov $q(x_t \mid x_{t-1})$qui ajoute progressivement le bruit gaussien, et entraîne une chaîne inverse$p_\theta(x_{t-1} \mid x_t)$Ho, Jain, Abbeel (2020) ont montré que la perte pouvait être simplifiée à une ligne  prédire le bruit  et nettoyé les mathématiques. En 2020 c'était une curiosité. En 2021 il a produit des échantillons de pointe. En 2022 il est devenu Stable Diffusion. En 2026 il est le substrat.

## Le concept

![DDPM: forward noise, reverse denoise](../assets/ddpm.svg)

**Forward process $q$.**Ajoutez le bruit gaussien $T$La forme fermée  la raison pour laquelle la mathématique est traitable  est que la mesure cumulée est également gaussienne:

```math
q(x_t \mid x_0) = \mathcal{N}\left( \sqrt{\bar{\alpha}_t} \cdot x_0, (1 - \bar{\alpha}_t) \cdot I \right)
```

où $\bar\alpha_t = \prod_{s=1}^{t} (1 - \beta_s)$pour un calendrier de $\beta_t$- Je vous en prie .$\beta_t$de 1e-4 à 0,02 sur une ligne linéaire $T=1000$étapes et $x_T$est approximativement $\mathcal{N}(0, I)$- Je suis désolé .

**Reverse process $p_\theta$.**Apprenez à utiliser un réseau neuronal .$\epsilon_\theta(x_t, t)$qui prédit le bruit qui a été ajouté.$x_t$, désigne par:

```math
x_{t-1} = \frac{1}{\sqrt{\alpha_t}} \cdot \left( x_t - \frac{\beta_t}{\sqrt{1 - \bar{\alpha}_t}} \cdot \epsilon_\theta(x_t, t) \right) + \sigma_t \cdot z
```

où $\sigma_t$est soit $\sqrt{\beta_t}$L'expression est laide mais c'est juste l'algèbre$x_{t-1}$vu le retrait $q(x_{t-1} \mid x_t, x_0)$et en remplacement $x_0$avec son estimation prévue pour le bruit.

**Training loss.**

```math
L_{\text{simple}} = \mathbb{E}_{x_0, t, \epsilon} \left[ \left\lVert \epsilon - \epsilon_\theta\left( \sqrt{\bar{\alpha}_t} \cdot x_0 + \sqrt{1 - \bar{\alpha}_t} \cdot \epsilon, t \right) \right\rVert^2 \right]
```

Pratique $x_0$à partir des données, choisissez un aléatoire $t$, échantillon $\epsilon \sim \mathcal{N}(0, I)$, calculer le bruit $x_t$Une perte, pas de minimax, pas de KL, pas de trucs de réparamétrisation.

**Sampling.**Commencez$x_T \sim \mathcal{N}(0, I)$- Répétez l' étape inverse de $t = T$À 1.

## Pourquoi ça marche ?

Trois intuitions:

1. **Denoising is easy; generating is hard.**À $t=T$Les données sont de bruit pur, le réseau doit résoudre un problème trivial.$t=0$Le réseau ne doit nettoyer que quelques pixels.$t$Le problème est difficile mais le filet a de nombreux gradients qui circulent à travers les mêmes poids à partir de chaque niveau de bruit.

2. **Score matching in disguise.**Vincent (2011) a prouvé que prédire le bruit équivaut à estimer$\nabla_x \log q(x_t \mid x_0)$Le SDE inverse utilise ce score pour monter le gradient de densité  une marche aléatoire guidée vers des régions à forte probabilité.

3. **The ELBO reduces to simple MSE.**La limite inférieure variationnelle complète a un terme KL par étape temporelle. Avec la paramétrisation du DDPM, ces termes KL simplifient à MSE la prédiction du bruit avec des coefficients spécifiques; Ho a diminué les coefficients (appelant cela "perte simple") et la qualité *améliorée*.

```figure
diffusion-denoise
```

## Faites-le

`code/main.py`Le réseau est un petit MLP qui prend$(x_t, t)$Le train est la perte d'une ligne.

### Étape 1: calendrier anticipé (formule fermé)

```python
betas = [1e-4 + (0.02 - 1e-4) * t / (T - 1) for t in range(T)]
alphas = [1 - b for b in betas]
alpha_bars = []
cum = 1.0
for a in alphas:
    cum *= a
    alpha_bars.append(cum)
```

### Étape 2: échantillon `x_t`en une seule prise

```python
def forward_sample(x0, t, alpha_bars, rng):
    a_bar = alpha_bars[t]
    eps = rng.gauss(0, 1)
    x_t = math.sqrt(a_bar) * x0 + math.sqrt(1 - a_bar) * eps
    return x_t, eps
```

### Étape 3: une étape de formation

```python
def train_step(x0, model, alpha_bars, rng):
    t = rng.randrange(T)
    x_t, eps = forward_sample(x0, t, alpha_bars, rng)
    eps_hat = model_forward(model, x_t, t)
    loss = (eps - eps_hat) ** 2
    return loss, gradient_step(model, ...)
```

### Étape 4: prélèvement inverse

```python
def sample(model, alpha_bars, T, rng):
    x = rng.gauss(0, 1)
    for t in range(T - 1, -1, -1):
        eps_hat = model_forward(model, x, t)
        beta_t = 1 - alphas[t]
        x = (x - beta_t / math.sqrt(1 - alpha_bars[t]) * eps_hat) / math.sqrt(alphas[t])
        if t > 0:
            x += math.sqrt(beta_t) * rng.gauss(0, 1)
    return x
```

Pour un problème 1D avec 40 étapes de temps et un MLP de 24 unités, il apprend le mélange des deux modes en ~200 époques.

## Conditionnement du temps

Le réseau doit savoir quel temps il détecte.

- **Sinusoidal embedding.**Comme le codage positionnel de Transformer.$\text{embed}(t) = [\sin(t/\omega_0), \cos(t/\omega_0), \sin(t/\omega_1), \ldots]$Passer par un MLP, diffuser sur le net.
- **Film / group-norm conditioning.**L'intégration de projet à l'échelle/bias par canal (FiLM) à chaque bloc.

Notre code jouet utilise le synusoïdal → concat.

## Les pièges

- **Schedule matters a lot.**Linear $\beta$Le calendrier de calcul de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de cette valeur de cette valeur est de cette valeur est de cette valeur est de cette valeur est de cette valeur est de cette valeur est de cette valeur.
- **Timestep embedding is fragile.**Passer cru $t$comme un flot fonctionne pour le jouet 1-D mais ne fonctionne pas pour les images; utilisez toujours une intégration appropriée.
- **V-prediction vs ε-prediction.**Pour les régimes étroits (très petits ou très grands t), $\epsilon$Il est très faible en signal-au-bruit.$v = \alpha \cdot \epsilon - \sigma \cdot x$) est plus stable; SDXL, SD3 et Flux l'utilisent.
- **Classifier-free guidance.**Pour l'inférence, calculer à la fois conditionnelle et inconditionnelle $\epsilon$Alors ...$\epsilon_{\text{cfg}} = (1 + w) \cdot \epsilon_{\text{cond}} - w \cdot \epsilon_{\text{uncond}}$avec $w \approx 3\text{-}7$- C'est le sujet de la leçon 8.
- **1000 steps is a lot.**La production utilise du DDIM (20-50 étapes), du DPM-Solver (10-20 étapes) ou de la distillation (1-4 étapes). Voir leçon 12.

## Utilisez-le

| Role | Typical stack in 2026 |
|------|-----------------------|
| Image pixel-space diffusion (small, toy) | DDPM + U-Net |
| Image latent diffusion | VAE encoder + U-Net or DiT (Lesson 07) |
| Video latent diffusion | Spatiotemporal DiT (Sora, Veo, WAN) |
| Audio latent diffusion | Encodec + diffusion transformer |
| Science (molecules, proteins, physics) | Equivariant diffusion (EDM, RFdiffusion, AlphaFold3) |

La diffusion est la colonne vertébrale générative universelle. Le flux de correspondance (leçon 13) est le concurrent 2024-2026 qui gagne généralement sur la vitesse d'inférence pour la même qualité.

## La faire partir

- Ça va .`outputs/skill-diffusion-trainer.md`. Les compétences prennent un ensemble de données + budget et des résultats de calcul: calendrier (linéaire/cosine/sigmoïde), objectif de prédiction (ε/v/x), nombre d'étapes, échelle de guidage, famille de prélèvements et protocole d'évaluation.

## Exercices

1. **Easy.**Changez le T de 40 à 10 en `code/main.py`- Comment la qualité de l'échantillon (histogramme visuel des sorties) se dégrade-t-elle ?
2. **Medium.**Passez de la prédiction à la prédiction, faites la dérive inverse, comparez la qualité de l'échantillon final.
3. **Hard.**Ajouter des instructions sans classifiant. Condition sur une étiquette de classe $c \in \lbrace 0, 1 \rbrace$, en la déduisant 10% du temps pendant la formation et lors de l'utilisation de l'échantillonnage $\epsilon = (1+w) \cdot \epsilon_{\text{cond}} - w \cdot \epsilon_{\text{uncond}}$. Mesurer le taux de touches en mode conditionnel à $w = 0, 1, 3, 7$- Je suis désolé .

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Forward process | "Adding noise" | Fixed Markov chain $q(x_t \mid x_{t-1})$ that destroys the data. |
| Reverse process | "Denoising" | Learned chain $p_\theta(x_{t-1} \mid x_t)$ that reconstructs the data. |
| β schedule | "The noise ladder" | Per-step variance; linear, cosine, or sigmoid. |
| α̅ | "Alpha bar" | Cumulative product $\prod (1 - \beta)$; gives closed-form $x_t$ from $x_0$. |
| Simple loss | "MSE on noise" | $\lVert \epsilon - \epsilon_\theta(x_t, t) \rVert^2$; all variational derivations collapse to this. |
| ε-prediction | "Predict noise" | Output is the noise added; standard DDPM. |
| V-prediction | "Predict velocity" | Output is $\alpha \cdot \epsilon - \sigma \cdot x$; better conditioning across t. |
| DDPM | "The paper" | Ho et al. 2020; linear β, 1000 steps, U-Net. |
| DDIM | "Deterministic sampler" | Non-Markov sampler, 20-50 steps, same training objective. |
| Classifier-free guidance | "CFG" | Mix conditional and unconditional noise predictions to amplify conditioning. |

## Note de production: l'inférence de diffusion est un problème de décompte par étapes

Le papier DDPM exécute T=1000 étapes inverses. Personne ne le fait en production. Chaque pile d'inférence réelle choisit une des trois stratégies  et chaque carte détermine clairement le cadre de production de "d'où vient la latence":

1. **Faster sampler, same model.**DDIM (20-50 étapes), DPM-Solver++ (10-20), UniPC (8-16).$\epsilon_\theta$Les poids sont intacts, réduit la latence de 20 à 50 fois.
2. **Distillation.**Formez un élève à correspondre à l'enseignant en moins d'étapes: Distillation progressive (2 → 1), Modèles de cohérence (arbitrary → 1-4), LCM, SDXL-Turbo, SD3-Turbo.
3. **Caching and compilation.** `torch.compile(unet, mode="reduce-overhead")`, les arrière-plans de diffusion de TensorRT-LLM,`xformers`Attention SDPA, poids bf16. Coupe de latence par étape ~ 2x.

Pour un serveur de diffusion de production, la conversation budgétaire est la même que celle décrite dans la littérature de production pour les LLM: la latence est `num_steps × step_cost + VAE_decode`, le débit est `batch_size × (num_steps × step_cost)^-1`. Le TTFT est petit (une étape); l'équivalent TPOT est le temps de réponse complet car la génération d'images est " tout à la fois " du point de vue de l'utilisateur.

## Pour en savoir plus

- [Sohl-Dickstein et al. (2015). Deep Unsupervised Learning using Nonequilibrium Thermodynamics](https://arxiv.org/abs/1503.03585) le papier de diffusion, en avance sur son temps.
- [Ho, Jain, Abbeel (2020). Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2006.11239) DDPM.
- [Song, Meng, Ermon (2021). Denoising Diffusion Implicit Models](https://arxiv.org/abs/2010.02502)- DDIM, moins de pas.
- [Nichol & Dhariwal (2021). Improved DDPM](https://arxiv.org/abs/2102.09672)- Le calendrier cosine, la variance apprise.
- [Dhariwal & Nichol (2021). Diffusion Models Beat GANs on Image Synthesis](https://arxiv.org/abs/2105.05233) orientation du classifiateur.
- [Ho & Salimans (2022). Classifier-Free Diffusion Guidance](https://arxiv.org/abs/2207.12598) CFG.
- [Karras et al. (2022). Elucidating the Design Space of Diffusion-Based Generative Models (EDM)](https://arxiv.org/abs/2206.00364) Notation unifiée, recette la plus propre.
