# Construire un Tokenizer à partir de zéro

> La leçon 1 vous a donné un jouet.

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 10, Lesson 01 (Tokenizers: BPE, WordPiece, SentencePiece)
**Time:** ~90 minutes

## Objectifs d'apprentissage

- Construire un jeton BPE de qualité de production qui gère Unicode, la normalisation de l'espace blanc et des jetons spéciaux
- Implémenter une rétroaction au niveau des octets afin que le jeton puisse encoder toute entrée (y compris les emoji, CJK et code) sans jetons inconnus
- Ajouter des modèles regex pré-tokenization qui divisent le texte aux limites des mots avant d'appliquer des fusions BPE
- Exercer un jeton personnalisé sur un corpus et évaluer son rapport de compression par rapport au jeton sur le texte multilingue

## Le problème

Votre jeton BPE de leçon 01 fonctionne sur le texte anglais.

Il se brise.

Pas parce que BPE est faux - parce que la mise en œuvre est incomplète. Un tokeniseur de production gère les octets bruts dans n'importe quel codage, normalise Unicode avant de le diviser, gère des jetons spéciaux qui ne se fusionnent jamais, gère la pré-tokenization des chaînes avec la diviser des sous-parts, et fait tout cela assez rapidement pour ne pas entraver un pipeline de formation qui traite 15 billions de jetons.

Le jeton de GPT-2 a 50 257 jetons. Llama 3 est composé de 128 256. Le GPT-4 a environ 100 000 personnes. Ce ne sont pas des chiffres de jouets. Les tables de fusion derrière ces vocabulaires ont été formées sur des centaines de gigaoctets de texte, et les machines environnantes -- normalisation, pré-tokenization, injection de jetons spéciaux, formatage de modèles de chat -- sont ce qui sépare un tokenizer qui gère "bonjour monde" d'un qui gère l'ensemble d'Internet.

Vous allez construire cette machine.

## Le concept

### Le pipeline complet

Un jeton de production n'est pas un algorithme, c'est un pipeline de cinq étapes, chacune résolvant un problème différent.

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

Chaque étape a un travail spécifique:

| Stage | What It Does | Why It Matters |
|-------|-------------|----------------|
| Normalize | NFKC Unicode, lowercase optional, strip accents optional | "fi" ligature (U+FB01) becomes "fi" (two chars). Without this, same word gets different tokens. |
| Pre-Tokenize | Split text into chunks before BPE | Prevents BPE from merging across word boundaries. "the cat" should never produce a token "e c". |
| BPE Merge | Apply learned merge rules to byte sequences | The core compression. Turns raw bytes into subword tokens. |
| Special Tokens | Inject [BOS], [EOS], [PAD], chat template markers | These tokens have fixed IDs. They never participate in BPE merges. The model needs them for structure. |
| ID Mapping | Convert token strings to integer IDs | The model sees integers, not strings. |

### BPE de niveau octal

Le tokenizer de la leçon 01 fonctionnait sur des octets UTF-8. C'était la bonne décision. Mais nous avons omis quelque chose d'important: que se passe-t-il lorsque ces octets ne sont pas valides UTF-8?

Le BPE de niveau octet résolve cela en traitant chaque valeur octet possible (0-255) comme un jeton valide. Votre vocabulaire de base est exactement 256 entrées. Tout fichier - texte, binaire, corrompu - peut être jetonné sans produire un jeton inconnu.

GPT-2 a ajouté une astuce: cartographier chaque octet à un caractère Unicode imprimable afin que le vocabulaire reste lisible par l'homme.

La puissance réelle: le BPE au niveau des octets traite toutes les langues de la terre. Les caractères chinois sont 3 octets UTF-8 chacun. Le japonais peut être 3 à 4 octets. L'arabe, le Devanagari, l'emoji - tout juste des séquences de octets. L'algorithme BPE trouve des motifs dans ces séquences de octets exactement de la même façon qu'il trouve des motifs dans les octets ASCII anglais.

### Pré-tokenization

Avant que BPE touche votre texte, vous devez le diviser en morceaux. Cela empêche l'algorithme de fusion de créer des jetons qui couvrent les limites des mots.

GPT-2 utilise un modèle regex pour diviser le texte:

```
'(?:[sdmt]|ll|ve|re)| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+
```

Ce schéma se divise en contractions ("don't" devient "don" + "'t"), mots avec des espaces de pointe optionnels, des nombres, la ponctuation et l'espace blanc.

Llama utilise SentencePiece, qui saute complètement le regex. Il traite le flux de octets brut comme une longue séquence et permet à l'algorithme BPE de déterminer les limites.

Le choix est important. le regex de GPT-2 empêche le tokenizer d'apprendre que "le" à la fin d'un mot et "le" au début du suivant devraient fusionner.

### Les jetons spéciaux

Chaque tokenizer de production réserve des identifiants de jetons pour les marqueurs structurels:

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

Les jetons spéciaux ne sont jamais divisés par BPE. Ils sont correspondus exactement avant l'exécution de l'algorithme de fusion, remplacés par leur ID fixe, et le texte environnant est jetonné normalement.

### Templates de chat

C'est là que la plupart des gens se confondent et que la plupart des mises en œuvre se cassent.

Lorsque vous envoyez des messages à un modèle de chat, l'API accepte une liste de messages:

```
[
  {"role": "system", "content": "You are helpful."},
  {"role": "user", "content": "Hello"},
  {"role": "assistant", "content": "Hi there!"}
]
```

