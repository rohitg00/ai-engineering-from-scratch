# Diffusion latente et diffusion stable

> La diffusion de l'espace-pixel sur 512 × 512 images est un crime de guerre informatique. Rombach et coll. (2022) ont remarqué que vous n'avez pas besoin de toutes les dimensions 786k pour générer une image  vous avez besoin de suffisamment pour capturer la structure sémantique, et un décodeur séparé pour le reste.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 02 (VAE), Phase 8 · 06 (DDPM), Phase 7 · 09 (ViT)
**Time:** ~75 minutes

## Le problème

La diffusion de l' espace-pixel à 5122 signifie que le réseau U fonctionne sur des tensors de forme .`[B, 3, 512, 512]`Chaque étape d'échantillonnage est d'environ 100 GFLOPS pour un U-Net de 500M. 50 étapes sont 5 TFLOPS par image.

La plupart de ces FLOPs vont pousser des détails perceptiblement sans importance à travers le net  la texture à haute fréquence qu'un VAE perdant pourrait compresser. L'idée de Rombach: entraîner un VAE une fois (le * premier stade*), le geler, et exécuter la diffusion entièrement dans l'espace latent 64×64 à 4 canaux (le * deuxième stade*). Le même U-Net. 1/16 des pixels. ~ 64x moins de FLOPs pour une qualité comparable.

C'est la recette de diffusion stable. SD 1.x / 2.x a utilisé un U-Net de 860M sur `64×64×4`Les données de l'U-Net sont en cours de révision.`128×128×4`Le flux de la technologie est basé sur le flux de la technologie de diffusion.

## Le concept

![Latent diffusion: VAE compression + diffusion in latent space](../assets/latent-diffusion.svg)

**Two stages, separately trained.**

1. **Stage 1 — VAE.**Le codeur $E(x) \to z$, décodeur $D(z) \to x$. Compression cible: 8 fois échantillon en bas dans chaque axe spatial + réglage des canaux de sorte que la taille totale latente soit ~1/16e du nombre de pixels. Perte = reconstruction (L1 + LPIPS perceptuelle) + KL (peut-être faible poids)$z$n'est pas forcé trop Gaussian, parce que nous n'avons pas besoin de prélèvement exact de $z$Les images décodées sont souvent nettes.

2. **Stage 2 — diffusion on $z$.**Traiter$z = E(x_{\text{real}})$En effet, les données sont les données de l'entreprise.$z_t$- À l' inférence: échantillon $z_0$par diffusion, alors $x = D(z_0)$- Je suis désolé .

**Text conditioning.**Deux composants supplémentaires: un encodeur de texte gelé (CLIP-L pour SD 1.x, CLIP-L+OpenCLIP-G pour SD 2/XL, T5-XXL pour SD3 et Flux).`[Q = image features, K = V = text tokens]`Les jetons sont la seule façon dont le texte influence l'image.

**The loss function is identical to Lesson 06.**Le même DDPM / flux correspondant MSE sur le bruit. Vous changez simplement le domaine de données.

## Variantes d'architecture

| Model | Year | Backbone | Latent shape | Text encoder | Params |
|-------|------|----------|--------------|--------------|--------|
| SD 1.5 | 2022 | U-Net | 64×64×4 | CLIP-L (77 tokens) | 860M |
| SD 2.1 | 2022 | U-Net | 64×64×4 | OpenCLIP-H | 865M |
| SDXL | 2023 | U-Net + refiner | 128×128×4 | CLIP-L + OpenCLIP-G | 2.6B + 6.6B |
| SDXL-Turbo | 2023 | Distilled | 128×128×4 | same | 1-4 step sampling |
| SD3 | 2024 | MMDiT (multimodal DiT) | 128×128×16 | T5-XXL + CLIP-L + CLIP-G | 2B / 8B |
| Flux.1-dev | 2024 | MMDiT | 128×128×16 | T5-XXL + CLIP-L | 12B |
| Flux.1-schnell | 2024 | MMDiT distilled | 128×128×16 | T5-XXL + CLIP-L | 12B, 1-4 step |

