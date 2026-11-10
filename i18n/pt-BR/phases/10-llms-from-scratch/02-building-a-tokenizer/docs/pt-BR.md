# Construindo um Tokenizer a partir do zero

> A lição 01 deu-te um brinquedo.

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 10, Lesson 01 (Tokenizers: BPE, WordPiece, SentencePiece)
**Time:** ~90 minutes

## Objetivos de aprendizagem

- Construir um tokenizer BPE de nível de produção que lida com Unicode, normalização do espaço branco e tokens especiais
- Implementar fallback de nível de byte para que o tokenizer possa codificar qualquer entrada (incluindo emoji, CJK e código) sem tokens desconhecidos
- Adicionar padrões regex pré-tokenization que dividem o texto em limites de palavras antes de aplicar fusões BPE
- Treinar um tokenizer personalizado em um corpus e avaliar sua relação de compressão contra o tiktoken em texto multilingue

## O problema

O tokenizer do BPE da lição 01 funciona com texto em inglês, agora atira japonês, emoji, código Python com separadores e espaços mistos.

- Está a quebrar.

Não porque o BPE esteja errado, porque a implementação é incompleta. Um tokenizer de produção lida com bytes brutos em qualquer codificação, normaliza Unicode antes de se dividir, gerencia tokens especiais que nunca se fundem, cadeias de pré-tokenização com subword splitting, e faz tudo isso rápido o suficiente para não bloquear um pipeline de treinamento processando 15 trilhões de tokens.

O tokenizer do GPT-2 tem 50.257 tokens. Llama 3 tem 128.256. O GPT-4 tem cerca de 100.000. Estes não são números de brinquedo. As tabelas de fusão por trás desses vocabulários foram treinadas em centenas de gigabytes de texto, e as máquinas que as rodeiam -- normalização, pré-tokenização, injeção especial de tokens, formatamento de modelos de bate-papo -- é o que separa um tokenizer que lida com "Hello World" de um que lida com toda a internet.

Vais construir essa máquina.

## O conceito

### O oleoduto completo

Um tokenizer de produção não é um algoritmo, é um pipeline de cinco etapas, cada uma resolvendo um problema diferente.

```mermaid
graph LR
    A[Raw Text] --> B[Normalize]
    B --> C[Pre-Tokenize]
    C --> D[BPE Merge]
    D --> E[Special Tokens]
    E --> F[Token IDs]

    style A fill:#1a1a2e,stroke:#e94560,color:#fff
    style B fill:#1a1a2e,stroke:#e94560,color:#fff
    style C fill:#1a1a2e,stroke:#e94560,color:#fff
    style D fill:#1a1a2e,stroke:#e94560,color:#fff
    style E fill:#1a1a2e,stroke:#e94560,color:#fff
    style F fill:#1a1a2e,stroke:#e94560,color:#fff
```

Cada etapa tem um trabalho específico:

| Stage | What It Does | Why It Matters |
|-------|-------------|----------------|
| Normalize | NFKC Unicode, lowercase optional, strip accents optional | "fi" ligature (U+FB01) becomes "fi" (two chars). Without this, same word gets different tokens. |
| Pre-Tokenize | Split text into chunks before BPE | Prevents BPE from merging across word boundaries. "the cat" should never produce a token "e c". |
| BPE Merge | Apply learned merge rules to byte sequences | The core compression. Turns raw bytes into subword tokens. |
| Special Tokens | Inject [BOS], [EOS], [PAD], chat template markers | These tokens have fixed IDs. They never participate in BPE merges. The model needs them for structure. |
| ID Mapping | Convert token strings to integer IDs | The model sees integers, not strings. |

### BPE de nível byte

O tokenizer da lição 01 operava em bytes UTF-8. Essa foi a chamada certa. Mas ignoramos algo importante: o que acontece quando esses bytes não são válidos UTF-8?

O BPE de nível de byte resolve isso tratando todos os valores de byte possíveis (0-255) como um token válido. Seu vocabulário base é exatamente 256 entradas. Qualquer arquivo - texto, binário, corrupto - pode ser tokenizado sem produzir um token desconhecido.

