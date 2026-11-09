# L'étiquetage du POS et le partage syntaxique

> La grammaire était hors mode pendant un moment, puis chaque pipeline de LLM devait valider l'extraction structurée, et elle est revenue.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 01 (Text Processing), Phase 2 · 14 (Naive Bayes)
**Time:** ~45 minutes

## Le problème

La leçon 1 promettait que la lemmatization avait besoin d'une étiquette de partie du discours.`running`est un verbe, un lemmatizer ne peut pas le réduire à `run`Sans le savoir .`better`est un adjectif, il ne peut pas se réduire à `good`- Je suis désolé .

Cette promesse cachait un sous-field entier. L'étiquetage de la partie de la parole assigne des catégories grammaticales. L'analyse syntaxique récupère la structure de l'arbre de la phrase: quel mot modifie lequel, quel verbe gouverne quels arguments. La PNL classique a passé vingt ans à affiner les deux. Puis l'apprentissage profond les a effondrés en une tâche de classification des jetons en plus d'un transformateur prétrainé, et la communauté de recherche a déménagé.

La communauté appliquée n'est pas la communauté. Chaque pipeline d'extraction structurée utilise toujours des arbres de POS et de dépendance sous le capot. Le JSON généré par LLM est validé contre des contraintes grammaticales. Les systèmes de réponse aux questions décomposent les requêtes en utilisant des parses de dépendance. Les évaluateurs de qualité de la traduction automatique vérifient l'alignement des arbres de parse.

Cette leçon présente les tags, les lignes de base et le point où vous arrêtez de mettre en œuvre à partir de zéro et appelez spaCy.

## Le concept

**POS tagging**Les étiquettes de chaque symbole sont classées dans une catégorie grammaticale.**Penn Treebank (PTB)**Tagset est la version anglaise par défaut. 36 tags avec distinctions le lecteur occasionnel trouve difficile: `NN`nom singulier, `NNS`nom pluriel, `NNP`nom propre singulier, `VBD`verbe passé,`VBZ`Le verbe 3ème personne singular présent, et ainsi de suite.**Universal Dependencies (UD)**Tagset est plus grossier (17 tags) et linguistique; il est devenu le modèle par défaut pour le travail multilingue.

```
The/DET cats/NOUN were/AUX running/VERB at/ADP 3pm/NOUN ./PUNCT
```

**Syntactic parsing**Il y a deux styles principaux:

- **Constituency parsing.**Les phrases de noms, les phrases verbales, les phrases prépositionnelles s'installent l'une à l'intérieur de l'autre.
- **Dependency parsing.**Chaque mot a un seul mot de tête sur lequel il dépend, étiqueté avec une relation grammaticale.

Le partage de la dépendance a été gagné dans les années 2010 car il généralise nettement les langues, en particulier celles d'ordre de mots libre.

```
running is ROOT
cats is nsubj of running
were is aux of running
at is prep of running
3pm is pobj of at
```

```figure
pos-tagger
```

```figure
dependency-arcs
```

## Faites-le

### Étape 1: ligne de base de la marque la plus fréquente

Pour chaque mot, prévoir la balise qu'il avait le plus souvent en formation.

```python
from collections import Counter, defaultdict


def train_mft(train_examples):
    word_tag_counts = defaultdict(Counter)
    all_tags = Counter()
    for tokens, tags in train_examples:
        for token, tag in zip(tokens, tags):
            word_tag_counts[token.lower()][tag] += 1
            all_tags[tag] += 1
    word_best = {w: c.most_common(1)[0][0] for w, c in word_tag_counts.items()}
    default_tag = all_tags.most_common(1)[0][0]
    return word_best, default_tag


def predict_mft(tokens, word_best, default_tag):
    return [word_best.get(t.lower(), default_tag) for t in tokens]
```

Sur le corpus Brown, cette ligne de base atteint une précision de 85%.

### Étape 2: étiquette HMM à bigramme

Modélisez la probabilité commune de la séquence:

```math
P(\text{tags}, \text{words}) = \prod_i P(\text{tag}_i \mid \text{tag}_{i-1}) \cdot P(\text{word}_i \mid \text{tag}_i)
```

Deux tableaux: probabilités de transition (tag donné la tag précédente), probabilités d'émission (tag donné le mot). Estimer les deux à partir des comptes avec l'allumage Laplace. Décoder avec Viterbi (programming dynamique sur le réseau de tag).

