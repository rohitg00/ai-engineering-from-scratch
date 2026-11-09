# Modèles multimodels seulement avec des jetons de chamelion et de fusion précoce

> Chaque VLM que nous avons vu jusqu'à présent garde des images et du texte séparés. Les jetons visuels proviennent d'un encodeur de vision, circulent dans un projecteur, puis rencontrent le texte à l'intérieur du LLM. Le vocabulaire de vision et de texte ne se chevauchent jamais. Le chameau (Meta, mai 2024) a demandé: et si c'était le cas ? Formez un VQ-VAE qui transforme une image en une séquence de jetons distincts à partir d'un vocabulaire partagé. Chaque document multimodal est maintenant une séquence  de jetons de texte et de jetons d'image interlevées, une seule perte autorégressive. Effets secondaires: le modèle peut générer des sorties de modalité mixte  des jetons de texte et d'image alternés dans un seul appel d'inférence. Cette leçon lit la thèse de la fusion précoce et construit une version de jouet de bout en bout.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, VQ-VAE tokenizer + interleaved decoder)
**Prerequisites:** Phase 12 · 05, Phase 8 (Generative AI)
**Time:** ~180 minutes

## Objectifs d'apprentissage

- Expliquez pourquoi un vocabulaire partagé + une seule perte modifie ce que le modèle peut faire.
- Décrivez comment un VQ-VAE symbolise une image en une séquence discrète compatible avec l'objectif de la prochaine marque d'un transformateur.
- Nommez les astuces de stabilité de formation de Chameleon: QK-Norm, placement de démission, commandement de LayerNorm.
- Comparez l'approche Q-Former de Chameleon versus BLIP-2 et décris quand chacune est le bon choix.

## Le problème

Les VLM basés sur l'adaptateur (LLaVA, BLIP-2, Qwen-VL) traitent le texte et l'image comme deux choses différentes.`embed(text_token)`Une image passe à travers `visual_encoder(image) → projector → ... pseudo_tokens`Le modèle a deux voies d'entrée qui se fondent en partie.

Trois conséquences:

1. Le LLM ne peut consommer que des images, pas les émettre.
2. Les documents de modalité mixte (paragraphes et images alternés, comme dans un article) sont gênants  vous analysez soit l'entrée multimodal en dehors du modèle, soit les générations de chaîne.
3. Les jetons visuels et les jetons texte vivent dans différentes régions de l'espace caché, créant des problèmes d'alignement subtils.

Chameleon rejette cette hypothèse: les images ne sont que des séquences de jetons distincts d'un vocabulaire partagé.

## Le concept

### VQ-VAE en tant que marqueur d'image

Le tokenizer est un autoencodeur variatif quantifié par vecteur.

- Encoder: CNN + ViT qui cartographient l'image à une carte spatiale, disons 32x32 caractéristiques de dim 256.
- Codebook: un vocabulaire appris de vecteurs K (Chameleon utilise 8192), également dim 256.
- Quantification: pour chaque fonctionnalité spatiale, recherchez l'entrée de codebook la plus proche par distance L2. Remplacez la fonctionnalité continue par l'indice entier.
- C'est CNN qui ramène les fonctionnalités quantifiées à des pixels.

Formation: Perte de reconstruction de l'AEV + perte d'engagement + perte de codebook.

Pour Chameleon: une image devient 32*32 = 1024 jetons tirés d'un vocabulaire de 8192. Placez ces ID d'image dans le même espace d'ID que les jetons BPE texte. Le jeton unique de Chameleon a 65 536 entrées, et ce nombre inclut déjà les codes d'image 8192 et les jetons spéciaux tels que les séparateurs d'image. Le transformateur voit une séquence, une perte.

### Le vocabulaire partagé

Le vocabulaire de Chameleon combine des jetons de texte, des jetons d'image et des séparateurs de modalité. Chaque jeton a un seul ID. La couche d'intégration d'entrée cartonne chaque ID vers un vecteur caché D-dim. Les cartes de projection de sortie sont cachées aux logits de vocabulaire. Softmax choisit le jeton suivant, quelle que soit la modalité.

Les séparateurs sont importants: `<image>`et `</image>`Les balises sont en parenthèses de la séquence de jetons d'image. au moment de la génération, si le modèle émet `<image>`Le logiciel en aval sait que les 1024 prochains jetons sont des indices VQ à envoyer au décodeur pour la rendu des pixels.

### Génération de mobilité mixte

L'inference est la prédiction du prochain jeton dans le vocabulaire partagé.

```
<image> 4821 1029 2891 ... (1024 image tokens) </image>
The cat is orange, sitting on a windowsill...
```

Le modèle choisit l'ordre de manière autonome  il peut produire une image puis un texte, un texte puis une image, ou interdire.

Comparer à des VLM adaptateurs où la génération est uniquement de texte.

### Stabilité de formation  QK-Norm, dérapagement, commandes LayerNorm

L'entraînement à la fusion précoce est instable à l'échelle.

- QK-Norm. Appliquez LayerNorm à la requête et aux projections clés à l'intérieur de l'attention, avant le produit de point. empêche l'explosion de la magnitude logite à la profondeur. Utilisé par plusieurs grands modèles post-2024.
- Le décalage de la position. Le décalage après chaque ajout résiduel, pas seulement après l'attention et la MLP. Une régulation plus importante est nécessaire lorsque les gradients des jetons d'image peuvent dominer.
- LayerNorm ordonnage. Pré-LN sur la branche résiduelle (standard), plus un LN supplémentaire sur la connexion de saut du dernier bloc. Stabilise le débit de gradient de la couche finale.

