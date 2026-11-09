# Systèmes de réponse aux questions

> Trois systèmes ont façonné l'AQ moderne. Extractive trouvé des spans. récupération augmentée les a mis à terre dans les documents. Génératif produit des réponses. chaque assistant d'IA moderne est un mélange des trois.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 11 (Machine Translation), Phase 5 · 10 (Attention Mechanism)
**Time:** ~75 minutes

## Le problème

Un utilisateur tape "Quand a été lancé le premier iPhone?" et s'attend à "29 juin 2007". Pas "L'histoire d'Apple est longue et variée". Pas "2007" assis en isolement sans phrase. Une réponse directe, basée sur la terre, correcte.

Trois architectures ont dominé l'AQ au cours de la dernière décennie.

- **Extractive QA.**En raison d'une question et d'un passage qui contient la réponse, trouvez les indices de début et de fin de la période de réponse dans le passage.
- **Open-domain QA.**Le passage n'est pas donné. Retrouvez le passage pertinent d'abord, puis extraire ou générer une réponse.
- **Generative / Closed-book QA.**Un modèle de langage de taille moyenne répond à sa mémoire paramétrique, sans récupération, le plus rapide à l'inférence, le moins fiable sur les faits.

La tendance en 2026 est hybride: récupérer les meilleurs passages, puis demander un modèle génératif pour répondre en se basant sur ces passages.

## Le concept

![QA architectures: extractive, retrieval-augmented, generative](../assets/qa.svg)

**Extractive.**Encode la question et le passage avec un transformateur (famille BERT). Formez deux têtes qui prédisent les indices de début et de fin des jetons de la réponse. La perte est l'entropie croisée sur les positions valides. La sortie est une distance du passage.

**Retrieval-augmented (RAG).**Deux étapes, un retriever trouve le haut...`k`Les résultats de la recherche de l'analyse de la réaction de la réaction de l'analyse de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de la réaction de

**Generative.**Un LLM (GPT, Claude, Llama) qui ne décode que les réponses à partir de poids appris. Pas de étape de récupération. Excellent sur la connaissance commune, catastrophique sur des faits rares ou récents. Le taux d'hallucination est inversement corrélateur avec la fréquence des faits dans les données de pré-entraînement.

```figure
qa-span
```

## Faites-le

### Étape 1: QA extractif avec un modèle prétrainé

```python
from transformers import pipeline

qa = pipeline("question-answering", model="deepset/roberta-base-squad2")

passage = (
    "Apple Inc. released the first iPhone on June 29, 2007. "
    "The device was announced by Steve Jobs at Macworld in January 2007."
)
question = "When was the first iPhone released?"

answer = qa(question=question, context=passage)
print(answer)
```

```python
{'score': 0.98, 'start': 57, 'end': 70, 'answer': 'June 29, 2007'}
```

`deepset/roberta-base-squad2`Le programme de formation est basé sur le SQuAD 2.0, qui comprend des questions à laquelle il n'y a pas de réponse.`question-answering`Le pipeline renvoie la période de scoring la plus élevée même lorsque le score nul du modèle gagne  il ne * pas * renvoie automatiquement une réponse vide. Pour obtenir un comportement explicite " pas de réponse ", passez `handle_impossible_answer=True`à l'appel de pipeline: le pipeline ne renvoie une réponse vide que lorsque le score nul dépasse chaque score de span.`score`Le champ de tous les deux.

### Étape 2: un pipeline augmenté en récupération (boîtier)

```python
from sentence_transformers import SentenceTransformer
import numpy as np

encoder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

corpus = [
    "Apple Inc. released the first iPhone on June 29, 2007.",
    "Macworld 2007 featured the iPhone announcement by Steve Jobs.",
    "Android launched in 2008 as Google's mobile operating system.",
    "The first iPod was released in 2001.",
]
corpus_embeddings = encoder.encode(corpus, normalize_embeddings=True)


def retrieve(question, top_k=2):
    q_emb = encoder.encode([question], normalize_embeddings=True)
    sims = (corpus_embeddings @ q_emb.T).squeeze()
    order = np.argsort(-sims)[:top_k]
    return [corpus[i] for i in order]


def answer(question):
    passages = retrieve(question, top_k=2)
    combined = " ".join(passages)
    return qa(question=question, context=combined)


print(answer("When was the first iPhone released?"))
```

Le système de récupération dense (Sentence-BERT) trouve des passages pertinents par similitude sémantique. Le lecteur extractif (RoBERTa-SQuAD) tire la durée de réponse des passages supérieurs combinés.

### Étape 3: génératif avec RAG

```python
def rag_generate(question, llm):
    passages = retrieve(question, top_k=3)
    prompt = f"""Context:
{chr(10).join('- ' + p for p in passages)}

Question: {question}

Answer using only the context above. If the context does not contain the answer, say "I don't know."
"""
    return llm(prompt)
```

Le motif prompt compte. Dire explicitement au modèle de se poser dans le contexte et de retourner "je ne sais pas" lorsque le contexte est insuffisant réduit les taux d'hallucination de 40-60% par rapport à la provocation naïve.

### Étape 4: évaluation qui reflète le monde réel

