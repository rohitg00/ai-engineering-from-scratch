# ColPali et le document RAG de vision natif

> Le RAG traditionnel analyse les PDF en texte, les divise en morceaux, les intègre en morceaux, les stocke en vecteurs. Chaque étape perd un signal: le OCR supprime les données du graphique, le déchiquetage rompt les lignes de table, les emblèmes de texte ignorent les chiffres. ColPali (Faysse et coll., juillet 2024) a posé la question la plus simple: pourquoi extraire du tout du texte ? Embed l'image de page directement via PaliGemma, utiliser l'interaction tardive de style ColBERT pour la récupération, et garder tous les lignes, les chiffres, les polices et le signal de formatage du document. Les critères de référence publiés: une précision de bout en bout de 20 à 40% supérieure à celle du texte-RAG sur les documents riches en visuels. ColQwen2, ColSmol et VisRAG ont étendu le schéma. Cette leçon lit la thèse de RAG et construit un minuscule index ColPali.

**Type:** Build
**Languages:** Python (stdlib, multi-vector indexer + MaxSim scorer), TypeScript
**Prerequisites:** Phase 11 (LLM Engineering — RAG basics), Phase 12 · 05 (LLaVA)
**Time:** ~180 minutes

## Objectifs d'apprentissage

- Expliquez la différence entre la récupération de deux encoders (un vecteur par document) et la récupération d'interaction tardive (plusieurs vecteurs par document).
- Décrivez l'opération MaxSim de ColBERT et comment ColPali la généralise des jetons de texte aux correctifs d'image.
- Construisez un petit index ColPali: page → patch embeddings → MaxSim sur les emblèmes de requête → top-k pages.
- Comparez le générateur ColPali + Qwen2.5 VL versus le générateur texte-RAG + GPT-4 sur un cas d'utilisation des factures / rapports financiers.

## Le problème

Le texte-RAG sur les PDF jette la plupart du document. La croissance des revenus du troisième trimestre d'un rapport financier est généralement dans un graphique; les résultats d'un rapport médical sont dans des images annotées; le bloc de signature d'un contrat juridique est un fait de mise en page, pas un fait de texte.

Le pipeline texte-RAG:

1. PDF → texte via OCR / pdftotext.
2. Le texte → 300 à 500 pièces de jetons.
3. Chunk → intégration de bi-encodeur (un vecteur).
4. Recherche utilisateur → intégration → similitude cosine → top-k morceaux.
5. Les élèves + les étudiants → LLM.

Cinq étapes perdantes, des graphiques non capturés, des tables brisées en morceaux, des tableaux à colonne multiplie, des annotations de figure disparaissent.

Correction de ColPali: sauter OCR, intégrer directement l'image de page. Utilisez l'interaction tardive de style ColBERT pour la récupération afin que le modèle puisse répondre aux correctifs à grains fins au moment de la requête.

## Le concept

### Le projet de loi

ColBERT (Khattab & Zaharia, arXiv:2004.12832) est une méthode de récupération de texte. Au lieu d'un vecteur par document, il produit un vecteur par jeton.

- Les jetons de requête obtiennent leurs propres emplacements ($N_q$Les vecteurs).
- Les jetons de document obtiennent des emplacements ($N_d$vecteurs, généralement en cache).
- Score = somme sur les jetons de requête de max sur les jetons de document de similitude cosine: $\sum_i \max_j \cos(q_i, d_j)$- Je suis désolé .

C'est l'opération MaxSim. chaque jeton de requête "choisit" son jeton de document le mieux correspondant. Le score final est la somme.

Avantages: rappel fort, gère la sémantique au niveau des termes.$N_d$Vecteurs par document, stockage coûteux.

### ColPali

ColPali (Faysse et coll., arXiv:2407.01449) applique le modèle ColBERT aux images.

- Chaque page est codée par PaliGemma (langue ViT +) dans des emplacements de correctifs: $N_p$vecteurs par page.
- Chaque requête utilisateur (texte) est codée dans des emplacements de jetons de requête: $N_q$Les vecteurs.
- Score = $\sum_i \max_j \cos(q_i, p_j)$, c'est-à-dire MaxSim sur les jetons de texte de requête et les patchs d'image de page.
- Récupérez les pages de premier ordre par score total.

Au moment de l'ingestion du document: intégrer chaque page avec PaliGemma, stocker toutes les intégrations de correctifs. au moment de la requête: intégrer les jetons de requête, calculer MaxSim par rapport à toutes les intégrations de page stockées, retourner les pages top-k.

Les avantages: le texte de bout en bout dépasse le RAG de 20 à 40% sur les documents riches en visuel.

Les inconvénients: $N_p$patches × 4 bytes flottantes × $D$-dim vecteurs par page = stockage croît rapidement.

### ColQwen2 et ColSmol

ColQwen2 (illuin-tech, 2024-2025) échange PaliGemma contre Qwen2-VL. Meilleur encodeur de base, meilleure récupération.

ColSmol est la variante à plus petite échelle pour l'utilisation locale / bord. Un retriever ColSmol à ~ 1B paramètres fonctionne sur un GPU de consommation.

### VisRAG

