# Réglage de la RAG multimodal et de la récupération croisée

> Le document RAG est une tranche. Le RAG multimodal de production est plus large  en récupérant du texte, des images, de l'audio et de la vidéo pour des flux de travail tels que la planification des voyages (" trouvez-moi un brunch végétalien tranquille avec lumière naturelle "), le triage médical (" quelle blessure correspond à cette photo + ces notes "), le commerce électronique (" tenues similaires à cette selfie, dans ma taille ") et le service sur le terrain (" diagnostiquez ce son du moteur plus la photo de la pièce "). Trois enquêtes de 2025  Abootorabi et al., Mei et al., Zhao et al.  codifier les sous-problèmes: récupération trans-modale, fusion de récupération, mise à terre de la génération, évaluation multimodale. Cette leçon lit les enquêtes et conçoit un pipeline de production.

**Type:** Build
**Languages:** Python (stdlib, cross-modal retriever with fusion + grounded generator), TypeScript
**Prerequisites:** Phase 12 · 23 (ColPali), Phase 11 (RAG basics)
**Time:** ~180 minutes

## Objectifs d'apprentissage

- Réception par modalities croisées: texte → image, image → texte, audio → vidéo, etc.
- Comparer trois stratégies de fusion: fusion de score, fusion axée sur l'attention, fusion MoE.
- Expliquez la mise à terre de la génération: à quoi ressemble "citer vos sources" lorsque les sources sont un mélange de modalités.
- Nombre des trois enquêtes canoniques multimodelles du RAG de 2025 et de leur taxonomie sous-problème.

## Le problème

Le RAG à modalité unique est un schéma résolu: intégrer la requête, intégrer les morceaux, récupérer, les choses dans le LLM. Le RAG multimodale nécessite:

