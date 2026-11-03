# Construir un Tokenizer desde cero

> La lección 01 te dio un juguete.

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 10, Lesson 01 (Tokenizers: BPE, WordPiece, SentencePiece)
**Time:** ~90 minutes

## Objetivos de aprendizaje

- Construir un tokenizer BPE de producción que maneje Unicode, normalización del espacio en blanco y tokens especiales
- Implementar fallback a nivel de byte para que el tokenizer pueda codificar cualquier entrada (incluyendo emoji, CJK y código) sin fichas desconocidas
- Añadir patrones de regex pre-tokenization que dividen el texto en los límites de palabras antes de aplicar fusiones de BPE
- Entrenar un tokenizer personalizado en un corpus y evaluar su ratio de compresión contra tiktoken en texto multilingüe

## El problema

Su tokenizer BPE de la lección 01 funciona con texto en inglés. Ahora lanza japonés o emoji o código Python con pestañas y espacios mixtos.

Se rompe.

No porque BPE esté equivocado, porque la implementación es incompleta. Un tokenizer de producción maneja bytes crudos en cualquier codificación, normaliza Unicode antes de dividir, gestiona tokens especiales que nunca se fusionan, cadena pre-tokenización con subword splitting, y hace todo esto lo suficientemente rápido como para no bloquear un pipeline de entrenamiento procesando 15 billones de tokens.

El tokenizer de GPT-2 tiene 50.257 tokens. El Llama 3 tiene 128.256. GPT-4 tiene aproximadamente 100.000. Estos no son números de juguete. Las tablas de fusión detrás de esos vocabularios fueron entrenadas en cientos de gigabytes de texto, y la maquinaria que los rodea -- normalización, pre-tokenización, inyección de tokens especiales, formato de plantillas de chat -- es lo que separa un tokenizer que maneja "hola mundo" de uno que maneja toda Internet.

Vas a construir esa maquinaria.

## El concepto

### El oleoducto completo

Un tokenizer de producción no es un algoritmo, es un pipeline de cinco etapas, cada una resolviendo un problema diferente.

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

Cada etapa tiene un trabajo específico:

| Stage | What It Does | Why It Matters |
|-------|-------------|----------------|
| Normalize | NFKC Unicode, lowercase optional, strip accents optional | "fi" ligature (U+FB01) becomes "fi" (two chars). Without this, same word gets different tokens. |
| Pre-Tokenize | Split text into chunks before BPE | Prevents BPE from merging across word boundaries. "the cat" should never produce a token "e c". |
| BPE Merge | Apply learned merge rules to byte sequences | The core compression. Turns raw bytes into subword tokens. |
| Special Tokens | Inject [BOS], [EOS], [PAD], chat template markers | These tokens have fixed IDs. They never participate in BPE merges. The model needs them for structure. |
| ID Mapping | Convert token strings to integer IDs | The model sees integers, not strings. |

### BPE de nivel byte

El tokenizer de la lección 01 funcionaba en bytes UTF-8. Fue la llamada correcta. Pero nos saltamos algo importante: ¿qué pasa cuando esos bytes no son válidos UTF-8?

BPE de nivel de byte resuelve esto tratando cada valor de byte posible (0-255) como un token válido. Su vocabulario base es exactamente 256 entradas. Cualquier archivo - texto, binario, corrupto - puede ser tokenizado sin producir un token desconocido.

GPT-2 añadió un truco: mapear cada byte a un carácter de Unicode imprimible para que el vocabulario permanezca legible por el hombre. Byte 0x20 (espacio) se convierte en el carácter "G" en su mapeo. Esto es puramente cosmético. El algoritmo no le importa.

El poder real: el BPE de nivel de byte maneja todos los idiomas de la tierra. Los caracteres chinos son 3 bytes UTF-8 cada uno. El japonés puede ser 3-4 bytes. Árabe, Devanagari, emoji - todos sólo secuencias de byte. El algoritmo BPE encuentra patrones en estas secuencias de byte exactamente de la misma manera que encuentra patrones en bytes ASCII en inglés.

