# Identificação da entidade denominada

> Parece fácil até lidar com limites ambíguos, entidades aninhadas e jargão de domínio.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 5 · 03 (Word Embeddings)
**Time:** ~75 minutes

## O problema

"A Apple processou o Google por causa do seu acordo de pesquisa do iPhone nos EUA". Cinco entidades: Apple (ORG), Google (ORG), iPhone (PRODUCT), acordo de pesquisa (talvez), US (GPE). Um bom sistema NER extrai todos eles com tipos corretos. Um mau perde o iPhone, confunde a Apple com a Apple a empresa, e rotula "US" como PERSON.

O NER é o cavalo de trabalho por baixo de cada pipeline estruturada de extração. Resumo de análise, registro de conformidade, anonização de registros médicos, compreensão de consultas de busca, base para respostas de chatbot, extração de contratos legais.

Esta lição percorre o caminho clássico (baseado em regras, HMM, CRF) para o moderno (BiLSTM-CRF, então transformadores).

## O conceito

**BIO tagging**(ou BILOU) transforma a extracção de entidades num problema de rotulagem de sequências.`B-TYPE`(inicio da entidade), `I-TYPE`(entidade interna), ou `O`(fora de qualquer entidade).

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

Cadeia de entidades multi-token: `New B-GPE`- Não .`York I-GPE`- Não .`City I-GPE`Um modelo que entenda a biologia pode extrair espaços arbitrários.

A evolução da arquitetura:

- **Rule-based.**Regex + revistas de jornal, alta precisão em entidades conhecidas, cobertura zero em novas.
- **HMM.**Modelo Markov oculto, probabilidade de emissão de um token dado, probabilidade de transição de tag para tag, decodificação Viterbi, treinado com dados rotulados.
- **CRF.**Campo aleatório condicional. Como HMM, mas discriminativo, para que você possa misturar características arbitrárias (forma de palavras, capitalização, palavras vizinhas). Ainda o cavalo de trabalho de produção clássico em 2026 para implementações de baixo recurso.
- **BiLSTM-CRF.**Características neurais em vez de artesanato. LSTM lê a frase em ambas as direções, camada CRF no topo impõe sequências de tag consistentes.
- **Transformer-based.**- O BERT é perfeito com uma cabeça de classificação de tokens, melhor precisão, mais computação.

```figure
ner-bio-tagging
```

## Construí-lo

### Passo 1: Assistentes de etiquetado de BIO

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

### Passo 2: Características artesanas

Para a NER clássica (não neural), as características são o jogo.

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

`word_shape("iPhone")`Retorno `xXxxxx`- Não .`word_shape("USA-2024")`Retorno `XXX-dddd`Os padrões de capitalização são de alto sinal para os substantivos próprios.

### Passo 3: uma linha de base base baseada em regras + dicionário

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

Os jornais de produção têm milhões de entradas retiradas da Wikipedia e DBpedia.`Apple`A Comissão Europeia, em especial, tem de fazer uma análise dos resultados da análise da situação.

### Passo 4: o passo CRF (esquema, não implantes completos)

O CRF completo a partir do zero em 50 linhas não é esclarecedor sem as bases da teoria da probabilidade.`sklearn-crfsuite`Em vez disso:

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

