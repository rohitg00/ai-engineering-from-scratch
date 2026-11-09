# GANs  Générateur contre Discriminateur

> Le truc de Goodfellow en 2014 était de sauter la densité entièrement. Deux réseaux. L'un fait des faux. L'autre les attrape. Ils se battent jusqu'à ce que les faux soient indistinguibles du vrai. Cela ne devrait pas fonctionner. Cela ne fonctionne souvent pas. Quand cela se produit, les échantillons sont toujours les plus acérés dans la littérature pour les domaines étroits.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 3 · 02 (Backprop), Phase 3 · 08 (Optimizers), Phase 8 · 02 (VAE)
**Time:** ~75 minutes

## Le problème

Les VAE produisent des échantillons flou parce que leur perte de décodeur MSE est Bayes-optimale pour l'image * moyenne *  et la moyenne de nombreux chiffres plausibles est un chiffre flou. Vous voulez une perte qui récompense * plausibilité*, pas la proximité pixel-wise à une cible. Il n'y a pas de forme fermée pour la plausibilité. Vous devez l'apprendre.

L'idée de Goodfellow: former un classifiateur $D(x)$Pour distinguer les images réelles des fausses.$G(z)$Pour faire la folie$D$- Le signal de perte pour$G$C' est quoi ?$D$Ce signal est mis à jour comme$G$Si les deux réseaux convergent,$G$a appris la distribution des données sans jamais écrire.`log p(x)`- Je suis désolé .

C'est une formation à l'adversité.

```math
\min_G \max_D \; \mathbb{E}_{\text{real}}[\log D(x)] + \mathbb{E}_{\text{fake}}[\log(1 - D(G(z)))]
```

En 2026, les GAN ne sont plus le générateur de SOTA (diffusion et flux de correspondance ont mangé cette couronne). Mais StyleGAN 2/3 reste les modèles de visage les plus acérés jamais expédiés, les discriminateurs GAN sont utilisés comme *persections perceptuelles* dans l'entraînement à la diffusion, et l'entraînement à l'adversité alimente les distillations rapides en 1 étape (SDXL-Turbo, SD3-Turbo, LCM) qui vous permettent d'expédition diffusion en temps réel.

## Le concept

![GAN training: generator and discriminator in minimax](../assets/gan.svg)

**Generator $G(z)$.**Mape un vecteur de bruit $z \sim \mathcal{N}(0, I)$à un échantillon $\hat{x}$Un réseau en forme de décodeur (convecteur dense ou transposé).

**Discriminator $D(x)$.**Mape un échantillon à une probabilité (ou score) scalaire.

**Loss.**Deux mises à jour alternatives:

- **Train $D$:** $\text{loss}_D = -[ \log D(x) + \log(1 - D(G(z))) ]$- Entropie binaire croisée sur réel = 1, faux = 0.
- **Train $G$:** $\text{loss}_G = -\log D(G(z))$C'est la forme non saturante utilisée par Goodfellow (original)$\log(1 - D(G(z)))$saturé et tue les gradients lorsque $D$est confiant).

**Training loop.**Une étape de $D$, une étape de $G$Je répète.

**Why it works.**Si vous$G$Il est parfait .$p_{\text{data}}$Alors ...$D$ne peut pas faire mieux que le hasard et les résultats sont 0,5 partout; $G$Il n'y a plus de gradient.

**Why it breaks.**L'effondrement du mode ($G$trouve un mode $D$Je ne peux pas le classer et le mettre à mort pour toujours, le gradient disparaissant ($D$Il apprend trop vite et $\log D$Les taux d'apprentissage, les tailles de lot, tout ce qui est nécessaire.

## Variantes qui ont permis de faire fonctionner les GAN

