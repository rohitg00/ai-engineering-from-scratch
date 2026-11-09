# Processamento de textos  Tokenization, Stemming, Lemmatization

> A linguagem é contínua, os modelos são discretos, o pré-processamento é a ponte.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 2 · 14 (Naive Bayes)
**Time:** ~45 minutes

## O problema

Um modelo não pode ler "Os gatos estavam a correr".

Cada sistema de PNL abre com as mesmas três perguntas: onde começa uma palavra? qual é a raiz da palavra? como tratamos "correr", "correr", "correr" como a mesma coisa quando ajuda e como coisas diferentes quando não ajuda?

Se o tokenizer for bem, o modelo aprende do lixo.`don't`Como um símbolo , mas`do n't`Se o voto cair, o treinamento se divide.`organization`E ...`organ`Se o lematizer precisa de um contexto de fala, mas não o passa, os verbos são tratados como substantivos.

Esta lição constrói os três passos de pré-processamento a partir do zero, e mostra como a NLTK e a spaCy fazem o mesmo trabalho para que você possa ver as compensações.

## O conceito

Três operações, cada uma tem um trabalho e um modo de falha.

**Tokenization**"Token" é deliberadamente vaga porque a granularidade certa depende da tarefa. Nível de palavra para a PNL clássica. Subpalavra para transformadores. Caracterismo para linguagens sem espaço em branco.

**Stemming**- É rápido, agressivo, estúpido.`running -> run`- Não .`organization -> organ`O segundo é o modo de falha.

**Lemmatization**O método de análise de dados é o de um texto que reduz uma palavra à sua forma de dicionário utilizando conhecimentos gramaticais.`ran -> run`(necessita de saber que "run" é o tempo passado de "run"). `better -> good`(necessita de saber formas comparativas).

Regra de ouro. Cria quando a velocidade é importante e você pode tolerar ruído (indexação de pesquisa, classificação aproximada). Lemmatize quando o significado é importante (resposta a pergunta, pesquisa semântica, qualquer coisa que o usuário leia).

```figure
edit-distance
```

## Construí-lo

### Passo 1: um tokenizer de palavras regex

O tokenizer mais simples e útil divide-se em caracteres não alfanuméricos, mantendo a pontuação como seus próprios tokens.

```python
import re

def tokenize(text):
    return re.findall(r"[A-Za-z]+(?:'[A-Za-z]+)?|[0-9]+|[^\sA-Za-z0-9]", text)
```

Três padrões em ordem de prioridade.`don't`- Não .`it's`Números puros: qualquer único carácter não-alfanumérico não-espacial como um símbolo independente (puntuação).

```python
>>> tokenize("The cats weren't running at 3pm.")
['The', 'cats', "weren't", 'running', 'at', '3', 'pm', '.']
```

Modos de falha para detectar. `3pm`Dividiu-se em `['3', 'pm']`porque alternamos entre corridas de letras e corridas de dígitos. É bom o suficiente para a maioria das tarefas. URLs, e-mails, hashtags todos quebram. Para produção, adicione padrões antes dos gerais.

### Passo 2: um Porter stemmer (apenas o passo 1a)

O algoritmo completo de Porter tem cinco fases de regras.

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

Leia as regras de cima para baixo.`ies -> i`A regra é por isso .`ponies -> poni`Não , não .`pony`O Porter Real tem o passo 1B que o corrigiria, as regras competem, as regras anteriores ganham, a ordem importa mais do que qualquer regra.

### Passo 3: um lemmatizer baseado em busca

A lematização adequada requer morfologia. Uma versão de ensino tratável usa uma pequena tabela de lemas e um fallback.

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

