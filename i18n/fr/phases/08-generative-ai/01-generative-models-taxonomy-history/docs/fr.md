# Modèles génératifs  Taxonomie et histoire

> Chaque modèle d'image, modèle de texte, modèle vidéo et modèle 3D s'adapte à l'un des cinq seins. Choisissez le mauvais seau et vous allez vous battre les mathématiques pendant des semaines. Choisissez le bon et les douze dernières années de progrès du domaine s'accumulent en votre tête.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 2 (ML Fundamentals), Phase 3 (Deep Learning Core), Phase 7 · 14 (Transformers)
**Time:** ~45 minutes

## Le problème

Un modèle génératif ne fait qu'un seul travail: des échantillons de formation donnés tirés d'une distribution inconnue $p_{\text{data}}(x)$Les visages, les phrases, les fichiers MIDI, les structures de protéines, tout le même problème si vous clignez des yeux.

Le problème c' est que ...$p_{\text{data}}$Les échantillons sont situés sur un mince polyvalent à l'intérieur de cet espace, et vous n'avez peut-être que 10 millions d'exemples.

Cinq familles ont survécu au cours des douze dernières années.

## Le concept

![Five families of generative models — taxonomy by what they model](../assets/taxonomy.svg)

**1. Explicit density, tractable.**Écrivez$\log p(x)$Les modèles autorégressifs (PixelCNN, WaveNet, GPT) factorisent$p(x) = \prod_i p(x_i \mid x_{<i})$- normalisation des flux (RNVP, Glow)$p(x)$Les résultats de l'analyse de la base sont les suivants: la probabilité exacte, la perte de formation nette, la déduction autorégressive, la séquence (lente pour les longues séquences), les flux nécessitent des architectures invertibles (architecturellement restrictives).

**2. Explicit density, approximate.**Lié$\log p(x)$Les modèles de diffusion (DDPM, Ho 2020) entraînent un dénonciateur qui optimise implicitement un ELBO pondéré. La diffusion est la colonne vertébrale dominante de l'image, de la vidéo et de la 3D en 2026.

**3. Implicit density.**Sautez complètement la densité; apprenez un générateur $G(z)$qui produit des échantillons et un discriminateur $D(x)$Les GAN (Goodfellow 2014). Rapides à l'inférence (une passe avant) mais notoirement instables pendant l'entraînement. StyleGAN 1/2/3 reste l'état de l'art pour le photoréalisme de domaine fixe (visages, chambres à coucher) même en 2026.

**4. Score-based / continuous-time.**Apprenez le gradient de la densité de la tige $\nabla_x \log p(x)$(le score) directement. Song & Ermon (2019) a montré que le parallèle de score généralise la diffusion à un SDE. Le parallèle de flux (Lipman 2023) est la chaleur 2024-2026: formation sans simulation, chemins plus droits, échantillonnage 4-10 fois plus rapide que le DDPM. Stable Diffusion 3, Flux, AudioCraft 2 utilisent tous le parallèle de flux.

**5. Token-based autoregressive over discrete codes.**Comprimez les données à haute résolution avec un VQ-VAE ou un quantificateur résiduel dans une courte séquence de jetons discrets, puis utilisez un transformateur pour modéliser la séquence de jetons. Parti, MuseNet, AudioLM, VALL-E, le jetonnisateur de correctifs de Sora utilisent tous cela.

## Une brève histoire

| Year | Model | Why it mattered |
|------|-------|-----------------|
| 2013 | VAE (Kingma) | First deep generative model with a usable training loss. |
| 2014 | GAN (Goodfellow) | Implicit density, no likelihood — shockingly sharp samples. |
| 2015 | DRAW, PixelCNN | Sequential image generation. |
| 2017 | Glow, RealNVP | Invertible flows; exact likelihood with depth. |
| 2017 | Progressive GAN | First megapixel faces. |
| 2019 | StyleGAN / StyleGAN2 | Photorealistic faces still hard to beat for that one domain. |
| 2020 | DDPM (Ho) | Diffusion becomes practical. |
| 2021 | CLIP, DALL-E 1, VQGAN | Text-to-image goes mainstream. |
| 2022 | Imagen, Stable Diffusion 1, DALL-E 2 | Latent diffusion + text conditioning = commodity. |
| 2022 | ControlNet, LoRA | Fine control over pretrained diffusion. |
| 2023 | SDXL, Midjourney v5, Flow matching | Scale + better training dynamics. |
| 2024 | Sora, Stable Diffusion 3, Flux.1 | Video diffusion; flow matching wins. |
| 2025 | Veo 2, Kling 1.5, Runway Gen-3, Nano Banana | Production-grade video. |
| 2026 | Consistency + Rectified Flow | One-step sampling from diffusion backbones. |

## Le triage de cinq questions

Lorsque vous trouverez un nouveau modèle génératif, répondez à ces cinq questions avant de lire la section méthode.

1. **What is being modeled?**Pixels, latences, jetons discrets, Gaussians 3D, mailles, formes d'onde ?
2. **Is the density explicit or implicit?**Ils l' écrivent ?$\log p(x)$- Je suis désolé .
3. **Sampling: one-shot or iterative?**Iteratif signifie inférence plus lente; un coup signifie généralement adversarial ou distillé.
4. **Conditioning: unconditional, class, text, image, pose?**Cela détermine la perte et l'échafaudage architectural.
5. **Evaluation: FID, CLIP score, IS, human preference, task accuracy?**Chacun a connu des modes d'échec (voir leçon 14).

Vous répondrez à ces cinq questions à chaque leçon de cette phase.

```figure
autoencoder-bottleneck
```

## Faites-le

