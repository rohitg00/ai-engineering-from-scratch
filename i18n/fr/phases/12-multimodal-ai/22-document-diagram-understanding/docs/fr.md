# Compréhension du document et du diagramme

> Les documents ne sont pas des photos. Un PDF, un document scientifique, une facture ou un formulaire manuscrit ont une disposition, des tableaux, des diagrammes, des notes de bas de page, des en-têtes et une structure sémantique que la compréhension d'une image simple ne peut pas saisir. La pile pré-VLM était un pipeline: Tesseract OCR + LayoutLMv3 + heuristiques d'extraction de table. La vague VLM a remplacé celle-ci par des modèles sans OCR  Donut (2022), Nougat (2023), DocLLM (2023)  qui émettent directement une marquage structurée. En 2026, la frontière est simplement "alimenter l'image de page à Claude Opus 4.7 à 2576px natif", et la sortie de marquage structuré est gratuite. Cette leçon est le cours de l'Arc de l'IA de trois époques.

**Type:** Build
**Languages:** Python (stdlib, layout-aware document parser skeleton), TypeScript
**Prerequisites:** Phase 12 · 05 (LLaVA), Phase 5 (NLP)
**Time:** ~180 minutes

## Objectifs d'apprentissage

- Expliquez les trois époques de l'IA du document: pipeline OCR, libre de OCR, VLM-native.
- Décrivez les trois flux d'entrée de LayoutLMv3: texte, mise en page (bbox), correctifs d'image, avec masquage unifié.
- Comparez Donut (sans OCR, image → marquage), Nougat (papier scientifique → LaTeX), DocLLM (génératif en connaissance de mise en page), PaliGemma 2 (natif VLM).
- Choisissez un modèle de document pour une nouvelle tâche (factures, documents scientifiques, formulaires manuscrits, reçus chinois).

## Le problème

"Comprendre ce PDF" est trompeur.

- Contenu du texte (90% du signal).
- L'élaboration (titres, notes de bas de page, barres latérales, format de deux colonnes).
- Tableaux (lignes, colonnes, cellules fusionnées).
- Des chiffres et des diagrammes.
- Des notes écrites à la main.
- Fonts et typographie (titre contre corps).

Un système qui se soucie des factures doit savoir que "Total: $1.245" est venu du bas à droite, pas d'une note de bas de page.

## Le concept

### Époque 1  L'oléoduc OCR (avant 2021)

La pile classique:

1. PDF → image par page.
2. Tesseract (ou OCR commercial) extrait du texte avec des boîtes de délimitation par mot.
3. L'analyseur de mise en page identifie les blocs (titre, tableau, paragraphe).
4. Le reconnaisseur de structure de table partage les tables.
5. Règles de domaine + champs d'extrait de régex.

Fonctionne pour un texte imprimé propre. Faites une pause sur l'écriture, des scans déformés, des tables complexes, des scripts non anglais. Chaque mode d'échec nécessite un chemin d'exception personnalisé.

### Régime de contrôle des risques

Le TROCR (Li et al., arXiv:2109.10282) a remplacé le classique CNN-CTC de Tesseract par un transformateur encodeur-décodeur formé sur des images de texte synthétiques + réelles.

### Ére 2  exempte de RCO (2022-2023)

Les premiers modèles sans OCR disaient: sauter la détection entièrement, cartographier les pixels d'image à la sortie structurée directement.

Donuts (Kim et coll., arXiv:2111.15664):
- Transformateur de décodeur-encodeur, le codeur est Swin-B.
- La sortie est JSON pour la compréhension des formes, le décompte pour la résumé ou tout schéma spécifique à la tâche.
- Pas de RCR, pas de mise en page, pas de détection.

Nougat (Blecher et coll., arXiv:2308.13418):
- Formé spécifiquement sur des documents scientifiques.
- La sortie est LaTeX / marquage.
- Il traite des équations, des lignes de plusieurs colonnes, des chiffres.
- Le modèle que chaque arXiv parser appelle.

Les spécialistes, pas les généralistes, les donuts sur un article scientifique échouent, les nougat sur une facture échouent.

### L'élaboration de l'équipe

L'arrangementLMv3 (Huang et al., arXiv:2204.08387) conserve l'OCR mais ajoute la compréhension de la mise en page:

- Trois flux d'entrée: des jetons de texte OCR, des boîtes de délimitation 2D par jeton, des correctifs d'image.
- Objectif de formation masquée dans les trois modalités (texte masqué, correctifs masqués, mise en page masquée).
- En aval: classification, extraction d'entités, tableau QA.

LayoutLMv3 est le sommet de la compréhension des documents basés sur OCR. Fort sur les formulaires et les factures. Requiert OCR en amont.

### DocLLM (2023)