1. Plusieurs têtes de récupération (chaque modalité a besoin d'embeddings dans un espace compatible).
2. La fusion des résultats de récupération entre les modalités.
3. Le terrain de génération qui cite des sources à travers les modalités.
4. Les mesures d'évaluation couvrant le signal trans-modal.

Les enquêtes de 2025 arrivent toutes à la même taxonomie.

## Le concept

### Récupération croisée

Retrouvez les documents de la modalité B à la suite d'une requête de la modalité A. Trois modèles:

1. L'espace d'embedding partagé. CLIP et CLAP produisent des emblèmes de texte + image / texte + audio dans un espace partagé. La similitude cosine entre les modalités fonctionne directement. Limité aux paires formées par CLIP.

2. Encodeur de modalité + traduction. Encodeur de texte + encodeur d'image + un petit module de traducteur cartographiant entre les espaces. Sen2Sen par Gupta et coll. et d'autres conceptions 2024.

3. Utilisez les états cachés d'un VLM comme représentation de récupération.

Choix: CLIP / SigLIP 2 pour texte + image; CLAP pour texte + audio; VLM-états cachés pour la qualité transversale à frontière.

### Stratégies de fusion

Vous avez récupéré 10 résultats: 5 images, 3 passages de texte, 2 clips audio. Comment fusionnons-nous ?

La fusion de scores (plus bon marché). Chaque modalité a son propre retriever, chacun rend des scores. Normalizer les scores dans la modalité puis somme. Simple, fonctionne souvent.

La fusion basée sur l'attention. Concaténer tous les objets récupérés, laisser un petit réseau d'attention les peser.

La fusion MoE. Gating des itinéraires réseau vers des experts spécifiques à la modalité.

Par défaut de production: fusion de score avec un léger biais vers la modalité dominante de la requête.

### Le rajeunissement de la génération

La MLL doit citer le point récupéré qui a motivé chaque réclamation.

- Source de texte: citation standard `[1]`- Je suis désolé .
- Source d'image: `[img 3]`avec une courte légende.
- Audio: `[audio 2 at 0:34]`- Je suis désolé .

Entraînez le générateur avec des données de base: chaque affirmation dans la cible de formation est marquée par l'indice source.

### Les enquêtes de 2025

Abootorabi et al. (arXiv:2502.08826, "Ask in Any Modality"): taxonomie pour RAG multimodal. Couvre le retrait, la fusion, la génération. Couverture la plus large.

Mei et al. (arXiv:2504.08748, "A Survey of Multimodal RAG"): se concentre sur les repères de sous-tâche et les modes d'échec. Utilisés pour la conception d'évaluation.

Zhao et coll. (arXiv:2503.18016): enquête axée sur la vision.

Lire les trois vous donne l'état de l'art au printemps 2025.

### MuRAG  le document fondateur

MuRAG (Chen et coll., 2022) a été le premier RAG multimodal. Il a récupéré une image + texte à partir d'un KB multimodal, généré des réponses. Il a montré sa faisabilité avant la vague VLM.

### Un exemple de planificateur de voyage de production

" Trouvez-moi un petit déjeuner végétalien tranquille avec de la lumière naturelle. "

L'équipement de transport:

1. Décomposer la requête. "quiet" → mot clé audio/révision; "vegan brunch" → élément du menu; "lumière naturelle" → fonction d'image.
2. Retour par modalité:
   - Récupération de texte sur les commentaires: "brunch végétalien, ambiance calme".
   - Retrait d'image sur les photos du restaurant: "Lumière naturelle, airée".
   - Récupération audio sur des clips sonores ambiants: " bas décibels, pas de musique ".
3. Chaque restaurant a un score composé.
4. Les restaurants Top-k → générateur VLM avec toutes les preuves → réponse avec des citations.

Chaque modalité ajoute un signal que le texte seul manque.

### RG multimodaux agencés

Multi-hop: si la première récupération ne renvoie pas de réponses de haute confiance, le LLM reformula et récupère à nouveau.

- Retriever le top-10 initial → LLM demande "trop bruyant, filtre pour <40 dB" → récupérer.
- Retriever des images → LLM voit que l'on a un menu → récupérer le texte du menu → réponse.

Ajout de complexité mais gère des requêtes que la récupération à un seul coup ne peut pas.

### Évaluation

L'évaluation intermodale est encore immature.

- Rappel par modalité.
- Une précision top-k fusionnée.
- La satisfaction de bout en bout jugée par l'homme.
- Spécifique de tâche (réservations effectuées, achats effectués).

Aucune référence standard ne couvre toutes les modalités.

```figure
contrastive-matrix
```

## Utilisez-le

`code/main.py`- Le numéro de la liste:

- Trois faux récupérateurs (texte, image, audio) opèrent sur un corps commun de restaurants.
- Fusion de scores qui combine les scores de modalité avec des poids configurables.
- Un étiquette générateur qui émet une réponse finale avec des citations.
- Une simple boucle agencée qui réformula la requête si la confiance est faible.

## La faire partir

Cette leçon produit `outputs/skill-multimodal-rag-designer.md`- étant donné une spécification de produit avec un flux de requête multimodal, les conceptions de récupérateurs, de fusion, de générateur et d'évaluation.

## Exercices

1. Proposer un RAG multimodal de triage médical: requête = photo de blessure + symptômes de texte.

2. La fusion de scores est une somme simple pondérée.

3. Lisez la taxonomie d'Abootorabi et coll. (section 3). Quels sont les trois sous-problèmes canoniques et comment correspondent-ils au produit que vous avez choisi?

4. Conceptez une spécification d'évaluation pour un RAG multimodal de planificateur de voyage.

5. Le RAG multi-hop agentique a une taxe de latence par aller-retour.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Cross-modal retrieval | "Query one modality, retrieve another" | Text query retrieves images; image query retrieves text; requires a shared space or translator |
| Score fusion | "Combine scores" | Weighted sum of per-modality retrieval scores; simplest fusion |
| MoE fusion | "Modality-routed experts" | Gating network picks which modality's scores to trust per query |
| Grounded generation | "Cite your sources" | Each claim in the answer tagged with the source index |
| MuRAG | "First multimodal RAG" | 2022 paper that established the multimodal RAG pattern |
| Agentic multi-hop | "Reformulate and retry" | LLM re-queries retrievers when first-pass confidence is low |

## Pour en savoir plus

- [Abootorabi et al. — Ask in Any Modality (arXiv:2502.08826)](https://arxiv.org/abs/2502.08826)
- [Mei et al. — A Survey of Multimodal RAG (arXiv:2504.08748)](https://arxiv.org/abs/2504.08748)
- [Zhao et al. — Vision RAG Survey (arXiv:2503.18016)](https://arxiv.org/abs/2503.18016)
- [Chen et al. — MuRAG (arXiv:2210.02928)](https://arxiv.org/abs/2210.02928)
- [Liu et al. — REACT (arXiv:2301.10382)](https://arxiv.org/abs/2301.10382)
