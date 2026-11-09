# Tagging POS e Parsing sintático

> A gramática estava fora de moda por um tempo, então cada linha de LLM precisava de validar a extração estruturada, e voltou.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 01 (Text Processing), Phase 2 · 14 (Naive Bayes)
**Time:** ~45 minutes

## O problema

A lição 01 prometeu que a lemmatização precisa de uma etiqueta de parte da fala.`running`É um verbo, um lematizer não pode reduzir a `run`Sem saber .`better`É um adjetivo, não pode ser reduzido a `good`- Não .

Essa promessa oculta um subcampo inteiro. A etiquetação de parte da fala atribui categorias gramaticais. A análise sintática recupera a estrutura da árvore da frase: qual palavra modifica qual, qual verbo governa quais argumentos. A PNL clássica passou vinte anos refinando ambos.

Não a comunidade aplicada. Cada pipeline de extração estruturada ainda usa árvores de POS e dependência sob o capô. JSON gerado pela LLM é validado contra restrições gramaticais. Os sistemas de resposta a perguntas decompõem consultas usando parses de dependência. Avaliação de qualidade de tradução automática verifica o alinhamento das árvores de parse.

Esta lição introduz os tagsets, as linhas de base e o ponto em que você deixa de implementar a partir do zero e chama espaCy.

## O conceito

**POS tagging**É o que significa que cada símbolo é etiquetado com uma categoria gramatical.**Penn Treebank (PTB)**Tagset é o padrão inglês. 36 tags com distinções o leitor casual acha complicado: `NN`singular substantivo, `NNS`Pronom plural, `NNP`Propias substantivas singulares, `VBD`Verbo passado, `VBZ`3o personagem singular presente, etc. O **Universal Dependencies (UD)**Tagset é mais grosseiro (17 tags) e linguístico-agnóstico; tornou-se o padrão para o trabalho translangual.

```
The/DET cats/NOUN were/AUX running/VERB at/ADP 3pm/NOUN ./PUNCT
```

**Syntactic parsing**produz uma árvore.

- **Constituency parsing.**Frases de substantivos, frases de verbos, frases preposicionais nidificam dentro um do outro.
- **Dependency parsing.**Cada palavra tem uma única palavra-chave em que depende, rotulada com uma relação gramatical.

A análise de dependência ganhou na década de 2010 porque generaliza limpo entre as línguas, especialmente as de ordem de palavras livre.

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

## Construí-lo

### Passo 1: linha de base de etiqueta mais frequente

O tagger mais estúpido que funciona, para cada palavra, prevê a tag que tinha mais vezes no treino.

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

No corpus Brown, esta linha de base atinge uma precisão de 85%.

### Passo 2: tagger HMM de bigramas

Modela a probabilidade conjunta da sequência:

```math
P(\text{tags}, \text{words}) = \prod_i P(\text{tag}_i \mid \text{tag}_{i-1}) \cdot P(\text{word}_i \mid \text{tag}_i)
```

Duas tabelas: probabilidades de transição (tag dada a tag anterior), probabilidades de emissão (tag dada a palavra). Estima ambas a partir de contagens com suavização Laplace. Decodificar com Viterbi (programação dinâmica sobre a rede de tag).

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

Bigram HMM em Brown atinge ~93% de precisão. O salto de 85% para 93% é principalmente probabilidades de transição  o modelo aprende `DET NOUN`é comum e `NOUN DET`É raro.

### Passo 3: por que os taggers modernos vencem isto

As probabilidades de transição + de emissão são locais.`saw`é um substantivo em "Eu comprei uma serra" mas um verbo em "Eu vi o filme". Um CRF com características arbitrárias (sufixo, forma de palavra, palavra antes e depois, palavra em si) atinge ~97%.

O teto desta tarefa é definido por discordância entre os anotadores.

### Passo 4: Esboço de análise de dependência

A análise completa da dependência a partir do zero está fora de alcance; o tratamento do livro-texto canônico é em Jurafsky e Martin.

