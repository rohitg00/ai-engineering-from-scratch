# GANs conditionnels et Pix2Pix

> La première grande déblocage de 2014-2017 était de contrôler ce qu'une GAN fait. Attachez une étiquette, ou une image, ou une phrase. Pix2Pix a fait la version d'image et il bat toujours tous les modèles génériques texte-à-image sur les tâches étroites image-à-image.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 03 (GANs), Phase 4 · 06 (U-Net), Phase 3 · 07 (CNNs)
**Time:** ~75 minutes

## Le problème

Un GAN inconditionnel échantillonne des visages arbitraires. Utilisés pour une démonstration, inutiles dans la production. Vous voulez: *mappage d'une esquisse à une photo*, *mappage d'une carte à une photo aérienne*, *mappage d'une scène de jour à la nuit*, *colorer une image à l'échelle de gris*. Dans toutes ces images, vous obtenez une image d'entrée$x$et doit sortir $y$Il y a beaucoup de choses plausibles.$y$C' est par .$x$Une défaite adversaire ne le fait pas, car "il semble réel" est fort.

Le GAN conditionnel (Mirza & Osindero, 2014) ajoute une condition $c$comme une entrée pour les deux $G$et $D$Pix2Pix (Isola et coll., 2017) a spécialisé ceci: condition est une image d'entrée complète, générateur est un U-Net, discriminateur est un classifiateur * patch-based* (PatchGAN), et perte est adversarial + L1. Cette recette surpasse les modèles de texte à image de zéro sur des domaines image à image étroits même en 2026 car elle est formée sur * données en paires *  vous avez exactement le signal dont vous avez besoin.

## Le concept

![Pix2Pix: U-Net generator, PatchGAN discriminator](../assets/pix2pix.svg)

**Conditional G.** $G(x, z) \to y$Dans Pix2Pix,$z$est dérapagé à l'intérieur de G (aucun bruit d'entrée  Isola trouvé le bruit explicite a été ignoré).

**Conditional D.** $D(x, y) \to [0, 1]$. L'entrée est la paire (condition, sortie).$y$est compatible avec $x$, pas seulement si $y$Ça a l'air réel.

**U-Net generator.**Encoder-décoeur avec des connexions de saut à travers le goulet d'étranglement. Critical pour les tâches où l'entrée et la sortie partagent une structure de bas niveau (marges, silhouette). Sans les sauts, les détails à haute fréquence disparaissent.

**PatchGAN discriminator.**Au lieu de produire un seul score réel/faux, D produit un $N \times N$La moyenne est de 70×70 pixels. C'est une hypothèse de champ aléatoire de Markov: le réalisme est local.

**Loss.**

```math
\begin{aligned}
\text{loss}_G &= -\log D(x, G(x)) + \lambda \cdot \lVert y - G(x) \rVert_1 \\
\text{loss}_D &= -\log D(x, y) - \log(1 - D(x, G(x)))
\end{aligned}
```

Le terme L1 stabilise l'entraînement et pousse G vers la cible connue. L1 donne des bords plus tranchants que L2 (médians, pas moyens). $\lambda = 100$était le Pix2Pix par défaut.

## CycleGAN  lorsque vous n'avez pas de paires

Pix2Pix a besoin d' être couplé $(x, y)$Les données. CycleGAN (Zhu et coll., 2017) réduit cette exigence au prix d'une perte supplémentaire: la perte de la cohérence du cycle.$G: X \to Y$et $F: Y \to X$- Les entraîner ainsi .$F(G(x)) \approx x$et $G(F(y)) \approx y$Cela vous permet de traduire des chevaux en zèbres, en été en hiver, sans exemples parallèles.

En 2026, l'image-à-image non couplée est principalement réalisée via diffusion (ControlNet, IP-Adapter) plutôt que CycleGAN, mais l'idée de cohérence de cycle survit dans presque tous les documents d'adaptation de domaine non couplés.

```figure
gx-patchgan
```

## Faites-le

`code/main.py`Il met en œuvre une petite GAN conditionnelle sur les données 1D.$c$est une étiquette de classe (0 ou 1). La tâche: produire un échantillon à partir de la distribution conditionnelle pour la classe donnée.

### Étape 1: ajouter la condition aux entrées G et D

```python
def G(z, c, params):
    return mlp(concat([z, one_hot(c)]), params)

def D(x, c, params):
    return mlp(concat([x, one_hot(c)]), params)
```

Le codage à un seul coup est le moyen le plus simple.

### Étape 2: train conditionné

```python
for step in range(steps):
    x, c = sample_real_conditional()
    noise = sample_noise()
    update_D(x_real=x, x_fake=G(noise, c), c=c)
    update_G(noise, c)
```

Le générateur doit correspondre à la réelle distribution *pour la condition donnée*, et non à la marginale.

### Étape 3: vérifier la sortie par classe

```python
for c in [0, 1]:
    samples = [G(noise, c) for noise in batch]
    mean_c = mean(samples)
    assert_near(mean_c, real_mean_for_class_c)
```

## Les pièges

