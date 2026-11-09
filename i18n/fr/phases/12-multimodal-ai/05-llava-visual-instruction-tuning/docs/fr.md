# LLaVA et réglage des instructions visuelles

> LLaVA (avril 2023) est l'architecture multimodal la plus copiée de la planète. Il a remplacé le Q-Former de BLIP-2 par un MLP à 2 couches, a remplacé l'attention croisée fermée de Flamingo par une concatenation de jetons naïve et a été formé sur 158k tours d'instruction visuelle générés par GPT-4 à partir de légendes uniquement textuelles. Tout praticien qui a construit un VLM entre 2023 et 2026 a construit une variante de LLaVA. LLaVA-1.5 a été échangé dans un projecteur MLP et un encodeur 336px. LLaVA-NeXT a ajouté une carreaux AnyRes pour les entrées à haute résolution. LLaVA-OneVision image unifiée, multi-image et vidéo dans une recette. Cette leçon lit la recette, met en œuvre le projecteur et explique pourquoi "le plus simple a gagné".

**Type:** Build
**Languages:** Python, TypeScript (stdlib, projector + instruction-template builder)
**Prerequisites:** Phase 12 · 02 (CLIP), Phase 11 (LLM Engineering — instruction tuning)
**Time:** ~180 minutes

## Objectifs d'apprentissage

- Construire un projecteur MLP à 2 couches qui carte les emplacements de patch ViT (dim 1024) à la dim d'embedding d'un LLM (dim 4096).
- Suivez la recette en deux étapes de LLaVA: (1) alignement du projecteur sur 558k paires de sous-titres, (2) réglage des instructions visuelles sur 158k virages générés par GPT-4.
- Construire un prompt au format LLaVA avec le placeholder des jetons d'image, le prompt système et les tours utilisateur/assistant.
- Expliquez pourquoi la communauté a déménagé de Q-Former à MLP malgré la victoire de Q-Former.

## Le problème

Le Q-Former de BLIP-2 (Lesson 12.03) comprime une image à 32 jetons. propre, efficace, bon pour les repères. Mais il a deux problèmes.

La première étape consiste à entraîner la perte de l'ITC+ITM+ITG. La deuxième étape consiste à entraîner la perte de l'IM. Les requêtes apprennent une représentation intermédiaire que le MLL doit ensuite décoder.

Deuxièmement, le Q-Former prend 188 millions de paramètres, et à l'échelle 2023 de LLaVA, vous avez dû le co-construire avec votre LLM cible. Changez le LLM, retrainer le Q-Former. Changez le codeur de vision, retrainer. Chaque combinaison était un projet de R&D séparé.

