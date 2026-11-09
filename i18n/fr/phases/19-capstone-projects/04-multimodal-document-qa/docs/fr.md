# Capstone 04  Document QA multimodale (PDF de première vision, tableaux, graphiques)

> La frontière 2026 document-QA s'est éloignée de la RCR-then-text et s'est orientée vers l'interaction tardive vision-first. ColPali, ColQwen2.5 et ColQwen3-omni traitent chaque page PDF comme une image, l'embêtent avec une interaction tardive multi-vectorielle et laissent la requête répondre directement aux correctifs. Sur les 10 000 dollars financiers, les documents scientifiques et les notes manuscrites, ce modèle dépasse OCR en premier par une grande marge. Construire le pipeline de bout en bout sur 10 000 pages et publier le côté-à-côté contre OCR-then-text.

**Type:** Capstone
**Languages:** Python (pipeline), TypeScript (viewer UI, retrieval scaffold)
**Prerequisites:** Phase 4 (computer vision), Phase 5 (NLP), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 12 (multimodal), Phase 17 (infrastructure)
**Phases exercised:**P4 · P5 · P7 · P11 · P12 · P17
**Time:** 30 hours

## Problème

Les entreprises sont assises sur des fichiers PDF que les pipelines OCR déchirent: 10K scannés avec des tables tournantes, des documents scientifiques denses avec des équations, des graphiques qui ne donnent sens qu'en images, des annotations écrites à la main. Traiter ces messages comme un premier message signifie perdre la moitié du signal. La réponse 2026 est la récupération multi-vectorielle en interaction tardive sur les images de page brutes. ColPali (Illuin Tech) l'a introduit; ColQwen2.5-v0.2 et ColQwen3-omni ont augmenté la précision. Sur ViDoRe v3, la récupération de la vision surpasse OCR-then-text par des marges significatives  et l'écart s'élargit sur les graphiques, les tables et l'écriture manuscrite.

Le compromis est le stockage et la latence. Une intégration ColQwen est de ~2048 vecteurs de correctifs par page, pas un seul vecteur de 1024 dimensions. Balons de stockage brut. DocPruner (2026) apporte une taille de 50% sans perte de précision mesurable. Vous indexerez 10k pages, mesurerez ViDoRe v3 nDCG@5, servirez des réponses en moins de 2 secondes et comparerez directement avec une base OCR-then-text.

## Concept

L'interaction tardive signifie que chaque jeton de requête marque contre chaque jeton de patch, et le score maximum par jeton de requête est sumé. Vous obtenez une correspondance fine-grainée sans avoir besoin d'un seul vecteur regroupé. Un index multi-vecteur (Vespa, Qdrant multi-vecteur ou AstraDB) stocke les emblèmes par patch et exécute MaxSim au moment de la récupération.

Le répondant est un modèle de langage de vision qui prend la requête plus les pages récupérées en haut de la liste comme des images et écrit une réponse avec des régions de preuve (boxes de bordure ou références de page). Qwen3-VL-30B, Gemini 2.5 Pro et InternVL3 sont les choix frontaliers de 2026. Pour les équations et la notation scientifique, un OCR fallback (Nougat, dots.ocr) est inséré comme canal de texte optionnel.

L'évaluation est une matrice bidimensionnelle. Un axe: type de contenu (paragraphes de texte clair, tableaux denses, graphiques à barres/lignes, notes écrites à la main, équations). L'autre axe: approche de récupération (interaction tardive d'abord face à l'OCR-alors-texte versus hybride). Chaque cellule obtient nDCG@5 et la précision de réponse.

## Architecture

```
PDFs -> page renderer (PyMuPDF, 180 DPI)
           |
           v
  ColQwen2.5-v0.2 embed (multi-vector per page, ~2048 patches)
           |
           +------> DocPruner 50% compression
           |
           v
   multi-vector index (Vespa or Qdrant multi-vector)
           |
query ----+----> retrieve top-k pages (MaxSim)
           |
           v
  VLM answerer: Qwen3-VL-30B | Gemini 2.5 Pro | InternVL3
    inputs: query + top-k page images + optional OCR text
           |
           v
  answer with cited page numbers + evidence regions
           |
           v
  Streamlit / Next.js viewer: highlighted boxes on source page
```

## La pile

- Rendering page: PyMuPDF (fitz) à 180 DPI, normalisé par portrait
- Modèle d'interaction tardive: ColQwen2.5-v0.2 ou ColQwen3-omni (équipe vidore sur Hugging Face)
- Index: Vespa avec champ multivectoriel ou Qdrant multivectoriel ou AstraDB avec MaxSim
- Élagage: politique DocPruner 2026 (maintien des patchs à haute variance, compression de 50% à une perte de précision < 0,5%)
- Retour en arrière des OCR (équations / tables denses): points.ocr ou Nougat
- Répondeur VLM: Qwen3-VL-30B hébergé par soi-même ou Gemini 2.5 Pro hébergé; InternVL3 en tant que rétroaction
- Évaluation: référence ViDoRe v3, M3DocVQA pour le raisonnement multifonique
- Interface utilisateur du spectateur: Next.js 15 avec couverture en toile pour les régions de données

```figure
ce-late-interaction
```

## Faites-le

1. **Ingest.**Parcourez un corpus de 10 000 pages PDF sur 10 000 documents scientifiques et scannés. Rendez chaque page à une PNG 1536x2048. Persistez `{doc_id, page_num, image_path}`- Je suis désolé .

