# Autodécodateurs et Autodécodateurs variatifs (VAE)

> Un simple autoencodeur comprime puis reconstruit. Il mémore. Il ne génère pas. Ajoutez une astuce  forcez le code à regarder Gaussian  et vous obtenez un échantillonneur. Cette astuce unique, la réparamétrisation de $z = \mu + \sigma \cdot \epsilon$C'est pourquoi chaque modèle d'image de diffusion latente et de correspondance de flux que vous utilisez en 2026 a un VAE à l'entrée.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 3 · 02 (Backprop), Phase 3 · 07 (CNNs), Phase 8 · 01 (Taxonomy)
**Time:** ~75 minutes

## Le problème

Comprimez un chiffre MNIST de 784 pixels à un code à 16 chiffres, puis reconstruisez. Un autoencodeur simple fera une reconstruction MSE mais l'espace code est un gâchis. Choisissez un point aléatoire dans l'espace code, décodez-le, et vous obtenez du bruit. Il n'a pas de échantillonneur. C'est un modèle de compression habillé.

Ce que vous voulez vraiment, c'est: (a) l'espace de code est une distribution propre et lisse que vous pouvez échantillonner à partir d'un Gaussian isotrope$\mathcal{N}(0, I)$Le codeur et le décodeur comprennent toujours bien. Trois objectifs, une architecture, une perte.

Le VAE 2013 de Kingma résout cette question en formant le codeur à produire une *distribution* $q(z \mid x) = \mathcal{N}(\mu(x), \sigma(x)^2)$, tirant cette distribution vers le prior$\mathcal{N}(0, I)$par une pénalité KL, puis le prélèvement $z$de $q(z \mid x)$Avant de décoder, au moment de l'inférence, laissez tomber le codeur, échantillon $z \sim \mathcal{N}(0, I)$La pénalité KL est ce qui oblige l'espace de code à être structuré.

En 2026, les VAE sont rarement livrés indépendamment  ils ont été dépassés par la diffusion pour la qualité d'image brute  mais ils sont le codeur de choix pour chaque modèle de diffusion latente (SD 1/2/XL/3, Flux, AudioCraft).

## Le concept

![Autoencoder vs VAE: the reparameterization trick](../assets/vae.svg)

**Autoencoder.** $z = \text{encoder}(x)$- Je suis là .$\hat{x} = \text{decoder}(z)$, perte = $\lVert x - \hat{x} \rVert^2$- L'espace de code est non structuré.

**VAE encoder.**Les sorties sont de deux vecteurs: $\mu(x)$et $\log \sigma^2(x)$- Ils définissent ...$q(z \mid x) = \mathcal{N}(\mu, \mathop{\mathrm{diag}}(\sigma^2))$- Je suis désolé .

**Reparameterization trick.**Prise d' échantillons à partir de $q(z \mid x)$L'échantillon est réécrit comme $z = \mu + \sigma \cdot \epsilon$où $\epsilon \sim \mathcal{N}(0, I)$- Maintenant .$z$est une fonction déterministe de $(\mu, \sigma)$+ un bruit non paramétrique  des gradients circulent `μ`et $\sigma$- Je suis désolé .

**Loss.**Les preuves de la base de la base (ELBO), deux termes:

```math
\begin{aligned}
\text{loss} &= \text{reconstruction} + \beta \cdot \mathrm{KL}[q(z \mid x) \,\Vert\, \mathcal{N}(0, I)] \\
&= \lVert x - \hat{x} \rVert^2 + \beta \cdot \sum_i \frac{\sigma_i^2 + \mu_i^2 - \log \sigma_i^2 - 1}{2}
\end{aligned}
```

La reconstruction est en train de pousser $\hat{x}$vers le$x$- KL pousse .$q(z \mid x)$Ils se sont échappés.$\beta$(le secteur de l'énergie)$<1$) = échantillons plus nets, espace de code moins gaussienne.$\beta$(le secteur de l'énergie)$>1$) = espace de code plus propre, échantillons plus flou. β-VAE (Higgins 2017) a rendu ce bouton célèbre et a lancé la recherche sur le démêlage.

**Sampling.**À l' inférence: tirage au sort $z \sim \mathcal{N}(0, I)$Un passage en avant, pas d'échantillonnage itératif comme la diffusion.