O último caso é o momento de ensino fundamental.`watched`Não está na nossa mesa e o nosso retorno só se ocupa .`ing`- A verdadeira lematização cobre`ed`, verbos irregulares, adjetivos comparativos, plurais com alterações sonoras (`children -> child`É por isso que os sistemas de produção utilizam o WordNet, o morfologizador da spaCy, ou um analista morfológico completo.

### Passo 4: Enrolar-lhes

```python
def preprocess(text, pos_tagger=None):
    tokens = tokenize(text)
    stems = [stem_step_1a(t.lower()) for t in tokens]
    tags = pos_tagger(tokens) if pos_tagger else [(t, "NOUN") for t in tokens]
    lemmas = [lemmatize(word, pos) for word, pos in tags]
    return {"tokens": tokens, "stems": stems, "lemmas": lemmas}
```

A peça que falta é um tagger POS. Fase 5 · 07 (POS Tagging) cria um. Por enquanto, tudo é padrão para `NOUN`e reconhecer a limitação.

## Usá-lo

A NLTK e a spaCy enviam as versões de produção, algumas linhas cada.

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

`word_tokenize`Tratam contrações, Unicode, casos de borda que o seu regex perde.`PorterStemmer`- É a primeira vez que o sistema opera.`WordNetLemmatizer`O sistema de tradução acima é o pouco que a maioria dos tutoriais esquiva.

### Espaço

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

O spaCy esconde o gasoduto todo atrás .`nlp(text)`A tokenization, a tagging e a lematization funcionam todos. Mais rápido que o NLTK em escala. Mais preciso fora da caixa.

### Quando escolher qual

| Situation | Pick |
|-----------|------|
| Teaching, research, swapping components | NLTK |
| Production, multi-language, speed matters | spaCy |
| Transformer pipeline (you'll tokenize with the model's tokenizer anyway) | Use `tokenizers` / `transformers` and skip classical preprocessing |

### Os dois modos de falha ninguém te avisa

A maioria dos tutoriais ensina os algoritmos e para. Duas coisas vão morder um verdadeiro pipeline de pré-processamento, e quase nunca são cobertas.

**Reproducibility drift.**O NLTK e o spaCy alteram o comportamento de tokenização e lemmatizer entre as versões.`['do', "n't"]`em spaCy 2.x pode produzir `["don't"]`O seu modelo foi treinado em uma distribuição. a inferência agora corre em outra. a precisão diminui silenciosamente e ninguém sabe por quê.`requirements.txt`Escreva um teste de regressão de pré-processamento que congele a tokenization esperada de 20 frases de amostra.

**Training / inference mismatch.**Treinar com pré-processamento agressivo (minúscula, remoção de palavras-stop, estemming), implementar na entrada de usuário bruto, cratera de desempenho de relógio. Esta é a falha de produção NLP mais comum.

## Envia-o

Um prompt reutilizável que ajuda os engenheiros a escolher uma estratégia de pré-processamento sem ler três livros didáticos.

Salva como`outputs/prompt-preprocessing-advisor.md`- Não .

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

## Exercícios

1. **Easy.**Extensão`tokenize`Para manter URLs como tokens individuais.`tokenize("Visit https://example.com today.")`deve produzir um token de URL.
2. **Medium.**Implementar o passo Porter 1b. Se uma palavra contém uma vocala e termina em `ed`ou `ing`- Não, não, não, não.`hopping -> hop`Não , não .`hopp`)).
3. **Hard.**Construa um lemmatizer que use o WordNet como uma tabela de pesquisa, mas cai de volta para os seus votantes de Porter quando o WordNet não tem entrada.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Token | A word | Whatever unit the model consumes. Can be word, subword, character, or byte. |
| Stem | Root of a word | Result of rule-based suffix stripping. Not always a real word. |
| Lemma | Dictionary form | The form you'd look up. Requires grammatical context to compute correctly. |
| POS tag | Part of speech | Category like NOUN, VERB, ADJ. Needed to lemmatize accurately. |
| Morphology | Word shape rules | How a word changes form based on tense, number, case. Lemmatization depends on it. |

## Mais leitura

- [Porter, M. F. (1980). An algorithm for suffix stripping](https://tartarus.org/martin/PorterStemmer/def.txt)O artigo original, cinco páginas, ainda é a explicação mais clara.
- [spaCy 101 — linguistic features](https://spacy.io/usage/linguistic-features) como é ligado um oleoduto real.
- [NLTK book, chapter 3](https://www.nltk.org/book/ch03.html)Casos de margem de tokenization que ainda não pensaste.