| Year | Innovation | Fix |
|------|------------|-----|
| 2015 | DCGAN | Conv/deconv, batch norm, LeakyReLU — the first stable architecture. |
| 2017 | WGAN, WGAN-GP | Replace BCE with Wasserstein distance + gradient penalty. Fixes vanishing gradient. |
| 2017 | Spectral normalization | Lipschitz-bound the discriminator. Still used in 2026 discriminators. |
| 2018 | Progressive GAN | Train low-res first, add layers. First megapixel results. |
| 2019 | StyleGAN / StyleGAN2 | Mapping network + adaptive instance norm. State of the art for fixed-domain photorealism. |
| 2021 | StyleGAN3 | Alias-free, translation-equivariant — still the face gold standard in 2026. |
| 2022 | StyleGAN-XL | Conditional, class-aware, larger scale. |
| 2024 | R3GAN | Rebrands with stronger regularization; works on 1024² without tricks. |

```figure
gan-minimax
```

## Faites-le

`code/main.py`Le générateur et le discriminateur sont des MLP à couche cachée unique. Nous mettons en œuvre la boucle avant, arrière et minimax à la main. L'objectif est de voir les deux modes de défaillance clés (effondrement de mode + gradient de disparition) au fur et à mesure qu'ils se produisent.

### Étape 1: Perte non saturante

La perte de la vanille de Goodfellow .$\log(1 - D(G(z)))$Le gradient de G est essentiellement zéro  G ne peut pas s'améliorer.$-\log D(G(z))$Il est opposé à l'asymptote: il explose quand D est confiant, donnant à G un signal fort.

```python
def g_loss(d_fake):
    # maximize log D(G(z))  <=>  minimize -log D(G(z))
    return -sum(math.log(max(p, 1e-8)) for p in d_fake) / len(d_fake)
```

### Étape 2: une étape discriminatrice par étape génératrice

```python
for step in range(steps):
    # train D
    real_batch = sample_real(batch_size)
    fake_batch = [G(z) for z in sample_noise(batch_size)]
    update_D(real_batch, fake_batch)

    # train G
    fake_batch = [G(z) for z in sample_noise(batch_size)]  # fresh fakes
    update_G(fake_batch)
```

Des faux pour G, sinon les gradients sont obsolètes.

### Étape 3: surveillez l'effondrement du mode

```python
if step % 200 == 0:
    samples = [G(z) for z in sample_noise(500)]
    mode_a = sum(1 for s in samples if s < 0)
    mode_b = 500 - mode_a
    if min(mode_a, mode_b) < 50:
        print("  [!] mode collapse: one mode is starved")
```

Le symptôme canonique: l'un des deux modes réels cesse d'être généré. Le discriminateur cesse de le corriger parce qu'il n'est jamais vu comme faux.

## Les pièges

- **Discriminator too strong.**Réduire le taux d'apprentissage de D de 2 à 5 fois, ou ajouter du bruit d'instance/couche. Si D atteint une précision de > 95%, G est mort.
- **Generator memorizes a mode.**Ajouter du bruit aux entrées D, utiliser une couche de discrimination mini-batch ou passer à WGAN-GP.
- **Batch norm leaking statistics.**Les statistiques sont mélangées par un vrai lot + un faux lot qui traverse la même couche BN.
- **Inception-score gaming.**Les échantillons FID et IS sont bruyants à faible nombre d'échantillons.
- **One-shot sampling is a lie for conditional tasks.**Vous avez encore besoin de balances CFG, de trucs de troncage et de re-échantillonnage pour obtenir des résultats utilisables.

## Utilisez-le

La pile de GAN 2026:

| Situation | Pick |
|-----------|------|
| Photoreal human faces, fixed pose | StyleGAN3 (sharpest, smallest) |
| Anime / stylized faces | StyleGAN-XL or Stable Diffusion LoRA |
| Image-to-image translation | Pix2Pix / CycleGAN (Phase 8 · 04) or ControlNet (Phase 8 · 08) |
| Fast 1-step text-to-image | Adversarial distillation of diffusion (SDXL-Turbo, SD3-Turbo) |
| Perceptual loss inside a diffusion trainer | Small GAN discriminator on image crops |
| Anything multi-modal, open-ended | Don't — use diffusion or flow matching |

