# Reconhecimento de Entidades Nomeadas

> Tire os nomes. Parece fácil até você lidar com limites ambíguos, entidades aninhadas e jargão de domínio.

**Tipo:** Construção
**Linguagens:** Python
**Pré-requisitos:** Fase 5 · 02 (BoW + TF-IDF), Fase 5 · 03 (Word Embeddings)
**Tempo:** ~75 minutos

## O Problema

"Apple sued Google over its iPhone search deal in the US." Cinco entidades: Apple (ORG), Google (ORG), iPhone (PRODUCT), search deal (talvez), US (GPE). Um bom sistema NER extrai todas com tipos corretos. Um ruim perde iPhone, confunde Apple a fruta com Apple a empresa, e rotula "US" como PERSON.

NER é o cavalo de trabalho debaixo de toda pipeline de extração estruturada. Análise de currículo, verificação de logs de conformidade, anonimização de prontuários, compreensão de consultas de busca, fundamentação pra respostas de chatbot, extração de contratos legais. Você nunca vê direito; sempre depende disso.

Essa lição percorre o caminho clássico (baseado em regras, HMM, CRF) até o moderno (BiLSTM-CRF, depois transformers). Cada passo resolve uma limitação eespecificaçãoífica do anterior. O padrão é a lição.

## O Conceito

**Tagging BIO** (ou BILOU) transforma extração de entidades em problema de rotulação de sequência. Rotula cada token com `B-TYPE` (início da entidade), `I-TYPE` (dentro da entidade), ou `O` (fora de qualquer entidade).

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

Entidades multi-token encadeiam: `New B-GPE`, `York I-GPE`, `City I-GPE`. Um modelo que entende BIO pode extrair spans arbitrários.

A progressão de arquiteturas:

- **Baseado em regras.** Regex + consultas de gazetteer. Alta precisão em entidades conhecidas, cobertura zero em novas.
- **HMM.** Modelo de Markov Oculto. Probabilidade de emissão do token dado a tag, probabilidade de transição tag-a-tag. Decodificação Viterbi. Treinado em dados rotulados.
- **CRF.** Campo Aleatório Condicional. Como HMM mas discriminativo, então você pode misturar features arbitrárias (forma da palavra, capitalização, palavras vizinhas). Ainda o cavalo de produção clássico em 2026 pra deploys de baixo recurso.
- **BiLSTM-CRF.** Features neurais em vez de manuais. LSTM lê a frase em duas direções, camada CRF no topo garante sequências de tags consistentes.
- **Baseado em transformer.** Fine-tuning de BERT com cabeça de classificação de token. Melhor precisão. Mais custo computacional.

## Construindo

### Passo 1: helpers de tagging BIO

```python
def spans_to_bio(tokens, spans):
    rótulos = ["O"] * len(tokens)
    for start, end, label in spans:
        rótulos[start] = f"B-{label}"
        for i in range(start + 1, end):
            rótulos[i] = f"I-{label}"
    return rótulos


def bio_to_spans(tokens, rótulos):
    spans = []
    current = None
    for i, label in enumerate(rótulos):
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
>>> rótulos = ["B-ORG", "O", "B-ORG", "O", "B-PRODUCT", "O", "O"]
>>> bio_to_spans(tokens, rótulos)
[(0, 1, 'ORG'), (2, 3, 'ORG'), (4, 5, 'PRODUCT')]
```

### Passo 2: features manuais

Pra NER clássico (não-neural), features são o jogo. Úteis:

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

`word_shape("iPhone")` retorna `xXxxxx`. `word_shape("USA-2024")` retorna `XXX-dddd`. Padrões de capitalização são sinal forte pra substantivos próprios.

### Passo 3: um baseline simples baseado em regras + dicionário

