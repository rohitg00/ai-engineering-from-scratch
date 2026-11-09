# Traitement du texte  Tokenization, stemming, lemmatisation

> Le langage est continu, les modèles sont discrets, le prétraitement est le pont.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 2 · 14 (Naive Bayes)
**Time:** ~45 minutes

## Le problème

Un modèle ne peut pas lire "Les chats couraient". Il lit des nombres entiers.

Chaque système de PNL ouvre avec les mêmes trois questions. Où commence un mot. Quelle est la racine du mot. Comment traiter "courir", "courir", "courir" comme la même chose quand cela aide, et comme des choses différentes quand cela ne le fait pas.

Si vous faites une mauvaise tokenization, le modèle apprend à partir des ordures.`don't`comme un seul symbole mais `do n't`Si votre vote s'effondre, vous pouvez vous faire une idée.`organization`et `organ`Si votre lemmatizer a besoin d'un contexte de part de la parole mais que vous ne le passez pas, les verbes sont traités comme des noms.

Cette leçon construit les trois étapes de pré-traitement à partir de zéro, puis montre comment NLTK et spaCy font le même travail afin que vous puissiez voir les compromis.

## Le concept

Trois opérations, chacune avec un travail et un mode d'échec.

**Tokenization**Le mot "token" est délibérément vague parce que la bonne granularité dépend de la tâche.

**Stemming**Il y a des suffixes avec des règles, rapide, agressif, stupide.`running -> run`- Je suis là .`organization -> organ`Le second est le mode défaillance.

**Lemmatization**Le nombre de mots dans un dictionnaire est réduit à un nombre de mots en utilisant des connaissances grammaticales.`ran -> run`(il faut savoir que "run" est passé de "run").`better -> good`(ne doit connaître les formes comparatives).