### Pre-tokenization

Antes de que BPE toque su texto, debe dividirlo en trozos. Esto evita que el algoritmo de fusión cree tokens que abarcan los límites de las palabras.

GPT-2 utiliza un patrón regex para dividir el texto:

```
'(?:[sdmt]|ll|ve|re)| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+
```

Este patrón se divide en contracciones ("no" se convierte en "don" + "'t"), palabras con espacios de dirección opcionales, números, puntuación y espacio blanco. El espacio de dirección se mantiene unido a la palabra, por lo que "el gato" se convierte en ["el", "el gato"], no en ["el", " ", "el gato"").

Llama utiliza SentencePiece, que omite regex por completo. Trata el flujo de byte crudo como una secuencia larga y permite al algoritmo BPE calcular los límites. Esto es más simple, pero le da a BPE más libertad para crear tokens de palabras cruzadas.

La elección es importante. el regex de GPT-2 impide que el tokenizer aprenda que "el" al final de una palabra y "el" al comienzo de la siguiente deben fusionarse. SentencePiece lo permite, lo que a veces produce una compresión más eficiente pero tokens menos interpretables.

### Tokens especiales

Cada tokenizer de producción reserva ID de tokens para marcadores estructurales:

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

Los tokens especiales nunca se dividen por BPE. Se emparejan exactamente antes de que se ejecute el algoritmo de fusión, se reemplazan con su ID fijo, y el texto circundante se tokeniza normalmente.

### Template de chat

Aquí es donde la mayoría de la gente se confunde y la mayoría de las implementaciones se rompen.

Cuando envías mensajes a un modelo de chat, la API acepta una lista de mensajes:

```
[
  {"role": "system", "content": "You are helpful."},
  {"role": "user", "content": "Hello"},
  {"role": "assistant", "content": "Hi there!"}
]
```

El modelo no ve JSON. Ve una secuencia de tokens plana. La plantilla de chat convierte mensajes en esa secuencia plana utilizando tokens especiales. Cada modelo hace esto de manera diferente:

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

Si la plantilla se equivoca, el modelo produce basura. Fue entrenado en un formato exacto. Cualquier desviación - una nueva línea faltante, un token cambiado, un espacio extra - pone la entrada fuera de la distribución de entrenamiento.

### Velocidad

Python es demasiado lento para la tokenización de producción.

Tiktoken (OpenAI) está escrito en Rust con enlaces Python. HuggingFace tokenizers también es Rust. SentencePiece es C ++. Estos logran 10-100x velocidades en Python puro.

Para la perspectiva: tokenizar 15 billones de tokens para Llama 3 pre-entrenamiento a 1 millón de tokens por segundo (Python rápido) tomaría 174 días.

Usted está construyendo en Python para entender el algoritmo. En la producción, usted usaría una implementación compilada y sólo tocar el envoltorio de Python.

```figure
weight-tying
```

## Construye el mismo

### Paso 1: codificación de nivel de byte

Convierta cualquier cadena en una secuencia de bytes, mapa cada byte a un carácter imprimible para la visualización, y invierta el proceso.

```python
def bytes_to_tokens(text):
    return list(text.encode("utf-8"))

def tokens_to_text(token_bytes):
    return bytes(token_bytes).decode("utf-8", errors="replace")
```

Prueba en texto multilingüe para ver el número de bytes:

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

"Hola" es 5 bytes. "你好" es 6 bytes (3 por carácter). El emoji de fuego es 4 bytes. El tokenizer de nivel de byte no importa qué idioma es.

### Paso 2: Pre-tokenizer con Regex

Divide el texto en trozos usando el patrón de regex GPT-2. Cada trozo se tokeniza de forma independiente por BPE.

```python
import re

try:
    import regex
    GPT2_PATTERN = regex.compile(
        r"""'(?:[sdmt]|ll|ve|re)| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+"""
    )
except ImportError:
    GPT2_PATTERN = re.compile(
        r"""'(?:[sdmt]|ll|ve|re)| ?[a-zA-Z]+| ?[0-9]+| ?[^\s\w]+|\s+(?!\S)|\s+"""
    )

def pre_tokenize(text):
    return [match.group() for match in GPT2_PATTERN.finditer(text)]
```

El `regex`el módulo admite las escapes de propiedad Unicode (`\p{L}`para las cartas, `\p{N}`La biblioteca estándar `re`El módulo no tiene, por lo que regresamos a las clases de caracteres ASCII. Para la producción de tokenizers multilingües, instalar `regex`¿ Qué ?

Prueba .

```python
print(pre_tokenize("Hello, world! Don't stop."))
# ['Hello', ',', ' world', '!', ' Don', "'t", ' stop', '.']
```

El espacio principal se mantiene unido a la palabra que le sigue. La primera palabra no tiene espacio antes de ella, por lo que su parte es`Hello`Las contracciones se dividen en el apóstrofo. La puntuación se convierte en su propia pieza.

### Paso 3: BPE en secuencias de byte

El algoritmo central de la Lección 01, pero ahora opera en trozos pre-tokenizados de forma independiente.

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

### Paso 4: Manejo de tokens especiales

Los tokens especiales necesitan una coincidencia exacta y identificación fija.

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

### Paso 5: Clasificación completa de tokenizaje

Enlace todo juntos: normaliza, divida en tokens especiales, pre-tokenize, BPE fusionar, mapa a IDs.

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

### Paso 6: Prueba multilingüe

La prueba real, lanza inglés, chino, emoji y código.

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

Los caracteres chinos producen 3 bytes cada uno. El emoji produce 4 bytes. ninguno de estos se estropean el tokenizer. ninguno produce tokens desconocidos. Eso es el poder de BPE de nivel de byte.

## Usalo

### Comparar los Tokenizers reales

Cargue los tokenizers reales de Llama 3, GPT-4 y Mistral. Ve cómo cada uno maneja el mismo párrafo multilingüe.

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

Verá diferentes recuentos de tokens para el mismo texto. Llama 3 con vocabulario 128K es más agresivo en la fusión de patrones comunes. GPT-4 con 100K se encuentra en el medio. Mistral con 32K produce más tokens pero tiene una capa de embebimiento más pequeña.

La compensación es siempre la misma: un vocabulario más grande significa secuencias más cortas pero más parámetros.

## Envío

Esta lección produce una instrucción para construir y deshacerse de tokenizers de producción.`outputs/prompt-tokenizer-builder.md`¿ Qué ?

## Los ejercicios

1. **Easy:**Añadir un`get_token_bytes(id)`método que muestra los bytes crudos para cualquier ID de token. Utilice para inspeccionar lo que sus tokens más comunes fusionados representan realmente.
2. **Medium:**Implemente el pre-tokenizer de estilo Llama que se divide en espacio blanco y dígitos pero mantiene espacios de liderazgo. Compara su vocabulario con el enfoque GPT-2 regex en el mismo corpus.
3. **Hard:**Añadir un método de plantilla de chat que toma una lista de `{"role": ..., "content": ...}`Los mensajes y produce la secuencia de tokens correcta para el formato de chat Llama 3.

## Términos clave

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

## Leer más

- [OpenAI tiktoken source](https://github.com/openai/tiktoken)-- Implementación de BPE de resistencia utilizada por GPT-3.5/4
- [HuggingFace tokenizers](https://github.com/huggingface/tokenizers)-- Rust tokenizer biblioteca que admite BPE, WordPiece, Unigram
- [Llama 3 paper (Meta, 2024)](https://arxiv.org/abs/2407.21783)-- detalles sobre el vocabulario y la formación de tokenizadores de 128K
- [SentencePiece (Kudo & Richardson, 2018)](https://arxiv.org/abs/1808.06226)-- Tokenización lingüística-agnóstica
- [GPT-2 tokenizer source](https://github.com/openai/gpt-2/blob/master/src/encoder.py)-- el mapa original de byte a Unicode