`c1`E ...`c2`são a regularização L1 e L2. `all_possible_transitions=True`permite que o modelo aprenda sequências ilegais (por exemplo, `I-ORG`Depois`O`O CRF impõe a consistência da BIO sem que você escreva a restrição.

### Passo 5: o que adiciona um BiLSTM-CRF

As características são aprendidas. As entradas: embeddings de token (GloVe ou fastText). LSTM lê de esquerda para direita e de direita para esquerda. Os estados ocultos concatenados passam por uma camada de saída CRF. O CRF ainda impõe consistência de sequência de tag; o LSTM substitui as características artesanais por aquelas aprendidas.

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

Para a camada CRF, use `torchcrf.CRF`O ganho sobre o CRF feito à mão é mensurável, mas menor do que se espera, a menos que você tenha dezenas de milhares de frases rotuladas.

## Usá-lo

A spaCy remete a um NER de produção fora da caixa.

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

Observação`iPhone`etiquetado`ORG`Em vez de`PRODUCT`O modelo pequeno da spaCy tem uma cobertura fraca das entidades de produtos.`en_core_web_lg`O modelo de transformador (`en_core_web_trf`O que é melhor ainda.

Cara de abraço para NER baseado em BERT:

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

`aggregation_strategy="simple"`Combina tokens B-X, I-X contíguos em um espaço. sem ele, você tem etiquetas de nível de token e tem que fundir-se a si mesmo.

### NER baseado em LLM (a opção de 2026)

O LLM NER de zero e poucos tiros é agora competitivo com modelos ajustados em muitos domínios, e dramaticamente melhor quando os dados rotulados são escassos.

- **Zero-shot prompting.**Dê ao LLM uma lista de tipos de entidades e um esquema de exemplo. Peça a saída JSON. Funciona fora da caixa; a precisão é moderada em domínios novos.
- **ZeroTuneBio-style prompting.**Descompõe a tarefa em extração de candidato → significado explicação → julgamento → re-verificação. Um prompt de várias etapas (não um tiro) aumenta a precisão substancialmente no NER biomédico. O mesmo padrão funciona para domínios jurídicos, financeiros e científicos.
- **Dynamic prompting with RAG.**Retirar os exemplos mais similares de rotulagem de um pequeno conjunto de sementes anotadas para cada chamada de inferência; construir o prompt de poucos tiros na mosca. Em 2026 referências, isso aumenta o GPT-4 biomédico NER F1 em 11-12% sobre o prompt estático.
- **Per-entity-type decomposition.**Para documentos longos, uma única chamada que extrai todos os tipos de entidade de uma só vez perde a recordação à medida que o comprimento aumenta. Execute um passe de extração por tipo de entidade. Custo de inferência mais alto, precisão substancialmente maior. Este é o padrão padrão para notas clínicas e contratos legais.

Recomendação de produção a partir de 2026: comece com uma linha de base de zero-shot LLM antes de coletar dados de treinamento.

### Onde a NER clássica ainda vence

Mesmo com LLM disponíveis, a NER clássica ganha quando:

- O orçamento de latência é inferior a 50ms.
- Tens milhares de exemplos etiquetados e precisas de 98% + F1.
- O domínio tem uma ontologia estável onde um CRF ou BiLSTM pré-treinado transfere bem.
- As restrições regulamentares exigem um modelo local, não gerador.

### Onde se desmorona

- **Domain shift.**O NER treinado em contratos legais tem pior desempenho do que um jornalista.
- **Nested entities.**O "Bank of America Tower" é simultaneamente um ORG e uma FACILITAD. O BIO padrão não pode representar intervalos de sobreposição.
- **Long entities.**"Corporação Federal de Seguros de Depósitos dos Estados Unidos". Modelos de nível de tokens às vezes dividem isto.`aggregation_strategy`ou pós-processo.
- **Sparse types.**Os modelos de uso geral não têm ideia, o Scispacy e o BioBERT são os pontos de partida.

## Envia-o

Salva como`outputs/skill-ner-picker.md`- Não .

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

## Exercícios

1. **Easy.**Implementação `bio_to_spans`(o inverso de `spans_to_bio`) e verificar a consistência de ida e volta em 10 frases.
2. **Medium.**Formar o CRF sklearn-crfsuite acima no conjunto de dados NER CoNLL-2003 Inglês.`seqeval`Resultado típico: ~ 84 F1.
3. **Hard.**- A música é perfeita .`distilbert-base-cased`Comparar com o modelo pequeno de spaCy.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| NER | Extract names | Label token spans with types (PERSON, ORG, GPE, DATE, ...). |
| BIO | Tagging scheme | `B-X` begins, `I-X` continues, `O` outside. |
| BILOU | Better BIO | Adds `L-X` (last), `U-X` (unit) for cleaner boundaries. |
| CRF | Structured classifier | Models transitions between labels, not just emissions. Enforces valid sequences. |
| Nested NER | Overlapping entities | One span is a different entity than a sub-span of it. BIO cannot express this. |
| Entity-level F1 | Proper NER metric | Predicted span must match true span exactly. Token-level F1 overstates accuracy. |

## Mais leitura

- [Lample et al. (2016). Neural Architectures for Named Entity Recognition](https://arxiv.org/abs/1603.01360)- o papel BiLSTM-CRF.
- [Devlin et al. (2018). BERT: Pre-training of Deep Bidirectional Transformers](https://arxiv.org/abs/1810.04805) introduz o padrão de classificação de tokens que se tornou padrão.
- [spaCy linguistic features — named entities](https://spacy.io/usage/linguistic-features#named-entities) referência prática para cada atributo de `Doc.ents`E ...`Span`- Não .
- [seqeval](https://github.com/chakki-works/seqeval)- A biblioteca métrica correta.