Utilisation de la SQUAD **Exact Match (EM)**et **token-level F1**- Je suis désolé . EM est un match strict après normalisation (case minuscule, ponctuation de strip, suppression d'articles)  soit la prédiction correspond exactement ou il marque 0. F1 est calculé sur la superposition des symboles entre la prédiction et la référence et donne un crédit partiel. Les deux parafractions sous-crédites: "29 juin 2007" vs "29 juin 2007" obtient généralement 0 EM (la normalisation des ruptures ordinaires), mais gagne toujours une F1 substantielle grâce à des jetons se chevauchant.

Pour la production QA:

- **Answer accuracy**(Juge par la LLM ou par l'homme, puisque les mesures ne capturent pas l'équivalence sémantique).
- **Citation accuracy.**Le passage cité soutient-il réellement la réponse ?
- **Refusal calibration.**Lorsque la réponse n'est pas dans les passages récupérés, le système dit-il correctement " Je ne sais pas "? Mesurer le taux de confiance fausse.
- **Retrieval recall.**Avant d'évaluer le lecteur, mesurez si le retriever obtient le bon passage dans le haut-`k`Un lecteur ne peut pas réparer un passage manquant.

### RAGAS: le cadre d'évaluation de la production de 2026

`RAGAS`Il est conçu spécifiquement pour les systèmes RAG et est le modèle de livraison par défaut en 2026.

- **Faithfulness.**Chaque affirmation de la réponse provient du contexte récupéré? Mesurée par l'implication basée sur les NLI.
- **Answer relevance.**La réponse répond-elle à la question? Mesurée en générant des questions hypothétiques à partir de la réponse et en comparant à la question réelle.
- **Context precision.**Parmi les morceaux récupérés, quelle fraction était réellement pertinente ?
- **Context recall.**Le jeu récupéré contient-il toutes les informations nécessaires ?

Le score sans référence vous permet d'évaluer le trafic de production en direct sans obtenir de réponses en or.

`pip install ragas`- Connectez votre retriever + lecteur.

## Utilisez-le

La pile de 2026.

| Use case | Recommended |
|---------|-------------|
| Given passage, find answer span | `deepset/roberta-base-squad2` |
| Over a fixed corpus, closed-book not acceptable | RAG: dense retriever + LLM reader |
| Real-time over a document store | RAG with hybrid (BM25 + dense) retriever + reranker (lesson 14) |
| Conversational QA (follow-up questions) | LLM with conversation history + RAG on each turn |
| Highly factual, regulated domains | Extractive over an authoritative corpus; never generative alone |

L'AQ extractive est démodé en 2026 car RAG avec LLM traite plus de cas. Il est toujours disponible dans des contextes où une citation littérale est requise: recherche juridique, conformité réglementaire, outils d'audit.

## La faire partir

- Je ne sais pas .`outputs/skill-qa-architect.md`- Le numéro de la liste:

```markdown
---
name: qa-architect
description: Choose QA architecture, retrieval strategy, and evaluation plan.
version: 1.0.0
phase: 5
lesson: 13
tags: [nlp, qa, rag]
---

Given requirements (corpus size, question type, factuality constraint, latency budget), output:

1. Architecture. Extractive, RAG with extractive reader, RAG with generative reader, or closed-book LLM. One-sentence reason.
2. Retriever. None, BM25, dense (name the encoder), or hybrid.
3. Reader. SQuAD-tuned model, LLM by name, or "domain-fine-tuned DistilBERT."
4. Evaluation. EM + F1 for extractive benchmarks; answer accuracy + citation accuracy + refusal calibration for production. Name what you are measuring and how you are measuring it.

Refuse closed-book LLM answers for regulatory or compliance-sensitive questions. Refuse any QA system without a retrieval-recall baseline (you cannot evaluate the reader without knowing the retriever surfaced the right passage). Flag questions that require multi-hop reasoning as needing specialized multi-hop retrievers like HotpotQA-trained systems.
```

## Exercices

1. **Easy.**Mettez le pipeline extractif SQuAD en haut sur 10 passages de Wikipédia. 10 questions à la main. Mesurez la fréquence avec laquelle la réponse est correcte. Vous devriez voir 7-9 correct si les passages et les questions sont propres.
2. **Medium.**Ajoutez un classifiateur de refus. Lorsque le score de récupération supérieur est inférieur à un seuil (disons 0,3 cosines), retournez "Je ne sais pas" au lieu d'appeler le lecteur.
3. **Hard.**Construisez un pipeline RAG sur un corpus de 10 000 documents de votre choix. Implémenter la récupération hybride (BM25 + dense) avec la fusion RRF (voir leçon 14). Mesurer la précision des réponses avec et sans l'étape hybride. Document qui les types de questions bénéficient le plus.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Extractive QA | Find the answer span | Predict start and end indices of the answer within a given passage. |
| Open-domain QA | QA over a corpus | No given passage; must retrieve then answer. |
| RAG | Retrieve then generate | Retrieval-augmented generation. Retriever + reader pipeline. |
| SQuAD | Canonical benchmark | Stanford Question Answering Dataset. EM + F1 metrics. |
| Hallucination | Made-up answer | Reader output not supported by retrieved context. |
| Refusal calibration | Know when to shut up | System correctly says "I don't know" when unable to answer. |

## Pour en savoir plus

- [Rajpurkar et al. (2016). SQuAD: 100,000+ Questions for Machine Comprehension of Text](https://arxiv.org/abs/1606.05250) le document de référence.
- [Karpukhin et al. (2020). Dense Passage Retrieval for Open-Domain QA](https://arxiv.org/abs/2004.04906) DPR, le retriever canonique pour l'AQ.
- [Lewis et al. (2020). Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks](https://arxiv.org/abs/2005.11401)Le journal qui a nommé RAG.
- [Gao et al. (2023). Retrieval-Augmented Generation for Large Language Models: A Survey](https://arxiv.org/abs/2312.10997) enquête exhaustive du RAG.