```python
ORG_GAZETTEER = {"Apple", "Google", "Microsoft", "OpenAI", "Meta", "Amazon", "Netflix"}
GPE_GAZETTEER = {"US", "USA", "UK", "India", "Germany", "France"}
PRODUCT_GAZETTEER = {"iPhone", "Android", "Windows", "ChatGPT", "Claude"}


def rule_based_ner(tokens):
    rótulos = []
    for token in tokens:
        if token in ORG_GAZETTEER:
            rótulos.append("B-ORG")
        elif token in GPE_GAZETTEER:
            rótulos.append("B-GPE")
        elif token in PRODUCT_GAZETTEER:
            rótulos.append("B-PRODUCT")
        else:
            rótulos.append("O")
    return rótulos
```

Gazetteers de produção têm milhões de entradas raspadas da Wikipedia e DBpedia. Cobertura é boa. Desambiguação (`Apple` a empresa vs. a fruta) é terrível. É por isso que modelos estatísticos ganharam.

### Passo 4: o passo CRF (esboço, não implementação completa)

CRF completo do zero em 50 linhas não é esclarecedor sem fundamentos de teoria de probabilidade. Use `sklearn-crfsuite` em vez disso:

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
crf.fit(X_train, bio_rótulos_train)
```

`c1` e `c2` são regularização L1 e L2. `all_possible_transitions=True` permite que o modelo aprenda que sequências ilegais (ex: `I-ORG` após `O`) são improváveis, que é como um CRF impõe consistência BIO sem você escrever a restrição.

### Passo 5: o que um BiLSTM-CRF adiciona

Features viram aprendidas. Entradas: embeddings de tokens (GloVe ou fastText). LSTM lê da esquerda pra direita e da direita pra esquerda. Estados ocultos concatenados passam por uma camada de saída CRF. O CRF ainda impõe consistência de sequência de tags; a LSTM substitui features manuais por aprendidas.

```python
import torch
import torch.nn as nn


class BiLSTM_CRF_Head(nn.Module):
    def __init__(self, vocab_size, embed_dim, hidden_dim, n_rótulos):
        super().__init__()
        self.embed = nn.Embedding(vocab_size, embed_dim)
        self.lstm = nn.LSTM(embed_dim, hidden_dim, bidirectional=True, batch_first=True)
        self.fc = nn.Linear(hidden_dim * 2, n_rótulos)

    def forward(self, token_ids):
        e = self.embed(token_ids)
        h, _ = self.lstm(e)
        emissions = self.fc(h)
        return emissions