Le code de cette leçon est une visualisation légère: adapter un mélange de Gaussins en 1D à partir d'échantillons à l'aide de trois approches de jouets (densité du noyau, histogramme discrète et générateur "GAN-ish" de l'échantillon le plus proche) afin que vous puissiez voir la différence entre la densité explicite et implicite sur un problème que vous pouvez imprimer sur un écran.

On court .`code/main.py`Il tire 2000 échantillons d'un mélange gaussien à deux modes, puis imprime:

```
explicit density (histogram): p(x in [-0.5, 0.5]) ≈ 0.38
approximate density (KDE):     p(x in [-0.5, 0.5]) ≈ 0.41
implicit (nearest-sample gen): 20 new samples printed, no p(x)
```

Remarquez: les deux premières vous permettent de demander "combien est probable ce point?" La troisième ne peut pas. C'est la distinction * explicite vs implicite* qui sera importante pour chaque future leçon.

## Utilisez-le

Quelle famille, pour quelle tâche, en 2026 ?

| Task | Best family | Why |
|------|-------------|-----|
| Photoreal faces, narrow domain | StyleGAN 2/3 | Still sharpest, fastest inference. |
| General text-to-image | Latent diffusion + flow matching | SD3, Flux.1, DALL-E 3. |
| Fast text-to-image | Rectified flow + distillation | SDXL-Turbo, SD3-Turbo, LCM. |
| Text-to-video | Diffusion Transformer + flow matching | Sora, Veo 2, Kling. |
| Speech + music | Token-based AR (AudioLM, VALL-E, MusicGen) or flow matching (AudioCraft 2) | Discrete tokens scale cheaply. |
| 3D scenes | Gaussian Splatting fit, diffusion prior | 3D-GS for reconstruction, diffusion for novel-view. |
| Density estimation (no sampling) | Flows | Only family with exact $\log p(x)$. |
| Simulation / physics | Flow matching, score SDE | Straight-line paths, smooth vector fields. |

## La faire partir

- Je ne sais pas .`outputs/skill-model-chooser.md`- Je suis désolé .

La compétence prend une description de tâche et des résultats: (1) quelle famille utiliser, (2) une liste classée de trois options ouvertes et trois hébergées, (3) le mode de défaillance probable que vous devriez surveiller, et (4) un budget de calcul/temps.

## Exercices

1. **Easy.**Pour chacun de ces cinq produits, identifiez la famille et la colonne vertébrale: image ChatGPT, Midjourney v7, Sora, Runway Gen-3, ElevenLabs.
2. **Medium.**Le journal que vous allez lire demain précise que le prélèvement d'échantillons est 100 fois plus rapide que la diffusion.
3. **Hard.**Prenez un domaine qui vous intéresse (par exemple structure des protéines, CAD, molécules, trajectoires). Répondre au triage de cinq questions pour le modèle SOTA actuel dans ce domaine et dessiner ce qu'un meilleur modèle changerait.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Generative model | "It makes new stuff" | Learns a sampler for $p_{\text{data}}(x)$, optionally exposes $\log p(x)$. |
| Explicit density | "You can evaluate it" | Model provides a closed-form or tractable $\log p(x)$. |
| Implicit density | "GAN-style" | Only a sampler — no way to evaluate $p(x)$ of a given point. |
| ELBO | "Evidence lower bound" | A tractable lower bound on $\log p(x)$; VAEs and diffusion optimize it. |
| Score | "Gradient of log-density" | $\nabla_x \log p(x)$; diffusion and SDE models learn this field. |
| Manifold hypothesis | "Data lives on a surface" | High-dim data concentrates on a low-dim manifold; why dimensionality reduction works. |
| Autoregressive | "Predict the next piece" | Factorize joint as product of conditionals. |
| Latent | "Compressed code" | Low-dim representation from which a decoder can reconstruct the input. |

## Note de production: cinq familles, cinq formes d'inférence

Chaque famille affiche une courbe de coûts différente entre les inférences et les serveurs.

- **Autoregressive (bucket 1 and 5).**Le décode séquentiel domine la latence; le cache KV, le batchage continu et le décode spéculatif s'appliquent tous directement.
- **VAE / diffusion / flow-matching (buckets 2 and 4).**Il n'y a pas de décode au sens de la LLM.`num_steps × step_cost`, et le `step_cost`Les boutons de production sont le nombre d'étapes (DDIM / DPM-Solver / distillation), la taille du lot et la précision (bf16 / fp8 / int4).
- **GAN (bucket 3).**Un pass avant, pas de calendrier, pas de cache KV, TTFT ≈ latence totale, c'est pourquoi StyleGAN gagne toujours sur l'UX de domaine étroit.

Lorsque vous voyez "plus rapide que la diffusion" dans un résumé papier, traduisez-le par "moins de pas × le même coût de la phase" ou "les mêmes étapes × le coût de la phase moins cher".

## Pour en savoir plus

- [Goodfellow et al. (2014). Generative Adversarial Nets](https://arxiv.org/abs/1406.2661) le papier GAN.
- [Kingma & Welling (2013). Auto-Encoding Variational Bayes](https://arxiv.org/abs/1312.6114) le papier de l'AEV.
- [Ho, Jain, Abbeel (2020). Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2006.11239) le document du DDPM.
- [Song et al. (2021). Score-Based Generative Modeling through SDEs](https://arxiv.org/abs/2011.13456) diffusion en tant que SDE.
- [Lipman et al. (2023). Flow Matching for Generative Modeling](https://arxiv.org/abs/2210.02747) le papier de correspondance de débit.
- [Esser et al. (2024). Scaling Rectified Flow Transformers for High-Resolution Image Synthesis](https://arxiv.org/abs/2403.03206) Diffusion stable 3.
