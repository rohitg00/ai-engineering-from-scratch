# POS Tagging e Parsing Sintático

> Gramática ficou fora de moda por um tempo. Depois toda pipeline de LLM precisou validar extração estruturada, e ela voltou.

**Tipo:** Construção
**Linguagens:** Python
**Pré-requisitos:** Fase 5 · 01 (Processamento de Texto), Fase 2 · 14 (Naive Bayes)
**Tempo:** ~45 minutos

## O Problema

A lição 01 prometeu que lematização precisa de uma tag de classe gramatical. Sem saber que `running` é verbo, um lematizador não pode reduzir pra `run`. Sem saber que `better` é adjetivo, não pode reduzir pra `good`.

Essa promessa escondeu um campo inteiro. POS tagging atribui categorias gramaticais. Parsing sintático recupera a estrutura em árvore da frase: qual palavra modifica qual, qual verbo rege quais argumentos. NLP clássico gastou vinte anos refinando ambos. Depois deep learning colapsou tudo numa tarefa de classificação de token no topo de um transformer pré-treinado, e a comunidade de pesquisa seguiu em frente.

Não a comunidade aplicada. Toda pipeline de extração estruturada ainda usa POS e árvores de dependência por baixo dos panos. JSON gerado por LLM é validado contra restrições gramaticais. Sistemas de question-answering decompõem consultas usando parses de dependência. Avaliadores de qualidade de tradução verificam alinhamento de árvores de parse.

Vale saber. Essa lição introduz os conjuntos de tags, os baselines, e o ponto onde você para de implementar do zero e chama spaCy.

## O Conceito

**POS tagging** rotula cada token com uma categoria gramatical. O conjunto de tags **Penn Treebank (PTB)** é o padrão inglês. 36 tags com distinções que o leitor casual acha excessivas: `NN` substantivo singular, `NNS` substantivo plural, `NNP` substantivo próprio singular, `VBD` verbo passado, `VBZ` verbo presente terceira pessoa singular, e assim por diante. O conjunto de tags **Universal Dependencies (UD)** é mais grosso (17 tags) e independente de idioma; tornou-se o padrão pra trabalho multilíngue.

```
The/DET cats/NOUN were/AUX running/VERB at/ADP 3pm/NOUN ./PUNCT
```

**Parsing sintático** produz uma árvore. Dois estilos principais:

- **Parsing de constituintes.** Frases nominais, frases verbais, frases preposicionais se aninham umas nas outras. A saída é uma árvore de categorias não-terminais (NP, VP, PP) com palavras como folhas.
- **Parsing de dependência.** Cada palavra tem uma palavra-chave da qual depende, rotulada com uma relação gramatical. A saída é uma árvore onde cada aresta é uma tupla (chave, dependente, relação).

Parsing de dependência ganhou nos anos 2010 porque generaliza limpo entre idiomas, eespecificaçãoialmente de ordem livre.

```
running is ROOT
cats is nsubj of running
were is aux of running
at is prep of running
3pm is pobj of at
```

## Construindo

### Passo 1: baseline de tag mais frequente

O POS tagger mais burro que funciona. Pra cada palavra, prevê a tag que ela teve mais vezes no treino.

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

No corpus Brown, esse baseline atinge ~85% de acurácia. Não é bom, mas é o piso abaixo do qual nenhum modelo sério deveria cair.

### Passo 2: tagger HMM de bigrama

Modela a probabilidade conjunta da sequência:

```
P(tags, words) = prod P(tag_i | tag_{i-1}) * P(word_i | tag_i)
```

Duas tabelas: probabilidades de transição (tag dada a tag anterior), probabilidades de emissão (palavra dada a tag). Estima ambas a partir de contagens com suavização Laplaciana. Decodifica com Viterbi (programação dinâmica sobre o lattice de tags).

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

HMM de bigrama no Brown atinge ~93% de acurácia. O salto de 85% pra 93% é principalmente probabilidades de transição — o modelo aprende que `DET NOUN` é comum e `NOUN DET` é raro.

### Passo 3: por que taggers modernos batem isso

Probabilidades de transição + emissão são locais. Não conseguem capturar que `saw` é substantivo em "I bought a saw" mas verbo em "I saw the movie." Um CRF com features arbitrárias (sufixo, forma da palavra, palavras antes e depois, a própria palavra) atinge ~97%. Um BiLSTM-CRF ou transformer atinge ~98%+.

O teto nessa tarefa é definido por discordância de anotadores. Anotadores humanos concordam cerca de 97% das vezes no Penn Treebank. Modelos acima de 98% provavelmente estão fazendo overfitting no teste.

### Passo 4: esboço de parsing de dependência

Parsing de dependência completo do zero está fora do escopo; o tratamento canônico em livro está em Jurafsky e Martin. Duas famílias clássicas pra conhecer:

- Parsers **baseados em transição** (arc-eager, arc-standard) agem como um parser shift-reduce: lêem tokens, empilham, e aplicam ações de redução que criam arcos. Decodificação gulosa é rápida. Implementação clássica é MaltParser. Versão neural moderna: parser baseado em transição de Chen e Manning.
- Parsers **baseados em grafo** (algoritmo de Eisner, biaffine Dozat-Manning) pontuam cada aresta possível chave-dependente e escolhem a árvore de expansão máxima. Mais lento mas mais preciso.