Sans ces astuces, l'entraînement du 34B-param Chameleon divergeait à plusieurs points de contrôle. Avec eux, il converge.

### Le plafond de reconstruction du jeton

Le VQ-VAE est une perte. Avec 8192 entrées de codebook et 1024 jetons par image 512x512, la reconstruction PSNR se situe entre 26 et 28 dB. Cela suffit pour une génération d'images reconnaissables mais est visiblement pire que la diffusion continue de l'espace (la diffusion stable 3 atteint 32+ dB).

Le tokenizer est le goulot d'étranglement. Les meilleurs tokenizers (MAGVIT-v2, IBQ, SBER-MoVQGAN) soulevent le plafond. Emu3 (Létion 12.12) permet de générer une qualité SDXL par un seul tokenizer meilleur.

### Chameleon contre BLIP-2 / LLaVA

Chameleon (fusion précoce, vocabulaire partagé):
- Une perte, un décodeur.
- Génère une sortie de mode mixte.
- Le Tokenizer est le plafond de qualité.
- Coût: décodeur VQ-VAE par image générée sur le chemin d'inférence.

BLIP-2 / LLaVA (fusion tardive, tours séparées):
- La vision est entrée, les messages sont envoyés.
- Reutilise le Master de droit prétrainé.
- Pas de goulot d'étranglement pour comprendre.
- Passe unique en avant.

Si vous avez besoin de génération d'images, famille Chameleon, si vous avez seulement besoin de compréhension, l'adaptateur VLM est plus simple et réutilise plus de calcul prétrainé.

### Fuyu et AnyGPT

Fuyu (Adept, 2023) est une approche connexe: sauter le codeur de vision séparé entièrement, alimenter les patches d'image brutes à travers la projection d'entrée du LLM comme s'il s'agissait de jetons, pas de tokenizer.

AnyGPT (Zhan et coll., 2024) étend le Chameleon à quatre modalités: texte, image, parole, musique. Le même truc VQ-VAE pour chacun, transformateur partagé.

```figure
vq-codebook
```

## Utilisez-le

`code/main.py`construit un modèle de fusion précoce de bout en bout de jouet:

- Un minuscule quantificateur de style VQ-VAE qui cartographient les correctifs 8x8 aux indices du codebook (K=16).
- Un vocabulaire partagé de (id du texte 0..31) + (id de l'image 32..47) + (separateurs 48, 49).
- Un décodeur autorégressif jouet (tableau de bigrammes) formé sur des légendes synthétiques + des séquences de jetons d'image.
- Loup d'échantillonnage qui émet des jetons de texte + d'image alternés à une demande.

Le code garde intentionnellement le transformateur en petits (bigrammes) afin que vous puissiez suivre le flux de signal de bout en bout.

## La faire partir

Cette leçon produit `outputs/skill-tokenizer-vs-adapter-picker.md`. Compte tenu d'une spécification de produit (comprendre seulement vs comprendre + générer, qualité d'image requise, budget de coûts), il choisit entre la famille Chameleon (fusion précoce) et la famille LLaVA (fusion tardive) et justifie avec des règles quantitatives.

## Exercices

1. Chameleon utilise K=8192 entrées de codebook et 1024 jetons par image 512x512 . Estimer le rapport de compression par rapport à une image RGB 24 bits. Est-ce que c'est une perte ?

2. Une image 4K (3840x2160) à la même densité VQ-VAE produit combien de jetons d'image? un modèle de style chamélion peut-il générer une image 4K dans un appel d'inférence?

3. Implémenter QK-Norm en Python pur. Compte tenu d'une requête et d'une clé 64 dimensions, afficher le produit de point avant et après LayerNorm. Pourquoi le contrôle de la magnitude est important à la profondeur?

4. Lisez la section 2.3 du Chameleon sur la stabilité de l'entraînement. Décrivez le mode de défaillance exact observé sur le papier à 34B sans QK-Norm.

5. Élargir le décodeur de jouet pour émettre une réponse de modalité mixte en cas de requête de texte uniquement. Mesurer la fréquence à laquelle le modèle choisit l'image-première par rapport au texte-première en cas de formation-distribution des données 60% texte-première / 40% image-première.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Early fusion | "Unified tokens" | Images converted to discrete tokens sharing the transformer's vocabulary from step one |
| VQ-VAE | "Image tokenizer" | CNN + ViT + codebook that maps images to integer indices the transformer can predict |
| Shared vocabulary | "One dictionary" | A single token ID space covering text + image + modality separators |
| QK-Norm | "Attention stabilizer" | LayerNorm applied to query and key before their dot product, prevents norm blowup |
| Mixed-modality generation | "Text + image output" | Inference that autonomously produces interleaved text and image tokens in one pass |
| Codebook size | "K entries" | Number of discrete vectors the VQ-VAE can quantize to; trades compression for fidelity |
| Tokenizer ceiling | "Reconstruction limit" | Best PSNR achievable by decoding VQ tokens; bounds the model's image quality |

## Pour en savoir plus

- [Chameleon Team — Chameleon: Mixed-Modal Early-Fusion Foundation Models (arXiv:2405.09818)](https://arxiv.org/abs/2405.09818)
- [Aghajanyan et al. — CM3 (arXiv:2201.07520)](https://arxiv.org/abs/2201.07520)
- [Yu et al. — CM3Leon (arXiv:2309.02591)](https://arxiv.org/abs/2309.02591)
- [Zhan et al. — AnyGPT (arXiv:2402.12226)](https://arxiv.org/abs/2402.12226)
- [Adept — Fuyu-8B blog (adept.ai)](https://www.adept.ai/blog/fuyu-8b)