DocLLM (Wang et al., arXiv:2401.00908, soumis le 31 décembre 2023, donc l'ID porte un préfixe de janvier 2024) est le frère génératif de LayoutLM. Génère des réponses de forme libre conditionnées sur des jetons de mise en page.

### Époque 3  VLM-native (2024+)

2024 VLMs sont devenus assez bons pour remplacer le pipeline entièrement.

- LLaVA-NeXT 336-tile AnyRes fonctionne pour les petits documents.
- Qwen2.5VL à résolution dynamique gère 2048+ pixels nativement.
- Claude Opus 4.7 prend en charge les documents de 2576px.
- PaliGemma 2 (décembre 2024) est une formation spécifiquement pour les documents + écriture à la main.

Le fossé entre le VLM-native et le pipeline OCR s'est rapidement fermé.

- Textes de scène (écrit à la main + imprimé, scripts mixtes).
- Tableaux complexes avec cellules fusionnées.
- Des équations mathématiques intégrées dans le texte.
- Figures avec annotations de texte.

Les pipelines OCR gagnent encore sur:

- Des charges de travail à grande échelle où la latence par page compte.
- La fiabilité des pipelines (failles déterministiques par rapport aux hallucinations de VLM).
- Environnements réglementés nécessitant une sortie de RCR auditable.

### La frontière Claude 4.7 / GPT-5

À 2576 pixels, les VLM frontaliers documentent la compréhension à une précision presque humaine.

- DocVQA: Claude 4.7 ~95.1, PaliGemma 2 ~88.4, Nougat ~77.3, en tuyau LayoutLMv3 ~83.
- Le tableau QQ: Claude 4.7 ~ 92,2 GPT-4V ~ 78.
- Le MRC visuel: Claude 4.7 ~ 94.

Les modèles fermés sont principalement de résolution et de base à l'échelle LLM. Les modèles ouverts à 7B sont quelques points en retard mais se rattrapent.

### Équations mathématiques et sortie LaTeX

Les documents scientifiques ont besoin d'une sortie exacte de LaTeX pour les équations. Nougat a été formé à ce sujet. Les VLM formés avec des cibles LaTeX (Qwen2.5-VL-Math, dérivés Nougat) produisent un LaTeX utilisable. Sans formation explicite LaTeX, les VLM produisent des transcriptions lisibles mais imprécises.

Pour les pipelines de papier scientifique en 2026: chaîne Nougat sur le PDF, puis un VLM sur des pages délicates.

### Écriture manuscrite

La plus difficile est encore la sous-tâche. La composition imprimée + manuscrite (notes médicales, formulaires remplis) est le point où les pipelines OCR battent encore les VLM en termes de coûts.

### Récipitée 2026

Pour un nouveau projet d'IA-document:

- Les factures imprimées à l'échelle pure: LayoutLMv3 + règles, rentables.
- Documents mixtes (scientifiques + manuscrits + formulaires): VLM natifs (PaliGemma 2 ou Qwen2.5-VL).
- L'ingestion complète de l'arXiv: Nougat pour les mathématiques, VLM pour les chiffres.
- Régulateur: pipeline OCR + validateur VLM pour vérification croisée.

```figure
mm-doc-layout
```

## Utilisez-le

`code/main.py`- Le numéro de la liste:

- Un jetoniseur de jouets conscient de la mise en page: donné (texte, bbox) paires, produit l'entrée de style LayoutLMv3.
- Générateur de schéma de tâche de style Donut: modèle JSON pour les formulaires.
- Une comparaison des budgets de jetons par page sur OCR-pipeline, Donut, Nougat et VLM-native.

## La faire partir

Cette leçon produit `outputs/skill-document-ai-stack-picker.md`. En raison d'un projet d'IA document (domaine, échelle, qualité, réglementation), choisissez entre pipeline OCR, spécialiste libre de OCR et VLM-native.

## Exercices

1. Votre projet est de 10 millions de factures par jour.

2. Pourquoi LayoutLMv3 surpasse les CLIP-VLM pur sur le formulaire QA mais ne fonctionne pas bien sur le texte de scène ?

3. Nougat génère LaTeX. Proposez un cas de test où la sortie native VLM bat Nougat sur la fidélité LaTeX, et un cas où Nougat gagne.

4. Lisez le document PaliGemma 2 (Google, 2024). Quelle est la plus grande addition de données de formation qui a amélioré la précision des documents par rapport à PaliGemma 1 ?

5. Conception d'un hybride réglementaire sûr: pipeline OCR comme principale, VLM comme secondaire de contrôle croisé. Comment résoudre les désaccords?

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| OCR pipeline | "Tesseract-style" | Stage-wise stack: detect -> OCR -> layout -> rules; deterministic, fragile |
| OCR-free | "Donut-style" | Image-to-output transformer that skips explicit OCR; single model |
| Layout-aware | "LayoutLM" | Input includes per-token bbox coordinates; unified masking across modalities |
| VLM-native | "Frontier VLM" | Feed page image directly to Claude/GPT/Qwen VLM at high resolution; no pipeline |
| DocVQA | "Doc benchmark" | Document VQA standard; most-cited score |
| Markup output | "LaTeX / MD" | Structured output format instead of free-form text; enables downstream automation |

## Pour en savoir plus

- [Li et al. — TrOCR (arXiv:2109.10282)](https://arxiv.org/abs/2109.10282)
- [Blecher et al. — Nougat (arXiv:2308.13418)](https://arxiv.org/abs/2308.13418)
- [Huang et al. — LayoutLMv3 (arXiv:2204.08387)](https://arxiv.org/abs/2204.08387)
- [Kim et al. — Donut (arXiv:2111.15664)](https://arxiv.org/abs/2111.15664)
- [Wang et al. — DocLLM (arXiv:2401.00908)](https://arxiv.org/abs/2401.00908)
