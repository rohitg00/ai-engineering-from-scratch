# BERT  Modelagem de Línguas Enmascaradas

> O GPT prevê a próxima palavra, o BERT prevê uma palavra que falta, uma frase de diferença e meia década de tudo em forma de inserção.

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 5 · 02 (Text Representation)
**Time:** ~45 minutes

## O problema

Em 2018, cada tarefa de PNL  sentimento, NER, QA, entailment  treinou seu próprio modelo a partir do zero em seus próprios dados rotulados. Não havia um checkpoint pré-treinado "entender inglês" que você pudesse ajustar. ELMo (2018) mostrou que você poderia treinar embutimentos contextuais com um LSTM bidirecional; ajudou, mas não generalizou.

BERT (Devlin et al. 2018) perguntou: e se pegássemos num codificador transformador, treinássemos-o em cada frase na internet e forçássemos-o a prever palavras faltantes de contexto em ambos os lados?

O resultado: em 18 meses, o BERT e suas variantes (RoBERTa, ALBERT, ELECTRA) dominaram todas as listas de liderança de PNL existentes.

Em 2026, os modelos com apenas codificadores ainda são a ferramenta certa para classificação, recuperação e extração estruturada. Eles funcionam 510x mais rápido por token do que os decodificadores e seus incorporados são a espinha dorsal de cada pilha de recuperação moderna.

## O conceito

![Masked language modeling: pick tokens, mask them, predict originals](../assets/bert-mlm.svg)

### O sinal de treinamento

Faça uma frase:`the quick brown fox jumps over the lazy dog`- Não .

Mascarar 15% dos tokens aleatoriamente:

```
input:  the [MASK] brown fox jumps [MASK] the lazy dog
target: the  quick brown fox jumps  over  the lazy dog
```

Treinar o modelo para prever os tokens originais em posições mascaradas.`[MASK]`Na posição 1 pode usar `brown fox jumps`É o que o GPT não pode fazer.

### As regras da máscara BERT

Dos 15% dos tokens selecionados para previsão:

- 80% são substituídos por `[MASK]`- Não .
- 10% são substituídos por um token aleatório.
- 10% permanecem inalterados.

Porque não sempre ?`[MASK]`Porque ?`[MASK]`O modelo de aprendizagem é o modelo de aprendizagem que não aparece na hora da inferência.`[MASK]`A posição de 100% mascarada criaria uma mudança de distribuição entre o pré-treino e o ajuste fino.

### Próximo Previsão de Sentença (NSP)  e por que foi retirado

O BERT original também foi treinado em NSP: dado duas frases A e B, prevê se B segue A. RoBERTa (2019) abolou e mostrou que o NSP prejudicou, não ajudou.

### O que mudou em 2026: ModernBERT

O papel ModernBERT de 2024 reconstruiu o bloco com primitivos de 2026:

| Component | Original BERT (2018) | ModernBERT (2024) |
|-----------|----------------------|-------------------|
| Positional | Learned absolute | RoPE |
| Activation | GELU | GeGLU |
| Normalization | LayerNorm | Pre-norm RMSNorm |
| Attention | Full dense | Alternating local (128) + global |
| Context length | 512 | 8192 |
| Tokenizer | WordPiece | BPE |

E ao contrário da pilha de 2018, é Flash-Attention-native. Inferência é 23× mais rápida em comprimento de sequência 8K do que DeBERTa-v3 com melhores pontuações GLUE.

### Casos de uso que ainda escolhem um codificador em 2026

| Task | Why encoder beats decoder |
|------|---------------------------|
| Retrieval / semantic search embeddings | Bidirectional context = better embedding quality per token |
| Classification (sentiment, intent, toxicity) | One forward pass; no generation overhead |
| NER / token labeling | Per-position output, natively bidirectional |
| Zero-shot entailment (NLI) | Classifier head on top of encoder |
| Reranker for RAG | Cross-encoder scoring, 10x faster than LLM rerankers |

```figure
transformer-residual
```

## Construí-lo

### Passo 1: Mastização da lógica