```figure
vae-latent-grid
```

## Faites-le

`code/main.py`Il est utilisé pour la mise en œuvre d'un petit VAE sans numpy ou torche. L'entrée est des données synthétiques 8 dimensions tirées d'un mélange gaussien à 2 composants en 8D. L'encodeur et le décodeur sont des MLP à couche cachée unique.

### Étape 1: encodeur vers l'avant

```python
def encode(x, enc):
    h = tanh(add(matmul(enc["W1"], x), enc["b1"]))
    mu = add(matmul(enc["W_mu"], h), enc["b_mu"])
    log_sigma2 = add(matmul(enc["W_sig"], h), enc["b_sig"])
    return mu, log_sigma2
```

$\log \sigma^2$Au lieu de $\sigma$Ainsi, la sortie du réseau est sans contrainte (softplus de σ est un piège  gradients meurent à $\sigma \approx 0$)

### Étape 2: réparamétrifier et décoder

```python
def reparameterize(mu, log_sigma2, rng):
    eps = [rng.gauss(0, 1) for _ in mu]
    sigma = [math.exp(0.5 * lv) for lv in log_sigma2]
    return [m + s * e for m, s, e in zip(mu, sigma, eps)]

def decode(z, dec):
    h = tanh(add(matmul(dec["W1"], z), dec["b1"]))
    return add(matmul(dec["W_out"], h), dec["b_out"])
```

### Étape 3: l'ELBO

```python
def elbo(x, x_hat, mu, log_sigma2, beta=1.0):
    recon = sum((a - b) ** 2 for a, b in zip(x, x_hat))
    kl = 0.5 * sum(math.exp(lv) + m * m - lv - 1 for m, lv in zip(mu, log_sigma2))
    return recon + beta * kl, recon, kl
```

Il est vrai que les deux distributions sont gaussiennes, mais ne sont pas intégrées numériquement.

### Étape 4: générer

```python
def sample(dec, z_dim, rng):
    z = [rng.gauss(0, 1) for _ in range(z_dim)]
    return decode(z, dec)
```

C'est le modèle génératif.

## Les pièges

