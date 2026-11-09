# Une vidéo longue dans un contexte de millions de mots

> Une vidéo 4K d'une heure à 24 FPS, parchée et intégrée, produit l'ordre de 60 millions de jetons. Un épisode de podcast de 2 heures transcrit est de 30 000 jetons. Un long métrage complet Blu-ray, même comprimé avec un pooling agressif, est de centaines de milliers de jetons. Le Gemini 1.5 de Google (mars 2024) a ouvert cette ère avec un contexte de 10 millions de jetons, faisant un rappel fiable de l'aiguille dans un paquet de foin sur des vidéos d'une heure. LWM (Liu et coll., février 2024) a montré la trajectoire d'échelle de l'attention des anneaux. LongVILA et Video- XL ont augmenté leur ingestion. VideoAgent a échangé le contexte brut pour la récupération agentique. Chaque approche est un compromis différent sur la complexité de l'informatique, du rappel et de l'ingénierie. Cette leçon les lit côte à côte.

**Type:** Build
**Languages:** Python (stdlib, needle-in-haystack simulator + agentic-retrieval router), TypeScript
**Prerequisites:** Phase 12 · 17 (video temporal tokens)
**Time:** ~180 minutes

## Objectifs d'apprentissage

- Calculer le nombre total de jetons visuels pour la vidéo longue format à des FPS et des pools variables.
- Expliquez les quatre voies d'échelle: contexte brut (Gemini 1.5), attention aux anneaux (LWM), compression des jetons (LongVILA / Video-XL), récupération agent (VideoAgent).
- Comparer les VLM vidéo contextuelle brute contre les VLM vidéo de récupération agencée (VideoAgent) sur la précision et la latence.
- Conçuez un test à l'aiguille dans un paquet de foin pour une vidéo de 30 minutes et mesurez le rappel à une minute spécifique.

## Le problème

Un seul cadre de patches de taille Qwen2.5VL à 384 résolution native est de ~ 729 jetons. À 3x3 pooling, c'est 81 jetons par cadre. Un clip de 30 minutes à 1 FPS = 1800 images = 145.800 jetons. Faible d'ici 2025, VLMs ouverts, serrés. À 2 FPS, 291.600 jetons  ne conviennent que aux plus grands contextes.

Un film de 2 heures à 1 FPS est de 583k jetons. Au-delà de la plupart des modèles ouverts de 2026; nécessite Gemini 2.5 Pro ou un regroupement plus agressif.

Quatre sentiers d'escalade sont apparus.

## Le concept

### Voie 1: contexte brut (Gemini 1.5, Claude Opus)

Jetez du matériel au problème, étalonnez le contexte à des millions de jetons, traitez tout en une seule passe.

Gemini 1.5 Pro est lancé avec 1M de jetons; Gemini 1.5 Ultra à 10M; Gemini 2.5 Pro en 2026 fait des heures de vidéo de manière fiable.

Ingénierie: une mise en œuvre d'attention personnalisée avec hiérarchie de mémoire (local + global + rare) plus un routage par expert MoE pour une efficacité de long contexte.

### Voie 2: Attention aux anneaux (LWM, LongVILA)

L'attention à l'anneau répartit de longues séquences entre les appareils dans un "anneau" où chaque appareil tient une pièce.

LWM (Liu et coll., 2024) a formé un modèle de contexte de 1M-token de cette façon. Les échelles de mémoire par appareil avec la pièce que chaque appareil détient, de sorte que l'ajout de dispositifs étend le contexte approximativement linéairement.

LongVILA (arXiv:2408.10188) a adapté le modèle aux VLM. Vidéos de 1400 images à 192 jetons par image = 268k contexte, entraînées avec l'attention des anneaux sur le parallélisme à 8 voies.

### Voie 3: Compression des jetons (vidéo-XL, LongVA)

Plus bon marché que le contexte brut: comprimé agressivement avant que le LLM ne voie la séquence.

Video-XL (arXiv:2409.14485) utilise un jeton de résumé visuel: chaque clip de N cadres produit un seul jeton de "récapitulation" qui se trouve au-dessus du N. En conséquence, le LLM voit un jeton de résumé par clip, réduisant considérablement le contexte.

LongVA étend le contexte de LLM de 200 000 à 2 millions avec une technique de "transfert de contexte long".

La compression des jetons échange le rappel à des timestamps spécifiques pour l'évolutivité. Le modèle sait généralement ce qui s'est passé mais manque parfois des cadres exacts.

### Voie 4: Récupération par agent (VideoAgent)

Ne pas fournir la vidéo complète au LLM. Traitez plutôt la vidéo comme une base de données et utilisez un LLM pour la consulter.

VidéoAgent (arXiv:2403.10517):

