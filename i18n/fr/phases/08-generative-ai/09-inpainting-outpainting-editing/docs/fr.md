# Peinture, décoration et édition d'images

> Le texte à l'image crée de nouvelles choses. L'encrage corrige les vieilles. En production, 70% du travail d'image facturable est de modifier  échanger un fond, supprimer un logo, étendre la toile, régénérer une main. L'encrage est où la diffusion gagne sa conservation.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 07 (Latent Diffusion), Phase 8 · 08 (ControlNet & LoRA)
**Time:** ~75 minutes

## Le problème

Un client envoie une photo de produit parfaite avec un signe distraitant en arrière-plan. Vous voulez effacer le signe et laisser tout le reste identique aux pixels. Vous ne pouvez pas exécuter texte à image à partir de zéro  le résultat aura une couleur différente, un éclairage différent, un angle de produit différent. Vous voulez régénérer * seulement * la région masquée, et vous voulez que la régénération respecte le contexte environnant.

C'est une peinture.

- **Inpainting.**Régénérer à l'intérieur d'un masque, garder les pixels à l'extérieur.
- **Outpainting.**Regénérer à l'extérieur du masque (ou au-delà de la toile), rester à l'intérieur.
- **Image editing.**Regénérer l'image entière mais maintenir la fidélité sémantique ou structurelle à l'original (SDEdit, InstructPix2Pix).

Chaque pipeline de diffusion en 2026 envoie un mode de peinture. Flux.1-Fill, Stable Diffusion Inpaint, SDXL-Inpaint, DALL-E 3 Edit. Ils fonctionnent sur le même principe.

## Le concept

![Inpainting: mask-aware denoising with context-preserving reinjection](../assets/inpainting.svg)

### L'approche naïve (et pourquoi c'est mal)

En utilisant un masque, remplacez la région non masquée du latent bruyant par l'image propre diffusée vers l'avant.

### Le modèle de peinture approprié

Traînez un réseau U-Net modifié qui prend 9 canaux d'entrée au lieu de 4:

```
input = concat([ noisy_latent (4ch), encoded_image (4ch), mask (1ch) ], dim=channel)
```

Les canaux supplémentaires sont une copie de l'image source codée par VAE et un masque à canal unique. Au cours de la formation, vous masquez au hasard des régions de l'image et entraînez le modèle pour dénoncer uniquement la région masquée tandis que la région non masquée est donnée comme un signal de conditionnement propre.

SD-Inpaint, SDXL-Inpaint, Flux-Fill utilisent tous cette entrée de 9 canaux (ou analogique).`StableDiffusionInpaintPipeline`- Je suis là .`FluxFillPipeline`- Je suis désolé .

### SDEdit (Meng et coll., 2022)  édition gratuite

Ajoutez du bruit à l' image source jusqu' à un certain intermédiaire `t`, puis lancez la chaîne inverse à partir de `t`Avec une nouvelle mise à jour, aucune reformation, le choix du départ.`t`traite de la fidélité pour la liberté créatrice:

- `t/T = 0.3`→ presque identique à la source, de petits changements stylistiques
- `t/T = 0.6`→ modification modérée, préservant la structure grossière
- `t/T = 0.9`→ généré à partir de près de bruit, conservation de la source minimale

### InstructPix2Pix (Brooks et coll., 2023)

- Afin d' ajuster un modèle de diffusion à`(input_image, instruction, output_image)`En conséquence, conditionnez à la fois l'image d'entrée et une instruction texte (" faire le coucher du soleil ", " ajouter un dragon ").

### RePaint (Lugmayr et coll., 2022)

Gardez un modèle de diffusion inconditionnel standard. À chaque étape inverse, reprenez l'échantillon  sautez de temps en temps à un état plus bruyant et régénérez. Évitez les artefacts de bordure. Utilisé lorsque vous n'avez pas un modèle de peinture formé.

```figure
inpaint-mask-reinject
```

## Faites-le

`code/main.py`Nous avons mis en place un schéma de peinture en 1D sur les données 5D. Nous avons formé un DDPM sur les données de mélange 5D où chaque échantillon est 5 flottes d'un de deux grappes.

### Étape 1: Données DDPM 5D

```python
def sample_data(rng):
    cluster = rng.choice([0, 1])
    center = [-1.0] * 5 if cluster == 0 else [1.0] * 5
    return [c + rng.gauss(0, 0.2) for c in center], cluster
```

### Étape 2: dénicheur de train sur les 5 dims

DDPM standard. sorties de réseau prédiction de bruit 5D pour les entrées bruyantes 5D.

### Étape 3: à l'inférence, le masque conscient inverse

```python
def inpaint_step(x_t, mask, clean_image, alpha_bars, t, rng):
    # replace unmasked dims with a freshly noised version of the clean source
    a_bar = alpha_bars[t]
    for i in range(len(x_t)):
        if not mask[i]:
            x_t[i] = math.sqrt(a_bar) * clean_image[i] + math.sqrt(1 - a_bar) * rng.gauss(0, 1)
    # ...then run the normal reverse step on x_t
```

C'est une approche naïve qui fonctionne sur des données 1D de jouets.

### Étape 4: décoration

La peinture est la peinture avec le masque inversé: masquer la nouvelle toile (auparavant inexistante), remplir le reste avec l'original.

## Les pièges