Veja .`code/main.py`- A função`create_mlm_batch`Retorna IDs de entrada (com máscaras aplicadas) e rótulos (apenas em posições mascaradas, -100 em outros lugares  Ignore PyTorch's index convention).

```python
def create_mlm_batch(tokens, vocab_size, mask_prob=0.15, rng=None):
    input_ids = list(tokens)
    labels = [-100] * len(tokens)
    for i, t in enumerate(tokens):
        if rng.random() < mask_prob:
            labels[i] = t
            r = rng.random()
            if r < 0.8:
                input_ids[i] = MASK_ID
            elif r < 0.9:
                input_ids[i] = rng.randrange(vocab_size)
            # else: keep original
    return input_ids, labels
```

### Passo 2: executar previsão MLM em um corpus pequeno

Treinar um codificador de 2 camadas + MLM cabeça em um vocabulário de 20 palavras, 200 frases.

### Passo 3: comparação dos tipos de máscaras

Mostre como a regra de três direções mantém o modelo utilizável sem `[MASK]`A previsão de uma frase não mascarada e de uma frase mascarada devem produzir distribuições simbólicas razoáveis porque o modelo viu ambos os padrões no treinamento.

### Passo 4: Tópico de sintonia

Substitua a cabeça de MLM por uma cabeça de classificação num conjunto de dados de sentimento de brinquedo. Somente a cabeça entra; o codificador está congelado. Este é o padrão que todas as aplicações BERT seguem.

## Usá-lo

```python
from transformers import AutoModel, AutoTokenizer

tok = AutoTokenizer.from_pretrained("answerdotai/ModernBERT-base")
model = AutoModel.from_pretrained("answerdotai/ModernBERT-base")

text = "Attention is all you need."
inputs = tok(text, return_tensors="pt")
out = model(**inputs).last_hidden_state   # (1, N, 768)
```

**Embedding models are fine-tuned BERT.** `sentence-transformers`modelos como `all-MiniLM-L6-v2`O codificador é o mesmo, a perda mudou.

**Cross-encoder rerankers are also fine-tuned BERT.**Classificação em pares em`[CLS] query [SEP] doc [SEP]`A atenção bidirecional entre consulta e doc é exatamente o que dá aos encodadores cruzados a vantagem de qualidade em relação aos bicodadores.

**When not to pick BERT in 2026.**Qualquer coisa gerativa. O codificador não tem nenhuma maneira sensata de produzir tokens autoregressivamente. Além disso: qualquer coisa abaixo de parâmetros 1B onde um pequeno decodificador pode igualar a qualidade com mais flexibilidade (Phi-3-Mini, Qwen2-1.5B).

## Envia-o

Veja .`outputs/skill-bert-finetuner.md`. O âmbito de competência é ajustado a um BERT (selecção de espinha dorsal, especificação de cabeça, dados, avaliação, parada) para uma nova tarefa de classificação ou extracção.

## Exercícios

1. **Easy.**Corra .`code/main.py`Confirme que ~ 15% são selecionados, e daqueles ~ 80% se tornam `[MASK]`- Não .
2. **Medium.**Implementar mascaramento de palavras inteiras: se uma palavra é tokenizada em subpalavras, mascarar todas as subpalavras juntas ou nenhuma. Medir se isso melhora a precisão de MLM em um corpus de 500 frases.
3. **Hard.**Treinar um pequeno BERT de 2 camadas, d=64, em 10.000 frases de um conjunto de dados públicos.`[CLS]`Comparar com uma linha de base apenas para decodificadores em parâmetros correspondentes.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| MLM | "Masked language modeling" | Training signal: randomly replace 15% of tokens with `[MASK]`, predict the originals. |
| Bidirectional | "Looks both ways" | Encoder attention has no causal mask — every position sees every other position. |
| `[CLS]` | "The pooler token" | A special token prepended to every sequence; its final embedding is used as the sentence-level representation. |
| `[SEP]` | "Segment separator" | Separates paired sequences (e.g. query/doc, sentence A/B). |
| NSP | "Next sentence prediction" | BERT's second pretraining task; shown to be useless in RoBERTa, dropped after 2019. |
| Fine-tuning | "Adapt to a task" | Keep the encoder mostly frozen; train a small head on top for the downstream task. |
| Cross-encoder | "A reranker" | A BERT that takes both query and doc as input, outputs a relevance score. |
| ModernBERT | "2024 refresh" | Encoder rebuilt with RoPE, RMSNorm, GeGLU, alternating local/global attention, 8K context. |

## Mais leitura

- [Devlin et al. (2018). BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding](https://arxiv.org/abs/1810.04805)- Papel original.
- [Liu et al. (2019). RoBERTa: A Robustly Optimized BERT Pretraining Approach](https://arxiv.org/abs/1907.11692)Como treinar o BERT corretamente; mata o NSP.
- [Clark et al. (2020). ELECTRA: Pre-training Text Encoders as Discriminators Rather Than Generators](https://arxiv.org/abs/2003.10555) a detecção de tokens substituídos supera o MLM em computação correspondente.
- [Warner et al. (2024). Smarter, Better, Faster, Longer: A Modern Bidirectional Encoder](https://arxiv.org/abs/2412.13663)- Papel ModernBERT.
- [HuggingFace `modeling_bert.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/bert/modeling_bert.py) referência de codificador canônico.