Le modèle ne voit pas JSON. Il voit une séquence de jetons plat. Le modèle de chat convertit les messages en cette séquence plate en utilisant des jetons spéciaux. Chaque modèle le fait différemment:

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

Si vous faites le modèle mal, le modèle produit des ordures. Il a été formé sur un format exact. Tout écart -- une nouvelle ligne manquante, un jeton échangé, un espace supplémentaire -- met l'entrée hors de la distribution de formation.

### Vite

Python est trop lent pour la tokenization de production.

Tiktoken (OpenAI) est écrit en Rust avec des liaisons Python. HuggingFace Tokenizers est également Rust. SentencePiece est C++. Ils atteignent des vitesses de 10 à 100 fois supérieures à Python pur.

Pour la perspective: la mise en séquence de 15 billions de jetons pour Llama 3 à 1 million de jetons par seconde (Python rapide) prendrait 174 jours.

Vous construisez en Python pour comprendre l'algorithme.

```figure
weight-tying
```

## Faites-le

### Étape 1: Enchâssage au niveau octet

La base. Convertir une chaîne en une séquence de octets, cartographier chaque octet à un caractère imprimable pour affichage, et inverser le processus.

```python
def bytes_to_tokens(text):
    return list(text.encode("utf-8"))

def tokens_to_text(token_bytes):
    return bytes(token_bytes).decode("utf-8", errors="replace")
```

Test sur le texte multilingue pour voir le nombre de octets:

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

"Hello" est de 5 octets. "你好" est de 6 octets (3 par caractère). L'emoji de feu est de 4 octets. Le jeton de niveau octet ne se soucie pas de quelle langue il s'agit.

### Étape 2: Pré-tokenizer avec Regex

Divisez le texte en morceaux en utilisant le modèle GPT-2 regex. Chaque morceau est sélectionné indépendamment par BPE.

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

Le `regex`module prend en charge les échappes de propriété Unicode (`\p{L}`pour les lettres, `\p{N}`La bibliothèque standard `re`module ne le fait pas, donc la chute construit les mêmes classes de `\w`Le numéro de la liste:`[^\W\d_]`correspond à n' importe quelle lettre Unicode et `\d`Pour les jetons multilingues de production, installez `regex`- Je suis désolé .

Essayez !

```python
print(pre_tokenize("Hello, world! Don't stop."))
# ['Hello', ',', ' world', '!', ' Don', "'t", ' stop', '.']
```

Le premier espace reste attaché au mot qui le suit.`Hello`Les contractions se divisent à l'apostrophe. La ponctuation devient sa propre pièce.

### Étape 3: BPE sur les séquences en octets

L'algorithme de base de la leçon 01, mais fonctionne maintenant sur des morceaux pré-tokénisés de manière indépendante.

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

### Étape 4: Traitement des jetons spéciaux

Les jetons spéciaux ont besoin d'une correspondance exacte et d'identifiants fixes.

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

### Étape 5: Classe de jetons complète

Chaînez tout ensemble: normaliser, diviser en jetons spéciaux, pré-tokenizer, fusionner BPE, carte à identifiants.

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

### Étape 6: Test multilingue

Le vrai test, lancez l'anglais, le chinois, l'emoji et le code.

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

Les caractères chinois produisent 3 octets chacun. L'emoji produit 4 octets. Aucun de ces casse le jeton. Aucun produit des jetons inconnus. C'est la puissance de BPE au niveau des octets.

## Utilisez-le

### Comparer les vrais jetons

Chargez les jetons réels de Llama 3, GPT-4 et Mistral. Voir comment chacun traite le même paragraphe multilingue.

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

Vous verrez différents nombres de jetons pour le même texte. Llama 3 avec 128K vocabulaire est plus agressif à fusionner les modèles communs. GPT-4 avec 100K se trouve au milieu. Mistral avec 32K produit plus de jetons mais a une couche d'embedding plus petite.

Le compromis est toujours le même: un vocabulaire plus grand signifie des séquences plus courtes mais plus de paramètres.

## La faire partir

Cette leçon produit une demande pour la construction et le débogage des tokenizers de production.`outputs/prompt-tokenizer-builder.md`- Je suis désolé .

## Exercices

1. **Easy:**Ajouter un `get_token_bytes(id)`Il est utilisé pour vérifier ce que vos jetons fusionnés les plus courants représentent réellement.
2. **Medium:**Implémenter le pré-tokenizer de style Llama qui se divise sur l'espace blanc et les chiffres mais conserve les espaces de pointe.
3. **Hard:**Ajoutez une méthode de modèle de chat qui prend une liste de `{"role": ..., "content": ...}`Les messages et produit la séquence de jetons correcte pour le format de chat Llama 3.

## Les termes clés

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

## Pour en savoir plus

- [OpenAI tiktoken source](https://github.com/openai/tiktoken)-- Implementation de BPE à rouille utilisée par GPT-3.5/4
- [HuggingFace tokenizers](https://github.com/huggingface/tokenizers)-- La bibliothèque de jetons de rouille prenant en charge BPE, WordPiece, Unigram
- [Llama 3 paper (Meta, 2024)](https://arxiv.org/abs/2407.21783)-- détails sur le vocabulaire et la formation des tokenizers 128K
- [SentencePiece (Kudo & Richardson, 2018)](https://arxiv.org/abs/1808.06226)-- Tokenization linguistique
- [GPT-2 tokenizer source](https://github.com/openai/gpt-2/blob/master/src/encoder.py)-- la cartographie originale en octets vers Unicode
