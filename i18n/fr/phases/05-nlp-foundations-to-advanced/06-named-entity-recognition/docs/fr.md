# Reconnaissance de l'entité nommée

> Ça semble facile jusqu'à ce que vous ayez affaire à des limites ambiguës, à des entités nichées et au jargon de domaine.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 5 · 03 (Word Embeddings)
**Time:** ~75 minutes

## Le problème

"Apple a poursuivi Google pour son accord de recherche sur iPhone aux États-Unis". Cinq entités: Apple (ORG), Google (ORG), iPhone (PRODUCT), accord de recherche (peut-être), US (GPE). Un bon système NER les extrait tous avec des types corrects. Un mauvais manque iPhone, confond Apple le fruit avec Apple la société, et étiquette "US" comme PERSON.

NER est le cheval de travail sous chaque pipeline d'extraction structurée. L'analyse de résumé, la numérisation du journal de conformité, l'anonymisation des dossiers médicaux, la compréhension des requêtes de recherche, la mise à terre des réponses des chatbots, l'extraction de contrats juridiques. Vous ne le voyez jamais complètement; vous en dépendez toujours.

Cette leçon passe le chemin classique (basé sur les règles, HMM, CRF) vers le chemin moderne (BiLSTM-CRF, puis transformateurs). Chaque étape résout une limitation spécifique de celle qui l'a précédée.

## Le concept