La tendance: remplacer U-Net par DiT (transformateur sur les patches latentes), élargir le codeur de texte (T5 dépasse CLIP pour une adhésion rapide), augmenter les canaux latents (4 → 16 donne plus de place aux détails).

```figure
noise-schedule
```

## Faites-le

`code/main.py`Il ajoute un jouet 1-D "VAE" (un encodeur à échelle fixe par 0,5 et son inverse exact comme décodeur, pour la démonstration; un vrai VAE serait un convnet) sur le dessus du DDPM de la leçon 06 et ajoute un conditionnement de classe avec une orientation sans classifiant. Il montre que la même perte de diffusion fonctionne que vous exécutez sur des valeurs 1D brutes ou sur des valeurs codées. C'est l'idée clé.

### Étape 1: codeur/décodeur

```python
def encode(x):    return x * 0.5          # toy "compression" to smaller scale
def decode(z):    return z * 2.0
```

Pour la pédagogie, cette carte linéaire suffit à montrer que la diffusion opère sur$z$sans se soucier de l'espace de données original.

### Étape 2: diffusion dans `z`- l'espace

Le même DDPM que la leçon 06.$z = E(x)$Après le prélèvement$z_0$, décodez avec $D(z_0)$- Je suis désolé .

### Étape 3: orientation sans classifiant

Pendant la formation, laissez tomber l'étiquette de classe 10% du temps (replacez-la par un jeton nul).$\epsilon_{\text{cond}}$et $\epsilon_{\text{uncond}}$, puis:

```python
eps_cfg = (1 + w) * eps_cond - w * eps_uncond
```

$w = 0$= aucune orientation (plénière diversité), $w = 3$= par défaut, $w = 7+$= saturée / trop tranchante.

### Étape 4: conditionnement du texte (concept, pas code)

Remplacez l'étiquette de classe par une sortie d'encodeur de texte gelé.

```python
h = h + CrossAttention(Q=h, K=text_embed, V=text_embed)
```

C'est la seule différence substantielle entre un modèle de diffusion classé et une diffusion stable.

## Les pièges

- **VAE-scale mismatch.**SD 1.x VAEs ont une constante d'échelle (`scaling_factor ≈ 0.18215`L'oubli de cela fait que le train U-Net est en latences avec une variance très fausse.
- **Text encoder silently wrong.**SD3 a besoin de T5-XXL avec >=128 jetons, et le retour à CLIP-seulement est perçu.`use_t5=True`ou des cratères de fidélité rapides.
- **Mixing latent spaces.**SDXL, SD3, Flux utilisent tous différents VAE. Un LoRA formé sur les latents SDXL ne fonctionnera pas sur SD3.
- **CFG too high.** `w > 10`Il est donc important de noter que les résultats obtenus par la Commission sont très variés.`w = 3-7`- Je suis désolé .
- **Negative prompts leaking.**Une requête négative vide devient le jeton nul; une requête négative remplie devient la $\epsilon_{\text{uncond}}$Ce n'est pas la même chose, certains pipelines sont silencieusement défauts à la nullité.

## Utilisez-le

Stacks de production en 2026:

| Target | Recommended backbone |
|--------|----------------------|
| Narrow domain, paired data, training a model from scratch | SDXL fine-tune (LoRA / full) — fastest to ship |
| Open-domain text-to-image, open weights | Flux.1-dev (12B, Apache / non-commercial) or SD3.5-Large |
| Fastest inference, open weights | Flux.1-schnell (1-4 step, Apache) or SDXL-Lightning |
| Best prompt adherence, hosted | GPT-Image / DALL-E 3 (still), Midjourney v7, Imagen 4 |
| Edit workflows | Flux.1-Kontext (Dec 2024) — natively accepts image + text |
| Research, baseline | SD 1.5 — ancient but well-studied |

## La faire partir

- Ça va .`outputs/skill-sd-prompter.md`. Skill prend un prompt texte + style cible et les sorties: modèle + point de contrôle, échelle CFG, échantillon, prompt négatif, résolution, combo optionnel ControlNet/IP-Adapter, et une liste de contrôle de QA par étape.

## Exercices