Pra maioria do trabalho aplicado, chama spaCy:

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

Leia a coluna `dep` de baixo pra cima e a estrutura gramatical da frase aparece.

## Usando

Toda biblioteca de NLP de produção traz parsers de POS e dependência como parte de uma pipeline padrão.

- **spaCy** (`en_core_web_sm` / `md` / `lg` / `trf`). Rápido, preciso, integrado com tokenização + NER + lematização. `token.tag_` (Penn), `token.pos_` (UD), `token.dep_` (relação de dependência).
- **Stanford NLP (stanza)**. Sucessor do CoreNLP da Stanford. Estado da arte em 60+ idiomas.
- **trankit**. Baseado em transformer, boa precisão UD.
- **NLTK**. `pos_tag`. Usável, lento, mais antigo. Bom pra ensino.

### Onde isso ainda importa em 2026

- **Lematização.** Lição 01 precisa de POS pra lematizar corretamente. Sempre.
- **Extração estruturada de saídas de LLM.** Validar que uma frase gerada respeita restrições gramaticais (ex: concordância sujeito-verbo, modificadores obrigatórios).
- **Sentimento baseado em aespecificaçãoto.** Parses de dependência dizem qual adjetivo modifica qual substantivo.
- **Compreensão de consulta.** "movies directed by Wes Anderson starring Bill Murray" decompõe em restrições estruturadas via parse.
- **Transferência multilíngue.** Tags UD e relações de dependência são independentes de idioma, habilitando análise estruturada zero-shot de novos idiomas.
- **Pipelines de baixo compute.** Se você não consegue enviar um transformer, POS + parse de dependência + gazetteer leva você surpreendentemente longe.

## Entregando

Salve como `outputs/skill-grammar-pipeline.md`:

```markdown
---
name: grammar-pipeline
description: Design a classical POS + dependency pipeline for a downstream NLP task.
version: 1.0.0
phase: 5
lesson: 07
tags: [nlp, pos, parsing]
---

Given a downstream task (information extraction, rewrite validation, consulta decomposition, lemmatization), you output:

1. Tagset to use. Penn Treebank for English-only legacy pipelines, Universal Dependencies for multilingual or cross-lingual.
2. Library. spaCy for most production, stanza for academic-grade multilingual, trankit for highest UD accuracy. Name the especificaçãoific model ID.
3. Integration pattern. Show the 3-5 lines that call the library and consume the needed attributes (`.pos_`, `.dep_`, `.head`).
4. Failure mode to test. Noun-verb ambiguity (`saw`, `book`, `can`) and PP-attachment ambiguity are the classical traps. Sample 20 outputs and eyeball.

Refuse to recommend rolling your own parser. Building parsers from scratch is a research project, not an application task. Flag any pipeline that consumes POS tags without handling lowercase/uppercase variants as fragile.
```

## Exercícios

1. **Fácil.** Usando o baseline de tag mais frequente num corpus pequeno anotado (ex: subconjunto Brown do NLTK), meça acurácia em frases de teste. Verifique o resultado ~85%.
2. **Médio.** Treine o HMM de bigrama acima e reporte precisão/recall por tag. Quais tags o HMM mais confunde?
3. **Difícil.** Use o parse de dependência do spaCy pra extrair tripletas sujeito-verbo-objeto de uma amostra de 1000 frases. Avalie em 50 tripletas rotuladas manualmente. Documente onde a extração falha (geralmente passivas, coordenações e sujeitos elididos).

## Termos Chave

| Termo | O que a gente diz | O que realmente significa |
|------|-----------------|-----------------------|
| Tag POS | Tipo da palavra | Categoria gramatical. PTB tem 36; UD tem 17. |
| Penn Treebank | Conjunto de tags padrão | Eespecificaçãoífico do inglês. Tempos verbais e número de substantivos granulares. |
| Universal Dependencies | Conjunto de tags multilíngue | Mais grosso que PTB; neutro de idioma; padrão pra trabalho cross-lingual. |
| Parse de dependência | Árvore da frase | Cada palavra tem uma chave, cada aresta tem relação gramatical. |
| Viterbi | Programação dinâmica | Encontra a sequência de tags de maior probabilidade dadas emissões e transições. |

## Leitura Complementar

- [Jurafsky and Martin — Speech and Language Processing, chapters 8 and 18](https://web.stanford.edu/~jurafsky/slp3/) — o tratamento canônico em livro de POS e parsing.
- [Universal Dependencies project](https://universaldependencies.org/) — o conjunto de tags cross-lingual e coleção de treebanks usado por todo parser multilíngue.
- [spaCy linguistic features guide](https://spacy.io/usage/linguistic-features) — referência prática pra cada atributo exposto em `Token`.
- [Chen and Manning (2014). A Fast and Accurate Dependency Parser using Neural Networks](https://nlp.stanford.edu/pubs/emnlp2014-depparser.pdf) — o paper que trouxe parsers neurais pro mainstream.