**BIO tagging**(ou BILOU) transforme l'extraction d'entités en un problème d'étiquetage de séquences.`B-TYPE`(début de l'entité), `I-TYPE`(entité interne), ou `O`(à l'extérieur de toute entité).

```
Apple    B-ORG
sued     O
Google   B-ORG
over     O
its      O
iPhone   B-PRODUCT
search   O
deal     O
in       O
the      O
US       B-GPE
.        O
```

Chaîne d'entités multi-tokens: `New B-GPE`- Je suis là .`York I-GPE`- Je suis là .`City I-GPE`Un modèle qui comprend la bio peut extraire des spans arbitraires.

La progression de l'architecture:

- **Rule-based.**Regex + recherche de gazeteur. haute précision sur les entités connues, zéro couverture sur les nouvelles.
- **HMM.**Le modèle de Markov caché, la probabilité d'émission d'un jeton donné, la probabilité de transition de la jeton à la jeton, le décode Viterbi, l'entraînement sur les données étiquetées.
- **CRF.**C'est un champ aléatoire conditionnel. Comme HMM mais discriminatif, vous pouvez donc mélanger des caractéristiques arbitraires (forme de mot, capitalisation, mots voisins).
- **BiLSTM-CRF.**Les caractéristiques neuronales au lieu de manuelles. LSTM lit la phrase dans les deux sens, la couche CRF en haut impose des séquences de balises cohérentes.
- **Transformer-based.**Un BERT à réglage fin avec une tête de classification de jetons, une précision optimale, un calcul optimal.

```figure
ner-bio-tagging
```

## Faites-le

### Étape 1: les aides à l'étiquetage biologique

```python
def spans_to_bio(tokens, spans):
    labels = ["O"] * len(tokens)
    for start, end, label in spans:
        labels[start] = f"B-{label}"
        for i in range(start + 1, end):
            labels[i] = f"I-{label}"
    return labels


def bio_to_spans(tokens, labels):
    spans = []
    current = None
    for i, label in enumerate(labels):
        if label.startswith("B-"):
            if current:
                spans.append(current)
            current = (i, i + 1, label[2:])
        elif label.startswith("I-") and current and current[2] == label[2:]:
            current = (current[0], i + 1, current[2])
        else:
            if current:
                spans.append(current)
                current = None
    if current:
        spans.append(current)
    return spans
```

```python
>>> tokens = ["Apple", "sued", "Google", "over", "iPhone", "sales", "."]
>>> labels = ["B-ORG", "O", "B-ORG", "O", "B-PRODUCT", "O", "O"]
>>> bio_to_spans(tokens, labels)
[(0, 1, 'ORG'), (2, 3, 'ORG'), (4, 5, 'PRODUCT')]
```

### Étape 2: Caractéristiques faites à la main

Pour les NER classiques (non neuronaux), les caractéristiques sont le jeu.

```python
def token_features(token, prev_token, next_token):
    return {
        "lower": token.lower(),
        "is_upper": token.isupper(),
        "is_title": token.istitle(),
        "has_digit": any(c.isdigit() for c in token),
        "suffix_3": token[-3:].lower(),
        "shape": word_shape(token),
        "prev_lower": prev_token.lower() if prev_token else "<BOS>",
        "next_lower": next_token.lower() if next_token else "<EOS>",
    }


def word_shape(word):
    out = []
    for c in word:
        if c.isupper():
            out.append("X")
        elif c.islower():
            out.append("x")
        elif c.isdigit():
            out.append("d")
        else:
            out.append(c)
    return "".join(out)
```

`word_shape("iPhone")`Retour `xXxxxx`- Je suis là .`word_shape("USA-2024")`Retour `XXX-dddd`Les modèles de capitalisation sont très significatifs pour les noms propres.

### Étape 3: une base de référence simple basée sur des règles + dictionnaire

```python
ORG_GAZETTEER = {"Apple", "Google", "Microsoft", "OpenAI", "Meta", "Amazon", "Netflix"}
GPE_GAZETTEER = {"US", "USA", "UK", "India", "Germany", "France"}
PRODUCT_GAZETTEER = {"iPhone", "Android", "Windows", "ChatGPT", "Claude"}


def rule_based_ner(tokens):
    labels = []
    for token in tokens:
        if token in ORG_GAZETTEER:
            labels.append("B-ORG")
        elif token in GPE_GAZETTEER:
            labels.append("B-GPE")
        elif token in PRODUCT_GAZETTEER:
            labels.append("B-PRODUCT")
        else:
            labels.append("O")
    return labels
```

Les journaux de production ont des millions d'entrées extraites de Wikipédia et DBpedia.`Apple`La société contre les fruits) est terrible.

### Étape 4: étape CRF (boîtier, pas implantation complète)

Le CRF complet à partir de zéro en 50 lignes n'est pas éclairant sans les bases de la théorie des probabilités.`sklearn-crfsuite`au lieu de:

```python
import sklearn_crfsuite

def to_features(tokens):
    out = []
    for i, tok in enumerate(tokens):
        prev = tokens[i - 1] if i > 0 else ""
        nxt = tokens[i + 1] if i + 1 < len(tokens) else ""
        out.append({
            "word.lower()": tok.lower(),
            "word.isupper()": tok.isupper(),
            "word.istitle()": tok.istitle(),
            "word.isdigit()": tok.isdigit(),
            "word.suffix3": tok[-3:].lower(),
            "word.shape": word_shape(tok),
            "prev.word.lower()": prev.lower(),
            "next.word.lower()": nxt.lower(),
            "BOS": i == 0,
            "EOS": i == len(tokens) - 1,
        })
    return out


crf = sklearn_crfsuite.CRF(algorithm="lbfgs", c1=0.1, c2=0.1, max_iterations=100, all_possible_transitions=True)
X_train = [to_features(s) for s in sentences_tokenized]
crf.fit(X_train, bio_labels_train)
```

`c1`et `c2`Les taux de régularisation de L1 et L2 sont: `all_possible_transitions=True`permet au modèle d'apprendre des séquences illégales (p. ex., `I-ORG`après `O`) sont peu probables, c'est pourquoi un CRF impose la cohérence des BIO sans que vous écriviez la contrainte.

### Étape 5: ce qu'ajoute un FCR BiLSTM

Les fonctionnalités deviennent apprises. Les entrées: embeddings de jetons (GloVe ou fastText). LSTM lit de gauche à droite et de droite à gauche. Les états cachés concaténés traversent une couche de sortie CRF. Le CRF impose toujours la cohérence de la séquence de balises; le LSTM remplace les fonctionnalités fabriquées à la main par des fonctionnalités apprises.

```python
import torch
import torch.nn as nn


class BiLSTM_CRF_Head(nn.Module):
    def __init__(self, vocab_size, embed_dim, hidden_dim, n_labels):
        super().__init__()
        self.embed = nn.Embedding(vocab_size, embed_dim)
        self.lstm = nn.LSTM(embed_dim, hidden_dim, bidirectional=True, batch_first=True)
        self.fc = nn.Linear(hidden_dim * 2, n_labels)

    def forward(self, token_ids):
        e = self.embed(token_ids)
        h, _ = self.lstm(e)
        emissions = self.fc(h)
        return emissions
```

Pour la couche CRF, utiliser `torchcrf.CRF`Le gain sur le CRF fait à la main est mesurable mais plus petit que prévu à moins que vous ayez des dizaines de milliers de phrases étiquetées.

## Utilisez-le

spaCy expédie des NER de qualité de production hors boîte.

```python
import spacy

nlp = spacy.load("en_core_web_sm")
doc = nlp("Apple sued Google over its iPhone search deal in the US.")
for ent in doc.ents:
    print(f"{ent.text:20s} {ent.label_}")
```

```
Apple                ORG
Google               ORG
iPhone               ORG
US                   GPE
```

Remarque `iPhone`étiqueté `ORG`plutôt que `PRODUCT` Le modèle de petite taille de spaCy a une faible couverture des entités de produits.`en_core_web_lg`Le modèle transformateur (`en_core_web_trf`) est encore mieux.

Faces d'embrassement pour NER à base de BERT:

```python
from transformers import pipeline

ner = pipeline("ner", model="dslim/bert-base-NER", aggregation_strategy="simple")
print(ner("Apple sued Google over its iPhone in the US."))
```

```
[{'entity_group': 'ORG', 'word': 'Apple', ...},
 {'entity_group': 'ORG', 'word': 'Google', ...},
 {'entity_group': 'MISC', 'word': 'iPhone', ...},
 {'entity_group': 'LOC', 'word': 'US', ...}]
```

`aggregation_strategy="simple"`Si vous ne le faites pas, vous obtenez des étiquettes au niveau des jetons et vous devez vous fusionner.

### NER fondé sur la MLL (option 2026)

Le LLM NER à tir zéro et à tir peu est désormais compétitif avec des modèles finement ajustés sur de nombreux domaines, et est nettement meilleur lorsque les données étiquetées sont rares.

- **Zero-shot prompting.**Donnez au LLM une liste de types d'entités et un schéma d'exemple. Demandez une sortie JSON. Fonctionne hors boîte; la précision est modérée sur les nouveaux domaines.
- **ZeroTuneBio-style prompting.**Décomposer la tâche en extraction de candidat → signification explication → jugement → re-check. Un prompt à plusieurs étapes (pas un seul coup) augmente considérablement la précision sur le NER biomédical. Le même schéma fonctionne pour les domaines juridique, financier et scientifique.
- **Dynamic prompting with RAG.**Retirer les exemples étiquetés les plus similaires à partir d'un petit ensemble de graines annotées pour chaque appel d'inférence; construire la demande de quelques coups en mouvement.
- **Per-entity-type decomposition.**Pour les documents longs, un appel unique qui extrait tous les types d'entités à la fois perd le rappel à mesure que la longueur augmente. Exécuter un passe d'extraction par type d'entité. Coût d'inférence plus élevé, précision nettement plus élevée. C'est le modèle standard pour les notes cliniques et les contrats juridiques.

Recommandation de production à partir de 2026: commencez par un programme de base de la formation de licence avant de collecter les données de formation.

### Où la NER classique gagne toujours

Même avec des LLM disponibles, la NER classique gagne lorsque:

- Le budget de latence est inférieur à 50 ms.
- Vous avez des milliers d'exemples étiquetés et vous avez besoin de 98% + F1.
- Le domaine a une ontologie stable où un CRF ou un BiLSTM prétrainé transfère bien.
- Les contraintes réglementaires exigent un modèle non génératif sur place.

### Là où il s'effondre

- **Domain shift.**Le NER formé à la LNC sur les contrats juridiques fonctionne pire qu'un journaliste.
- **Nested entities.**La "Bank of America Tower" est à la fois un ORG et une FACEILITÉ. La norme BIO ne peut pas représenter des spans se chevauchant.
- **Long entities.**"Corporation fédérale d'assurance dépôt des États-Unis". Les modèles au niveau des jetons divisent parfois ceci.`aggregation_strategy`ou après le traitement.
- **Sparse types.**Les étiquettes médicales NER comme DRUG_BRAND, ADVERSE_EVENT, DOSE. Les modèles à usage général n'ont aucune idée.

## La faire partir

- Je ne sais pas .`outputs/skill-ner-picker.md`- Le numéro de la liste:

```markdown
---
name: ner-picker
description: Pick the right NER approach for a given extraction task.
version: 1.0.0
phase: 5
lesson: 06
tags: [nlp, ner, extraction]
---

Given a task description (domain, label set, language, latency, data volume), output:

1. Approach. Rule-based + gazetteer, CRF, BiLSTM-CRF, or transformer fine-tune.
2. Starting model. Name it (spaCy model ID, Hugging Face checkpoint ID, or "custom, trained from scratch").
3. Labeling strategy. BIO, BILOU, or span-based. Justify in one sentence.
4. Evaluation. Use `seqeval`. Always report entity-level F1 (not token-level).

Refuse to recommend fine-tuning a transformer for under 500 labeled examples unless the user already has a pretrained domain model. Flag nested entities as needing span-based or multi-pass models. Require a gazetteer audit if the user mentions "production scale" and labels are unchanged from CoNLL-2003.
```

## Exercices

1. **Easy.**Mise en œuvre `bio_to_spans`(l' inverse de `spans_to_bio`) et vérifier la cohérence entre les deux phrases.
2. **Medium.**Trainer le CRF sklearn-crfsuite ci-dessus sur le ensemble de données NER anglais CoNLL-2003.`seqeval`Résultat typique: ~84 F1.
3. **Hard.**- Je suis bien .`distilbert-base-cased`Les données de l'équipe de recherche sont également disponibles sur un ensemble de données NER spécifique à un domaine (médicale, juridique ou financière).

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| NER | Extract names | Label token spans with types (PERSON, ORG, GPE, DATE, ...). |
| BIO | Tagging scheme | `B-X` begins, `I-X` continues, `O` outside. |
| BILOU | Better BIO | Adds `L-X` (last), `U-X` (unit) for cleaner boundaries. |
| CRF | Structured classifier | Models transitions between labels, not just emissions. Enforces valid sequences. |
| Nested NER | Overlapping entities | One span is a different entity than a sub-span of it. BIO cannot express this. |
| Entity-level F1 | Proper NER metric | Predicted span must match true span exactly. Token-level F1 overstates accuracy. |

## Pour en savoir plus

- [Lample et al. (2016). Neural Architectures for Named Entity Recognition](https://arxiv.org/abs/1603.01360) le papier BiLSTM-CRF. Canonical.
- [Devlin et al. (2018). BERT: Pre-training of Deep Bidirectional Transformers](https://arxiv.org/abs/1810.04805) introduit le modèle de classification des jetons qui est devenu standard.
- [spaCy linguistic features — named entities](https://spacy.io/usage/linguistic-features#named-entities) référence pratique pour chaque attribut de `Doc.ents`et `Span`- Je suis désolé .
- [seqeval](https://github.com/chakki-works/seqeval) la bibliothèque métrique correcte.