```

Pra camada CRF, use `torchcrf.CRF` (pip install pytorch-crf). O ganho sobre CRF manual é mensurável mas menor do que você espera a menos que tenha dezenas de milhares de frases rotuladas.

## Usando

spaCy traz NER de grau de produção de cara.

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

Note que `iPhone` foi rotulado `ORG` em vez de `PRODUCT` — o modelo pequeno do spaCy tem cobertura fraca pra entidades de produto. O modelo grande (`en_core_web_lg`) faz melhor. O modelo transformer (`en_core_web_trf`) faz melhor ainda.

Hugging Face pra NER baseado em BERT:

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

`aggregation_strategy="simple"` mescla tokens B-X, I-X contíguos num span. Sem isso, você ganha rótulos no nível de token e tem que mesclar sozinho.

### NER baseado em LLM (a opção de 2026)

Zero-shot e few-shot LLM NER agora é competitivo com modelos fine-tunados em muitos domínios, e dramaticamente melhor quando dados rotulados são escassos.

- **Zero-shot prompting.** Dá ao LLM uma lista de tipos de entidade e um schema de exemplo. Pede saída JSON. Funciona de cara; precisão é moderada em domínios novos.
- **Prompting estilo ZeroTuneBio.** Decompõe a tarefa em extração de candidatos → explicação de significado → julgamento → re-verificação. Um prompt multietapas (não one-shot) levanta precisão substancialmente em NER biomédico. O mesmo padrão funciona pra domínios legais, financeiros e científicos.
- **Prompting dinâmico com RAG.** Recupera os exemplos rotulados mais similares de um conjunto seed pequeno anotado pra cada chamada de inferência; constrói o prompt few-shot on the fly. Em benchmarks de 2026, isso levanta F1 biomédico do GPT-4 em 11-12% sobre prompting estático.
- **Decomposição por tipo de entidade.** Pra documentos longos, uma única chamada que extrai todos os tipos de entidade de uma vez perde recall conforme o comprimento cresce. Rode uma passagem de extração por tipo de entidade. Custo de inferência maior, precisão substancialmente maior. Esse é o padrão padrão pra prontuários clínicos e contratos legais.

Recomendação de produção em 2026: comece com um baseline zero-shot de LLM antes de coletar dados de treino. Geralmente o F1 é bom o suficiente pra nunca precisar de fine-tuning.

### Onde NER clássico ainda ganha

Mesmo com LLMs disponíveis, NER clássico ganha quando:

- Orçamento de latência é abaixo de 50ms.
- Você tem milhares de exemplos rotulados e precisa de 98%+ de F1.
- O domínio tem ontologia estável onde CRF ou BiLSTM pré-treinado transfere bem.
- Restrições regulatórias exigem modelo on-prem, não-generativo.

### Onde desmorona

- **Mudança de domínio.** NER treinado no CoNLL em contratos legais performa pior que um gazetteer. Fine-tune no seu domínio.
- **Entidades aninhadas.** "Bank of America Tower" é simultaneamente ORG e FACILITY. BIO padrão não representa spans sobrepostos. Você precisa de NER aninhado (multpass ou modelos baseados em spans).
- **Entidades longas.** "United States Federal Deposit Insurance Corporation." Modelos no nível de token às vezes quebram isso. Use `aggregation_strategy` ou pós-processamento.
- **Tipos raros.** Labels médicos como DRUG_BRAND, ADVERSE_EVENT, DOSE. Modelos gerais não fazem ideia. Scispacy e BioBERT são os pontos de partida.

## Entregando

Salve como `outputs/skill-ner-picker.md`:

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

Refuse to recommend fine-tuning a transformer for under 500 labeled examples unless the user already has a pretrained domain model. Flag nested entities as needing span-based or multi-pass models. Require a gazetteer audit if the user mentions "production scale" and rótulos are unchanged from CoNLL-2003.
```

## Exercícios

1. **Fácil.** Implemente `bio_to_spans` (o inverso de `spans_to_bio`) e verifique consistência ida-e-volta em 10 frases.
2. **Médio.** Treine o CRF sklearn-crfsuite acima no dataset CoNLL-2003 English NER. Reporte F1 por entidade usando `seqeval`. Resultado típico: ~84 F1.
3. **Difícil.** Fine-tune `distilbert-base-cased` num dataset NER de domínio eespecificaçãoífico (médico, jurídico ou financeiro). Compare com o modelo pequeno do spaCy. Documente verificações de data leakage e escreva o que te surpreendeu.

## Termos Chave

| Termo | O que a gente diz | O que realmente significa |
|------|-----------------|-----------------------|
| NER | Extrair nomes | Rotular spans de tokens com tipos (PERSON, ORG, GPE, DATE, ...). |
| BIO | Esquema de tagging | `B-X` começa, `I-X` continua, `O` fora. |
| BILOU | BIO melhor | Adiciona `L-X` (último), `U-X` (unitário) pra limites mais limpos. |
| CRF | Classificador estruturado | Modela transições entre rótulos, não só emissões. Impõe sequências válidas. |
| NER aninhado | Entidades sobrepostas | Um span é uma entidade diferente de um sub-span. BIO não consegue expressar isso. |
| F1 por entidade | Métrica NER correta | Span previsto deve combinar exatamente com span verdadeiro. F1 por token superestima acurácia. |

## Leitura Complementar

- [Lample et al. (2016). Neural Architectures for Named Entity Recognition](https://arxiv.org/abs/1603.01360) — o paper BiLSTM-CRF. Canônico.
- [Devlin et al. (2018). BERT: Pre-training of Deep Bidirectional Transformers](https://arxiv.org/abs/1810.04805) — introduz o padrão de classificação de tornou-se padrão.
- [spaCy linguistic features — named entities](https://spacy.io/usage/linguistic-features#named-entities) — referência prática pra cada atributo em `Doc.ents` e `Span`.
- [seqeval](https://github.com/chakki-works/seqeval) — a biblioteca de métricas correta. Use sempre.