Règlement général: écoute quand la vitesse est importante et que tu peux tolérer le bruit (indexation de recherche, classification approximative). Lemmatize quand le sens est important (réponse à la question, recherche sémantique, tout ce que l'utilisateur lira).

```figure
edit-distance
```

## Faites-le

### Étape 1: un jeton de mot regex

Le jeton de jeton le plus simple est divisé en caractères non alphanumériques tout en conservant la ponctuation comme jeton.

```python
import re

def tokenize(text):
    return re.findall(r"[A-Za-z]+(?:'[A-Za-z]+)?|[0-9]+|[^\sA-Za-z0-9]", text)
```

Trois modèles dans l'ordre de prééminence.`don't`- Je suis là .`it's`) Nombre pur: tout caractère non alphanumérique unique non en espace blanc en tant que symbole autonome (punctuation).

```python
>>> tokenize("The cats weren't running at 3pm.")
['The', 'cats', "weren't", 'running', 'at', '3', 'pm', '.']
```

Mode d'échec à remarquer. `3pm`Les fractions sont divisées en `['3', 'pm']`parce que nous avons alterné entre les courriels de lettres et les courriels de chiffres. assez pour la plupart des tâches. URL, courriels, hashtags sont tous cassés. Pour la production, ajoutez des modèles avant les plus généraux.

### Étape 2: un Porter stemmer (pas seulement 1a)

L'algorithme complet de Porter comporte cinq phases de règles.

```python
def stem_step_1a(word):
    if word.endswith("sses"):
        return word[:-2]
    if word.endswith("ies"):
        return word[:-2]
    if word.endswith("ss"):
        return word
    if word.endswith("s") and len(word) > 1:
        return word[:-1]
    return word
```

```python
>>> [stem_step_1a(w) for w in ["caresses", "ponies", "caress", "cats"]]
['caress', 'poni', 'caress', 'cat']
```

Lisez les règles de haut en bas.`ies -> i`La règle est la raison .`ponies -> poni`- Je ne sais pas .`pony`Le vrai Porter a l'étape 1B qui le corrige, les règles se disputent, les règles antérieures gagnent, l'ordre compte plus que toute autre règle.

### Étape 3: un lemmatizer basé sur la recherche

La lématisation appropriée nécessite une morphologie.

```python
LEMMA_TABLE = {
    ("running", "VERB"): "run",
    ("ran", "VERB"): "run",
    ("runs", "VERB"): "run",
    ("better", "ADJ"): "good",
    ("best", "ADJ"): "good",
    ("cats", "NOUN"): "cat",
    ("cat", "NOUN"): "cat",
    ("were", "VERB"): "be",
    ("was", "VERB"): "be",
    ("is", "VERB"): "be",
}

def lemmatize(word, pos):
    key = (word.lower(), pos)
    if key in LEMMA_TABLE:
        return LEMMA_TABLE[key]
    if pos == "VERB" and word.endswith("ing"):
        return word[:-3]
    if pos == "NOUN" and word.endswith("s"):
        return word[:-1]
    return word.lower()
```

```python
>>> lemmatize("running", "VERB")
'run'
>>> lemmatize("cats", "NOUN")
'cat'
>>> lemmatize("better", "ADJ")
'good'
>>> lemmatize("watched", "VERB")
'watched'
```

Le dernier cas est le moment clé de l'enseignement. `watched`Il n' est pas à notre table et notre renversement ne fait que gérer`ing`- Une vraie lemmatisation couvre`ed`, verbes irréguliers, adjectifs comparatifs, plurales avec changements sonores (`children -> child`C'est pourquoi les systèmes de production utilisent WordNet, le morphologiseur de spaCy, ou un analyseur morphologique complet.

### Étape 4: les raccorder

```python
def preprocess(text, pos_tagger=None):
    tokens = tokenize(text)
    stems = [stem_step_1a(t.lower()) for t in tokens]
    tags = pos_tagger(tokens) if pos_tagger else [(t, "NOUN") for t in tokens]
    lemmas = [lemmatize(word, pos) for word, pos in tags]
    return {"tokens": tokens, "stems": stems, "lemmas": lemmas}
```

La pièce manquante est un tagger POS. phase 5 · 07 (POS Tagging) en construit un. Pour l'instant, tout est par défaut à `NOUN`et reconnaissez la limitation.

## Utilisez-le

NLTK et spaCy expédient les versions de production.

### NLTK

```python
import nltk
nltk.download("punkt_tab")
nltk.download("wordnet")
nltk.download("averaged_perceptron_tagger_eng")

from nltk.tokenize import word_tokenize
from nltk.stem import PorterStemmer, WordNetLemmatizer
from nltk import pos_tag

text = "The cats were running."
tokens = word_tokenize(text)
stems = [PorterStemmer().stem(t) for t in tokens]
lemmatizer = WordNetLemmatizer()
tagged = pos_tag(tokens)


def nltk_pos_to_wordnet(tag):
    if tag.startswith("V"):
        return "v"
    if tag.startswith("J"):
        return "a"
    if tag.startswith("R"):
        return "r"
    return "n"


lemmas = [lemmatizer.lemmatize(t, nltk_pos_to_wordnet(tag)) for t, tag in tagged]
```

`word_tokenize`Il traite les contractions, l'Unicode, les cas de bord que votre regex manque.`PorterStemmer`Il est en cinq phases.`WordNetLemmatizer`Il faut traduire la balise POS du schéma Penn Treebank de NLTK vers l'ensemble d'abréviations de WordNet.

### - le secteur

```python
import spacy

nlp = spacy.load("en_core_web_sm")
doc = nlp("The cats were running.")

for token in doc:
    print(token.text, token.lemma_, token.pos_)
```

```
The      the     DET
cats     cat     NOUN
were     be      AUX
running  run     VERB
.        .       PUNCT
```

SpaCy cache l'ensemble du pipeline derrière.`nlp(text)`- La marquage, le POS et la lemmatization fonctionnent tous. Plus rapide que NLTK à l'échelle. Plus précis à l'extérieur de la boîte.

### Quand choisir lequel

| Situation | Pick |
|-----------|------|
| Teaching, research, swapping components | NLTK |
| Production, multi-language, speed matters | spaCy |
| Transformer pipeline (you'll tokenize with the model's tokenizer anyway) | Use `tokenizers` / `transformers` and skip classical preprocessing |

### Les deux modes d'échec que personne ne vous prévient

La plupart des tutoriels enseignent les algorithmes et arrêtent. Deux choses mordent un vrai pipeline de pré-traitement, et ils ne sont presque jamais couverts.

**Reproducibility drift.**NLTK et spaCy modifient le comportement de la jetonisation et du lemmatizer entre les versions.`['do', "n't"]`dans spaCy 2.x peut produire `["don't"]`Dans 3.x, votre modèle a été formé sur une distribution. l'inference fonctionne maintenant sur une autre. la précision dégrade tranquillement et personne ne sait pourquoi.`requirements.txt`Rédigez un test de régression de pré-traitement qui gelera la marquise attendue de 20 phrases d'échantillon.

**Training / inference mismatch.**Pré-trainer avec un prétraitement agressif (minuscule, suppression de mots arrêtés, stemming), déployer sur les entrées utilisateurs brutes, cratère de performance de la montre. C'est l'échec de PNL de production le plus courant. Si vous prétraiterez pendant la formation, vous devez exécuter la même fonction pendant l'inférence.

## La faire partir

Une requête réutilisable qui aide les ingénieurs à choisir une stratégie de pré-traitement sans lire trois manuels.

- Je ne sais pas .`outputs/prompt-preprocessing-advisor.md`- Le numéro de la liste:

```markdown
---
name: preprocessing-advisor
description: Recommends a tokenization, stemming, and lemmatization setup for an NLP task.
phase: 5
lesson: 01
---

You advise on classical NLP preprocessing. Given a task description, you output:

1. Tokenization choice (regex, NLTK word_tokenize, spaCy, or transformer tokenizer). Explain why.
2. Whether to stem, lemmatize, both, or neither. Explain why.
3. Specific library calls. Name the functions. Quote the POS-tag translation if NLTK is involved.
4. One failure mode the user should test for.

Refuse to recommend stemming for user-visible text. Refuse to recommend lemmatization without POS tags. Flag non-English input as needing a different pipeline.
```

## Exercices

1. **Easy.**Extension `tokenize`pour conserver les URL comme jetons uniques.`tokenize("Visit https://example.com today.")`doit produire un jeton URL.
2. **Medium.**Mettre en œuvre l' étape Porter 1b. Si un mot contient une voyelle et se termine par `ed`ou `ing`- Il faut le faire.`hopping -> hop`- Je ne sais pas .`hopp`)
3. **Hard.**Construisez un lemmatizer qui utilise WordNet comme table de recherche mais revient à vos voix Porter lorsque WordNet n'a pas d'entrée. Mesurez la précision sur un corpus marqué par rapport à WordNet et Porter ordinaire.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Token | A word | Whatever unit the model consumes. Can be word, subword, character, or byte. |
| Stem | Root of a word | Result of rule-based suffix stripping. Not always a real word. |
| Lemma | Dictionary form | The form you'd look up. Requires grammatical context to compute correctly. |
| POS tag | Part of speech | Category like NOUN, VERB, ADJ. Needed to lemmatize accurately. |
| Morphology | Word shape rules | How a word changes form based on tense, number, case. Lemmatization depends on it. |

## Pour en savoir plus

- [Porter, M. F. (1980). An algorithm for suffix stripping](https://tartarus.org/martin/PorterStemmer/def.txt)Le papier original, cinq pages, est toujours l'explication la plus claire.
- [spaCy 101 — linguistic features](https://spacy.io/usage/linguistic-features) comment un vrai pipeline est câblé.
- [NLTK book, chapter 3](https://www.nltk.org/book/ch03.html) cas de marquage que vous n'avez pas encore pensé.
