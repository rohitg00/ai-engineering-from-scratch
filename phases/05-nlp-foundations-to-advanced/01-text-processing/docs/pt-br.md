# Processamento de Texto — Tokenização, Stemming, Lematização

> A linguagem é contínua. Os modelos são discretos. O pré-processamento é a ponte.

**Tipo:** Construção
**Linguagens:** Python
**Pré-requisitos:** Fase 2 · 14 (Naive Bayes)
**Tempo:** ~45 minutos

## O Problema

Um modelo não lê "The cats were running." Ele lê inteiros.

Todo sistema de NLP começa pelas mesmas três perguntas. Onde uma palavra começa. Qual é a raiz da palavra. Como tratamos "run", "running", "ran" como a mesma coisa quando isso ajuda, e como coisas diferentes quando não ajuda.

Se você erra a tokenização, o modelo aprende com lixo. Se o seu tokenizer trata `don't` como um token mas `do n't` como dois, a distribuição de treino se divide. Se o seu stemmer colapsa `organization` e `organ` na mesma raiz, modelagem de tópico morre. Se o seu lematizador precisa de contexto de classe gramatical e você não passa, verbos são tratados como substantivos.

Essa lição constrói os três passos de pré-processamento do zero, depois mostra como NLTK e spaCy fazem o mesmo trabalho pra você ver os tradeoffs.

## O Conceito

Três operações. Cada uma tem uma função e um modo de falha.

**Tokenização** divide uma string em tokens. "Token" é propositamente vago porque a granularidade certa depende da tarefa. Nível de palavra para NLP clássico. Subpalavra para transformers. Nível de caractere para idiomas sem espaço em branco.

**Stemming** corta sufixos com regras. Rápido, agressivo, burro. `running -> run`. `organization -> organ`. Essa segunda é o modo de falha.

**Lematização** reduz uma palavra à sua forma de dicionário usando conhecimento de gramática. Mais lenta, precisa, precisa de uma tabela de consulta ou analisador morfológico. `ran -> run` (precisa saber que "ran" é passado de "run"). `better -> good` (precisa saber formas comparativas).

Regra prática. Use stemming quando velocidade importa e você tolera ruído (indexação de busca, classificação rasa). Use lematização quando significado importa (resposta a perguntas, busca semântica, qualquer coisa que o usuário vai ler).

## Construindo

### Passo 1: um tokenizer por regex

O tokenizer útil mais simples divide em caracteres não-alfanuméricos mantendo pontuação como tokens próprios. Não é perfeito, não é final, mas roda em uma linha.

```python
import re

def tokenize(text):
    return re.findall(r"[A-Za-z]+(?:'[A-Za-z]+)?|[0-9]+|[^\sA-Za-z0-9]", text)
```

Três padrões em ordem de precedência. Palavras com apóstrofo interno opcional (`don't`, `it's`). Números puros. Qualquer caractere não-espaço, não-alfanumérico como token isolado (pontuação).

```python
>>> tokenize("The cats weren't running at 3pm.")
['The', 'cats', "weren't", 'running', 'at', '3', 'pm', '.']
```

Modos de falha pra notar. `3pm` divide em `['3', 'pm']` porque alternamos entre sequências de letras e dígitos. Suficiente pra maioria das tarefas. URLs, emails, hashtags quebram tudo. Em produção, adicione padrões antes dos gerais.

### Passo 2: um stemmer Porter (só passo 1a)

O algoritmo Porter completo tem cinco fases de regras. Só o passo 1a cobre os sufixos ingleses mais frequentes e ensina o padrão.

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

Leia as regras de cima pra baixo. A regra `ies -> i` é por que `ponies -> poni`, não `pony`. O Porter real tem passo 1b que corrigiria isso. Regras competem. Regras anteriores ganham. A ordem importa mais que qualquer regra isolada.

### Passo 3: um lematizador por consulta

Lematização de verdade precisa de morfologia. Uma versão didática viável usa uma pequena tabela de lemas e um fallback.

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

O último caso é o ponto de ensino chave. `watched` não está na nossa tabela e nosso reserva só lida com `ing`. Lematização de verdade cobre `ed`, verbos irregulares, adjetivos comparativos, plurais com mudança de som (`children -> child`). É por isso que sistemas de produção usam WordNet, o morphologizer do spaCy, ou um analisador morfológico completo.

### Passo 4: encadeando tudo

```python
def preprocess(text, pos_tagger=None):
    tokens = tokenize(text)
    stems = [stem_step_1a(t.lower()) for t in tokens]
    tags = pos_tagger(tokens) if pos_tagger else [(t, "NOUN") for t in tokens]
    lemmas = [lemmatize(word, pos) for word, pos in tags]
    return {"tokens": tokens, "stems": stems, "lemmas": lemmas}
```

