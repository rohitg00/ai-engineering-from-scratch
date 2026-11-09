# Emu3: Prédiction de la prochaine génération d'images et de vidéos

> L'Emu3 de BAAI (Wang et al., septembre 2024) est le résultat de 2024 qui aurait dû mettre fin au débat diffusion-contre-autorégression. Un transformateur unique de décodeur de style Llama, formé uniquement sur l'objectif de prédiction de jeton suivant, sur un vocabulaire unifié de texte + jetons d'image VQ + jetons vidéo VQ 3D, bat SDXL sur la génération d'images et LLaVA-1.6 sur la perception. Pas de perte de CLIP. Pas de calendrier de diffusion. Les conseils sans classifiateur sont utilisés pour déduire la qualité, mais l'objectif principal de la formation est la prédiction du prochain jeton avec l'obligation des enseignants. Publié dans Nature. Cette leçon explique pourquoi un meilleur tokenizer plus l'échelle est tout ce dont vous avez besoin et contraste avec les approches de diffusion.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, 3D video tokenizer math + autoregressive sampler skeleton)
**Prerequisites:** Phase 12 · 11 (Chameleon)
**Time:** ~120 minutes

## Objectifs d'apprentissage

- Expliquez pourquoi l'objectif de jeton suivant à perte unique d'Emu3 fonctionne malgré l'hypothèse de longue date selon laquelle la diffusion est nécessaire pour la qualité de l'image.
- Décrivez le tokenizer vidéo 3D: à quoi ressemble un codebook VQ spatiotemporal, pourquoi les correctifs durent plus longtemps.
- Comparer Emu3 vs Stable Diffusion XL sur (computation de formation, coût d'inférence, plafond de qualité).
- Nommez les trois rôles que jouent le même modèle Emu3: Emu3-Gen (génération d'image), Emu3-Chat (perception), Emu3-Stage2 (génération vidéo).

## Le problème

La sagesse conventionnelle jusqu'en 2024: la génération d'images a besoin de diffusion. L'argument: les jetons d'image discrets perdent trop d'informations pour reconstruire les détails, et le prélèvement autorégressif accumule des erreurs sur des milliers de jetons. Diffusion stable, DALL-E 3, Imagen, Midjourney utilisent toutes une forme de diffusion. Le Chameleon (Létion 12.11) a partiellement refusé cette proposition à petite échelle, mais n'a pas été de qualité comparable à celle de la SDXL.

Emu3 attaque l'argument face à face. L'affirmation: meilleur jeton visuel + assez d'échelle + perte de jeton suivante = génération d'image batant la diffusion dans le même modèle qui fait également la perception.

Deux ans plus tard, la famille de génération unifiée open source (Emu3, Show-o, Janus-Pro, Transfusion) est la voie par défaut pour la recherche; les modèles de frontière de production semblent utiliser une variante.

## Le concept

### Le jeton ému3

L'ingrédient clé est le jeton visuel. Emu3 entraîne un jeton personnalisé de classe IBQ (Quantizer de couteau inverse, famille SBER-MoVQGAN) à 8x8 de réduction de résolution par jeton. Une image 512x512 devient 64x64 = 4096 jetons à la taille du codebook 32768.

Ce chiffre est supérieur aux 1024 jetons de Chameleon par 512x512 à K=8192 sur les deux axes: quatre fois plus que les jetons et un codebook quatre fois plus grand.

Pour la vidéo: un tokenizer VQ 3D encode un patch spatiotemporal (4 images x 8 pixels x 8 pixels) à un nombre entier. Un clip 4s à 8 FPS a 32 images; à 256×256 avec une réduction spatiale 8x et temporelle 4x, le nombre de jetons est (256/8) * (256/8) * (32/4) = 32 * 32 * 8 = 8192 jetons.

La qualité du tokenizer est le plafond.

### Formation à perte unique

Emu3 utilise un objectif: prévoir le prochain jeton sur un vocabulaire partagé entre des jetons de texte, des jetons d'image 2D et des jetons vidéo 3D. Les poids sont multipliés par des facteurs spécifiques à la modalité pendant la formation pour équilibrer la contribution, mais la fonction de perte est identique.

Le train est composé de:
- Genre d'image: `<text caption> <image> image_tokens </image>`
- Perception de l'image: `<image> image_tokens </image> <question> text_tokens`
- Gen vidéo: `<text caption> <video> video_tokens </video>`
- Perception vidéo: analogue.
- Seul texte: NTP standard.

Le modèle apprend à quel moment émettre des jetons d'image par rapport aux jetons de texte à partir de la distribution des données.`<image>`Je vous en prie.

### Guidance et température sans classifiant

La génération d'images autorégressives est beaucoup mieux avec la diffusion sans classifiateur (CFG) à l'inférence. Emu3 l'utilise: générer deux fois, une fois avec la légende complète, une fois avec une légende vide, mélanger les logits avec un poids de guidage (typique 3.0-7.0).

La température est importante: trop haute, les artefacts; trop bas, l'effondrement du mode.

### Trois rôles, un modèle

Les navires Emu3 sont constitués de trois API fonctionnellement distinctes mais d'un ensemble de poids sous-jacent:

- Génération d'images, texte d'entrée, jetons d'image de sortie.
- Emu3-Chat. VQA et sous-titres. image d'entrée (tokens), texte de sortie.
- Emu3-Stage2. génération vidéo et vidéo VQA. Entrée de texte ou vidéo, sortie de texte ou vidéo.

Pas de tête spécifique, juste des modèles de commande différents, le même point de contrôle.

### Les points de référence

Dans le document Emu3 (septembre 2024):

- Génération d'images: dépasse SDXL sur MJHQ-30K FID (5.4 vs 5.6), GenEval dans son ensemble (0.54 vs 0.55  égale statistique), et le composite de Deep-Eval sur par.
- Perception d'image: suit LLaVA-1.6 sur VQAv2 (75.1 vs 81.8) et MMMU (31.6 vs 35.1), mais le bat sur SEED-Bench, OCRBench et ChartQA.
- Génération vidéo: qualité de vidéo de 4 secondes à FVD compétitive avec des modèles de l'ère Sora publiquement comparés.

Les chiffres ne gagnent pas toujours  Emu3 négocie un point ici pour un point là  mais l'affirmation "la prédiction du prochain jeton est tout ce dont vous avez besoin" est défendable dans toutes les modalités.

### Coût de calcul

Emu3 est un modèle de paramètre 8B. Le document ne publie pas un total d'heures GPU; pour l'échelle, la prétraine Llama-2-7B utilise environ 184 000 heures GPU A100, environ 21 années GPU.

En inférence, Emu3 est plus lent que SDXL par image: 4096 jetons d'image à 30 tok/s est ~ 2 minutes par image 512x512 , contre 2-5 secondes pour SDXL. Le décoding spéculatif et l'optimisation de cache KV réduisent l'écart mais ne le ferment pas.

### Pourquoi cela importe ?

Si la prédiction de la prochaine jeton s'adapte à la diffusion sur la génération d'images, le chemin du modèle unifié (une perte, une colonne vertébrale, n'importe quelle modalité) est viable.

Show-o, Janus-Pro et InternVL-U s'appuient tous sur cette thèse ou la défient.

```figure
l5-emu3-next-token
```

## Utilisez-le

`code/main.py`construit deux jouets:

- Un calculateur de compte de jetons VQ 2D vs 3D: donné (résolution, patch, clip_length, FPS), compte de jetons de calcul pour image vs vidéo.
- Un échantillonneur autorégressif à jeton d'image avec une orientation sans classifiant à température.

La mise en œuvre du CFG correspond à la recette de l'EMU3  mélangez des logits conditionnels et inconditionnels avec un poids de référence.

## La faire partir

Cette leçon produit `outputs/skill-token-gen-cost-analyzer.md`. Compte tenu de la spécificité du produit de génération (image ou vidéo, résolution cible, niveau de qualité, budget de latence), il calcule le nombre de jetons, le coût d'inférence et choisit Emu3-famille par rapport à diffusion.

## Exercices

1. Emu3 produit 4096 jetons par image 512x512 à une réduction de 8x8. Compute l'équivalent pour 1024x1024 et 2048x2048.

2. Lisez la section 3.3 de l'Emu3 sur le jeton vidéo. Décrivez la forme du patch VQ 3D et pourquoi il couvre 4 images x 8x8 pixels au lieu d'une seule image.

3. Le poids de la direction sans classifiant 5.0 contre 3.0: quel effet visuel ?`code/main.py`- Je suis désolé .

4. Comptez les FLOP de formation pour Emu3 (8B) à un jeton supposé de 300B et comparez-les à la diffusion stable 3.

5. L'Emu3 est supérieur à SDXL sur FID mais pas sur VQAv2 par rapport aux VLM spécialisés.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Next-token prediction | "NTP" | Standard autoregressive loss: predict token[i+1] given token[0..i]; works for every modality when tokenized |
| IBQ tokenizer | "Inverse bottleneck quantizer" | A class of VQ-VAE with larger codebooks (32768+) and better reconstruction than Chameleon's |
| 3D VQ | "Spatiotemporal quantizer" | Codebook indexed by (time, row, col); one token covers 4 frames x 8x8 pixels |
| Classifier-free guidance | "CFG" | Mix conditional and unconditional logits with weight gamma; boosts image quality at inference |
| Unified vocabulary | "Shared tokens" | Text + image + video all draw from the same integer space; model predicts whichever modality comes next |
| MJHQ-30K | "Image gen benchmark" | Midjourney-quality benchmark with 30k prompts; Emu3 reports FID here |

## Pour en savoir plus

- [Wang et al. — Emu3: Next-Token Prediction is All You Need (arXiv:2409.18869)](https://arxiv.org/abs/2409.18869)
- [Sun et al. — Emu: Generative Pretraining in Multimodality (arXiv:2307.05222)](https://arxiv.org/abs/2307.05222)
- [Liu et al. — LWM (arXiv:2402.08268)](https://arxiv.org/abs/2402.08268)
- [Yu et al. — MAGVIT-v2 (arXiv:2310.05737)](https://arxiv.org/abs/2310.05737)
- [Tian et al. — VAR (arXiv:2404.02905)](https://arxiv.org/abs/2404.02905)