O GPT-2 adicionou um truque: mapear cada byte para um caracter Unicode impressível para que o vocabulário permaneça legível pelo ser humano.

O poder real: o BPE de nível de byte lida com todas as línguas da Terra. Os caracteres chineses são 3 bytes UTF-8 cada. O japonês pode ser 3-4 bytes. Árabe, Devanagari, emoji - tudo apenas sequências de byte. O algoritmo BPE encontra padrões nessas sequências de byte exatamente da mesma forma que encontra padrões em bytes ASCII em inglês.

### Pre-tokenization

Antes de o BPE tocar no seu texto, você precisa dividir em pedaços. Isso impede que o algoritmo de fusão crie tokens que abrangam os limites das palavras.

O GPT-2 usa um padrão regex para dividir o texto:

```
'(?:[sdmt]|ll|ve|re)| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+
```

Este padrão se divide em contrações ("don't" se torna "don" + "'t"), palavras com espaços de liderança opcionais, números, pontuação e espaço em branco. O espaço de liderança é mantido ligado à palavra - então "o gato" se torna ["o", "gato"], não ["o", " ", "gato"").

Llama usa SentencePiece, que evita regex inteiramente. trata o fluxo de byte bruto como uma sequência longa e permite que o algoritmo BPE descubra os limites. Isso é mais simples, mas dá ao BPE mais liberdade para criar tokens de palavras cruzadas.

A escolha é importante. o regex do GPT-2 impede que o tokenizador aprenda que "o" no final de uma palavra e "o" no início da próxima devem se fundir. a SentencePiece permite isso, o que às vezes produz compressão mais eficiente mas tokens menos interpretáveis.

### Tokens especiais

Cada tokenizer de produção reserva identidades de tokens para marcadores estruturais:

| Token | Purpose | Used By |
|-------|---------|---------|
| `[BOS]` / `<s>` | Beginning of sequence | Llama 3, GPT |
| `[EOS]` / `</s>` | End of sequence | All models |
| `[PAD]` | Padding for batch alignment | BERT, T5 |
| `[UNK]` | Unknown token (byte-level BPE eliminates this) | BERT, WordPiece |
| `<\|im_start\|>` | Chat message boundary start | ChatGPT, Qwen |
| `<\|im_end\|>` | Chat message boundary end | ChatGPT, Qwen |
| `<\|user\|>` | User turn marker | Llama 3 |
| `<\|assistant\|>` | Assistant turn marker | Llama 3 |

Os tokens especiais nunca são divididos pelo BPE. Eles são combinados exatamente antes do algoritmo de fusão ser executado, substituídos por seu ID fixo, e o texto circundante é tokenizado normalmente.

### Modelos de chat

É aqui que a maioria das pessoas fica confusa e a maioria das implementações quebra.

Quando você envia mensagens para um modelo de chat, a API aceita uma lista de mensagens:

```
[
  {"role": "system", "content": "You are helpful."},
  {"role": "user", "content": "Hello"},
  {"role": "assistant", "content": "Hi there!"}
]
```

O modelo não vê JSON. Ele vê uma sequência de tokens plana. O modelo de bate-papo converte mensagens nessa sequência plana usando tokens especiais. Cada modelo faz isso de forma diferente:

```
Llama 3:
<|begin_of_text|><|start_header_id|>system<|end_header_id|>

You are helpful.<|eot_id|><|start_header_id|>user<|end_header_id|>

Hello<|eot_id|><|start_header_id|>assistant<|end_header_id|>

Hi there!<|eot_id|>

ChatGPT:
<|im_start|>system
You are helpful.<|im_end|>
<|im_start|>user
Hello<|im_end|>
<|im_start|>assistant
Hi there!<|im_end|>
```

Se o modelo for errado, o modelo produz lixo. Foi treinado num formato exato. Qualquer desvio - uma nova linha faltante, um token trocado, um espaço extra - coloca a entrada fora da distribuição de treinamento.

### Velocidade

O Python é muito lento para tokenização de produção.

Tiktoken (OpenAI) é escrito em Rust com ligamentos Python. HuggingFace tokenizers também é Rust. SentencePiece é C ++. Estes alcançam 10-100x velocidades em relação ao Python puro.

Para perspectiva: tokenizar 15 trilhões de tokens para o pre-treinamento Llama 3 a 1 milhão de tokens por segundo (Python rápido) levaria 174 dias.

Você está construindo em Python para entender o algoritmo. Na produção, você usaria uma implementação compilada e tocaria apenas no envolvente Python.

```figure
weight-tying
```

## Construí-lo

### Passo 1: Encodificação de nível de byte

A base. Converte qualquer cadeia em uma sequência de bytes, mapeie cada byte para um caráter impressavel para exibição e inverta o processo.

```python
def bytes_to_tokens(text):
    return list(text.encode("utf-8"))

def tokens_to_text(token_bytes):
    return bytes(token_bytes).decode("utf-8", errors="replace")
```

Teste em texto multilingue para ver o número de bytes:

```python
texts = [
    ("English", "hello"),
    ("Chinese", "你好"),
    ("Emoji", "🔥"),
    ("Mixed", "hello你好🔥"),
]

for label, text in texts:
    b = bytes_to_tokens(text)
    print(f"{label}: {len(text)} chars -> {len(b)} bytes -> {b}")
```

"Hello" é de 5 bytes. "你好" é de 6 bytes (3 por caracter). O emoji de fogo é de 4 bytes. O tokenizer de nível de byte não se importa qual é a linguagem.

### Passo 2: Pre- Tokenizer com Regex

Divida o texto em pedaços usando o padrão GPT-2 regex. Cada pedaço é tokenizado de forma independente pelo BPE.

```python
import re

try:
    import regex
    GPT2_PATTERN = regex.compile(
        r"""'(?:[sdmt]|ll|ve|re)| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+"""
    )
except ImportError:
    GPT2_PATTERN = re.compile(
        r"""'(?:[sdmt]|ll|ve|re)| ?[^\W\d_]+| ?\d+| ?(?:[^\s\w]|_)+|\s+(?!\S)|\s+"""
    )

def pre_tokenize(text):
    return [match.group() for match in GPT2_PATTERN.finditer(text)]
```

O `regex`Modulo suporta escapes de propriedade Unicode (`\p{L}`para cartas, `\p{N}`Para números).`re`O módulo não, então o fallback constrói as mesmas classes de `\w`- Não .`[^\W\d_]`corresponde a qualquer letra Unicode e `\d`Qualquer dígito de Unicode. Para tokenizadores multilíngues de produção, instale `regex`- Não .

Tenta:

```python
print(pre_tokenize("Hello, world! Don't stop."))
# ['Hello', ',', ' world', '!', ' Don', "'t", ' stop', '.']
```

O espaço principal permanece ligado à palavra que o segue.`Hello`As contrações se dividem no apóstrofo. A pontuação se torna sua própria peça.

### Passo 3: BPE em sequências de byte

O algoritmo central da lição 01, mas agora opera em pedaços pré-tokenizados de forma independente.

```python
from collections import Counter

def get_byte_pairs(chunks):
    pairs = Counter()
    for chunk in chunks:
        byte_seq = list(chunk.encode("utf-8"))
        for i in range(len(byte_seq) - 1):
            pairs[(byte_seq[i], byte_seq[i + 1])] += 1
    return pairs

def apply_merge(byte_seq, pair, new_id):
    merged = []
    i = 0
    while i < len(byte_seq):
        if i < len(byte_seq) - 1 and byte_seq[i] == pair[0] and byte_seq[i + 1] == pair[1]:
            merged.append(new_id)
            i += 2
        else:
            merged.append(byte_seq[i])
            i += 1
    return merged
```

### Passo 4: Manuseio de Tokens Especiais

Os tokens especiais precisam de identificação fixa e correspondência exacta.

```python
class SpecialTokenHandler:
    def __init__(self):
        self.special_tokens = {}
        self.pattern = None

    def add_token(self, token_str, token_id):
        self.special_tokens[token_str] = token_id
        escaped = [re.escape(t) for t in sorted(self.special_tokens.keys(), key=len, reverse=True)]
        self.pattern = re.compile("|".join(escaped))

    def split_with_specials(self, text):
        if not self.pattern:
            return [(text, False)]
        parts = []
        last_end = 0
        for match in self.pattern.finditer(text):
            if match.start() > last_end:
                parts.append((text[last_end:match.start()], False))
            parts.append((match.group(), True))
            last_end = match.end()
        if last_end < len(text):
            parts.append((text[last_end:], False))
        return parts
```

### Passo 5: Classe de Tokenizer Completo

Encaixar tudo juntos: normalizar, dividir em tokens especiais, pre-tokenize, BPE fundir, mapa para IDs.

```python
import unicodedata

class ProductionTokenizer:
    def __init__(self):
        self.merges = {}
        self.vocab = {i: bytes([i]) for i in range(256)}
        self.special_handler = SpecialTokenHandler()
        self.next_id = 256

    def normalize(self, text):
        return unicodedata.normalize("NFKC", text)

    def train(self, text, num_merges):
        text = self.normalize(text)
        chunks = pre_tokenize(text)
        chunk_bytes = [list(chunk.encode("utf-8")) for chunk in chunks]

        for i in range(num_merges):
            pairs = Counter()
            for seq in chunk_bytes:
                for j in range(len(seq) - 1):
                    pairs[(seq[j], seq[j + 1])] += 1
            if not pairs:
                break
            best = max(pairs, key=pairs.get)
            new_id = self.next_id
            self.next_id += 1
            self.merges[best] = new_id
            self.vocab[new_id] = self.vocab[best[0]] + self.vocab[best[1]]
            chunk_bytes = [apply_merge(seq, best, new_id) for seq in chunk_bytes]

    def add_special_token(self, token_str):
        token_id = self.next_id
        self.next_id += 1
        self.special_handler.add_token(token_str, token_id)
        self.vocab[token_id] = token_str.encode("utf-8")
        return token_id

    def encode(self, text):
        text = self.normalize(text)
        parts = self.special_handler.split_with_specials(text)
        all_ids = []
        for part_text, is_special in parts:
            if is_special:
                all_ids.append(self.special_handler.special_tokens[part_text])
            else:
                for chunk in pre_tokenize(part_text):
                    byte_seq = list(chunk.encode("utf-8"))
                    for pair, new_id in self.merges.items():
                        byte_seq = apply_merge(byte_seq, pair, new_id)
                    all_ids.extend(byte_seq)
        return all_ids

    def decode(self, ids):
        byte_parts = []
        for token_id in ids:
            if token_id in self.vocab:
                byte_parts.append(self.vocab[token_id])
        return b"".join(byte_parts).decode("utf-8", errors="replace")

    def vocab_size(self):
        return len(self.vocab)
```

### Passo 6: Teste de Multilinguagem

O teste real é jogar inglês, chinês, emoji e código.

```python
corpus = (
    "The quick brown fox jumps over the lazy dog. "
    "The quick brown fox runs through the forest. "
    "Machine learning models process natural language. "
    "Deep learning transforms how we build software. "
    "def train(model, data): return model.fit(data) "
    "def predict(model, x): return model(x) "
)

tok = ProductionTokenizer()
tok.train(corpus, num_merges=50)

bos = tok.add_special_token("<|begin|>")
eos = tok.add_special_token("<|end|>")

test_texts = [
    "The quick brown fox.",
    "你好世界",
    "Hello 🌍 World",
    "def foo(x): return x + 1",
    f"<|begin|>Hello<|end|>",
]

for text in test_texts:
    ids = tok.encode(text)
    decoded = tok.decode(ids)
    print(f"Input:   {text}")
    print(f"Tokens:  {len(ids)} ids")
    print(f"Decoded: {decoded}")
    print()
```

Os caracteres chineses produzem 3 bytes cada. O emoji produz 4 bytes. Nenhum deles acerta o tokenizer. Nenhum produz tokens desconhecidos. Isso é o poder do BPE de nível de byte.

## Usá-lo

### Comparar Tokenizers reais

Carregue os tokenizadores reais de Llama 3, GPT-4 e Mistral. Veja como cada um lida com o mesmo parágrafo multilingue.

```python
import tiktoken

gpt4_enc = tiktoken.get_encoding("cl100k_base")

test_paragraph = "Machine learning is powerful. 机器学习很强大。 L'apprentissage automatique est puissant. 🤖💪"

tokens = gpt4_enc.encode(test_paragraph)
pieces = [gpt4_enc.decode([t]) for t in tokens]
print(f"GPT-4 ({len(tokens)} tokens): {pieces}")
```

```python
from transformers import AutoTokenizer

llama_tok = AutoTokenizer.from_pretrained("meta-llama/Meta-Llama-3-8B")
mistral_tok = AutoTokenizer.from_pretrained("mistralai/Mistral-7B-v0.1")

for name, tok in [("Llama 3", llama_tok), ("Mistral", mistral_tok)]:
    tokens = tok.encode(test_paragraph)
    pieces = tok.convert_ids_to_tokens(tokens)
    print(f"{name} ({len(tokens)} tokens): {pieces[:20]}...")
```

Você verá diferentes contagens de tokens para o mesmo texto. Llama 3 com vocabulário 128K é mais agressivo em fundir padrões comuns. GPT-4 com 100K fica no meio. Mistral com 32K produz mais tokens, mas tem uma camada de inserção menor.

A compensação é sempre a mesma: um vocabulário maior significa sequências mais curtas mas mais parâmetros.

## Envia-o

Esta lição produz um prompt para a construção e depuração de tokenizadores de produção.`outputs/prompt-tokenizer-builder.md`- Não .

## Exercícios

1. **Easy:**Adicionar um`get_token_bytes(id)`método que mostra os bytes brutos para qualquer ID de token. Use-o para inspecionar o que seus tokens mais comuns combinados realmente representam.
2. **Medium:**Implementar o pre-tokenizer de estilo Llama que se divide em espaços brancos e dígitos, mas mantém espaços de liderança. Compare seu vocabulário com a abordagem GPT-2 regex no mesmo corpus.
3. **Hard:**Adicionar um método de modelo de chat que leva uma lista de `{"role": ..., "content": ...}`A sequência de tokens é correta para o formato de chat Llama 3.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| Byte-level BPE | "Tokenizer that works on bytes" | BPE with a base vocabulary of 256 byte values -- handles any input without unknown tokens |
| Pre-tokenization | "Splitting before BPE" | Regex or rule-based splitting that prevents BPE from merging across word boundaries |
| NFKC normalization | "Unicode cleanup" | Canonical decomposition followed by compatibility composition -- "fi" ligature becomes "fi", fullwidth "A" becomes "A" |
| Chat template | "How messages become tokens" | The exact format for converting a list of role/content messages into a flat token sequence -- model-specific and must match training format |
| Special tokens | "Control tokens" | Reserved token IDs that bypass BPE -- [BOS], [EOS], [PAD], chat markers -- matched exactly before merge |
| Fertility | "Tokens per word" | Ratio of output tokens to input words -- 1.3 for English in GPT-4, 2-3 for Korean, higher means wasted context |
| tiktoken | "OpenAI tokenizer" | Rust BPE implementation with Python bindings -- 10-100x faster than pure Python |
| Merge table | "The vocabulary" | Ordered list of byte-pair merges learned during training -- this IS the tokenizer's learned knowledge |

## Mais leitura

- [OpenAI tiktoken source](https://github.com/openai/tiktoken)-- Implementação de BPE de resistência utilizada pelo GPT-3.5/4
- [HuggingFace tokenizers](https://github.com/huggingface/tokenizers)-- Rust tokenizer biblioteca que suporta BPE, WordPiece, Unigram
- [Llama 3 paper (Meta, 2024)](https://arxiv.org/abs/2407.21783)-- detalhes sobre o vocabulário de 128K e a formação de tokenizadores
- [SentencePiece (Kudo & Richardson, 2018)](https://arxiv.org/abs/1808.06226)-- Tokenization linguística-agnóstica
- [GPT-2 tokenizer source](https://github.com/openai/gpt-2/blob/master/src/encoder.py)-- o mapeamento original de byte para Unicode