2. **Embed.**Exécutez ColQwen2.5-v0.2 sur chaque image de page. Forme de sortie ~2048 emblèmes de patch de dim 128. Appliquez DocPruner pour conserver la moitié du signal le plus élevé. Écrivez à Vespa multi-vecteur champ ou Qdrant multi-vecteur.

3. **Query.**Pour chaque requête entrante, intégrez avec la tour de requête (embeddings au niveau des jetons). Exécutez MaxSim contre l'index: pour chaque jeton de requête, prenez le produit max dot sur les emblèmes de correctifs de page, somme. Retournez les pages top-k.

4. **Synthesize.**Appeler Qwen3-VL-30B avec la requête et les images de la première page 5. Prompt: "Répondre en utilisant uniquement les pages fournies. Citez chaque demande par (doc_id, page) et nommez la région (figure, table, paragraphe). "

5. **Evidence regions.**Si le VLM émet des boîtes de délimitation (Qwen3-VL le fait), les rendre en superposition dans le spectateur.

6. **OCR fallback.**Pour les pages identifiées comme équation-dense (heuristique sur la variance d'image), exécutez Nougat ou dots.ocr et passez le texte OCR comme canal supplémentaire à côté de l'image.

7. **Eval.**Exécutez ViDoRe v3 (retrieval nDCG@5) et M3DocVQA (accurité de QA de plusieurs pages). Exécutez également OCR-then-text pipeline sur le même corpus avec le même synthétiseur. Produisez une matrice de type de contenu × approche.

8. **UI.**Prototype Streamlit d'abord; Next.js 15 visualisateur de production avec page par page de la preuve-région de superposition.

## Utilisez-le

```
$ doc-qa ask "what was the 2024 operating margin change for segment EMEA?"
[retrieve]   top-5 pages in 320ms (ColQwen2.5, MaxSim, Vespa)
[synth]      qwen3-vl-30b, 1.4s, cited (form-10k-2024, p. 88) + (..., p. 92)
answer:
  EMEA operating margin moved from 18.2% to 16.8%, a 140bp decline.
  cited: 10-K-2024.pdf p.88 (Table 4, Segment Operating Margin)
         10-K-2024.pdf p.92 (MD&A, Operating Performance)
[viewer]     open with highlighted bounding boxes overlaid on p.88 Table 4
```

## La faire partir

`outputs/skill-doc-qa.md`décrivant le produit de livraison: un système de QA multimodal de document visuel d'abord adapté à un corpus spécifique et évalué par rapport à une base de référence OCR-then-text sur ViDoRe v3.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | ViDoRe v3 / M3DocVQA accuracy | Benchmark numbers vs OCR-text baseline and published leaderboard |
| 20 | Evidence-region grounding | Fraction of cited regions that actually contain the answer span |
| 20 | Storage and latency engineering | DocPruner compression ratio, index p95, answer p95 |
| 20 | Multi-page reasoning | Accuracy on a hand-labeled 100-question multi-page set |
| 15 | Source-inspection UX | Viewer clarity, overlay fidelity, side-by-side comparison tools |
| **100** | | |

## Exercices

1. Mesurer ColQwen2.5-v0.2 vs ColQwen3-omni sur le même corpus. Quelles pages une se trouve droite et l'autre manque? Ajoutez une balise "Classe de contenu" à l'index pour rouvrir par type.

2. Prunez les embellissements de manière agressive (75%, 90%).

3. Construire un hybride: exécuter OCR-then-text et ColQwen en parallèle, fusionner avec RRF, réafficher avec un cross-encoder.

4. Échangez Qwen3-VL-30B contre un VLM plus petit (Qwen2.5-VL-7B). Mesurez la courbe de précision par dollar.

5. Ajouter un support de notes écrites à la main. Render le corpus de l'écriture à la main, intégrer avec ColQwen, mesurer la récupération. Comparer avec un pipeline d'OCR à l'écriture à la main.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Late interaction | "ColPali-style retrieval" | Query tokens score against page patches independently; MaxSim aggregates |
| Multi-vector | "Per-patch embedding" | Each document has many vectors, not one pooled vector |
| MaxSim | "Late-interaction scoring" | For every query token, take max similarity over document vectors; sum |
| DocPruner | "Patch compression" | 2026 pruning that keeps 50% of patches with negligible accuracy loss |
| ViDoRe v3 | "Document-retrieval benchmark" | The 2026 standard for measuring visual-document retrieval |
| Evidence region | "Cited bounding box" | A bbox on the source page that localizes the answer span |
| OCR fallback | "Equation channel" | Text pipeline used alongside vision for equation- or table-heavy pages |

## Pour en savoir plus

- [ColPali (Illuin Tech) repository](https://github.com/illuin-tech/colpali) récupération de documents de référence en interaction tardive
- [ColPali paper (arXiv:2407.01449)](https://arxiv.org/abs/2407.01449) le document de méthode de base
- [ColQwen family on Hugging Face](https://huggingface.co/vidore) points de contrôle prêts à la production
- [M3DocRAG (Adobe)](https://arxiv.org/abs/2411.04952) L'indice de base de RAG multimodal de plusieurs pages
- [Vespa multi-vector tutorial](https://docs.vespa.ai/en/colpali.html) pile de service de référence
- [Qdrant multi-vector support](https://qdrant.tech/documentation/concepts/vectors/#multivectors) indice de remplacement
- [AstraDB multi-vector](https://docs.datastax.com/en/astra-db-serverless/databases/vector-search.html) indice géré alternatif
- [Nougat OCR](https://github.com/facebookresearch/nougat) Retour en arrière des RCR à équation