- **Posterior collapse.**Les lecteurs à terme KL $q(z \mid x) \to \mathcal{N}(0, I)$si agressivement que $z$ne contient aucune information sur $x$- Réparation: β-annulation (début $\beta=0$, rampe à 1), bits libres, ou sauter le KL sur les dimensions inactives.
- **Blurry samples.**La probabilité du décodeur gaussien implique la reconstruction de l'ESM, qui est Bayes-optimale pour L2 (la moyenne)  la moyenne d'un ensemble de chiffres plausibles est un chiffre flou. Fix: décodeur discrète (VQ-VAE, NVAE), ou utiliser le VAE uniquement comme un encodeur et diffusion en pile sur les latents (c'est ce que fait Stable Diffusion).
- **β too large, too early.**Voir l'effondrement postérieur.$\beta \approx 0.01$et la rampe.
- **Latent dim too small.**Le 16D fonctionne pour le MNIST, le 256-D pour l'ImageNet 2562, le 2048-D pour l'ImageNet 10242.

## Utilisez-le

Le groupe VAE 2026:

| Situation | Pick |
|-----------|------|
| Image-latent encoder for diffusion | Stable Diffusion VAE (`sd-vae-ft-ema`) or Flux VAE |
| Audio-latent encoder | Encodec (Meta), SoundStream, or DAC (Descript) |
| Video latents | Sora's spatiotemporal patches, Latte VAE, WAN VAE |
| Disentangled representation learning | β-VAE, FactorVAE, TCVAE |
| Discrete latents (for transformer modelling) | VQ-VAE, RVQ (ResidualVQ) |
| Continuous latents for generation | Plain VAE, then condition a flow/diffusion model in that latent space |

Un modèle de diffusion latente est un modèle de diffusion VAE avec un modèle de diffusion vivant entre un encodeur et un décodeur. Le modèle de diffusion fait la compression grossière, le modèle de diffusion fait le travail lourd.

## La faire partir

- Ça va .`outputs/skill-vae-trainer.md`- Je suis désolé .

Les compétences requises: profil de l'ensemble de données + cible latente-dim + utilisation en aval (reconstruction, échantillonnage ou entrée de diffusion latente) et les résultats: choix d'architecture (plain/β/VQ/RVQ), horaire β, latente dim, probabilité de décoder (Gaussian vs catégorique), et plan d'évaluation (recon MSE, KL par dim, distance Fréchet entre $q(z \mid x)$et $\mathcal{N}(0, I))$- Je suis désolé .

## Exercices

1. **Easy.**Le changement$\beta$dans `code/main.py`à `0.01`- Je suis là .`0.1`- Je suis là .`1.0`- Je suis là .`5.0`- Enregistrer la reconstruction finale de l' MSE et du KL.$\beta$Pareto est-il le meilleur pour vos données synthétiques ?
2. **Medium.**Remplacez la probabilité du décodeur gaussien par une probabilité de Bernoulli (perte de croisée entropie).
3. **Hard.**Extension `code/main.py`en mini VQ-VAE: remplacez le continu $z$Comparer la reconstruction MSE et indiquer le nombre d'entrées utilisées (l'effondrement du codebook est réel).

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Autoencoder | Encode-decode network | $x \to z \to \hat{x}$, learn MSE. Not generative. |
| VAE | AE with a sampler | Encoder outputs a distribution, KL penalty shapes code space. |
| ELBO | Evidence lower bound | $\log p(x) \ge \text{recon} - \mathrm{KL}[q(z \mid x) \Vert p(z)]$; tight when $q = p(z \mid x)$. |
| Reparameterization | $z = \mu + \sigma \cdot \epsilon$ | Rewrites stochastic node as deterministic + pure noise. Enables backprop through sampling. |
| Prior | $p(z)$ | Target distribution for the latent, typically $\mathcal{N}(0, I)$. |
| Posterior collapse | "KL term wins" | Encoder ignores $x$, outputs the prior; decoder must hallucinate. |
| β-VAE | Tunable KL weight | $\text{loss} = \text{recon} + \beta \cdot \mathrm{KL}$. Higher $\beta$ = more disentangled but blurrier. |
| VQ-VAE | Discrete latent | Replace continuous $z$ with nearest codebook vector; enables transformer modelling. |

## Note de production: le VAE est le chemin le plus chaud dans un serveur de diffusion

Dans un pipeline Stable Diffusion / Flux / SD3, le VAE est appelé deux fois par demande  une fois pour encoder (si vous faites img2img / inpainting) et une fois pour décoder.`128×128×16`Les latents sont de retour à `1024×1024×3`- Deux conséquences pratiques:

- **Slice or tile the decode.** `diffusers`exposés `pipe.vae.enable_slicing()`et `pipe.vae.enable_tiling()`- Le Tiling négocie un petit artefact de couture pour$O(\text{tile}^2)$mémoire au lieu de $O(H \cdot W)$- Essentiel pour 10242+ sur les GPU de consommation.
- **bf16 decoder, fp32 numerics for the final resize.**Le SD 1.x VAE a été libéré en fp32 et *produit silencieusement des NaNs* lorsqu'il est jeté à fp16 à 10242+.`madebyollin/sdxl-vae-fp16-fix` préférer toujours la variante fp16-fix ou utiliser bf16.

## Pour en savoir plus

- [Kingma & Welling (2013). Auto-Encoding Variational Bayes](https://arxiv.org/abs/1312.6114) le papier de l'AEV.
- [Higgins et al. (2017). β-VAE: Learning Basic Visual Concepts with a Constrained Variational Framework](https://openreview.net/forum?id=Sy2fzU9gl) β-VAE démêlé.
- [van den Oord et al. (2017). Neural Discrete Representation Learning](https://arxiv.org/abs/1711.00937) VQ-VAE.
- [Vahdat & Kautz (2021). NVAE: A Deep Hierarchical Variational Autoencoder](https://arxiv.org/abs/2007.03898) l'image de pointe de l'AEV.
- [Rombach et al. (2022). High-Resolution Image Synthesis with Latent Diffusion Models](https://arxiv.org/abs/2112.10752) Diffusion stable; VAE en tant qu'encodeur.
- [Défossez et al. (2022). High Fidelity Neural Audio Compression](https://arxiv.org/abs/2210.13438) Encodec, la norme audio VAE.