Les GAN sont nettes mais étroites. Une fois que votre domaine s'ouvre  photos, des textes arbitraires, des vidéos  passer à la diffusion.

## La faire partir

- Ça va .`outputs/skill-gan-debugger.md`. Skill prend une opération GAN défaillante (curves de perte, grille d'échantillon, taille de jeu de données) et produit une liste classée des causes probables, des corrections à une ligne et un protocole de répétition.

## Exercices

1. **Easy.**On court .`code/main.py`avec les paramètres de stock.`D_LR = 5 * G_LR`La perte de G s'effondre rapidement à une constante.
2. **Medium.**Remplacez la perte de Goodfellow BCE par la perte de WGAN: $\text{loss}_D = \mathbb{E}[D(\text{fake})] - \mathbb{E}[D(\text{real})]$- Je suis là .$\text{loss}_G = -\mathbb{E}[D(\text{fake})]$, et de cliper les poids de D à `[-0.01, 0.01]`- L'entraînement est plus stable ?
3. **Hard.**Extension de l'exemple 1D à des données 2D (mixture de 8 Gaussians sur un anneau). Suivre combien des 8 modes le générateur capture aux étapes 1k, 5k, 10k. Implémenter la discrimination minibatch et re-mesure.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Generator | "G" | Noise-to-sample network, `G: z → x̂`. |
| Discriminator | "D" | Classifier `D: x → [0, 1]`, real vs fake. |
| Minimax | "The game" | $\min_G \max_D$ of a joint objective. |
| Non-saturating loss | "The fix" | Use $-\log D(G(z))$ for G instead of $\log(1 - D(G(z)))$. |
| Mode collapse | "G memorized one thing" | Generator produces few distinct outputs despite diverse data. |
| WGAN | "Wasserstein" | Replace BCE with Earth-Mover distance + gradient penalty; smoother gradient. |
| Spectral norm | "Lipschitz trick" | Constrain D's weight norms to bound its slope; stabilizes training. |
| StyleGAN | "The one that works" | Mapping network + AdaIN; best-in-class for faces, still in 2026. |

## Note de production: l'inférence à un seul coup est l'avantage durable de GAN

Les GAN ne gagnent plus sur la qualité des échantillons pour la génération de domaine ouvert, mais ils gagnent toujours sur le coût de l'inférence.

- **No prefill, no decode stages.**Une seule .$G(z)$TTFT ≈ latence totale.
- **No KV-cache pressure.**La taille du lot est limitée par la mémoire d'activation, pas par le cache.
- **Trivial continuous batching.**Comme chaque demande reçoit les mêmes FLOPs fixes, un lot statique à l'occupation cible du serveur est généralement optimal.

C'est pourquoi la distillation GAN (SDXL-Turbo, SD3-Turbo, ADD, LCM) est la technique dominante pour la transmission rapide de texte à image en 2026: elle effondre un pipeline de diffusion de 20 à 50 étapes en passages avant de 1 à 4 GAN tout en conservant la distribution d'une base de diffusion.

## Pour en savoir plus

- [Goodfellow et al. (2014). Generative Adversarial Nets](https://arxiv.org/abs/1406.2661) le papier original de la GAN.
- [Radford et al. (2015). Unsupervised Representation Learning with DCGAN](https://arxiv.org/abs/1511.06434) la première architecture stable.
- [Arjovsky, Chintala, Bottou (2017). Wasserstein GAN](https://arxiv.org/abs/1701.07875) WGAN.
- [Miyato et al. (2018). Spectral Normalization for GANs](https://arxiv.org/abs/1802.05957) SN.
- [Karras et al. (2020). Analyzing and Improving the Image Quality of StyleGAN](https://arxiv.org/abs/1912.04958) StyleGAN2.
- [Karras et al. (2021). Alias-Free Generative Adversarial Networks](https://arxiv.org/abs/2106.12423) StyleGAN3.
- [Sauer et al. (2023). Adversarial Diffusion Distillation](https://arxiv.org/abs/2311.17042) SDXL-Turbo.