- **Condition ignored.**G apprend à se marginaliser, D ne pénalise jamais parce que le signal de condition est faible.
- **L1 weight too low.**G dérive vers des résultats d'apparence réelle arbitraire, pas fidèles.$\lambda \approx 100$pour les tâches de style Pix2Pix.
- **L1 weight too high.**G produit des sorties floues parce que L1 est toujours un $L_p$La douche est en bas une fois que l'entraînement est stabilisé.
- **Ground-truth leakage in D.**Concaténate $(x, y)$comme entrée D, pas seulement $y$Sans ce D, on ne peut pas vérifier la cohérence.
- **Mode collapse per class.**Chaque classe peut s'effondrer indépendamment.

## Utilisez-le

2026 état des tâches image à image:

| Task | Best approach |
|------|---------------|
| Sketch → photo, same domain, paired data | Pix2Pix / Pix2PixHD (still fast, still sharp) |
| Sketch → photo, unpaired | ControlNet with a Scribble conditioning model |
| Semantic seg → photo | SPADE / GauGAN2 or SD + ControlNet-Seg |
| Style transfer | Diffusion with IP-Adapter or LoRA; GAN methods are legacy |
| Depth → photo | ControlNet-Depth over Stable Diffusion |
| Super-resolution | Real-ESRGAN (GAN), ESRGAN-Plus, or SD-Upscale (diffusion) |
| Colorization | ColTran, diffusion-based colorizers, or Pix2Pix-color |
| Daytime → nighttime, seasons, weather | CycleGAN or ControlNet-based |

Pix2Pix reste l'outil idéal lorsque (a) vous avez des milliers d'exemples en couple, (b) la tâche est étroite et répétable, et (c) vous avez besoin d'une inférence rapide.

## La faire partir

- Ça va .`outputs/skill-img2img-chooser.md`. Les compétences prennent une description de tâche, la disponibilité des données (parées contre non parées, échantillons N) et le budget de latence/qualité, puis les sorties: approche (Pix2Pix, CycleGAN, variante ControlNet, SDXL + IP-Adapter), exigences de données de formation, coût d'inférence et protocole d'évaluation (LPIPS, FID, spécifique à la tâche).

## Exercices

1. **Easy.**Modifier `code/main.py`Confirmer G maps toujours le bruit de chaque classe au bon mode.
2. **Medium.**Remplacez L1 par une perte de style perceptif dans le réglage 1-D (par exemple, un petit D gelé agissant comme extracteur de caractéristiques).
3. **Hard.**Dessinez un CycleGAN dans le réglage 1D: deux distributions, deux générateurs, perte de cycle. Montrez qu'il apprend à cartographier entre eux sans données en couple.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Conditional GAN | "GAN with labels" | G(z, c), D(x, c). Both networks see the condition. |
| Pix2Pix | "Image-to-image GAN" | Paired cGAN with U-Net G and PatchGAN D + L1 loss. |
| U-Net | "Encoder-decoder with skips" | Symmetric conv network; skips preserve high-freq. |
| PatchGAN | "Local-realism classifier" | D outputs per-patch score instead of global score. |
| CycleGAN | "Unpaired image translation" | Two G's + cycle-consistency loss; no paired data. |
| SPADE | "GauGAN" | Normalizes intermediate activations with the semantic map; segmentation-to-image. |
| FiLM | "Feature-wise linear modulation" | Per-feature affine transform from the condition; cheap conditioning. |

## Note de production: Pix2Pix comme ligne de base liée à la latence

Lorsque vous avez associé des données et une tâche étroite (boutons → rendu, carte sémantique → photo, jour → nuit), l'inférence à un seul coup de Pix2Pix bat la diffusion d'un ordre de grandeur sur la latence.

| Path | Steps | Typical latency at 512² on a single L4 |
|------|-------|----------------------------------------|
| Pix2Pix (U-Net forward) | 1 | ~30 ms |
| SD-Inpaint or SD-Img2Img | 20 | ~1.2 s |
| SDXL-Turbo Img2Img | 1-4 | ~0.15-0.35 s |
| ControlNet + SDXL base | 20-30 | ~3-5 s |

Pix2Pix gagne sur le débit en lots statiques (toute demande est la même FLOPs). Diffusion gagne sur la qualité et la généralisation. Le jeu moderne est souvent d'envoyer un modèle distillé de style Pix2Pix pour la tâche étroite et une rétroaction de diffusion pour les entrées de queue.

## Pour en savoir plus

- [Mirza & Osindero (2014). Conditional Generative Adversarial Nets](https://arxiv.org/abs/1411.1784) le papier cGAN.
- [Isola et al. (2017). Image-to-Image Translation with Conditional Adversarial Networks](https://arxiv.org/abs/1611.07004)- Pix2Pix.
- [Zhu et al. (2017). Unpaired Image-to-Image Translation using Cycle-Consistent Adversarial Networks](https://arxiv.org/abs/1703.10593) CycleGAN.
- [Wang et al. (2018). High-Resolution Image Synthesis with Conditional GANs](https://arxiv.org/abs/1711.11585) Pix2PixHD.
- [Park et al. (2019). Semantic Image Synthesis with Spatially-Adaptive Normalization](https://arxiv.org/abs/1903.07291)- Le coup de foudre.
- [Miyato & Koyama (2018). cGANs with Projection Discriminator](https://arxiv.org/abs/1802.05637) la projection D.