- **Seams.**L'approche naïve laisse des limites visibles car les informations de gradient ne circulent pas à travers le masque.
- **Mask leakage.**Si la région non masquée de l'image de conditionnement est de mauvaise qualité ou bruyante, elle pollue la génération à l'intérieur du masque.
- **CFG interacts with mask size.**CFG élevé sur un masque petit = plaque saturée. Réduire CFG pour les petites modifications.
- **SDEdit fidelity cliff.**Je vais partir de `t/T = 0.5`à `t/T = 0.6`- Il peut perdre l'identité du sujet.
- **Prompt mismatch.**Le message doit décrire l'image entière, pas seulement le nouveau contenu. "Un chat assis sur une chaise" et non "un chat".

## Utilisez-le

| Task | Pipeline |
|------|----------|
| Remove object, small mask | SD-Inpaint or Flux-Fill, standard prompt |
| Replace sky | SD-Inpaint + "blue sky at sunset" |
| Extend canvas | SDXL outpaint mode (8px feather) or Flux-Fill with outpaint mask |
| Regenerate hand / face | SD-Inpaint with prompt re-describing the subject + ControlNet-Openpose |
| Change style of one region | SDEdit at `t/T=0.5` on masked region |
| "Make it sunset" | InstructPix2Pix or Flux-Kontext |
| Background replacement | SAM mask → SD-Inpaint |
| Ultra-high-fidelity | Flux-Fill or GPT-Image (hosted) for hardest cases |

SAM (Meta's Segment Anything, 2023) + diffusion inpaint est le pipeline de suppression de fond 2026 . SAM 2 (2024) fonctionne sur vidéo.

## La faire partir

- Ça va .`outputs/skill-editing-pipeline.md`. Skill prend une image originale + description de modification + masque optionnelle (ou SAM prompt) et les sorties: approche de génération de masque, modèle de base, échelles CFG (image + texte), mode SDEdit-t ou d'inpeinture et liste de contrôle de QA.

## Exercices

1. **Easy.**Dans `code/main.py`En ce qui concerne la qualité de la peinture (résiduelle dans les dims masqués), quelle est la fraction de la génération inconditionnelle ?
2. **Medium.**Implémentation de la RePaint: à chaque dixième étape inverse, sautez 5 étapes en arrière (ajouter du bruit) et ré-dénoncer. Mesurez si elle réduit le résidu de la limite au bord du masque.
3. **Hard.**Utilisez des diffuseurs de visage embrasés pour comparer: SD 1.5 Inpaint + ControlNet-Openpose vs Flux.1-Remplissez 20 tâches de régénération du visage.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Inpainting | "Fill the hole" | Regenerate inside a mask; keep outside pixels. |
| Outpainting | "Extend the canvas" | Regenerate outside the canvas; keep inside. |
| 9-channel U-Net | "Proper inpainting model" | U-Net with `noisy \| encoded-source \| mask` as input. |
| SDEdit | "Img2img with noise level" | Noise to time `t`, denoise with new prompt. |
| InstructPix2Pix | "Text-only edits" | Fine-tuned diffusion on (image, instruction, output) triples. |
| RePaint | "No retraining" | Re-noise periodically during reverse to reduce seams. |
| SAM | "Segment Anything" | Mask generator by clicks or boxes; pairs with inpaint. |
| Flux-Kontext | "Edit with context" | Flux variant that accepts a reference image + instruction for edits. |

## Note de production: les pipelines de modification sont sensibles à la latence

Les utilisateurs qui éditent une image s'attendent à des allers-retours de sous 5 secondes. Une SDXL-Inpaint de 30 étapes à 10242 est de 3-4 secondes sur un L4, plus la génération de masque SAM (~ 200 ms) et le code/décodage VAE (~ 500 ms combinés).

- **SAM-H is the slow one.**SAM-H à 10242 est de ~ 200 ms; SAM-ViT-B est de ~ 40 ms avec une perte de qualité mineure. SAM 2 (vidéo) ajoute des charges temporales; ne l'utilisez pas pour les modifications d'image unique.
- **Skip the encode when possible.** `pipe.image_processor.preprocess(img)`Si vous avez les latents de la génération précédente (typique des UI d'édition itérative), passez-les directement via `latents=...`pour sauter un code VAE.
- **Mask dilation matters for throughput too.**Un petit masque signifie que la plupart du pass avant U-Net est gaspillé (les pixels non masqués sont collés de toute façon). `diffusers`" `StableDiffusionInpaintPipeline`fonctionne à l'ensemble du réseau U-Net indépendamment; seules les variantes de 9 canaux en imprimant correctement exploitent le calcul masqué.
- **Flux-Kontext is the 2025 answer.**Passer en avant unique .`(source_image, instruction)`Il n'y a pas de masque séparée, pas de balayage de bruit SDEdit. sur un H100, il envoie une modification en environ 1,5 s. La leçon d'architecture: effondrer les étapes.

## Pour en savoir plus

- [Lugmayr et al. (2022). RePaint: Inpainting using Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2201.09865) peinture sans formation.
- [Meng et al. (2022). SDEdit: Guided Image Synthesis and Editing with Stochastic Differential Equations](https://arxiv.org/abs/2108.01073) SDEdit.
- [Brooks, Holynski, Efros (2023). InstructPix2Pix](https://arxiv.org/abs/2211.09800) édition de textes d'instructions.
- [Kirillov et al. (2023). Segment Anything](https://arxiv.org/abs/2304.02643)SAM, la source du masque.
- [Ravi et al. (2024). SAM 2: Segment Anything in Images and Videos](https://arxiv.org/abs/2408.00714) Vidéo SAM.
- [Hertz et al. (2022). Prompt-to-Prompt Image Editing with Cross-Attention Control](https://arxiv.org/abs/2208.01626) Édition au niveau de l'attention.
- [Black Forest Labs (2024). Flux.1-Fill and Flux.1-Kontext](https://blackforestlabs.ai/flux-1-tools/) 2024 outillage.