```python
import math


def train_hmm(train_examples, alpha=0.01):
    transitions = defaultdict(Counter)
    emissions = defaultdict(Counter)
    tags = set()
    vocab = set()

    for tokens, ts in train_examples:
        prev = "<BOS>"
        for token, tag in zip(tokens, ts):
            transitions[prev][tag] += 1
            emissions[tag][token.lower()] += 1
            tags.add(tag)
            vocab.add(token.lower())
            prev = tag
        transitions[prev]["<EOS>"] += 1

    return transitions, emissions, tags, vocab


def log_prob(table, given, key, smooth_denom, alpha):
    return math.log((table[given].get(key, 0) + alpha) / smooth_denom)


def viterbi(tokens, transitions, emissions, tags, vocab, alpha=0.01):
    tags_list = list(tags)
    n = len(tokens)
    V = [[0.0] * len(tags_list) for _ in range(n)]
    back = [[0] * len(tags_list) for _ in range(n)]

    for j, tag in enumerate(tags_list):
        em_denom = sum(emissions[tag].values()) + alpha * (len(vocab) + 1)
        tr_denom = sum(transitions["<BOS>"].values()) + alpha * (len(tags_list) + 1)
        tr = log_prob(transitions, "<BOS>", tag, tr_denom, alpha)
        em = log_prob(emissions, tag, tokens[0].lower(), em_denom, alpha)
        V[0][j] = tr + em
        back[0][j] = 0

    for i in range(1, n):
        for j, tag in enumerate(tags_list):
            em_denom = sum(emissions[tag].values()) + alpha * (len(vocab) + 1)
            em = log_prob(emissions, tag, tokens[i].lower(), em_denom, alpha)
            best_prev = 0
            best_score = -1e30
            for k, prev_tag in enumerate(tags_list):
                tr_denom = sum(transitions[prev_tag].values()) + alpha * (len(tags_list) + 1)
                tr = log_prob(transitions, prev_tag, tag, tr_denom, alpha)
                score = V[i - 1][k] + tr + em
                if score > best_score:
                    best_score = score
                    best_prev = k
            V[i][j] = best_score
            back[i][j] = best_prev

    last_best = max(range(len(tags_list)), key=lambda j: V[n - 1][j])
    path = [last_best]
    for i in range(n - 1, 0, -1):
        path.append(back[i][path[-1]])
    return [tags_list[j] for j in reversed(path)]
```

Le Bigram HMM sur Brown atteint ~93% de précision. Le saut de 85% à 93% est principalement des probabilités de transition  le modèle apprend `DET NOUN`est commun et `NOUN DET`C'est rare.

### Étape 3: pourquoi les taggers modernes ont battu ce

Les probabilités de transition + émission sont locales.`saw`est un nom dans "J'ai acheté une scie" mais un verbe dans "J'ai vu le film". Un CRF avec des caractéristiques arbitraires (suffixe, forme de mot, mot avant et après, mot lui-même) atteint ~97%. Un BiLSTM-CRF ou transformateur atteint ~98%+.

Les annotateurs humains sont d'accord sur 97% du temps sur Penn Treebank. Les modèles au-delà de 98% sont probablement trop adaptés au jeu de test.

### Étape 4: schéma d'analyse de dépendance

La totalité de la dépendance paralysant à partir de zéro est hors de portée; le traitement canonique des manuels est dans Jurafsky et Martin.

