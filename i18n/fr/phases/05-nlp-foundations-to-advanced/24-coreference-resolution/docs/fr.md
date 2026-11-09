# Résolution sur la coréférence

> "Elle l'a appelé, il n'a pas répondu, le médecin était au déjeuner". Trois références à deux personnes et personne n'est nommé.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 06 (NER), Phase 5 · 07 (POS & Parsing)
**Time:** ~60 minutes

## Le problème

Extraire chaque mention d'Apple Inc. d'un article de 300 mots. Facile quand l'article dit "Apple". Difficile quand il dit "l'entreprise", "ils", "le géant technologique de Cupertino, "ou "la firme de Jobs". Sans résoudre ces mentions à la même entité, votre pipeline NER manque 60-80% des mentions.

La résolution de la coréférence relie toutes les expressions qui se réfèrent à la même entité du monde réel dans un seul cluster.

Pourquoi cela importe en 2026:

- Résumé: "Le PDG a annoncé... " vs "Tim Cook a annoncé... "  le résumé devrait nommer le PDG.
- Pour répondre à la question: "A qui a- t- elle appelé?" il faut résoudre le problème de "elle".
- Extraction d'informations: un graphique de connaissances avec "PER1 a fondé Apple" et "Jobs a fondé Apple" comme entrées distinctes est incorrect.
- Multi-document IE: fusionner des mentions dans des articles sur le même événement est une référence croisée de documents.

## Le concept

![Coreference clustering: mentions → entities](../assets/coref.svg)

**The task.**Entrée: un document. Sortie: un regroupement de mentions (spans) où chaque regroupement fait référence à une entité.

**Mention types.**

- **Named entity.**"Tim Cook"
- **Nominal.**"le PDG", "la société"
- **Pronominal.**"Il", "elle", "ils", "elle"
- **Appositive.**"Tim Cook, le PDG d'Apple,

**Architectures.**

1. **Rule-based (Hobbs, 1978).**Une résolution syntaxique de pronoms à base d'arbre, avec des règles de grammaire.
2. **Mention-pair classifier.**Pour chaque paire de mentions $(m_i, m_j)$Les résultats de la recherche ont été obtenus en fonction des résultats obtenus par la Commission.
3. **Mention-ranking.**Pour chaque mention, classez les antécédents des candidats (y compris "pas d'antécédents").
4. **Span-based end-to-end (Lee et al., 2017).**Enchanteur de transformateur: énumérez tous les intervalles de candidats jusqu'à un cap de longueur. Prédisez les scores. Prédisez la probabilité d'anticiper pour chaque intervalle.
5. **Generative (2024+).**Prompter un LLM: "Listez tous les pronoms dans ce texte et son antécédent".

**The evaluation metrics.**Cinq indicateurs standard (MUC, B3, CEAF, BLANC, LEA) parce qu'aucune mesure ne capture la qualité du clusterage.

**Known hard cases.**

- Des descriptions définies faisant référence aux entités introduites sur les pages précédentes.
- Une anaphorie de pont ("les roues" → une voiture mentionnée précédemment).
- Zéro anaphora dans des langues comme le chinois et le japonais.
- Cataphora (pronom avant référent): "Quand **she**Elle est entrée, et elle a souri. "

```figure
coref-links
```

## Faites-le

### Étape 1: Coreférence neuronale prétrainée (AllenNLP / spaCy-expérimental)

```python
import spacy
nlp = spacy.load("en_coreference_web_trf")   # experimental model
doc = nlp("Apple announced new products. The company said it would ship them soon.")
for cluster in doc._.coref_clusters:
    print(cluster, "->", [m.text for m in cluster])
```

Sur un document plus long, on obtient quelque chose comme:
- Cluster 1: [Apple, la société, il]
- Cluster 2: [nouveaux produits, eux]

### Étape 2: résolveur de pronoms basé sur des règles (enseignement)

Regardez !`code/main.py`pour une mise en œuvre limitée:

1. Les mentions d'extraits: entités nommées (capitalités), pronoms (recherche directe), descriptions définitives ("le X").
2. Pour chaque pronom, regardez les mentions précédentes de K et notez-les par:
   - accord de genre/numéro (heuristique)
   - récente (victoires plus proches)
   - rôle syntaxique (objet préféré)
3. Rencontre le précédent avec le score le plus élevé.

Pas compétitif avec les modèles neuronaux, mais il montre l'espace de recherche et les décisions qu'un modèle de bout en bout doit prendre.

### Étape 3: utilisation des LLM pour la référence

```python
prompt = f"""Text: {text}

List every pronoun and noun phrase that refers to a person or company.
Cluster them by what they refer to. Output JSON:
[{{"entity": "Apple", "mentions": ["Apple", "the company", "it"]}}, ...]
"""
```