A peça que falta é um POS tagger. A Fase 5 · 07 (POS Tagging) constrói um. Por agora, padrão tudo pra `NOUN` e reconheça a limitação.

## Usando

NLTK e spaCy trazem as versões de produção. Uns poucos linhas cada.

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

`word_tokenize` lida com contrações, Unicode, casos extremos que sua regex erra. `PorterStemmer` roda todas as cinco fases. `WordNetLemmatizer` precisa da tradução da tag POS do esquema Penn Treebank do NLTK pra abreviações do WordNet. A parte de tradução acima é o que a maioria dos tutoriais pula.

### spaCy

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

spaCy esconde toda a pipeline atrás de `nlp(text)`. Tokenização, POS tagging e lematização rodam todas. Mais rápido que NLTK em escala. Mais preciso de cara. O tradeoff é que você não troca componentes individuais facilmente.

### Quando escolher qual

| Situação | Escolha |
|-----------|------|
| Ensino, pesquisa, troca de componentes | NLTK |
| Produção, multilíngue, velocidade importa | spaCy |
| Pipeline transformer (vai tokenizar com o tokenizer do modelo de qualquer jeito) | Use `tokenizers` / `transformers` e pule o pré-processamento clássico |

### Os dois modos de falha que ninguém avisa

A maioria dos tutoriais ensina os algoritmos e para. Duas coisas vão morder uma pipeline de pré-processamento real, e quase nunca são cobertas.

**Deriva de reprodutibilidade.** NLTK e spaCy mudam comportamento de tokenização e lematizador entre versões. O que gerou `['do', "n't"]` no spaCy 2.x pode gerar `["don't"]` no 3.x. Seu modelo foi treinado em uma distribuição. Inferência agora roda em outra. Precisão degrada silenciosamente e ninguém sabe por quê. Fixe versões de bibliotecas em `requirements.txt`. Escreva um teste de regressão de pré-processamento que congele a tokenização esperada de 20 frases de exemplo. Rode em toda atualização.

**Mismatch treino/inferência.** Treine com pré-processamento agressivo (lowercase, remoção de stopwords, stemming), implantação em input cru do usuário, veja a performance despencar. Esse é o bug de produção de NLP mais comum que existe. Se você pré-processa durante treino, precisa rodar a função idêntica durante inferência. Empacote o pré-processamento como função dentro do pacote do modelo, não como célula de notebook que o time de serving reescreve.

## Entregando

Um prompt reutilizável que ajuda engenheiros a escolher uma estratégia de pré-processamento sem ler três livros didáticos.

Salve como `outputs/prompt-preprocessing-advisor.md`:

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

1. **Fácil.** Estenda `tokenize` pra manter URLs como tokens únicos. Teste: `tokenize("Visit https://example.com today.")` deve gerar um token URL.
2. **Médio.** Implemente o passo 1b do Porter. Se uma palavra contém vogal e termina em `ed` ou `ing`, remova. Lide com a regra de consoante dupla (`hopping -> hop`, não `hopp`).
3. **Difícil.** Construa um lematizador que use WordNet como tabela de consulta mas caia no seu stemmer Porter quando WordNet não tem entrada. Meça precisão num corpus anotado comparando com WordNet puro e Porter puro.

## Termos Chave

| Termo | O que a gente diz | O que realmente significa |
|------|-----------------|-----------------------|
| Token | Uma palavra | Qualquer unidade que o modelo consome. Pode ser palavra, subpalavra, caractere ou byte. |
| Stem | Raiz de uma palavra | Resultado de remoção de sufixos por regras. Nem sempre é uma palavra real. |
| Lemma | Forma de dicionário | A forma que você buscaria. Precisa de contexto gramatical pra calcular corretamente. |
| Tag POS | Classe gramatical | Categoria como NOUN, VERB, ADJ. Necessário pra lematizar com precisão. |
| Morfologia | Regras de forma da palavra | Como uma palavra muda de forma com tempo, número, caso. Lematização depende disso. |

## Leitura Complementar

- [Porter, M. F. (1980). An algorithm for suffix stripping](https://tartarus.org/martin/PorterStemmer/def.txt) — o paper original, cinco páginas, ainda a explicação mais clara.
- [spaCy 101 — linguistic features](https://spacy.io/usage/linguistic-features) — como uma pipeline real é conectada.
- [NLTK book, chapter 3](https://www.nltk.org/book/ch03.html) — casos extremos de tokenização que você ainda não pensou.