1. LLM lit la question.
2. Le MLL demande un outil de récupération pour les clips pertinents ("montre-moi des segments avec un chat").
3. L'outil renvoie les timestamps correspondants.
4. LLM lit ces clips par le biais d'un VLM.
5. Le MLL compose la réponse ou pose des questions de suivi.

C'est le modèle LLM-as-agent appliqué à la vidéo longue.

### Indices de référence pour l'aiguille dans un tas de foin

Le test de long-context standard: insérer un marqueur visuel ou textuel unique à un point aléatoire de la vidéo, puis poser une requête qui nécessite son rappel.

Métrique: Recall@k sur la longueur de la vidéo et la position du marqueur.

Les modèles Open 72B (Qwen2.5-VL-72B, InternVL3-78B) obtiennent un score de ~85-90% à 30 minutes et se dégradent au-delà de 60.

VideoAgent peut correspondre ou battre les modèles de contexte brut à plus de 2 heures parce que la récupération frappe l'aiguille si l'outil est bon.

### Quelle voie choisir ?

Pour un clip de 15 minutes à la précision de la frontière: ouvrir 72B + contexte natif fonctionne généralement.

Pour le contenu de 30 minutes à 1 heure: LongVILA ou Video-XL pour ouvert; Gemini 2.5 Pro pour fermé.

Pour un contenu de plus de 2 heures: VideoAgent ou des modèles de récupération similaires.

### Modèle de production 2026

En pratique, les pipelines de production vidéo longue sont hybrides:

1. Exécutez un prélèvement dynamique en FPS + un regroupement agressif sur l'ensemble de la vidéo (obtenir une représentation globale de 100k-token).
2. Passez à un VLM 72B pour un résumé global.
3. Si l'utilisateur pose des questions détaillées, effectuer une recherche agentique en utilisant le résumé comme index.

Cela combine le contexte brut pour la compréhension globale et la récupération des détails locaux.

```figure
mm-video-token-budget
```

## Utilisez-le

`code/main.py`- Le numéro de la liste:

- Compute les budgets de jetons pour les vidéos de 1 minute à 3 heures à des FPS + pooling variables.
- Simulation d'une course à l'aiguille dans un tas de foin: injection d'un marqueur à un timestamp aléatoire, pose une question, score rappel.
- Inclut un simulateur de routeur de récupération d'agents qui choisit des clips spécifiques pour les alimenter à un VLM en aval.

Faites le bilan et ressentez l'écart de l'échelle.

## La faire partir

Cette leçon produit `outputs/skill-long-video-strategy-planner.md`. Compte tenu de la durée de la vidéo et de la complexité de la requête, il choisit entre le contexte brut, la compression et la récupération agencée, et calcule les attentes de latence + qualité.

## Exercices

1. Une conférence de 45 minutes à 1 FPS, 81 jetons par image.

2. Conceptez un test à l'aiguille dans un tas de foin: à quelle minute vous injectez le marqueur, et quel est le format exact de la requête?

3. Comparer le contexte brut Qwen2.5-VL-72B (context 80k) à l'agent vidéo (Claude 3.5 + récupération) sur une vidéo d'une heure.

4. Les échelles de mémoire de l'attention à l'appareil avec la longueur de la séquence divisée par le nombre d'appareils, tandis que le calcul de l'attention totale reste quadratique.

5. Lisez Gemini 1.5 Section 5 sur l'aiguille dans un tas de foin.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Brute context | "Just more tokens" | Scale LLM context to millions of tokens; process everything in one pass |
| Ring attention | "LWM-style parallel" | Distributed attention pattern where each device holds a chunk and rotates |
| Token compression | "Summary tokens" | Reduce per-clip tokens via a learned compressor before the LLM |
| Needle-in-haystack | "NIH test" | Insert a unique marker at a random point, ask model to recall it at test time |
| Agentic retrieval | "LLM as query planner" | LLM asks a retrieval tool for relevant clips, reads them via a VLM, composes answer |
| VideoAgent | "Retrieval pattern for video" | Canonical agentic-retrieval design: question -> tool -> clip -> answer |

## Pour en savoir plus

- [Gemini Team — Gemini 1.5 (arXiv:2403.05530)](https://arxiv.org/abs/2403.05530)
- [Liu et al. — LWM / RingAttention (arXiv:2402.08268)](https://arxiv.org/abs/2402.08268)
- [Xue et al. — LongVILA (arXiv:2408.10188)](https://arxiv.org/abs/2408.10188)
- [Shu et al. — Video-XL (arXiv:2409.14485)](https://arxiv.org/abs/2409.14485)
- [Wang et al. — VideoAgent (arXiv:2403.10517)](https://arxiv.org/abs/2403.10517)