La réponse de LLaVA était embarrassante en raison de sa simplicité: prenez les 576 jetons de patch du ViT, passent chacun par un MLP à 2 couches (`1024 → 4096 → 4096`Pas de goulot d'étrangle, pas de stage 1 de prétrainer sur des objectifs bizarres, entraînez simplement le MLP sur une perte directe de LM.

D'où viennent les données ? La deuxième idée de LLaVA: utiliser GPT-4 (seulement texte) pour générer des données d'instruction. Donner GPT-4 le titre COCO et les données de boîte de délimitation pour une image, lui demander de produire des conversations, des descriptions et des questions de raisonnement complexes. 158k instructions-réponse tourne gratuitement. Pas de notes humaines.

Le résultat: un VLM qui a couru sur 8 A100 pendant une journée, a battu Flamingo sur MMMU, et a expédié un point de contrôle ouvert que la communauté pouvait étendre.

## Le concept

### L'architecture

LLaVA-1.5 à 7B:
- Encodeur de vision: CLIP ViT-L/14 @ 336 (congelé pendant la phase 1, défriché optionnellement pendant la phase 2).
- Projecteur: 2 couches de MLP avec activation GELU, `1024 → 4096 → 4096`- Je suis désolé .
- LLM: Vicuna-7B v1.5 (une variante 13B utilise Vicuna-13B; les fourches ultérieures sont passées à Llama-3.1-8B).

Passer en avant une image + texte:

```
img -> ViT -> 576 patches of dim 1024
patches -> MLP -> 576 tokens of dim 4096
prompt: system + "<image>" placeholder + user question
replace <image> token with the 576 projected tokens
feed the full sequence to the LLM
decode response
```

L'image occupe 576 jetons du contexte LLM. Dans le contexte 2048, cela laisse 1472 jetons pour le texte. Dans le contexte 32k, c'est une erreur d'arrondissement.

### Étape 1: alignement du projecteur

Le code de la langue est un code de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de la langue de

Dans une seule époque, au lot 128, cela se fait en quelques heures. Le projecteur apprend à cartographier l'espace ViT à l'espace LLM. Aucune supervision spécifique à la tâche.

### Étape 2: réglage des instructions visuelles

Défrichez le projecteur (encore entraînable). Défrichez le LLM (généralement complètement, parfois LoRA).

Les données d'instruction sont la ruse.
1. Prenez une image du COCO.
2. Extraire la description du texte (5 sous-titres humains + liste de boîtes délimitées).
3. Envoyez à GPT-4 avec trois modèles de commande:
   - Conversation: "Generer un dialogue entre un utilisateur et un assistant sur cette image".
   - Description détaillée: "Donnez une description riche et détaillée de l'image".
   - Réflexion complexe: " Posez une question qui demande de raisonner sur l'image, puis répondez- lui. "
4. Parser la sortie du GPT-4 en paires (instruction, réponse).

Aucun de ces éléments ne touche directement l'image  seulement la description du texte. GPT-4 hallucine le contenu plausible de l'image.

### Pourquoi la communauté a copié ça ?

- Aucune perte spécifique à l'étape 1, aucune perte de LM.
- Le projecteur traîne en heures, pas en jours.
- Le LLM peut être échangé (LLaVA-Llama2, LLaVA-Mistral, LLaVA-Llama3) en re-entraînant uniquement le projecteur.
- Le pipeline de données d'instruction visuelle utilise GPT-4 et est bon marché à régénérer pour un nouveau domaine.

### LLaVA-1.5 et LLaVA-NeXT

LLaVA-1.5 (octobre 2023) a ajouté:
- Les données de tâches académiques (VQA, OKVQA, RefCOCO) mélangées à la mise en forme des instructions.
- Un meilleur système rapide.
- Un projecteur MLP à 2 couches à la place de la couche linéaire unique originale, et CLIP ViT-L/14 à 336px (576 jetons) à la place de 224px (256 jetons).
- Une variante HD qui divise la grille dans le journal, que LLaVA-NeXT expédia plus tard sous le nom d'AnyRes.

LLaVA-NeXT (janvier 2024) a ajouté:
- AnyRes: divisez les images haute résolution en une grille de 2x2 ou 1x3 de 336 cultures, plus une miniature mondiale de basse résolution. Chaque culture devient 576 jetons. Une grille de 2x2 plus la miniature donne environ 2880 jetons visuels par image. Une grille de 1x3 a moins de cultures, donc elle coûte moins de jetons. Les tâches OCR et graphiques ont augmenté.
- Meilleur mélange de données d'instruction avec ShareGPT4V (titres GPT-4V de haute qualité).
- Les mécanismes de droit de base plus forts (Mistral-7B, Yi-34B).

### LLaVA-OneVision

Leçon 12.08 couvre OneVision en profondeur. version courte: même projecteur, mais formé avec un programme qui couvre une seule image, plusieurs images et vidéo dans un modèle avec un budget de jeton visuel partagé.

### La comparaison avec Q-Former

| | Q-Former (BLIP-2) | MLP (LLaVA) |
|---|---|---|
| Visual tokens per image | 32 | 576 (base) or about 2880 (AnyRes, 2x2 grid) |
| Trainable params | 188M + LM | ~22M (7B) + LM |
| Stage 1 loss | ITC+ITM+ITG | LM only |
| LLM drop-in | Requires retrain | Swap with minimal retrain |
| Multi-image | Awkward | Natural (concat) |
| Video | Awkward | Natural (per-frame concat) |
| Token budget | Small | Large |

Le MLP gagne sur la simplicité et la flexibilité des tokens. Q-Former gagne sur le budget des tokens.

### Le format de la demande

```
A chat between a curious human and an artificial intelligence assistant. The assistant gives helpful, detailed, and polite answers to the human's questions. USER: <image> Describe this image in detail. ASSISTANT: The image shows ...
```

`<image>`Le Tokenizer voit une séquence légèrement plus longue qu'elle n'a été formée, mais le LLM gère la nouvelle entrée parce que l'étape 1 l'a appris.

### Économie de paramètres

LLaVA-1.5-7B décomposition:
- CLIP ViT-L/14 @ 336: 303M (étape congelée 1, souvent défrichée étape 2).
- Projecteur (2x linéaire): ~22M entraînable.
- Llama-7B: 7B.
- Total: 7,3B params. Trainable pendant la deuxième étape: projecteur complet 7B + 22M.

Coût de formation pour l'étape 2: ~ 20 heures sur 8xA100. C'est le numéro clé  un jour, un nœud, reproduisable. C'est pourquoi la LLaVA se propage.

```figure
mm-llava-projector
```

## Utilisez-le

`code/main.py`les implémentations:

1. Le projecteur MLP à 2 couches (dim 16 → 32 → 32 pour l'échelle de jouets) en Python pur.
2. Le pipeline de construction rapide: système rapide + `<image>`remplacé par N de jetons projetés + tour utilisateur + placeholder de génération assistante.
3. Un visualisateur pour voir à quoi ressemble le bloc visuel de 576 jetons dans le contexte de LLM (pourcentage de 2k / 32k / 128k de contexte consommé).

## La faire partir

Cette leçon produit `outputs/skill-llava-vibes-eval.md`. En raison d'un point de contrôle familial LLaVA, il utilise une suite de vibrations à 10 impulsions (3 sous-titres, 3 VQA, 2 raisonnements, 2 refus) et rapporte une carte de score lisible par l'homme.

## Exercices

1. Calculer le nombre de paramètres entraînables pour le projecteur MLP à 2 couches à `1024 → 4096 → 4096`Avec GELU et biais, quelle fraction de LLaVA-13B représente-t-il ?

2. Construire une demande de réponse LLaVA pour un cas de "réjection"  l'image contient un particulier. Écrivez la réponse attendue de l'assistant. Pourquoi LLaVA devrait-elle refuser ce tir zéro et quelles données de formation seraient nécessaires pour renforcer le refus?

3. Lisez la section AnyRes du blog LLaVA-NeXT. Comptez le nombre de jetons visuels pour une image 1344x672 à AnyRes. Comparer à la base 576 jetons à 336x336.

4. Le projecteur LLaVA de phase 1 est entraîné avec une perte de LM sur les légendes. Que se passe-t-il si vous sautez la phase 1 et passez directement à la phase 2 (tonnement des instructions visuelles)?

5. LLaVA-Instruct-150k utilise GPT-4 avec des légendes COCO pour générer des instructions. Pour un nouveau domaine (rayons X médicaux, images satellites), décrivez le pipeline de données en quatre étapes pour générer des instructions de domaine.

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Projector | "MLP bridge" | 2-layer MLP with GELU mapping ViT dim to LLM dim |
| Image token | "<image> placeholder" | Prompt marker replaced by N projected visual tokens before inference |
| Visual instruction tuning | "LLaVA stage 2" | Training on GPT-4-generated (image, instruction, response) triplets |
| Stage 1 alignment | "Projector pretraining" | Freeze ViT and LLM, train projector with LM loss on captions |
| AnyRes | "Multi-crop tiling" | Split high-res image into a tile grid and concatenate each tile's visual tokens |
| LLaVA-Instruct | "GPT-4-generated" | 158k instruction-response pairs synthesized from COCO captions + GPT-4 |
| Vision encoder freeze | "Backbone locked" | CLIP weights do not update in stage 1, sometimes not in stage 2 either |
| ShareGPT4V | "Better captions" | 1M dense captions generated by GPT-4V, used for higher-quality alignment |
| VQA | "Visual question answering" | Task of answering a free-form question about an image |
| Prismatic VLMs | "Design-space paper" | Karamcheti 2024 ablation systematically testing projector and data choices |

## Pour en savoir plus

- [Liu et al. — Visual Instruction Tuning (arXiv:2304.08485)](https://arxiv.org/abs/2304.08485) le papier LLaVA.
- [Liu et al. — Improved Baselines with Visual Instruction Tuning (arXiv:2310.03744)](https://arxiv.org/abs/2310.03744) LLaVA-1.5.
- [Chen et al. — ShareGPT4V (arXiv:2311.12793)](https://arxiv.org/abs/2311.12793) ensemble de données de sous-titres denses.
- [Karamcheti et al. — Prismatic VLMs (arXiv:2402.07865)](https://arxiv.org/abs/2402.07865) ablations de conception de l'espace.
- [Li et al. — LLaVA-OneVision (arXiv:2408.03326)](https://arxiv.org/abs/2408.03326) Unification d'une seule image, d'une image multiple, de vidéo.
