# StyleGAN

> La plupart des générateurs se déplacent .$z$StyleGAN le partage: première carte$z$à un intermédiaire $w$, puis * injecter *$w$Ce changement unique a démêlé l'espace latent et fait des visages photoréalistes un problème résolu pendant sept ans consécutifs.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 03 (GANs), Phase 4 · 08 (Normalization), Phase 3 · 07 (CNNs)
**Time:** ~45 minutes

## Le problème

Une carte DCGAN $z$Le problème:$z$Il contrôle tout  pose, éclairage, identité, arrière-plan  entrelacés.$z$Vous ne pouvez pas demander au modèle "la même personne, une pose différente" parce que la représentation ne fait pas de facteur de cette façon.

Karras et coll. (2019, NVIDIA) proposé: arrêter l'alimentation $z$- Envoyez une constante.`4×4×512`Apprenez à utiliser un MLP à 8 couches qui cartographient$z \in Z \to w \in W$- Injecter$w$à chaque résolution via * normalisation d'instance adaptative* (AdaIN): normaliser chaque carte de caractéristiques conv, puis élargir et déplacer par des projections affine de $w$. Ajouter le bruit par couche pour les détails stochastiques (pores de peau, fils de cheveux).

Le résultat: $W$Il a des axes orthogonaux pour "style de haut niveau" (position, identité) vs "style fine" (éclairage, couleur). Vous pouvez échanger des styles entre deux images en utilisant l'image A $w$pour les niveaux de résolution basse et les images B $w$Cette édition déverrouillée, la stylisation interdomaine et toute la ligne de recherche "StyleGAN-inversion".

## Le concept

![StyleGAN: mapping network + AdaIN + per-layer noise](../assets/stylegan.svg)

**Mapping network.** $f: Z \to W$, une MLP de 8 couches.$Z = \mathcal{N}(0, I)^{512}$- Je suis là .$W$Il apprend une forme adaptée aux données.

**Synthesis network.**Commence par une constante apprise .`4×4×512`. Chaque bloc de résolution: `upsample → conv → AdaIN(w_i) → noise → conv → AdaIN(w_i) → noise`- Les résolutions doubles: 4, 8, 16, 32, 64, 128, 256, 512, 1024.

**AdaIN.**

```math
\mathop{\mathrm{AdaIN}}(x, y) = y_{\text{scale}} \cdot \frac{x - \mathop{\mathrm{mean}}(x)}{\mathop{\mathrm{std}}(x)} + y_{\text{bias}}
```

où $y_{\text{scale}}$et $y_{\text{bias}}$proviennent de projections affine de $w$Normalement par carte de fonctionnalités, puis re-style. "Style" ici est la statistique de premier et deuxième ordre de la carte de fonctionnalités.

**Per-layer noise.**Le bruit gaussien à canal unique est ajouté à chaque carte de fonctionnalités, mesuré par un facteur par canal appris.

**Truncation trick.**À l'inférence, échantillon $z$, calcul$w = \text{mapping}(z)$Alors ...$w' = \hat{w} + \psi \cdot (w - \hat{w})$où $\hat{w}$est la moyenne $w$sur de nombreux échantillons. $\psi < 1$La qualité est la plus importante de toutes les démo de StyleGAN.$\psi \approx 0.7$- Je suis désolé .

## StyleGAN 1 → 2 → 3

| Version | Year | Innovation |
|---------|------|------------|
| StyleGAN | 2019 | Mapping network + AdaIN + noise + progressive growing. |
| StyleGAN2 | 2020 | Weight demodulation replaces AdaIN (fixes droplet artifacts); skip/residual architecture; path-length regularization. |
| StyleGAN3 | 2021 | Alias-free convolution + equivariant kernels; eliminates texture sticking to pixel grid. |
| StyleGAN-XL | 2022 | Class-conditional, 1024², ImageNet. |
| R3GAN | 2024 | Rebrands with stronger reg; closes gap to diffusion on FFHQ-1024 with 20x fewer params. |

En 2026, StyleGAN3 reste la norme par défaut pour (a) le photoréalisme de domaine étroit à haute FPS, (b) l'adaptation de domaine à quelques coups (train sur un nouveau ensemble de données avec 100 images, cartographie de congé), (c) l'édition basée sur l'inversion (trouver les $w$qui reconstruit une photo réelle, puis édite cette photo $w$Pour le domaine ouvert text-to-image, ce n'est pas l'outil  diffusion est.

```figure
gx-stylegan-mapping
```

## Faites-le

`code/main.py`Il implémentera un jouet "style-GAN lite" en 1-D: une MLP de cartographie, une fonction de synthèse qui prend un vecteur constant appris et le module avec $w$- des préjugés de l'échelle et du bruit par couche.$w$par correspondance ou par battements concatenant$z$dans l'entrée du générateur.

### Étape 1: réseau de cartographie

```python
def mapping(z, M):
    h = z
    for i in range(num_layers):
        h = leaky_relu(add(matmul(M[f"W{i}"], h), M[f"b{i}"]))
    return h
```

### Étape 2: normalisation de l'instance adaptative

```python
def adain(x, w_scale, w_bias):
    mu = mean(x)
    sd = std(x)
    x_norm = [(xi - mu) / (sd + 1e-8) for xi in x]
    return [w_scale * xi + w_bias for xi in x_norm]
```

L'échelle et le biais des cartes de fonctionnalités proviennent de $w$par projection linéaire.

### Étape 3: bruit par couche

```python
def add_noise(x, sigma, rng):
    return [xi + sigma * rng.gauss(0, 1) for xi in x]
```

