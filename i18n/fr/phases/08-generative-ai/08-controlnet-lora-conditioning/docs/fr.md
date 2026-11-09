# Contrôle du réseau, de l'ARL et du climatisation

> Le texte seul est un signal de contrôle maladroit. ControlNet vous permet de cloner un modèle de diffusion prétrainé et de le diriger avec une carte de profondeur, un squelette de pose, un graffiti ou une image de bord. LoRA vous permet de affiner un modèle de paramètre 2B en entraînant 10 millions de paramètres. Ensemble, ils ont transformé Stable Diffusion d'un jouet en pipeline d'image 2026 qui est expédié à chaque agence.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 07 (Latent Diffusion), Phase 10 (LLMs from Scratch — for LoRA foundation)
**Time:** ~75 minutes

## Le problème

Une demande comme "une femme en robe rouge promenant un chien dans une rue animée" ne donne pas à la mannequin d'informations sur *où* se trouve le chien, *quelle pose* la femme est dans, ou *la perspective* de la rue.

La formation d'un nouveau modèle conditionnel à partir de zéro pour chaque signal (position, profondeur, ruse, segmentation) est prohibitive. Vous voulez garder la colonne vertébrale SDXL de 2,6B paramètre gelée, attacher un petit réseau latéraux qui lit le conditionnement, et le faire pousser les caractéristiques intermédiaires de la colonne vertébrale.

Vous voulez aussi enseigner au modèle de nouveaux concepts (votre visage, votre produit, votre style) sans refaire de formation au modèle complet. Vous voulez un delta 100 fois plus petit.

ControlNet + LoRA + texte = le kit d'outils du praticien de 2026. La plupart des pipelines d'images de production couvrent 2 à 5 LoRA, 1-3 ControlNets et un adaptateur IP sur une base SDXL / SD3 / Flux.

## Le concept

![ControlNet clones the encoder; LoRA adds low-rank deltas](../assets/controlnet-lora.svg)

### Le contrôle des données (Zhang et coll., 2023)

Prenez une SD prétrainée. *Cloner* la moitié du codeur de l'U-Net. Congeler l'original. Entrer le clone à accepter une entrée de conditionnement supplémentaire (marges, profondeur, pose). Reconnecter le clone au décodeur de la moitié de l'original avec *zéro-convolution* sauter des connexions (1×1 convs initiales à zéro  commencer comme un no-op, apprendre un delta).

```
SD U-Net decoder:   ... ← orig_enc_features + zero_conv(controlnet_enc(condition))
```

Le train à 1M (prompte, condition, image) triple la perte de diffusion standard.

Les ControlNets de pérmodalité sont livrés sous forme de petits modèles secondaires (~360 M pour SDXL, ~70 M pour SD 1.5).

```
features += weight_a * control_a(depth) + weight_b * control_b(pose)
```

### L'ACE (Hu et coll., 2021)

Pour toute couche linéaire $W \in \mathbb{R}^{d \times d}$dans le modèle, congélation $W$et ajouter un delta de faible rang:

```math
W' = W + \Delta W, \quad \Delta W = B A, \quad A \in \mathbb{R}^{r \times d}, \quad B \in \mathbb{R}^{d \times r}
```

avec $r \ll d$.Le rang 4-16 est standard pour l'attention, le rang 64-128 pour les notes fines lourdes.$2 \cdot d \cdot r$Au lieu de $d^2$. Pour l' attention de l' SDXL avec $d=640$- Je suis là .$r=16$: 20k par paramètre par adaptateur au lieu de 410k  une réduction de 20x.

Pour en tirer une conclusion , vous pouvez mesurer la LoRA:$W' = W + \alpha \cdot B A$- Je suis là .$\alpha = 0.5\text{-}1.5$Les LRA multiples s'accumulent additionnellement (avec l'avertissement habituel qu'ils interagissent de manière non linéaire).

### Adapteur IP (Ye et coll., 2023)

Un petit adaptateur qui accepte une *image* comme conditionnement (à côté du texte). Utilise le codeur d'image CLIP pour produire des jetons d'image, les injecte dans l'attention croisée aux côtés des jetons de texte. ~ 20 Mo par modèle de base. Vous permet de "générer une image dans le style de cette référence" sans un LoRA.