- **Transition-based**Les parser (arcs-eager, arc-standard) agissent comme un parser réducteur de changement: ils lisent des jetons, les déplacent sur une pile et appliquent des actions réductrices qui créent des arcs. Le décoding avide est rapide. La mise en œuvre classique est MaltParser.
- **Graph-based**Les parseurs (algorithme d'Eisner, Dozat-Manning biaffine) marquent chaque bord possible dépendant de la tête et choisissent l'arbre d'étendue maximale.

Pour la plupart des travaux appliqués, appelez spaCy:

```python
import spacy

nlp = spacy.load("en_core_web_sm")
doc = nlp("The cats were running at 3pm.")
for token in doc:
    print(f"{token.text:10s} tag={token.tag_:5s} pos={token.pos_:6s} dep={token.dep_:10s} head={token.head.text}")
```

```
The        tag=DT    pos=DET    dep=det        head=cats
cats       tag=NNS   pos=NOUN   dep=nsubj      head=running
were       tag=VBD   pos=AUX    dep=aux        head=running
running    tag=VBG   pos=VERB   dep=ROOT       head=running
at         tag=IN    pos=ADP    dep=prep       head=running
3pm        tag=NN    pos=NOUN   dep=pobj       head=at
.          tag=.     pos=PUNCT  dep=punct      head=running
```

Lisez le `dep`la colonne de bas en haut et la structure grammaticale de la phrase tombe.

## Utilisez-le

Chaque bibliothèque de PNL de production envoie des parseurs de POS et de dépendance dans le cadre d'un pipeline standard.

- **spaCy**(le secteur de l'énergie)`en_core_web_sm`- Je suis là .`md`- Je suis là .`lg`- Je suis là .`trf`) Rapide, précis, intégré à la tokenization + NER + lemmatization. `token.tag_`Je suis désolé.`token.pos_`(UD), `token.dep_`(relation de dépendance).
- **Stanford NLP (stanza)**Le successeur de Stanford au CoreNLP.
- **trankit**- Basé sur un transformateur, bonne précision UD.
- **NLTK**- Je suis là .`pos_tag`Utilisable, lent, plus âgé, bon pour enseigner.

### Où cela importe encore en 2026

- **Lemmatization.**La leçon 1 a besoin de la POS pour le lemmatizer correctement.
- **Structured extraction from LLM outputs.**Valider que la phrase générée respecte les contraintes grammaticales (par exemple, accord sujet-verbe, modificateurs requis).
- **Aspect-based sentiment.**Les parses de dépendance vous disent quel adjectif modifie quel nom.
- **Query understanding.**"les films réalisés par Wes Anderson avec Bill Murray" se décomposent en contraintes structurées par le biais de l'analyse.
- **Cross-lingual transfer.**Les balises UD et les relations de dépendance sont agnostiques par rapport aux langues, ce qui permet une analyse structurée sans échec des nouvelles langues.
- **Low-compute pipelines.**Si vous ne pouvez pas expédier un transformateur, POS + dépistage de dépendance + gazetté vous emmène étonnamment loin.

## La faire partir

- Je ne sais pas .`outputs/skill-grammar-pipeline.md`- Le numéro de la liste:

```markdown
---
name: grammar-pipeline
description: Design a classical POS + dependency pipeline for a downstream NLP task.
version: 1.0.0
phase: 5
lesson: 07
tags: [nlp, pos, parsing]
---

Given a downstream task (information extraction, rewrite validation, query decomposition, lemmatization), you output:

1. Tagset to use. Penn Treebank for English-only legacy pipelines, Universal Dependencies for multilingual or cross-lingual.
2. Library. spaCy for most production, stanza for academic-grade multilingual, trankit for highest UD accuracy. Name the specific model ID.
3. Integration pattern. Show the 3-5 lines that call the library and consume the needed attributes (`.pos_`, `.dep_`, `.head`).
4. Failure mode to test. Noun-verb ambiguity (`saw`, `book`, `can`) and PP-attachment ambiguity are the classical traps. Sample 20 outputs and eyeball.

Refuse to recommend rolling your own parser. Building parsers from scratch is a research project, not an application task. Flag any pipeline that consumes POS tags without handling lowercase/uppercase variants as fragile.
```

## Exercices

1. **Easy.**En utilisant la ligne de base de la balise la plus fréquente sur un petit corpus de balises (par exemple, le sous-ensemble Brown de NLTK), mesurez l'exactitude des phrases retenues. Vérifiez le résultat de ~ 85%.
2. **Medium.**Exercez le HMM de bigramme ci-dessus et rapportez la précision/reprise par balise.
3. **Hard.**Utilisez l'analyse de dépendance de spaCy pour extraire des triples sujet-verbe-objet d'un échantillon de 1000 phrases. Évaluez sur 50 triples labellés manuellement. Document où l'extraction échoue (souvent passifs, coordonnées et sujets éliminés).

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| POS tag | Word's type | Grammatical category. PTB has 36; UD has 17. |
| Penn Treebank | Standard tagset | English-specific. Fine-grained verb tenses and noun number. |
| Universal Dependencies | Multilingual tagset | Coarser than PTB; language-neutral; defaults for cross-lingual work. |
| Dependency parse | Sentence tree | Each word has one head, each edge has a grammatical relation. |
| Viterbi | Dynamic programming | Finds the highest-probability tag sequence given emissions and transitions. |

## Pour en savoir plus

- [Jurafsky and Martin — Speech and Language Processing, chapters 8 and 18](https://web.stanford.edu/~jurafsky/slp3/) le traitement canonique des manuels de vente et de partage.
- [Universal Dependencies project](https://universaldependencies.org/) le groupe de tags et de collections de banques utilisés par chaque analyseur multilingue.
- [spaCy linguistic features guide](https://spacy.io/usage/linguistic-features) référence pratique pour chaque attribut exposé sur `Token`- Je suis désolé .
- [Chen and Manning (2014). A Fast and Accurate Dependency Parser using Neural Networks](https://nlp.stanford.edu/pubs/emnlp2014-depparser.pdf)Le journal qui a fait passer les paresseurs neuronaux au courant.