Deux modes d'échec à regarder. Premièrement, les LLM se fusionnent trop ("lui" et "elle" faisant référence à deux personnes distinctes). Deuxièmement, les LLM abandonnent silencieusement des mentions dans de longs documents.

### Étape 4: évaluation

Le script standard conll-2012 calcule MUC, B3, CEAF-φ4 et rapporte la moyenne. Pour une évaluation interne, commencez par une précision au niveau de l'espace et rappelez-vous votre ensemble de tests annotés, puis ajoutez le lien de référence F1.

## Les pièges

- **Singleton explosion.**Certains systèmes rapportent chaque mention comme son propre cluster. B3 est indulgent. MUC punit cela.
- **Pronouns in long context.**Les performances diminuent de 15 F1 sur les documents de plus de 2 000 jetons.
- **Gender assumptions.**Les règles de genre sont en violation pour les référents non binaires, les organisations, les animaux.
- **LLM drift on long docs.**Un seul appel API ne peut pas mentionner de manière fiable des clusters sur plus de 50 paragraphes. Utilisez la fenêtre glissante + fusion.

## Utilisez-le

La pile de 2026:

| Situation | Pick |
|-----------|------|
| English, single document | `en_coreference_web_trf` (spaCy-experimental) or AllenNLP neural coref |
| Multilingual | SpanBERT / XLM-R trained on OntoNotes or Multilingual CoNLL |
| Cross-document event coref | Specialized end-to-end models (2025–26 SOTA) |
| Quick LLM baseline | GPT-4o / Claude with structured-output coref prompt |
| Production dialog systems | Rule-based fallback + neural primary + manual review for critical slots |

Le modèle d'intégration qui se déploie en 2026: exécuter d'abord le NER, exécuter le coref, fusionner le coref des clusters en entités NER.

## La faire partir

- Je ne sais pas .`outputs/skill-coref-picker.md`- Le numéro de la liste:

```markdown
---
name: coref-picker
description: Pick a coreference approach, evaluation plan, and integration strategy.
version: 1.0.0
phase: 5
lesson: 24
tags: [nlp, coref, information-extraction]
---

Given a use case (single-doc / multi-doc, domain, language), output:

1. Approach. Rule-based / neural span-based / LLM-prompted / hybrid. One-sentence reason.
2. Model. Named checkpoint if neural.
3. Integration. Order of operations: tokenize → NER → coref → downstream task.
4. Evaluation. CoNLL F1 (MUC + B³ + CEAF-φ4 average) on held-out set + manual cluster review on 20 documents.

Refuse LLM-only coref for documents over 2,000 tokens without sliding-window merge. Refuse any pipeline that runs coref without a mention-level precision-recall report. Flag gender-heuristic systems deployed in demographically diverse text.
```

## Exercices

1. **Easy.**Exécutez le résolveur basé sur les règles `code/main.py`Mesurer la précision des liens mentionnés par rapport à la vérité fondamentale.
2. **Medium.**Utilisez un modèle de noyau neuronal prétrainé dans un article d'actualité.
3. **Hard.**Construire un pipeline de REN amélioré: REN d'abord, puis fusionner via des clusters de base.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Mention | A reference | A span of text that refers to an entity (name, pronoun, noun phrase). |
| Antecedent | What "it" refers to | The earlier mention a later one corefers with. |
| Cluster | The entity's mentions | Set of mentions that all refer to the same real-world entity. |
| Anaphora | Backward reference | Later mention refers to earlier ("he" → "John"). |
| Cataphora | Forward reference | Earlier mention refers to later ("When he arrived, John..."). |
| Bridging | Implicit reference | "I bought a car. The wheels were bad." (wheels of THAT car.) |
| CoNLL F1 | The number on leaderboards | Average of MUC, B³, CEAF-φ4 F1 scores. |

## Pour en savoir plus

- [Jurafsky & Martin, SLP3 Ch. 26 — Coreference Resolution and Entity Linking](https://web.stanford.edu/~jurafsky/slp3/26.pdf) chapitre du livre canonique.
- [Lee et al. (2017). End-to-end Neural Coreference Resolution](https://arxiv.org/abs/1707.07045) End-to-end basé sur la durée.
- [Joshi et al. (2020). SpanBERT](https://arxiv.org/abs/1907.10529) Préentraînement qui améliore le cœur.
- [Pradhan et al. (2012). CoNLL-2012 Shared Task](https://aclanthology.org/W12-4501/) l'indice de référence.
- [Hobbs (1978). Resolving Pronoun References](https://www.sciencedirect.com/science/article/pii/0024384178900064) le classique fondé sur les règles.