## Matrice de composibilité

| Tool | What it controls | Size | When to use |
|------|------------------|------|-------------|
| ControlNet | Spatial structure (pose, depth, edges) | 70-360MB | Exact layout, composition |
| LoRA | Style, subject, concept | 20-200MB | Personalization, style |
| IP-Adapter | Style or subject from reference image | 20MB | No text can describe the look |
| Textual Inversion | Single concept as a new token | 10KB | Legacy, mostly replaced by LoRA |
| DreamBooth | Full fine-tune on a subject | 2-5GB | Strong identity, high compute |
| T2I-Adapter | Lighter ControlNet alternative | 70MB | Edge devices, inference budget |

Le réseau de contrôle est spatial, le LoRA est sémantique.

```figure
v4-controlnet-zero
```

## Faites-le

`code/main.py`simulation des deux mécanismes sur le 1-D:

1. **LoRA.**Une couche linéaire prétrainée $W$- Fermez-le, entraînez un bas rang.$BA$comme ça .$W + BA$Il correspond à une couche linéaire cible.$r = 1$suffit pour apprendre une correction de rang 1 parfaitement.

2. **ControlNet-lite.**Un prédicteur de base gelée et un réseau côté qui lit un signal supplémentaire. La sortie du réseau côté est garée par un scalaire apprenable initialement à zéro (notre version de zéro-conv).

### Étape 1: mathématiques de la LORA

```python
def lora(W, A, B, x, alpha=1.0):
    # W is frozen; A, B are the trainable low-rank factors.
    return [W[i][j] * x[j] for i, j in ...] + alpha * (B @ (A @ x))
```

### Étape 2: réseau latérale à entrées zéro

```python
side_out = control_net(x, condition)
gated = gate * side_out  # gate initialized to 0
h = base(x) + gated
```

À l'étape 0 la sortie est identique à la base.`gate`lentement sans dérive catastrophique.

## Les pièges