- **Transition-based**Parser (arc-eager, arc-standard) atua como um parser de redução de mudanças: eles lêem tokens, os transferem para uma pilha e aplicam ações de redução que criam arcos. A codificação gananciosa é rápida. A implementação clássica é MaltParser. Versão neural moderna: o parser baseado em transição de Chen e Manning.
- **Graph-based**Os parseres (algoritmo de Eisner, Dozat-Manning biafina) pontua todas as bordas possíveis dependentes da cabeça e escolhem a árvore de extensão máxima.

Para a maioria dos trabalhos aplicados, liga-se para o spaCy:

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

Leia o `dep`A coluna de baixo para cima e a estrutura gramatical da frase cai.

## Usá-lo

Cada biblioteca de produção de PNL envia POS e parseres de dependência como parte de um pipeline padrão.

- **spaCy**(`en_core_web_sm`- Não .`md`- Não .`lg`- Não .`trf`O sistema de informação é rápido, preciso e integrado com tokenization + NER + lemmatization.`token.tag_`- Não .`token.pos_`(UD), `token.dep_`(relação de dependência).
- **Stanford NLP (stanza)**Sucessor de Stanford ao CoreNLP. Estado da arte em mais de 60 idiomas.
- **trankit**- Baseado em transformador, boa precisão UD.
- **NLTK**- Não .`pos_tag`- Útil, lento, mais velho, bom para ensinar.

### Onde isso ainda importa em 2026

- **Lemmatization.**A lição 01 precisa de um POS para lematizar corretamente.
- **Structured extraction from LLM outputs.**Validar que uma frase gerada respeita restrições gramaticais (por exemplo, acordo entre sujeito e verbo, modificadores necessários).
- **Aspect-based sentiment.**Os parses de dependência dizem-lhe qual adjetivo modifica qual substantivo.
- **Query understanding.**"filmes dirigidos por Wes Anderson com Bill Murray" se descompõem em restrições estruturadas através da análise.
- **Cross-lingual transfer.**As etiquetas UD e as relações de dependência são linguísticas-agnósticas, permitindo uma análise estruturada de zero-shot das novas línguas.
- **Low-compute pipelines.**Se não conseguir enviar um transformador, o POS + o parse de dependência + o gazetteer vai longe.

## Envia-o

Salva como`outputs/skill-grammar-pipeline.md`- Não .

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

## Exercícios

1. **Easy.**Usando a linha de base com mais frequência de tag em um corpus de pequenas tag (por exemplo, subconjunto Brown do NLTK), medir a precisão em frases mantidas. Verifique o resultado de ~ 85%.
2. **Medium.**Treinar o HMM de grande formato acima e relatar a precisão/recolha por tag.
3. **Hard.**Use a análise de dependência do spaCy para extrair triples sujeito-verbo-objeto de uma amostra de 1000 frases. Avalie em 50 triples rotulados manualmente. Documentos onde a extração falha (muitas vezes passivos, coordenadas e sujeitos elidados).

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| POS tag | Word's type | Grammatical category. PTB has 36; UD has 17. |
| Penn Treebank | Standard tagset | English-specific. Fine-grained verb tenses and noun number. |
| Universal Dependencies | Multilingual tagset | Coarser than PTB; language-neutral; defaults for cross-lingual work. |
| Dependency parse | Sentence tree | Each word has one head, each edge has a grammatical relation. |
| Viterbi | Dynamic programming | Finds the highest-probability tag sequence given emissions and transitions. |

## Mais leitura

- [Jurafsky and Martin — Speech and Language Processing, chapters 8 and 18](https://web.stanford.edu/~jurafsky/slp3/) o tratamento canônico dos livros de texto do POS e do parsing.
- [Universal Dependencies project](https://universaldependencies.org/) o conjunto de tags e o treebank interlinguais utilizados por cada parcer multilingue.
- [spaCy linguistic features guide](https://spacy.io/usage/linguistic-features) referência prática para cada atributo exposto em `Token`- Não .
- [Chen and Manning (2014). A Fast and Accurate Dependency Parser using Neural Networks](https://nlp.stanford.edu/pubs/emnlp2014-depparser.pdf)O jornal que trouxe os neurotransmissores para a corrente principal.