1. **Easy.**On court .`code/main.py`avec une direction $w \in \lbrace 0, 1, 3, 7, 15 \rbrace$- Enregistrer l'échantillon moyen par classe.$w$les moyens de classe divergent-ils au-delà des moyens de données réelles ?
2. **Medium.**Le codeur linéaire du jouet est remplacé par un codeur/décodeur tanh-MLP avec une perte de reconstruction.
3. **Hard.**Installez une réelle inférence de diffusion stable avec des diffuseurs: charge `sdxl-base`, exécute 30 étapes Euler avec CFG = 7, le temps.`sdxl-turbo`Le même sujet, une qualité différente  décrit ce qui a changé et pourquoi.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| First stage | "The VAE" | Trained encoder/decoder pair; compresses 512² to 64². |
| Second stage | "The U-Net" | Diffusion model over the latent space. |
| CFG | "Guidance scale" | $(1+w) \cdot \epsilon_{\text{cond}} - w \cdot \epsilon_{\text{uncond}}$; tunes conditioning strength. |
| Null token | "Empty prompt embed" | Unconditional embed used for $\epsilon_{\text{uncond}}$. |
| Cross-attention | "How text gets in" | Each U-Net block attends to text tokens as K and V. |
| DiT | "Diffusion Transformer" | Replace U-Net with a transformer over latent patches; scales better. |
| MMDiT | "Multi-modal DiT" | SD3's architecture: text and image streams with joint attention. |
| VAE scaling factor | "Magic number" | Divides latents by ~5.4 so diffusion operates in unit-variance space. |

## Note de production: exécution de Flux-12B sur une GPU de consommation de 8 Go

L'intégration de référence Flux est la recette canonique "J'ai un GPU de consommation, puis-je expédier ceci?"

1. **Staggered loading.**Flux a quatre réseaux qui n'ont jamais besoin de coexister dans VRAM: T5-XXL encodeur de texte (~ 10 Go en fp32), CLIP-L (petit), le 12B MMDiT, et le VAE. Encodez le prompt d'abord, * supprimez* les encodeurs, chargez le DiT, dénoncez, * supprimez* le DiT, chargez le VAE, décodez. Les GPU de 8 Go de consommation ne s'adaptent qu'à une étape à la fois.
2. **4-bit quantization via bitsandbytes.** `BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_compute_dtype=torch.bfloat16)`Le codeur T5 et le DiT. Coupe la mémoire 8x, la baisse de qualité est imperceptible pour les textes à images par référence d'Aritra (lié dans le carnet).
3. **CPU offload.** `pipe.enable_model_cpu_offload()`Il échange automatiquement les modules entre le processeur et la GPU à mesure que chaque passage avance.

La comptabilité de la mémoire est: `10 GB T5 / 8 = 1.25 GB`quantifiés, `12 B params × 0.5 bytes = ~6 GB`En termes de stas00, c'est l'extrémité extrême de TP = 1 inférence  pas de parallélisme de modèle, quantification maximale. Pour la production, vous exécutez TP = 2 ou TP = 4 sur H100s; pour un seul ordinateur portable de développement, c'est la recette.

## Pour en savoir plus

- [Rombach et al. (2022). High-Resolution Image Synthesis with Latent Diffusion Models](https://arxiv.org/abs/2112.10752) Diffusion stable.
- [Podell et al. (2023). SDXL: Improving Latent Diffusion Models for High-Resolution Image Synthesis](https://arxiv.org/abs/2307.01952) SDXL.
- [Peebles & Xie (2023). Scalable Diffusion Models with Transformers (DiT)](https://arxiv.org/abs/2212.09748)- Je suis désolé.
- [Esser et al. (2024). Scaling Rectified Flow Transformers for High-Resolution Image Synthesis](https://arxiv.org/abs/2403.03206) SD3, MMDiT.
- [Ho & Salimans (2022). Classifier-Free Diffusion Guidance](https://arxiv.org/abs/2207.12598) CFG.
- [Labs (2024). Flux.1 — Black Forest Labs announcement](https://blackforestlabs.ai/announcing-black-forest-labs/) Famille Flux1.
- [Hugging Face Diffusers docs](https://huggingface.co/docs/diffusers/index) mise en œuvre de référence pour chaque point de contrôle ci-dessus.