- **Over-scaling LoRAs.** $\alpha = 2$ou $\alpha = 3$est un hack commun "faire le plus fort" qui produit des sorties trop stylisées / cassées.$\alpha \le 1.5$- Je suis désolé .
- **ControlNet weight conflict.**L'utilisation d'un Pose ControlNet à un poids de 1,0 et d'un Depth ControlNet à un poids de 1,0 est généralement trop rapide.
- **LoRA on the wrong base.**Les SDXL LoRA sont silencieusement non-op sur SD 1.5 parce que les dimensions d'attention ne correspondent pas.
- **Textual Inversion drift.**Les jetons entraînés sur un point de contrôle dérivent mal sur un autre.
- **LoRA weight-merging and storage.**Vous pouvez cuire un LoRA dans les poids du modèle de base pour une inférence plus rapide (pas d'ajout de temps de course), mais vous perdez la capacité d'échelle $\alpha$Gardez les deux versions.

## Utilisez-le

| Goal | 2026 pipeline |
|------|---------------|
| Reproduce a brand's art style | LoRA trained on ~30 curated images at rank 32 |
| Put my face in a generated image | DreamBooth or LoRA + IP-Adapter-FaceID |
| Specific pose + prompt | ControlNet-Openpose + SDXL + text |
| Depth-aware composition | ControlNet-Depth + SD3 |
| Reference + prompt | IP-Adapter + text |
| Exact layout | ControlNet-Scribble or ControlNet-Canny |
| Background replace | ControlNet-Seg + Inpainting (Lesson 09) |
| Fast 1-step style | LCM-LoRA on SDXL-Turbo |

## La faire partir

- Ça va .`outputs/skill-sd-toolkit-composer.md`. La compétence prend une tâche (actifs d'entrée: prompt, image de référence facultative, pose facultative, profondeur facultative, scribber facultatif) et produit la pile d'outils, les poids et un protocole de semence reproductible.

## Exercices

1. **Easy.**Dans `code/main.py`, varient le rang de la LoRA `r`À quel rang le LoRA correspond exactement à un delta cible de rang 2 ?
2. **Medium.**Exercez deux LoRA séparés sur deux transformations cibles. Chargez-les ensemble et montrez leur interaction additive.
3. **Hard.**Utilisez des diffuseurs pour empiler: SDXL-base + Canny-ControlNet (poids 0,8) + un style LoRA ($\alpha$0,8) + IP-Adapter (poids 0,6). Mesurer le compromis FID- contre l'adhésion instantanée en fonction de la variation des poids de la pile.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| ControlNet | "Spatial control" | Cloned encoder + zero-conv skips; reads a conditioning image. |
| Zero convolution | "Starts as identity" | 1×1 conv initialized to zero; ControlNet starts as no-op. |
| LoRA | "Low-rank adapter" | $W + BA$, $r \ll d$; 100x fewer params than a full fine-tune. |
| rank r | "The knob" | LoRA compression; 4-16 typical, 64+ for heavy personalization. |
| $\alpha$ | "LoRA strength" | Runtime scaling of the LoRA delta. |
| IP-Adapter | "Reference image" | Small image-conditioning adapter via CLIP-image tokens. |
| DreamBooth | "Full subject fine-tune" | Train the full model on ~30 images of a subject. |
| Textual Inversion | "New token" | Learn a new word embedding only; legacy, mostly replaced. |

## Note de production: swaps LoRA, voies de contrôle réseau, service multi-locataires

Un vrai SaaS texte-à-image sert des centaines de LoRA et une douzaine de ControlNets sur le même point de contrôle de base. Le problème de service ressemble beaucoup à la multi-location LLM (la littérature de production couvre le cas LLM sous lotage continu et LoRAX / S-LoRA):

- **Hot-swap LoRAs, do not merge.**La fusion$W' = W + \alpha \cdot B \cdot A$dans la base donne ~ 3-5% plus rapide par étape d'inférence mais gèle $\alpha$Les LRA sont maintenues chaudes dans le VRAM en tant que delta de rang-r; les diffuseurs sont exposés.`pipe.load_lora_weights()`+ `pipe.set_adapters([...], adapter_weights=[...])`Pour l'activation par demande, le coût de l'échange est le `2 · d · r · num_layers`Poids  à l'échelle de MB, sous-seconde.
- **ControlNet as a second attention lane.**Le codeur cloné fonctionne parallèlement à la base. Deux ControlNets de poids 1,0 chacun = deux passes supplémentaires à l'avant par étape, pas un pass fusionné. La taille du lot diminue quadratiquement. Budget pour ~ 1,5x coût de l'étape par ControlNet actif.
- **Quantized LoRAs too.**Si vous avez quantifié la base (voir leçon 07, Flux sur 8 Go), le delta LoRA quantifie également de manière propre à 8 bits ou 4 bits.

Flux-specific: Le portable de Niels Flux-on-8GB quantifie la base à 4 bits;`pipe.load_lora_weights("user/style-lora")`) sur cette base quantifiée à `weight_name="pytorch_lora_weights.safetensors"`C'est la recette que la plupart des agences SaaS expédient en 2026.

## Pour en savoir plus

- [Zhang, Rao, Agrawala (2023). Adding Conditional Control to Text-to-Image Diffusion Models](https://arxiv.org/abs/2302.05543) ControlNet.
- [Hu et al. (2021). LoRA: Low-Rank Adaptation of Large Language Models](https://arxiv.org/abs/2106.09685) LoRA (à l'origine pour les LLM; ports à diffusion).
- [Ye et al. (2023). IP-Adapter: Text Compatible Image Prompt Adapter](https://arxiv.org/abs/2308.06721) Adapteur IP.
- [Mou et al. (2023). T2I-Adapter: Learning Adapters to Dig Out More Controllable Ability](https://arxiv.org/abs/2302.08453) une alternative plus légère au ControlNet.
- [Ruiz et al. (2023). DreamBooth: Fine Tuning Text-to-Image Diffusion Models for Subject-Driven Generation](https://arxiv.org/abs/2208.12242)- Le DreamBooth.
- [HuggingFace Diffusers — ControlNet / LoRA / IP-Adapter docs](https://huggingface.co/docs/diffusers/training/controlnet) tuyaux de référence.