Sigma par canal est appréciable.

## Les pièges

- **Droplet artifacts.**StyleGAN 1 a produit une goutte de flou dans les cartes fonctionnalités parce que AdaIN a réduit à zéro la moyenne.
- **Texture sticking.**Les textures StyleGAN 1 et 2 suivaient les coordonnées de pixel, pas les coordonnées d'objet (visibles lors de l'interpolation).
- **Mode coverage.**La découpe`ψ < 0.7`est propre mais des échantillons d' un cône étroit; utilisation `ψ = 1.0`Si vous avez besoin de diversité.
- **Inversion is lossy.**Inverter une photo réelle dans $W$Les résultats dérivent sur de nombreuses itérations.

## Utilisez-le

| Use case | Approach |
|----------|----------|
| Photoreal human faces (anime, product, narrow) | StyleGAN3 FFHQ / custom fine-tune |
| Face editing from a photo | e4e inversion + StyleSpace / InterFaceGAN directions |
| Face swap / reenactment | StyleGAN + encoder + blending |
| Avatar pipelines | StyleGAN3 w/ ADA for low-data fine-tune |
| Domain adaptation from a few images | Freeze mapping network, fine-tune synthesis |
| Multi-modal or text-conditioned generation | Don't — use diffusion |

Pour les démos de qualité produit où la réponse est "photo du visage d'une personne", StyleGAN dépasse la diffusion sur le coût d'inférence (pass avant unique, <10ms sur un 4090) et la netteté pour la même barre de qualité.

## La faire partir

- Ça va .`outputs/skill-stylegan-inversion.md`. Les compétences prennent une photo réelle et les résultats: méthode d'inversion (e4e / ReStyle / HyperStyle), perte latente attendue, budget d'édition (combien de temps dans $W$Vous pouvez vous déplacer avant les objets), et une liste de bonnes directions d'édition connues (âge, expression, pose).

## Exercices

1. **Easy.**On court .`code/main.py`avec `adain_on=True`et `adain_on=False`Comparer la propagation des sorties pour un latent fixe versus un latent perturbé.
2. **Medium.**Implémentation de la régulation des mélanges: pour un lot de formation, calcul $w_a$- Je suis là .$w_b$, et s' appliquer $w_a$pour la première moitié de la synthèse et $w_b$Le décodeur apprend-il les styles démêlés ?
3. **Hard.**Prenez un modèle de styleGAN3 FFHQ prétrainé (ffhq-1024.pkl).$w$Direction qui contrôle le "sourire" en formant un SVM sur des échantillons étiquetés; indiquer jusqu'où vous pouvez aller avant que les dérives d'identité.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Mapping network | "The MLP" | $f: Z \to W$, 8 layers, decouples latent geometry from data statistics. |
| W space | "The style space" | Output of the mapping network; roughly disentangled. |
| AdaIN | "Adaptive instance norm" | Normalize feature map, then scale + shift by $w$-projection. |
| Truncation trick | "Psi" | $w = \text{mean} + \psi \cdot (w - \text{mean})$, $\psi<1$ trades diversity for quality. |
| Path-length regularization | "PL reg" | Penalizes large changes in image per unit change in $w$; makes $W$ smoother. |
| Weight demodulation | "The StyleGAN2 fix" | Normalize conv weights instead of activations; kills droplet artifacts. |
| Alias-free | "StyleGAN3's trick" | Windowed sinc filters; eliminates texture sticking to the pixel grid. |
| Inversion | "Find w for a real image" | Optimize or encode $x \to w$ so $G(w) \approx x$. |

## Note de production: pourquoi StyleGAN est toujours livré en 2026

StyleGAN3 sur un 4090 génère un visage de 10242 FFHQ en moins de 10 ms  `num_steps = 1`En termes de production, c'est la latence de sol pour tout générateur d'image. Un pipeline de décode SDXL + VAE de 50 étapes à la même résolution est d'environ 3 secondes.**300× gap**, et pour les produits de domaine étroit (services d'avatar, lignes de documents d'identification, génération de stock face) il gagne sur TCO.

Deux conséquences opérationnelles:

- **No scheduler, no batcher.**Le lot statique à l'occupation cible est optimal. Le lotage continu (essentiel pour les LLM et la diffusion) offre un bénéfice nul car chaque demande reçoit les mêmes FLOP.
- **Truncation `ψ` is the safety knob.** `ψ < 0.7`Les échantillons de la couche de l'échantillon sont obtenus à partir d'un cône étroit de la plage du réseau de cartographie.`ψ`à la charge maximale, le lever pour les utilisateurs premium.

## Pour en savoir plus

- [Karras et al. (2019). A Style-Based Generator Architecture for GANs](https://arxiv.org/abs/1812.04948) StyleGAN.
- [Karras et al. (2020). Analyzing and Improving the Image Quality of StyleGAN](https://arxiv.org/abs/1912.04958) StyleGAN2.
- [Karras et al. (2021). Alias-Free Generative Adversarial Networks](https://arxiv.org/abs/2106.12423) StyleGAN3.
- [Tov et al. (2021). Designing an Encoder for StyleGAN Image Manipulation](https://arxiv.org/abs/2102.02766) inversion e4e.
- [Sauer et al. (2022). StyleGAN-XL: Scaling StyleGAN to Large Diverse Datasets](https://arxiv.org/abs/2202.00273) StyleGAN-XL.
- [Huang et al. (2024). R3GAN: The GAN is dead; long live the GAN!](https://arxiv.org/abs/2501.05441) Récipitatif minimal moderne de GAN.