VisRAG (Yu et al., arXiv:2410.10594) est une variante différente: au lieu de MaxSim sur les correctifs, regroupez chaque page en un seul vecteur avec un VLM puis récupérez le bi-encodeur.

Le compromis qualité-coût: ColPali pour la qualité, VisRAG pour l'échelle.

### M3DocRAG

M3DocRAG (Cho et al., arXiv:2411.04952) étend la récupération multimodal au raisonnement multi-pages multi-document.

### ViDoRe  l'indice de référence

Évaluation visuelle de la récupération de documents. Les tâches comprennent les rapports financiers, les documents scientifiques, les documents administratifs, les dossiers médicaux, les manuels.

ColPali-v1 donne ~80% de nDCG@5 sur ViDoRe; le texte-RAG sur les mêmes documents donne ~50 à 60% de résultats.

### Le pipeline RAG de bout en bout

Pour un RAG natif de vision:

1. Ingest: PDF → images de page → PaliGemma encoding → stockage de tous les emplacements de correctifs.
2. Recherche: texte utilisateur → emblèmes de jetons de requête → MaxSim contre toutes les pages indexées → pages top-k.
3. Générer: images de la page top-k + requête → VLM (Qwen2.5-VL ou Claude) → réponse.

Aucun OCR, les chiffres, les graphiques, les polices, la mise en page vont tous dans la réponse.

### Mathématiques de stockage

Un rapport financier de 50 pages avec 729 correctifs par page et 128 dimensions intégrées:

- ColPali: 50 * 729 * 128 * 4 octets = ~ 18 Mo brut, ~ 2,3 Mo après 8x PQ.
- RAC texte: 50 morceaux * 768-dim * 4 octets = ~ 150 kB.

ColPali est ~ 120x plus de stockage par document brut. À l'échelle, 8x OPQ / PQ le réduit à ~ 15x, généralement tolérable.

### Quand le texte-RAG gagne toujours

- Document pur texte sans signal de mise en page (articles wiki, journaux de discussion).
- Des archives de plusieurs millions de pages où le stockage domine le coût.
- Exigences réglementaires strictes exigeant que le texte OCR extraitable soit ajouté à la récupération.

Pour tout le reste en 2026  rapports financiers, documents scientifiques, contrats juridiques, dossiers médicaux, documentation UX  vision-native RAG gagne.

```figure
mm-maxsim
```

## Utilisez-le

`code/main.py`- Le numéro de la liste:

- Encodeur de patch de jouet: il cartographiera une "page" (petite grille de vecteurs de caractéristiques) à un ensemble d'embeddings de patch.
- Scorer MaxSim: calcule le score de style ColBERT entre un ensemble d'intégration de jetons de requête et un ensemble de correctifs de page.
- Il indique 5 pages de jouets, exécute 3 requêtes, renvoie le top-k avec des scores.

## La faire partir

Cette leçon produit `outputs/skill-vision-rag-designer.md`. Dans le cadre d'un projet document-RAG, choisissez ColPali / ColQwen2 / VisRAG / text-RAG et taillez le stockage.

## Exercices

1. Un rapport annuel de 200 pages à 729 patches par page, un emb 128 dimensions, des floats de 4 bytes.

2. MaxSim est $\sum_i \max_j \cos(q_i, p_j)$Que cette somme capture qu'une simple signification de similitude ne le fait pas ?

3. ColPali indice les pages comme des ensembles de correctifs. Quels changements si nous indexons au niveau des mots (comme ColBERT le fait)?

4. Conceptez le pipeline de bout en bout pour un corpus de 1M de pages avec un budget de latence de 500 ms par requête. Choisissez ColQwen2 / VisRAG et justifiez.

5. Lisez M3DocRAG (arXiv:2411.04952). Décrivez le modèle d'attention multi-pages et comment il diffère de la récupération ColPali d'une seule page.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Late interaction | "ColBERT-style" | Retrieval using per-token or per-patch embeddings + MaxSim, not a single doc vector |
| MaxSim | "Max-over-patches" | For each query token, pick the highest-similarity document token; sum across query |
| Bi-encoder | "Single-vector" | One vector per document; faster but loses granularity |
| Multi-vector | "Many-vectors-per-doc" | Store $N_p$ vectors per document / page; storage cost grows but recall improves |
| Patch embedding | "Page feature" | One vector per image patch from a VLM encoder, cached per page |
| ViDoRe | "Vision doc bench" | ColPali's benchmark suite for visual document retrieval |
| PQ quantization | "Product quantization" | Compression that maintains vector similarity while shrinking storage ~8x |

## Pour en savoir plus

- [Faysse et al. — ColPali (arXiv:2407.01449)](https://arxiv.org/abs/2407.01449)
- [Khattab & Zaharia — ColBERT (arXiv:2004.12832)](https://arxiv.org/abs/2004.12832)
- [Yu et al. — VisRAG (arXiv:2410.10594)](https://arxiv.org/abs/2410.10594)
- [Cho et al. — M3DocRAG (arXiv:2411.04952)](https://arxiv.org/abs/2411.04952)
- [illuin-tech/colpali GitHub](https://github.com/illuin-tech/colpali)
